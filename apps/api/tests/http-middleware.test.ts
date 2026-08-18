import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { AppApiLive } from '#api/api-live.js';
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

beforeEach(() => {
  createCalls = 0;
});
afterAll(async () => {
  await app.dispose();
});

describe('request validation', () => {
  it('returns all payload as Problem Details', async () => {
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Ivan',
        middleName: null,
        lastName: 'Ivanov',
        email: 'not-an-email',
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
        type: '/errors/request-validation',
        title: 'Request validation failed',
        status: 400,
        detail: 'The request contains invalid data',
        code: 'REQUEST_VALIDATION_FAILED',
        instance: '/api/users',
        errors: expect.arrayContaining([
          expect.objectContaining({
            location: 'payload',
            path: ['email'],
            message: expect.stringMatching(/\S/u),
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
});
