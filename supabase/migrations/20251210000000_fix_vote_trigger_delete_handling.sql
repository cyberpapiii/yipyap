-- Fix update_content_score trigger to handle DELETE operations correctly
-- Bug: The trigger was using NEW.post_id and NEW.comment_id for all operations,
-- but DELETE operations only have OLD record available, not NEW record.
-- This caused vote counts to not update when votes were removed.

CREATE OR REPLACE FUNCTION update_content_score()
RETURNS TRIGGER AS $$
DECLARE
  target_post_id UUID;
  target_comment_id UUID;
BEGIN
    -- Determine which post_id/comment_id to use based on operation
    IF TG_OP = 'DELETE' THEN
        target_post_id := OLD.post_id;
        target_comment_id := OLD.comment_id;
    ELSE
        target_post_id := NEW.post_id;
        target_comment_id := NEW.comment_id;
    END IF;

    -- Update post score
    IF target_post_id IS NOT NULL THEN
        UPDATE posts
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE post_id = target_post_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE post_id = target_post_id
            ), 0),
            updated_at = NOW()
        WHERE id = target_post_id;

        -- Auto-delete if score <= -5
        UPDATE posts
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = target_post_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    -- Update comment score
    IF target_comment_id IS NOT NULL THEN
        UPDATE comments
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE comment_id = target_comment_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE comment_id = target_comment_id
            ), 0),
            updated_at = NOW()
        WHERE id = target_comment_id;

        -- Auto-delete if score <= -5
        UPDATE comments
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = target_comment_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself doesn't need to be recreated, just the function
-- But let's document the existing trigger for clarity:
-- CREATE TRIGGER trigger_votes_update_score
--     AFTER INSERT OR UPDATE OR DELETE ON votes
--     FOR EACH ROW EXECUTE FUNCTION update_content_score();
