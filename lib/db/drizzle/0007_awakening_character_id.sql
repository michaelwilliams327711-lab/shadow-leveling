ALTER TABLE "awakening" ADD COLUMN IF NOT EXISTS "character_id" integer REFERENCES "character"("id");--> statement-breakpoint
UPDATE "awakening" SET "character_id" = (SELECT "id" FROM "character" LIMIT 1) WHERE "character_id" IS NULL;
