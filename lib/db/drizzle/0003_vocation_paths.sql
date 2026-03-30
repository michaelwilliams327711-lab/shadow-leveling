--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vocations" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "current_title_index" integer DEFAULT 0 NOT NULL,
  "current_level" integer DEFAULT 1 NOT NULL,
  "current_xp" integer DEFAULT 0 NOT NULL,
  "gate_threshold" integer DEFAULT 20 NOT NULL,
  "gate_active" boolean DEFAULT false NOT NULL,
  "milestone_quest_description" text,
  "title_ladder" jsonb DEFAULT '["Novice"]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vocation_log" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vocation_id" text NOT NULL,
  "event_type" text NOT NULL,
  "delta" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "vocation_log_vocation_id_vocations_id_fk" FOREIGN KEY ("vocation_id") REFERENCES "public"."vocations"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "vocation_id" text;
