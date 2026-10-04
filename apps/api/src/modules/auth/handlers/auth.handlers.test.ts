import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, it } from '@effect/vitest';
import {
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  Redacted,
  Schema,
} from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import { SqlError, UnknownError } from 'effect/unstable/sql/SqlError';

import type { SignupResult } from '#modules/auth/schemas/signup/signup.schema.js';
import type { AuthSignupError } from '#modules/auth/service/auth.service.errors.js';

import {
  RequestValidationHttpError,
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { authGroupIdentifier } from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import {
  AuthHandlersLive,
  SessionAuthenticationLive,
} from '#modules/auth/handlers/auth.handlers.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import {
  AuthEmailAlreadyExistsError,
  AuthInternalError,
  AuthUnavailableError,
} from '#modules/auth/service/auth.service.errors.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { PasswordHashOverloadedError } from '#modules/auth/service/password/password-hasher.service.errors.js';
import { SecurePrimitiveUnavailableError } from '#modules/auth/service/session/session-token-generator.errors.js';
import { UsersRepositoryError } from '#modules/users/repository/users.repository.errors.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

const email = 'user@example.test';
const password = 'Password1!';
const sensitiveMarker = 'sensitive@mail.com';
const sqlError = new SqlError({
  reason: new UnknownError({
    cause: {
      detail: sensitiveMarker,
    },
  }),
});

const headers = { 'content-type': 'application/json' };

const logs: Array<ReturnType<typeof Logger.formatStructured.log>> = [];
const logger = Logger.make(
  (options) => void logs.push(Logger.formatStructured.log(options)),
);

const testApi = HttpApi.make('app')
  .add(authGroup)
  .middleware(RequestValidationMiddleware);

const makeApp = (
  effect: Effect.Effect<SignupResult, AuthSignupError>,
  mode: 'production' | 'test' = 'test',
) => {
  const authLayer = Layer.succeed(AuthService, {
    signup: () => effect,
    login: () => Effect.die(new Error('Unexpected call: login')),
    authenticate: () => Effect.die(new Error('Unexpected call: authenticate')),
  });

  const config = ConfigProvider.fromUnknown({
    MODE: mode,
  }).pipe(ConfigProvider.layer);

  const testAppLive = HttpApiBuilder.layer(testApi).pipe(
    Layer.provide([
      AuthHandlersLive.pipe(
        Layer.provide([
          RequestValidationMiddlewareLive,
          SessionAuthenticationLive.pipe(Layer.provide(authLayer)),
          config,
        ]),
      ),
      NodeHttpServer.layerHttpServices,
    ]),
    HttpRouter.provideRequest(authLayer),
  );

  return HttpRouter.toWebHandler(
    testAppLive.pipe(Layer.provide(Logger.layer([logger]))),
  );
};

