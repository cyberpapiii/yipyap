-- Clean Migration: Replace emoji/color with subway_line/subway_color
-- This migration completely replaces the old identity system

-- Drop existing constraints and indexes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_color_valid;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_emoji_not_empty;

-- Drop old columns completely
ALTER TABLE users DROP COLUMN IF EXISTS emoji;
ALTER TABLE users DROP COLUMN IF EXISTS color;

-- Add new subway columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS subway_line text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subway_color text;

-- Add constraints for subway fields (if they don't exist)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subway_line_valid;
ALTER TABLE users ADD CONSTRAINT users_subway_line_valid
  CHECK (subway_line IN ('A', 'B', 'G', 'J', 'L', 'N', '1', '4', '7', 'T'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subway_color_valid;
ALTER TABLE users ADD CONSTRAINT users_subway_color_valid
  CHECK (subway_color IN ('mta-blue', 'mta-orange', 'mta-light-green', 'mta-brown', 'mta-grey', 'mta-yellow', 'mta-red', 'mta-dark-green', 'mta-purple', 'mta-teal'));

-- Make subway fields required
ALTER TABLE users ALTER COLUMN subway_line SET NOT NULL;
ALTER TABLE users ALTER COLUMN subway_color SET NOT NULL;

-- Drop dependent functions and views first
DROP FUNCTION IF EXISTS get_or_create_user(text);
DROP VIEW IF EXISTS anonymous_users_with_activity;
DROP VIEW IF EXISTS anonymous_users;

-- Recreate the anonymous_users view to only use subway fields
CREATE VIEW anonymous_users AS
SELECT
  id,
  device_id,
  subway_line,
  subway_color,
  created_at,
  last_seen_at
FROM users;

-- Recreate anonymous_users_with_activity view
CREATE VIEW anonymous_users_with_activity AS
SELECT
  u.id,
  u.device_id,
  u.subway_line,
  u.subway_color,
  u.created_at,
  u.last_seen_at,
  COALESCE(post_stats.post_count, 0) as post_count,
  COALESCE(comment_stats.comment_count, 0) as comment_count
FROM users u
LEFT JOIN (
  SELECT user_id, COUNT(*) as post_count
  FROM posts
  GROUP BY user_id
) post_stats ON u.id = post_stats.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as comment_count
  FROM comments
  GROUP BY user_id
) comment_stats ON u.id = comment_stats.user_id;

-- Recreate get_or_create_user function with proper subway line/color pairing
DROP FUNCTION IF EXISTS get_or_create_user(text);
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param text)
RETURNS anonymous_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record anonymous_users;
  -- Subway line/color pairs that match official MTA colors
  subway_pairs text[][] := ARRAY[
    ARRAY['A', 'mta-blue'],
    ARRAY['B', 'mta-orange'],
    ARRAY['G', 'mta-light-green'],
    ARRAY['J', 'mta-brown'],
    ARRAY['L', 'mta-grey'],
    ARRAY['N', 'mta-yellow'],
    ARRAY['1', 'mta-red'],
    ARRAY['4', 'mta-dark-green'],
    ARRAY['7', 'mta-purple'],
    ARRAY['T', 'mta-teal']
  ];
  selected_pair text[];
  selected_line text;
  selected_color text;
BEGIN
  -- Try to find existing user
  SELECT * INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  -- If user exists, update last_seen_at and return
  IF FOUND THEN
    UPDATE users
    SET last_seen_at = NOW()
    WHERE device_id = device_id_param;

    SELECT * INTO user_record
    FROM anonymous_users
    WHERE device_id = device_id_param;

    RETURN user_record;
  END IF;

  -- Select a random subway line/color pair
  selected_pair := subway_pairs[1 + floor(random() * array_length(subway_pairs, 1))];
  selected_line := selected_pair[1];
  selected_color := selected_pair[2];

  INSERT INTO users (device_id, subway_line, subway_color, created_at, last_seen_at)
  VALUES (device_id_param, selected_line, selected_color, NOW(), NOW())
  RETURNING * INTO user_record;

  SELECT * INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  RETURN user_record;
END;
$$;