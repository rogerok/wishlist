import { Context, Effect, Layer, Option, Schema } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { StoredPasswordHash } from '#modules/auth/schemas/password/password-hash.schema.js';
import type { PasswordCredentials } from '#modules/auth/schemas/password/password.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  invalidRecordFailed,
  sqlOperationFailed,
} from '#infra/db/repository-failure.js';
import { PasswordCredentialsAlreadyExists } from '#modules/auth/repository/password/password-credential.repository.errors.js';
import { PasswordCredentialsOperations } from '#modules/auth/schemas/password/password-credentials-operations.schema.js';
import { PasswordCredentialsSchema } from '#modules/auth/schemas/password/password.schema.js';

const source = 'passwordCredentialsRepository';

const decodePasswordCredentials = (
  row: unknown,
  operation: PasswordCredentialsOperations,
) =>
  Schema.decodeUnknownEffect(PasswordCredentialsSchema)(row).pipe(
    Effect.mapError(invalidRecordFailed(source, operation)),
  );

interface PasswordCredentialsRepositoryShape {
  create: (
    userId: UserId,
    passwordHash: StoredPasswordHash,
  ) => Effect.Effect<
    PasswordCredentials,
    OperationFailed | PasswordCredentialsAlreadyExists
  >;
  getByUserId: (
    userId: UserId,
  ) => Effect.Effect<Option.Option<PasswordCredentials>, OperationFailed>;
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
              sqlOperationFailed(source, PasswordCredentialsOperations.create),
            ),
          );

        if (row === undefined) {
          return yield* new PasswordCredentialsAlreadyExists({
            operation: PasswordCredentialsOperations.create,
          });
        }

        return yield* decodePasswordCredentials(
          row,
          PasswordCredentialsOperations.create,
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
              sqlOperationFailed(
                source,
                PasswordCredentialsOperations.getByIdUserId,
              ),
            ),
          );

        if (row === undefined) {
          return Option.none();
        }

        const passwordCredentials = yield* decodePasswordCredentials(
          row,
          PasswordCredentialsOperations.getByIdUserId,
        );

        return Option.some(passwordCredentials);
      });

    return { create, getByUserId };
  }),
);
