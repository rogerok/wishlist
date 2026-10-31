import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter } from 'effect/http';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from 'effect/http-api';
import { afterAll, describe, expect, it } from 'vitest';

import { requestParseOptions } from '#infra/api/request-parse-options.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';

// Наблюдение задачи 1.2: какие location и path HttpApi 4.0.4 даёт ошибкам query.
// Тестовый HttpApi сам несёт QueryParseOptions: настройки разбора берутся из API,
// переданного в HttpApiBuilder.group, а не из AppApi.

const Pair = Schema.Struct({ a: Schema.String, b: Schema.String });

const QueryWithRootCheck = Pair.check(
  Schema.makeFilter(({ a, b }) => a === b || 'a must equal b'),
);

const QueryWithPointedCheck = Pair.check(
  Schema.makeFilter(
    ({ a, b }) => a === b || { path: ['b'], issue: 'b must equal a' },
  ),
);

const group = HttpApiGroup.make('queryErrors').add(
  HttpApiEndpoint.get('root', '/test/root', {
    query: QueryWithRootCheck,
    success: Schema.String,
  }),
  HttpApiEndpoint.get('pointed', '/test/pointed', {
    query: QueryWithPointedCheck,
    success: Schema.String,
  }),
);

const TestApi = HttpApi.make('test')
  .annotate(HttpApi.QueryParseOptions, requestParseOptions)
  .add(group)
  .middleware(RequestValidationMiddleware);

const HandlersLive = HttpApiBuilder.group(TestApi, 'queryErrors', (handlers) =>
  handlers
    .handle('root', () => Effect.succeed('ok'))
    .handle('pointed', () => Effect.succeed('ok')),
).pipe(Layer.provide(RequestValidationMiddlewareLive));

const app = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(TestApi).pipe(
    Layer.provide(HandlersLive),
    Layer.provide(NodeHttpServer.layerHttpServices),
  ),
  { disableLogger: true },
);

afterAll(async () => {
  await app.dispose();
});

const get = async (url: string) => {
  const response = await app.handler(new Request(`http://localhost${url}`));

  return { status: response.status, body: await response.json() };
};

describe('query validation errors', () => {
  it('accepts a valid query', async () => {
    const { status } = await get('/test/root?a=x&b=x');

    expect(status).toBe(200);
  });

  it('rejects an unknown query key with the key as path', async () => {
    const { status, body } = await get('/test/root?a=x&b=x&zz=1');

    expect(status).toBe(400);
    expect(body.errors).toEqual([
      expect.objectContaining({ location: 'query', path: ['zz'] }),
    ]);
  });

  it('reports a struct-level check returning a string at the root path', async () => {
    const { status, body } = await get('/test/root?a=x&b=y');

    expect(status).toBe(400);
    expect(body.errors).toEqual([
      expect.objectContaining({ location: 'query', path: [] }),
    ]);
  });

  it('reports a struct-level check returning { path } at that path', async () => {
    const { status, body } = await get('/test/pointed?a=x&b=y');

    expect(status).toBe(400);
    expect(body.errors).toEqual([
      expect.objectContaining({ location: 'query', path: ['b'] }),
    ]);
  });
});
