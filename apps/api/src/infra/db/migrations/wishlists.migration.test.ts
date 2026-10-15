import type { SqlError } from 'effect/sql/SqlError';

import { PgMigrator } from '@effect/sql-pg';
import { describe, expect, layer } from '@effect/vitest';
import { Effect, Predicate } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

import initialMigration from '#infra/db/migrations/0001_initial.js';
import authMigration from '#infra/db/migrations/0002_auth.js';
import displayNameMigration from '#infra/db/migrations/0003_display_name.js';
import {
  EmptyTestDatabaseLive,
  migrationsDir,
  TestDatabaseLive,
} from '#infra/db/test-database.layer.js';

// Что именно отклонил PostgreSQL: код SQLSTATE и имя ограничения либо колонки.
const rejectionOf = (error: SqlError) => {
  const cause: unknown = Predicate.hasProperty(error.reason, 'cause')
    ? error.reason.cause
    : undefined;
  const read = (key: string) =>
    Predicate.hasProperty(cause, key) ? cause[key] : undefined;

  return {
    code: read('code'),
    constraint: read('constraint'),
    column: read('column'),
  };
};

const insertUser = (email: string, displayName: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const [user] = yield* sql<{ id: string }>`
      INSERT INTO "public"."users" ("email", "display_name")
      VALUES (${email}, ${displayName})
      RETURNING "id"
    `;

    return user?.id ?? (yield* Effect.die('INSERT did not return the user'));
  });

const countWishlistsOf = (ownerId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const [row] = yield* sql<{ count: number }>`
      SELECT count(*)::int AS "count"
      FROM "public"."wishlists"
      WHERE "owner_id" = ${ownerId}
    `;

    return row?.count;
  });

layer(EmptyTestDatabaseLive, { timeout: '60 seconds' })(
  'Wishlists migration on existing users',
  (it) => {
    it.effect(
      'normalizes existing display names before adding the trimmed check',
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient;

          // arrange: схема до 0004 и имена, которые новый CHECK не пропустил бы
          yield* PgMigrator.run({
            loader: PgMigrator.fromRecord({
              '0001_initial': initialMigration,
              '0002_auth': authMigration,
              '0003_display_name': displayNameMigration,
            }),
          });
          yield* sql`
            INSERT INTO "public"."users" ("email", "display_name")
            VALUES
              ('padded@example.test', '  Ada  '),
              ('blank@example.test', '   '),
              ('clean@example.test', 'Ada')
          `;

          // act
          yield* PgMigrator.run({
            loader: PgMigrator.fromFileSystem(migrationsDir),
          });

          // assert
          const users = yield* sql<{ displayName: string; email: string }>`
            SELECT "email", "display_name" AS "displayName"
            FROM "public"."users"
            ORDER BY "email"
          `;
          expect(users).toEqual([
            { email: 'blank@example.test', displayName: 'User' },
            { email: 'clean@example.test', displayName: 'Ada' },
            { email: 'padded@example.test', displayName: 'Ada' },
          ]);

          const error = yield* Effect.flip(
            insertUser('new@example.test', ' Bob '),
          );
          expect(rejectionOf(error)).toMatchObject({
            code: '23514',
            constraint: 'users_display_name_trimmed_check',
          });
        }),
    );
  },
);

