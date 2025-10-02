-- Relax rate limit cooldown from 1 minute to 10 seconds for testing purposes

-- Update the rate limit helper function
CREATE OR REPLACE FUNCTION within_last_hour(ts timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ts >= (now() - interval '10 seconds')
$$;

-- Note: This function is still named "within_last_hour" for backwards compatibility
-- but now checks a 10-second window.
-- The limits remain: 10 posts, 30 comments, 50 votes per 10 seconds.
