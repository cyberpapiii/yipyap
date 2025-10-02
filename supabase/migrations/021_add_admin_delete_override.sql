-- Migration: Add admin override to delete functions
-- Allows specific admin user to delete any post or comment

-- Admin user ID
-- Replace this with your actual admin user ID
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin user ID: 784e1453-e77f-491c-ad61-d76c3f1d0f2d
  RETURN user_id = '784e1453-e77f-491c-ad61-d76c3f1d0f2d'::UUID;
END;
$$;

-- Update RPC function for deleting posts with admin override
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
  -- Admin can delete any post, regular users can only delete their own
  IF is_admin_user(p_user) THEN
    -- Admin: delete any post
    UPDATE posts
    SET
      deleted_at = NOW(),
      deletion_reason = 'admin_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_post;
  ELSE
    -- Regular user: only delete own posts
    UPDATE posts
    SET
      deleted_at = NOW(),
      deletion_reason = 'user_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_post
      AND user_id = p_user;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Update RPC function for deleting comments with admin override
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
  -- Admin can delete any comment, regular users can only delete their own
  IF is_admin_user(p_user) THEN
    -- Admin: delete any comment
    UPDATE comments
    SET
      deleted_at = NOW(),
      deletion_reason = 'admin_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_comment;
  ELSE
    -- Regular user: only delete own comments
    UPDATE comments
    SET
      deleted_at = NOW(),
      deletion_reason = 'user_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_comment
      AND user_id = p_user;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO anon;

-- Update comments for documentation
COMMENT ON FUNCTION is_admin_user IS 'Check if a user ID is an admin user';
COMMENT ON FUNCTION rpc_delete_post IS 'Soft delete a post. Admin can delete any post, regular users can only delete their own.';
COMMENT ON FUNCTION rpc_delete_comment IS 'Soft delete a comment. Admin can delete any comment, regular users can only delete their own.';
