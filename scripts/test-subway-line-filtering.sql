-- Test script for subway line filtering performance
-- Tests denormalized user_subway_line queries and indexes

-- Step 1: Create test users (one for each subway line)
DO $$
DECLARE
  subway_lines text[] := ARRAY['A','B','C','1','2','3','4','7','G','J','L','N','Q','R','W','T'];
  line text;
  user_id uuid;
BEGIN
  FOREACH line IN ARRAY subway_lines
  LOOP
    INSERT INTO users (device_id, subway_line, subway_color)
    VALUES (
      'test_device_' || line,
      line,
      CASE line
        WHEN 'A' THEN 'mta-blue'
        WHEN 'B' THEN 'mta-orange'
        WHEN 'C' THEN 'mta-blue'
        WHEN '1' THEN 'mta-red'
        WHEN '2' THEN 'mta-red'
        WHEN '3' THEN 'mta-red'
        WHEN '4' THEN 'mta-dark-green'
        WHEN '7' THEN 'mta-purple'
        WHEN 'G' THEN 'mta-light-green'
        WHEN 'J' THEN 'mta-brown'
        WHEN 'L' THEN 'mta-grey'
        WHEN 'N' THEN 'mta-yellow'
        WHEN 'Q' THEN 'mta-yellow'
        WHEN 'R' THEN 'mta-yellow'
        WHEN 'W' THEN 'mta-yellow'
        WHEN 'T' THEN 'mta-teal'
        ELSE 'mta-blue'
      END
    )
    ON CONFLICT (device_id) DO NOTHING;
  END LOOP;
END $$;

-- Step 2: Create test posts using RPC (tests denormalization logic)
DO $$
DECLARE
  user_record RECORD;
  post_count int := 10; -- Create 10 posts per user
  i int;
BEGIN
  FOR user_record IN SELECT id, subway_line FROM users WHERE device_id LIKE 'test_device_%'
  LOOP
    FOR i IN 1..post_count
    LOOP
      PERFORM rpc_create_post(
        user_record.id,
        'Test post ' || i || ' from ' || user_record.subway_line || ' line user'
      );
      -- Add small delay to vary created_at timestamps
      PERFORM pg_sleep(0.01);
    END LOOP;
  END LOOP;
END $$;

-- Step 3: Manually add random scores for testing hot feed
UPDATE posts
SET score = floor(random() * 100)::int
WHERE content LIKE 'Test post%';

-- Step 4: Verify denormalization worked correctly
\echo '=== Verification: Denormalization Consistency ==='
SELECT COUNT(*) as inconsistent_posts
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_subway_line != u.subway_line;
-- Expected: 0

-- Step 5: Test post distribution by subway line
\echo '=== Post Distribution by Subway Line ==='
SELECT
  user_subway_line,
  COUNT(*) as post_count
FROM posts
WHERE deleted_at IS NULL
  AND content LIKE 'Test post%'
GROUP BY user_subway_line
ORDER BY user_subway_line;

-- Step 6: Test Query Performance - Hot Feed (All Lines)
\echo '=== Query Test 1: Hot Feed (NYC - All Lines) ==='
EXPLAIN ANALYZE
SELECT id, content, user_subway_line, score, comment_count, created_at
FROM posts
WHERE deleted_at IS NULL
ORDER BY score DESC, created_at DESC
LIMIT 20;

-- Step 7: Test Query Performance - Hot Feed (Blue Line: A, C, E)
\echo '=== Query Test 2: Hot Feed (Blue Line - A, C, E) ==='
EXPLAIN ANALYZE
SELECT id, content, user_subway_line, score, comment_count, created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['A', 'C', 'E'])
ORDER BY score DESC, created_at DESC
LIMIT 20;

-- Step 8: Test Query Performance - Hot Feed (Red Line: 1, 2, 3)
\echo '=== Query Test 3: Hot Feed (Red Line - 1, 2, 3) ==='
EXPLAIN ANALYZE
SELECT id, content, user_subway_line, score, comment_count, created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['1', '2', '3'])
ORDER BY score DESC, created_at DESC
LIMIT 20;

-- Step 9: Test Query Performance - New Feed (Yellow Line: N, Q, R, W)
\echo '=== Query Test 4: New Feed (Yellow Line - N, Q, R, W) ==='
EXPLAIN ANALYZE
SELECT id, content, user_subway_line, score, comment_count, created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['N', 'Q', 'R', 'W'])
ORDER BY created_at DESC
LIMIT 20;

-- Step 10: Test Index Usage
\echo '=== Index Usage Statistics ==='
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'posts'
  AND indexname LIKE '%subway%'
ORDER BY indexname;

-- Step 11: Test hot_posts Materialized View
\echo '=== Hot Posts Materialized View Test ==='
EXPLAIN ANALYZE
SELECT *
FROM hot_posts
WHERE user_subway_line = ANY(ARRAY['A', 'C', 'E'])
ORDER BY hot_score DESC
LIMIT 20;

-- Step 12: Community Stats Query
\echo '=== Community Stats Query ==='
EXPLAIN ANALYZE
SELECT
  user_subway_line,
  COUNT(*) as post_count,
  SUM(comment_count) as total_comments,
  AVG(score)::int as avg_score,
  MAX(score) as max_score
FROM posts
WHERE deleted_at IS NULL
  AND content LIKE 'Test post%'
GROUP BY user_subway_line
ORDER BY post_count DESC;

\echo '=== Test Complete ==='
\echo 'All queries should use subway_line indexes for optimal performance.'
\echo 'Check EXPLAIN ANALYZE output for index scans vs sequential scans.'
