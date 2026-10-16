import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, layer } from '@effect/vitest';
import { ConfigProvider, Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import { HttpApi, HttpApiBuilder } from 'effect/http-api';

import type { AuthService } from '#modules/auth/service/auth.service.js';
import type { WishlistsService } from '#modules/wishlists/service/wishlists.service.js';

import { requestParseOptions } from '#infra/api/request-parse-options.js';
import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { AuthModuleLive } from '#modules/auth/auth.module.js';
import { SessionAuthenticationLive } from '#modules/auth/handlers/auth.handlers.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';
import { wishlistsGroup } from '#modules/wishlists/api/wishlists.api.js';
import { WishlistsHandlersLive } from '#modules/wishlists/handlers/wishlists.handlers.js';
import { WishlistsModuleLive } from '#modules/wishlists/wishlists.module.js';

const databaseLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const servicesLayer = Layer.mergeAll(AuthModuleLive, WishlistsModuleLive).pipe(
  Layer.provideMerge(databaseLayer),
);

const testApi = HttpApi.make('app')
  .annotate(HttpApi.PayloadParseOptions, requestParseOptions)
  .add(wishlistsGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

interface TestApp {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

// Приложение с группой Wishlist поверх уже собранных сервисов теста.
const acquireApp = Effect.gen(function* () {
  const services = yield* Effect.context<AuthService | WishlistsService>();
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

const minimalBody = {
  title: 'Books',
  description: null,
  occasionDate: null,
  visibility: 'private',
};

const invalidSessionBody = (instance: string) => ({
  code: 'AUTH_INVALID_SESSION',
  detail: 'Session is invalid',
  status: 401,
  title: 'Invalid session',
  type: '/errors/auth-invalid-session',
  instance,
});

// Истекшая Session проверяется для того же middleware в auth.me.test.ts.
const invalidCookies = [
  { name: 'without a cookie', cookie: undefined },
  { name: 'with a malformed cookie', cookie: `${cookieSessionKey}=abc` },
  {
    name: 'with a cookie of an unknown Session',
    cookie: `${cookieSessionKey}=${'A'.repeat(43)}`,
  },
] as const;

const send = (app: TestApp, request: Request) =>
  Effect.promise(() => app.handler(request));

const expectInvalidSession = (response: Response, instance: string) =>
  Effect.gen(function* () {
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    const body: unknown = yield* Effect.promise(() => response.json());
    expect(body).toEqual(invalidSessionBody(instance));
  });

describe('wishlists HTTP', () => {
  layer(servicesLayer, { timeout: '60 seconds' })('Session', (it) => {
    it.effect.each(invalidCookies)(
      'Create без действующей Session: 401 $name, instance без query',
      ({ cookie }) =>
        Effect.gen(function* () {
          const app = yield* acquireApp;

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
        }).pipe(Effect.scoped),
    );

    it.effect.each(invalidCookies)(
      'Public Wishlist без действующей Session: 401 $name, instance без query',
      ({ cookie }) =>
        Effect.gen(function* () {
          const app = yield* acquireApp;
          const id = '00000000-0000-4000-8000-0000000000aa';

          const response = yield* send(
            app,
            new Request(`http://localhost/api/wishlists/${id}?source=test`, {
              headers: cookie === undefined ? {} : { cookie },
            }),
          );

          yield* expectInvalidSession(response, `/api/wishlists/${id}`);
        }).pipe(Effect.scoped),
    );

    it.todo('Создание минимального Wishlist');
    it.todo('Ответ create соответствует записи');
    it.todo('Несколько Wishlist одного User');
    it.todo('Владелец не выбирается через query');
    it.todo('Владелец читает Private Wishlist');
    it.todo('Владелец читает Public Wishlist');
    it.todo('Другой User читает Public Wishlist');
    it.todo('Чтение старой Occasion Date');
    it.todo('Чужой Private Wishlist');
    it.todo('Отсутствующий Wishlist');
    it.todo('Одинаковое тело 404 для одного id');
    it.todo('Невалидное поле');
    it.todo('Клиент передаёт серверные поля');
    it.todo('Невалидный UUID');
    it.todo('Вчера минус один день отклоняется');
    it.todo('Пять лет плюс один день отклоняются');
    it.todo('Временный отказ сохранения');
    it.todo('Повреждённая строка при read');
  });
});
