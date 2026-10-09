import { layer } from '@effect/vitest';
import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

import { TestDatabaseLive } from '#infra/db/test-database.layer.js';

layer(TestDatabaseLive, { timeout: '60 seconds' })('Auth migrations', (it) => {
  it.effect('cascades auth rows when the user is deleted', () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const userId = '00000000-0000-4000-8000-000000000001';
      const email = 'test@example.test';
      const passwordHash = 'test-password-hash';
      const tokenDigest = Buffer.alloc(32, 0xab);

      // arrange
      yield* sql`
        INSERT INTO "public"."users" ("id", "email", "display_name")
        VALUES (${userId}, ${email}, 'Test User')
      `;

      yield* sql`
        INSERT INTO "public"."password_credentials" (
          "user_id",
          "password_hash"
        )
        VALUES (${userId}, ${passwordHash})
      `;

      yield* sql`
        INSERT INTO "public"."sessions" (
          "user_id",
          "token_digest",
          "expires_at"
        )
        VALUES (
          ${userId},
          ${tokenDigest},
          now() + interval '1 day'
        )
      `;

      // act
      yield* sql`
        DELETE FROM "public"."users"
        WHERE "id" = ${userId}
      `;

      // assert
      const rows = yield* sql<{
        credentialExists: boolean;
        sessionExists: boolean;
      }>`
        SELECT
          EXISTS (
            SELECT 1
            FROM "public"."password_credentials"
            WHERE "user_id" = ${userId}
          ) AS "credentialExists",
          EXISTS (
            SELECT 1
            FROM "public"."sessions"
            WHERE "user_id" = ${userId}
          ) AS "sessionExists"
      `;

      expect(rows).toEqual([{ credentialExists: false, sessionExists: false }]);
    }),
  );

  it.effect('rejects a duplicate Session token digest', () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const userId = '00000000-0000-4000-8000-000000000002';
      const email = 'phase2-duplicate-digest@example.test';
      const tokenDigest = Buffer.alloc(32, 0xcd);

      // arrange
      yield* sql`
        INSERT INTO "public"."users" ("id", "email", "display_name")
        VALUES (${userId}, ${email}, 'Test User')
      `;

      yield* sql`
        INSERT INTO "public"."sessions" (
          "user_id",
          "token_digest",
          "expires_at"
        )
        VALUES (
          ${userId},
          ${tokenDigest},
          now() + interval '1 day'
        )
      `;

      // act
      const error = yield* Effect.flip(
        sql`
          INSERT INTO "public"."sessions" (
            "user_id",
            "token_digest",
            "expires_at"
          )
          VALUES (
            ${userId},
            ${tokenDigest},
            now() + interval '1 day'
          )
        `,
      );

      // assert
      expect(error.reason._tag).toBe('UniqueViolation');

      if (error.reason._tag === 'UniqueViolation') {
        expect(error.reason.constraint).toBe('sessions_token_digest_key');
      }

      const sessions = yield* sql<{ id: string }>`
        SELECT "id"
        FROM "public"."sessions"
        WHERE "token_digest" = ${tokenDigest}
      `;

      expect(sessions).toHaveLength(1);

      // cleanup
      yield* sql`
        DELETE FROM "public"."users"
        WHERE "id" = ${userId}
      `;
    }),
  );

  it.effect('rejects a second Password Credential for the same user', () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const userId = '00000000-0000-4000-8000-000000000003';
      const email = 'phase2-duplicate-credential@example.test';
      const firstPasswordHash = 'first-test-password-hash';
      const secondPasswordHash = 'second-test-password-hash';

      // arrange
      yield* sql`
        INSERT INTO "public"."users" ("id", "email", "display_name")
        VALUES (${userId}, ${email}, 'Test User')
      `;

      yield* sql`
        INSERT INTO "public"."password_credentials" (
          "user_id",
          "password_hash"
        )
        VALUES (${userId}, ${firstPasswordHash})
      `;

      // act
      const error = yield* Effect.flip(
        sql`
          INSERT INTO "public"."password_credentials" (
            "user_id",
            "password_hash"
          )
          VALUES (${userId}, ${secondPasswordHash})
        `,
      );

      // assert
      expect(error.reason._tag).toBe('UniqueViolation');

      if (error.reason._tag === 'UniqueViolation') {
        expect(error.reason.constraint).toBe('password_credentials_pkey');
      }

      const credentials = yield* sql<{ passwordHash: string }>`
        SELECT "password_hash" AS "passwordHash"
        FROM "public"."password_credentials"
        WHERE "user_id" = ${userId}
      `;

      expect(credentials).toEqual([{ passwordHash: firstPasswordHash }]);

      // cleanup
      yield* sql`
        DELETE FROM "public"."users"
        WHERE "id" = ${userId}
      `;
    }),
  );

  it.effect('rejects Session rows that violate storage invariants', () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const userId = '00000000-0000-4000-8000-000000000004';
      const email = 'phase2-invalid-session@example.test';

      const validCreatedAt = new Date('2026-01-01T00:00:00.000Z');
      const validExpiresAt = new Date('2026-01-02T00:00:00.000Z');

      const invalidSessionCases = [
        {
          name: '31-byte token digest',
          tokenDigest: Buffer.alloc(31, 0xef),
          createdAt: validCreatedAt,
          expiresAt: validExpiresAt,
        },
        {
          name: 'non-positive Session lifetime',
          tokenDigest: Buffer.alloc(32, 0x12),
          createdAt: validCreatedAt,
          expiresAt: validCreatedAt,
        },
      ] as const;

      // arrange
      yield* sql`
        INSERT INTO "public"."users" ("id", "email", "display_name")
        VALUES (${userId}, ${email}, 'Test User')
      `;

      // act and assert
      for (const invalidSession of invalidSessionCases) {
        const error = yield* Effect.flip(
          sql`
            INSERT INTO "public"."sessions" (
              "user_id",
              "token_digest",
              "created_at",
              "expires_at"
            )
            VALUES (
              ${userId},
              ${invalidSession.tokenDigest},
              ${invalidSession.createdAt},
              ${invalidSession.expiresAt}
            )
          `,
        );

        expect(error.reason._tag, invalidSession.name).toBe('ConstraintError');
      }

      const sessions = yield* sql<{ id: string }>`
        SELECT "id"
        FROM "public"."sessions"
        WHERE "user_id" = ${userId}
      `;

      expect(sessions).toEqual([]);

      // cleanup
      yield* sql`
        DELETE FROM "public"."users"
        WHERE "id" = ${userId}
      `;
    }),
  );
});
