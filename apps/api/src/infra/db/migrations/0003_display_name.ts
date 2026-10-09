import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    ALTER TABLE "public"."users" ADD COLUMN "display_name" varchar(100)
  `;

  yield* sql`
    UPDATE "public"."users"
    SET "display_name" = coalesce(nullif(left(concat_ws(' ', "first_name", "middle_name", "last_name"), 100), ''), 'User')
  `;

  yield* sql`
  ALTER TABLE "public"."users" ALTER COLUMN "display_name" SET NOT NULL
  `;

  yield* sql`
    ALTER TABLE "public"."users" DROP COLUMN "first_name", DROP COLUMN "last_name", DROP COLUMN "middle_name"
  `;
});
