-- POST-MIGRATION VALIDATION FOR PRODUCTION
-- Comprehensive validation after applying subway migration

\echo '=== PRODUCTION POST-MIGRATION VALIDATION ==='

-- Check migration success
SELECT
  'Migration Status' as check_name,
  'Total Users' as metric,
  COUNT(*)::text as value
FROM users
UNION ALL
SELECT
  'Migration Status',
  'Users with Subway Line',
  COUNT(CASE WHEN subway_line IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Migration Status',
  'Users with Subway Color',
  COUNT(CASE WHEN subway_color IS NOT NULL THEN 1 END)::text
FROM users
UNION ALL
SELECT
  'Migration Status',
  'Users Missing Subway Data',
  COUNT(CASE WHEN subway_line IS NULL OR subway_color IS NULL THEN 1 END)::text
FROM users;

-- Verify backup table exists
SELECT
  'Backup Verification' as check_name,
  'Backup Table Exists' as metric,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'users_emoji_backup'
    ) THEN 'YES'
    ELSE 'NO - ROLLBACK NOT POSSIBLE!'
  END as value
UNION ALL
SELECT
  'Backup Verification',
  'Backup Record Count',
  COALESCE((SELECT COUNT(*) FROM users_emoji_backup)::text, 'N/A');

-- Show final subway distribution
SELECT
  'Final Distribution' as section,
  subway_line,
  subway_color,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) || '%' as percentage
FROM users
GROUP BY subway_line, subway_color
ORDER BY user_count DESC;

-- Verify mapping was preserved for known combinations
SELECT
  'Mapping Verification' as section,
  'Known Mappings' as check_type,
  COUNT(CASE
    WHEN (emoji = '🎭' AND color = 'purple' AND subway_line = 'A' AND subway_color = 'mta-blue') OR
         (emoji = '🦄' AND color = 'blue' AND subway_line = 'B' AND subway_color = 'mta-orange') OR
         (emoji = '🚀' AND color = 'green' AND subway_line = 'G' AND subway_color = 'mta-light-green') OR
         (emoji = '🌟' AND color = 'orange' AND subway_line = 'J' AND subway_color = 'mta-brown') OR
         (emoji = '🔥' AND color = 'red' AND subway_line = 'L' AND subway_color = 'mta-grey') OR
         (emoji = '💫' AND color = 'purple' AND subway_line = 'N' AND subway_color = 'mta-yellow') OR
         (emoji = '🎨' AND color = 'blue' AND subway_line = '1' AND subway_color = 'mta-red') OR
         (emoji = '🌈' AND color = 'green' AND subway_line = '4' AND subway_color = 'mta-dark-green') OR
         (emoji = '⚡' AND color = 'orange' AND subway_line = '7' AND subway_color = 'mta-purple') OR
         (emoji = '🎪' AND color = 'red' AND subway_line = 'T' AND subway_color = 'mta-teal')
    THEN 1 END)::text || ' correctly mapped' as value,
  'N/A' as user_count,
  'N/A' as percentage;

-- Check for fallback mappings (unmapped combinations)
SELECT
  'Fallback Mappings' as section,
  emoji,
  color,
  subway_line,
  subway_color,
  COUNT(*) as user_count
FROM users
WHERE (emoji, color) NOT IN (
  ('🎭', 'purple'), ('🦄', 'blue'), ('🚀', 'green'), ('🌟', 'orange'), ('🔥', 'red'),
  ('💫', 'purple'), ('🎨', 'blue'), ('🌈', 'green'), ('⚡', 'orange'), ('🎪', 'red')
)
GROUP BY emoji, color, subway_line, subway_color
ORDER BY user_count DESC;

-- Verify functions exist and work
SELECT
  'Function Verification' as section,
  routine_name as function_name,
  'EXISTS' as status,
  0 as user_count,
  'N/A' as percentage
FROM information_schema.routines
WHERE routine_name IN (
  'get_or_create_user',
  'get_subway_identity',
  'get_posts_paginated',
  'get_comments_tree'
)
ORDER BY routine_name;

-- Test get_or_create_user function
\echo '=== TESTING get_or_create_user FUNCTION ==='
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

  RAISE NOTICE 'Function test PASSED: New user created with subway_line=% subway_color=%',
               test_user_record.subway_line, test_user_record.subway_color;

  -- Clean up test user
  DELETE FROM users WHERE device_id = test_device_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on error
    DELETE FROM users WHERE device_id = test_device_id;
    RAISE;
END;
$$;

\echo '=== MIGRATION VALIDATION COMPLETE ==='
\echo 'Production database successfully migrated to subway system!';