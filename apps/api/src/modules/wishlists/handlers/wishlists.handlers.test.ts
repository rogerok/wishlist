import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, layer } from '@effect/vitest';
import {
  Clock,
  ConfigProvider,
  Context,
  Effect,
  Layer,
  Redacted,
  Schema,
} from 'effect';
import { HttpRouter } from 'effect/http';
import { HttpApi, HttpApiBuilder } from 'effect/http-api';
import { SqlClient } from 'effect/sql/SqlClient';
import * as TestClock from 'effect/testing/TestClock';

import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { WishlistsServiceShape } from '#modules/wishlists/service/wishlists.service.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import { OperationFailed } from '#infra/errors/operation-failed.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { AuthModuleLive } from '#modules/auth/auth.module.js';
import { SessionAuthenticationLive } from '#modules/auth/handlers/auth.handlers.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';
import { wishlistsGroup } from '#modules/wishlists/api/wishlists.api.js';
import { WishlistsHandlersLive } from '#modules/wishlists/handlers/wishlists.handlers.js';
import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import { WishlistsService } from '#modules/wishlists/service/wishlists.service.js';
import { WishlistsModuleLive } from '#modules/wishlists/wishlists.module.js';

const databaseLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const servicesLayer = Layer.mergeAll(AuthModuleLive, WishlistsModuleLive).pipe(
  Layer.provideMerge(databaseLayer),
);

const testApi = HttpApi.make('app')
  .add(wishlistsGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

interface TestApp {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

// Приложение с группой Wishlist поверх уже собранных сервисов теста.
// wishlists подменяет WishlistsService для технических отказов.
const acquireApp = (wishlists?: WishlistsServiceShape) =>
  Effect.gen(function* () {
    // Effect.context возвращает весь контекст fiber, параметр сужает только тип.
    // pick оставляет два сервиса, а Clock теста добавлен явно: handlers
    // декодируют payload с ним, и окно Occasion Date видит часы теста.
    const fiberContext = yield* Effect.context<
      AuthService | WishlistsService
    >();
    const clock = yield* Clock.Clock;
    const testContext = Context.pick(
      AuthService,
      WishlistsService,
    )(fiberContext).pipe(Context.add(Clock.Clock, clock));
    const services =
      wishlists === undefined
        ? testContext
        : Context.add(testContext, WishlistsService, wishlists);
    const config = ConfigProvider.fromUnknown({ MODE: 'test' }).pipe(
      ConfigProvider.layer,
    );
    const routes = HttpApiBuilder.layer(testApi).pipe(
      Layer.provide([
        WishlistsHandlersLive.pipe(
          Layer.provide([
            DefectBoundaryMiddlewareLive,
            RequestValidationMiddlewareLive,
            SessionAuthenticationLive,
            config,
          ]),
          Layer.provide(Layer.succeedContext(services)),
        ),
        NodeHttpServer.layerHttpServices,
      ]),
    );

    return yield* Effect.acquireRelease(
      Effect.sync((): TestApp =>
        HttpRouter.toWebHandler(routes, { disableLogger: true }),
      ),
      (app) => Effect.promise(() => app.dispose()),
    );
  });

const fixedNow = Date.parse('2026-10-12T12:00:00Z');

const atFixedNow = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(fixedNow).pipe(
    Effect.andThen(effect),
    Effect.provide(TestClock.layer()),
  );

interface TestUser {
  readonly cookie: string;
  readonly id: UserId;
}

const password = PasswordSchema.make('Password1!');

const acquireUser = (email: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const { credential, user } = yield* auth.signup(
        SignupInputSchema.make({
          email: UserEmailSchema.make(email),
          password,
          displayName: 'Test User',
        }),
      );

      return {
        cookie: `${cookieSessionKey}=${Redacted.value(credential)}`,
        id: user.id,
      } satisfies TestUser;
    }),
    ({ id }) =>
      SqlClient.pipe(
        Effect.flatMap(
          (sql) => sql`DELETE FROM "public"."users" WHERE "id" = ${id}`,
        ),
        Effect.orDie,
      ),
  );

