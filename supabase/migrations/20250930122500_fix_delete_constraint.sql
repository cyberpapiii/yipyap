-- Fix delete RPC to comply with posts_score_triggers_deletion constraint
-- The constraint requires: (score > -5 AND deleted_at IS NULL) OR (score <= -5 AND deleted_at IS NOT NULL)
-- So when we delete, we must also set score to -5 or lower

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
  -- Soft delete the post (set deleted_at timestamp AND set score to -5 to satisfy constraint)
  UPDATE posts
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW(),
    score = -5  -- Required by posts_score_triggers_deletion constraint
  WHERE id = p_post
    AND user_id = p_user;  -- Security: user must own the post

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Similarly fix comment delete if it has the same constraint
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
  -- Soft delete the comment (set deleted_at timestamp AND score to -5 for constraint)
  UPDATE comments
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW(),
    score = -5  -- Required by comments_score_triggers_deletion constraint
  WHERE id = p_comment
    AND user_id = p_user;  -- Security: user must own the comment

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$$;