CREATE TABLE "vip_investment_capital" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"vip_level" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'locked' NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"replaced_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "vip_investment_capital_user_status_idx" ON "vip_investment_capital" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "vip_investment_capital_user_activated_at_idx" ON "vip_investment_capital" USING btree ("user_id","activated_at");--> statement-breakpoint
INSERT INTO "vip_investment_capital" ("user_id", "vip_level", "amount", "status", "activated_at")
SELECT DISTINCT ON ("user_id")
  "user_id",
  "vip_level",
  "amount",
  'locked',
  "created_at"
FROM "vip_package_purchases"
WHERE "status" = 'completed'
ORDER BY "user_id", "vip_level" DESC, "created_at" DESC;