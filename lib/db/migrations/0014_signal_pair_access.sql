ALTER TABLE "users" ADD COLUMN "signal_access_started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signal_pairs_remaining" integer;