-- Migration: Update write RPCs to populate user_subway_line
-- Part 3 of 4: Modify rpc_create_post to denormalize subway_line
--
-- CRITICAL: All post writes MUST go through RPCs due to RLS lockdown.
-- This migration updates rpc_create_post to populate the denormalized
-- user_subway_line field from the users table.

-- Update rpc_create_post to include subway_line denormalization
CREATE OR REPLACE FUNCTION rpc_create_post(
  p_user uuid,
  p_content text
)
RETURNS posts  -- Must match existing return type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec posts;
  v_subway_line text;
  v_rate_limit_seconds integer := 360; -- 10 posts per hour
  cnt int;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Rate limit check: 10 posts per hour
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user
      AND last_post_at IS NOT NULL
      AND last_post_at > NOW() - (v_rate_limit_seconds || ' seconds')::INTERVAL
  ) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before posting again.';
  END IF;

  -- Content validation (1-500 characters)
  IF p_content IS NULL OR LENGTH(TRIM(p_content)) = 0 THEN
    RAISE EXCEPTION 'Post content cannot be empty';
  END IF;

  IF LENGTH(p_content) > 500 THEN
    RAISE EXCEPTION 'Post content cannot exceed 500 characters';
  END IF;

  -- Get user's subway line for denormalization
  SELECT subway_line INTO v_subway_line
  FROM users
  WHERE id = p_user;

  IF v_subway_line IS NULL THEN
    RAISE EXCEPTION 'User subway line not found. User profile may be incomplete.';
  END IF;

  -- Insert post with denormalized subway_line
  INSERT INTO posts (
    user_id,
    user_subway_line,  -- NEW: denormalized field
    content,
    community,
    title  -- Required by schema, use first 50 chars of content
  )
  VALUES (
    p_user,
    v_subway_line,
    p_content,
    'dimes_square',
    LEFT(p_content, 50)
  )
  RETURNING * INTO rec;

  -- Update user stats and rate limit tracking
  UPDATE users
  SET
    posts_created = posts_created + 1,
    last_post_at = NOW(),
    total_karma = total_karma + 1  -- +1 karma for posting
  WHERE id = p_user;

  RETURN rec;
END;
$$;

-- Add comment documenting the denormalization
COMMENT ON FUNCTION rpc_create_post IS
  'Creates a new post. Denormalizes user_subway_line from users table for query performance. Rate limited to 10 posts per hour.';

-- Verification:
-- 1. Test post creation:
-- SELECT rpc_create_post(
--   (SELECT id FROM users LIMIT 1),
--   'Test post with subway line denormalization'
-- );
--
-- 2. Verify subway_line populated:
-- SELECT p.id, p.user_subway_line, u.subway_line
-- FROM posts p
-- JOIN users u ON p.user_id = u.id
-- WHERE p.created_at > NOW() - INTERVAL '1 minute'
-- ORDER BY p.created_at DESC LIMIT 5;
-- Expected: p.user_subway_line = u.subway_line
