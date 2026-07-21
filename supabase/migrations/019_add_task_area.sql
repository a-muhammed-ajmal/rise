-- Add area column to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'default'
  CHECK (area IN ('personal','professional','financial','wellness','relationship','vision','legal','default'));
