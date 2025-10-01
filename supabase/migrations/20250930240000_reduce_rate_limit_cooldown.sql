-- Reduce rate limit cooldown from 1 hour to 1 minute for better UX

-- Update the rate limit helper function
CREATE OR REPLACE FUNCTION within_last_hour(ts timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ts >= (now() - interval '1 minute')
$$;

-- Note: This function is still named "within_last_hour" for backwards compatibility
-- but now checks a 1-minute window instead of 1 hour.
-- The limits remain: 10 posts, 30 comments, 50 votes per minute (was per hour)
