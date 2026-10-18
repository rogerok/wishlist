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
import { HttpRouter } from 'effect/http';
import { HttpApi, HttpApiBuilder } from 'effect/http-api';
import { SqlError, UnknownError } from 'effect/sql/SqlError';

import type { FailureReason } from '#infra/errors/operation-failed.js';
import type { SignupResult } from '#modules/auth/schemas/signup/signup.schema.js';

import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import { OperationFailed } from '#infra/errors/operation-failed.js';
import {
  RequestValidationHttpError,
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { operationFailedEvent } from '#infra/errors/technical-failure.js';
import {
  InternalHttpError,
  ServiceUnavailableHttpError,
} from '#infra/errors/technical-http-errors.js';
import { captureConsole } from '#infra/logging/capture-console.js';
import { authGroupIdentifier } from '#modules/auth/api/auth.api.constants.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import {
  AuthHandlersLive,
  SessionAuthenticationLive,
} from '#modules/auth/handlers/auth.handlers.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

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
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

const makeApp = (
  effect: Effect.Effect<
    SignupResult,
    OperationFailed | UserEmailAlreadyExistsError
  >,
  mode: 'production' | 'test' = 'test',
) => {
  const authLayer = Layer.succeed(AuthService, {
    signup: () => effect,
    login: () => Effect.die(new Error('Unexpected call: login')),
    logout: () => Effect.die(new Error('Unexpected call: logout')),
    authenticate: () => Effect.die(new Error('Unexpected call: authenticate')),
  });

  const config = ConfigProvider.fromUnknown({
    MODE: mode,
  }).pipe(ConfigProvider.layer);

  const testAppLive = HttpApiBuilder.layer(testApi).pipe(
    Layer.provide([
      AuthHandlersLive.pipe(
        Layer.provide([
          DefectBoundaryMiddlewareLive.pipe(Layer.provide(config)),
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
        displayName: 'Test User',
      }),
    },
  );

beforeEach(() => {
  logs.length = 0;
});

const failedLogs = () =>
  logs.filter((log) => log.annotations.event === operationFailedEvent);

const failed = (
  reason: FailureReason,
  source: string,
  operation: string,
  cause: unknown,
) => new OperationFailed({ reason, source, operation, cause });

const usersRepositoryError = failed(
  'internal',
  'usersRepository',
  UserOperation.create,
  sqlError,
);

describe('signup errors handling', () => {
  it.effect.each([
    {
      name: 'SQL error',
      failure: failed('internal', 'authService', 'signup', sqlError),
      reason: 'internal',
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      name: 'repository error',
      failure: usersRepositoryError,
      reason: 'internal',
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      name: 'unknown cause',
      failure: failed(
        'internal',
        'authService',
        'signup',
        new Error(sensitiveMarker),
      ),
      reason: 'internal',
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      name: 'corrupted record',
      failure: failed(
        'dataIntegrity',
        'usersRepository',
        UserOperation.create,
        new Error(sensitiveMarker),
      ),
      reason: 'dataIntegrity',
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      name: 'password hasher overload',
      failure: failed(
        'unavailable',
        'passwordHasher',
        'hash',
        new Error(sensitiveMarker),
      ),
      reason: 'unavailable',
      status: 503,
      schema: ServiceUnavailableHttpError,
      code: 'SERVICE_UNAVAILABLE',
    },
    {
      name: 'secure primitive failure',
      failure: failed(
        'unavailable',
        'secureRandomBytes',
        'get',
        new Error(sensitiveMarker),
      ),
      reason: 'unavailable',
      status: 503,
      schema: ServiceUnavailableHttpError,
      code: 'SERVICE_UNAVAILABLE',
    },
  ] as const)(
    'returns a safe $status for $name',
    ({ failure, reason, status, schema, code }) =>
      Effect.gen(function* () {
        const app = yield* Effect.acquireRelease(
          Effect.sync(() => makeApp(failure)),
          (started) => Effect.promise(() => started.dispose()),
        );

        const resp = yield* Effect.promise(() =>
          app.handler(makeSignupRequest()),
        );
        const json = yield* Effect.promise(() => resp.json());
        const body = yield* Schema.decodeUnknownEffect(schema)(json);

        expect(resp.status).toBe(status);
        expect(resp.headers.get('content-type')).toBe(
          'application/problem+json',
        );
        expect(resp.headers.get('set-cookie')).toBeNull();
        expect(body.code).toBe(code);
        expect(body.instance).toBe('/api/auth/signup');
        expect(body.errorId).toMatch(/^[0-9a-f]{32}$/);
        expect(failedLogs()).toHaveLength(1);
        expect(failedLogs()[0]?.annotations).toMatchObject({
          kind: 'failure',
          module: 'auth',
          operation: 'signup',
          meta: {},
          reason,
          errorId: body.errorId,
        });
        expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
        expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      }),
  );

  it.effect.each([
    {
      header: 'traceparent',
      traceHeaders: {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      clientValue: '0af7651916cd43dd8448eb211c80319c',
    },
    {
      header: 'x-b3-traceid',
      traceHeaders: { 'x-b3-traceid': 'forged-by-client', 'x-b3-spanid': 'x' },
      clientValue: 'forged-by-client',
    },
  ])('ignores an incoming $header header', ({ traceHeaders, clientValue }) =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeApp(failed('internal', 'authService', 'signup', sqlError)),
        ),
        (started) => Effect.promise(() => started.dispose()),
      );
      const request = makeSignupRequest();
      for (const [name, value] of Object.entries(traceHeaders)) {
        request.headers.set(name, value);
      }

      const resp = yield* Effect.promise(() => app.handler(request));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(InternalHttpError)(json);

      expect(resp.status).toBe(500);
      expect(body.errorId).toMatch(/^[0-9a-f]{32}$/);
      expect(failedLogs()[0]?.annotations).toMatchObject({
        errorId: body.errorId,
      });
      expect(JSON.stringify(json)).not.toContain(clientValue);
      expect(JSON.stringify(logs)).not.toContain(clientValue);
    }),
  );

  it.effect('returns a safe 500 for an unexpected exception', () =>
    Effect.gen(function* () {
      const consoleOutput = yield* captureConsole;
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.die(new Error(sensitiveMarker)))),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() =>
        app.handler(makeSignupRequest()),
      );
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(InternalHttpError)(json);

      expect(resp.status).toBe(500);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(resp.headers.get('set-cookie')).toBeNull();
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.instance).toBe('/api/auth/signup');
      expect(failedLogs()).toHaveLength(1);
      expect(failedLogs()[0]?.annotations).toMatchObject({
        kind: 'defect',
        module: 'auth',
        operation: 'signup',
        reason: 'internal',
        errorId: body.errorId,
      });
      expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
      expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      expect(consoleOutput.join('\n')).not.toContain(sensitiveMarker);
    }),
  );

  it.effect('logs the error chain down to the SQL reason', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(usersRepositoryError)),
        (started) => Effect.promise(() => started.dispose()),
      );

      yield* Effect.promise(() => app.handler(makeSignupRequest()));

      expect(failedLogs()[0]?.annotations.errorChain).toEqual([
        {
          tag: 'OperationFailed',
          source: 'usersRepository',
          operation: UserOperation.create,
        },
        { tag: 'SqlError' },
        { tag: 'UnknownError' },
      ]);
    }),
  );

  it.effect(
    'returns 409 without a technical error event for an email conflict',
    () =>
      Effect.gen(function* () {
        const app = yield* Effect.acquireRelease(
          Effect.sync(() => makeApp(new UserEmailAlreadyExistsError())),
          (started) => Effect.promise(() => started.dispose()),
        );

        const resp = yield* Effect.promise(() =>
          app.handler(makeSignupRequest()),
        );
        const text = yield* Effect.promise(() => resp.text());

        expect(failedLogs()).toHaveLength(0);
        expect(logs.filter((log) => log.level === 'ERROR')).toHaveLength(0);
        expect(resp.status).toBe(409);
        expect(resp.headers.get('content-type')).toBe(
          'application/problem+json',
        );
        expect(resp.headers.get('set-cookie')).toBeNull();
        // Тело совпадает с контрактом до перехода на доменные ошибки (7861119).
        expect(text).toBe(
          JSON.stringify({
            code: 'USER_EMAIL_ALREADY_EXISTS',
            detail: 'A user with this email already exists',
            status: 409,
            title: 'User email already exists',
            type: '/errors/user-email-already-exists',
            instance: '/api/auth/signup',
          }),
        );
      }),
  );
});

