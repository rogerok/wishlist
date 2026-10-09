import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, layer } from '@effect/vitest';
import { ConfigProvider, Effect, Layer, Schema } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import {
  ConnectionError,
  SqlError,
  UnknownError,
} from 'effect/unstable/sql/SqlError';
import { createHash } from 'node:crypto';

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
import { PasswordCredentialsRepositoryLive } from '#modules/auth/repository/password/password-credentials.repository.js';
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { SessionRepositoryError } from '#modules/auth/repository/session/session.repository.errors.js';
import { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';
import {
  AuthService,
  AuthServiceLive,
} from '#modules/auth/service/auth.service.js';
import { PasswordHasherLive } from '#modules/auth/service/password/password-hasher.service.js';
import {
  SecureRandomBytesLive,
  SessionTokenGeneratorLive,
} from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepositoryLive } from '#modules/users/repository/users.repository.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

const databaseLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const servicesLayer = AuthModuleLive.pipe(Layer.provideMerge(databaseLayer));
const testApi = HttpApi.make('app')
  .add(authGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

const password = 'Password1!';
const emailA = 'logout-a@example.test';
const emailB = 'logout-b@example.test';
const dayMs = 24 * 60 * 60 * 1000;

interface TestApp {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

interface IssuedCookie {
  readonly digest: Buffer;
  readonly pair: string;
}

type Mode = 'production' | 'test';

const makeApp = (auth: Effect.Success<typeof AuthService>, mode: Mode) => {
  const authLayer = Layer.succeed(AuthService, auth);
  const config = ConfigProvider.fromUnknown({ MODE: mode }).pipe(
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

const acquireAppFor = (
  auth: Effect.Success<typeof AuthService>,
  mode: Mode = 'test',
) =>
  Effect.acquireRelease(
    Effect.sync((): TestApp => makeApp(auth, mode)),
    (app) => Effect.promise(() => app.dispose()),
  );

const acquireApp = Effect.gen(function* () {
  return yield* acquireAppFor(yield* AuthService);
});

const deleteFailure = (reason: ConnectionError | UnknownError) =>
  new SessionRepositoryError({
    cause: new SqlError({ reason }),
    operation: SessionOperations.deleteByTokenDigest,
  });

// Настоящий SessionRepository, у которого удаление отказывает до SQL
const failingDeleteRepo = (failure: SessionRepositoryError) =>
  Layer.effect(
    SessionRepository,
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      return { ...repo, deleteByTokenDigest: () => Effect.fail(failure) };
    }),
  ).pipe(Layer.provide(SessionRepositoryLive));

// Layer.fresh: без него layer() группы вернёт уже собранный AuthService
// с настоящим репозиторием (вопрос 12 очереди повторения).
const authWithFailingDelete = (failure: SessionRepositoryError) =>
  Effect.gen(function* () {
    return yield* AuthService;
  }).pipe(
    Effect.provide(
      Layer.fresh(AuthServiceLive).pipe(
        Layer.provide([
          failingDeleteRepo(failure),
          UsersRepositoryLive,
          PasswordCredentialsRepositoryLive,
          PasswordHasherLive,
          SessionTokenGeneratorLive.pipe(Layer.provide(SecureRandomBytesLive)),
        ]),
      ),
    ),
  );

const send = (app: TestApp, path: string, init: RequestInit) =>
  Effect.promise(() =>
    app.handler(new Request(`http://localhost${path}`, init)),
  );

const postJson = (app: TestApp, path: string, payload: unknown) =>
  send(app, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

const logout = (app: TestApp, cookie?: string) =>
  send(app, '/api/auth/logout', {
    method: 'POST',
    headers: cookie === undefined ? {} : { cookie },
  });

const readIssuedCookie = (response: Response): IssuedCookie => {
  const [pair = ''] = (response.headers.get('set-cookie') ?? '').split(';');
  const credential = pair.slice(cookieSessionKey.length + 1);
  return {
    pair,
    digest: createHash('sha256')
      .update(Buffer.from(credential, 'base64url'))
      .digest(),
  };
};

const register = (app: TestApp, db: DBKysely, email: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const response = yield* postJson(app, '/api/auth/signup', {
        email,
        password,
        passwordConfirm: password,
        displayName: 'Ada Lovelace',
      });
      expect(response.status).toBe(201);
      const json: unknown = yield* Effect.promise(() => response.json());
      const user = yield* Schema.decodeUnknownEffect(UserResponseSchema)(json);
      return { user, cookie: readIssuedCookie(response) };
    }),
    ({ user }) =>
      db.deleteFrom('users').where('id', '=', user.id).pipe(Effect.orDie),
  );

const login = (app: TestApp, email: string) =>
  Effect.gen(function* () {
    const response = yield* postJson(app, '/api/auth/login', {
      email,
      password,
    });
    expect(response.status).toBe(200);
    return readIssuedCookie(response);
  });

const sessionsSnapshot = (db: DBKysely) =>
  db
    .selectFrom('sessions')
    .select(['id', 'userId', 'createdAt', 'expiresAt'])
    .orderBy('id');

const sessionIdOf = (db: DBKysely, cookie: IssuedCookie) =>
  Effect.gen(function* () {
    const [row] = yield* db
      .selectFrom('sessions')
      .select('id')
      .where('tokenDigest', '=', cookie.digest);
    if (row === undefined) throw new Error('Expected a session for cookie');
    return row.id;
  });

// 204, пустое тело и ровно одна истекающая wishlist_session
const expectLoggedOut = (response: Response) =>
  Effect.gen(function* () {
    expect(response.status).toBe(204);
    expect(yield* Effect.promise(() => response.text())).toBe('');
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    const [pair, ...attributes] = (cookies[0] ?? '').split(';');
    expect(pair).toBe(`${cookieSessionKey}=`);
    expect(
      attributes.map((attribute) => attribute.trim().toLowerCase()),
    ).toEqual(
      expect.arrayContaining([
        'max-age=0',
        'expires=thu, 01 jan 1970 00:00:00 gmt',
      ]),
    );
  });

const cookieAttributes = (response: Response) =>
  (response.headers.getSetCookie()[0] ?? '')
    .split(';')
    .slice(1)
    .map((attribute) => attribute.trim().toLowerCase());

const expectTechnicalFailure = (
  response: Response,
  expected: { readonly code: string; readonly status: number },
) =>
  Effect.gen(function* () {
    expect(response.status).toBe(expected.status);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    expect(response.headers.getSetCookie()).toEqual([]);
    const body: unknown = yield* Effect.promise(() => response.json());
    expect(body).toMatchObject({
      ...expected,
      instance: '/api/auth/logout',
      errorId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });

describe('POST /api/auth/logout with PostgreSQL', () => {
  layer(servicesLayer, { timeout: '60 seconds' })((it) => {
    it.effect('returns 204 and expires the cookie when no cookie is sent', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const before = yield* sessionsSnapshot(db);

        yield* expectLoggedOut(yield* logout(app));

        expect(yield* sessionsSnapshot(db)).toEqual(before);
      }),
    );

    it.effect('returns 204 and expires a malformed cookie', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const before = yield* sessionsSnapshot(db);

        yield* expectLoggedOut(yield* logout(app, `${cookieSessionKey}=abc`));

        expect(yield* sessionsSnapshot(db)).toEqual(before);
      }),
    );

    it.effect('returns 204 for a well-formed cookie without a session', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const before = yield* sessionsSnapshot(db);

        yield* expectLoggedOut(
          yield* logout(app, `${cookieSessionKey}=${'A'.repeat(43)}`),
        );

        expect(yield* sessionsSnapshot(db)).toEqual(before);
      }),
    );

    it.effect('returns 204 again when the same cookie is sent twice', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const { cookie } = yield* register(app, db, emailA);

        yield* expectLoggedOut(yield* logout(app, cookie.pair));
        yield* expectLoggedOut(yield* logout(app, cookie.pair));
      }),
    );

    it.effect('deletes the presented session even after it has expired', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const { cookie: s1 } = yield* register(app, db, emailA);
        yield* login(app, emailA);
        const s1Id = yield* sessionIdOf(db, s1);
        const now = Date.now();
        yield* db
          .updateTable('sessions')
          .set({
            createdAt: new Date(now - 2 * dayMs),
            expiresAt: new Date(now - dayMs),
          })
          .where('id', '=', s1Id);
        const before = yield* sessionsSnapshot(db);

        yield* expectLoggedOut(yield* logout(app, s1.pair));

        expect(yield* sessionsSnapshot(db)).toEqual(
          before.filter((session) => session.id !== s1Id),
        );
      }),
    );

    it.effect('deletes only the presented session', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const app = yield* acquireApp;
        const { cookie: s1, user: userA } = yield* register(app, db, emailA);
        yield* login(app, emailA);
        const { user: userB } = yield* register(app, db, emailB);
        const s1Id = yield* sessionIdOf(db, s1);
        const before = yield* sessionsSnapshot(db);
        expect(before.filter((s) => s.userId === userA.id)).toHaveLength(2);
        expect(before.filter((s) => s.userId === userB.id)).toHaveLength(1);

        yield* expectLoggedOut(yield* logout(app, s1.pair));

        expect(yield* sessionsSnapshot(db)).toEqual(
          before.filter((session) => session.id !== s1Id),
        );
      }),
    );

    it.effect(
      'expires the cookie with the issuing attributes in test mode',
      () =>
        Effect.gen(function* () {
          const app = yield* acquireAppFor(yield* AuthService, 'test');

          const response = yield* logout(app);

          yield* expectLoggedOut(response);
          const attributes = cookieAttributes(response);
          expect(attributes).toEqual(
            expect.arrayContaining(['path=/api', 'httponly', 'samesite=lax']),
          );
          expect(attributes).not.toContain('secure');
        }),
    );

    it.effect('expires a secure cookie in production', () =>
      Effect.gen(function* () {
        const app = yield* acquireAppFor(yield* AuthService, 'production');

        const response = yield* logout(app);

        yield* expectLoggedOut(response);
        expect(cookieAttributes(response)).toEqual(
          expect.arrayContaining([
            'path=/api',
            'httponly',
            'samesite=lax',
            'secure',
          ]),
        );
      }),
    );

    it.effect(
      'returns 503 and keeps the cookie and sessions when the delete is unavailable',
      () =>
        Effect.gen(function* () {
          const db = yield* DB;
          const app = yield* acquireApp;
          const { cookie: s1 } = yield* register(app, db, emailA);
          yield* login(app, emailA);
          const before = yield* sessionsSnapshot(db);
          const failing = yield* acquireAppFor(
            yield* authWithFailingDelete(
              deleteFailure(
                new ConnectionError({ cause: 'connection refused' }),
              ),
            ),
          );

          yield* expectTechnicalFailure(yield* logout(failing, s1.pair), {
            code: 'SERVICE_UNAVAILABLE',
            status: 503,
          });

          expect(yield* sessionsSnapshot(db)).toEqual(before);
        }),
    );

    it.effect(
      'returns 500 without expiring the cookie when the delete fails permanently',
      () =>
        Effect.gen(function* () {
          const failing = yield* acquireAppFor(
            yield* authWithFailingDelete(
              deleteFailure(new UnknownError({ cause: new Error('syntax') })),
            ),
          );

          yield* expectTechnicalFailure(
            yield* logout(failing, `${cookieSessionKey}=${'A'.repeat(43)}`),
            { code: 'INTERNAL_ERROR', status: 500 },
          );
        }),
    );

    it.effect(
      'returns 500 without expiring the cookie on an unexpected exception',
      () =>
        Effect.gen(function* () {
          const auth = yield* AuthService;
          const failing = yield* acquireAppFor({
            ...auth,
            logout: () => Effect.die(new Error('unexpected logout failure')),
          });

          yield* expectTechnicalFailure(
            yield* logout(failing, `${cookieSessionKey}=${'A'.repeat(43)}`),
            { code: 'INTERNAL_ERROR', status: 500 },
          );
        }),
    );
  });
});
