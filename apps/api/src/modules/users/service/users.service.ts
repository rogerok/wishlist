import { Context, Effect, Layer } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import type { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

import { UsersRepository } from '#modules/users/repository/users.repository.js';
import { UserNotFoundError } from '#modules/users/users.errors.js';

export interface UsersServiceShape {
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<
    UserResponse,
    OperationFailed | UserEmailAlreadyExistsError
  >;
  readonly getAll: Effect.Effect<ReadonlyArray<UserResponse>, OperationFailed>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<UserResponse, OperationFailed | UserNotFoundError>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<
    UserResponse,
    OperationFailed | UserEmailAlreadyExistsError | UserNotFoundError
  >;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<void, OperationFailed | UserNotFoundError>;
}

export class UsersService extends Context.Service<
  UsersService,
  UsersServiceShape
>()('app/UsersService') {}

export const UsersServiceLive = Layer.effect(
  UsersService,
  Effect.gen(function* () {
    const repository = yield* UsersRepository;

    const create: UsersServiceShape['create'] = repository.create;

    const getAll: UsersServiceShape['getAll'] = repository.getAll;

    const getById: UsersServiceShape['getById'] = (id) =>
      Effect.gen(function* () {
        const option = yield* repository.getById(id);

        return yield* Effect.fromOption(
          option,
          () => new UserNotFoundError({ id }),
        );
      });

    const update: UsersServiceShape['update'] = (id, input) =>
      Effect.gen(function* () {
        const option = yield* repository.update(id, input);

        return yield* Effect.fromOption(
          option,
          () => new UserNotFoundError({ id }),
        );
      });

    const deleteById: UsersServiceShape['deleteById'] = (id) =>
      Effect.gen(function* () {
        const deleted = yield* repository.deleteById(id);

        if (!deleted) {
          return yield* new UserNotFoundError({ id });
        }
      });

    return {
      create,
      getAll,
      getById,
      update,
      deleteById,
    };
  }),
);
