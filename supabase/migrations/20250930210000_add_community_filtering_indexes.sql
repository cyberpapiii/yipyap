-- Add indexes for efficient community filtering queries
-- These support filtering posts by user subway line groupings

-- Index for joining posts with users on subway_line filter
CREATE INDEX IF NOT EXISTS idx_users_subway_line_id
ON users(subway_line, id);

-- Composite index for hot feed queries with user filter
CREATE INDEX IF NOT EXISTS idx_posts_user_created_score
ON posts(user_id, created_at DESC, score DESC, id)
WHERE deleted_at IS NULL;

-- Comment on indexes for documentation
COMMENT ON INDEX idx_users_subway_line_id IS 'Optimizes community filtering by subway line grouping';
COMMENT ON INDEX idx_posts_user_created_score IS 'Optimizes hot/new feed queries with community filtering';
