-- Add community parameter to rpc_create_post for geographic communities
-- This allows posts to be tagged with either 'nyc' or 'dimes_square'

-- Drop existing function
DROP FUNCTION IF EXISTS rpc_create_post(uuid, text);

-- Recreate with community parameter
CREATE OR REPLACE FUNCTION rpc_create_post(
  p_user uuid,
  p_content text,
  p_community text DEFAULT 'nyc'
)
RETURNS posts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
  rec posts;
  u_subway_line text;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Validate community
  IF p_community NOT IN ('nyc', 'dimes_square') THEN
    RAISE EXCEPTION 'Invalid community. Must be nyc or dimes_square';
  END IF;

  -- Check rate limit (10 posts per hour)
  SELECT count(*) INTO cnt FROM posts WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'Post rate limit exceeded';
  END IF;

  -- Get user's subway line
  SELECT subway_line INTO u_subway_line FROM users WHERE id = p_user;
  IF u_subway_line IS NULL THEN
    RAISE EXCEPTION 'User not found or has no subway line';
  END IF;

  -- Create post with community and user subway line
  INSERT INTO posts(user_id, community, title, content, user_subway_line)
  VALUES (p_user, p_community, substr(p_content, 1, 100), p_content, u_subway_line)
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

-- Update default community in posts table from 'dimes_square' to 'nyc'
ALTER TABLE posts ALTER COLUMN community SET DEFAULT 'nyc';

-- Update any existing posts with 'dimes_square' to 'nyc' (backward compatibility)
-- Since we're introducing geofencing, existing posts should be NYC by default
UPDATE posts SET community = 'nyc' WHERE community = 'dimes_square';

-- Grant permissions to anon role
GRANT EXECUTE ON FUNCTION rpc_create_post(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION rpc_create_post(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_post(uuid, text, text) TO service_role;
