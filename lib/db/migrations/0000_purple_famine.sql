CREATE TABLE IF NOT EXISTS "admin_login_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_uid" varchar(15) NOT NULL,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"ip" varchar(100) DEFAULT 'Unknown' NOT NULL,
	"country" varchar(100) DEFAULT 'Unknown' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"win_rate" numeric(5, 2) NOT NULL,
	"risk_level" varchar(50) DEFAULT 'Medium' NOT NULL,
	"monthly_return" numeric(6, 2) DEFAULT '0' NOT NULL,
	"min_investment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"icon_url" text,
	"is_marketplace" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sender" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'created' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method_id" varchar(100) NOT NULL,
	"payment_method_name" varchar(100) NOT NULL,
	"network" varchar(100) NOT NULL,
	"deposit_address" text NOT NULL,
	"txid" varchar(255),
	"confirmations" integer DEFAULT 0 NOT NULL,
	"required_confirmations" integer DEFAULT 20 NOT NULL,
	"transaction_id" integer,
	"crypto_asset" varchar(20),
	"crypto_amount" numeric(20, 8),
	"conversion_rate" numeric(20, 8),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source" varchar(100) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'not_submitted' NOT NULL,
	"document_type" varchar(100),
	"document_front_url" text,
	"selfie_url" text,
	"proof_of_address_url" text,
	"rejection_reason" text,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"didit_session_id" text,
	CONSTRAINT "kyc_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"bot_alerts" boolean DEFAULT true NOT NULL,
	"deposit_withdrawal" boolean DEFAULT true NOT NULL,
	"promotions" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bot_id" integer NOT NULL,
	"bot_name" varchar(255) NOT NULL,
	"signal_id" varchar(100) NOT NULL,
	"pair" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"market" varchar(50) NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"stake" numeric(12, 2) NOT NULL,
	"target_profit" numeric(12, 2) NOT NULL,
	"stop_loss" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"realized_pnl" numeric(12, 2),
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"device" text DEFAULT 'Unknown Device' NOT NULL,
	"ip" varchar(100) DEFAULT '0.0.0.0' NOT NULL,
	"location" text,
	"last_active" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_name" text DEFAULT 'VIXUS AI' NOT NULL,
	"support_email" text DEFAULT 'support@vixus.ai' NOT NULL,
	"logo_url" text,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"withdrawals_enabled" boolean DEFAULT true NOT NULL,
	"deposits_enabled" boolean DEFAULT true NOT NULL,
	"min_deposit" numeric(12, 2) DEFAULT '50' NOT NULL,
	"min_withdrawal" numeric(12, 2) DEFAULT '20' NOT NULL,
	"payment_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signals_enabled" boolean DEFAULT true NOT NULL,
	"signals_emergency_stop" boolean DEFAULT false NOT NULL,
	"signals_timezone" varchar(100) DEFAULT 'Africa/Nairobi' NOT NULL,
	"signal_times" jsonb DEFAULT '["19:00","21:00","23:00"]'::jsonb NOT NULL,
	"signal_daily_limit" integer DEFAULT 3 NOT NULL,
	"signal_spacing_minutes" integer DEFAULT 120 NOT NULL,
	"signal_max_stake_percent" numeric(5, 2) DEFAULT '10' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"opportunity_id" integer NOT NULL,
	"position_id" integer,
	"client_request_id" varchar(100),
	"consent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_key" varchar(80) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"signal_id" varchar(100) NOT NULL,
	"pair" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"market" varchar(50) NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"timeframe" varchar(20) NOT NULL,
	"suggested_tp" numeric(12, 2) NOT NULL,
	"suggested_sl" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signal_opportunities_schedule_key_unique" UNIQUE("schedule_key")
);
--> statement-breakpoint
CREATE TABLE "signal_schedule_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_settings" jsonb,
	"next_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"admin_reply" text,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(100) NOT NULL,
	"wallet_address" text,
	"description" text,
	"crypto_amount" numeric(20, 8),
	"crypto_asset" varchar(20),
	"conversion_rate" numeric(20, 8),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bot_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'paused' NOT NULL,
	"profit_today" numeric(12, 2) DEFAULT '0' NOT NULL,
	"profit_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"next_trade_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"phone" varchar(50),
	"country" varchar(100),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_uid" varchar(15) NOT NULL,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"kyc_status" varchar(50) DEFAULT 'not_verified' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"two_fa_enabled" boolean DEFAULT false NOT NULL,
	"two_fa_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_account_uid_unique" UNIQUE("account_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "admin_login_notifications_created_at_idx" ON "admin_login_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_login_notifications_read_created_at_idx" ON "admin_login_notifications" USING btree ("is_read","created_at");--> statement-breakpoint
CREATE INDEX "broadcasts_created_at_idx" ON "broadcasts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_user_created_at_idx" ON "chat_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "deposit_sessions_user_created_at_idx" ON "deposit_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "deposit_sessions_status_expires_at_idx" ON "deposit_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "earnings_user_date_idx" ON "earnings" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_at_idx" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "positions_user_opened_at_idx" ON "positions" USING btree ("user_id","opened_at");--> statement-breakpoint
CREATE INDEX "positions_user_status_idx" ON "positions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_claims_user_opportunity_unique" ON "signal_claims" USING btree ("user_id","opportunity_id");--> statement-breakpoint
CREATE INDEX "signal_claims_user_created_at_idx" ON "signal_claims" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "signal_opportunities_scheduled_at_idx" ON "signal_opportunities" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "signal_opportunities_status_expires_at_idx" ON "signal_opportunities" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "signal_schedule_audit_created_at_idx" ON "signal_schedule_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_user_created_at_idx" ON "support_tickets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_created_at_idx" ON "transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_status_created_at_idx" ON "transactions" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "transactions_status_type_created_at_idx" ON "transactions" USING btree ("status","type","created_at");--> statement-breakpoint
CREATE INDEX "user_bots_user_id_idx" ON "user_bots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_bots_user_status_idx" ON "user_bots" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_bots_next_trade_at_idx" ON "user_bots" USING btree ("next_trade_at");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_status_created_at_idx" ON "users" USING btree ("status","created_at");