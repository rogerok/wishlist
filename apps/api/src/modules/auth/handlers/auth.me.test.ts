import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, it, layer } from '@effect/vitest';
import { ConfigProvider, Effect, Layer, Schema } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';

import type { DBKysely } from '#infra/db/db.service.js';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import { AuthModuleLive } from '#modules/auth/auth.module.js';
import {
  AuthHandlersLive,
  SessionAuthenticationLive,
} from '#modules/auth/handlers/auth.handlers.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import { AuthUnavailableError } from '#modules/auth/service/auth.service.errors.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

const databaseLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const servicesLayer = AuthModuleLive.pipe(Layer.provideMerge(databaseLayer));
const testApi = HttpApi.make('app')
  .add(authGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

const email = 'me@example.test';
const password = 'Password1!';
const mePath = '/api/auth/me';

const makeApp = (auth: Effect.Success<typeof AuthService>) => {
  const authLayer = Layer.succeed(AuthService, auth);
  const config = ConfigProvider.fromUnknown({ MODE: 'test' }).pipe(
    ConfigProvider.layer,
  );
  const routes = HttpApiBuilder.layer(testApi).pipe(
    Layer.provide([
      AuthHandlersLive.pipe(
        Layer.provide([
          DefectBoundaryMiddlewareLive,
          RequestValidationMiddlewareLive,
          SessionAuthenticationLive.pipe(Layer.provide(authLayer)),
          config,
        ]),
      ),
      NodeHttpServer.layerHttpServices,
    ]),
    HttpRouter.provideRequest(authLayer),
  );
  return HttpRouter.toWebHandler(routes);
};

const acquireApp = (auth: Effect.Success<typeof AuthService>) =>
  Effect.acquireRelease(
    Effect.sync((): TestApp => makeApp(auth)),
    (app) => Effect.promise(() => app.dispose()),
  );

interface TestApp {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

const getMe = (app: TestApp, cookie?: string) =>
  Effect.promise(() =>
    app.handler(
      new Request(`http://localhost${mePath}`, {
        headers: cookie === undefined ? {} : { cookie },
      }),
    ),
  );

const register = (app: TestApp, db: DBKysely) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        app.handler(
          new Request('http://localhost/api/auth/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              passwordConfirm: password,
              firstName: 'Ada',
              lastName: 'Lovelace',
              middleName: null,
            }),
          }),
        ),
      );
      expect(response.status).toBe(201);
      const json: unknown = yield* Effect.promise(() => response.json());
      const user = yield* Schema.decodeUnknownEffect(UserResponseSchema)(json);
      const [cookie] = (response.headers.get('set-cookie') ?? '').split(';');
      return { user, cookie: cookie ?? '' };
    }),
    ({ user }) =>
      db.deleteFrom('users').where('id', '=', user.id).pipe(Effect.orDie),
  );

const expectInvalidSession = (response: Response) =>
  Effect.gen(function* () {
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    const body: unknown = yield* Effect.promise(() => response.json());
    expect(body).toMatchObject({
      code: 'AUTH_INVALID_SESSION',
      status: 401,
      instance: mePath,
    });
  });

describe('GET /api/auth/me with PostgreSQL', () => {
  layer(servicesLayer, { timeout: '60 seconds' })((it) => {
    it.effect('rejects a request without a session cookie', () =>
      Effect.gen(function* () {
        const app = yield* acquireApp(yield* AuthService);

        yield* expectInvalidSession(yield* getMe(app));
      }),
    );

    it.effect('rejects a malformed session cookie', () =>
      Effect.gen(function* () {
        const app = yield* acquireApp(yield* AuthService);

        yield* expectInvalidSession(
          yield* getMe(app, `${cookieSessionKey}=abc`),
        );
      }),
    );

    it.effect('rejects a well-formed cookie without a session', () =>
      Effect.gen(function* () {
        const app = yield* acquireApp(yield* AuthService);

        yield* expectInvalidSession(
          yield* getMe(app, `${cookieSessionKey}=${'A'.repeat(43)}`),
        );
      }),
    );

    it.effect('returns the current user for the cookie issued by signup', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp(yield* AuthService);
        const signup = yield* register(app, db);

        const response = yield* getMe(app, signup.cookie);

        expect(response.status).toBe(200);
        const json: unknown = yield* Effect.promise(() => response.json());
        expect(json).toEqual(signup.user);
      }),
    );
  });
});

describe('GET /api/auth/me technical failures', () => {
  it.effect('returns 503 when the session lookup is unavailable', () =>
    Effect.gen(function* () {
      const app = yield* acquireApp({
        signup: () => Effect.die(new Error('Unexpected call: signup')),
        login: () => Effect.die(new Error('Unexpected call: login')),
        authenticate: () =>
          new AuthUnavailableError({ cause: 'connection reset' }),
      });

      const response = yield* getMe(
        app,
        `${cookieSessionKey}=${'A'.repeat(43)}`,
      );

      expect(response.status).toBe(503);
      const body: unknown = yield* Effect.promise(() => response.json());
      expect(body).toMatchObject({ status: 503, instance: mePath });
    }),
  );
});
