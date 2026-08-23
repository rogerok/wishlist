import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
  CREATE TABLE "public"."password_credentials" (
    "user_id" UUID PRIMARY KEY REFERENCES "public"."users" ("id") ON DELETE CASCADE,
    "password_hash" text NOT NULL,
    "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    )
  `;

  yield* sql`
    CREATE TABLE "public"."sessions" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" UUID NOT NULL REFERENCES "public"."users" ("id") ON DELETE CASCADE,
      "token_digest" bytea NOT NULL UNIQUE CHECK (octet_length("token_digest") = 32),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "expires_at" timestamp(3) with time zone NOT NULL,
      CHECK ("expires_at" > "created_at")
    )
  `;

  yield* sql`
    CREATE INDEX "sessions_user_id_idx"
      ON "public"."sessions" ("user_id")
  `;

  yield* sql`
     CREATE INDEX "sessions_expires_at_idx"
     ON "public"."sessions" ("expires_at")
  `;
});
