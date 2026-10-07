import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, layer } from '@effect/vitest';
import { ConfigProvider, Effect, Layer, Option, Schema } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import { createHash } from 'node:crypto';

import type { DBKysely } from '#infra/db/db.service.js';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
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
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

const databaseLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const servicesLayer = Layer.mergeAll(
  AuthModuleLive,
  SessionRepositoryLive,
).pipe(Layer.provideMerge(databaseLayer));
const testApi = HttpApi.make('app')
  .add(authGroup)
  .middleware(RequestValidationMiddleware);

const email = 'login@example.test';
const password = 'Password1!';
const unknownEmail = 'unknown@example.test';

const makeApp = (
  auth: Effect.Success<typeof AuthService>,
  mode: 'production' | 'test' = 'test',
) => {
  const authLayer = Layer.succeed(AuthService, auth);
  const config = ConfigProvider.fromUnknown({ MODE: mode }).pipe(
    ConfigProvider.layer,
  );
  const routes = HttpApiBuilder.layer(testApi).pipe(
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
  return HttpRouter.toWebHandler(routes);
};

interface TestApp {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

const acquireApp = (mode: 'production' | 'test' = 'test') =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    return yield* Effect.acquireRelease(
      Effect.sync(() => makeApp(auth, mode)),
      (app) => Effect.promise(() => app.dispose()),
    );
  });

const post = (app: TestApp, path: string, payload: unknown, cookie?: string) =>
  Effect.promise(() =>
    app.handler(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify(payload),
      }),
    ),
  );

const readCookie = (response: Response) => {
  const header = response.headers.get('set-cookie');
  if (header === null) throw new Error('Expected a session cookie');
  const [pair, ...attributes] = header.split(';');
  if (pair === undefined || !pair.startsWith(`${cookieSessionKey}=`)) {
    throw new Error('Expected wishlist_session cookie');
  }
  const credential = pair.slice(cookieSessionKey.length + 1);
  expect(/^[A-Za-z0-9_-]{43}$/.test(credential)).toBe(true);
  return {
    pair,
    credential,
    attributes: attributes.map((attribute) => attribute.trim().toLowerCase()),
    digest: createHash('sha256')
      .update(Buffer.from(credential, 'base64url'))
      .digest(),
  };
};

const register = (app: TestApp, db: DBKysely) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const response = yield* post(app, '/api/auth/signup', {
        email,
        password,
        passwordConfirm: password,
        firstName: 'Ada',
        lastName: 'Lovelace',
        middleName: null,
      });
      expect(response.status).toBe(201);
      const json: unknown = yield* Effect.promise(() => response.json());
      const user = yield* Schema.decodeUnknownEffect(UserResponseSchema)(json);
      return { user, cookie: readCookie(response) };
    }),
    ({ user }) =>
      db.deleteFrom('users').where('id', '=', user.id).pipe(Effect.orDie),
  );

const sessionsSnapshot = (db: DBKysely) =>
  db
    .selectFrom('sessions')
    .select(['id', 'userId', 'createdAt', 'expiresAt'])
    .orderBy('id');

const readInvalidCredentials = (response: Response) =>
  Effect.gen(function* () {
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    expect(response.headers.get('set-cookie')).toBeNull();
    const body: unknown = yield* Effect.promise(() => response.json());
    expect(body).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
      instance: '/api/auth/login',
    });
    return body;
  });

