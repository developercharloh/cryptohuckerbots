CREATE TABLE "binance_deposit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"txid" varchar(255) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"coin" varchar(20) NOT NULL,
	"network" varchar(50) NOT NULL,
	"address" text NOT NULL,
	"status" integer NOT NULL,
	"confirm_times" varchar(100),
	"insert_time" timestamp NOT NULL,
	"state" varchar(30) DEFAULT 'unmatched' NOT NULL,
	"matched_session_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "binance_deposit_events_txid_unique" UNIQUE("txid")
);
--> statement-breakpoint
CREATE INDEX "binance_deposit_events_state_insert_time_idx" ON "binance_deposit_events" USING btree ("state","insert_time");--> statement-breakpoint
CREATE INDEX "binance_deposit_events_matched_session_idx" ON "binance_deposit_events" USING btree ("matched_session_id");