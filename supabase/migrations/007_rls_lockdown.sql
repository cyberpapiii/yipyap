-- Lock down RLS and enforce RPC-only writes per PRD

-- Remove permissive policies from 002
DROP POLICY IF EXISTS "Anyone can create posts" ON posts;
DROP POLICY IF EXISTS "Anyone can create comments" ON comments;
DROP POLICY IF EXISTS "Anyone can manage votes" ON votes;
DROP POLICY IF EXISTS "Anyone can manage thread identities" ON thread_identities;

-- Read policies (public read)
CREATE POLICY "Public can read active posts" ON posts
  FOR SELECT USING (deleted_at IS NULL AND community = 'dimes_square');

CREATE POLICY "Public can read active comments" ON comments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Public can read votes" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Public can read thread identities" ON thread_identities
  FOR SELECT USING (true);

-- Do not create INSERT/UPDATE policies for anon; writes must go through SECURITY DEFINER RPCs

-- Tighten table privileges for anon: allow SELECT only
REVOKE INSERT, UPDATE, DELETE ON posts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON comments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON votes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON thread_identities FROM anon;

GRANT SELECT ON posts, comments, votes, thread_identities TO anon;

-- Ensure RPCs run with SECURITY DEFINER and are callable by anon
ALTER FUNCTION rpc_feed_new(integer, timestamptz) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_feed_hot(integer, integer, timestamptz) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_create_post(uuid, text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_create_comment(uuid, uuid, uuid, text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_vote_post(uuid, uuid, smallint) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_vote_comment(uuid, uuid, smallint) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_ensure_thread_identity(uuid, uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION rpc_reroll_thread_identity(uuid, uuid) SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION rpc_feed_new(integer, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION rpc_feed_hot(integer, integer, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION rpc_create_post(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION rpc_create_comment(uuid, uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION rpc_vote_post(uuid, uuid, smallint) TO anon;
GRANT EXECUTE ON FUNCTION rpc_vote_comment(uuid, uuid, smallint) TO anon;
GRANT EXECUTE ON FUNCTION rpc_ensure_thread_identity(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION rpc_reroll_thread_identity(uuid, uuid) TO anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'rpc_get_thread'
      AND n.nspname = 'public'
      AND pg_get_function_arguments(p.oid) = 'uuid, text, integer, integer'
  ) THEN
    EXECUTE 'ALTER FUNCTION rpc_get_thread(uuid, text, integer, integer) SECURITY DEFINER SET search_path = public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION rpc_get_thread(uuid, text, integer, integer) TO anon';
  END IF;
END;
$$;
