import type { Redacted } from 'effect';
import type { Cookie } from 'effect/unstable/http/Cookies';

import { Duration, Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import type { Mode } from '#infra/config/config.js';
import type { AuthTechnicalError } from '#modules/auth/service/auth.service.errors.js';

import { AppApi } from '#infra/api/api.js';
import { ModeConfig } from '#infra/config/config.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { authGroupIdentifier } from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInvalidCredentialsHttpError,
  AuthUnauthenticatedHttpError,
} from '#modules/auth/api/auth.api.errors.js';
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

const makeTechnicalErrorHandler =
  makeTechnicalFailureHandler<AuthTechnicalError>()({
    module: 'auth',
    operations: AuthOperation,
    reasons: {
      AuthDataIntegrityError: 'dataIntegrity',
      AuthInternalError: 'internal',
      AuthUnavailableError: 'unavailable',
    },
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
            const handleTechnicalError = makeTechnicalErrorHandler({
              userId: null,
              operation: AuthOperation.signup,
            });

            const signupResult = yield* service.signup(rest).pipe(
              Effect.catchTags({
                AuthEmailAlreadyExistsError: () =>
                  new AuthEmailAlreadyExistsHttpError(),
                AuthDataIntegrityError: handleTechnicalError,
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
                AuthDataIntegrityError: handleTechnicalError,
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

            const handleTechnicalError = makeTechnicalErrorHandler({
              userId: null,
              operation: AuthOperation.logout,
            });

            yield* service.logout(cookie).pipe(
              Effect.catchTags({
                AuthUnavailableError: handleTechnicalError,
                AuthInternalError: handleTechnicalError,
                AuthDataIntegrityError: handleTechnicalError,
              }),
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
      userId: null,
      operation: AuthOperation.me,
    });

    return {
      cookie: (httpEffect, { credential }) =>
        Effect.gen(function* () {
          const session = yield* service.authenticate(credential).pipe(
            Effect.catchTags({
              AuthUnauthenticatedError: () =>
                new AuthUnauthenticatedHttpError(),
              AuthDataIntegrityError: handleTechnicalError,
              AuthInternalError: handleTechnicalError,
              AuthUnavailableError: handleTechnicalError,
            }),
          );

          return yield* httpEffect.pipe(
            Effect.provideService(CurrentSession, session),
          );
        }),
    };
  }),
);
