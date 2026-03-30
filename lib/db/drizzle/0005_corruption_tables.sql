ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "corruption" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bad_habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"severity" text DEFAULT 'Medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bad_habit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL REFERENCES "bad_habits"("id") ON DELETE CASCADE,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"corruption_delta" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
