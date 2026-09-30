import { describe, expect, layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

import type { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  PasswordCredentialsAlreadyExists,
  PasswordCredentialsInvalidRecord,
  PasswordCredentialsRepositoryError,
} from '#modules/auth/repository/password/password-credential.repository.errors.js';
import {
  PasswordCredentialsRepository,
  PasswordCredentialsRepositoryLive,
} from '#modules/auth/repository/password/password-credentials.repository.js';
import { serializePasswordHash } from '#modules/auth/service/password/password-hash-format.js';
import {
  UserEmailSchema,
  UserIdSchema,
} from '#modules/users/schemas/user.schema.js';

const uuid = 'f26699b7-6a55-4971-aecc-aac8d2474e35';
const email = 'test@example.test';
const salt = Buffer.alloc(16, 0x11);
const derivedKey = Buffer.alloc(32, 0x22);
const DbLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));

const repoLayer = PasswordCredentialsRepositoryLive.pipe(
  Layer.provideMerge(DbLayer),
);

const createDeleteUser = (id: UserId, email: UserEmail) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    yield* Effect.acquireRelease(
      sql`
        INSERT INTO "public"."users" ("id", "email")
        VALUES (${id}, ${email})
      `,
      () =>
        sql`DELETE FROM "public"."users" WHERE "id" = ${id}`.pipe(Effect.orDie),
    );
  });

describe('PasswordCredentialsRepository', () => {
  layer(repoLayer, { timeout: '60 seconds' })(
    'PasswordCredentialsRepository',
    (it) => {
      it.effect('loads credentials saved for the user', () =>
        Effect.gen(function* () {
          const hash = yield* serializePasswordHash(salt, derivedKey);
          const userId = UserIdSchema.make(uuid);
          const userEmail = UserEmailSchema.make(email);

          yield* createDeleteUser(userId, userEmail);

          const repo = yield* PasswordCredentialsRepository;
          yield* repo.create(userId, hash);
          const loaded = yield* repo.getByUserId(userId);

          expect(loaded).toBeOptionSome({ userId, passwordHash: hash });
        }),
      );

      it.effect('returns None when the user has no password credentials', () =>
        Effect.gen(function* () {
          const userId = UserIdSchema.make(
            'f26699b7-6a55-4971-aecc-aac8d2474e22',
          );
          const userEmail = UserEmailSchema.make('test2@example.com');

          yield* createDeleteUser(userId, userEmail);

          const repo = yield* PasswordCredentialsRepository;
          const loaded = yield* repo.getByUserId(userId);

          expect(loaded).toBeOptionNone();
        }),
      );

      it.effect(
        'rejects duplicate credentials without changing the stored hash.',
        () =>
          Effect.gen(function* () {
            const userId = UserIdSchema.make(uuid);
            const userEmail = UserEmailSchema.make(email);
            const salt2 = Buffer.alloc(16, 0x10);
            const derivedKey2 = Buffer.alloc(32, 0x20);
            const hash = yield* serializePasswordHash(salt, derivedKey);
            const hash2 = yield* serializePasswordHash(salt2, derivedKey2);

            yield* createDeleteUser(userId, userEmail);

            const repo = yield* PasswordCredentialsRepository;
            yield* repo.create(userId, hash);
            const secondCreate = yield* Effect.result(
              repo.create(userId, hash2),
            );

            expect(secondCreate).toBeResultFailure(
              PasswordCredentialsAlreadyExists,
              {},
            );

            const passCreds = yield* repo.getByUserId(userId);

            expect(passCreds).toBeOptionSome({ userId, passwordHash: hash });
          }),
      );

      it.effect('rejects a stored password hash with an invalid format', () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          const userId = UserIdSchema.make(uuid);
          const userEmail = UserEmailSchema.make(email);

          yield* createDeleteUser(userId, userEmail);

          yield* sql`INSERT INTO "public"."password_credentials" ("user_id", "password_hash") VALUES (${userId}, 'broken')`;

          const repo = yield* PasswordCredentialsRepository;
          const result = yield* Effect.result(repo.getByUserId(userId));

          expect(result).toBeResultFailure(
            PasswordCredentialsInvalidRecord,
            {},
          );
        }),
      );

      it.effect('rejects credentials for a nonexistent user', () =>
        Effect.gen(function* () {
          const userId = UserIdSchema.make(
            'f26699b7-6a55-4971-aecc-aac8d2474e77',
          );
          const hash = yield* serializePasswordHash(salt, derivedKey);

          const repo = yield* PasswordCredentialsRepository;
          const result = yield* Effect.result(repo.create(userId, hash));

          expect(result).toBeResultFailure(
            PasswordCredentialsRepositoryError,
            {},
          );
        }),
      );
    },
  );
});
