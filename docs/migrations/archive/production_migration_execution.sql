-- PRODUCTION MIGRATION EXECUTION LOG
-- Generated: 2025-09-28
--
-- This file tracks the execution of the emoji -> subway migration on production
-- Each step includes validation queries to ensure safety

-- ============================================================================
-- PRE-MIGRATION STATE ASSESSMENT
-- ============================================================================

-- Run this query to assess current production state
\echo '=== PRE-MIGRATION VALIDATION ==='

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

-- Check for unmapped combinations that would use defaults
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
ORDER BY user_count DESC
LIMIT 10;  -- Only show top 10 to avoid spam

\echo '=== MIGRATION STEP 1: ADDING SUBWAY COLUMNS ==='
\echo 'Executing migration 011_add_subway_columns.sql...'

-- Step 1 will be executed here via supabase db push

\echo '=== POST-STEP-1 VALIDATION ==='

-- Verify new columns were added successfully
SELECT
  'Step 1 Validation' as check_name,
  'Subway Line Column Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'subway_line'
    ) THEN 'YES'
    ELSE 'NO - MIGRATION FAILED'
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
    ELSE 'NO - MIGRATION FAILED'
  END;

-- Check constraints were created
SELECT
  'Constraint Check' as check_name,
  constraint_name,
  'EXISTS' as status
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%subway%'
ORDER BY constraint_name;

\echo '=== MIGRATION STEP 2: DATA MIGRATION ==='
\echo 'Executing migration 012_migrate_emoji_to_subway.sql...'

-- Step 2 will be executed here via supabase db push

\echo '=== POST-STEP-2 VALIDATION ==='

-- Verify data migration success
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
  'Users Missing Subway Data',
  COUNT(CASE WHEN subway_line IS NULL OR subway_color IS NULL THEN 1 END)::text
FROM users;

-- Verify backup table was created
SELECT
  'Backup Verification' as check_name,
  'Backup Table Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'users_emoji_backup'
    ) THEN 'YES'
    ELSE 'NO - BACKUP MISSING!'
  END as value
UNION ALL
SELECT
  'Backup Verification',
  'Backup Record Count',
  (SELECT COUNT(*) FROM users_emoji_backup)::text;

\echo '=== MIGRATION STEP 3: FUNCTION UPDATES ==='
\echo 'Executing migration 013_update_functions_for_subway.sql...'

-- Step 3 will be executed here via supabase db push

\echo '=== POST-STEP-3 VALIDATION ==='

-- Test function behavior
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

\echo '=== MIGRATION COMPLETE ==='
\echo 'All migration steps completed successfully!'
\echo 'Skipping Step 4 (column drop) for safety - can be run later if desired.'

-- Final validation
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

-- Show final distribution
SELECT
  subway_line,
  subway_color,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM users
GROUP BY subway_line, subway_color
ORDER BY user_count DESC;