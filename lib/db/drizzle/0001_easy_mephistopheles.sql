ALTER TABLE "quest_log" ADD COLUMN "action_type" text DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "quest_log" ADD COLUMN "stat_category" text;