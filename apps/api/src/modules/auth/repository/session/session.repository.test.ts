import { describe, layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { SessionTokenDigestAlreadyExistsError } from '#modules/auth/repository/session/session.repository.errors.js';
import {
  type UserEmail,
  UserEmailSchema,
  type UserId,
  UserIdSchema,
} from '#modules/users/schemas/user.schema.js';

const createDeleteUser = (id: UserId, email: UserEmail) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    yield* Effect.acquireRelease(
      sql`
        INSERT INTO "public"."users" ("id", "email")
        VALUES (${id}, ${email})
      `,
      () =>
        sql`DELETE
            FROM "public"."users"
            WHERE "id" = ${id}`.pipe(Effect.orDie),
    );
  });

const DbLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const repoLayer = SessionRepositoryLive.pipe(Layer.provideMerge(DbLayer));

const digest = Buffer.alloc(32, 0x22);
const digest2 = Buffer.alloc(32, 0x20);

const userId = UserIdSchema.make('f26699b7-6a55-4971-aecc-aac8d2474e35');
const userEmail = UserEmailSchema.make('test@example.test');
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

describe('SessionRepository', () => {
  layer(repoLayer, { timeout: '60 seconds' })((it) => {
    it.effect(
      'deletes only the matching session and allows repeated deletion',
      () =>
        Effect.gen(function* () {
          const repo = yield* SessionRepository;

          yield* createDeleteUser(userId, userEmail);

          yield* repo.create(userId, digest, expiresAt);
          const createdSession2 = yield* repo.create(
            userId,
            digest2,
            expiresAt,
          );

          yield* repo.deleteByTokenDigest(digest);

          const session = yield* repo.getByTokenDigest(digest);
          expect(session).toBeOptionNone();

          expect(yield* repo.getByTokenDigest(digest2)).toBeOptionSome({
            userId,
            expiresAt,
            id: createdSession2.id,
            createdAt: createdSession2.createdAt,
          });

          yield* repo.deleteByTokenDigest(digest);

          expect(yield* repo.getByTokenDigest(digest2)).toBeOptionSome({
            userId,
            expiresAt,
            id: createdSession2.id,
            createdAt: createdSession2.createdAt,
          });
        }),
    );

    it.effect(
      'rejects a duplicate token digest without changing the existing session',
      () =>
        Effect.gen(function* () {
          const repo = yield* SessionRepository;
          yield* createDeleteUser(userId, userEmail);

          const session = yield* repo.create(userId, digest, expiresAt);

          const result = yield* Effect.flip(
            repo.create(userId, digest, expiresAt),
          );
          expect(result).toBeInstanceOf(SessionTokenDigestAlreadyExistsError);

          const session2 = yield* repo.getByTokenDigest(digest);
          expect(session2).toBeOptionSome(session);
        }),
    );
  });
});
