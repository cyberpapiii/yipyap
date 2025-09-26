-- RPCs for feeds per PRD

-- New feed: reverse chronological with optional cursor
CREATE OR REPLACE FUNCTION rpc_feed_new(
  p_limit integer DEFAULT 20,
  p_cursor_ts timestamptz DEFAULT NULL
)
RETURNS SETOF posts
LANGUAGE sql
AS $$
  SELECT *
  FROM posts
  WHERE community = 'dimes_square'
    AND deleted_at IS NULL
    AND (p_cursor_ts IS NULL OR created_at < p_cursor_ts)
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- Hot feed: last 24h ranked by score DESC then created_at DESC with optional (score, ts) cursor
CREATE OR REPLACE FUNCTION rpc_feed_hot(
  p_limit integer DEFAULT 20,
  p_cursor_score integer DEFAULT NULL,
  p_cursor_ts timestamptz DEFAULT NULL
)
RETURNS SETOF posts
LANGUAGE sql
AS $$
  SELECT *
  FROM posts
  WHERE community = 'dimes_square'
    AND deleted_at IS NULL
    AND created_at >= (now() - interval '24 hours')
    AND (
      p_cursor_score IS NULL OR p_cursor_ts IS NULL OR
      (score < p_cursor_score) OR (score = p_cursor_score AND created_at < p_cursor_ts)
    )
  ORDER BY score DESC, created_at DESC
  LIMIT p_limit;
$$;

-- Basic thread read (top-level comments only). Full rpc_get_thread is deferred; using direct queries in app for now.

