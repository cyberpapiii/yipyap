-- Align database views with frontend API expectations
-- Creates post_with_stats and comment_with_stats views compatible with current API

-- Drop existing views if they exist to avoid conflicts
DROP VIEW IF EXISTS post_with_stats CASCADE;
DROP VIEW IF EXISTS comment_with_stats CASCADE;

-- post_with_stats view
-- Exposes columns expected by the app layer while sourcing from existing tables
CREATE VIEW post_with_stats AS
SELECT
  p.id,
  p.content,
  p.user_id AS anonymous_user_id,
  NULL::uuid AS thread_id,
  NULL::uuid AS parent_post_id,
  p.created_at,
  p.updated_at,
  (p.deleted_at IS NOT NULL) AS is_deleted,
  p.score AS vote_score,
  p.comment_count,
  p.community
FROM posts p;

-- comment_with_stats view
CREATE VIEW comment_with_stats AS
SELECT
  c.id,
  c.content,
  c.post_id,
  c.parent_id AS parent_comment_id,
  c.user_id AS anonymous_user_id,
  c.created_at,
  c.updated_at,
  (c.deleted_at IS NOT NULL) AS is_deleted,
  c.score AS vote_score,
  c.reply_count,
  c.depth
FROM comments c;

-- Note: These are simple views to unblock the app. They rely on existing RLS policies
-- on the underlying tables to govern access.

