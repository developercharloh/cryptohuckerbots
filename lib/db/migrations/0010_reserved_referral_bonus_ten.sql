ALTER TABLE "referrals" ALTER COLUMN "reserved_amount" SET DEFAULT '10';
UPDATE "referrals"
SET "reserved_amount" = '10'
WHERE "reserved_amount" = '5';