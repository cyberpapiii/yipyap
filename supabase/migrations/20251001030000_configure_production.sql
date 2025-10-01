-- Ensure edge_function_config table exists (in case it wasn't created)
CREATE TABLE IF NOT EXISTS edge_function_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configure production edge function settings
INSERT INTO edge_function_config (key, value)
VALUES
  ('edge_function_url', 'https://nacbcypcopzbyxgbiips.supabase.co/functions/v1'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hY2JjeXBjb3B6Ynl4Z2JpaXBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkyMTc5NSwiZXhwIjoyMDc0NDk3Nzk1fQ.l7UnHG_ry6_542_ZC2hK5QMv8TyVZ363glKGAb0gdC0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Verify configuration
SELECT
  key,
  CASE
    WHEN key = 'service_role_key' THEN LEFT(value, 50) || '...'
    ELSE value
  END as value_display,
  updated_at
FROM edge_function_config
ORDER BY key;