layer(TestDatabaseLive, { timeout: '60 seconds' })(
  'Wishlists migration',
  (it) => {
    it.effect('fills defaults for a direct insert with owner and title', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        const ownerId = yield* insertUser('minimal@example.test', 'Owner');

        const [wishlist] = yield* sql<{
          createdAt: Date | null;
          description: string | null;
          id: string | null;
          occasionDate: unknown;
          updatedAt: Date | null;
          visibility: string;
        }>`
          INSERT INTO "public"."wishlists" ("owner_id", "title")
          VALUES (${ownerId}, 'Books')
          RETURNING "id", "description", "occasion_date" AS "occasionDate",
            "visibility", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
        `;

        expect(wishlist).toMatchObject({
          description: null,
          occasionDate: null,
          visibility: 'private',
        });
        expect(wishlist?.id).toEqual(expect.any(String));
        expect(wishlist?.createdAt).toBeInstanceOf(Date);
        expect(wishlist?.updatedAt).toBeInstanceOf(Date);

        yield* sql`DELETE FROM "public"."users" WHERE "id" = ${ownerId}`;
      }),
    );

    it.effect('allows several wishlists with the same title per owner', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        const ownerId = yield* insertUser('several@example.test', 'Owner');

        yield* sql`
          INSERT INTO "public"."wishlists" ("owner_id", "title")
          VALUES (${ownerId}, 'Books'), (${ownerId}, 'Books')
        `;

        expect(yield* countWishlistsOf(ownerId)).toBe(2);

        yield* sql`DELETE FROM "public"."users" WHERE "id" = ${ownerId}`;
      }),
    );

    describe('rejects a row that breaks the contract', () => {
      const missingOwnerId = '00000000-0000-4000-8000-0000000000ff';

      // Каждая строка нарушает ровно одно правило; остальные поля допустимы.
      const violations = [
        {
          name: 'a blank title',
          row: { title: '   ' },
          rejection: {
            code: '23514',
            constraint: 'wishlists_title_not_blank_check',
          },
        },
        {
          name: 'a null title',
          row: { title: null },
          rejection: { code: '23502', column: 'title' },
        },
        {
          name: 'a title longer than 255',
          row: { title: 'a'.repeat(256) },
          rejection: { code: '22001' },
        },
        {
          name: 'a blank description',
          row: { description: '  ' },
          rejection: {
            code: '23514',
            constraint: 'wishlists_description_check',
          },
        },
        {
          name: 'a description longer than 1000',
          row: { description: 'a'.repeat(1001) },
          rejection: { code: '22001' },
        },
        {
          name: 'a date that does not exist',
          row: { occasionDate: '2027-02-29' },
          rejection: { code: '22008' },
        },
        {
          name: 'an unknown visibility',
          row: { visibility: 'unlisted' },
          rejection: { code: '22P02' },
        },
        {
          name: 'a null visibility',
          row: { visibility: null },
          rejection: { code: '23502', column: 'visibility' },
        },
        {
          name: 'a null owner',
          row: { ownerId: null },
          rejection: { code: '23502', column: 'owner_id' },
        },
        {
          name: 'an owner that does not exist',
          row: { ownerId: missingOwnerId },
          rejection: { code: '23503', constraint: 'wishlists_owner_id_fkey' },
        },
      ] as const;

      it.effect.each(violations)('$name', ({ row, rejection }) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          const ownerId = yield* insertUser(
            `violation-${rejection.code}-${Object.keys(row).join()}@example.test`,
            'Owner',
          );

          const error = yield* Effect.flip(
            sql`
              INSERT INTO "public"."wishlists" ${sql.insert({
                ownerId,
                title: 'Books',
                ...row,
              })}
            `,
          );

          expect(rejectionOf(error)).toMatchObject(rejection);
          expect(yield* countWishlistsOf(ownerId)).toBe(0);
          expect(yield* countWishlistsOf(missingOwnerId)).toBe(0);

          yield* sql`DELETE FROM "public"."users" WHERE "id" = ${ownerId}`;
        }),
      );
    });

    it.effect(
      'deletes wishlists of a deleted owner and keeps other owners intact',
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          const deletedOwnerId = yield* insertUser('deleted@example.test', 'A');
          const keptOwnerId = yield* insertUser('kept@example.test', 'B');
          yield* sql`
            INSERT INTO "public"."wishlists" ("owner_id", "title")
            VALUES (${deletedOwnerId}, 'First'), (${deletedOwnerId}, 'Second'),
              (${keptOwnerId}, 'Kept')
          `;
          const keptBefore = yield* sql`
            SELECT * FROM "public"."wishlists" WHERE "owner_id" = ${keptOwnerId}
          `;

          yield* sql`DELETE FROM "public"."users" WHERE "id" = ${deletedOwnerId}`;

          expect(yield* countWishlistsOf(deletedOwnerId)).toBe(0);
          const keptAfter = yield* sql`
            SELECT * FROM "public"."wishlists" WHERE "owner_id" = ${keptOwnerId}
          `;
          expect(keptAfter).toEqual(keptBefore);

          yield* sql`DELETE FROM "public"."users" WHERE "id" = ${keptOwnerId}`;
        }),
    );

    it.effect('indexes wishlists by owner', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;

        const indexes = yield* sql<{ indexdef: string }>`
          SELECT "indexdef"
          FROM "pg_indexes"
          WHERE "schemaname" = 'public' AND "indexname" = 'wishlists_owner_id_idx'
        `;

        expect(indexes).toEqual([
          {
            indexdef:
              'CREATE INDEX wishlists_owner_id_idx ON public.wishlists USING btree (owner_id)',
          },
        ]);
      }),
    );
  },
);
