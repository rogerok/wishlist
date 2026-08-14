import { desc, eq } from 'drizzle-orm';
import { Context, Effect, Layer, Option, Schema } from 'effect';

import { DB } from '#db/db.service.js';
import { users } from '#db/schema/users.js';
import {
  InvalidUserRecord,
  UserEmailAlreadyExists,
  UserRepositoryCreateError,
  UsersRepositoryError,
  UsersRepositoryGetAllError,
  UsersRepositoryGetByIdError,
} from '#modules/users/repository/users.repository.errors.js';
import { CreateUserBody } from '#modules/users/schemas/create-user.schema.js';
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
};

export interface UsersRepositoryShape {
  readonly getAll: Effect.Effect<
    ReadonlyArray<UserResponse>,
    UsersRepositoryGetAllError
  >;
  readonly create: (
    input: CreateUserBody,
  ) => Effect.Effect<UserResponse, UserRepositoryCreateError>;
  readonly deleteById: (
    id: UserId,
  ) => Effect.Effect<boolean, UsersRepositoryError>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<Option.Option<UserResponse>, UsersRepositoryGetByIdError>;
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
            Effect.mapError(
              (cause) =>
                new UsersRepositoryError({
                  cause,
                  operation: 'create',
                }),
            ),
          );

        if (row === undefined) {
          return yield* new UserEmailAlreadyExists({
            email: input.email,
            operation: 'create',
          });
        }

        return yield* decodeUser(row).pipe(
          Effect.mapError(
            (cause) =>
              new InvalidUserRecord({
                cause,
                id: row.id,
                operation: 'create',
              }),
          ),
        );
      });

    const getAll: UsersRepositoryShape['getAll'] = db
      .select(userSelection)
      .from(users)
      .orderBy(desc(users.createdAt), desc(users.id))
      .pipe(
        Effect.mapError(
          (cause) => new UsersRepositoryError({ cause, operation: 'getAll' }),
        ),
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeUser(row).pipe(
              Effect.mapError(
                (cause) =>
                  new InvalidUserRecord({
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
            Effect.mapError(
              (cause) =>
                new UsersRepositoryError({
                  cause,
                  operation: 'getById',
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
          Effect.mapError(
            (cause) => new UsersRepositoryError({ cause, operation: 'delete' }),
          ),
          Effect.map((rows) => !!rows.length),
        );

    return {
      getAll,
      getById,
      deleteById,
      create,
    };
  }),
);
