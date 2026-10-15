import { Effect } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TYPE "public"."wishlists_visibility" AS ENUM ('private', 'public')
  `;

  yield* sql`
    CREATE TABLE "public"."wishlists" (
      "created_at" timestamptz(3) NOT NULL DEFAULT now(),
      "description" varchar(1000) CHECK ( "description" IS NULL OR btrim("description") <> ''),
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "occasion_date" date,
      "owner_id" uuid NOT NULL REFERENCES "public"."users" ("id") ON DELETE CASCADE,
      "title" varchar(255) NOT NULL CONSTRAINT "wishlists_title_not_blank_check" CHECK (btrim("title") <> ''),
      "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
      "visibility" "public"."wishlists_visibility" NOT NULL DEFAULT 'private'
    )
  `;

  yield* sql`
    CREATE INDEX "wishlists_owner_id_idx" ON "public"."wishlists" ("owner_id")
  `;

  yield* sql`
    UPDATE "public"."users"
    SET "display_name" = coalesce(nullif(btrim("display_name"), ''), 'User')
    WHERE "display_name" <> btrim("display_name") OR btrim("display_name") = ''
  `;

  yield* sql`
    ALTER TABLE "public"."users" ADD CONSTRAINT "users_display_name_trimmed_check" 
      CHECK ("display_name" = btrim("display_name") AND "display_name" <> '')
  `;
});
