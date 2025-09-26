-- YipYap Initial Schema Migration
-- Device-based anonymous social platform for Dimes Square community

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (device-based anonymous users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Rate limiting fields
    last_post_at TIMESTAMP WITH TIME ZONE,
    last_comment_at TIMESTAMP WITH TIME ZONE,
    last_vote_at TIMESTAMP WITH TIME ZONE,

    -- Reputation tracking
    total_karma INTEGER DEFAULT 0 NOT NULL,
    posts_created INTEGER DEFAULT 0 NOT NULL,
    comments_created INTEGER DEFAULT 0 NOT NULL,

    -- Soft ban/timeout capabilities
    banned_until TIMESTAMP WITH TIME ZONE,
    ban_reason TEXT,

    CONSTRAINT users_device_id_not_empty CHECK (device_id != ''),
    CONSTRAINT users_total_karma_not_negative CHECK (total_karma >= 0),
    CONSTRAINT users_posts_created_not_negative CHECK (posts_created >= 0),
    CONSTRAINT users_comments_created_not_negative CHECK (comments_created >= 0)
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community TEXT NOT NULL DEFAULT 'dimes_square',

    -- Content
    title TEXT NOT NULL,
    content TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Engagement metrics
    score INTEGER DEFAULT 0 NOT NULL,
    comment_count INTEGER DEFAULT 0 NOT NULL,
    vote_count INTEGER DEFAULT 0 NOT NULL,

    -- Auto-deletion tracking
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletion_reason TEXT,

    CONSTRAINT posts_title_not_empty CHECK (title != ''),
    CONSTRAINT posts_title_length CHECK (LENGTH(title) <= 300),
    CONSTRAINT posts_content_length CHECK (LENGTH(content) <= 10000),
    CONSTRAINT posts_score_triggers_deletion CHECK (
        (score > -5 AND deleted_at IS NULL) OR
        (score <= -5 AND deleted_at IS NOT NULL)
    )
);

-- Comments table (two-level threading max)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Threading metadata
    depth INTEGER DEFAULT 0 NOT NULL,
    thread_path TEXT NOT NULL,

    -- Engagement metrics
    score INTEGER DEFAULT 0 NOT NULL,
    reply_count INTEGER DEFAULT 0 NOT NULL,
    vote_count INTEGER DEFAULT 0 NOT NULL,

    -- Auto-deletion tracking
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletion_reason TEXT,

    CONSTRAINT comments_content_not_empty CHECK (content != ''),
    CONSTRAINT comments_content_length CHECK (LENGTH(content) <= 5000),
    CONSTRAINT comments_max_depth CHECK (depth <= 1), -- 0 = top-level, 1 = reply
    CONSTRAINT comments_depth_consistency CHECK (
        (parent_id IS NULL AND depth = 0) OR
        (parent_id IS NOT NULL AND depth > 0)
    ),
    CONSTRAINT comments_score_triggers_deletion CHECK (
        (score > -5 AND deleted_at IS NULL) OR
        (score <= -5 AND deleted_at IS NOT NULL)
    )
);

-- Votes table (for posts and comments)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    vote_type INTEGER NOT NULL, -- 1 for upvote, -1 for downvote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT votes_type_valid CHECK (vote_type IN (-1, 1)),
    CONSTRAINT votes_target_exclusive CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    -- One vote per user per target
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, comment_id)
);

-- Thread identities table (emoji + color per user per post)
CREATE TABLE thread_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    emoji TEXT NOT NULL,
    color_code TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    UNIQUE(user_id, post_id),

    CONSTRAINT thread_identities_emoji_valid CHECK (LENGTH(emoji) <= 4),
    CONSTRAINT thread_identities_color_valid CHECK (color_code ~ '^#[0-9A-Fa-f]{6}$')
);

-- Performance indexes
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE INDEX idx_posts_community ON posts(community);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_score ON posts(score DESC);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_active ON posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_hot ON posts(score DESC, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_thread_path ON comments(thread_path);
CREATE INDEX idx_comments_active ON comments(post_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_post_id ON votes(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_votes_comment_id ON votes(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);

CREATE INDEX idx_thread_identities_post_user ON thread_identities(post_id, user_id);

-- RLS Policies (Enable RLS on all tables)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_identities ENABLE ROW LEVEL SECURITY;

-- Users policies (users can only see/modify their own data)
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = device_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = device_id);

CREATE POLICY "Anyone can create user accounts" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = device_id OR auth.uid() IS NULL);

-- Posts policies (public read, authenticated write)
CREATE POLICY "Anyone can view active posts" ON posts
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can create posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid()::text IN (
        SELECT device_id FROM users WHERE id = posts.user_id
    ));

