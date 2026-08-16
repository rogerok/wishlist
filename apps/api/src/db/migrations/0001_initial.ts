import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
     CREATE TYPE "public"."roles" AS ENUM ('admin', 'user')
  `;

  yield* sql`
    CREATE TABLE "public".users (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "email" varchar(255) NOT NULL,
      "middle_name" varchar(255),
      "first_name" varchar(255),
      "last_name" varchar(255),
      "role" "public"."roles" NOT NULL DEFAULT 'user'
    )
  `;

  yield* sql`
    CREATE UNIQUE INDEX "users_email_lower_unique_idx"
    ON "public"."users" (lower("email"))
  `;
});
