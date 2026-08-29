CREATE TABLE "vip_package_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"vip_level" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "vip_package_purchases_user_level_unique" ON "vip_package_purchases" USING btree ("user_id","vip_level");--> statement-breakpoint
CREATE INDEX "vip_package_purchases_user_created_at_idx" ON "vip_package_purchases" USING btree ("user_id","created_at");