-- Comments policies (public read, authenticated write)
CREATE POLICY "Anyone can view active comments" ON comments
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can create comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (auth.uid()::text IN (
        SELECT device_id FROM users WHERE id = comments.user_id
    ));

-- Votes policies (public read, authenticated write, users can manage their votes)
CREATE POLICY "Anyone can view votes" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own votes" ON votes
    FOR ALL USING (auth.uid()::text IN (
        SELECT device_id FROM users WHERE id = votes.user_id
    ));

-- Thread identities policies
CREATE POLICY "Anyone can view thread identities" ON thread_identities
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their thread identities" ON thread_identities
    FOR ALL USING (auth.uid()::text IN (
        SELECT device_id FROM users WHERE id = thread_identities.user_id
    ));

-- Trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate thread path
CREATE OR REPLACE FUNCTION generate_thread_path()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.thread_path = NEW.id::text;
        NEW.depth = 0;
    ELSE
        SELECT thread_path || '.' || NEW.id::text, depth + 1
        INTO NEW.thread_path, NEW.depth
        FROM comments WHERE id = NEW.parent_id;

        -- Enforce max depth
        IF NEW.depth > 1 THEN
            RAISE EXCEPTION 'Maximum comment depth (2 levels) exceeded';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update score and handle auto-deletion
CREATE OR REPLACE FUNCTION update_content_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update post score
    IF NEW.post_id IS NOT NULL THEN
        UPDATE posts
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE post_id = NEW.post_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE post_id = NEW.post_id
            ), 0),
            updated_at = NOW()
        WHERE id = NEW.post_id;

        -- Auto-delete if score <= -5
        UPDATE posts
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = NEW.post_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    -- Update comment score
    IF NEW.comment_id IS NOT NULL THEN
        UPDATE comments
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE comment_id = NEW.comment_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE comment_id = NEW.comment_id
            ), 0),
            updated_at = NOW()
        WHERE id = NEW.comment_id;

        -- Auto-delete if score <= -5
        UPDATE comments
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = NEW.comment_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Update post comment count
        UPDATE posts
        SET comment_count = comment_count + 1, updated_at = NOW()
        WHERE id = NEW.post_id;

        -- Update parent comment reply count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE comments
            SET reply_count = reply_count + 1, updated_at = NOW()
            WHERE id = NEW.parent_id;
        END IF;

        -- Update user stats
        UPDATE users
        SET comments_created = comments_created + 1, updated_at = NOW()
        WHERE id = NEW.user_id;

        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- Update post comment count
        UPDATE posts
        SET comment_count = comment_count - 1, updated_at = NOW()
        WHERE id = OLD.post_id;

        -- Update parent comment reply count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE comments
            SET reply_count = reply_count - 1, updated_at = NOW()
            WHERE id = OLD.parent_id;
        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update user karma
CREATE OR REPLACE FUNCTION update_user_karma()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    karma_change INTEGER;
BEGIN
    -- Determine karma change
    IF TG_OP = 'INSERT' THEN
        karma_change = NEW.vote_type;

        -- Get target user ID
        IF NEW.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = NEW.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = NEW.comment_id;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        karma_change = -OLD.vote_type;

        -- Get target user ID
        IF OLD.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = OLD.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = OLD.comment_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        karma_change = NEW.vote_type - OLD.vote_type;

        -- Get target user ID
        IF NEW.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = NEW.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = NEW.comment_id;
        END IF;
    END IF;

    -- Update user karma
    UPDATE users
    SET total_karma = total_karma + karma_change, updated_at = NOW()
    WHERE id = target_user_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update post creation stats
CREATE OR REPLACE FUNCTION update_post_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users
        SET posts_created = posts_created + 1, updated_at = NOW()
        WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to generate thread identity
CREATE OR REPLACE FUNCTION ensure_thread_identity()
RETURNS TRIGGER AS $$
DECLARE
    emoji_list TEXT[] := ARRAY['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'];
    color_list TEXT[] := ARRAY['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D5A6BD', '#AED6F1', '#A9DFBF', '#FAD7A0', '#D2B4DE', '#AED6F1'];
    selected_emoji TEXT;
    selected_color TEXT;
