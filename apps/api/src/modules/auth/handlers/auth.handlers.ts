import type { Redacted } from 'effect';

import { Duration, Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#infra/api/api.js';
import { ModeConfig } from '#infra/config/config.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { authGroupIdentifier } from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInvalidCredentialsHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import {
  SessionAuthentication,
  sessionCookieSecurity,
} from '#modules/auth/api/session-authentication.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';

type SessionCookieData = {
  readonly credential: Redacted.Redacted<string>;
  readonly expiresAt: Date;
};

const makeTechnicalErrorHandler = makeTechnicalFailureHandler({
  module: 'auth',
  operations: AuthOperation,
  reasons: {
    AuthInternalError: 'internal',
    AuthUnavailableError: 'unavailable',
  },
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
