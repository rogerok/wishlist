import { Cause, Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import {
  usersCollectionPath,
  usersGroupIdentifier,
} from '#modules/users/api/users.api.constants.js';
import {
  makeByIdInstance,
  UserEmailAlreadyExistsHttpError,
  UserNotFoundHttpError,
  UsersInternalHttpError,
  UsersUnavailableHttpError,
} from '#modules/users/api/users.api.errors.js';
import {
  UserFailureLogAnnotation,
  UserFailureReason,
  UserLogEvent,
} from '#modules/users/schemas/user-logs.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

type LogOptions = {
  cause: unknown;
} & Omit<UserFailureLogAnnotation, 'event'>;

const logFailure = ({ operation, userId, cause, reason }: LogOptions) =>
  Effect.logError('User operation failed', cause).pipe(
    Effect.annotateLogs({
      event: UserLogEvent['users.operation.failed'],
      operation,
      userId,
      reason,
    }),
  );

const logAndFail = <E extends Cause.YieldableError>(
  options: LogOptions,
  error: E,
) =>
  Effect.gen(function* () {
    yield* logFailure(options);
    return yield* error;
  });

export const UsersHandlersLive = HttpApiBuilder.group(
  AppApi,
  usersGroupIdentifier,
  (handlers) =>
    handlers
      .handle(UserOperation.create, ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.create(payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExistsError: () =>
                new UserEmailAlreadyExistsHttpError(),

              UserDataIntegrityError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.create,
                    reason: UserFailureReason.dataIntegrity,
                    cause,
                    userId: null,
                  },
                  new UsersInternalHttpError({
                    instance: usersCollectionPath,
                  }),
                ),

              UsersUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.create,
                    reason: UserFailureReason.unavailable,
                    cause,
                    userId: null,
                  },
                  new UsersUnavailableHttpError({
                    instance: usersCollectionPath,
                  }),
                ),
            }),
          );
        }),
      )
      .handle(UserOperation.getAll, () =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.getAll.pipe(
            Effect.catchTags({
              UserDataIntegrityError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.getAll,
                    reason: UserFailureReason.dataIntegrity,
                    userId: null,
                    cause,
                  },
                  new UsersInternalHttpError({
                    instance: usersCollectionPath,
                  }),
                ),

              UsersUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.getAll,
                    reason: UserFailureReason.unavailable,
                    cause,
                    userId: null,
                  },
                  new UsersUnavailableHttpError({
                    instance: usersCollectionPath,
                  }),
                ),
            }),
          );
        }),
      )
      .handle(UserOperation.getById, ({ params: { id } }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.getById(id).pipe(
            Effect.catchTags({
              UserNotFoundError: ({ id }) =>
                new UserNotFoundHttpError({
                  id,
                  instance: makeByIdInstance(id),
                }),

              UserDataIntegrityError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.getById,
                    reason: UserFailureReason.dataIntegrity,
                    cause,
                    userId: id,
                  },
                  new UsersInternalHttpError({
                    instance: makeByIdInstance(id),
                  }),
                ),

              UsersUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.getById,
                    reason: UserFailureReason.unavailable,
                    cause,
                    userId: id,
                  },
                  new UsersUnavailableHttpError({
                    instance: makeByIdInstance(id),
                  }),
                ),
            }),
          );
        }),
      )
      .handle(UserOperation.update, ({ params: { id }, payload }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.update(id, payload).pipe(
            Effect.catchTags({
              UserEmailAlreadyExistsError: () =>
                new UserEmailAlreadyExistsHttpError(),

              UserNotFoundError: ({ id }) =>
                new UserNotFoundHttpError({
                  id,
                  instance: makeByIdInstance(id),
                }),

              UserDataIntegrityError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.update,
                    reason: UserFailureReason.dataIntegrity,
                    cause,
                    userId: id,
                  },
                  new UsersInternalHttpError({
                    instance: usersCollectionPath,
                  }),
                ),

              UsersUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.update,
                    reason: UserFailureReason.unavailable,
                    cause,
                    userId: id,
                  },
                  new UsersUnavailableHttpError({
                    instance: usersCollectionPath,
                  }),
                ),
            }),
          );
        }),
      )
      .handle(UserOperation.delete, ({ params: { id } }) =>
        Effect.gen(function* () {
          const service = yield* UsersService;

          return yield* service.deleteById(id).pipe(
            Effect.catchTags({
              UserNotFoundError: ({ id }) =>
                new UserNotFoundHttpError({
                  id,
                  instance: makeByIdInstance(id),
                }),

              UsersUnavailableError: (cause) =>
                logAndFail(
                  {
                    operation: UserOperation.delete,
                    reason: UserFailureReason.dataIntegrity,
                    cause,
                    userId: id,
                  },
                  new UsersUnavailableHttpError({
                    instance: makeByIdInstance(id),
                  }),
                ),
            }),
          );
        }),
      ),
);
