import { Context, Effect, Layer } from 'effect';

import type { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import type { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type {
  UserServiceDeleteByIdError,
  UserServiceUpdateError,
  UsersServiceCreateError,
  UsersServiceGetAllError,
  UsersServiceGetByIdError,
} from '#modules/users/service/users.service.errors.js';

import { UsersRepository } from '#modules/users/repository/users.repository.js';
import {
  UserDataIntegrityError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
  UsersUnavailableError,
} from '#modules/users/service/users.service.errors.js';

export interface UsersServiceShape {
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<UserResponse, UsersServiceCreateError>;
  readonly getAll: Effect.Effect<
    ReadonlyArray<UserResponse>,
    UsersServiceGetAllError
  >;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<UserResponse, UsersServiceGetByIdError>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<UserResponse, UserServiceUpdateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<void, UserServiceDeleteByIdError>;
}

export class UsersService extends Context.Service<
  UsersService,
  UsersServiceShape
>()('app/UsersService') {}

export const UsersServiceLive = Layer.effect(
  UsersService,
  Effect.gen(function* () {
    const repository = yield* UsersRepository;

    const create: UsersServiceShape['create'] = (input) =>
      repository.create(input).pipe(
        Effect.catchTags({
          InvalidUserRecord: (cause) => new UserDataIntegrityError({ cause }),
          UsersRepositoryError: (cause) => new UsersUnavailableError({ cause }),
          UserEmailAlreadyExists: (cause) =>
            new UserEmailAlreadyExistsError({ email: input.email, cause }),
        }),
      );

    const getAll: UsersServiceShape['getAll'] = repository.getAll.pipe(
      Effect.catchTags({
        InvalidUserRecord: (cause) => new UserDataIntegrityError({ cause }),
        UsersRepositoryError: (cause) => new UsersUnavailableError({ cause }),
      }),
    );

    const getById: UsersServiceShape['getById'] = (id) =>
      Effect.gen(function* () {
        const option = yield* repository.getById(id).pipe(
          Effect.catchTags({
            InvalidUserRecord: (cause) => new UserDataIntegrityError({ cause }),
            UsersRepositoryError: (cause) =>
              new UsersUnavailableError({ cause }),
          }),
        );

        return yield* Effect.fromOption(
          option,
          () => new UserNotFoundError({ id }),
        );
      });

    const update: UsersServiceShape['update'] = (id, input) =>
      Effect.gen(function* () {
        const option = yield* repository.update(id, input).pipe(
          Effect.catchTags({
            InvalidUserRecord: (cause) => new UserDataIntegrityError({ cause }),
            UsersRepositoryError: (cause) =>
              new UsersUnavailableError({ cause }),
            UserEmailAlreadyExists: (cause) =>
              new UserEmailAlreadyExistsError({ email: input.email, cause }),
          }),
        );

        return yield* Effect.fromOption(
          option,
          () => new UserNotFoundError({ id }),
        );
      });

    const deleteById: UsersServiceShape['deleteById'] = (id) =>
      Effect.gen(function* () {
        const deleted = yield* repository
          .deleteById(id)
          .pipe(
            Effect.mapError((cause) => new UsersUnavailableError({ cause })),
          );

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
