-- Migration: Add Database Monitoring Functions
-- Priority: LOW
-- Impact: Enables ongoing performance monitoring and optimization
--
-- This migration creates helper functions for monitoring database health,
-- identifying unused indexes, detecting table bloat, and tracking slow queries.

-- ============================================================================
-- 1. INDEX USAGE MONITORING
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_index_usage()
RETURNS TABLE (
  table_name text,
  index_name text,
  index_size text,
  times_used bigint,
  tuples_read bigint,
  tuples_fetched bigint,
  status text,
  recommendation text
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || t.tablename AS table_name,
    indexname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    CASE
      WHEN idx_scan = 0 THEN '⚠️ UNUSED'
      WHEN idx_scan < 10 THEN '🟡 LOW USAGE'
      WHEN idx_scan < 100 THEN '🟢 MODERATE USAGE'
      ELSE '✅ HIGH USAGE'
    END AS status,
    CASE
      WHEN idx_scan = 0 AND pg_relation_size(indexrelid) > 1024*1024 THEN
        'Consider dropping this index (unused and >1MB)'
      WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 1024*1024 THEN
        'Monitor usage - rarely used index taking up space'
      ELSE 'Keep monitoring'
    END AS recommendation
  FROM pg_stat_user_indexes
  JOIN pg_tables t ON t.tablename = pg_stat_user_indexes.relname AND t.schemaname = schemaname
  WHERE schemaname = 'public'
  ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_index_usage() IS
  'Monitor index usage statistics to identify unused or underutilized indexes';


-- ============================================================================
-- 2. TABLE BLOAT DETECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_table_bloat()
RETURNS TABLE (
  table_name text,
  live_tuples bigint,
  dead_tuples bigint,
  dead_tuple_percent numeric,
  table_size text,
  last_vacuum timestamp with time zone,
  last_autovacuum timestamp with time zone,
  status text,
  recommendation text
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS table_size,
    last_vacuum,
    last_autovacuum,
    CASE
      WHEN n_dead_tup = 0 THEN '✅ HEALTHY'
      WHEN n_dead_tup < 100 THEN '🟢 GOOD'
      WHEN n_dead_tup < 1000 THEN '🟡 MONITOR'
      WHEN ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 20 THEN '🔴 HIGH BLOAT'
      ELSE '⚠️ NEEDS ATTENTION'
    END AS status,
    CASE
      WHEN ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 20 THEN
        'Run VACUUM ANALYZE immediately - over 20% dead tuples'
      WHEN n_dead_tup > 1000 THEN
        'Consider manual VACUUM if autovacuum is slow'
      ELSE 'Table health is good'
    END AS recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY n_dead_tup DESC, dead_tuple_percent DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_table_bloat() IS
  'Detect table bloat from dead tuples that need vacuuming';


-- ============================================================================
-- 3. SEQUENTIAL SCAN DETECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_sequential_scans()
RETURNS TABLE (
  table_name text,
  sequential_scans bigint,
  tuples_read_by_seq_scan bigint,
  index_scans bigint,
  table_size text,
  row_count bigint,
  scan_pattern text,
  recommendation text
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || relname AS table_name,
    seq_scan AS sequential_scans,
    seq_tup_read AS tuples_read_by_seq_scan,
    idx_scan AS index_scans,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS table_size,
    n_live_tup AS row_count,
    CASE
      WHEN seq_scan = 0 AND idx_scan > 0 THEN '✅ INDEX ONLY'
      WHEN seq_scan > 0 AND idx_scan = 0 THEN '🔴 SEQ SCAN ONLY'
      WHEN seq_scan > idx_scan THEN '⚠️ MORE SEQ THAN INDEX'
      WHEN idx_scan > seq_scan THEN '🟢 GOOD INDEX USAGE'
      ELSE '🟡 BALANCED'
    END AS scan_pattern,
    CASE
      WHEN seq_scan > idx_scan AND n_live_tup > 1000 THEN
        'Add indexes for common WHERE/JOIN clauses - table has ' || seq_scan || ' seq scans'
      WHEN seq_scan > 100 AND idx_scan = 0 THEN
        'Critical: Add indexes immediately - only sequential scans detected'
      WHEN seq_scan < 10 THEN
        'Scan pattern is acceptable for small table'
      ELSE 'Monitor query patterns and consider adding indexes'
    END AS recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
    AND (seq_scan > 10 OR idx_scan > 10)
  ORDER BY seq_scan DESC, seq_tup_read DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_sequential_scans() IS
  'Identify tables with high sequential scan rates that may need indexes';


-- ============================================================================
-- 4. DATABASE SIZE OVERVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_database_size()
RETURNS TABLE (
  table_name text,
  table_size text,
  indexes_size text,
  total_size text,
  row_count bigint,
  size_bytes bigint
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || tablename AS table_name,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_live_tup AS row_count,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_database_size() IS
  'Get comprehensive size breakdown of all tables and indexes';


-- ============================================================================
-- 5. FOREIGN KEY INDEX VERIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_foreign_key_indexes()
RETURNS TABLE (
  table_name text,
  foreign_key_columns text,
  references_table text,
  has_index boolean,
  status text,
  recommendation text
) STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.conrelid::regclass::text AS table_name,
    string_agg(a.attname, ', ') AS foreign_key_columns,
    c.confrelid::regclass::text AS references_table,
    EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND c.conkey[1] = i.indkey[0]
    ) AS has_index,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND c.conkey[1] = i.indkey[0])
      THEN '✅ INDEXED'
      ELSE '⚠️ MISSING INDEX'
    END AS status,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND c.conkey[1] = i.indkey[0])
      THEN 'Add index: CREATE INDEX idx_' || split_part(c.conrelid::regclass::text, '.', 2) || '_' ||
           string_agg(a.attname, '_') || ' ON ' || c.conrelid::regclass::text || '(' ||
           string_agg(a.attname, ', ') || ');'
      ELSE 'Foreign key properly indexed'
    END AS recommendation
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.contype = 'f'
    AND c.conrelid::regclass::text LIKE 'public.%'
  GROUP BY c.conrelid, c.contype, c.conname, c.confrelid, c.conkey
  ORDER BY has_index ASC, c.conrelid::regclass::text;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION monitor_foreign_key_indexes() IS
  'Verify all foreign keys have supporting indexes';


-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Run these queries periodically to monitor database health:
--
-- 1. Check index usage (run weekly):
--    SELECT * FROM monitor_index_usage();
--
-- 2. Check table bloat (run daily):
--    SELECT * FROM monitor_table_bloat();
--
-- 3. Check sequential scans (run daily):
--    SELECT * FROM monitor_sequential_scans();
--
-- 4. Check database size (run monthly):
--    SELECT * FROM monitor_database_size();
--
-- 5. Verify foreign key indexes (run after schema changes):
--    SELECT * FROM monitor_foreign_key_indexes();
