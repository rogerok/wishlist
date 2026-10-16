import { Context, Effect, Layer, Option, Schema } from 'effect';
import { SqlError } from 'effect/sql';
import { sql } from 'kysely';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import type { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  invalidRecordFailed,
  sqlOperationFailed,
} from '#infra/db/repository-failure.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';
import { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

const source = 'usersRepository';

const userSelection = ['id', 'email', 'displayName'] as const;

const getSomeOrNone = (row: unknown, operation: UserOperation) =>
  Option.match(Option.fromUndefinedOr(row), {
    onNone: () => Effect.succeedNone,
    onSome: (some) => decodeRow(some, operation).pipe(Effect.map(Option.some)),
  });

const decodeRow = (row: unknown, operation: UserOperation) =>
  Schema.decodeUnknownEffect(UserResponseSchema)(row).pipe(
    Effect.mapError(invalidRecordFailed(source, operation)),
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

const mapRepoError = (operation: UserOperation) =>
  sqlOperationFailed(source, operation);

export interface UsersRepositoryShape {
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<
    UserResponse,
    OperationFailed | UserEmailAlreadyExistsError
  >;
  readonly getAll: Effect.Effect<ReadonlyArray<UserResponse>, OperationFailed>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<Option.Option<UserResponse>, OperationFailed>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<
    Option.Option<UserResponse>,
    OperationFailed | UserEmailAlreadyExistsError
  >;
  readonly deleteById: (id: UserId) => Effect.Effect<boolean, OperationFailed>;
  readonly getByEmail: (
    id: UserEmail,
  ) => Effect.Effect<Option.Option<UserResponse>, OperationFailed>;
}

export class UsersRepository extends Context.Service<
  UsersRepository,
  UsersRepositoryShape
>()('app/UsersRepository') {}

export const UsersRepositoryLive = Layer.effect(
  UsersRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    const create: UsersRepositoryShape['create'] = (input) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insertInto('users')
          .values(input)
          .onConflict((oc) => oc.expression(sql`lower("email")`).doNothing())
          .returning(userSelection)
          .pipe(Effect.mapError(mapRepoError(UserOperation.create)));

        if (row === undefined) {
          return yield* new UserEmailAlreadyExistsError();
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
            Effect.mapError((cause) =>
              isUsersEmailUniqueViolation(cause)
                ? new UserEmailAlreadyExistsError()
                : mapRepoError(UserOperation.update)(cause),
            ),
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
