import { NodeHttpServer } from '@effect/platform-node';
import { describe } from '@effect/vitest';
import { Effect, Layer, Logger } from 'effect';
import { HttpRouter } from 'effect/http';
import { HttpApi, HttpApiBuilder } from 'effect/http-api';
import { SqlError, UnknownError } from 'effect/sql/SqlError';

import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import { OperationFailed } from '#infra/errors/operation-failed.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { operationFailedEvent } from '#infra/errors/technical-failure.js';
import { usersGroup } from '#modules/users/api/users.api.js';
import { UsersHandlersLive } from '#modules/users/handlers/users.handlers.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersServiceLive } from '#modules/users/service/users.service.js';
import { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

const sensitiveMarker = 'sensitive@mail.com';

const sqlError = new SqlError({
  reason: new UnknownError({
    cause: {
      detail: sensitiveMarker,
    },
  }),
});

const missingUserId = '11111111-1111-4111-8111-111111111111';
const unavailableUserId = '22222222-2222-4222-8222-222222222222';

const TestUsersRepositoryLive = Layer.succeed(UsersRepository, {
  create: () => new UserEmailAlreadyExistsError(),
  getAll: new OperationFailed({
    reason: 'internal',
    source: 'usersRepository',
    operation: UserOperation.getAll,
    cause: sqlError,
  }),
  getById: (id) =>
    id === unavailableUserId
      ? new OperationFailed({
          reason: 'unavailable',
          source: 'usersRepository',
          operation: UserOperation.getById,
          cause: sqlError,
        })
      : Effect.succeedNone,
  getByEmail: () => Effect.die(new Error('Unexpected call: getByEmail')),
  update: (id) =>
    id === missingUserId
      ? Effect.succeedNone
      : Effect.fail(new UserEmailAlreadyExistsError()),
  deleteById: () => Effect.succeed(false),
});

const UsersServiceTest = UsersServiceLive.pipe(
  Layer.provide(TestUsersRepositoryLive),
);

const TestApi = HttpApi.make('app')
  .add(usersGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);

const logs: Array<ReturnType<typeof Logger.formatStructured.log>> = [];

const captureLogger = Logger.make((options) => {
  const entry = Logger.formatStructured.log(options);
  logs.push(entry);
});

const TestAppLive = HttpApiBuilder.layer(TestApi).pipe(
  Layer.provide([
    UsersHandlersLive.pipe(
      Layer.provide([
        DefectBoundaryMiddlewareLive,
        RequestValidationMiddlewareLive,
      ]),
    ),
    NodeHttpServer.layerHttpServices,
  ]),
  Layer.provide(UsersServiceTest),
);

const app = HttpRouter.toWebHandler(
  TestAppLive.pipe(Layer.provide(Logger.layer([captureLogger]))),
);

beforeEach(() => {
  logs.length = 0;
});

afterAll(async () => {
  await app.dispose();
});

describe('UsersHandlers', () => {
  it('does not log sensitive data', async () => {
    const response = await app.handler(
      new Request('http://localhost/api/users'),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');

    const failureLogs = logs.filter(
      (entry) => entry.annotations.event === operationFailedEvent,
    );

    expect(failureLogs).toHaveLength(1);
    expect(failureLogs[0]?.annotations).toEqual(
      expect.objectContaining({
        module: 'users',
        operation: 'getAll',
        meta: {},
        reason: 'internal',
        errorId: body.errorId,
        errorChain: [
          {
            tag: 'OperationFailed',
            source: 'usersRepository',
            operation: UserOperation.getAll,
          },
          { tag: 'SqlError' },
          { tag: 'UnknownError' },
        ],
      }),
    );
    expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(body)).not.toContain(sensitiveMarker);
  });

  it('answers 503 and logs the target user as meta', async () => {
    const response = await app.handler(
      new Request(`http://localhost/api/users/${unavailableUserId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
    expect(
      logs.filter((entry) => entry.annotations.event === operationFailedEvent),
    ).toEqual([
      expect.objectContaining({
        annotations: expect.objectContaining({
          operation: UserOperation.getById,
          meta: { targetUserId: unavailableUserId },
          reason: 'unavailable',
        }),
      }),
    ]);
  });

  // Тела ответов совпадают байт в байт с контрактом до перехода на
  // доменные ошибки (снято с Schema.Error-классов коммита 7861119).
  const userNotFoundBody = {
    code: 'USER_NOT_FOUND',
    detail: 'The requested user does not exist',
    status: 404,
    title: 'User not found',
    type: '/errors/user-not-found',
    id: missingUserId,
    instance: `/api/users/${missingUserId}`,
  };
  const emailAlreadyExistsBody = {
    code: 'USER_EMAIL_ALREADY_EXISTS',
    detail: 'A user with this email already exists',
    status: 409,
    title: 'User email already exists',
    type: '/errors/user-email-already-exists',
    instance: '/api/users',
  };
  const userPayload = JSON.stringify({
    displayName: 'Ann',
    email: 'ann@example.test',
  });

  it.each([
    {
      name: 'GET missing user',
      request: new Request(`http://localhost/api/users/${missingUserId}`),
      status: 404,
      body: userNotFoundBody,
    },
    {
      name: 'PUT missing user',
      request: new Request(`http://localhost/api/users/${missingUserId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: userPayload,
      }),
      status: 404,
      body: userNotFoundBody,
    },
    {
      name: 'DELETE missing user',
      request: new Request(`http://localhost/api/users/${missingUserId}`, {
        method: 'DELETE',
      }),
      status: 404,
      body: userNotFoundBody,
    },
    {
      name: 'POST taken email',
      request: new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: userPayload,
      }),
      status: 409,
      body: emailAlreadyExistsBody,
    },
    {
      name: 'PUT taken email',
      request: new Request(`http://localhost/api/users/${unavailableUserId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: userPayload,
      }),
      status: 409,
      body: emailAlreadyExistsBody,
    },
  ])('$name → $status problem+json', async ({ request, status, body }) => {
    const response = await app.handler(request);

    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    expect(await response.text()).toBe(JSON.stringify(body));
    expect(
      logs.filter((entry) => entry.annotations.event === operationFailedEvent),
    ).toHaveLength(0);
  });
});
