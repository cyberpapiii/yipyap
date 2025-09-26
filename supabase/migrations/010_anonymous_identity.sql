-- Align users table with anonymous identity expectations and expose view for frontend

-- Add identity columns if they do not exist yet
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Backfill any missing identity data with deterministic random selections
DO $$
DECLARE
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['purple','blue','green','orange','red'];
BEGIN
  UPDATE users u
  SET
    emoji = COALESCE(u.emoji, emojis[1 + (floor(random() * array_length(emojis, 1)))::int]),
    color = COALESCE(u.color, colors[1 + (floor(random() * array_length(colors, 1)))::int]),
    last_seen_at = COALESCE(u.last_seen_at, NOW());
END;
$$;

-- Enforce non-null constraints and sensible defaults
ALTER TABLE users
  ALTER COLUMN emoji SET NOT NULL,
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN last_seen_at SET NOT NULL,
  ALTER COLUMN emoji SET DEFAULT '🎭',
  ALTER COLUMN color SET DEFAULT 'purple',
  ALTER COLUMN last_seen_at SET DEFAULT NOW();

-- Ensure color stays within the supported palette and emoji is not empty
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_color_valid,
  ADD CONSTRAINT users_color_valid CHECK (color = ANY (ARRAY['purple','blue','green','orange','red']));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_emoji_not_empty,
  ADD CONSTRAINT users_emoji_not_empty CHECK (length(emoji) > 0);

-- Refresh anonymous users view to match frontend expectations
DROP VIEW IF EXISTS anonymous_users;
CREATE VIEW anonymous_users AS
SELECT
  id,
  device_id,
  emoji,
  color,
  created_at,
  last_seen_at
FROM users;

DROP FUNCTION IF EXISTS get_or_create_user(TEXT);

-- Return full anonymous user record (with identity) when creating or fetching by device id
CREATE OR REPLACE FUNCTION get_or_create_user(device_id_param TEXT)
RETURNS anonymous_users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record anonymous_users%ROWTYPE;
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['purple','blue','green','orange','red'];
  chosen_emoji text;
  chosen_color text;
BEGIN
  SELECT id, device_id, emoji, color, created_at, last_seen_at
  INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  IF FOUND THEN
    UPDATE users
    SET last_seen_at = NOW()
    WHERE id = user_record.id
    RETURNING id, device_id, emoji, color, created_at, last_seen_at
    INTO user_record;
    RETURN user_record;
  END IF;

  chosen_emoji := emojis[1 + (floor(random() * array_length(emojis, 1)))::int];
  chosen_color := colors[1 + (floor(random() * array_length(colors, 1)))::int];

  INSERT INTO users (device_id, emoji, color, last_seen_at)
  VALUES (device_id_param, chosen_emoji, chosen_color, NOW())
  RETURNING id, device_id, emoji, color, created_at, last_seen_at
  INTO user_record;

  RETURN user_record;
END;
$$;

-- Surface the refreshed identity via a helper for analytics/diagnostics, if needed
CREATE OR REPLACE VIEW anonymous_users_with_activity AS
SELECT
  u.id,
  u.device_id,
  u.emoji,
  u.color,
  u.created_at,
  u.last_seen_at,
  u.total_karma,
  u.posts_created,
  u.comments_created
FROM users u;
