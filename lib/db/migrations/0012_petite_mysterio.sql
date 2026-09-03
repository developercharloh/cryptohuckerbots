CREATE TABLE "withdrawal_confirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(100) NOT NULL,
	"wallet_address" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawal_confirmations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "txid" varchar(255);--> statement-breakpoint
CREATE INDEX "withdrawal_confirmations_user_created_at_idx" ON "withdrawal_confirmations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "withdrawal_confirmations_expires_at_idx" ON "withdrawal_confirmations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_sessions_txid_unique" ON "deposit_sessions" USING btree ("txid");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_txid_unique" ON "transactions" USING btree ("txid");