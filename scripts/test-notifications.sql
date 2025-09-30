-- ============================================================================
-- YipYap Notification System - Test & Verification Script
-- ============================================================================
-- This script tests the notification system after applying the migration
-- Run this script to verify everything works correctly
-- ============================================================================

\echo '============================================================================'
\echo 'YipYap Notification System - Verification Tests'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- TEST 1: Verify Table Exists
-- ============================================================================

\echo 'TEST 1: Checking if notifications table exists...'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
    THEN '✅ PASS: Notifications table exists'
    ELSE '❌ FAIL: Notifications table not found'
  END as result;

\echo ''

-- ============================================================================
-- TEST 2: Verify Indexes Exist
-- ============================================================================

\echo 'TEST 2: Checking indexes...'
SELECT
  indexname,
  CASE
    WHEN indexname IS NOT NULL
    THEN '✅ ' || indexname
    ELSE '❌ Index missing'
  END as status
FROM pg_indexes
WHERE tablename = 'notifications'
  AND schemaname = 'public'
ORDER BY indexname;

\echo ''

-- Expected indexes:
-- idx_notifications_cleanup
-- idx_notifications_comment_id
-- idx_notifications_post_id
-- idx_notifications_user_active_created
-- idx_notifications_user_unread_count
-- idx_notifications_user_unread_created

-- ============================================================================
-- TEST 3: Verify Constraints
-- ============================================================================

\echo 'TEST 3: Checking constraints...'
SELECT
  conname as constraint_name,
  '✅ ' || conname as status
FROM pg_constraint
WHERE conrelid = 'notifications'::regclass
  AND contype IN ('c', 'u', 'f')  -- check, unique, foreign key
ORDER BY conname;

\echo ''

-- ============================================================================
-- TEST 4: Verify RPC Functions Exist
-- ============================================================================

\echo 'TEST 4: Checking RPC functions...'
SELECT
  routine_name,
  CASE
    WHEN routine_name IS NOT NULL
    THEN '✅ ' || routine_name
    ELSE '❌ Function missing'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'rpc_get_notifications',
    'rpc_get_unread_count',
    'rpc_mark_notifications_read',
    'rpc_delete_notifications',
    'cleanup_old_notifications',
    'create_reply_notification'
  )
ORDER BY routine_name;

\echo ''

-- ============================================================================
-- TEST 5: Verify Trigger Exists
-- ============================================================================

\echo 'TEST 5: Checking triggers...'
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  '✅ ' || trigger_name as status
FROM information_schema.triggers
WHERE trigger_name = 'trg_comment_reply_notification'
  AND event_object_schema = 'public';

\echo ''

-- ============================================================================
-- TEST 6: Verify RLS Policies
-- ============================================================================

\echo 'TEST 6: Checking RLS policies...'
SELECT
  policyname,
  cmd,
  '✅ ' || policyname as status
FROM pg_policies
WHERE tablename = 'notifications'
  AND schemaname = 'public';

\echo ''

-- ============================================================================
-- TEST 7: Verify Realtime Publication
-- ============================================================================

\echo 'TEST 7: Checking realtime publication...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'notifications'
    )
    THEN '✅ PASS: Notifications in realtime publication'
    ELSE '⚠️  WARN: Notifications not in realtime publication (may need manual config)'
  END as result;

\echo ''

-- ============================================================================
-- TEST 8: Test Notification Creation (Manual)
-- ============================================================================

\echo 'TEST 8: Testing notification creation (requires existing data)...'
\echo 'This test requires:'
\echo '  1. At least 2 users exist'
\echo '  2. At least 1 post exists'
\echo 'Skipping automatic test. Manual test instructions:'
\echo ''
\echo '  -- Get test data'
\echo '  SELECT id as user_id FROM users LIMIT 2;'
\echo '  SELECT id as post_id FROM posts LIMIT 1;'
\echo ''
\echo '  -- Create test comment (should trigger notification)'
\echo '  SELECT rpc_create_comment('
\echo '    ''USER_A_UUID''::uuid,  -- Commenter'
\echo '    ''POST_UUID''::uuid,     -- Post'
\echo '    NULL,                    -- No parent (reply to post)'
\echo '    ''Test notification'''   -- Content'
\echo '  );'
\echo ''
\echo '  -- Verify notification created'
\echo '  SELECT * FROM notifications WHERE user_id = ''POST_OWNER_UUID''::uuid;'
\echo ''

-- ============================================================================
-- TEST 9: Test RPC Functions (Read-Only)
-- ============================================================================

\echo 'TEST 9: Testing RPC functions (requires existing user)...'

