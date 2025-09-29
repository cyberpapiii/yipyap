-- VALIDATION QUERIES FOR EMOJI TO SUBWAY MIGRATION
--
-- This file contains comprehensive validation queries to verify the migration
-- at each step and ensure data integrity throughout the process.
--
-- USAGE:
-- Run the appropriate validation queries after each migration step to verify
-- success before proceeding to the next step.

-- ============================================================================
-- PRE-MIGRATION VALIDATION (Run before starting migration)
-- ============================================================================

-- Comprehensive pre-migration check
SELECT
  'Pre-Migration Status' as check_name,
  'Total Users' as metric,
  COUNT(*)::text as value
FROM users
UNION ALL
SELECT
  'Pre-Migration Status',
  'Users with Emoji',
  COUNT(CASE WHEN emoji IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Pre-Migration Status',
  'Users with Color',
  COUNT(CASE WHEN color IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Pre-Migration Status',
  'Unique Emojis',
  COUNT(DISTINCT emoji)::text
FROM users
UNION ALL
SELECT
  'Pre-Migration Status',
  'Unique Colors',
  COUNT(DISTINCT color)::text
FROM users;

-- Check emoji/color distribution
SELECT
  'Current Distribution' as check_name,
  emoji,
  color,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM users
WHERE emoji IS NOT NULL AND color IS NOT NULL
GROUP BY emoji, color
ORDER BY user_count DESC;

-- Identify unmapped combinations (should be empty or minimal)
SELECT
  'Unmapped Combinations' as check_name,
  emoji,
  color,
  COUNT(*) as user_count
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
)
GROUP BY emoji, color
ORDER BY user_count DESC;

-- ============================================================================
-- POST-STEP-1 VALIDATION (After adding subway columns)
-- ============================================================================

-- Verify new columns were added successfully
SELECT
  'Step 1 Validation' as check_name,
  'Subway Line Column Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'subway_line'
    ) THEN 'YES'
    ELSE 'NO'
  END as value
UNION ALL
SELECT
  'Step 1 Validation',
  'Subway Color Column Exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'subway_color'
    ) THEN 'YES'
    ELSE 'NO'
  END
UNION ALL
SELECT
  'Step 1 Validation',
  'Subway Line Index Exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'idx_users_subway_line'
    ) THEN 'YES'
    ELSE 'NO'
  END
UNION ALL
SELECT
  'Step 1 Validation',
  'Subway Color Index Exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'idx_users_subway_color'
    ) THEN 'YES'
    ELSE 'NO'
  END;

-- Check constraints were created
SELECT
  'Constraint Check' as check_name,
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%subway%'
ORDER BY constraint_name;

-- ============================================================================
-- POST-STEP-2 VALIDATION (After data migration)
-- ============================================================================

-- Comprehensive post-migration data validation
SELECT
  'Step 2 Validation' as check_name,
  'Total Users' as metric,
  COUNT(*)::text as value
