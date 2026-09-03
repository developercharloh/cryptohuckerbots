ALTER TABLE "users" ADD COLUMN "signal_trial_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signal_trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signal_trial_reminder_sent_at" timestamp;