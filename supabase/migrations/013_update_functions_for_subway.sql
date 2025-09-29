-- Migration: Update database functions and views to use subway_line/subway_color
-- This is Step 3 of the emoji/color to subway migration
--
-- SAFETY: This migration updates functions to use new subway fields while
-- maintaining backward compatibility where possible.
--
-- IMPORTANT: Run this migration only after 012_migrate_emoji_to_subway.sql
-- has been successfully applied and verified.

-- Update the anonymous_users view to include subway fields
DROP VIEW IF EXISTS anonymous_users CASCADE;
CREATE VIEW anonymous_users AS
SELECT
  id,
  device_id,
  emoji,
  color,
  subway_line,
  subway_color,
  created_at,
  last_seen_at
FROM users;

-- Update the anonymous_users_with_activity view
DROP VIEW IF EXISTS anonymous_users_with_activity CASCADE;
CREATE VIEW anonymous_users_with_activity AS
SELECT
  u.id,
  u.device_id,
  u.emoji,
  u.color,
  u.subway_line,
  u.subway_color,
  u.created_at,
  u.last_seen_at,
  u.total_karma,
  u.posts_created,
  u.comments_created
FROM users u;

-- Update get_or_create_user function to use subway fields
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
  -- Legacy emoji/color arrays for backward compatibility during transition
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['purple','blue','green','orange','red'];
  chosen_subway_line text;
  chosen_subway_color text;
  chosen_emoji text;
  chosen_color text;
  mapping_index integer;
BEGIN
  -- Try to find existing user
  SELECT id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
  INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  IF FOUND THEN
    -- Update last seen timestamp
    UPDATE users
    SET last_seen_at = NOW()
    WHERE id = user_record.id
    RETURNING id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
    INTO user_record;
    RETURN user_record;
  END IF;

  -- Generate new user identity with consistent mapping
  -- Choose a random index for consistent emoji/color/subway mapping
  mapping_index := 1 + (floor(random() * 10))::int;

  -- Map index to subway values
  chosen_subway_line := subway_lines[mapping_index];
  chosen_subway_color := subway_colors[mapping_index];

  -- Map to corresponding legacy emoji/color for backward compatibility
  CASE mapping_index
    WHEN 1 THEN chosen_emoji := '🎭'; chosen_color := 'purple';   -- A, mta-blue
    WHEN 2 THEN chosen_emoji := '🦄'; chosen_color := 'blue';     -- B, mta-orange
    WHEN 3 THEN chosen_emoji := '🚀'; chosen_color := 'green';    -- G, mta-light-green
    WHEN 4 THEN chosen_emoji := '🌟'; chosen_color := 'orange';   -- J, mta-brown
    WHEN 5 THEN chosen_emoji := '🔥'; chosen_color := 'red';      -- L, mta-grey
    WHEN 6 THEN chosen_emoji := '💫'; chosen_color := 'purple';   -- N, mta-yellow
    WHEN 7 THEN chosen_emoji := '🎨'; chosen_color := 'blue';     -- 1, mta-red
    WHEN 8 THEN chosen_emoji := '🌈'; chosen_color := 'green';    -- 4, mta-dark-green
    WHEN 9 THEN chosen_emoji := '⚡'; chosen_color := 'orange';   -- 7, mta-purple
    WHEN 10 THEN chosen_emoji := '🎪'; chosen_color := 'red';     -- T, mta-teal
    ELSE chosen_emoji := '🎭'; chosen_color := 'purple';          -- Default fallback
  END CASE;

  -- Create new user with both legacy and subway identity
  INSERT INTO users (device_id, emoji, color, subway_line, subway_color, last_seen_at)
  VALUES (device_id_param, chosen_emoji, chosen_color, chosen_subway_line, chosen_subway_color, NOW())
  RETURNING id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
  INTO user_record;

  RETURN user_record;
END;
$$;

-- Create new function that returns subway identity specifically
CREATE OR REPLACE FUNCTION get_subway_identity(user_id_param UUID, post_id_param UUID)
RETURNS TABLE(subway_line TEXT, subway_color TEXT) AS $$
BEGIN
    -- For subway identities, we use the user's permanent subway identity
    -- rather than per-thread identities (different from emoji system)
    RETURN QUERY
    SELECT u.subway_line, u.subway_color
    FROM users u
    WHERE u.id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Update the hot_posts materialized view to include subway fields
DROP MATERIALIZED VIEW IF EXISTS hot_posts;
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,
    -- Legacy emoji/color for backward compatibility
    COALESCE(ti.emoji, u.emoji, '🤔') as user_emoji,
    COALESCE(ti.color_code, '#6B7280') as user_color,
    -- New subway fields
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
LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
WHERE p.deleted_at IS NULL
ORDER BY hot_score DESC, p.created_at DESC;

CREATE UNIQUE INDEX idx_hot_posts_id ON hot_posts(id);
CREATE INDEX idx_hot_posts_hot_score ON hot_posts(hot_score DESC);
CREATE INDEX idx_hot_posts_community ON hot_posts(community);
CREATE INDEX idx_hot_posts_subway_line ON hot_posts(user_subway_line);

-- Update get_posts_paginated function to include subway fields
DROP FUNCTION IF EXISTS get_posts_paginated(TEXT, TEXT, INTEGER, INTEGER);
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
    user_color TEXT,
    user_subway_line TEXT,
    user_subway_color TEXT
) AS $$
BEGIN
    IF sort_by = 'hot' THEN
        RETURN QUERY
        SELECT hp.id, hp.title, hp.content, hp.created_at, hp.score, hp.comment_count,
               hp.user_emoji, hp.user_color, hp.user_subway_line, hp.user_subway_color
        FROM hot_posts hp
        WHERE hp.community = community_param
        ORDER BY hp.hot_score DESC, hp.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'new' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'top' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.score DESC, p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update get_comments_tree function to include subway fields
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
    user_emoji TEXT,
    user_color TEXT,
    user_subway_line TEXT,
    user_subway_color TEXT,
    thread_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.parent_id, c.content, c.created_at, c.depth, c.score, c.reply_count,
           COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
           COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue'), c.thread_path
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN thread_identities ti ON c.post_id = ti.post_id AND c.user_id = ti.user_id
    WHERE c.post_id = post_id_param AND c.deleted_at IS NULL
    ORDER BY c.thread_path;
END;
$$ LANGUAGE plpgsql;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;