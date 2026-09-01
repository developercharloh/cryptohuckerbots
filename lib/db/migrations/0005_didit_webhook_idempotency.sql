CREATE TABLE IF NOT EXISTS "didit_webhook_events" (
  "event_key" varchar(128) PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "didit_webhook_events_session_id_idx" ON "didit_webhook_events" USING btree ("session_id");