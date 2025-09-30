-- Migration: Add indexes for subway line community filtering
-- Part 2 of 4: Create composite indexes for optimal query performance
--
-- INDEX STRATEGY:
-- 1. idx_posts_subway_line_hot: Hot feed filtered by community (most important)
--    Supports: WHERE subway_line = ANY(...) ORDER BY score DESC, created_at DESC
-- 2. idx_posts_subway_line_new: New feed filtered by community
--    Supports: WHERE subway_line = ANY(...) ORDER BY created_at DESC
-- 3. idx_posts_subway_line: Simple index for stats queries
--    Supports: GROUP BY subway_line, COUNT(*) aggregations
--
-- All indexes use partial index (WHERE deleted_at IS NULL) to exclude soft-deleted
-- posts, reducing index size and improving query performance.

-- Index 1: Hot feed with subway line filtering
-- This is the most critical index for community-filtered hot feeds
CREATE INDEX IF NOT EXISTS idx_posts_subway_line_hot
  ON posts(user_subway_line, score DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index 2: New feed with subway line filtering
-- Supports chronological feeds filtered by community
CREATE INDEX IF NOT EXISTS idx_posts_subway_line_new
  ON posts(user_subway_line, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index 3: Simple index for community stats
-- Used for: SELECT user_subway_line, COUNT(*) GROUP BY user_subway_line
CREATE INDEX IF NOT EXISTS idx_posts_subway_line
  ON posts(user_subway_line)
  WHERE deleted_at IS NULL;

-- Drop redundant indexes (covered by existing idx_posts_hot and idx_posts_active)
-- These are safe to drop as they're fully covered by partial composite indexes
DROP INDEX IF EXISTS idx_posts_score;       -- Covered by idx_posts_hot
DROP INDEX IF EXISTS idx_posts_created_at;  -- Covered by idx_posts_active

-- Analyze table to update query planner statistics
ANALYZE posts;

-- Verification queries:
-- 1. Check index usage (after running queries):
-- SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'posts' AND indexrelname LIKE '%subway_line%';
--
-- 2. Explain plan for hot feed query:
-- EXPLAIN ANALYZE
-- SELECT * FROM posts
-- WHERE deleted_at IS NULL AND user_subway_line = ANY(ARRAY['A','C','E'])
-- ORDER BY score DESC, created_at DESC LIMIT 20;
-- Expected: Index Scan using idx_posts_subway_line_hot