interface WishlistRow {
  readonly createdAt: Date;
  readonly description: string | null;
  readonly id: string;
  readonly occasionDate: string | null;
  readonly ownerId: string;
  readonly title: string;
  readonly updatedAt: Date;
  readonly visibility: string;
}

const selectWishlists = SqlClient.pipe(
  Effect.flatMap(
    (sql) => sql<WishlistRow>`
      SELECT "id", "owner_id", "title", "description", "occasion_date",
        "visibility", "created_at", "updated_at"
      FROM "public"."wishlists"
      ORDER BY "created_at", "id"
    `,
  ),
  Effect.orDie,
);

const selectOnlyWishlist = Effect.gen(function* () {
  const rows = yield* selectWishlists;
  expect(rows).toHaveLength(1);

  return rows[0] ?? (yield* Effect.die('wishlists is empty'));
});

const toResponseJson = (row: WishlistRow) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const minimalBody = {
  title: 'Books',
  description: null,
  occasionDate: null,
  visibility: 'private',
};

const fullBody = {
  title: 'Books',
  description: '  Art  ',
  occasionDate: '2028-02-29',
  visibility: 'public',
};

const send = (app: TestApp, request: Request) =>
  Effect.promise(() => app.handler(request));

const readJson = (response: Response) =>
  Effect.promise((): Promise<unknown> => response.json());

const postWishlist = (
  app: TestApp,
  cookie: string,
  body: unknown,
  query = '',
) =>
  send(
    app,
    new Request(`http://localhost/api/wishlists${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
  );

const getWishlist = (app: TestApp, cookie: string, id: string, query = '') =>
  send(
    app,
    new Request(`http://localhost/api/wishlists/${id}${query}`, {
      headers: { cookie },
    }),
  );

const createWishlist = (app: TestApp, owner: TestUser, body: unknown) =>
  Effect.gen(function* () {
    const response = yield* postWishlist(app, owner.cookie, body);
    expect(response.status).toBe(201);
    const { id } = yield* Schema.decodeUnknownEffect(WishlistResponseSchema)(
      yield* readJson(response),
    );
    const rows = yield* selectWishlists;
    const row = rows.find((candidate) => candidate.id === id);

    return row ?? (yield* Effect.die('created Wishlist is not in the table'));
  });

const expectProblem = (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain(
    'application/problem+json',
  );
};

const invalidSessionBody = (instance: string) => ({
  code: 'AUTH_INVALID_SESSION',
  detail: 'Session is invalid',
  status: 401,
  title: 'Invalid session',
  type: '/errors/auth-invalid-session',
  instance,
});

const notFoundBody = (id: string) => ({
  code: 'WISHLIST_NOT_FOUND',
  detail: 'The requested wishlist does not exist',
  status: 404,
  title: 'Wishlist not found',
  type: '/errors/wishlist-not-found',
  id,
  instance: `/api/wishlists/${id}`,
});

const validationBody = (
  instance: string,
  errors: readonly unknown[] = [expect.anything()],
) => ({
  code: 'REQUEST_VALIDATION_FAILED',
  detail: 'The request contains invalid data',
  status: 400,
  title: 'Request validation failed',
  type: '/errors/request-validation',
  instance,
  errors,
});

const occasionDateError = (message: string) => ({
  location: 'payload',
  path: ['occasionDate'],
  message,
});

const windowMessage = 'Expected a date between 2026-10-11 and 2031-10-12';

const invalidCookies = [
  { name: 'without a cookie', cookie: undefined },
  { name: 'with a malformed cookie', cookie: `${cookieSessionKey}=abc` },
  {
    name: 'with a cookie of an unknown Session',
    cookie: `${cookieSessionKey}=${'A'.repeat(43)}`,
  },
] as const;

const expectInvalidSession = (response: Response, instance: string) =>
  Effect.gen(function* () {
    expectProblem(response, 401);
    expect(yield* readJson(response)).toEqual(invalidSessionBody(instance));
  });

const withField = (field: keyof typeof minimalBody, value: unknown) => ({
  ...minimalBody,
  [field]: value,
});

