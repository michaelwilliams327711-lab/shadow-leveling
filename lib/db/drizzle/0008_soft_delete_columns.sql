ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "bad_habits" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "vocations" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