const makeSignupRequest = () =>
  new Request(
    `http://localhost/api/${authGroupIdentifier}/${AuthOperation.signup}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        firstName: null,
        middleName: null,
        lastName: null,
      }),
    },
  );

beforeEach(() => {
  logs.length = 0;
});

describe('signup errors handling', () => {
  it.effect('internal error return 500 code', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(new AuthInternalError({ cause: sqlError }))),
        (app) => Effect.promise(() => app.dispose()),
      );

      const request = makeSignupRequest();
      const resp = yield* Effect.promise(() => app.handler(request));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(AuthInternalHttpError)(
        json,
      );

      const failedLogs = logs.filter(
        (log) => log.annotations.event === 'auth.operation.failed',
      );

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0]?.annotations).toMatchObject({
        event: 'auth.operation.failed',
        operation: 'signup',
        userId: null,
        reason: 'internal',
        errorTag: 'AuthInternalError',
        causeTag: 'SqlError',
        sqlReason: 'UnknownError',
      });
      expect(JSON.stringify(logs)).not.include(sensitiveMarker);
      expect(resp.status).toBe(500);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBe(null);
      expect(body.code).toBe('AUTH_INTERNAL_ERROR');
      expect(JSON.stringify(json)).not.include(sensitiveMarker);
    }),
  );

  it.effect('repository error return 500 code', () =>
    Effect.gen(function* () {
      const repoError = new UsersRepositoryError({
        cause: sqlError,
        operation: UserOperation.create,
      });
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(new AuthInternalError({ cause: repoError }))),
        (app) => Effect.promise(() => app.dispose()),
      );

      const request = makeSignupRequest();
      const resp = yield* Effect.promise(() => app.handler(request));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(AuthInternalHttpError)(
        json,
      );

      const failedLogs = logs.filter(
        (log) => log.annotations.event === 'auth.operation.failed',
      );

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0]?.annotations).toMatchObject({
        event: 'auth.operation.failed',
        operation: 'signup',
        userId: null,
        reason: 'internal',
        errorTag: 'AuthInternalError',
        causeTag: 'UsersRepositoryError',
        sqlReason: 'UnknownError',
      });
      expect(JSON.stringify(logs)).not.include(sensitiveMarker);
      expect(resp.status).toBe(500);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBe(null);
      expect(body.code).toBe('AUTH_INTERNAL_ERROR');
      expect(JSON.stringify(json)).not.include(sensitiveMarker);
    }),
  );

  it.effect('password overload error', () =>
    Effect.gen(function* () {
      const authError = new PasswordHashOverloadedError({
        cause: new Error(sensitiveMarker),
      });

      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeApp(new AuthUnavailableError({ cause: authError })),
        ),
        (app) => Effect.promise(() => app.dispose()),
      );

      const request = makeSignupRequest();
      const resp = yield* Effect.promise(() => app.handler(request));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(AuthUnavailableHttpError)(
        json,
      );

      const failedLogs = logs.filter(
        (log) => log.annotations.event === 'auth.operation.failed',
      );

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0]?.annotations).toMatchObject({
        event: 'auth.operation.failed',
        operation: 'signup',
        userId: null,
        reason: 'unavailable',
        errorTag: 'AuthUnavailableError',
        causeTag: 'PasswordHashOverloadedError',
      });
      expect(failedLogs[0]?.annotations).not.toHaveProperty('sqlReason');
      expect(JSON.stringify(logs)).not.include(sensitiveMarker);
      expect(resp.status).toBe(503);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBe(null);
      expect(body.code).toBe('AUTH_UNAVAILABLE_ERROR');
      expect(JSON.stringify(json)).not.include(sensitiveMarker);
    }),
  );

  it.effect('returns a diagnostic 503 when a secure primitive fails', () =>
    Effect.gen(function* () {
      const cause = new SecurePrimitiveUnavailableError({
        cause: new Error(sensitiveMarker),
      });
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(new AuthUnavailableError({ cause }))),
        (app) => Effect.promise(() => app.dispose()),
      );

      const resp = yield* Effect.promise(() =>
        app.handler(makeSignupRequest()),
      );
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(AuthUnavailableHttpError)(
        json,
      );
      const failedLogs = logs.filter(
        (log) => log.annotations.event === 'auth.operation.failed',
      );

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0]?.annotations).toMatchObject({
        event: 'auth.operation.failed',
        operation: 'signup',
        userId: null,
        reason: 'unavailable',
        errorTag: 'AuthUnavailableError',
        causeTag: 'SecurePrimitiveUnavailableError',
      });
      expect(failedLogs[0]?.annotations).not.toHaveProperty('sqlReason');
      expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
      expect(resp.status).toBe(503);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBeNull();
      expect(body.code).toBe('AUTH_UNAVAILABLE_ERROR');
      expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
    }),
  );

  it.effect('returns a safe 500 without exposing an unknown cause', () =>
    Effect.gen(function* () {
      const cause = new Error(sensitiveMarker);
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(new AuthInternalError({ cause }))),
        (app) => Effect.promise(() => app.dispose()),
      );

      const resp = yield* Effect.promise(() =>
        app.handler(makeSignupRequest()),
      );
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(AuthInternalHttpError)(
        json,
      );
      const failedLogs = logs.filter(
        (log) => log.annotations.event === 'auth.operation.failed',
      );

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0]?.annotations).toMatchObject({
        event: 'auth.operation.failed',
        operation: 'signup',
        userId: null,
        reason: 'internal',
        errorTag: 'AuthInternalError',
      });
      expect(failedLogs[0]?.annotations).not.toHaveProperty('causeTag');
      expect(failedLogs[0]?.annotations).not.toHaveProperty('sqlReason');
      expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
      expect(resp.status).toBe(500);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBeNull();
      expect(body.code).toBe('AUTH_INTERNAL_ERROR');
      expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
    }),
  );

  it.effect(
    'returns 409 without a technical error event for an email conflict',
    () =>
      Effect.gen(function* () {
        const app = yield* Effect.acquireRelease(
          Effect.sync(() =>
            makeApp(
              new AuthEmailAlreadyExistsError({
                cause: new Error(sensitiveMarker),
              }),
            ),
          ),
          (app) => Effect.promise(() => app.dispose()),
        );

        const resp = yield* Effect.promise(() =>
          app.handler(makeSignupRequest()),
        );
        const json = yield* Effect.promise(() => resp.json());
        const body = yield* Schema.decodeUnknownEffect(
          AuthEmailAlreadyExistsHttpError,
        )(json);
        const failedLogs = logs.filter(
          (log) => log.annotations.event === 'auth.operation.failed',
        );

        expect(failedLogs).toHaveLength(0);
        expect(logs.filter((log) => log.level === 'ERROR')).toHaveLength(0);
        expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
        expect(resp.status).toBe(409);
        expect(resp.headers.get('content-type')).toBe(
          'application/problem+json',
        );
        expect(resp.headers.get('set-cookie')).toBeNull();
        expect(body.code).toBe('USER_EMAIL_ALREADY_EXISTS');
        expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      }),
  );
});

const credential = 'test-session-credential';
const expiresAt = new Date('2030-01-01T00:00:00.000Z');

const publicUser = Schema.decodeSync(UserResponseSchema)({
  id: '00000000-0000-4000-8000-000000000001',
  email,
  firstName: null,
  lastName: null,
  middleName: null,
});

const signupResult: SignupResult = {
  user: publicUser,
  credential: Redacted.make(credential),
  expiresAt,
};

describe('successful signup', () => {
  it.effect('returns 201 with only the public user', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.succeed(signupResult))),
        (app) => Effect.promise(() => app.dispose()),
      );

      const resp = yield* Effect.promise(() =>
        app.handler(makeSignupRequest()),
      );
      const json = yield* Effect.promise(() => resp.json());
      const cookies = resp.headers.getSetCookie();
      const credsCookies = cookies[0];
      expect(cookies).toHaveLength(1);

      const cookieParts = credsCookies?.split(';').map((part) => part.trim());

      expect(cookieParts?.[0]).toBe(`${cookieSessionKey}=${credential}`);

      const attributes = cookieParts?.slice(1);

      expect(attributes).toEqual(
        expect.arrayContaining([
          'HttpOnly',
          'SameSite=Lax',
          'Path=/api',
          `Expires=${expiresAt.toUTCString()}`,
          'Max-Age=604800',
        ]),
      );
      expect(attributes).not.toContain('Secure');

      expect(resp.status).toBe(201);
      expect(json).toEqual(publicUser);
      expect(JSON.stringify(json)).not.include(credential);
      expect(JSON.stringify(logs)).not.include(credential);
    }),
  );

  it.effect('keep Secure in production', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.succeed(signupResult), 'production')),
        (app) => Effect.promise(() => app.dispose()),
      );

      const resp = yield* Effect.promise(() =>
        app.handler(makeSignupRequest()),
      );
      const cookies = resp.headers.getSetCookie();
      const credsCookies = cookies[0];
      expect(cookies).toHaveLength(1);

      const cookieParts = credsCookies?.split(';').map((part) => part.trim());

      expect(cookieParts?.[0]).toBe(`${cookieSessionKey}=${credential}`);

      const attributes = cookieParts?.slice(1);

      expect(attributes).toEqual(
        expect.arrayContaining([
          'HttpOnly',
          'SameSite=Lax',
          'Path=/api',
          `Expires=${expiresAt.toUTCString()}`,
          'Max-Age=604800',
          'Secure',
        ]),
      );

      expect(resp.status).toBe(201);
    }),
  );
});

describe('signup request validation', () => {
  it.effect('rejects an extra role field before executing signup', () =>
    Effect.gen(function* () {
      let signupExecutions = 0;
      const signup = Effect.sync(() => {
        signupExecutions += 1;
        return signupResult;
      });
      const request = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          password,
          passwordConfirm: password,
          firstName: null,
          middleName: null,
          lastName: null,
          role: 'admin',
        }),
      });
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(signup)),
        (app) => Effect.promise(() => app.dispose()),
      );
      const resp = yield* Effect.promise(() => app.handler(request));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(
        RequestValidationHttpError,
      )(json);

      expect(resp.status).toBe(400);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(body.code).toBe('REQUEST_VALIDATION_FAILED');
      expect(body.instance).toBe('/api/auth/signup');
      expect(body.errors).toEqual([
        expect.objectContaining({
          location: 'payload',
          path: ['role'],
        }),
      ]);
      expect(signupExecutions).toBe(0);
      expect(resp.headers.getSetCookie()).toEqual([]);
      expect(
        logs.filter((log) => log.annotations.event === 'auth.operation.failed'),
      ).toHaveLength(0);
      expect(logs.filter((log) => log.level === 'ERROR')).toHaveLength(0);
    }),
  );
});
