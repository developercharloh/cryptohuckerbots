CREATE TABLE "auth_rate_limits" (
  "key" varchar(255) PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp DEFAULT now() NOT NULL,
  "blocked_until" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "security_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer,
  "event" varchar(100) NOT NULL,
  "ip" varchar(100) DEFAULT 'Unknown' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_events_user_created_at_idx" ON "security_events" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "security_events_event_created_at_idx" ON "security_events" USING btree ("event","created_at");