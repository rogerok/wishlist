import { PgMigrator } from '@effect/sql-pg';
import { layer } from '@effect/vitest';
import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

import initialMigration from '#infra/db/migrations/0001_initial.js';
import authMigration from '#infra/db/migrations/0002_auth.js';
import {
  EmptyTestDatabaseLive,
  migrationsDir,
} from '#infra/db/test-database.layer.js';

const longName = 'a'.repeat(120);

layer(EmptyTestDatabaseLive, { timeout: '60 seconds' })(
  'Display Name migration',
  (it) => {
    it.effect('moves name fields of existing users into display_name', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;

        // arrange: схема до Display Name и строки старого вида
        yield* PgMigrator.run({
          loader: PgMigrator.fromRecord({
            '0001_initial': initialMigration,
            '0002_auth': authMigration,
          }),
        });
        yield* sql`
          INSERT INTO "public"."users" ("email", "first_name", "middle_name", "last_name")
          VALUES
            ('full@example.test', 'Ada', 'King', 'Lovelace'),
            ('short@example.test', 'Ada', NULL, 'Lovelace'),
            ('empty@example.test', NULL, NULL, NULL),
            ('long@example.test', ${longName}, NULL, NULL)
        `;

        // act: все остальные миграции из каталога
        yield* PgMigrator.run({
          loader: PgMigrator.fromFileSystem(migrationsDir),
        });

        // assert
        const columns = yield* sql<{ columnName: string; isNullable: string }>`
          SELECT "column_name" AS "columnName", "is_nullable" AS "isNullable"
          FROM "information_schema"."columns"
          WHERE "table_schema" = 'public' AND "table_name" = 'users'
          ORDER BY "column_name"
        `;
        expect(columns).toEqual([
          { columnName: 'created_at', isNullable: 'NO' },
          { columnName: 'display_name', isNullable: 'NO' },
          { columnName: 'email', isNullable: 'NO' },
          { columnName: 'id', isNullable: 'NO' },
          { columnName: 'role', isNullable: 'NO' },
          { columnName: 'updated_at', isNullable: 'NO' },
        ]);

        const rows = yield* sql<{ displayName: string; email: string }>`
          SELECT "email", "display_name" AS "displayName"
          FROM "public"."users"
          ORDER BY "email"
        `;
        expect(rows).toEqual([
          { email: 'empty@example.test', displayName: 'User' },
          { email: 'full@example.test', displayName: 'Ada King Lovelace' },
          { email: 'long@example.test', displayName: 'a'.repeat(100) },
          { email: 'short@example.test', displayName: 'Ada Lovelace' },
        ]);
      }),
    );
  },
);