const invalidBodies = [
  { name: 'title отсутствует', body: withField('title', undefined) },
  { name: 'title: null', body: withField('title', null) },
  { name: 'title: 42', body: withField('title', 42) },
  { name: 'title: ""', body: withField('title', '') },
  { name: 'title из пробелов', body: withField('title', '   ') },
  {
    name: 'title из 256 символов после trim',
    body: withField('title', ` ${'a'.repeat(256)} `),
  },
  {
    name: 'description отсутствует',
    body: withField('description', undefined),
  },
  { name: 'description: 42', body: withField('description', 42) },
  {
    name: 'description из 1001 символа после trim',
    body: withField('description', ` ${'a'.repeat(1001)} `),
  },
  {
    name: 'occasionDate отсутствует',
    body: withField('occasionDate', undefined),
  },
  { name: 'occasionDate: 42', body: withField('occasionDate', 42) },
  ...[
    '2027-02-29',
    '2028-02-30',
    '2028-13-01',
    '2028-00-01',
    '2028-01-00',
    '2028-2-9',
    '0000-01-01',
    '2028-02-29T00:00:00Z',
  ].map((value) => ({
    name: `occasionDate: ${value}`,
    body: withField('occasionDate', value),
  })),
  { name: 'visibility отсутствует', body: withField('visibility', undefined) },
  { name: 'visibility: null', body: withField('visibility', null) },
  { name: 'visibility: 42', body: withField('visibility', 42) },
  { name: 'visibility: unlisted', body: withField('visibility', 'unlisted') },
  { name: 'visibility: PUBLIC', body: withField('visibility', 'PUBLIC') },
];

const serverFields = [
  {
    name: 'ownerId другого User',
    extra: (other: UserId) => ({ ownerId: other }),
  },
  {
    name: 'id',
    extra: () => ({ id: '00000000-0000-4000-8000-0000000000aa' }),
  },
  { name: 'createdAt', extra: () => ({ createdAt: '2026-10-12T12:00:00Z' }) },
  { name: 'updatedAt', extra: () => ({ updatedAt: '2026-10-12T12:00:00Z' }) },
  { name: 'произвольное поле', extra: () => ({ color: 'red' }) },
];

const readers = [
  {
    name: 'Владелец читает Private Wishlist',
    visibility: 'private',
    byOwner: true,
  },
  {
    name: 'Владелец читает Public Wishlist',
    visibility: 'public',
    byOwner: true,
  },
  {
    name: 'Другой User читает Public Wishlist',
    visibility: 'public',
    byOwner: false,
  },
] as const;

const unexpectedRead: WishlistsServiceShape['getReadableById'] = () =>
  Effect.die(new Error('Unexpected call: getReadableById'));

const secret = 'db-password=hunter2';

const createFailures = [
  {
    name: 'Временный отказ сохранения',
    failure: Effect.fail(
      new OperationFailed({
        reason: 'unavailable',
        source: 'wishlistsRepository',
        operation: 'create',
        cause: secret,
      }),
    ),
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
  },
  {
    name: 'Внутренний SQL-отказ сохранения',
    failure: Effect.fail(
      new OperationFailed({
        reason: 'internal',
        source: 'wishlistsRepository',
        operation: 'create',
        cause: secret,
      }),
    ),
    status: 500,
    code: 'INTERNAL_ERROR',
  },
  {
    name: 'Дефект при сохранении',
    failure: Effect.die(new Error(secret)),
    status: 500,
    code: 'INTERNAL_ERROR',
  },
];

const acquireCorruptedWishlist = (ownerId: UserId) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      yield* sql`
        ALTER TABLE "public"."wishlists"
        DROP CONSTRAINT "wishlists_title_not_blank_check"
      `;
      const [row] = yield* sql<{ id: string }>`
        INSERT INTO "public"."wishlists" ("owner_id", "title")
        VALUES (${ownerId}, ' ')
        RETURNING "id"
      `;

      return row?.id ?? (yield* Effect.die('INSERT did not return the id'));
    }).pipe(Effect.orDie),
    (id) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        yield* sql`DELETE FROM "public"."wishlists" WHERE "id" = ${id}`;
        yield* sql`
          ALTER TABLE "public"."wishlists"
          ADD CONSTRAINT "wishlists_title_not_blank_check"
          CHECK (btrim("title") <> '')
        `;
      }).pipe(Effect.orDie),
  );

