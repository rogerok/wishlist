import { NodeHttpServer } from '@effect/platform-node';
import { describe } from '@effect/vitest';
import { Effect, Layer, Logger } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import { SqlError, UnknownError } from 'effect/unstable/sql/SqlError';

import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
} from '#infra/errors/defect-boundary.js';
import {
  RequestValidationMiddleware,
  RequestValidationMiddlewareLive,
} from '#infra/errors/request-validation.js';
import { operationFailedEvent } from '#infra/errors/technical-failure.js';
import { usersGroup } from '#modules/users/api/users.api.js';
import { UsersHandlersLive } from '#modules/users/handlers/users.handlers.js';
import { UsersRepositoryError } from '#modules/users/repository/users.repository.errors.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersServiceLive } from '#modules/users/service/users.service.js';

const sensitiveMarker = 'sensitive@mail.com';

const sqlError = new SqlError({
  reason: new UnknownError({
    cause: {
      detail: sensitiveMarker,
    },
  }),
});

const TestUsersRepositoryLive = Layer.succeed(UsersRepository, {
  create: () => Effect.die(new Error('Unexpected call: create')),
  getAll: new UsersRepositoryError({
    operation: UserOperation.getAll,
    cause: sqlError,
  }),
  getById: () => Effect.die(new Error('Unexpected call: getById')),
  getByEmail: () => Effect.die(new Error('Unexpected call: getByEmail')),
  update: () => Effect.die(new Error('Unexpected call: update')),
  deleteById: () => Effect.die(new Error('Unexpected call: deleteById')),
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
        userId: null,
        reason: 'internal',
        errorId: body.errorId,
        errorChain: [
          { tag: 'UsersInternalError' },
          { tag: 'UsersRepositoryError', operation: UserOperation.getAll },
          { tag: 'SqlError' },
          { tag: 'UnknownError' },
        ],
      }),
    );
    expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(body)).not.toContain(sensitiveMarker);
  });
});
