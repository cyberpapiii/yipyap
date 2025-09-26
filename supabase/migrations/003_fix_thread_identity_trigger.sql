-- Fix the thread identity trigger to handle both posts and comments
-- The issue was that the trigger assumes all records have a post_id field

-- Drop and recreate the function
DROP FUNCTION IF EXISTS ensure_thread_identity() CASCADE;

CREATE OR REPLACE FUNCTION ensure_thread_identity()
RETURNS TRIGGER AS $$
DECLARE
    emoji_list TEXT[] := ARRAY['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'];
    color_list TEXT[] := ARRAY['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D5A6BD', '#AED6F1', '#A9DFBF', '#FAD7A0', '#D2B4DE', '#AED6F1'];
    selected_emoji TEXT;
    selected_color TEXT;
    target_post_id UUID;
BEGIN
    -- Only generate identity for new posts/comments, not updates
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Determine the post_id based on the table
    IF TG_TABLE_NAME = 'posts' THEN
        target_post_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        target_post_id := NEW.post_id;
    ELSE
        -- For other tables, skip identity generation
        RETURN NEW;
    END IF;

    -- Check if thread identity already exists
    IF NOT EXISTS (
        SELECT 1 FROM thread_identities
        WHERE user_id = NEW.user_id AND post_id = target_post_id
    ) THEN
        -- Generate random emoji and color
        selected_emoji := emoji_list[1 + floor(random() * array_length(emoji_list, 1))::integer];
        selected_color := color_list[1 + floor(random() * array_length(color_list, 1))::integer];
        selected_emoji := COALESCE(selected_emoji, '🎭');
        selected_color := COALESCE(selected_color, '#9B59B6');

        -- Insert thread identity
        INSERT INTO thread_identities (user_id, post_id, emoji, color_code)
        VALUES (NEW.user_id, target_post_id, selected_emoji, selected_color)
        ON CONFLICT (user_id, post_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER trigger_posts_thread_identity
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION ensure_thread_identity();

CREATE TRIGGER trigger_comments_thread_identity
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION ensure_thread_identity();