const credential = 'test-session-credential';
const expiresAt = new Date('2030-01-01T00:00:00.000Z');

const publicUser = Schema.decodeSync(UserResponseSchema)({
  id: '00000000-0000-4000-8000-000000000001',
  email,
  displayName: 'Test User',
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
        (started) => Effect.promise(() => started.dispose()),
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
        (started) => Effect.promise(() => started.dispose()),
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
          displayName: 'Test User',
          role: 'admin',
        }),
      });
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(signup)),
        (started) => Effect.promise(() => started.dispose()),
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
      expect(failedLogs()).toHaveLength(0);
      expect(logs.filter((log) => log.level === 'ERROR')).toHaveLength(0);
    }),
  );

  it.effect(
    'rejects a displayName of only spaces before executing signup',
    () =>
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
            displayName: '   ',
          }),
        });
        const app = yield* Effect.acquireRelease(
          Effect.sync(() => makeApp(signup)),
          (started) => Effect.promise(() => started.dispose()),
        );
        const resp = yield* Effect.promise(() => app.handler(request));
        const json = yield* Effect.promise(() => resp.json());
        const body = yield* Schema.decodeUnknownEffect(
          RequestValidationHttpError,
        )(json);

        expect(resp.status).toBe(400);
        expect(body.code).toBe('REQUEST_VALIDATION_FAILED');
        expect(body.errors).toEqual([
          expect.objectContaining({
            location: 'payload',
            path: ['displayName'],
          }),
        ]);
        expect(signupExecutions).toBe(0);
        expect(resp.headers.getSetCookie()).toEqual([]);
      }),
  );
});
