-- Verification script for subway line filtering database schema
-- Run this to verify all migrations applied correctly

\echo '=== 1. Verify posts.user_subway_line column exists ==='
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name = 'user_subway_line';

\echo ''
\echo '=== 2. Verify user_subway_line constraint ==='
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'posts'::regclass
  AND conname LIKE '%subway%';

\echo ''
\echo '=== 3. Verify subway line indexes exist ==='
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'posts'
  AND indexname LIKE '%subway%'
ORDER BY indexname;

\echo ''
\echo '=== 4. Verify rpc_create_post function signature ==='
SELECT
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'rpc_create_post';

\echo ''
\echo '=== 5. Verify post_with_stats view includes user_subway_line ==='
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'post_with_stats'
  AND column_name = 'user_subway_line';

\echo ''
\echo '=== 6. Verify hot_posts materialized view includes user_subway_line ==='
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'hot_posts'
  AND column_name = 'user_subway_line';

\echo ''
\echo '=== 7. Check hot_posts indexes ==='
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'hot_posts'
  AND indexname LIKE '%subway%'
ORDER BY indexname;

\echo ''
\echo '=== 8. Verify old redundant indexes were dropped ==='
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE indexname = 'idx_posts_score') > 0
      THEN 'ERROR: idx_posts_score still exists (should be dropped)'
    WHEN COUNT(*) FILTER (WHERE indexname = 'idx_posts_created_at') > 0
      THEN 'ERROR: idx_posts_created_at still exists (should be dropped)'
    ELSE 'OK: Redundant indexes successfully dropped'
  END as status
FROM pg_indexes
WHERE tablename = 'posts'
  AND indexname IN ('idx_posts_score', 'idx_posts_created_at');

\echo ''
\echo '=== 9. Count existing posts (if any) ==='
SELECT
  COUNT(*) as total_posts,
  COUNT(user_subway_line) as posts_with_subway_line,
  COUNT(*) FILTER (WHERE user_subway_line IS NULL) as posts_missing_subway_line
FROM posts;

\echo ''
\echo '=== 10. Sample post data (if exists) ==='
SELECT
  id,
  user_id,
  user_subway_line,
  LEFT(content, 50) as content_preview,
  score,
  created_at
FROM posts
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '=== VERIFICATION COMPLETE ==='
\echo 'Expected results:'
\echo '1. user_subway_line column exists and is NOT NULL'
\echo '2. Constraint allows 1-7, A-Z subway lines'
\echo '3. Three subway line indexes exist on posts table'
\echo '4. rpc_create_post returns type "posts"'
\echo '5-6. Views include user_subway_line column'
\echo '7. hot_posts has subway_line indexes'
\echo '8. Redundant indexes were dropped'
\echo '9-10. Any existing posts have valid user_subway_line values'
