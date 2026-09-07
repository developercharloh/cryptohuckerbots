CREATE TABLE "bsc_deposit_scan_state" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"next_block" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
