-- Remove the problematic score-triggers-deletion constraints
-- These constraints were designed for auto-deletion, but prevent manual user deletion
-- Manual deletion should work regardless of score

-- Drop the constraint from posts table
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_score_triggers_deletion;

-- Drop the constraint from comments table
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_score_triggers_deletion;

-- Now update the delete RPCs to NOT modify score
CREATE OR REPLACE FUNCTION rpc_delete_post(
  p_user UUID,
  p_post UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Soft delete the post (set deleted_at timestamp only, don't touch score)
  UPDATE posts
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW()
  WHERE id = p_post
    AND user_id = p_user
    AND deleted_at IS NULL;  -- Can't delete already deleted posts

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or you do not have permission to delete it';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_comment(
  p_user UUID,
  p_comment UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Soft delete the comment (set deleted_at timestamp only, don't touch score)
  UPDATE comments
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW()
  WHERE id = p_comment
    AND user_id = p_user
    AND deleted_at IS NULL;  -- Can't delete already deleted comments

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$$;