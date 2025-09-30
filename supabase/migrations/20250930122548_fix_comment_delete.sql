-- Fix comment delete to comply with comments_score_triggers_deletion constraint
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
  UPDATE comments
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW(),
    score = -5
  WHERE id = p_comment
    AND user_id = p_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$$;
