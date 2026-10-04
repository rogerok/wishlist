import { Context, Effect, Layer, Option, Schema } from 'effect';
import { SqlError } from 'effect/unstable/sql';
import { sql } from 'kysely';

import type {
  UsersRepositoryCreateError,
  UsersRepositoryDeleteError,
  UsersRepositoryGetAllError,
  UsersRepositoryGetByError,
  UsersRepositoryUpdateError,
} from '#modules/users/repository/users.repository.errors.js';
import type { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import type { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  UserEmailAlreadyExists,
  UserInvalidRecord,
  UsersRepositoryError,
} from '#modules/users/repository/users.repository.errors.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

const userSelection = [
  'id',
  'email',
  'firstName',
  'lastName',
  'middleName',
] as const;

const getSomeOrNone = (row: unknown, operation: UserOperation) =>
  Option.match(Option.fromUndefinedOr(row), {
    onNone: () => Effect.succeedNone,
    onSome: (some) => decodeRow(some, operation).pipe(Effect.map(Option.some)),
  });

const decodeRow = (row: unknown, operation: UserOperation) =>
  Schema.decodeUnknownEffect(UserResponseSchema)(row).pipe(
    Effect.mapError((cause) => new UserInvalidRecord({ cause, operation })),
  );

const isUsersEmailUniqueViolation = (error: unknown): boolean => {
  if (!SqlError.isSqlError(error)) {
    return false;
  }

  return (
    error.reason._tag === 'UniqueViolation' &&
    error.reason.constraint === 'users_email_lower_unique_idx'
  );
};

const mapRepoError = (operation: UserOperation) => (cause: SqlError.SqlError) =>
  new UsersRepositoryError({ cause, operation });

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
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryGetByError>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryUpdateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<boolean, UsersRepositoryDeleteError>;
  readonly getByEmail: (
    id: UserEmail,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryGetByError>;
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
          .onConflict((oc) => oc.expression(sql`lower("email")`).doNothing())
          .returning(userSelection)
          .pipe(Effect.mapError(mapRepoError(UserOperation.create)));

        if (row === undefined) {
          return yield* new UserEmailAlreadyExists({
            email: input.email,
            operation: UserOperation.create,
          });
        }

        return yield* decodeRow(row, UserOperation.create);
      });

    const getAll: UsersRepositoryShape['getAll'] = Effect.gen(function* () {
      const rows = yield* db
        .selectFrom('users')
        .select(userSelection)
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .pipe(Effect.mapError(mapRepoError(UserOperation.getAll)));

      return yield* Effect.forEach(rows, (row) =>
        decodeRow(row, UserOperation.getAll),
      );
    });

    const getById: UsersRepositoryShape['getById'] = (id) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .selectFrom('users')
          .select(userSelection)
          .where('id', '=', id)
          .limit(1)
          .pipe(Effect.mapError(mapRepoError(UserOperation.getById)));

        return yield* getSomeOrNone(row, UserOperation.getById);
      });

    const getByEmail: UsersRepositoryShape['getByEmail'] = (email) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .selectFrom('users')
          .select(userSelection)
          .where('email', '=', email)
          .limit(1)
          .pipe(Effect.mapError(mapRepoError(UserOperation.getByEmail)));

        return yield* getSomeOrNone(row, UserOperation.getByEmail);
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

              return mapRepoError(UserOperation.update)(cause);
            }),
          );

        return yield* getSomeOrNone(row, UserOperation.update);
      });

    const deleteById: UsersRepositoryShape['deleteById'] = (id) =>
      db
        .deleteFrom('users')
        .where('id', '=', id)
        .returning('id')
        .pipe(
          Effect.mapError(mapRepoError(UserOperation.delete)),
          Effect.map((rows) => !!rows.length),
        );

    return {
      create,
      getAll,
      getById,
      update,
      deleteById,
      getByEmail,
    };
  }),
);
