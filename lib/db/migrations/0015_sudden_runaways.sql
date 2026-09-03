CREATE TABLE "chat_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"pathname" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" varchar(180) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_attachments_message_id_idx" ON "chat_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_attachments_user_id_idx" ON "chat_attachments" USING btree ("user_id");