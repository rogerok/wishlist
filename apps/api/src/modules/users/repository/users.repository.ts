import { Context, Effect, Layer, Option, Schema } from 'effect';
import { SqlError } from 'effect/unstable/sql';
import { sql } from 'kysely';

import type {
  UsersRepositoryCreateError,
  UsersRepositoryDeleteError,
  UsersRepositoryGetAllError,
  UsersRepositoryGetByIdError,
  UsersRepositoryUpdateError,
} from '#modules/users/repository/users.repository.errors.js';
import type { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import type { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  InvalidUserRecord,
  UserEmailAlreadyExists,
  UsersRepositoryError,
} from '#modules/users/repository/users.repository.errors.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

const decodeUser = Schema.decodeUnknownEffect(UserResponseSchema);
const USERS_EMAIL_LOWER_UNIQUE_INDEX = 'users_email_lower_unique_idx';
const userSelection = [
  'id',
  'email',
  'firstName',
  'lastName',
  'middleName',
] as const;

const isUsersEmailUniqueViolation = (error: unknown): boolean => {
  if (!SqlError.isSqlError(error)) {
    return false;
  }

  return (
    error.reason._tag === 'UniqueViolation' &&
    error.reason.constraint === USERS_EMAIL_LOWER_UNIQUE_INDEX
  );
};

export interface UsersRepositoryShape {
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<UserResponse, UsersRepositoryCreateError>;
  readonly getAll: Effect.Effect<
    ReadonlyArray<UserResponse>,
    UsersRepositoryGetAllError
  >;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryGetByIdError>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryUpdateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<boolean, UsersRepositoryDeleteError>;
}

export class UsersRepository extends Context.Service<
  UsersRepository,
  UsersRepositoryShape
>()('app/UsersRepository') {}

export const UsersRepositoryLive = Layer.effect(
  UsersRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    // TODO: нужна транзакция?
    // TODO: попробовать переписать Command

    const create: UsersRepositoryShape['create'] = (input) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insertInto('users')
          .values(input)
          .onConflict((oc) => oc.doNothing())
          .returning(userSelection)
          .pipe(
            Effect.mapError(
              (cause) =>
                new UsersRepositoryError({
                  cause,
                  operation: UserOperation.create,
                }),
            ),
          );

        if (row === undefined) {
          return yield* new UserEmailAlreadyExists({
            email: input.email,
            operation: UserOperation.create,
          });
        }

        return yield* decodeUser(row).pipe(
          Effect.mapError(
            (cause) =>
              new InvalidUserRecord({
                cause,
                id: row.id,
                operation: UserOperation.create,
              }),
          ),
        );
      });

    const getAll: UsersRepositoryShape['getAll'] = Effect.gen(function* () {
      const rows = yield* db
        .selectFrom('users')
        .select(userSelection)
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .pipe(
          Effect.mapError(
            (cause) =>
              new UsersRepositoryError({
                cause,
                operation: UserOperation.getAll,
              }),
          ),
        );

      return yield* Effect.forEach(rows, (row) =>
        decodeUser(row).pipe(
          Effect.mapError(
            (cause) =>
              new InvalidUserRecord({
                operation: UserOperation.getAll,
                id: row.id,
                cause,
              }),
          ),
        ),
      );
    });

    const getById: UsersRepositoryShape['getById'] = (id) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .selectFrom('users')
          .select(userSelection)
          .where('id', '=', id)
          .limit(1)
          .pipe(
            Effect.mapError(
              (cause) =>
                new UsersRepositoryError({
                  cause,
                  operation: UserOperation.getById,
                }),
            ),
          );

        if (row === undefined) {
          return Option.none();
        }

        const user = yield* decodeUser(row).pipe(
          Effect.mapError(
            (cause) =>
              new InvalidUserRecord({
                cause,
                id,
                operation: UserOperation.getById,
              }),
          ),
        );

        return Option.some(user);
      });
    const update: UsersRepositoryShape['update'] = (id, input) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .updateTable('users')
          .set({ ...input, updatedAt: sql`now()` })
          .where('id', '=', id)
          .returning(userSelection)
          .pipe(
            Effect.mapError((cause) => {
              if (isUsersEmailUniqueViolation(cause)) {
                return new UserEmailAlreadyExists({
                  email: input.email,
                  operation: UserOperation.update,
                });
              }

              return new UsersRepositoryError({
                cause,
                operation: UserOperation.update,
              });
            }),
          );

        if (row === undefined) {
          return Option.none();
        }

        const user = yield* decodeUser(row).pipe(
          Effect.mapError(
            (cause) =>
              new InvalidUserRecord({
                cause,
                id: row.id,
                operation: UserOperation.update,
              }),
          ),
        );

        return Option.some(user);
      });

    const deleteById: UsersRepositoryShape['deleteById'] = (id) =>
      db
        .deleteFrom('users')
        .where('id', '=', id)
        .returning('id')
        .pipe(
          Effect.mapError(
            (cause) =>
              new UsersRepositoryError({
                cause,
                operation: UserOperation.delete,
              }),
          ),
          Effect.map((rows) => !!rows.length),
        );

    return {
      create,
      getAll,
      getById,
      update,
      deleteById,
    };
  }),
);