FROM users
UNION ALL
SELECT
  'Step 2 Validation',
  'Users with Subway Line',
  COUNT(CASE WHEN subway_line IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Step 2 Validation',
  'Users with Subway Color',
  COUNT(CASE WHEN subway_color IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Step 2 Validation',
  'Users Missing Subway Line',
  COUNT(CASE WHEN subway_line IS NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Step 2 Validation',
  'Users Missing Subway Color',
  COUNT(CASE WHEN subway_color IS NULL THEN 1 END)::text
FROM users;

-- Verify mapping accuracy
SELECT
  'Mapping Verification' as check_name,
  emoji,
  color,
  subway_line,
  subway_color,
  COUNT(*) as user_count
FROM users
WHERE emoji IS NOT NULL AND color IS NOT NULL
GROUP BY emoji, color, subway_line, subway_color
ORDER BY user_count DESC;

-- Check for invalid subway values
SELECT
  'Invalid Values Check' as check_name,
  'Invalid Subway Lines' as metric,
  COUNT(*)::text as value
FROM users
WHERE subway_line NOT IN ('A','B','G','J','L','N','1','4','7','T')
UNION ALL
SELECT
  'Invalid Values Check',
  'Invalid Subway Colors',
  COUNT(*)::text
FROM users
WHERE subway_color NOT IN (
  'mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey',
  'mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal'
);

-- Verify backup table was created
SELECT
  'Backup Verification' as check_name,
  'Backup Table Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'users_emoji_backup'
    ) THEN 'YES'
    ELSE 'NO'
  END as value
UNION ALL
SELECT
  'Backup Verification',
  'Backup Record Count',
  (SELECT COUNT(*) FROM users_emoji_backup)::text
UNION ALL
SELECT
  'Backup Verification',
  'Mapping Table Exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'emoji_subway_mapping'
    ) THEN 'YES'
    ELSE 'NO'
  END;

-- ============================================================================
-- POST-STEP-3 VALIDATION (After function updates)
-- ============================================================================

-- Verify functions were updated
SELECT
  'Function Verification' as check_name,
  routine_name as function_name,
  'EXISTS' as status
FROM information_schema.routines
WHERE routine_name IN (
  'get_or_create_user',
  'get_subway_identity',
  'get_posts_paginated',
  'get_comments_tree'
)
ORDER BY routine_name;

-- Verify views were updated
SELECT
  'View Verification' as check_name,
  table_name as view_name,
  'EXISTS' as status
FROM information_schema.views
WHERE table_name IN (
  'anonymous_users',
  'anonymous_users_with_activity',
  'hot_posts'
)
ORDER BY table_name;

-- Test function behavior (sample test)
-- This will create and then remove a test user to verify function works
DO $$
DECLARE
  test_user_record RECORD;
  test_device_id TEXT := 'migration_test_' || extract(epoch from now())::text;
BEGIN
  -- Test get_or_create_user function
  SELECT * INTO test_user_record FROM get_or_create_user(test_device_id);

  IF test_user_record.subway_line IS NULL OR test_user_record.subway_color IS NULL THEN
    RAISE EXCEPTION 'Function test FAILED: get_or_create_user returned null subway values';
  END IF;

  -- Clean up test user
  DELETE FROM users WHERE device_id = test_device_id;

  RAISE NOTICE 'Function test PASSED: get_or_create_user works correctly';
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    DELETE FROM users WHERE device_id = test_device_id;
    RAISE;
END;
$$;

-- ============================================================================
-- POST-STEP-4 VALIDATION (After dropping legacy columns)
-- ============================================================================

-- Verify legacy columns were dropped
SELECT
  'Column Drop Verification' as check_name,
  'Emoji Column Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'emoji'
    ) THEN 'YES (NOT DROPPED)'
    ELSE 'NO (DROPPED)'
  END as value
UNION ALL
SELECT
  'Column Drop Verification',
  'Color Column Exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'color'
    ) THEN 'YES (NOT DROPPED)'
    ELSE 'NO (DROPPED)'
  END;

-- Final comprehensive validation
SELECT
  'Final Validation' as check_name,
  'Total Users' as metric,
  COUNT(*)::text as value
FROM users
UNION ALL
SELECT
  'Final Validation',
  'Users with Complete Subway Data',
  COUNT(CASE WHEN subway_line IS NOT NULL AND subway_color IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Final Validation',
  'Unique Subway Lines in Use',
  COUNT(DISTINCT subway_line)::text
FROM users
UNION ALL
SELECT
  'Final Validation',
  'Unique Subway Colors in Use',
  COUNT(DISTINCT subway_color)::text
FROM users;

-- ============================================================================
-- CONTINUOUS MONITORING QUERIES (Run periodically after migration)
-- ============================================================================

-- User identity distribution after migration
SELECT
  subway_line,
  subway_color,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM users
GROUP BY subway_line, subway_color
ORDER BY user_count DESC;

-- Monitor for any data anomalies
SELECT
  'Data Anomaly Check' as check_name,
  'Users with Null Subway Line' as metric,
  COUNT(CASE WHEN subway_line IS NULL THEN 1 END)::text as value
FROM users
UNION ALL
SELECT
  'Data Anomaly Check',
  'Users with Null Subway Color',
  COUNT(CASE WHEN subway_color IS NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Data Anomaly Check',
  'Users with Invalid Subway Line',
  COUNT(CASE WHEN subway_line NOT IN ('A','B','G','J','L','N','1','4','7','T') THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Data Anomaly Check',
  'Users with Invalid Subway Color',
  COUNT(CASE WHEN subway_color NOT IN ('mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey','mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal') THEN 1 END)::text
FROM users;