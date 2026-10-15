import { expect, layer } from '@effect/vitest';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

import { TestDatabaseLive } from '#infra/db/test-database.layer.js';

// @effect/sql-pg 4.0.4 читает `date` своим кодеком и отдаёт строку YYYY-MM-DD.
// Тест закрепляет это поведение: при обновлении sql-pg он упадёт, если дата начнёт
// приходить объектом Date или сдвигаться вместе с часовым поясом процесса.
const timeZones = ['UTC', 'Europe/Moscow', 'America/Los_Angeles'] as const;

// Node применяет новое значение process.env.TZ сразу; после теста пояс возвращается.
const withProcessTimeZone = (timeZone: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.env['TZ'];
      process.env['TZ'] = timeZone;

      return previous;
    }),
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) {
          delete process.env['TZ'];
        } else {
          process.env['TZ'] = previous;
        }
      }),
  );

layer(TestDatabaseLive, { timeout: '60 seconds' })(
  'PostgreSQL date round trip',
  (it) => {
    it.effect.each(timeZones)(
      'returns a date as the same YYYY-MM-DD string in %s',
      (timeZone) =>
        Effect.gen(function* () {
          yield* withProcessTimeZone(timeZone);
          const sql = yield* SqlClient;
          const [user] = yield* sql<{ id: string }>`
            INSERT INTO "public"."users" ("email", "display_name")
            VALUES (${`date-${timeZone}@example.test`}, 'Owner')
            RETURNING "id"
          `;
          const ownerId =
            user?.id ?? (yield* Effect.die('INSERT did not return the user'));

          const [inserted] = yield* sql<{ id: string; occasionDate: unknown }>`
            INSERT INTO "public"."wishlists" ("owner_id", "title", "occasion_date")
            VALUES (${ownerId}, 'Birthday', ${'2028-02-29'})
            RETURNING "id", "occasion_date" AS "occasionDate"
          `;
          const [read] = yield* sql<{
            createdAt: unknown;
            occasionDate: unknown;
          }>`
            SELECT "occasion_date" AS "occasionDate", "created_at" AS "createdAt"
            FROM "public"."wishlists"
            WHERE "id" = ${inserted?.id ?? null}
          `;

          expect(inserted?.occasionDate).toBe('2028-02-29');
          expect(read?.occasionDate).toBe('2028-02-29');
          // Остальные типы не задеты: момент времени по-прежнему Date.
          expect(read?.createdAt).toBeInstanceOf(Date);

          yield* sql`DELETE FROM "public"."users" WHERE "id" = ${ownerId}`;
        }).pipe(Effect.scoped),
    );
  },
);
