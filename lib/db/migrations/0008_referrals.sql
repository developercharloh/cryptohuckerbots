CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY NOT NULL,
  "referrer_user_id" integer NOT NULL,
  "referred_user_id" integer NOT NULL UNIQUE,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "bonus_amount" numeric(12, 2) DEFAULT '25' NOT NULL,
  "reserved_amount" numeric(12, 2) DEFAULT '5' NOT NULL,
  "vip1_purchase_id" integer,
  "credited_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "referrals_referrer_created_at_idx" ON "referrals" ("referrer_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "referrals_status_created_at_idx" ON "referrals" ("status", "created_at");