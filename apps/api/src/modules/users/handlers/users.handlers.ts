import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';

import { AppApi } from '#infra/api/api.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { usersGroupIdentifier } from '#modules/users/api/users.api.constants.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

const makeTechnicalErrorHandler = makeTechnicalFailureHandler({
  module: 'users',
  operations: UserOperation,
});

export const UsersHandlersLive = HttpApiBuilder.group(
  AppApi,
  usersGroupIdentifier,
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* UsersService;

      return handlers
        .handle(UserOperation.create, ({ payload }) =>
          service
            .create(payload)
            .pipe(
              Effect.catchTag(
                'OperationFailed',
                makeTechnicalErrorHandler({ operation: UserOperation.create }),
              ),
            ),
        )
        .handle(UserOperation.getAll, () =>
          service.getAll.pipe(
            Effect.catchTag(
              'OperationFailed',
              makeTechnicalErrorHandler({ operation: UserOperation.getAll }),
            ),
          ),
        )
        .handle(UserOperation.getById, ({ params: { id } }) =>
          service.getById(id).pipe(
            Effect.catchTag(
              'OperationFailed',
              makeTechnicalErrorHandler({
                operation: UserOperation.getById,
                meta: { targetUserId: id },
              }),
            ),
          ),
        )
        .handle(UserOperation.update, ({ params: { id }, payload }) =>
          service.update(id, payload).pipe(
            Effect.catchTag(
              'OperationFailed',
              makeTechnicalErrorHandler({
                operation: UserOperation.update,
                meta: { targetUserId: id },
              }),
            ),
          ),
        )
        .handle(UserOperation.delete, ({ params: { id } }) =>
          service.deleteById(id).pipe(
            Effect.catchTag(
              'OperationFailed',
              makeTechnicalErrorHandler({
                operation: UserOperation.delete,
                meta: { targetUserId: id },
              }),
            ),
          ),
        );
    }),
);
