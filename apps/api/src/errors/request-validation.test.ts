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
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { AppApiLive } from '#api/api-live.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#errors/request-validation.js';
import { UsersService } from '#modules/users/service/users.service.js';

let createCalls = 0;

const unexpectedCall = (method: string) =>
  Effect.die(new Error(`Unexpected UsersService.${method} call`));

const UsersServiceTest = Layer.succeed(UsersService, {
  create: () =>
    Effect.gen(function* () {
      createCalls += 1;
      return yield* unexpectedCall('create');
    }),
  getAll: unexpectedCall('getAll'),
  getById: () => unexpectedCall('getById'),
  update: () => unexpectedCall('update'),
  deleteById: () => unexpectedCall('deleteById'),
});

const TestAppLive = AppApiLive.pipe(
  HttpRouter.provideRequest(UsersServiceTest),
  Layer.provide(NodeHttpServer.layerHttpServices),
);

const app = HttpRouter.toWebHandler(TestAppLive, {
  disableLogger: true,
});

const commonErrorFields = {
  type: '/errors/request-validation',
  title: 'Request validation failed',
  status: 400,
  detail: 'The request contains invalid data',
  code: 'REQUEST_VALIDATION_FAILED',
};
const headers = { 'Content-Type': 'application/json' };

const payloadWithInvalidEmail = {
  firstName: 'Ivan',
  middleName: null,
  lastName: 'Ivanov',
  email: 'not-an-email',
} as const;

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

const brokenGroup = HttpApiGroup.make('group').add(
  HttpApiEndpoint.get('get', '/broken-resp', {
    success: BrokenResponseSchema,
  }),
);
const Api = HttpApi.make('api')
  .add(brokenGroup)
  .middleware(RequestValidationMiddleware);
const BrokenHandlers = HttpApiBuilder.group(Api, 'group', (handlers) =>
  handlers.handle('get', () => Effect.succeed('valid handler result')),
).pipe(Layer.provide(RequestValidationMiddlewareLive));

const BrokenTestApp = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(BrokenHandlers),
  Layer.provide(NodeHttpServer.layerHttpServices),
);

const brokenApp = HttpRouter.toWebHandler(BrokenTestApp, {
  disableLogger: true,
});

beforeEach(() => {
  createCalls = 0;
});
afterAll(async () => {
  await app.dispose();
  await brokenApp.dispose();
});

describe('request validation', () => {
  it('returns all payload validation issues as Problem Details', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payloadWithInvalidEmail,
        emali: 'typo@example.com',
      }),
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(createCalls).toBe(0);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        ...commonErrorFields,
        instance: '/api/users',
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'payload',
            path: ['email'],
            message: expect.stringMatching('email address'),
          }),
          expect.objectContaining({
            location: 'payload',
            path: ['emali'],
            message: expect.stringMatching(/\S/u),
          }),
        ]),
      }),
    );
  });

  it('returns malformed JSON as a payload validation issue', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"email":"user@example.com"`,
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(createCalls).toBe(0);
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
    const req = new Request('http://localhost/api/users/not-a-uuid', {
      method: 'GET',
    });

    const response = await app.handler(req);

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        ...commonErrorFields,
        instance: '/api/users/not-a-uuid',
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'params',
            path: ['id'],
            message: expect.stringMatching('UUID v4'),
          }),
        ]),
      }),
    );
  });

  it('returns 500 when response encoding fails', async () => {
    const req = new Request('http://localhost/broken-resp', {
      method: 'GET',
    });

    const resp = await brokenApp.handler(req);

    expect(resp.status).toBe(500);
    expect(resp.headers.get('content-type')).not.toBe(
      'application/problem+json',
    );
  });
});
