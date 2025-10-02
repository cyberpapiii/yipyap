-- YipYap Database Optimization Queries
-- Performance-optimized database schema and queries for YipYap social media platform

-- =============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================

-- Primary feed query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_feed_composite
ON posts (created_at DESC, user_id, is_deleted)
WHERE is_deleted = false;

-- User timeline optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user_timeline
ON posts (user_id, created_at DESC)
WHERE is_deleted = false;

-- Following relationship optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_following
ON follows (follower_id, following_id, created_at);

-- Vote aggregation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_post_aggregation
ON votes (post_id, vote_type, is_deleted)
WHERE is_deleted = false;

-- Comment threading optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_thread
ON comments (post_id, parent_comment_id, created_at)
WHERE is_deleted = false;

-- User search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search
ON users USING gin(to_tsvector('english', username || ' ' || display_name))
WHERE is_active = true;

-- =============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================

-- Post vote counts materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS post_vote_counts AS
SELECT
    post_id,
    COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false) as upvotes,
    COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false) as downvotes,
    COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false) -
    COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false) as net_votes,
    COUNT(*) FILTER (WHERE is_deleted = false) as total_votes
FROM votes
GROUP BY post_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_vote_counts_post_id
ON post_vote_counts (post_id);

-- Post comment counts materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS post_comment_counts AS
SELECT
    post_id,
    COUNT(*) as comment_count,
    MAX(created_at) as last_comment_at
FROM comments
WHERE is_deleted = false
GROUP BY post_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_comment_counts_post_id
ON post_comment_counts (post_id);

-- User activity summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_summary AS
SELECT
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    COUNT(p.id) as post_count,
    COUNT(c.id) as comment_count,
    COUNT(v.id) as vote_count,
    COUNT(f_following.following_id) as following_count,
    COUNT(f_followers.follower_id) as follower_count,
    MAX(GREATEST(p.created_at, c.created_at, v.created_at)) as last_activity_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id AND p.is_deleted = false
LEFT JOIN comments c ON u.id = c.user_id AND c.is_deleted = false
LEFT JOIN votes v ON u.id = v.user_id AND v.is_deleted = false
LEFT JOIN follows f_following ON u.id = f_following.follower_id
LEFT JOIN follows f_followers ON u.id = f_followers.following_id
WHERE u.is_active = true
GROUP BY u.id, u.username, u.display_name, u.avatar_url;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_summary_user_id
ON user_activity_summary (user_id);

-- =============================================
-- OPTIMIZED QUERIES FOR CORE FEATURES
-- =============================================

-- Optimized feed query with cursor-based pagination
-- Target: < 800ms median response time
PREPARE get_user_feed(bigint, timestamp, int) AS
SELECT
    p.id,
    p.content,
    p.created_at,
    p.updated_at,
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    COALESCE(pvc.upvotes, 0) as upvotes,
    COALESCE(pvc.downvotes, 0) as downvotes,
    COALESCE(pvc.net_votes, 0) as net_votes,
    COALESCE(pcc.comment_count, 0) as comment_count,
    -- Check if current user has voted
    CASE
        WHEN v.vote_type = 'up' THEN 'up'
        WHEN v.vote_type = 'down' THEN 'down'
        ELSE null
    END as user_vote
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN post_vote_counts pvc ON p.id = pvc.post_id
LEFT JOIN post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN votes v ON p.id = v.post_id AND v.user_id = $1 AND v.is_deleted = false
WHERE p.created_at < $2  -- cursor for pagination
  AND p.is_deleted = false
  AND u.is_active = true
  AND (
    -- Posts from users the current user follows
    p.user_id IN (
        SELECT following_id
        FROM follows
        WHERE follower_id = $1
    )
    -- Or posts from the current user
    OR p.user_id = $1
  )
ORDER BY p.created_at DESC
LIMIT $3;