BEGIN
    -- Only generate identity for new posts/comments, not updates
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Check if thread identity already exists
    IF NOT EXISTS (
        SELECT 1 FROM thread_identities
        WHERE user_id = NEW.user_id AND post_id = COALESCE(NEW.post_id, (SELECT post_id FROM comments WHERE id = NEW.id))
    ) THEN
        -- Generate random emoji and color
        selected_emoji := emoji_list[1 + (random() * array_length(emoji_list, 1))::integer];
        selected_color := color_list[1 + (random() * array_length(color_list, 1))::integer];

        -- Insert thread identity
        INSERT INTO thread_identities (user_id, post_id, emoji, color_code)
        VALUES (
            NEW.user_id,
            COALESCE(NEW.post_id, (SELECT post_id FROM comments WHERE id = NEW.id)),
            selected_emoji,
            selected_color
        )
        ON CONFLICT (user_id, post_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_votes_updated_at
    BEFORE UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for thread path generation
CREATE TRIGGER trigger_comments_thread_path
    BEFORE INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION generate_thread_path();

-- Triggers for score updates and auto-deletion
CREATE TRIGGER trigger_votes_update_score
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_content_score();

-- Triggers for comment count updates
CREATE TRIGGER trigger_comments_update_counts
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

-- Triggers for user karma updates
CREATE TRIGGER trigger_votes_update_karma
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_user_karma();

-- Trigger for post creation stats
CREATE TRIGGER trigger_posts_update_stats
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION update_post_stats();

-- Triggers for thread identity generation
CREATE TRIGGER trigger_posts_thread_identity
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION ensure_thread_identity();

CREATE TRIGGER trigger_comments_thread_identity
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION ensure_thread_identity();

-- Materialized view for hot posts (performance optimization)
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,
    COALESCE(ti.emoji, '🤔') as user_emoji,
    COALESCE(ti.color_code, '#6B7280') as user_color,
    -- Hot score calculation (Reddit-style)
    GREATEST(ABS(p.score), 1) *
    POWER(
        GREATEST(
            EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600, -- hours
            1
        ),
        -1.5
    ) as hot_score
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
WHERE p.deleted_at IS NULL
ORDER BY hot_score DESC, p.created_at DESC;

CREATE UNIQUE INDEX idx_hot_posts_id ON hot_posts(id);
CREATE INDEX idx_hot_posts_hot_score ON hot_posts(hot_score DESC);
CREATE INDEX idx_hot_posts_community ON hot_posts(community);

-- Function to refresh hot posts view
CREATE OR REPLACE FUNCTION refresh_hot_posts()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh hot posts view periodically (via posts changes)
CREATE TRIGGER trigger_refresh_hot_posts
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_hot_posts();

-- Create indexes for real-time subscriptions
CREATE INDEX idx_posts_realtime ON posts(created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_realtime ON comments(post_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_votes_realtime ON votes(created_at, post_id, comment_id);

-- Function to get user by device_id (helper for app)
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param TEXT)
RETURNS UUID AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Try to find existing user
    SELECT id INTO user_record FROM users WHERE device_id = device_id_param;

    IF FOUND THEN
        RETURN user_record.id;
    ELSE
        -- Create new user
        INSERT INTO users (device_id) VALUES (device_id_param) RETURNING id INTO user_record;
        RETURN user_record.id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get thread identity for user in post
CREATE OR REPLACE FUNCTION get_thread_identity(user_id_param UUID, post_id_param UUID)
RETURNS TABLE(emoji TEXT, color_code TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT ti.emoji, ti.color_code
    FROM thread_identities ti
    WHERE ti.user_id = user_id_param AND ti.post_id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function for efficient post listing with pagination
CREATE OR REPLACE FUNCTION get_posts_paginated(
    community_param TEXT DEFAULT 'dimes_square',
    sort_by TEXT DEFAULT 'hot', -- 'hot', 'new', 'top'
    limit_param INTEGER DEFAULT 20,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    content TEXT,
    created_at TIMESTAMPTZ,
    score INTEGER,
    comment_count INTEGER,
    user_emoji TEXT,
    user_color TEXT
) AS $$
BEGIN
    IF sort_by = 'hot' THEN
        RETURN QUERY
        SELECT hp.id, hp.title, hp.content, hp.created_at, hp.score, hp.comment_count, hp.user_emoji, hp.user_color
        FROM hot_posts hp
        WHERE hp.community = community_param
        ORDER BY hp.hot_score DESC, hp.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'new' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280')
        FROM posts p
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'top' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280')
        FROM posts p
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.score DESC, p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function for efficient comment tree loading
CREATE OR REPLACE FUNCTION get_comments_tree(post_id_param UUID)
RETURNS TABLE(
    id UUID,
    parent_id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    depth INTEGER,
    score INTEGER,
    reply_count INTEGER,
    user_emoji TEXT,
    user_color TEXT,
    thread_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.parent_id, c.content, c.created_at, c.depth, c.score, c.reply_count,
           COALESCE(ti.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'), c.thread_path
    FROM comments c
    LEFT JOIN thread_identities ti ON c.post_id = ti.post_id AND c.user_id = ti.user_id
    WHERE c.post_id = post_id_param AND c.deleted_at IS NULL
    ORDER BY c.thread_path;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for anonymous access
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;