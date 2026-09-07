CREATE TABLE "support_chat_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" varchar(50),
	"mode" varchar(20) DEFAULT 'bot' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"bot_state" varchar(50) DEFAULT 'choose_category' NOT NULL,
	"user_last_seen_at" timestamp DEFAULT now() NOT NULL,
	"admin_typing_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_chat_threads_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE INDEX "support_chat_threads_status_updated_at_idx" ON "support_chat_threads" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "support_chat_threads_user_last_seen_idx" ON "support_chat_threads" USING btree ("user_last_seen_at");