-- Optimized post detail query
-- Target: < 400ms response time
PREPARE get_post_detail(bigint, bigint) AS
SELECT
    p.id,
    p.content,
    p.created_at,
    p.updated_at,
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    COALESCE(pvc.upvotes, 0) as upvotes,
    COALESCE(pvc.downvotes, 0) as downvotes,
    COALESCE(pvc.net_votes, 0) as net_votes,
    COALESCE(pcc.comment_count, 0) as comment_count,
    -- Check if current user has voted
    CASE
        WHEN v.vote_type = 'up' THEN 'up'
        WHEN v.vote_type = 'down' THEN 'down'
        ELSE null
    END as user_vote,
    -- Check if current user is following the post author
    CASE WHEN f.follower_id IS NOT NULL THEN true ELSE false END as is_following_author
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN post_vote_counts pvc ON p.id = pvc.post_id
LEFT JOIN post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN votes v ON p.id = v.post_id AND v.user_id = $2 AND v.is_deleted = false
LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = $2
WHERE p.id = $1 AND p.is_deleted = false;

-- Optimized comments query with threading
-- Target: < 600ms response time
PREPARE get_post_comments(bigint, bigint, int) AS
WITH RECURSIVE comment_tree AS (
    -- Root comments
    SELECT
        c.id,
        c.content,
        c.created_at,
        c.post_id,
        c.parent_comment_id,
        c.user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        0 as depth,
        ARRAY[c.created_at, c.id::timestamp] as sort_path
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1
      AND c.parent_comment_id IS NULL
      AND c.is_deleted = false
      AND u.is_active = true

    UNION ALL

    -- Recursive: child comments
    SELECT
        c.id,
        c.content,
        c.created_at,
        c.post_id,
        c.parent_comment_id,
        c.user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        ct.depth + 1,
        ct.sort_path || ARRAY[c.created_at, c.id::timestamp]
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.is_deleted = false
      AND u.is_active = true
      AND ct.depth < 5  -- Limit nesting depth
)
SELECT
    ct.*,
    -- Check if current user has voted on this comment
    CASE
        WHEN cv.vote_type = 'up' THEN 'up'
        WHEN cv.vote_type = 'down' THEN 'down'
        ELSE null
    END as user_vote,
    COUNT(*) FILTER (WHERE cv2.vote_type = 'up' AND cv2.is_deleted = false) as upvotes,
    COUNT(*) FILTER (WHERE cv2.vote_type = 'down' AND cv2.is_deleted = false) as downvotes
FROM comment_tree ct
LEFT JOIN comment_votes cv ON ct.id = cv.comment_id AND cv.user_id = $2 AND cv.is_deleted = false
LEFT JOIN comment_votes cv2 ON ct.id = cv2.comment_id AND cv2.is_deleted = false
GROUP BY ct.id, ct.content, ct.created_at, ct.post_id, ct.parent_comment_id,
         ct.user_id, ct.username, ct.display_name, ct.avatar_url, ct.depth,
         ct.sort_path, cv.vote_type
ORDER BY ct.sort_path
LIMIT $3;

