ALTER TABLE "referrals" ALTER COLUMN "bonus_amount" SET DEFAULT '20';
UPDATE "referrals"
SET "bonus_amount" = '20'
WHERE "status" = 'pending' AND "bonus_amount" = '25';