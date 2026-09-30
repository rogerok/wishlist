import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

import type { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

/**
 * Inserts a minimal user row for tests that need a foreign key to `users`.
 * The row is deleted when the surrounding scope closes.
 */
export const insertTestUser = (id: UserId, email: UserEmail) =>
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