-- Optimized vote insertion/update
-- Target: < 250ms response time for vote actions
PREPARE upsert_vote(bigint, bigint, varchar) AS
INSERT INTO votes (post_id, user_id, vote_type, created_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (post_id, user_id)
DO UPDATE SET
    vote_type = EXCLUDED.vote_type,
    updated_at = NOW(),
    is_deleted = false
RETURNING id, vote_type;

-- Optimized user search
-- Target: < 500ms response time
PREPARE search_users(text, int) AS
SELECT
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.bio,
    uas.follower_count,
    uas.post_count,
    -- Ranking based on text similarity and activity
    ts_rank(to_tsvector('english', u.username || ' ' || u.display_name),
            plainto_tsquery('english', $1)) +
    (COALESCE(uas.follower_count, 0) * 0.001) +
    (COALESCE(uas.post_count, 0) * 0.0001) as rank
FROM users u
LEFT JOIN user_activity_summary uas ON u.id = uas.user_id
WHERE u.is_active = true
  AND (
    u.username ILIKE $1 || '%'
    OR u.display_name ILIKE '%' || $1 || '%'
    OR to_tsvector('english', u.username || ' ' || u.display_name) @@ plainto_tsquery('english', $1)
  )
ORDER BY rank DESC, uas.follower_count DESC NULLS LAST
LIMIT $2;

-- =============================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- =============================================

-- Function to refresh vote counts
CREATE OR REPLACE FUNCTION refresh_post_vote_counts()
RETURNS trigger AS $$
BEGIN
    -- Refresh the specific post's vote count
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Use a more targeted refresh for specific posts
        DELETE FROM post_vote_counts WHERE post_id = NEW.post_id;
        INSERT INTO post_vote_counts
        SELECT
            NEW.post_id,
            COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false),
            COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false),
            COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false) -
            COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false),
            COUNT(*) FILTER (WHERE is_deleted = false)
        FROM votes
        WHERE post_id = NEW.post_id
        GROUP BY post_id;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Handle deletions
        DELETE FROM post_vote_counts WHERE post_id = OLD.post_id;
        INSERT INTO post_vote_counts
        SELECT
            OLD.post_id,
            COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false),
            COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false),
            COUNT(*) FILTER (WHERE vote_type = 'up' AND is_deleted = false) -
            COUNT(*) FILTER (WHERE vote_type = 'down' AND is_deleted = false),
            COUNT(*) FILTER (WHERE is_deleted = false)
        FROM votes
        WHERE post_id = OLD.post_id
        GROUP BY post_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time vote count updates
CREATE TRIGGER trigger_refresh_post_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION refresh_post_vote_counts();

-- Function to refresh comment counts
CREATE OR REPLACE FUNCTION refresh_post_comment_counts()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update comment count for the specific post
        DELETE FROM post_comment_counts WHERE post_id = NEW.post_id;
        INSERT INTO post_comment_counts
        SELECT
            NEW.post_id,
            COUNT(*),
            MAX(created_at)
        FROM comments
        WHERE post_id = NEW.post_id AND is_deleted = false
        GROUP BY post_id;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM post_comment_counts WHERE post_id = OLD.post_id;
        INSERT INTO post_comment_counts
        SELECT
            OLD.post_id,
            COUNT(*),
            MAX(created_at)
        FROM comments
        WHERE post_id = OLD.post_id AND is_deleted = false
        GROUP BY post_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time comment count updates
CREATE TRIGGER trigger_refresh_post_comment_counts
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION refresh_post_comment_counts();

-- =============================================
-- PERIODIC MAINTENANCE QUERIES
-- =============================================

-- Refresh user activity summary (run every 15 minutes)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_summary;

-- Clean up old performance logs (run daily)
-- DELETE FROM performance_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Update table statistics for query planner (run weekly)
-- ANALYZE posts;
-- ANALYZE votes;
-- ANALYZE comments;
-- ANALYZE users;
-- ANALYZE follows;

-- =============================================
-- CONNECTION POOL OPTIMIZATION SETTINGS
-- =============================================

-- Recommended PostgreSQL settings for performance
/*
# postgresql.conf settings for YipYap

# Memory settings
shared_buffers = 256MB                    # 25% of RAM for smaller instances
effective_cache_size = 1GB               # 75% of available RAM
work_mem = 4MB                           # Per operation memory

# Connection settings
max_connections = 100                     # Adjust based on connection pool size
shared_preload_libraries = 'pg_stat_statements'

# Query planner settings
random_page_cost = 1.1                   # For SSD storage
effective_io_concurrency = 200           # For SSD storage

# WAL settings
wal_buffers = 16MB
checkpoint_completion_target = 0.7
wal_writer_delay = 200ms

# Logging for performance monitoring
log_min_duration_statement = 1000        # Log queries > 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Statistics collection
track_activities = on
track_counts = on
track_io_timing = on
track_functions = pl
*/