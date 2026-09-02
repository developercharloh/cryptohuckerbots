CREATE TABLE "technical_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" varchar(128) NOT NULL,
	"source" varchar(20) DEFAULT 'client' NOT NULL,
	"event" varchar(100) NOT NULL,
	"route" varchar(255) DEFAULT 'unknown' NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"last_status_code" integer,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer,
	CONSTRAINT "technical_incidents_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE INDEX "technical_incidents_status_last_seen_idx" ON "technical_incidents" USING btree ("status","last_seen_at");
--> statement-breakpoint
CREATE INDEX "technical_incidents_last_seen_idx" ON "technical_incidents" USING btree ("last_seen_at");