import { Context, Effect, Layer, Option, Schema } from 'effect';

import type {
  PasswordCredentialsCreateError,
  PasswordCredentialsGetByIdError,
} from '#modules/auth/repository/password-credential.repository.errors.js';
import type { PasswordCredentials } from '#modules/auth/schemas/password/password.schema.js';
import type { StoredPasswordHash } from '#modules/auth/service/password-hash-format.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import { PasswordCredentialsInvalidRecord } from '#modules/auth/repository/password-credential.repository.errors.js';
import {
  PasswordCredentialsAlreadyExists,
  PasswordCredentialsRepositoryError,
} from '#modules/auth/repository/password-credential.repository.errors.js';
import { PasswordCredentialsOperation } from '#modules/auth/schemas/password-credentials-operations.schema.js';
import { PasswordCredentialsSchema } from '#modules/auth/schemas/password/password.schema.js';

const decodePasswordCredentials = Schema.decodeUnknownEffect(
  PasswordCredentialsSchema,
);

interface PasswordCredentialsRepositoryShape {
  create: (
    userId: UserId,
    passwordHash: StoredPasswordHash,
  ) => Effect.Effect<PasswordCredentials, PasswordCredentialsCreateError>;
  getByUserId: (
    userId: UserId,
  ) => Effect.Effect<
    Option.Option<PasswordCredentials>,
    PasswordCredentialsGetByIdError
  >;
}

export class PasswordCredentialsRepository extends Context.Service<
  PasswordCredentialsRepository,
  PasswordCredentialsRepositoryShape
>()('app/PasswordCredentialsRepository') {}

export const PasswordCredentialsRepositoryLive = Layer.effect(
  PasswordCredentialsRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    const create: PasswordCredentialsRepositoryShape['create'] = (
      userId,
      passwordHash,
    ) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insertInto('passwordCredentials')
          .values({ userId, passwordHash })
          .onConflict((oc) => oc.column('userId').doNothing())
          .returningAll()
          .pipe(
            Effect.mapError(
              (cause) =>
                new PasswordCredentialsRepositoryError({
                  cause,
                  operation: PasswordCredentialsOperation.create,
                }),
            ),
          );

        if (row === undefined) {
          return yield* new PasswordCredentialsAlreadyExists({
            operation: PasswordCredentialsOperation.create,
          });
        }

        return yield* decodePasswordCredentials(row).pipe(
          Effect.mapError(
            (cause) =>
              new PasswordCredentialsInvalidRecord({
                cause,
                operation: PasswordCredentialsOperation.create,
              }),
          ),
        );
      });

    const getByUserId: PasswordCredentialsRepositoryShape['getByUserId'] = (
      userId,
    ) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .selectFrom('passwordCredentials')
          .selectAll()
          .where('userId', '=', userId)
          .limit(1)
          .pipe(
            Effect.mapError(
              (cause) =>
                new PasswordCredentialsRepositoryError({
                  cause,
                  operation: PasswordCredentialsOperation.getByIdUserId,
                }),
            ),
          );

        if (row === undefined) {
          return Option.none();
        }

        const passwordCredentials = yield* decodePasswordCredentials(row).pipe(
          Effect.mapError(
            (cause) =>
              new PasswordCredentialsInvalidRecord({
                cause,
                operation: PasswordCredentialsOperation.getByIdUserId,
              }),
          ),
        );

        return Option.some(passwordCredentials);
      });

    return { create, getByUserId };
  }),
);
