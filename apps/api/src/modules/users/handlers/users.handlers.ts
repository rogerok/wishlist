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

const logGetByIdFailure = (message: string, cause: unknown, id: UserId) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.getById',
      userId: id,
    }),
  );

const logGetAllFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.getAll',
    }),
  );

const logDeleteByIdFailure = (message: string, cause: unknown, id: UserId) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.deleteById',
      userId: id,
    }),
  );

const logCreateFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.create',
    }),
  );

const logUpdateFailure = (message: string, cause: unknown) =>
  Effect.logError(message, cause).pipe(
    Effect.annotateLogs({
      operation: 'users.update',
    }),
  );

export const UsersHandlersLive = HttpApiBuilder.group(
  AppApi,
  'users',
  (handlers) =>
    handlers
      .handle('create', ({ payload }) =>
        UsersService.use((service) =>
          service.create(payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExists: makeUserEmailAlreadyExistsHttpError,

              UsersUnavailableError: (cause) =>
                logCreateFailure('Failed to create user', cause).pipe(
                  Effect.andThen(
                    makeUsersUnavailableHttpError(usersCollectionInstance),
                  ),
                ),

              UserDataIntegrityError: (cause) =>
                logCreateFailure('Invalid created user record', cause).pipe(
                  Effect.andThen(
                    makeUsersInternalHttpError(usersCollectionInstance),
                  ),
                ),
            }),
          ),
        ),
      )
      .handle('update', ({ params: { id }, payload }) =>
        UsersService.use((service) =>
          service.update(id, payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExists: makeUserEmailAlreadyExistsHttpError,
              UsersUnavailableError: (cause) =>
                logUpdateFailure('Failed to update user', cause).pipe(
                  Effect.andThen(
                    makeUsersUnavailableHttpError(usersCollectionInstance),
                  ),
                ),

              UserDataIntegrityError: (cause) =>
                logUpdateFailure('Invalid updated user record', cause).pipe(
                  Effect.andThen(
                    makeUsersInternalHttpError(usersCollectionInstance),
                  ),
                ),

              UserNotFound: ({ id }) => makeUserNotFoundHttpError(id),
            }),
          ),
        ),
      )
      .handle('getAll', () =>
        UsersService.use((service) =>
          service.getAll.pipe(
            Effect.catchTags({
              UsersUnavailableError: (cause) =>
                logGetAllFailure('Failed to get users', cause).pipe(
                  Effect.andThen(
                    makeUsersUnavailableHttpError(usersCollectionInstance),
                  ),
                ),

              UserDataIntegrityError: (cause) =>
                logGetAllFailure('Invalid user records', cause).pipe(
                  Effect.andThen(
                    makeUsersInternalHttpError(usersCollectionInstance),
                  ),
                ),
            }),
          ),
        ),
      )
      .handle('getById', ({ params: { id } }) =>
        UsersService.use((service) =>
          service.getById(id).pipe(
            Effect.catchTags({
              UserNotFound: ({ id }) => makeUserNotFoundHttpError(id),

              UsersUnavailableError: (cause) =>
                logGetByIdFailure('Failed to get user', cause, id).pipe(
                  Effect.andThen(
                    makeUsersUnavailableHttpError(makeByIdInstance(id)),
                  ),
                ),

              UserDataIntegrityError: (cause) =>
                logGetByIdFailure('Invalid user record', cause, id).pipe(
                  Effect.andThen(
                    makeUsersInternalHttpError(makeByIdInstance(id)),
                  ),
                ),
            }),
          ),
        ),
      )
      .handle('delete', ({ params: { id } }) =>
        UsersService.use((service) =>
          service.deleteById(id).pipe(
            Effect.catchTags({
              UsersUnavailableError: (cause) =>
                logDeleteByIdFailure('Failed to delete user', cause, id).pipe(
                  Effect.andThen(
                    makeUsersUnavailableHttpError(makeByIdInstance(id)),
                  ),
                ),

              UserNotFound: () => makeUserNotFoundHttpError(id),
            }),
          ),
        ),
      ),
);
