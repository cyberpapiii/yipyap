-- Migration: Convert emoji/color combinations to subway_line/subway_color
-- This is Step 2 of the emoji/color to subway migration
--
-- SAFETY: This migration preserves existing emoji/color data while populating
-- the new subway fields. No data is lost and rollback is possible.
--
-- IMPORTANT: Run this migration only after 011_add_subway_columns.sql
-- has been successfully applied and verified.

-- Create a backup table for rollback purposes
DROP TABLE IF EXISTS users_emoji_backup;
CREATE TABLE users_emoji_backup AS
SELECT id, device_id, emoji, color, created_at
FROM users;

-- Add index for efficient rollback
CREATE INDEX idx_users_emoji_backup_id ON users_emoji_backup(id);

-- Validate current data before migration
DO $$
DECLARE
  total_users INTEGER;
  users_with_emoji INTEGER;
  users_with_color INTEGER;
  unmapped_combinations INTEGER;
BEGIN
  -- Count total users and users with identity data
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_emoji FROM users WHERE emoji IS NOT NULL;
  SELECT COUNT(*) INTO users_with_color FROM users WHERE color IS NOT NULL;

  -- Log pre-migration statistics
  RAISE NOTICE 'Pre-migration statistics:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Users with emoji: %', users_with_emoji;
  RAISE NOTICE '  Users with color: %', users_with_color;

  -- Check for unmapped combinations
  SELECT COUNT(*) INTO unmapped_combinations
  FROM users
  WHERE (emoji, color) NOT IN (
    ('🎭', 'purple'),   -- A + mta-blue
    ('🦄', 'blue'),     -- B + mta-orange
    ('🚀', 'green'),    -- G + mta-light-green
    ('🌟', 'orange'),   -- J + mta-brown
    ('🔥', 'red'),      -- L + mta-grey
    ('💫', 'purple'),   -- N + mta-yellow
    ('🎨', 'blue'),     -- 1 + mta-red
    ('🌈', 'green'),    -- 4 + mta-dark-green
    ('⚡', 'orange'),   -- 7 + mta-purple
    ('🎪', 'red')       -- T + mta-teal
  );

  RAISE NOTICE '  Users with unmapped combinations: %', unmapped_combinations;

  -- Abort if too many unmapped combinations (safety check)
  IF unmapped_combinations > total_users * 0.1 THEN
    RAISE EXCEPTION 'Too many unmapped emoji/color combinations (%). Migration aborted for safety.', unmapped_combinations;
  END IF;
END;
$$;

-- Perform the migration using explicit mapping
UPDATE users SET
  subway_line = CASE
    WHEN emoji = '🎭' AND color = 'purple' THEN 'A'
    WHEN emoji = '🦄' AND color = 'blue' THEN 'B'
    WHEN emoji = '🚀' AND color = 'green' THEN 'G'
    WHEN emoji = '🌟' AND color = 'orange' THEN 'J'
    WHEN emoji = '🔥' AND color = 'red' THEN 'L'
    WHEN emoji = '💫' AND color = 'purple' THEN 'N'
    WHEN emoji = '🎨' AND color = 'blue' THEN '1'
    WHEN emoji = '🌈' AND color = 'green' THEN '4'
    WHEN emoji = '⚡' AND color = 'orange' THEN '7'
    WHEN emoji = '🎪' AND color = 'red' THEN 'T'
    -- Default fallback for unmapped combinations
    ELSE 'A'
  END,
  subway_color = CASE
    WHEN emoji = '🎭' AND color = 'purple' THEN 'mta-blue'
    WHEN emoji = '🦄' AND color = 'blue' THEN 'mta-orange'
    WHEN emoji = '🚀' AND color = 'green' THEN 'mta-light-green'
    WHEN emoji = '🌟' AND color = 'orange' THEN 'mta-brown'
    WHEN emoji = '🔥' AND color = 'red' THEN 'mta-grey'
    WHEN emoji = '💫' AND color = 'purple' THEN 'mta-yellow'
    WHEN emoji = '🎨' AND color = 'blue' THEN 'mta-red'
    WHEN emoji = '🌈' AND color = 'green' THEN 'mta-dark-green'
    WHEN emoji = '⚡' AND color = 'orange' THEN 'mta-purple'
    WHEN emoji = '🎪' AND color = 'red' THEN 'mta-teal'
    -- Default fallback for unmapped combinations
    ELSE 'mta-blue'
  END;

-- Set NOT NULL constraints now that all data is migrated
ALTER TABLE users
  ALTER COLUMN subway_line SET NOT NULL,
  ALTER COLUMN subway_color SET NOT NULL;

-- Set default values for new users
ALTER TABLE users
  ALTER COLUMN subway_line SET DEFAULT 'A',
  ALTER COLUMN subway_color SET DEFAULT 'mta-blue';

-- Post-migration validation
DO $$
DECLARE
  migrated_users INTEGER;
  null_subway_line INTEGER;
  null_subway_color INTEGER;
  invalid_subway_line INTEGER;
  invalid_subway_color INTEGER;
BEGIN
  -- Count migrated users
  SELECT COUNT(*) INTO migrated_users FROM users WHERE subway_line IS NOT NULL AND subway_color IS NOT NULL;
  SELECT COUNT(*) INTO null_subway_line FROM users WHERE subway_line IS NULL;
  SELECT COUNT(*) INTO null_subway_color FROM users WHERE subway_color IS NULL;

  -- Count invalid values
  SELECT COUNT(*) INTO invalid_subway_line
  FROM users WHERE subway_line NOT IN ('A','B','G','J','L','N','1','4','7','T');

  SELECT COUNT(*) INTO invalid_subway_color
  FROM users WHERE subway_color NOT IN (
    'mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey',
    'mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal'
  );

  -- Log post-migration statistics
  RAISE NOTICE 'Post-migration validation:';
  RAISE NOTICE '  Users with subway data: %', migrated_users;
  RAISE NOTICE '  Users with null subway_line: %', null_subway_line;
  RAISE NOTICE '  Users with null subway_color: %', null_subway_color;
  RAISE NOTICE '  Users with invalid subway_line: %', invalid_subway_line;
  RAISE NOTICE '  Users with invalid subway_color: %', invalid_subway_color;

  -- Abort if validation fails
  IF null_subway_line > 0 OR null_subway_color > 0 OR invalid_subway_line > 0 OR invalid_subway_color > 0 THEN
    RAISE EXCEPTION 'Migration validation failed. Check the logs above for details.';
  END IF;

  RAISE NOTICE 'Migration completed successfully. % users migrated.', migrated_users;
END;
$$;

-- Create mapping reference table for documentation/rollback
CREATE TABLE IF NOT EXISTS emoji_subway_mapping (
  id SERIAL PRIMARY KEY,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL,
  subway_line TEXT NOT NULL,
  subway_color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the mapping data for reference
INSERT INTO emoji_subway_mapping (emoji, color, subway_line, subway_color) VALUES
  ('🎭', 'purple', 'A', 'mta-blue'),
  ('🦄', 'blue', 'B', 'mta-orange'),
  ('🚀', 'green', 'G', 'mta-light-green'),
  ('🌟', 'orange', 'J', 'mta-brown'),
  ('🔥', 'red', 'L', 'mta-grey'),
  ('💫', 'purple', 'N', 'mta-yellow'),
  ('🎨', 'blue', '1', 'mta-red'),
  ('🌈', 'green', '4', 'mta-dark-green'),
  ('⚡', 'orange', '7', 'mta-purple'),
  ('🎪', 'red', 'T', 'mta-teal')
ON CONFLICT DO NOTHING;