-- Thread RPC with Best/New sorting and paging

-- Compute best score for a comment based on age and score
CREATE OR REPLACE FUNCTION best_score(score integer, created_at timestamptz)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN score IS NULL THEN 0
    ELSE score::double precision / (pow(GREATEST(EXTRACT(EPOCH FROM (now() - created_at)), 1)::double precision, 0.5) + 1)
  END
$$;

-- Get ordered comments for a thread (flat list)
CREATE OR REPLACE FUNCTION rpc_get_thread(
  p_post uuid,
  p_sort text DEFAULT 'new',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  parent_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  score integer,
  reply_count integer,
  depth integer,
  is_op boolean,
  identity_emoji text,
  identity_color text
) LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT c.*, (c.user_id = p.user_id) AS is_op,
           ti.emoji AS identity_emoji, ti.color_code AS identity_color
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    LEFT JOIN thread_identities ti ON ti.post_id = c.post_id AND ti.user_id = c.user_id
    WHERE c.post_id = p_post AND c.deleted_at IS NULL
  ), tops AS (
    SELECT * FROM base WHERE parent_id IS NULL
  )
  SELECT b.id, b.post_id, b.parent_id, b.user_id, b.content, b.created_at, b.updated_at,
         b.score, b.reply_count, b.depth, b.is_op, b.identity_emoji, b.identity_color
  FROM base b
  JOIN tops t ON (b.id = t.id OR b.parent_id = t.id)
  ORDER BY
    CASE WHEN p_sort = 'best' THEN best_score(t.score, t.created_at) END DESC NULLS LAST,
    CASE WHEN p_sort = 'new'  THEN t.created_at END DESC NULLS LAST,
    -- keep parent row before replies
    b.parent_id NULLS FIRST,
    b.created_at ASC
  LIMIT p_limit OFFSET p_offset;
$$;

