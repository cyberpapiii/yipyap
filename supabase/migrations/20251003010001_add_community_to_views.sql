-- Add community column to post_with_stats and comment_with_stats views

-- Drop and recreate post_with_stats view with community column
DROP VIEW IF EXISTS post_with_stats CASCADE;

CREATE VIEW post_with_stats AS
SELECT
  p.id,
  p.content,
  p.user_id AS anonymous_user_id,
  p.user_subway_line,
  p.community,  -- Add community column
  NULL::uuid AS thread_id,
  NULL::uuid AS parent_post_id,
  p.created_at,
  p.updated_at,
  CASE
    WHEN p.deleted_at IS NOT NULL THEN true
    ELSE false
  END AS is_deleted,
  p.score AS vote_score,
  p.comment_count
FROM posts p
WHERE p.deleted_at IS NULL;

-- Recreate comment_with_stats view (get user_subway_line from join)
DROP VIEW IF EXISTS comment_with_stats CASCADE;

CREATE VIEW comment_with_stats AS
SELECT
  c.id,
  c.content,
  c.post_id,
  c.parent_id AS parent_comment_id,
  c.user_id AS anonymous_user_id,
  u.subway_line AS user_subway_line,
  c.created_at,
  c.updated_at,
  c.deleted_at IS NOT NULL AS is_deleted,
  c.score AS vote_score,
  c.reply_count,
  c.depth
FROM comments c
LEFT JOIN users u ON c.user_id = u.id;

-- Grant permissions
GRANT SELECT ON post_with_stats TO anon;
GRANT SELECT ON comment_with_stats TO anon;
