-- Increase character limit from 100 to 500 for posts and comments

-- Drop and recreate the create_post function with updated validation
CREATE OR REPLACE FUNCTION create_post(
  p_user UUID,
  p_content TEXT
)
RETURNS posts AS $$
DECLARE
  v_post posts;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Insert post
  INSERT INTO posts (user_id, location, content_excerpt, content)
  VALUES (p_user, 'dimes_square', substr(p_content,1,500), p_content)
  RETURNING * INTO v_post;

  RETURN v_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the create_comment function with updated validation
CREATE OR REPLACE FUNCTION create_comment(
  p_user UUID,
  p_post_id UUID,
  p_parent_comment_id UUID,
  p_content TEXT
)
RETURNS comments AS $$
DECLARE
  v_comment comments;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Insert comment
  INSERT INTO comments (user_id, post_id, parent_comment_id, content)
  VALUES (p_user, p_post_id, p_parent_comment_id, p_content)
  RETURNING * INTO v_comment;

  RETURN v_comment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;