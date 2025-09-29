-- Migration: Drop legacy emoji and color columns
-- This is Step 4 of the emoji/color to subway migration
--
-- CRITICAL SAFETY NOTICE:
-- This migration is DESTRUCTIVE and IRREVERSIBLE without backups!
--
-- PREREQUISITES (ALL must be verified before running):
-- 1. Migrations 011, 012, 013 have been successfully applied
-- 2. All application code has been updated to use subway_line/subway_color
-- 3. Database backup has been created
-- 4. Migration has been tested in staging environment
-- 5. Rollback plan has been prepared and tested
--
-- DO NOT RUN THIS MIGRATION until you are absolutely certain that:
-- - No application code references emoji/color fields
-- - All integrations have been updated
-- - You have verified in production for at least 24-48 hours
-- - You have confirmed with your team that the migration is ready

-- Pre-drop validation
DO $$
DECLARE
  total_users INTEGER;
  users_with_subway_data INTEGER;
  users_missing_subway_data INTEGER;
BEGIN
  -- Validate that all users have subway data
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_subway_data
  FROM users WHERE subway_line IS NOT NULL AND subway_color IS NOT NULL;

  users_missing_subway_data := total_users - users_with_subway_data;

  RAISE NOTICE 'Pre-drop validation:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Users with subway data: %', users_with_subway_data;
  RAISE NOTICE '  Users missing subway data: %', users_missing_subway_data;

  -- Abort if any users are missing subway data
  IF users_missing_subway_data > 0 THEN
    RAISE EXCEPTION 'ABORTING: % users are missing subway data. Migration is not safe to proceed.', users_missing_subway_data;
  END IF;

  -- Abort if subway data doesn't match expected values
  IF EXISTS (
    SELECT 1 FROM users
    WHERE subway_line NOT IN ('A','B','G','J','L','N','1','4','7','T')
    OR subway_color NOT IN ('mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey','mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal')
  ) THEN
    RAISE EXCEPTION 'ABORTING: Some users have invalid subway data. Migration is not safe to proceed.';
  END IF;

  RAISE NOTICE 'Pre-drop validation PASSED. All users have valid subway data.';
END;
$$;

-- Final warning pause (requires manual confirmation)
-- Uncomment the next line only when you're absolutely ready to proceed
-- DO $$ BEGIN RAISE NOTICE 'FINAL WARNING: Destructive migration will proceed in 10 seconds...'; PERFORM pg_sleep(10); END $$;

-- Create final backup with complete identity mapping before dropping columns
DROP TABLE IF EXISTS users_identity_mapping_final;
CREATE TABLE users_identity_mapping_final AS
SELECT
  id,
  device_id,
  emoji,
  color,
  subway_line,
  subway_color,
  created_at,
  'pre_column_drop_backup' as backup_reason,
  NOW() as backup_created_at
FROM users;

CREATE INDEX idx_users_identity_mapping_final_id ON users_identity_mapping_final(id);
CREATE INDEX idx_users_identity_mapping_final_device ON users_identity_mapping_final(device_id);

-- Update views to remove emoji/color columns before dropping them
DROP VIEW IF EXISTS anonymous_users CASCADE;
CREATE VIEW anonymous_users AS
SELECT
  id,
  device_id,
  subway_line,
  subway_color,
  created_at,
  last_seen_at
FROM users;

DROP VIEW IF EXISTS anonymous_users_with_activity CASCADE;
CREATE VIEW anonymous_users_with_activity AS
SELECT
  u.id,
  u.device_id,
  u.subway_line,
  u.subway_color,
  u.created_at,
  u.last_seen_at,
  u.total_karma,
  u.posts_created,
  u.comments_created
FROM users u;

-- Update get_or_create_user function to only use subway fields
DROP FUNCTION IF EXISTS get_or_create_user(TEXT);
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param TEXT)
RETURNS anonymous_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record anonymous_users%ROWTYPE;
  subway_lines text[] := ARRAY['A','B','G','J','L','N','1','4','7','T'];
  subway_colors text[] := ARRAY[
    'mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey',
    'mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal'
  ];
  chosen_subway_line text;
  chosen_subway_color text;
