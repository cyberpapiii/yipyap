-- ============================================================================
-- YipYap Notification System - Query Reference
-- ============================================================================
-- Quick reference for common notification queries and operations
-- ============================================================================

-- ============================================================================
-- 1. BASIC NOTIFICATION QUERIES
-- ============================================================================

-- Get user's unread notifications (most recent first)
SELECT
  n.id,
  n.type,
  n.actor_subway_line,
  n.content_preview,
  n.created_at
FROM notifications n
WHERE n.user_id = 'USER_UUID_HERE'
  AND n.read_at IS NULL
  AND n.deleted_at IS NULL
ORDER BY n.created_at DESC
LIMIT 20;

-- Get user's unread count (for badge)
SELECT count(*) as unread_count
FROM notifications
WHERE user_id = 'USER_UUID_HERE'
  AND read_at IS NULL
  AND deleted_at IS NULL;

-- Get notification feed with post/comment context (use RPC instead)
SELECT * FROM rpc_get_notifications(
  'USER_UUID_HERE'::uuid,  -- p_user
  20,                       -- p_limit
  NULL,                     -- p_cursor (NULL for first page)
  false                     -- p_unread_only
);

-- Get only unread notifications
SELECT * FROM rpc_get_notifications(
  'USER_UUID_HERE'::uuid,
  20,
  NULL,
  true  -- unread_only = true
);

-- ============================================================================
-- 2. MARKING NOTIFICATIONS AS READ
-- ============================================================================

-- Mark specific notification as read (use RPC)
SELECT rpc_mark_notifications_read(
  'USER_UUID_HERE'::uuid,
  ARRAY['NOTIFICATION_UUID_1']::uuid[]
);

-- Mark multiple notifications as read
SELECT rpc_mark_notifications_read(
  'USER_UUID_HERE'::uuid,
  ARRAY['NOTIF_UUID_1', 'NOTIF_UUID_2', 'NOTIF_UUID_3']::uuid[]
);

-- Mark ALL notifications as read
SELECT rpc_mark_notifications_read(
  'USER_UUID_HERE'::uuid,
  NULL  -- NULL means mark all
);

-- ============================================================================
-- 3. DELETING NOTIFICATIONS (SOFT DELETE)
-- ============================================================================

-- Soft delete specific notifications (use RPC)
SELECT rpc_delete_notifications(
  'USER_UUID_HERE'::uuid,
  ARRAY['NOTIFICATION_UUID_1', 'NOTIFICATION_UUID_2']::uuid[]
);

-- ============================================================================
-- 4. ANALYTICS & DEBUGGING QUERIES
-- ============================================================================

-- Count notifications by type for a user
SELECT
  type,
  count(*) as total,
  count(*) FILTER (WHERE read_at IS NULL) as unread,
  count(*) FILTER (WHERE read_at IS NOT NULL) as read
FROM notifications
WHERE user_id = 'USER_UUID_HERE'
  AND deleted_at IS NULL
GROUP BY type
ORDER BY total DESC;

-- Find users with most unread notifications (detect spam/problems)
SELECT
  u.subway_line,
  u.subway_color,
  count(*) as unread_count
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.read_at IS NULL
  AND n.deleted_at IS NULL
GROUP BY u.id, u.subway_line, u.subway_color
ORDER BY unread_count DESC
LIMIT 20;

