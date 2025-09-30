-- Migration: Add RPC functions for deleting posts and comments
-- This fixes the delete functionality which was broken after the RLS lockdown in 007_rls_lockdown.sql

-- Create RPC function for deleting posts
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
  -- Soft delete the post (set deleted_at timestamp)
  UPDATE posts
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW()
  WHERE id = p_post
    AND user_id = p_user;  -- Security: user must own the post

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Create RPC function for deleting comments
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
  -- Soft delete the comment (set deleted_at timestamp)
  UPDATE comments
  SET
    deleted_at = NOW(),
    deletion_reason = 'user_deleted',
    updated_at = NOW()
  WHERE id = p_comment
    AND user_id = p_user;  -- Security: user must own the comment

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Grant execute permissions to anonymous users
GRANT EXECUTE ON FUNCTION rpc_delete_post(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION rpc_delete_comment(UUID, UUID) TO anon;

-- Add comments for documentation
COMMENT ON FUNCTION rpc_delete_post IS 'Soft delete a post. Only the post owner can delete their own posts.';
COMMENT ON FUNCTION rpc_delete_comment IS 'Soft delete a comment. Only the comment owner can delete their own comments.';