BEGIN
  -- Try to find existing user
  SELECT id, device_id, subway_line, subway_color, created_at, last_seen_at
  INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  IF FOUND THEN
    -- Update last seen timestamp
    UPDATE users
    SET last_seen_at = NOW()
    WHERE id = user_record.id
    RETURNING id, device_id, subway_line, subway_color, created_at, last_seen_at
    INTO user_record;
    RETURN user_record;
  END IF;

  -- Generate new user identity
  chosen_subway_line := subway_lines[1 + (floor(random() * array_length(subway_lines, 1)))::int];
  chosen_subway_color := subway_colors[1 + (floor(random() * array_length(subway_colors, 1)))::int];

  -- Create new user with subway identity
  INSERT INTO users (device_id, subway_line, subway_color, last_seen_at)
  VALUES (device_id_param, chosen_subway_line, chosen_subway_color, NOW())
  RETURNING id, device_id, subway_line, subway_color, created_at, last_seen_at
  INTO user_record;

  RETURN user_record;
END;
$$;

-- Update materialized view to remove emoji dependencies
DROP MATERIALIZED VIEW IF EXISTS hot_posts;
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,
    COALESCE(u.subway_line, 'A') as user_subway_line,
    COALESCE(u.subway_color, 'mta-blue') as user_subway_color,
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
WHERE p.deleted_at IS NULL
ORDER BY hot_score DESC, p.created_at DESC;

CREATE UNIQUE INDEX idx_hot_posts_id ON hot_posts(id);
CREATE INDEX idx_hot_posts_hot_score ON hot_posts(hot_score DESC);
CREATE INDEX idx_hot_posts_community ON hot_posts(community);
CREATE INDEX idx_hot_posts_subway_line ON hot_posts(user_subway_line);

-- Update functions to remove emoji dependencies
DROP FUNCTION IF EXISTS get_posts_paginated(TEXT, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_posts_paginated(
    community_param TEXT DEFAULT 'dimes_square',
    sort_by TEXT DEFAULT 'hot',
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
    user_subway_line TEXT,
    user_subway_color TEXT
) AS $$
BEGIN
    IF sort_by = 'hot' THEN
        RETURN QUERY
        SELECT hp.id, hp.title, hp.content, hp.created_at, hp.score, hp.comment_count,
               hp.user_subway_line, hp.user_subway_color
        FROM hot_posts hp
        WHERE hp.community = community_param
        ORDER BY hp.hot_score DESC, hp.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'new' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'top' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.score DESC, p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_comments_tree(UUID);
CREATE OR REPLACE FUNCTION get_comments_tree(post_id_param UUID)
RETURNS TABLE(
    id UUID,
    parent_id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    depth INTEGER,
    score INTEGER,
    reply_count INTEGER,
    user_subway_line TEXT,
    user_subway_color TEXT,
    thread_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.parent_id, c.content, c.created_at, c.depth, c.score, c.reply_count,
           COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue'), c.thread_path
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = post_id_param AND c.deleted_at IS NULL
    ORDER BY c.thread_path;
END;
$$ LANGUAGE plpgsql;

-- THE POINT OF NO RETURN
-- Drop the legacy columns (THIS IS IRREVERSIBLE without backup restore)
-- Only uncomment the following lines when you are absolutely certain:

/*
ALTER TABLE users
  DROP COLUMN IF EXISTS emoji,
  DROP COLUMN IF EXISTS color;

-- Drop legacy constraints that referenced the deleted columns
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_color_valid,
  DROP CONSTRAINT IF EXISTS users_emoji_not_empty;

RAISE NOTICE 'Legacy emoji and color columns have been PERMANENTLY DROPPED.';
RAISE NOTICE 'Rollback is only possible by restoring from backup.';
*/

-- Refresh materialized view
REFRESH MATERIALIZED VIEW hot_posts;

-- Final validation
DO $$
DECLARE
  total_users INTEGER;
  users_with_subway_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_subway_data
  FROM users WHERE subway_line IS NOT NULL AND subway_color IS NOT NULL;

  RAISE NOTICE 'Post-migration validation:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Users with subway data: %', users_with_subway_data;
  RAISE NOTICE '  Legacy columns dropped: %', NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('emoji', 'color')
  );

  IF users_with_subway_data = total_users THEN
    RAISE NOTICE 'SUCCESS: Migration completed. All users have subway identity data.';
  ELSE
    RAISE EXCEPTION 'FAILED: Some users are missing subway data after migration.';
  END IF;
END;
$$;