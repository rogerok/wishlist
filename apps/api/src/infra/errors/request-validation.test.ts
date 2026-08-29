import { NodeHttpServer } from '@effect/platform-node';
import {
  Effect,
  Layer,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from 'effect/unstable/httpapi';

import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { withRequestParseOptions } from '#infra/schemas/utils.js';

let handlerCalls = 0;

const commonErrorFields = {
  type: '/errors/request-validation',
  title: 'Request validation failed',
  status: 400,
  detail: 'The request contains invalid data',
  code: 'REQUEST_VALIDATION_FAILED',
};
const headers = { 'Content-Type': 'application/json' };

const TestPayloadSchema = Schema.Struct({
  quantity: Schema.Finite,
}).pipe(withRequestParseOptions);
const TestIdSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^item-\d+$/u, {
      expected: 'an item id',
    }),
  ),
);

const BrokenResponseSchema = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transformOrFail<string, string>({
      decode: (value) => Effect.succeed(value),

      encode: () =>
        Effect.fail(
          new SchemaIssue.InvalidValue({
            message: 'Intentional response encoding failure',
          }),
        ),
    }),
  ),
);

const validationGroup = HttpApiGroup.make('validation').add(
  HttpApiEndpoint.post('create', '/test/items', {
    payload: TestPayloadSchema,
    success: Schema.String,
  }),
  HttpApiEndpoint.get('getById', '/test/items/:id', {
    params: { id: TestIdSchema },
    success: Schema.String,
  }),
  HttpApiEndpoint.get('brokenResponse', '/test/broken-response', {
    success: BrokenResponseSchema,
  }),
);
const TestApi = HttpApi.make('test')
  .add(validationGroup)
  .middleware(RequestValidationMiddleware);
const TestHandlersLive = HttpApiBuilder.group(
  TestApi,
  'validation',
  (handlers) =>
    handlers
      .handle('create', () =>
        Effect.sync(() => {
          handlerCalls += 1;
          return 'created';
        }),
      )
      .handle('getById', () =>
        Effect.sync(() => {
          handlerCalls += 1;
          return 'found';
        }),
      )
      .handle('brokenResponse', () => Effect.succeed('valid handler result')),
).pipe(Layer.provide(RequestValidationMiddlewareLive));

const TestAppLive = HttpApiBuilder.layer(TestApi).pipe(
  Layer.provide(TestHandlersLive),
  Layer.provide(NodeHttpServer.layerHttpServices),
);

const app = HttpRouter.toWebHandler(TestAppLive, {
  disableLogger: true,
});

beforeEach(() => {
  handlerCalls = 0;
});
afterAll(async () => {
  await app.dispose();
});

describe('request validation', () => {
  it('returns all payload validation issues as Problem Details', async () => {
    const req = new Request('http://localhost/test/items', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quantity: 'many',
        unexpected: true,
      }),
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(handlerCalls).toBe(0);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        ...commonErrorFields,
        instance: '/test/items',
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'payload',
            path: ['quantity'],
            message: expect.stringMatching(/\S/u),
          }),
          expect.objectContaining({
            location: 'payload',
            path: ['unexpected'],
            message: expect.stringMatching(/\S/u),
          }),
        ]),
      }),
    );
  });

  it('returns malformed JSON as a payload validation issue', async () => {
    const req = new Request('http://localhost/test/items', {
      method: 'POST',
      headers,
      body: `{"quantity":1`,
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(handlerCalls).toBe(0);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        ...commonErrorFields,
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'payload',
            path: [],
            message: expect.stringMatching(/\S/u),
          }),
        ]),
      }),
    );
  });

  it('returns a params validation issue as Problem Details', async () => {
    const req = new Request('http://localhost/test/items/not-an-item-id', {
      method: 'GET',
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(handlerCalls).toBe(0);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        ...commonErrorFields,
        instance: '/test/items/not-an-item-id',
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'params',
            path: ['id'],
            message: expect.stringMatching('item id'),
          }),
        ]),
      }),
    );
  });

  it('returns 500 when response encoding fails', async () => {
    const req = new Request('http://localhost/test/broken-response', {
      method: 'GET',
    });

    const resp = await app.handler(req);

    expect(resp.status).toBe(500);
    expect(resp.headers.get('content-type')).not.toBe(
      'application/problem+json',
    );
  });
});
