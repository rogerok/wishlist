import type { Redacted } from 'effect';

import { type Cause, Duration, Effect, Layer, Match } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { isSqlError } from 'effect/unstable/sql/SqlError';
import { match, P } from 'ts-pattern';

import type { AuthFailureLogAnnotation } from '#modules/auth/schemas/auth-logs.schema.js';
import type {
  AuthInternalError,
  AuthUnavailableError,
  SignupOperationError,
} from '#modules/auth/service/auth.service.errors.js';

import { AppApi } from '#infra/api/api.js';
import { ModeConfig } from '#infra/config/config.js';
import {
  authGroupIdentifier,
  authLoginPath,
  authMePath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthInvalidCredentialsHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import {
  SessionAuthentication,
  sessionCookieSecurity,
} from '#modules/auth/api/session-authentication.js';
import {
  AuthFailureReason,
  AuthLogEvent,
} from '#modules/auth/schemas/auth-logs.schema.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';
import { UserFailureReason } from '#modules/users/schemas/user-logs.schema.js';

type SignupOperationsTags = ReadonlyArray<SignupOperationError['_tag']>;
type LogOptions = {
  cause: AuthInternalError | AuthUnavailableError;
} & Omit<AuthFailureLogAnnotation, 'event'>;
type TechnicalErrorContext = {
  instance: AuthInternalHttpError['instance'];
} & Pick<AuthFailureLogAnnotation, 'operation' | 'userId'>;
type SessionCookieData = {
  readonly credential: Redacted.Redacted<string>;
  readonly expiresAt: Date;
};

const authRepositoryErrorTag = [
  'UsersRepositoryError',
  'PasswordCredentialsRepositoryError',
  'SessionRepositoryError',
] as const satisfies SignupOperationsTags;
const authKnownCauseTags = [
  ...authRepositoryErrorTag,
  'PasswordHashOverloadedError',
  'SecurePrimitiveUnavailableError',
  'PasswordHashIntegrityError',
  'InvalidUserRecord',
  'PasswordCredentialsInvalidRecord',
  'SessionInvalidRecordError',
  'PasswordCredentialsAlreadyExists',
  'SessionTokenDigestAlreadyExistsError',
] as const satisfies SignupOperationsTags;

const makeTechnicalErrorHandler =
  ({ operation, userId, instance }: TechnicalErrorContext) =>
  (
    cause: LogOptions['cause'],
  ): Effect.Effect<never, AuthInternalHttpError | AuthUnavailableHttpError> =>
    Match.value(cause).pipe(
      Match.tag('AuthInternalError', () =>
        logAndFail(
          {
            operation,
            cause,
            userId,
            reason: UserFailureReason.internal,
          },
          new AuthInternalHttpError({
            instance,
          }),
        ),
      ),

      Match.tag('AuthUnavailableError', () =>
        logAndFail(
          {
            operation,
            cause,
            userId,
            reason: AuthFailureReason.unavailable,
          },
          new AuthUnavailableHttpError({
            instance,
          }),
        ),
      ),
      Match.exhaustive,
    );

const toAuthFailureLog = (error: LogOptions['cause']) => {
  const base = { errorTag: error._tag };

  return match(error.cause)
    .with(P.when(isSqlError), (cause) => ({
      ...base,
      causeTag: cause._tag,
      sqlReason: cause.reason._tag,
    }))
    .with(
      { _tag: P.union(...authRepositoryErrorTag), cause: P.when(isSqlError) },
      ({ _tag, cause }) => ({
        ...base,
        causeTag: _tag,
        sqlReason: cause.reason._tag,
      }),
    )
    .with(
      {
        _tag: P.union(...authKnownCauseTags),
      },
      ({ _tag }) => ({
        ...base,
        causeTag: _tag,
      }),
    )
    .otherwise(() => base);
};

const logFailure = ({ operation, userId, reason, cause }: LogOptions) =>
  Effect.logError('Auth operation failed').pipe(
    Effect.annotateLogs({
      event: AuthLogEvent['auth.operation.failed'],
      operation,
      userId,
      reason,
      ...toAuthFailureLog(cause),
    }),
  );

const logAndFail = <E extends Cause.YieldableError>(
  options: LogOptions,
  error: E,
) =>
  Effect.gen(function* () {
    yield* logFailure(options);
    return yield* error;
  });

export const AuthHandlersLive = HttpApiBuilder.group(
  AppApi,
  authGroupIdentifier,
  (handlers) =>
    Effect.gen(function* () {
      const mode = yield* ModeConfig;
      const setSessionCookie = ({ credential, expiresAt }: SessionCookieData) =>
        HttpApiBuilder.securitySetCookie(sessionCookieSecurity, credential, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/api',
          secure: mode === 'production',
          expires: expiresAt,
          maxAge: Duration.millis(sessionLifetimeMs),
        });

      return handlers
        .handle(AuthOperation.signup, ({ payload }) =>
          Effect.gen(function* () {
            // oxlint-disable-next-line no-unused-vars
            const { passwordConfirm, ...rest } = payload;
            const service = yield* AuthService;
            const handleTechnicalError = makeTechnicalErrorHandler({
              instance: authSignupPath,
              userId: null,
              operation: AuthOperation.signup,
            });

            const signupResult = yield* service.signup(rest).pipe(
              Effect.catchTags({
                AuthEmailAlreadyExistsError: () =>
                  new AuthEmailAlreadyExistsHttpError(),
                AuthInternalError: handleTechnicalError,
                AuthUnavailableError: handleTechnicalError,
              }),
            );

            yield* setSessionCookie(signupResult);

            return signupResult.user;
          }),
        )
        .handle(AuthOperation.login, ({ payload }) =>
          Effect.gen(function* () {
            const service = yield* AuthService;
            const handleTechnicalError = makeTechnicalErrorHandler({
              instance: authLoginPath,
              userId: null,
              operation: AuthOperation.login,
            });
            const loginResult = yield* service.login(payload).pipe(
              Effect.catchTags({
                AuthInvalidCredentialsError: () =>
                  new AuthInvalidCredentialsHttpError(),
                AuthInternalError: handleTechnicalError,
                AuthUnavailableError: handleTechnicalError,
              }),
            );

            yield* setSessionCookie(loginResult);

            return loginResult.user;
          }),
        )
        .handle(AuthOperation.me, () =>
          Effect.gen(function* () {
            // Взять User из Context, который заполнил middleware
            // TODO(you) 3: прочитать CurrentSession и вернуть публичного User.
            return yield* Effect.die('TODO(you) 3: /me handler');
          }),
        );
    }),
);

export const SessionAuthenticationLive = Layer.effect(
  SessionAuthentication,
  Effect.gen(function* () {
    const service = yield* AuthService;
    const handleTechnicalError = makeTechnicalErrorHandler({
      instance: authMePath,
      userId: null,
      operation: AuthOperation.me,
    });

    return {
      cookie: (httpEffect, { credential }) =>
        Effect.gen(function* () {
          // Проверить cookie и перевести ошибки сервиса в HTTP-ошибки
          // TODO(you) 1: вызвать service.authenticate(credential);
          // отказ → AuthUnauthenticatedHttpError, технические ошибки → handleTechnicalError.
          const session = yield* Effect.die('TODO(you) 1: authenticate');

          // Пустить запрос дальше с сессией в Context
          // TODO(you) 2: запустить httpEffect, предоставив ему CurrentSession.
          return yield* Effect.die('TODO(you) 2: provide CurrentSession');
        }),
    };
  }),
);
