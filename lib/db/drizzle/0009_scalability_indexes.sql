CREATE INDEX IF NOT EXISTS "quest_log_occurred_at_idx" ON "quest_log" USING btree ("occurred_at");
CREATE INDEX IF NOT EXISTS "activity_date_idx" ON "activity" USING btree ("date");
CREATE INDEX IF NOT EXISTS "daily_orders_date_character_id_idx" ON "daily_orders" USING btree ("date","character_id");
CREATE INDEX IF NOT EXISTS "quests_status_deleted_at_idx" ON "quests" USING btree ("status","deleted_at");
CREATE INDEX IF NOT EXISTS "bad_habits_deleted_at_idx" ON "bad_habits" USING btree ("deleted_at");
