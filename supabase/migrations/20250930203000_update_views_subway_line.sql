-- Migration: Update views and materialized views for subway_line
-- Part 4 of 4: Update hot_posts materialized view and post_with_stats view
--
-- This migration updates database views to use the denormalized user_subway_line
-- field, eliminating JOIN overhead in the views themselves.

-- Drop and recreate post_with_stats view with denormalized field
DROP VIEW IF EXISTS post_with_stats CASCADE;
CREATE VIEW post_with_stats AS
SELECT
  p.id,
  p.content,
  p.user_id AS anonymous_user_id,
  p.user_subway_line,  -- NEW: use denormalized field
  NULL::uuid AS thread_id,
  NULL::uuid AS parent_post_id,
  p.created_at,
  p.updated_at,
  CASE WHEN p.deleted_at IS NOT NULL THEN true ELSE false END AS is_deleted,
  p.score AS vote_score,
  p.comment_count
FROM posts p
WHERE p.deleted_at IS NULL;

-- Add helpful comment
COMMENT ON VIEW post_with_stats IS
  'Post statistics view using denormalized user_subway_line for performance';

-- Update hot_posts materialized view
DROP MATERIALIZED VIEW IF EXISTS hot_posts CASCADE;
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,  -- Includes user_subway_line (denormalized field)
    COALESCE(u.subway_color, 'mta-blue') as user_subway_color,
    COALESCE(ti.emoji, u.emoji, '🤔') as user_emoji,
    COALESCE(ti.color_code, '#6B7280') as user_color,
    -- Hot score calculation (Reddit-style hot ranking)
    GREATEST(ABS(p.score), 1) *
    POWER(
        GREATEST(
            EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600, -- hours since creation
            1
        ),
        -1.5  -- Time decay factor
    ) as hot_score
FROM posts p
LEFT JOIN users u ON p.user_id = u.id  -- Still need JOIN for subway_color and emoji
LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
WHERE p.deleted_at IS NULL
ORDER BY hot_score DESC, p.created_at DESC;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_hot_posts_id ON hot_posts(id);
CREATE INDEX idx_hot_posts_hot_score ON hot_posts(hot_score DESC);
CREATE INDEX idx_hot_posts_community ON hot_posts(community);
CREATE INDEX idx_hot_posts_subway_line ON hot_posts(user_subway_line);

-- Composite index for community-filtered hot feed
CREATE INDEX idx_hot_posts_subway_line_hot
  ON hot_posts(user_subway_line, hot_score DESC);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;

-- Add comment
COMMENT ON MATERIALIZED VIEW hot_posts IS
  'Hot posts ranked by Reddit-style algorithm, using denormalized user_subway_line for fast community filtering';

-- Verification queries:
-- 1. Test hot_posts filtering:
-- SELECT user_subway_line, COUNT(*) as post_count
-- FROM hot_posts
-- WHERE user_subway_line = ANY(ARRAY['A','C','E'])
-- GROUP BY user_subway_line;
--
-- 2. Performance test:
-- EXPLAIN ANALYZE
-- SELECT * FROM hot_posts
-- WHERE user_subway_line = ANY(ARRAY['1','2','3'])
-- ORDER BY hot_score DESC LIMIT 20;
-- Expected: Index Scan using idx_hot_posts_subway_line_hot
--
-- 3. Verify denormalization consistency:
-- SELECT COUNT(*)
-- FROM hot_posts hp
-- JOIN users u ON hp.user_id = u.id
-- WHERE hp.user_subway_line != u.subway_line;
-- Expected: 0 (no inconsistencies)
