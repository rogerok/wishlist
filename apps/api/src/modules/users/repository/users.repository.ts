import { desc, eq } from 'drizzle-orm';
import {
  Cause,
  Context,
  Effect,
  Layer,
  Option,
  Predicate,
  Schema,
} from 'effect';
import { SqlError } from 'effect/unstable/sql';

import { DB } from '#db/db.service.js';
import { users } from '#db/schema/users.js';
import {
  makeInvalidUserRecordError,
  makeUserEmailAlreadyExistsError,
  makeUsersRepositoryError,
  UsersRepositoryCreateError,
  UsersRepositoryDeleteError,
  UsersRepositoryGetAllError,
  UsersRepositoryGetByIdError,
  UsersRepositoryUpdateError,
} from '#modules/users/repository/users.repository.errors.js';
import { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBody } from '#modules/users/schemas/update-user.schema.js';
import {
  UserResponse,
  UserResponseSchema,
} from '#modules/users/schemas/user-response.schema.js';
import { UserId } from '#modules/users/schemas/user.schema.js';

const decodeUser = Schema.decodeUnknownEffect(UserResponseSchema);

const userSelection = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  middleName: users.middleName,
} as const;

const isUsersEmailUniqueViolation = (error: unknown): boolean => {
  if (!Predicate.hasProperty(error, 'cause') || !Cause.isCause(error.cause)) {
    return false;
  }

  return error.cause.reasons.some(
    (reason) =>
      Cause.isFailReason(reason) &&
      SqlError.isSqlError(reason.error) &&
      reason.error.reason._tag === 'UniqueViolation' &&
      reason.error.reason.constraint === 'users_email_key',
  );
};

export interface UsersRepositoryShape {
  readonly getAll: Effect.Effect<
    ReadonlyArray<UserResponse>,
    UsersRepositoryGetAllError
  >;
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<UserResponse, UsersRepositoryCreateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<boolean, UsersRepositoryDeleteError>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryGetByIdError>;
  readonly update: (
    id: UserId,
    input: UpdateUserBody,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryUpdateError>;
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

    const create: UsersRepositoryShape['create'] = (input) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insert(users)
          .values(input)
          .onConflictDoNothing({
            target: users.email,
          })
          .returning(userSelection)
          .pipe(
            Effect.mapError((cause) =>
              makeUsersRepositoryError({ cause, operation: 'create' }),
            ),
          );

        if (row === undefined) {
          return yield* makeUserEmailAlreadyExistsError({
            email: input.email,
            operation: 'create',
          });
        }

        return yield* decodeUser(row).pipe(
          Effect.mapError((cause) =>
            makeInvalidUserRecordError({
              cause,
              id: row.id,
              operation: 'create',
            }),
          ),
        );
      });

    const update: UsersRepositoryShape['update'] = (id, input) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .update(users)
          .set(input)
          .where(eq(users.id, id))
          .returning(userSelection)
          .pipe(
            Effect.mapError((cause) =>
              isUsersEmailUniqueViolation(cause)
                ? makeUserEmailAlreadyExistsError({
                    email: input.email,
                    operation: 'update',
                  })
                : makeUsersRepositoryError({ cause, operation: 'update' }),
            ),
          );

        if (row === undefined) {
          return Option.none();
        }

        const user = yield* decodeUser(row).pipe(
          Effect.mapError((cause) =>
            makeInvalidUserRecordError({
              cause,
              id: row.id,
              operation: 'update',
            }),
          ),
        );

        return Option.some(user);
      });

    const getAll: UsersRepositoryShape['getAll'] = db
      .select(userSelection)
      .from(users)
      .orderBy(desc(users.createdAt), desc(users.id))
      .pipe(
        Effect.mapError((cause) =>
          makeUsersRepositoryError({ cause, operation: 'getAll' }),
        ),
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeUser(row).pipe(
              Effect.mapError((cause) =>
                makeInvalidUserRecordError({
                  cause,
                  id: row.id,
                  operation: 'getAll',
                }),
              ),
            ),
          ),
        ),
      );

    const getById: UsersRepositoryShape['getById'] = (id) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .select(userSelection)
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
          .pipe(
            Effect.mapError((cause) =>
              makeUsersRepositoryError({
                cause,
                operation: 'getById',
              }),
            ),
          );

        if (row === undefined) {
          return Option.none();
        }

        const user = yield* decodeUser(row).pipe(
          Effect.mapError((cause) =>
            makeInvalidUserRecordError({
              cause,
              id,
              operation: 'getById',
            }),
          ),
        );

        return Option.some(user);
      });

    const deleteById: UsersRepositoryShape['deleteById'] = (id) =>
      db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id })
        .pipe(
          Effect.mapError((cause) =>
            makeUsersRepositoryError({ cause, operation: 'delete' }),
          ),
          Effect.map((rows) => !!rows.length),
        );

    return {
      getAll,
      getById,
      deleteById,
      create,
      update,
    };
  }),
);