describe('login with PostgreSQL', () => {
  layer(servicesLayer, { timeout: '60 seconds' })((it) => {
    it.effect('rejects an unknown email without creating a session', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp();
        const before = yield* sessionsSnapshot(db);
        const response = yield* post(app, '/api/auth/login', {
          email: unknownEmail,
          password,
        });
        yield* readInvalidCredentials(response);
        expect(yield* sessionsSnapshot(db)).toEqual(before);
      }),
    );

    it.effect(
      'returns the same public error for a wrong password and an unknown email',
      () =>
        Effect.gen(function* () {
          const db = yield* DB;
          const app = yield* acquireApp();
          yield* register(app, db);
          const before = yield* sessionsSnapshot(db);
          const wrongPassword = yield* post(app, '/api/auth/login', {
            email,
            password: 'WrongPassword2!',
          });
          const wrongBody = yield* readInvalidCredentials(wrongPassword);
          const unknown = yield* post(app, '/api/auth/login', {
            email: unknownEmail,
            password,
          });
          const unknownBody = yield* readInvalidCredentials(unknown);
          expect(wrongBody).toEqual(unknownBody);
          expect(yield* sessionsSnapshot(db)).toEqual(before);
        }),
    );

    it.effect(
      'returns the public user and a secure cookie backed by a new session',
      () =>
        Effect.gen(function* () {
          const db = yield* DB;
          const repo = yield* SessionRepository;
          const app = yield* acquireApp('production');
          const signup = yield* register(app, db);
          const before = Date.now();
          const response = yield* post(app, '/api/auth/login', {
            email,
            password,
          });
          expect(response.status).toBe(200);
          const cookie = readCookie(response);
          expect(cookie.attributes).toEqual(
            expect.arrayContaining([
              'httponly',
              'secure',
              'samesite=lax',
              'path=/api',
              'max-age=604800',
            ]),
          );
          expect(cookie.credential === signup.cookie.credential).toBe(false);
          const text = yield* Effect.promise(() => response.text());
          expect(text.includes(cookie.credential)).toBe(false);
          expect(text.includes(password)).toBe(false);
          const json: unknown = JSON.parse(text);
          expect(json).toEqual(signup.user);
          const session = yield* repo.getByTokenDigest(cookie.digest);
          expect(Option.isSome(session)).toBe(true);
          if (Option.isSome(session)) {
            expect(session.value.userId).toBe(signup.user.id);
            expect(session.value.expiresAt.getTime()).toBeGreaterThanOrEqual(
              before + 7 * 24 * 60 * 60 * 1000,
            );
            expect(session.value.expiresAt.getTime()).toBeLessThanOrEqual(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            );
          }
        }),
    );

    it.effect(
      'creates fresh concurrent sessions instead of reusing the presented cookie',
      () =>
        Effect.gen(function* () {
          const db = yield* DB;
          const repo = yield* SessionRepository;
          const app = yield* acquireApp();
          const signup = yield* register(app, db);
          const userSessions = db
            .selectFrom('sessions')
            .select('id')
            .where('userId', '=', signup.user.id);
          expect(yield* userSessions).toHaveLength(1);
          const original = yield* repo.getByTokenDigest(signup.cookie.digest);
          expect(Option.isSome(original)).toBe(true);
          const first = yield* post(
            app,
            '/api/auth/login',
            { email, password },
            signup.cookie.pair,
          );
          expect(first.status).toBe(200);
          const firstCookie = readCookie(first);
          const firstSession = yield* repo.getByTokenDigest(firstCookie.digest);
          expect(Option.isSome(firstSession)).toBe(true);
          expect(yield* userSessions).toHaveLength(2);
          const second = yield* post(
            app,
            '/api/auth/login',
            { email, password },
            firstCookie.pair,
          );
          expect(second.status).toBe(200);
          const secondCookie = readCookie(second);
          const secondSession = yield* repo.getByTokenDigest(
            secondCookie.digest,
          );
          expect(Option.isSome(secondSession)).toBe(true);
          expect(yield* userSessions).toHaveLength(3);
          expect(firstCookie.credential === signup.cookie.credential).toBe(
            false,
          );
          expect(secondCookie.credential === firstCookie.credential).toBe(
            false,
          );
          expect(secondCookie.credential === signup.cookie.credential).toBe(
            false,
          );
          expect(yield* repo.getByTokenDigest(signup.cookie.digest)).toEqual(
            original,
          );
          expect(yield* repo.getByTokenDigest(firstCookie.digest)).toEqual(
            firstSession,
          );
          if (Option.isSome(firstSession) && Option.isSome(secondSession)) {
            expect(firstSession.value.userId).toBe(signup.user.id);
            expect(secondSession.value.userId).toBe(signup.user.id);
            expect(firstSession.value.id).not.toBe(secondSession.value.id);
          }
        }),
    );
  });
});
