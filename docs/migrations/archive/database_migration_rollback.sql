-- ROLLBACK STRATEGY FOR EMOJI TO SUBWAY MIGRATION
--
-- This file contains rollback procedures and validation queries for the
-- emoji/color to subway_line/subway_color migration.
--
-- ROLLBACK SCENARIOS:
-- 1. Rollback before Step 4 (columns not yet dropped) - SAFE
-- 2. Rollback after Step 4 (columns dropped) - REQUIRES BACKUP RESTORE
--
-- ============================================================================
-- SCENARIO 1: ROLLBACK BEFORE DROPPING COLUMNS (Steps 1-3 applied)
-- ============================================================================

-- Step 1: Validate rollback is possible
-- Run this query first to verify backup tables exist and data is intact
DO $$
DECLARE
  backup_table_exists BOOLEAN;
  mapping_table_exists BOOLEAN;
  emoji_column_exists BOOLEAN;
  color_column_exists BOOLEAN;
  total_users INTEGER;
  backup_users INTEGER;
BEGIN
  -- Check if backup tables exist
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'users_emoji_backup'
  ) INTO backup_table_exists;

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'emoji_subway_mapping'
  ) INTO mapping_table_exists;

  -- Check if original columns still exist
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emoji'
  ) INTO emoji_column_exists;

  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'color'
  ) INTO color_column_exists;

  -- Count users
  SELECT COUNT(*) INTO total_users FROM users;

  IF backup_table_exists THEN
    SELECT COUNT(*) INTO backup_users FROM users_emoji_backup;
  ELSE
    backup_users := 0;
  END IF;

  -- Report status
  RAISE NOTICE 'Rollback Safety Check:';
  RAISE NOTICE '  Backup table exists: %', backup_table_exists;
  RAISE NOTICE '  Mapping table exists: %', mapping_table_exists;
  RAISE NOTICE '  Emoji column exists: %', emoji_column_exists;
  RAISE NOTICE '  Color column exists: %', color_column_exists;
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Backup users: %', backup_users;

  IF NOT backup_table_exists THEN
    RAISE EXCEPTION 'ROLLBACK IMPOSSIBLE: Backup table users_emoji_backup not found!';
  END IF;

  IF NOT emoji_column_exists OR NOT color_column_exists THEN
    RAISE EXCEPTION 'ROLLBACK IMPOSSIBLE: Original columns have been dropped. Restore from database backup required.';
  END IF;

  IF backup_users != total_users THEN
    RAISE WARNING 'USER COUNT MISMATCH: Backup has % users, current has %. Proceed with caution.', backup_users, total_users;
  END IF;

  RAISE NOTICE 'ROLLBACK POSSIBLE: Original columns exist and backup is available.';
END;
$$;

-- Step 2: Execute rollback (only run after Step 1 validation passes)
-- Uncomment the following section to perform the rollback:

/*
-- Revert views to original structure
DROP VIEW IF EXISTS anonymous_users CASCADE;
DROP VIEW IF EXISTS anonymous_users_with_activity CASCADE;

-- Recreate original views without subway fields
CREATE VIEW anonymous_users AS
SELECT
  id,
  device_id,
  emoji,
  color,
  created_at,
  last_seen_at
FROM users;

CREATE VIEW anonymous_users_with_activity AS
SELECT
  u.id,
  u.device_id,
  u.emoji,
  u.color,
  u.created_at,
  u.last_seen_at,
  u.total_karma,
  u.posts_created,
  u.comments_created
FROM users u;

-- Restore original get_or_create_user function
DROP FUNCTION IF EXISTS get_or_create_user(TEXT);
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param TEXT)
RETURNS anonymous_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record anonymous_users%ROWTYPE;
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['purple','blue','green','orange','red'];
  chosen_emoji text;
  chosen_color text;
BEGIN
  SELECT id, device_id, emoji, color, created_at, last_seen_at
  INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  IF FOUND THEN
    UPDATE users
    SET last_seen_at = NOW()
    WHERE id = user_record.id
    RETURNING id, device_id, emoji, color, created_at, last_seen_at
    INTO user_record;
    RETURN user_record;
  END IF;

  chosen_emoji := emojis[1 + (floor(random() * array_length(emojis, 1)))::int];
  chosen_color := colors[1 + (floor(random() * array_length(colors, 1)))::int];

  INSERT INTO users (device_id, emoji, color, last_seen_at)
  VALUES (device_id_param, chosen_emoji, chosen_color, NOW())
  RETURNING id, device_id, emoji, color, created_at, last_seen_at
  INTO user_record;

  RETURN user_record;
END;
$$;

-- Remove subway columns and constraints
ALTER TABLE users
  DROP COLUMN IF EXISTS subway_line,
  DROP COLUMN IF EXISTS subway_color;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_subway_line_valid,
  DROP CONSTRAINT IF EXISTS users_subway_color_valid;

-- Drop subway-related indexes
DROP INDEX IF EXISTS idx_users_subway_line;
DROP INDEX IF EXISTS idx_users_subway_color;

-- Drop rollback-related tables
DROP TABLE IF EXISTS users_emoji_backup;
DROP TABLE IF EXISTS emoji_subway_mapping;
DROP TABLE IF EXISTS users_identity_mapping_final;

-- Remove rollback functions
DROP FUNCTION IF EXISTS get_subway_identity(UUID, UUID);

RAISE NOTICE 'ROLLBACK COMPLETED: Reverted to original emoji/color system.';
*/

