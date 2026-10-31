import { Effect } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE INDEX "wishlists_owner_id_created_at_id_idx" ON "public"."wishlists" (owner_id, created_at DESC, id DESC)
  `;

  yield* sql`
    DROP INDEX "wishlists_owner_id_idx"
  `;
});
