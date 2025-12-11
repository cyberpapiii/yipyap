-- Restore read access on votes for anon/authenticated/service roles
-- A prior migration revoked SELECT, which broke vote lookups in tests and UI

GRANT SELECT ON votes TO anon;
GRANT SELECT ON votes TO authenticated;
GRANT SELECT ON votes TO service_role;

-- Keep existing RLS policy "Public can read votes"
