import type { Cause } from 'effect';

import { Match } from 'effect';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { isSqlError } from 'effect/unstable/sql/SqlError';
import { match, P } from 'ts-pattern';

import type { UserFailureLogAnnotation } from '#modules/users/schemas/user-logs.schema.js';
import type {
  UserDataIntegrityError,
  UsersInternalError,
  UsersUnavailableError,
} from '#modules/users/service/users.service.errors.js';

import { AppApi } from '#infra/api/api.js';
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
  UserFailureReason,
  UserLogEvent,
} from '#modules/users/schemas/user-logs.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

type LogOptions = {
  cause: UserDataIntegrityError | UsersInternalError | UsersUnavailableError;
} & Omit<UserFailureLogAnnotation, 'event'>;

type TechnicalErrorContext = {
  instance: UsersInternalHttpError['instance'];
} & Pick<UserFailureLogAnnotation, 'operation' | 'userId'>;

const makeTechnicalErrorHandler =
  ({ operation, userId, instance }: TechnicalErrorContext) =>
  (
    cause: LogOptions['cause'],
  ): Effect.Effect<never, UsersInternalHttpError | UsersUnavailableHttpError> =>
    Match.value(cause).pipe(
      Match.tag('UserDataIntegrityError', () =>
        logAndFail(
          {
            operation,
            cause,
            userId,
            reason: UserFailureReason.dataIntegrity,
          },
          new UsersInternalHttpError({
            instance,
          }),
        ),
      ),
      Match.tag('UsersInternalError', () =>
        logAndFail(
          {
            operation,
            cause,
            userId,
            reason: UserFailureReason.internal,
          },
          new UsersInternalHttpError({
            instance,
          }),
        ),
      ),
      Match.tag('UsersUnavailableError', () =>
        logAndFail(
          {
            operation,
            cause,
            userId,
            reason: UserFailureReason.unavailable,
          },
          new UsersUnavailableHttpError({
            instance,
          }),
        ),
      ),
      Match.exhaustive,
    );

const toUserFailureLog = (error: LogOptions['cause']) => {
  const base = { errorTag: error._tag };

  return match(error.cause)
    .with(
      {
        _tag: 'UsersRepositoryError',
        cause: P.when(isSqlError),
      },
      ({ _tag, cause }) => ({
        ...base,
        repositoryErrorTag: _tag,
        sqlReason: cause.reason._tag,
      }),
    )
    .with(
      { _tag: P.union('UsersRepositoryError', 'InvalidUserRecord') },
      ({ _tag }) => ({ ...base, repositoryErrorTag: _tag }),
    )
    .otherwise(() => base);
};

const logFailure = ({ operation, userId, cause, reason }: LogOptions) =>
  Effect.logError('User operation failed').pipe(
    Effect.annotateLogs({
      event: UserLogEvent['users.operation.failed'],
      operation,
      userId,
      reason,
      ...toUserFailureLog(cause),
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
    Effect.gen(function* () {
      const service = yield* UsersService;

      return handlers
        .handle(UserOperation.create, ({ payload }) =>
          Effect.gen(function* () {
            const handleTechnicalError = makeTechnicalErrorHandler({
              operation: UserOperation.create,
              userId: null,
              instance: usersCollectionPath,
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
              instance: usersCollectionPath,
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
              instance,
            });

            return yield* service.getById(id).pipe(
              Effect.catchTags({
                UserNotFoundError: ({ id }) =>
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
              instance,
            });

            return yield* service.update(id, payload).pipe(
              Effect.catchTags({
                UserEmailAlreadyExistsError: () =>
                  new UserEmailAlreadyExistsHttpError(),

                UserNotFoundError: ({ id }) =>
                  new UserNotFoundHttpError({
                    id,
                    instance: makeByIdInstance(id),
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
              instance,
            });

            return yield* service.deleteById(id).pipe(
              Effect.catchTags({
                UserNotFoundError: ({ id }) =>
                  new UserNotFoundHttpError({
                    id,
                    instance: makeByIdInstance(id),
                  }),
                UsersInternalError: handleTechnicalError,
                UsersUnavailableError: handleTechnicalError,
              }),
            );
          }),
        );
    }),
);
