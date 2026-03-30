CREATE TABLE IF NOT EXISTS "daily_hidden_box_rewards" (
  "id" serial PRIMARY KEY NOT NULL,
  "character_id" integer NOT NULL,
  "date" text NOT NULL,
  "type" text NOT NULL,
  "gold_bonus" integer,
  "stat_boost" integer,
  "stat" text,
  "claimed" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "claimed_at" timestamp,
  CONSTRAINT "daily_hidden_box_rewards_char_date_unique" UNIQUE("character_id","date")
);
