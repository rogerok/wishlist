import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import {
  makeByIdInstance,
  makeUserEmailAlreadyExistsHttpError,
  makeUserNotFoundHttpError,
  makeUsersInternalHttpError,
  makeUsersUnavailableHttpError,
  usersCollectionInstance,
} from '#modules/users/api/users.api.errors.js';
import { UserId } from '#modules/users/schemas/user.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

const logCreateFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      // TODO: операции в схемы
      operation: 'users.create',
    }),
  );

const logGetAllFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.getAll',
    }),
  );

const logGetByIdFailure = (message: string, cause: unknown, id: UserId) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.getById',
      userId: id,
    }),
  );

const logUpdateFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.update',
    }),
  );

const logDeleteByIdFailure = (message: string, cause: unknown, id: UserId) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.deleteById',
      userId: id,
    }),
  );

// TODO:вынести логирование в абстракцию

export const UsersHandlersLive = HttpApiBuilder.group(
  AppApi,
  'users',
  (handlers) =>
    handlers
      .handle('create', ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.create(payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExistsError: makeUserEmailAlreadyExistsHttpError,

              UserDataIntegrityError: (cause) =>
                Effect.gen(function* () {
                  yield* logCreateFailure('Invalid created user record', cause);
                  return yield* makeUsersInternalHttpError(
                    usersCollectionInstance,
                  );
                }),

              UsersUnavailableError: (cause) =>
                Effect.gen(function* () {
                  yield* logCreateFailure('Failed to create user', cause);
                  return yield* makeUsersUnavailableHttpError(
                    usersCollectionInstance,
                  );
                }),
            }),
          );
        }),
      )
      .handle('getAll', () =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.getAll.pipe(
            Effect.catchTags({
              UserDataIntegrityError: (cause) =>
                Effect.gen(function* () {
                  yield* logGetAllFailure('Invalid user records', cause);
                  return yield* makeUsersInternalHttpError(
                    usersCollectionInstance,
                  );
                }),

              UsersUnavailableError: (cause) =>
                Effect.gen(function* () {
                  yield* logGetAllFailure('Failed to get users', cause);
                  return yield* makeUsersUnavailableHttpError(
                    usersCollectionInstance,
                  );
                }),
            }),
          );
        }),
      )
      .handle('getById', ({ params: { id } }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.getById(id).pipe(
            Effect.catchTags({
              UserNotFoundError: ({ id }) => makeUserNotFoundHttpError(id),

              UserDataIntegrityError: (cause) =>
                Effect.gen(function* () {
                  yield* logGetByIdFailure('Invalid user record', cause, id);
                  return yield* makeUsersInternalHttpError(
                    makeByIdInstance(id),
                  );
                }),

              UsersUnavailableError: (cause) =>
                Effect.gen(function* () {
                  yield* logGetByIdFailure('Failed to get user', cause, id);

                  return yield* makeUsersUnavailableHttpError(
                    makeByIdInstance(id),
                  );
                }),
            }),
          );
        }),
      )
      .handle('update', ({ params: { id }, payload }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.update(id, payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExistsError: makeUserEmailAlreadyExistsHttpError,

              UserNotFoundError: ({ id }) => makeUserNotFoundHttpError(id),

              UserDataIntegrityError: (cause) =>
                Effect.gen(function* () {
                  yield* logUpdateFailure('Invalid updated user record', cause);
                  return yield* makeUsersInternalHttpError(
                    usersCollectionInstance,
                  );
                }),

              UsersUnavailableError: (cause) =>
                Effect.gen(function* () {
                  yield* logUpdateFailure('Failed to update user', cause);
                  return yield* makeUsersUnavailableHttpError(
                    usersCollectionInstance,
                  );
                }),
            }),
          );
        }),
      )
      .handle('delete', ({ params: { id } }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.deleteById(id).pipe(
            Effect.catchTags({
              UserNotFoundError: () => makeUserNotFoundHttpError(id),

              UsersUnavailableError: (cause) =>
                Effect.gen(function* () {
                  yield* logDeleteByIdFailure(
                    'Failed to delete user',
                    cause,
                    id,
                  );
                  return yield* makeUsersUnavailableHttpError(
                    makeByIdInstance(id),
                  );
                }),
            }),
          );
        }),
      ),
);