-- Find most active notification generators (who's generating most notifications)
SELECT
  u.subway_line,
  u.subway_color,
  count(*) as notifications_generated
FROM notifications n
JOIN users u ON n.actor_id = u.id
WHERE n.created_at > now() - interval '7 days'
  AND n.deleted_at IS NULL
GROUP BY u.id, u.subway_line, u.subway_color
ORDER BY notifications_generated DESC
LIMIT 20;

-- Get notification activity over time (daily breakdown)
SELECT
  date_trunc('day', created_at) as day,
  type,
  count(*) as count
FROM notifications
WHERE created_at > now() - interval '30 days'
GROUP BY date_trunc('day', created_at), type
ORDER BY day DESC, count DESC;

-- ============================================================================
-- 5. FINDING ORPHANED OR PROBLEMATIC NOTIFICATIONS
-- ============================================================================

-- Find notifications for deleted posts
SELECT
  n.id,
  n.type,
  n.post_id,
  n.created_at
FROM notifications n
JOIN posts p ON n.post_id = p.id
WHERE p.deleted_at IS NOT NULL
  AND n.deleted_at IS NULL
LIMIT 100;

-- Find notifications for deleted comments
SELECT
  n.id,
  n.type,
  n.comment_id,
  n.created_at
FROM notifications n
JOIN comments c ON n.comment_id = c.id
WHERE c.deleted_at IS NOT NULL
  AND n.deleted_at IS NULL
LIMIT 100;

-- Find duplicate notifications (shouldn't exist due to UNIQUE constraint)
SELECT
  user_id,
  type,
  post_id,
  comment_id,
  actor_id,
  count(*) as duplicate_count
FROM notifications
WHERE deleted_at IS NULL
GROUP BY user_id, type, post_id, comment_id, actor_id
HAVING count(*) > 1;

-- ============================================================================
-- 6. CLEANUP & MAINTENANCE
-- ============================================================================

-- Count notifications by age (for cleanup planning)
SELECT
  CASE
    WHEN created_at > now() - interval '1 day' THEN '< 1 day'
    WHEN created_at > now() - interval '7 days' THEN '1-7 days'
    WHEN created_at > now() - interval '30 days' THEN '7-30 days'
    ELSE '> 30 days'
  END as age_bucket,
  count(*) as count
FROM notifications
WHERE deleted_at IS NULL
GROUP BY age_bucket
ORDER BY age_bucket;

-- Manually cleanup old notifications (use function instead)
SELECT cleanup_old_notifications();

-- Manually delete notifications older than 30 days (if cleanup function not working)
DELETE FROM notifications
WHERE created_at < now() - interval '30 days';

-- Soft delete all notifications for deleted posts (cleanup orphans)
UPDATE notifications n
SET deleted_at = now()
FROM posts p
WHERE n.post_id = p.id
  AND p.deleted_at IS NOT NULL
  AND n.deleted_at IS NULL;

-- Soft delete all notifications for deleted comments (cleanup orphans)
UPDATE notifications n
SET deleted_at = now()
FROM comments c
WHERE n.comment_id = c.id
  AND c.deleted_at IS NOT NULL
  AND n.deleted_at IS NULL;

-- ============================================================================
-- 7. PERFORMANCE ANALYSIS
-- ============================================================================

-- Check index usage for notifications table
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'notifications'
ORDER BY idx_scan DESC;

-- Get table size and index sizes
SELECT
  pg_size_pretty(pg_total_relation_size('notifications')) as total_size,
  pg_size_pretty(pg_relation_size('notifications')) as table_size,
  pg_size_pretty(pg_total_relation_size('notifications') - pg_relation_size('notifications')) as indexes_size;

-- Get most recent query plans for notification queries
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM rpc_get_notifications(
  'USER_UUID_HERE'::uuid,
  20,
  NULL,
  false
);

-- Check for table bloat (needs maintenance if ratio > 2)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_dead_tup,
  n_live_tup,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE tablename = 'notifications';

-- ============================================================================
-- 8. TESTING & DEVELOPMENT
-- ============================================================================

-- Manually create a test notification (for development)
INSERT INTO notifications (
  user_id,
  type,
  post_id,
  comment_id,
  actor_id,
  actor_subway_line,
  actor_subway_color,
  content_preview
) VALUES (
  'TARGET_USER_UUID'::uuid,
  'reply_post',
  'POST_UUID'::uuid,
  'COMMENT_UUID'::uuid,  -- NULL for reply_post
  'ACTOR_USER_UUID'::uuid,
  'A',
  '#0039A6',
  'This is a test notification preview...'
);

-- Get sample notification data for testing UI
SELECT
  n.id,
  n.type,
  n.actor_subway_line,
  n.actor_subway_color,
  n.content_preview,
  n.read_at,
  n.created_at,
  p.content as post_content,
  c.content as comment_content
FROM notifications n
JOIN posts p ON n.post_id = p.id
LEFT JOIN comments c ON n.comment_id = c.id
WHERE n.deleted_at IS NULL
ORDER BY n.created_at DESC
LIMIT 5;

-- Count notifications per user (distribution analysis)
SELECT
  count(*) as notification_count,
  count(DISTINCT user_id) as user_count,
  avg(cnt) as avg_per_user,
  max(cnt) as max_per_user,
  min(cnt) as min_per_user
FROM (
  SELECT user_id, count(*) as cnt
  FROM notifications
  WHERE deleted_at IS NULL
  GROUP BY user_id
) subquery;

-- ============================================================================
-- 9. REALTIME TESTING
-- ============================================================================

-- Check if notifications table is in realtime publication
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'notifications';

-- Add notifications to realtime publication (if missing)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Remove from realtime publication (if needed)
ALTER PUBLICATION supabase_realtime DROP TABLE notifications;

-- ============================================================================
-- 10. MIGRATION & ROLLBACK
-- ============================================================================

-- Check if notifications table exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'notifications'
);

-- Check if notification RPCs exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%notification%'
ORDER BY routine_name;

-- Drop notification system (DANGER: for rollback only)
-- Uncomment to execute:
/*
DROP TRIGGER IF EXISTS trg_comment_reply_notification ON comments;
DROP FUNCTION IF EXISTS trigger_create_reply_notification();
DROP FUNCTION IF EXISTS create_reply_notification(uuid);
DROP FUNCTION IF EXISTS create_vote_threshold_notification(uuid, uuid, uuid, int, int);
DROP FUNCTION IF EXISTS rpc_mark_notifications_read(uuid, uuid[]);
DROP FUNCTION IF EXISTS rpc_delete_notifications(uuid, uuid[]);
DROP FUNCTION IF EXISTS rpc_get_notifications(uuid, int, timestamptz, boolean);
DROP FUNCTION IF EXISTS rpc_get_unread_count(uuid);
DROP FUNCTION IF EXISTS cleanup_old_notifications();
DROP TABLE IF EXISTS notifications;
*/

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- 1. Always use RPCs for write operations (mark_read, delete)
--    Direct UPDATEs bypass RLS and rate limiting
--
-- 2. Use cursor-based pagination for large notification lists:
--    Pass the last notification's created_at as p_cursor
--
-- 3. For analytics queries, consider creating read replicas
--    to avoid impacting production performance
--
-- 4. Monitor index usage regularly and rebuild if needed:
--    REINDEX TABLE notifications;
--
-- 5. Run VACUUM ANALYZE after bulk operations:
--    VACUUM ANALYZE notifications;
--
-- ============================================================================
