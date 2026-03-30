-- Custom SQL migration file, put your code below! --
CREATE TABLE IF NOT EXISTS "daily_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" integer NOT NULL,
  "name" text NOT NULL,
  "stat_category" text NOT NULL DEFAULT 'discipline',
  "completed" boolean NOT NULL DEFAULT false,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "date" text NOT NULL
);