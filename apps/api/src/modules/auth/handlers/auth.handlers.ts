import type { Redacted } from 'effect';
import type { Cookie } from 'effect/http/Cookies';

import { Duration, Effect, Layer } from 'effect';
import { HttpServerRequest } from 'effect/http';
import { HttpApiBuilder } from 'effect/http-api';

import type { Mode } from '#infra/config/config.js';

import { AppApi } from '#infra/api/api.js';
import { ModeConfig } from '#infra/config/config.js';
import { getRequestPathname } from '#infra/errors/http-problem.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { authGroupIdentifier } from '#modules/auth/api/auth.api.constants.js';
import { AuthUnauthenticatedHttpError } from '#modules/auth/api/auth.api.errors.js';
import {
  CurrentSession,
  SessionAuthentication,
  sessionCookieSecurity,
} from '#modules/auth/api/session-authentication.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';

type SessionCookieData = {
  readonly credential: Redacted.Redacted;
  readonly expiresAt: Date;
};

// Доменные ошибки (email занят, неверные данные входа, нет Session) уходят
// как есть: в ответ их кодируют схемы из auth.api.ts и session-authentication.ts.
const makeTechnicalErrorHandler = makeTechnicalFailureHandler({
  module: 'auth',
  operations: AuthOperation,
});

const getBaseCookieOptions = (mode: Mode): Cookie['options'] => ({
  httpOnly: true,
  sameSite: 'lax',
  path: '/api',
  secure: mode === 'production',
});

export const AuthHandlersLive = HttpApiBuilder.group(
  AppApi,
  authGroupIdentifier,
  (handlers) =>
    Effect.gen(function* () {
      const mode = yield* ModeConfig;
      const baseCookieOptions = getBaseCookieOptions(mode);
      const setSessionCookie = ({ credential, expiresAt }: SessionCookieData) =>
        HttpApiBuilder.securitySetCookie(sessionCookieSecurity, credential, {
          ...baseCookieOptions,
          expires: expiresAt,
          maxAge: Duration.millis(sessionLifetimeMs),
        });

      return handlers
        .handle(AuthOperation.signup, ({ payload }) =>
          Effect.gen(function* () {
            const { passwordConfirm: __, ...rest } = payload;
            const service = yield* AuthService;
            const signupResult = yield* service.signup(rest).pipe(
              Effect.catchTag(
                'OperationFailed',
                makeTechnicalErrorHandler({
                  operation: AuthOperation.signup,
                }),
              ),
            );

            yield* setSessionCookie(signupResult);

            return signupResult.user;
          }),
        )
        .handle(AuthOperation.login, ({ payload }) =>
          Effect.gen(function* () {
            const service = yield* AuthService;
            const loginResult = yield* service
              .login(payload)
              .pipe(
                Effect.catchTag(
                  'OperationFailed',
                  makeTechnicalErrorHandler({ operation: AuthOperation.login }),
                ),
              );

            yield* setSessionCookie(loginResult);

            return loginResult.user;
          }),
        )
        .handle(AuthOperation.me, () =>
          Effect.gen(function* () {
            const currentSession = yield* CurrentSession;
            return currentSession.user;
          }),
        )
        .handle(AuthOperation.logout, () =>
          Effect.gen(function* () {
            const service = yield* AuthService;
            const cookie = yield* HttpApiBuilder.securityDecode(
              sessionCookieSecurity,
            );

            yield* service.logout(cookie).pipe(
              Effect.catchTag(
                'OperationFailed',
                makeTechnicalErrorHandler({
                  operation: AuthOperation.logout,
                }),
              ),
            );

            yield* HttpApiBuilder.securitySetCookie(sessionCookieSecurity, '', {
              ...baseCookieOptions,
              expires: new Date(0),
              maxAge: 0,
            });
          }),
        );
    }),
);

export const SessionAuthenticationLive = Layer.effect(
  SessionAuthentication,
  Effect.gen(function* () {
    const service = yield* AuthService;
    const handleTechnicalError = makeTechnicalErrorHandler({
      operation: AuthOperation.me,
    });

    return {
      cookie: (httpEffect, { credential }) =>
        Effect.gen(function* () {
          const session = yield* service.authenticate(credential).pipe(
            Effect.catchTags({
              AuthUnauthenticatedError: () =>
                Effect.gen(function* () {
                  const request = yield* HttpServerRequest.HttpServerRequest;

                  return yield* new AuthUnauthenticatedHttpError({
                    instance: getRequestPathname(request),
                  });
                }),
              OperationFailed: handleTechnicalError,
            }),
          );

          return yield* httpEffect.pipe(
            Effect.provideService(CurrentSession, session),
          );
        }),
    };
  }),
);
