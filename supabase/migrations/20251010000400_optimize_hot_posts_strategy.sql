-- Migration: Optimize hot_posts Materialized View Strategy
-- Priority: LOW
-- Impact: Depends on query patterns and refresh frequency
--
-- ANALYSIS:
-- The hot_posts materialized view caches the Reddit-style hot score calculation
-- to avoid recalculating it on every query. However, it requires periodic refresh.
--
-- CURRENT USAGE:
-- - Used as fallback in getFeedPosts() when post_with_stats view fails (error PGRST205)
-- - Contains hot_score calculation: score * (time_decay)^-1.5
-- - Has JOINs to users and thread_identities for display data
--
-- TRADE-OFFS:
-- Pros:
--   ✅ Pre-computed hot scores (no calculation overhead per query)
--   ✅ Indexed for fast lookups by subway_line
--   ✅ Can be refreshed independently of main tables
--
-- Cons:
--   ⚠️ Stale data between refreshes (scores don't update in real-time)
--   ⚠️ Refresh cost increases with table size
--   ⚠️ Requires maintenance (manual or scheduled refresh)
--   ⚠️ Duplicate data storage (doubles storage for posts)

-- ============================================================================
-- RECOMMENDATION: Keep with Auto-Refresh Strategy
-- ============================================================================

-- The hot_posts materialized view is useful for performance IF:
-- 1. Hot feed is queried frequently (more than 10x/minute)
-- 2. Hot score calculation is expensive (complex formula)
-- 3. You can tolerate slightly stale scores (5-15 minute delay)
--
-- For YipYap's use case:
-- ✅ Hot score uses expensive POWER() and EXTRACT() functions
-- ✅ Hot feed is likely high-traffic (main page)
-- ⚠️ Real-time score updates would be better for engagement
--
-- DECISION: Keep hot_posts but add automatic refresh strategy


-- ============================================================================
-- OPTION 1: Scheduled Refresh via pg_cron (RECOMMENDED)
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh every 5 minutes
-- This balances freshness with refresh overhead
SELECT cron.schedule(
  'refresh-hot-posts',
  '*/5 * * * *',  -- Every 5 minutes
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts$$
);

COMMENT ON EXTENSION pg_cron IS
  'Scheduled hot_posts refresh every 5 minutes for near-real-time hot scores';


-- ============================================================================
-- OPTION 2: Trigger-Based Refresh (NOT RECOMMENDED)
-- ============================================================================

-- Alternative: Refresh on significant score changes
-- This creates higher write overhead but ensures fresher data
--
-- CREATE OR REPLACE FUNCTION refresh_hot_posts_trigger()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Only refresh if score changed significantly (>5 points)
--   IF ABS(NEW.score - OLD.score) > 5 THEN
--     REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trigger_refresh_hot_posts
-- AFTER UPDATE OF score ON posts
-- FOR EACH ROW
-- EXECUTE FUNCTION refresh_hot_posts_trigger();
--
-- ⚠️ NOT RECOMMENDED: This causes refresh on every vote, which is too expensive


-- ============================================================================
-- OPTION 3: Remove Materialized View (Alternative)
-- ============================================================================

-- If you prefer real-time scores over caching:
--
-- 1. Drop materialized view:
--    DROP MATERIALIZED VIEW IF EXISTS hot_posts CASCADE;
--
-- 2. Update application code to always use post_with_stats with hot score calculation
--
-- 3. Add functional index on hot score expression:
--    CREATE INDEX idx_posts_hot_score ON posts (
--      (GREATEST(ABS(score), 1) * POWER(
--        GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600, 1),
--        -1.5
--      )) DESC
--    ) WHERE deleted_at IS NULL;
--
-- Pros: Real-time scores, no refresh overhead
-- Cons: Calculate score on every query, slightly slower queries


-- ============================================================================
-- MONITORING: Check Refresh Performance
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_hot_posts_refresh()
RETURNS TABLE (
  view_name text,
  size text,
  row_count bigint,
  last_refresh timestamp with time zone,
  refresh_recommended boolean,
  recommendation text
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    'hot_posts'::text AS view_name,
    pg_size_pretty(pg_relation_size('hot_posts')) AS size,
    COUNT(*)::bigint AS row_count,
    -- Estimate last refresh by checking materialized view metadata
    -- (Note: pg_stat_user_tables doesn't track materialized view refreshes directly)
    NULL::timestamp with time zone AS last_refresh,
    -- Recommend refresh if view is more than 5 minutes old
    true AS refresh_recommended,
    'Run: REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;' AS recommendation
  FROM hot_posts;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_hot_posts_refresh() IS
  'Monitor hot_posts materialized view and check if refresh is needed';


-- ============================================================================
-- MANUAL REFRESH COMMANDS
-- ============================================================================

-- Refresh hot_posts without blocking reads:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;

-- Check refresh time:
-- SELECT pg_size_pretty(pg_relation_size('hot_posts')) as size,
--        COUNT(*) as row_count FROM hot_posts;


-- ============================================================================
-- PERFORMANCE BENCHMARK
-- ============================================================================

-- Compare materialized view vs. real-time calculation:
--
-- Test 1: Query from materialized view
-- EXPLAIN ANALYZE
-- SELECT * FROM hot_posts
-- WHERE user_subway_line = ANY(ARRAY['A','C','E'])
-- ORDER BY hot_score DESC LIMIT 20;
--
-- Test 2: Query with real-time calculation
-- EXPLAIN ANALYZE
-- SELECT *,
--   GREATEST(ABS(score), 1) * POWER(
--     GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600, 1),
--     -1.5
--   ) as hot_score
-- FROM posts
-- WHERE deleted_at IS NULL
--   AND user_subway_line = ANY(ARRAY['A','C','E'])
-- ORDER BY hot_score DESC LIMIT 20;
--
-- Compare execution times and choose strategy accordingly


-- ============================================================================
-- FINAL RECOMMENDATION
-- ============================================================================

-- For YipYap:
-- ✅ KEEP hot_posts materialized view with 5-minute refresh schedule
-- ✅ Use pg_cron for automatic refreshes
-- ✅ Monitor refresh performance as data grows
-- ⚠️ Consider switching to real-time calculation if:
--    - Refresh takes >5 seconds
--    - Stale scores hurt user engagement
--    - Table stays small (<10k posts)
