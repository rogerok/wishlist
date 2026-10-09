import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import type { UsersTechnicalError } from '#modules/users/service/users.service.errors.js';

import { AppApi } from '#infra/api/api.js';
import { makeTechnicalFailureHandler } from '#infra/errors/technical-failure.js';
import { usersGroupIdentifier } from '#modules/users/api/users.api.constants.js';
import {
  makeByIdInstance,
  UserEmailAlreadyExistsHttpError,
  UserNotFoundHttpError,
} from '#modules/users/api/users.api.errors.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

const makeTechnicalErrorHandler =
  makeTechnicalFailureHandler<UsersTechnicalError>()({
    module: 'users',
    operations: UserOperation,
    reasons: {
      UserDataIntegrityError: 'dataIntegrity',
      UsersInternalError: 'internal',
      UsersUnavailableError: 'unavailable',
    },
  });

export const UsersHandlersLive = HttpApiBuilder.group(
  AppApi,
  usersGroupIdentifier,
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* UsersService;

      return handlers
        .handle(UserOperation.create, ({ payload }) =>
          Effect.gen(function* () {
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.create,
              userId: null,
            });

            return yield* service.create(payload).pipe(
              Effect.catchTags({
                UserEmailAlreadyExistsError: () =>
                  new UserEmailAlreadyExistsHttpError(),
                UserDataIntegrityError: handleTechnicalError,
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        )
        .handle(UserOperation.getAll, () =>
          Effect.gen(function* () {
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.getAll,
              userId: null,
            });

            return yield* service.getAll.pipe(
              Effect.catchTags({
                UserDataIntegrityError: handleTechnicalError,
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        )
        .handle(UserOperation.getById, ({ params: { id } }) =>
          Effect.gen(function* () {
            const instance = makeByIdInstance(id);
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.getById,
              userId: id,
            });

            return yield* service.getById(id).pipe(
              Effect.catchTags({
                UserNotFoundError: () =>
                  new UserNotFoundHttpError({
                    id,
                    instance,
                  }),
                UserDataIntegrityError: handleTechnicalError,
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        )
        .handle(UserOperation.update, ({ params: { id }, payload }) =>
          Effect.gen(function* () {
            const instance = makeByIdInstance(id);
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.update,
              userId: id,
            });

            return yield* service.update(id, payload).pipe(
              Effect.catchTags({
                UserEmailAlreadyExistsError: () =>
                  new UserEmailAlreadyExistsHttpError(),

                UserNotFoundError: () =>
                  new UserNotFoundHttpError({
                    id,
                    instance,
                  }),
                UserDataIntegrityError: handleTechnicalError,
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        )
        .handle(UserOperation.delete, ({ params: { id } }) =>
          Effect.gen(function* () {
            const instance = makeByIdInstance(id);
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.delete,
              userId: id,
            });

            return yield* service.deleteById(id).pipe(
              Effect.catchTags({
                UserNotFoundError: () =>
                  new UserNotFoundHttpError({
                    id,
                    instance,
                  }),
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        );
    }),
);
