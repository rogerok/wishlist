CREATE TYPE "roles" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"middle_name" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"role" "roles" DEFAULT 'user'::"roles" NOT NULL
);
