-- Migration: Add Missing Foreign Key Indexes
-- Priority: HIGH
-- Impact: 10-100x faster JOIN queries, faster DELETE cascades
--
-- Issue: Foreign keys without supporting indexes cause sequential scans
-- on JOIN operations and slow CASCADE deletes under load.
--
-- This migration adds indexes to all foreign key columns that lack them.

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

-- Index for actor_user_id foreign key
-- Supports: JOINs on notifications.actor_user_id = users.id
-- Used by: Notification aggregations, user activity queries
CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id
  ON notifications(actor_user_id)
  WHERE actor_user_id IS NOT NULL;

COMMENT ON INDEX idx_notifications_actor_user_id IS
  'Optimizes JOINs between notifications and users on actor_user_id';


-- ============================================================================
-- PUSH_NOTIFICATION_DELIVERY_LOG TABLE
-- ============================================================================

-- Index for subscription_id foreign key
-- Supports: JOINs on delivery_log.subscription_id = push_subscriptions.id
-- Used by: Delivery tracking, subscription analytics
CREATE INDEX IF NOT EXISTS idx_push_delivery_subscription_id
  ON push_notification_delivery_log(subscription_id);

COMMENT ON INDEX idx_push_delivery_subscription_id IS
  'Optimizes JOINs between delivery log and push subscriptions';


-- ============================================================================
-- THREAD_IDENTITY_REROLLS TABLE
-- ============================================================================

-- Index for post_id foreign key
-- Supports: JOINs on rerolls.post_id = posts.id
-- Used by: Checking reroll eligibility, CASCADE deletes
CREATE INDEX IF NOT EXISTS idx_thread_identity_rerolls_post_id
  ON thread_identity_rerolls(post_id);

COMMENT ON INDEX idx_thread_identity_rerolls_post_id IS
  'Optimizes JOINs and CASCADE deletes for thread identity rerolls';


-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

-- Update query planner statistics for all affected tables
ANALYZE notifications;
ANALYZE push_notification_delivery_log;
ANALYZE thread_identity_rerolls;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this query to verify all foreign keys now have supporting indexes:
--
-- SELECT
--   c.conrelid::regclass AS table_name,
--   string_agg(a.attname, ', ') AS foreign_key_columns,
--   c.confrelid::regclass AS references_table,
--   CASE
--     WHEN EXISTS (
--       SELECT 1 FROM pg_index i
--       WHERE i.indrelid = c.conrelid
--         AND c.conkey[1] = i.indkey[0]
--     ) THEN '✅ Indexed'
--     ELSE '⚠️ Missing Index'
--   END as index_status
-- FROM pg_constraint c
-- JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
-- WHERE c.contype = 'f'
--   AND c.conrelid::regclass::text LIKE 'public.%'
-- GROUP BY c.conrelid, c.contype, c.conname, c.confrelid, c.conkey
-- ORDER BY c.conrelid::regclass::text;
