import { eq } from 'drizzle-orm';
import { Context, Effect, Layer, Option, Schema } from 'effect';

import { DB } from '#db/db.service.js';
import { users } from '#db/schema/users.js';
import { UserPersistenceError } from '#modules/users/repository/users-repository.errors.js';
import {
  UserResponse,
  UserResponseSchema,
} from '#modules/users/schemas/user-response.schema.js';
import { UserId } from '#modules/users/schemas/user.schema.js';

export type UserRecord = typeof users.$inferSelect;

const decodeUser = Schema.decodeUnknownEffect(UserResponseSchema);

export interface UsersRepositoryShape {
  readonly getAll: () => Effect.Effect<
    ReadonlyArray<UserRecord>,
    UserPersistenceError
  >;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<Option.Option<UserResponse>, UserPersistenceError>;
}

export class UsersRepository extends Context.Service<
  UsersRepository,
  UsersRepositoryShape
>()('app/UsersRepository') {}

export const UsersRepositoryLive = Layer.effect(
  UsersRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    const getById: UsersRepositoryShape['getById'] = (id) =>
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          middleName: users.middleName,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
        .pipe(
          Effect.mapError(
            (cause) =>
              new UserPersistenceError({
                cause,
                operation: 'getById',
              }),
          ),
          Effect.flatMap(([row]) => {
            if (row === undefined) {
              return Effect.succeed(Option.none<UserResponse>());
            }

            return decodeUser(row).pipe(
              Effect.map(Option.some),
              Effect.mapError(
                (cause) =>
                  new UserPersistenceError({
                    operation: 'getById',
                    cause,
                  }),
              ),
            );
          }),
        );

    const getAll: UsersRepositoryShape['getAll'] = () =>
      db
        .select()
        .from(users)
        .pipe(
          Effect.mapError(
            (cause) =>
              new UserPersistenceError({
                cause,
                operation: 'getAll',
              }),
          ),
        );

    return { getById, getAll };
  }),
);