-- ============================================================================
-- SCENARIO 2: ROLLBACK AFTER DROPPING COLUMNS (Step 4 applied)
-- ============================================================================

-- If columns have been dropped, database backup restore is required.
-- The following queries help with post-restore validation:

-- Query to validate backup restoration (run after restore)
-- SELECT
--   'users_emoji_backup' as table_name,
--   COUNT(*) as record_count,
--   MIN(created_at) as oldest_record,
--   MAX(created_at) as newest_record
-- FROM users_emoji_backup
-- UNION ALL
-- SELECT
--   'emoji_subway_mapping' as table_name,
--   COUNT(*) as record_count,
--   MIN(created_at) as oldest_record,
--   MAX(created_at) as newest_record
-- FROM emoji_subway_mapping
-- UNION ALL
-- SELECT
--   'users_identity_mapping_final' as table_name,
--   COUNT(*) as record_count,
--   MIN(created_at) as oldest_record,
--   MAX(created_at) as newest_record
-- FROM users_identity_mapping_final;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Pre-migration validation (run before starting migration)
SELECT
  'pre_migration_check' as check_type,
  COUNT(*) as total_users,
  COUNT(CASE WHEN emoji IS NOT NULL THEN 1 END) as users_with_emoji,
  COUNT(CASE WHEN color IS NOT NULL THEN 1 END) as users_with_color,
  COUNT(DISTINCT emoji) as unique_emojis,
  COUNT(DISTINCT color) as unique_colors
FROM users;

-- Post-Step-1 validation (after adding subway columns)
-- SELECT
--   'post_step1_check' as check_type,
--   COUNT(*) as total_users,
--   COUNT(CASE WHEN subway_line IS NOT NULL THEN 1 END) as users_with_subway_line,
--   COUNT(CASE WHEN subway_color IS NOT NULL THEN 1 END) as users_with_subway_color
-- FROM users;

-- Post-Step-2 validation (after data migration)
-- SELECT
--   'post_step2_check' as check_type,
--   COUNT(*) as total_users,
--   COUNT(CASE WHEN subway_line IS NOT NULL THEN 1 END) as users_with_subway_line,
--   COUNT(CASE WHEN subway_color IS NOT NULL THEN 1 END) as users_with_subway_color,
--   COUNT(DISTINCT subway_line) as unique_subway_lines,
--   COUNT(DISTINCT subway_color) as unique_subway_colors
-- FROM users;

-- Mapping validation (verify conversion accuracy)
-- SELECT
--   emoji,
--   color,
--   subway_line,
--   subway_color,
--   COUNT(*) as user_count
-- FROM users
-- GROUP BY emoji, color, subway_line, subway_color
-- ORDER BY user_count DESC;

-- Check for unmapped combinations
-- SELECT DISTINCT
--   emoji,
--   color,
--   'UNMAPPED' as status
-- FROM users
-- WHERE (emoji, color) NOT IN (
--   SELECT emoji, color FROM emoji_subway_mapping
-- );

-- ============================================================================
-- EMERGENCY PROCEDURES
-- ============================================================================

-- Emergency: Find users affected by migration issues
-- SELECT
--   id,
--   device_id,
--   emoji,
--   color,
--   subway_line,
--   subway_color,
--   created_at
-- FROM users
-- WHERE subway_line IS NULL OR subway_color IS NULL
-- ORDER BY created_at DESC
-- LIMIT 100;

-- Emergency: Restore specific user from backup
-- UPDATE users u
-- SET
--   emoji = b.emoji,
--   color = b.color
-- FROM users_emoji_backup b
-- WHERE u.id = b.id
--   AND u.id = 'SPECIFIC_USER_UUID_HERE';

-- Emergency: Bulk restore from backup (DANGEROUS - use with extreme caution)
-- UPDATE users u
-- SET
--   emoji = b.emoji,
--   color = b.color
-- FROM users_emoji_backup b
-- WHERE u.id = b.id;