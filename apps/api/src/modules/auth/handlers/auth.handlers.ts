import { type Cause, Duration, Effect } from 'effect';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';
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
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import {
  AuthFailureReason,
  AuthLogEvent,
} from '#modules/auth/schemas/auth-logs.schema.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';

type SignupOperationsTags = ReadonlyArray<SignupOperationError['_tag']>;
type LogOptions = {
  cause: AuthInternalError | AuthUnavailableError;
} & Omit<AuthFailureLogAnnotation, 'event'>;

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
      const sessionCookies = HttpApiSecurity.apiKey({
        key: cookieSessionKey,
        in: 'cookie',
      });
      const mode = yield* ModeConfig;

      return handlers.handle(AuthOperation.signup, ({ payload }) =>
        Effect.gen(function* () {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { passwordConfirm, ...rest } = payload;
          const service = yield* AuthService;
          const signupResult = yield* service.signup(rest).pipe(
            Effect.catchTags({
              AuthEmailAlreadyExistsError: () =>
                new AuthEmailAlreadyExistsHttpError(),
              AuthInternalError: (cause) =>
                logAndFail(
                  {
                    operation: AuthOperation.signup,
                    reason: AuthFailureReason.internal,
                    cause,
                    userId: null,
                  },
                  new AuthInternalHttpError({ instance: authSignupPath }),
                ),
              AuthUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: AuthOperation.signup,
                    reason: AuthFailureReason.unavailable,
                    cause,
                    userId: null,
                  },
                  new AuthUnavailableHttpError({ instance: authSignupPath }),
                ),
            }),
          );

          yield* HttpApiBuilder.securitySetCookie(
            sessionCookies,
            signupResult.credential,
            {
              httpOnly: true,
              sameSite: 'lax',
              path: '/api',
              secure: mode === 'production',
              expires: signupResult.expiresAt,
              maxAge: Duration.millis(sessionLifetimeMs),
            },
          );

          return signupResult.user;
        }),
      );
    }),
);
