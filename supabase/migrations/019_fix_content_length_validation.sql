-- Fix content length validation to match client (500 characters)
-- Updates the rpc_create_post and rpc_create_comment functions
-- IMPORTANT: SECURITY DEFINER allows these functions to bypass RLS policies

CREATE OR REPLACE FUNCTION rpc_create_post(p_user uuid, p_content text)
RETURNS posts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
  rec posts;
BEGIN
  -- Updated validation: 1-500 characters (was 1-100)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;
  SELECT count(*) INTO cnt FROM posts WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 10 THEN RAISE EXCEPTION 'Post rate limit exceeded'; END IF;
  INSERT INTO posts(user_id, community, title, content)
  VALUES (p_user, 'dimes_square', substr(p_content,1,500), p_content)
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_create_comment(p_user uuid, p_post uuid, p_parent uuid, p_content text)
RETURNS comments LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt int;
  rec comments;
  parent_depth int;
BEGIN
  -- Updated validation: 1-500 characters (was 1-100)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;
  SELECT count(*) INTO cnt FROM comments WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 30 THEN RAISE EXCEPTION 'Comment rate limit exceeded'; END IF;
  IF p_parent IS NOT NULL THEN
    SELECT depth INTO parent_depth FROM comments WHERE id = p_parent;
    IF parent_depth IS NULL THEN RAISE EXCEPTION 'Parent not found'; END IF;
    IF parent_depth >= 1 THEN RAISE EXCEPTION 'Max depth exceeded'; END IF;
  END IF;
  INSERT INTO comments(user_id, post_id, parent_id, content)
  VALUES (p_user, p_post, p_parent, p_content)
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;