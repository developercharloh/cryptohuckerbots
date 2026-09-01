ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_at_idx" ON "email_verification_tokens" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_otp_challenges" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "challenge_hash" varchar(128) NOT NULL UNIQUE,
  "otp_hash" varchar(128) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_otp_challenges_user_id_idx" ON "login_otp_challenges" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_otp_challenges_expires_at_idx" ON "login_otp_challenges" USING btree ("expires_at");