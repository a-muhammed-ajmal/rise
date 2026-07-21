-- Add category column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'default'
  CHECK (category IN ('personal','professional','financial','wellness','relationship','vision','legal','default'));
