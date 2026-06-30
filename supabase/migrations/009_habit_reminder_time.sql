-- Add optional reminder_time column to habits table.
-- Stores the time of day the user wants a push notification for this habit.
-- Nullable: habits without a reminder_time get no time-gated push.
ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time TIME;