DO $$
DECLARE
  test_user_id uuid;
  unread_count int;
  result_count int;
BEGIN
  -- Get first user
  SELECT id INTO test_user_id FROM users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  SKIP: No users exist, cannot test RPCs';
    RETURN;
  END IF;

  -- Test rpc_get_unread_count
  BEGIN
    SELECT rpc_get_unread_count(test_user_id) INTO unread_count;
    RAISE NOTICE '✅ PASS: rpc_get_unread_count() works (returned %)', unread_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FAIL: rpc_get_unread_count() error: %', SQLERRM;
  END;

  -- Test rpc_get_notifications
  BEGIN
    SELECT count(*) INTO result_count FROM rpc_get_notifications(test_user_id, 20, NULL, false);
    RAISE NOTICE '✅ PASS: rpc_get_notifications() works (returned % rows)', result_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FAIL: rpc_get_notifications() error: %', SQLERRM;
  END;
END $$;

\echo ''

-- ============================================================================
-- TEST 10: Performance Check
-- ============================================================================

\echo 'TEST 10: Basic performance check...'

DO $$
DECLARE
  test_user_id uuid;
  start_time timestamp;
  end_time timestamp;
  duration_ms numeric;
BEGIN
  -- Get first user
  SELECT id INTO test_user_id FROM users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  SKIP: No users exist, cannot test performance';
    RETURN;
  END IF;

  -- Test unread count performance
  start_time := clock_timestamp();
  PERFORM rpc_get_unread_count(test_user_id);
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));

  IF duration_ms < 2 THEN
    RAISE NOTICE '✅ PASS: rpc_get_unread_count() performance (%.3f ms) < 2ms', duration_ms;
  ELSE
    RAISE NOTICE '⚠️  WARN: rpc_get_unread_count() slow (%.3f ms) - expected <2ms', duration_ms;
  END IF;

  -- Test get notifications performance
  start_time := clock_timestamp();
  PERFORM * FROM rpc_get_notifications(test_user_id, 20, NULL, false);
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));

  IF duration_ms < 50 THEN
    RAISE NOTICE '✅ PASS: rpc_get_notifications() performance (%.3f ms) < 50ms', duration_ms;
  ELSE
    RAISE NOTICE '⚠️  WARN: rpc_get_notifications() slow (%.3f ms) - expected <50ms', duration_ms;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 11: Index Usage Check
-- ============================================================================

\echo 'TEST 11: Checking index usage (requires notifications to exist)...'

SELECT
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  CASE
    WHEN idx_scan > 0 THEN '✅ Index used'
    ELSE '⚠️  Not yet used (run some queries first)'
  END as status
FROM pg_stat_user_indexes
WHERE tablename = 'notifications'
  AND schemaname = 'public'
ORDER BY idx_scan DESC;

\echo ''

-- ============================================================================
-- TEST 12: Table Statistics
-- ============================================================================

\echo 'TEST 12: Table statistics...'

SELECT
  (SELECT count(*) FROM notifications) as total_notifications,
  (SELECT count(*) FROM notifications WHERE deleted_at IS NULL) as active_notifications,
  (SELECT count(*) FROM notifications WHERE read_at IS NULL AND deleted_at IS NULL) as unread_notifications,
  (SELECT pg_size_pretty(pg_total_relation_size('notifications'))) as table_size;

\echo ''

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

\echo '============================================================================'
\echo 'Test Summary'
\echo '============================================================================'

SELECT
  'Tests completed. Review results above.' as summary,
  'Expected: All core tests should PASS' as expected,
  'Warnings: Some tests may SKIP or WARN if no data exists yet' as note;

\echo ''
\echo 'Next Steps:'
\echo '  1. If all core tests pass, migration was successful'
\echo '  2. Create test data and run manual tests (TEST 8)'
\echo '  3. Test frontend integration'
\echo '  4. Monitor performance in production'
\echo ''
\echo 'For detailed testing instructions, see:'
\echo '  docs/NOTIFICATION_PERFORMANCE.md'
\echo '  docs/NOTIFICATION_QUERIES.sql'
\echo ''

-- ============================================================================
-- OPTIONAL: Generate Test Data
-- ============================================================================

\echo '============================================================================'
\echo 'Optional: Generate Test Data'
\echo '============================================================================'
\echo ''
\echo 'To generate test notifications for performance testing, run:'
\echo ''
\echo '  SELECT generate_test_notifications(100, 50);'
\echo ''
\echo 'This will create 5,000 test notifications (100 users × 50 each)'
\echo 'WARNING: Only run this in development/staging environments!'
\echo ''
\echo '============================================================================'