describe('wishlists HTTP', () => {
  layer(servicesLayer, { timeout: '60 seconds', excludeTestServices: true })(
    (it) => {
      describe('Session', () => {
        it.effect.each(invalidCookies)(
          'Create без действующей Session: 401 $name, instance без query',
          ({ cookie }) =>
            Effect.gen(function* () {
              const app = yield* acquireApp();

              const response = yield* send(
                app,
                new Request('http://localhost/api/wishlists?source=test', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    ...(cookie === undefined ? {} : { cookie }),
                  },
                  body: JSON.stringify(minimalBody),
                }),
              );

              yield* expectInvalidSession(response, '/api/wishlists');
            }),
        );

        it.effect.each(invalidCookies)(
          'Public Wishlist без действующей Session: 401 $name, instance без query',
          ({ cookie }) =>
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const id = '00000000-0000-4000-8000-0000000000aa';

              const response = yield* send(
                app,
                new Request(
                  `http://localhost/api/wishlists/${id}?source=test`,
                  { headers: cookie === undefined ? {} : { cookie } },
                ),
              );

              yield* expectInvalidSession(response, `/api/wishlists/${id}`);
            }),
        );

        // CHECK expires_at > created_at не даёт сдвинуть один срок, поэтому
        // в прошлое уходят оба timestamp. Repository сравнивает срок с Clock.
        it.effect(
          'create и read с истекшей Session: 401, instance без query',
          () =>
            Effect.gen(function* () {
              const sql = yield* SqlClient;
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const wishlist = yield* createWishlist(app, owner, {
                ...minimalBody,
                visibility: 'public',
              });
              yield* sql`
              UPDATE "public"."sessions"
              SET "created_at" = now() - interval '2 days',
                "expires_at" = now() - interval '1 day'
              WHERE "user_id" = ${owner.id}
            `;

              const create = yield* postWishlist(
                app,
                owner.cookie,
                minimalBody,
                '?source=test',
              );
              const read = yield* getWishlist(
                app,
                owner.cookie,
                wishlist.id,
                '?source=test',
              );

              yield* expectInvalidSession(create, '/api/wishlists');
              yield* expectInvalidSession(
                read,
                `/api/wishlists/${wishlist.id}`,
              );
              expect(yield* selectWishlists).toHaveLength(1);
            }),
        );
      });

      describe('create', () => {
        it.effect('Создание минимального Wishlist', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');

            const response = yield* postWishlist(app, owner.cookie, {
              ...minimalBody,
              title: '  Books  ',
            });

            expect(response.status).toBe(201);
            const row = yield* selectOnlyWishlist;
            expect(row).toEqual({
              id: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
              ),
              ownerId: owner.id,
              title: 'Books',
              description: null,
              occasionDate: null,
              visibility: 'private',
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            });
          }),
        );

        it.effect('Ответ create соответствует записи', () =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');

              const response = yield* postWishlist(app, owner.cookie, fullBody);

              expect(response.status).toBe(201);
              expect(response.headers.get('content-type')).toContain(
                'application/json',
              );
              const json = yield* readJson(response);
              const row = yield* selectOnlyWishlist;
              expect(json).toEqual(toResponseJson(row));
              expect(json).toMatchObject({
                ownerId: owner.id,
                title: 'Books',
                description: 'Art',
                occasionDate: '2028-02-29',
                visibility: 'public',
              });
            }),
          ),
        );

        it.effect('Несколько Wishlist одного User', () =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const first = yield* createWishlist(app, owner, fullBody);

              const response = yield* postWishlist(
                app,
                owner.cookie,
                minimalBody,
              );

              expect(response.status).toBe(201);
              const rows = yield* selectWishlists;
              expect(rows).toHaveLength(2);
              expect(rows.every((row) => row.ownerId === owner.id)).toBe(true);
              expect(rows.find((row) => row.id === first.id)).toEqual(first);
              expect(new Set(rows.map((row) => row.id)).size).toBe(2);
            }),
          ),
        );

        it.effect('Владелец не выбирается через query', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');
            const other = yield* acquireUser('b@example.test');

            const response = yield* postWishlist(
              app,
              owner.cookie,
              minimalBody,
              `?ownerId=${other.id}`,
            );

            expect(response.status).toBe(201);
            const row = yield* selectOnlyWishlist;
            expect(row.ownerId).toBe(owner.id);
          }),
        );
      });

      describe('read', () => {
        it.effect.each(readers)('$name', ({ visibility, byOwner }) =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const other = yield* acquireUser('b@example.test');
              const wishlist = yield* createWishlist(app, owner, {
                ...fullBody,
                visibility,
              });
              const reader = byOwner ? owner : other;

              const response = yield* getWishlist(
                app,
                reader.cookie,
                wishlist.id,
              );

              expect(response.status).toBe(200);
              expect(yield* readJson(response)).toEqual(
                toResponseJson(wishlist),
              );
            }),
          ),
        );

        it.effect('Чтение старой Occasion Date', () =>
          atFixedNow(
            Effect.gen(function* () {
              const sql = yield* SqlClient;
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const [inserted] = yield* sql<{ id: string }>`
                INSERT INTO "public"."wishlists" ("owner_id", "title", "occasion_date")
                VALUES (${owner.id}, 'Books', '2020-02-29')
                RETURNING "id"
              `;
              const id =
                inserted?.id ??
                (yield* Effect.die('INSERT did not return the id'));

              const response = yield* getWishlist(app, owner.cookie, id);

              expect(response.status).toBe(200);
              expect(yield* readJson(response)).toMatchObject({
                occasionDate: '2020-02-29',
              });
            }),
          ),
        );

        it.effect('Чужой Private Wishlist', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');
            const other = yield* acquireUser('b@example.test');
            const wishlist = yield* createWishlist(app, owner, minimalBody);

            const response = yield* getWishlist(
              app,
              other.cookie,
              wishlist.id,
              `?ownerId=${owner.id}`,
            );

            expectProblem(response, 404);
            expect(yield* readJson(response)).toEqual(
              notFoundBody(wishlist.id),
            );
          }),
        );

        it.effect('Отсутствующий Wishlist', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');
            const id = '00000000-0000-4000-8000-0000000000aa';

            const response = yield* getWishlist(app, owner.cookie, id);

            expectProblem(response, 404);
            expect(yield* readJson(response)).toEqual(notFoundBody(id));
          }),
        );

        it.effect('Одинаковое тело 404 для одного id', () =>
          Effect.gen(function* () {
            const sql = yield* SqlClient;
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');
            const other = yield* acquireUser('b@example.test');
            const wishlist = yield* createWishlist(app, owner, minimalBody);
            const hidden = yield* getWishlist(app, other.cookie, wishlist.id);
            expectProblem(hidden, 404);
            const hiddenBody = yield* readJson(hidden);

            yield* sql`DELETE FROM "public"."wishlists" WHERE "id" = ${wishlist.id}`;
            const missing = yield* getWishlist(app, other.cookie, wishlist.id);

            expectProblem(missing, 404);
            expect(yield* readJson(missing)).toEqual(hiddenBody);
          }),
        );

        it.effect('Невалидный UUID', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');

            const response = yield* getWishlist(
              app,
              owner.cookie,
              'not-a-uuid',
            );

            expectProblem(response, 400);
            expect(yield* readJson(response)).toEqual(
              validationBody('/api/wishlists/not-a-uuid'),
            );
          }),
        );
      });

      describe('validation', () => {
        it.effect.each(invalidBodies)('Невалидное поле: $name', ({ body }) =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');

            const response = yield* postWishlist(app, owner.cookie, body);

            expectProblem(response, 400);
            expect(yield* readJson(response)).toEqual(
              validationBody('/api/wishlists', expect.any(Array)),
            );
            expect(yield* selectWishlists).toHaveLength(0);
          }),
        );

        it.effect.each(serverFields)(
          'Клиент передаёт серверные поля: $name',
          ({ extra }) =>
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const other = yield* acquireUser('b@example.test');

              const response = yield* postWishlist(app, owner.cookie, {
                ...minimalBody,
                ...extra(other.id),
              });

              expectProblem(response, 400);
              expect(yield* readJson(response)).toEqual(
                validationBody('/api/wishlists', expect.any(Array)),
              );
              expect(yield* selectWishlists).toHaveLength(0);
            }),
        );
      });

      describe('Occasion Date window', () => {
        it.effect.each([
          {
            name: 'Вчера минус один день отклоняется',
            occasionDate: '2026-10-10',
          },
          {
            name: 'Пять лет плюс один день отклоняются',
            occasionDate: '2031-10-13',
          },
        ])('$name', ({ occasionDate }) =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');

              const response = yield* postWishlist(app, owner.cookie, {
                ...minimalBody,
                occasionDate,
              });

              expectProblem(response, 400);
              expect(yield* readJson(response)).toEqual(
                validationBody('/api/wishlists', [
                  occasionDateError(windowMessage),
                ]),
              );
              expect(yield* selectWishlists).toHaveLength(0);
            }),
          ),
        );

        it.effect.each([
          { name: 'Вчера принимается', occasionDate: '2026-10-11' },
          { name: 'Пять лет принимаются', occasionDate: '2031-10-12' },
        ])('$name и читается без сдвига', ({ occasionDate }) =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const wishlist = yield* createWishlist(app, owner, {
                ...minimalBody,
                occasionDate,
              });

              const response = yield* getWishlist(
                app,
                owner.cookie,
                wishlist.id,
              );

              expect(wishlist.occasionDate).toBe(occasionDate);
              expect(response.status).toBe(200);
              expect(yield* readJson(response)).toMatchObject({
                occasionDate,
              });
            }),
          ),
        );

        // Задача 1.1: HttpApi выполняет checkEffect и читает Clock заново на
        // каждом запросе. Тот же payload меняет ответ после сдвига часов.
        it.effect('окно сдвигается вместе с Clock между запросами', () =>
          atFixedNow(
            Effect.gen(function* () {
              const app = yield* acquireApp();
              const owner = yield* acquireUser('a@example.test');
              const body = { ...minimalBody, occasionDate: '2026-10-11' };

              const accepted = yield* postWishlist(app, owner.cookie, body);
              yield* TestClock.setTime(Date.parse('2026-10-13T12:00:00Z'));
              const rejected = yield* postWishlist(app, owner.cookie, body);

              expect(accepted.status).toBe(201);
              expectProblem(rejected, 400);
              expect(yield* readJson(rejected)).toEqual(
                validationBody('/api/wishlists', [
                  occasionDateError(
                    'Expected a date between 2026-10-12 and 2031-10-13',
                  ),
                ]),
              );
              expect(yield* selectWishlists).toHaveLength(1);
            }),
          ),
        );
      });

      describe('technical failures', () => {
        it.effect.each(createFailures)(
          '$name: $status без исходной ошибки',
          ({ failure, status, code }) =>
            Effect.gen(function* () {
              const owner = yield* acquireUser('a@example.test');
              const app = yield* acquireApp({
                create: () => failure,
                getReadableById: unexpectedRead,
              });

              const response = yield* postWishlist(
                app,
                owner.cookie,
                minimalBody,
              );

              expectProblem(response, status);
              const body = yield* readJson(response);
              expect(body).toMatchObject({
                code,
                status,
                instance: '/api/wishlists',
                errorId: expect.stringMatching(/^[0-9a-f]{32}$/),
              });
              expect(JSON.stringify(body)).not.toContain(secret);
            }),
        );

        it.effect('Повреждённая строка при read', () =>
          Effect.gen(function* () {
            const app = yield* acquireApp();
            const owner = yield* acquireUser('a@example.test');
            const id = yield* acquireCorruptedWishlist(owner.id);

            const response = yield* getWishlist(app, owner.cookie, id);

            expectProblem(response, 500);
            expect(yield* readJson(response)).toMatchObject({
              code: 'INTERNAL_ERROR',
              status: 500,
              instance: `/api/wishlists/${id}`,
            });
          }),
        );
      });
    },
  );
});
