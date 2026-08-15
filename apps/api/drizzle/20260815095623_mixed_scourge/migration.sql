ALTER TABLE "users" DROP CONSTRAINT "users_email_key";--> statement-breakpoint
ALTER INDEX "emailUniqueIndex" RENAME TO "users_email_lower_unique_idx";