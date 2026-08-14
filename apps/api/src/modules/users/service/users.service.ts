import { Context, Effect, Layer } from 'effect';

import { UsersRepository } from '#modules/users/repository/users.repository.js';
import { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import { UserId } from '#modules/users/schemas/user.schema.js';
import {
  makeUserDataIntegrityError,
  makeUserEmailAlreadyExistsError,
  makeUserNotFoundError,
  makeUsersUnavailableError,
  UserServiceDeleteByIdError,
  UsersServiceCreateError,
  UsersServiceGetAllError,
  UsersServiceGetByIdError,
} from '#modules/users/service/users.service.errors.js';

export interface UsersServiceShape {
  readonly getAll: Effect.Effect<
    ReadonlyArray<UserResponse>,
    UsersServiceGetAllError
  >;
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<UserResponse, UsersServiceCreateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<void, UserServiceDeleteByIdError>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<UserResponse, UsersServiceGetByIdError>;
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
          InvalidUserRecord: makeUserDataIntegrityError,
          UsersRepositoryError: makeUsersUnavailableError,
          UserEmailAlreadyExists: (cause) =>
            makeUserEmailAlreadyExistsError(input.email, cause),
        }),
      );

    const getById: UsersServiceShape['getById'] = (id) =>
      repository.getById(id).pipe(
        Effect.catchTags({
          InvalidUserRecord: makeUserDataIntegrityError,
          UsersRepositoryError: makeUsersUnavailableError,
        }),
        Effect.flatMap(Effect.fromOption(() => makeUserNotFoundError(id))),
      );

    const getAll: UsersServiceShape['getAll'] = repository.getAll.pipe(
      Effect.catchTags({
        InvalidUserRecord: makeUserDataIntegrityError,
        UsersRepositoryError: makeUsersUnavailableError,
      }),
    );

    const deleteById: UsersServiceShape['deleteById'] = (id: UserId) =>
      repository.deleteById(id).pipe(
        Effect.mapError(makeUsersUnavailableError),
        Effect.flatMap((deleted) =>
          deleted ? Effect.void : makeUserNotFoundError(id),
        ),
      );

    return {
      create,
      deleteById,
      getAll,
      getById,
    };
  }),
);
