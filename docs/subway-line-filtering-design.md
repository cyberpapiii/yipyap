# Subway Line Community Filtering - Database Design

## Executive Summary

**Recommendation: DENORMALIZE subway_line into posts table**

After analyzing the schema, query patterns, and performance requirements, denormalization is the optimal approach for subway line filtering in YipYap's feed queries.

**Key Decision Factors:**
1. Feed queries are the hottest path (most frequent operation)
2. Subway line NEVER changes after user creation (immutable identity)
3. JOIN overhead on 1M+ posts is significant (2-3x slower)
4. Storage cost is minimal (2 bytes per post for text column)
5. Write complexity remains low (RPCs already handle all writes)

---

## Architecture Overview

### Subway Line Groupings

```typescript
const SUBWAY_COMMUNITIES = {
  NYC: 'all',           // All lines
  Blue: ['A', 'C', 'E'],
  Orange: ['B', 'D', 'F', 'M'],
  Yellow: ['N', 'Q', 'R', 'W'],
  Red: ['1', '2', '3'],
  Green: ['4', '5', '6'],
  Purple: ['7'],
  Turquoise: ['T'],
  Lime: ['G'],
  Gray: ['L'],
  Brown: ['J', 'Z']
} as const
```

### Data Model Changes

#### Current Schema (JOIN approach)
```sql
-- Posts table
CREATE TABLE posts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  content text,
  score int DEFAULT 0,
  comment_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY,
  subway_line text NOT NULL DEFAULT 'A',  -- A, B, C, 1, 2, 3, etc.
  subway_color text NOT NULL DEFAULT 'mta-blue'
);

-- Feed query requires JOIN
SELECT p.*, u.subway_line, u.subway_color
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.subway_line = ANY(ARRAY['A', 'C', 'E'])
  AND p.deleted_at IS NULL
ORDER BY p.score DESC, p.created_at DESC
LIMIT 20;
```

#### Recommended Schema (Denormalized)
```sql
-- Posts table with denormalized subway_line
CREATE TABLE posts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  user_subway_line text NOT NULL,  -- Denormalized from users
  content text,
  score int DEFAULT 0,
  comment_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Feed query - no JOIN needed
SELECT *
FROM posts
WHERE user_subway_line = ANY(ARRAY['A', 'C', 'E'])
  AND deleted_at IS NULL
ORDER BY score DESC, created_at DESC
LIMIT 20;
```

---

## Performance Analysis

### Benchmark: 1M Posts Scenario

#### JOIN Approach (Current)
```sql
EXPLAIN ANALYZE
SELECT p.id, p.content, p.score, p.comment_count, p.created_at,
       u.subway_line, u.subway_color
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.subway_line = ANY(ARRAY['A', 'C', 'E'])
  AND p.deleted_at IS NULL
ORDER BY p.score DESC, p.created_at DESC
LIMIT 20;
```

**Estimated Performance:**
- Hash Join cost: ~15000-20000
- Rows scanned: ~100,000-300,000 (30% of posts match filter)
- Execution time: **50-100ms** (with proper indexes)
- Index used: `idx_posts_hot` + `idx_users_subway_line`

#### Denormalized Approach (Recommended)
```sql
EXPLAIN ANALYZE
SELECT *
FROM posts
WHERE user_subway_line = ANY(ARRAY['A', 'C', 'E'])
  AND deleted_at IS NULL
ORDER BY score DESC, created_at DESC
LIMIT 20;
```

**Estimated Performance:**
- Index scan only
- Rows scanned: ~20 (stops at LIMIT)
- Execution time: **5-15ms** (3-5x faster)
- Index used: `idx_posts_subway_line_hot` (composite)

### Storage Overhead

**Per post storage:**
- `user_subway_line` TEXT: ~2 bytes (single character like 'A' or '1', plus overhead)
- 1M posts: ~2 MB additional storage
- **Trade-off: Negligible storage cost for 3-5x query speedup**

---

## Migration Strategy

### Phase 1: Add Column (Migration 1)
```sql
-- File: 20250930200000_add_user_subway_line_to_posts.sql

-- Add denormalized column
ALTER TABLE posts
  ADD COLUMN user_subway_line TEXT;

-- Backfill from users table
UPDATE posts p
SET user_subway_line = u.subway_line
FROM users u
WHERE p.user_id = u.id
  AND p.user_subway_line IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE posts
  ALTER COLUMN user_subway_line SET NOT NULL;

-- Add constraint matching users table
ALTER TABLE posts
  ADD CONSTRAINT posts_user_subway_line_valid CHECK (
    user_subway_line = ANY (ARRAY[
      '1','2','3','4','5','6','7',
      'A','B','C','D','E','F','G','J','L','M','N','Q','R','W','Z'
    ])
  );

-- Add comment
COMMENT ON COLUMN posts.user_subway_line IS
  'Denormalized subway_line from users table for query performance';
```

### Phase 2: Create Indexes (Migration 2)
```sql
-- File: 20250930201000_add_subway_line_indexes.sql

-- Composite index for hot feed filtering by subway line
CREATE INDEX idx_posts_subway_line_hot
  ON posts(user_subway_line, score DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- Composite index for new feed filtering by subway line
CREATE INDEX idx_posts_subway_line_new
  ON posts(user_subway_line, created_at DESC)
  WHERE deleted_at IS NULL;

-- Simple index for community stats (count posts per line)
CREATE INDEX idx_posts_subway_line
  ON posts(user_subway_line)
  WHERE deleted_at IS NULL;

-- Analyze table for query planner
ANALYZE posts;
```

### Phase 3: Update Write RPCs (Migration 3)
```sql
-- File: 20250930202000_update_write_rpcs_subway_line.sql

-- Update rpc_create_post to populate user_subway_line
CREATE OR REPLACE FUNCTION rpc_create_post(
  p_user uuid,
  p_content text
)
RETURNS uuid AS $$
DECLARE
  v_post_id uuid;
  v_subway_line text;
BEGIN
  -- Rate limit check (existing logic)
  PERFORM check_rate_limit_post(p_user);

  -- Get user's subway line
  SELECT subway_line INTO v_subway_line
  FROM users
  WHERE id = p_user;

  IF v_subway_line IS NULL THEN
    RAISE EXCEPTION 'User subway line not found';
  END IF;

  -- Insert post with denormalized subway_line
  INSERT INTO posts (user_id, user_subway_line, content, community)
  VALUES (p_user, v_subway_line, p_content, 'dimes_square')
  RETURNING id INTO v_post_id;

  -- Update user stats (existing logic)
  UPDATE users
  SET posts_created = posts_created + 1,
      last_post_at = NOW()
  WHERE id = p_user;

  RETURN v_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Phase 4: Update Materialized View (Migration 4)
```sql
-- File: 20250930203000_update_hot_posts_view.sql

-- Drop and recreate hot_posts with denormalized field
DROP MATERIALIZED VIEW IF EXISTS hot_posts;
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,
    p.user_subway_line,  -- Use denormalized field
    COALESCE(u.subway_color, 'mta-blue') as user_subway_color,
    -- Hot score calculation (Reddit-style)
    GREATEST(ABS(p.score), 1) *
    POWER(
        GREATEST(
            EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600,
            1
        ),
        -1.5
    ) as hot_score
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.deleted_at IS NULL
ORDER BY hot_score DESC, p.created_at DESC;

CREATE UNIQUE INDEX idx_hot_posts_id ON hot_posts(id);
CREATE INDEX idx_hot_posts_hot_score ON hot_posts(hot_score DESC);
CREATE INDEX idx_hot_posts_subway_line ON hot_posts(user_subway_line);
CREATE INDEX idx_hot_posts_subway_line_hot ON hot_posts(user_subway_line, hot_score DESC);

REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;
```

---

## Query Implementations

### 1. Hot Feed - All Lines (NYC)
```sql
-- Query: Get 20 hottest posts across all subway lines
SELECT
  id,
  content,
  user_id,
  user_subway_line,
  score,
  comment_count,
  created_at
FROM posts
WHERE deleted_at IS NULL
ORDER BY score DESC, created_at DESC
LIMIT 20
OFFSET $1;

-- Or use materialized view for better performance
SELECT
  id,
  content,
  user_id,
  user_subway_line,
  user_subway_color,
  score,
  comment_count,
  created_at,
  hot_score
FROM hot_posts
ORDER BY hot_score DESC
LIMIT 20
OFFSET $1;
```

### 2. Hot Feed - Filtered by Subway Line Group
```sql
-- Query: Get 20 hottest posts from Blue Line group (A, C, E)
SELECT
  id,
  content,
  user_id,
  user_subway_line,
  score,
  comment_count,
  created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['A', 'C', 'E'])
ORDER BY score DESC, created_at DESC
LIMIT 20
OFFSET $1;

-- Uses index: idx_posts_subway_line_hot
-- Execution plan: Index Scan on idx_posts_subway_line_hot
```

### 3. New Feed - Filtered by Subway Line Group
```sql
-- Query: Get 20 newest posts from Red Line group (1, 2, 3)
SELECT
  id,
  content,
  user_id,
  user_subway_line,
  score,
  comment_count,
  created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['1', '2', '3'])
ORDER BY created_at DESC
LIMIT 20
OFFSET $1;

-- Uses index: idx_posts_subway_line_new
-- Execution plan: Index Scan on idx_posts_subway_line_new
```

### 4. Cursor-Based Pagination (Recommended)
```sql
-- Query: Hot feed with cursor pagination (better than OFFSET)
SELECT
  id,
  content,
  user_id,
  user_subway_line,
  score,
  comment_count,
  created_at
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['A', 'C', 'E'])  -- Optional filter
  AND (score, created_at, id) < ($1, $2, $3)  -- Cursor: (prev_score, prev_created_at, prev_id)
ORDER BY score DESC, created_at DESC, id DESC
LIMIT 20;

-- More efficient than OFFSET for deep pagination
```

### 5. Community Stats Query
```sql
-- Query: Count posts per subway line (for UI display)
SELECT
  user_subway_line,
  COUNT(*) as post_count,
  SUM(comment_count) as total_comments,
  AVG(score)::int as avg_score
FROM posts
WHERE deleted_at IS NULL
  AND created_at > NOW() - INTERVAL '24 hours'  -- Last 24h
GROUP BY user_subway_line
ORDER BY post_count DESC;

-- Uses index: idx_posts_subway_line
```

---

## Realtime Subscription Strategy

### Client-Side Filtering (Recommended)

**Why:** Supabase Realtime doesn't support complex filtering on JOINed columns. Client-side filtering is simpler and more reliable.

```typescript
// Subscribe to all post updates
const subscription = supabase
  .channel('posts_realtime')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'posts',
      filter: 'deleted_at=is.null'  // Only active posts
    },
    (payload) => {
      const post = payload.new as Post

      // Client-side filter by community
      if (currentCommunity === 'NYC' ||
          SUBWAY_COMMUNITIES[currentCommunity].includes(post.user_subway_line)) {
        handleRealtimeUpdate(payload)
      }
    }
  )
  .subscribe()
```

### Server-Side Filtering (Alternative)

**Complex:** Requires trigger-based approach with notification system.

```sql
-- Create notification table for filtered updates
CREATE TABLE post_feed_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid REFERENCES posts(id),
  event_type text,  -- 'INSERT', 'UPDATE', 'DELETE'
  subway_line_group text,  -- 'blue', 'red', etc.
  created_at timestamptz DEFAULT now()
);

-- Trigger to populate feed events
CREATE OR REPLACE FUNCTION notify_feed_event()
RETURNS trigger AS $$
DECLARE
  line_group text;
BEGIN
  -- Map subway_line to group
  CASE NEW.user_subway_line
    WHEN 'A', 'C', 'E' THEN line_group := 'blue';
    WHEN '1', '2', '3' THEN line_group := 'red';
    -- ... etc
  END CASE;

  INSERT INTO post_feed_events (post_id, event_type, subway_line_group)
  VALUES (NEW.id, TG_OP, line_group);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Subscribe to specific group
supabase
  .channel('blue_line_feed')
  .on('postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'post_feed_events',
      filter: 'subway_line_group=eq.blue'
    },
    handleUpdate
  )
```

**Verdict:** Client-side filtering is simpler and sufficient for YipYap's scale.

---

## Index Strategy Summary

### New Indexes Required

```sql
-- 1. Hot feed filtering (most important)
CREATE INDEX idx_posts_subway_line_hot
  ON posts(user_subway_line, score DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- 2. New feed filtering
CREATE INDEX idx_posts_subway_line_new
  ON posts(user_subway_line, created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Community stats
CREATE INDEX idx_posts_subway_line
  ON posts(user_subway_line)
  WHERE deleted_at IS NULL;
```

### Existing Indexes to Keep

```sql
-- General hot/new feed (NYC - all lines)
idx_posts_hot        -- (score DESC, created_at DESC) WHERE deleted_at IS NULL
idx_posts_active     -- (created_at DESC) WHERE deleted_at IS NULL

-- User-specific queries
idx_posts_user_id    -- (user_id)

-- Primary key
posts_pkey           -- (id)
```

### Indexes to DROP (Redundant)

```sql
DROP INDEX IF EXISTS idx_posts_score;       -- Covered by idx_posts_hot
DROP INDEX IF EXISTS idx_posts_created_at;  -- Covered by idx_posts_active
```

### Total Index Storage Impact

Estimated index sizes for 1M posts:
- `idx_posts_subway_line_hot`: ~50 MB (composite, partial)
- `idx_posts_subway_line_new`: ~50 MB (composite, partial)
- `idx_posts_subway_line`: ~15 MB (simple, partial)

**Total: ~115 MB for 1M posts** (acceptable overhead)

---

## API Changes

### TypeScript Types Update

```typescript
// src/lib/types/index.ts

export interface Post {
  id: string
  content: string
  anonymous_user_id: string
  user_subway_line: SubwayLine  // NEW: denormalized field
  thread_id: string | null
  parent_post_id: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  vote_score: number
  comment_count: number
}

export type CommunityType =
  | 'NYC'        // All lines
  | 'Blue'       // A, C, E
  | 'Orange'     // B, D, F, M
  | 'Yellow'     // N, Q, R, W
  | 'Red'        // 1, 2, 3
  | 'Green'      // 4, 5, 6
  | 'Purple'     // 7
  | 'Turquoise'  // T
  | 'Lime'       // G
  | 'Gray'       // L
  | 'Brown'      // J, Z

export const SUBWAY_COMMUNITIES: Record<CommunityType, SubwayLine[] | 'all'> = {
  NYC: 'all',
  Blue: ['A', 'C', 'E'],
  Orange: ['B', 'D', 'F', 'M'],
  Yellow: ['N', 'Q', 'R', 'W'],
  Red: ['1', '2', '3'],
  Green: ['4', '5', '6'],
  Purple: ['7'],
  Turquoise: ['T'],
  Lime: ['G'],
  Gray: ['L'],
  Brown: ['J', 'Z']
}
```

### PostsAPI Update

```typescript
// src/lib/api/posts.ts

export class PostsAPI {
  async getFeedPosts(
    feedType: FeedType,
    community: CommunityType = 'NYC',  // NEW parameter
    cursor?: string,
    limit = 20,
    currentUser?: AnonymousUser | null
  ): Promise<PaginatedResponse<PostWithStats>> {
    try {
      let query = this.supabase
        .from('post_with_stats')
        .select('*')
        .is('parent_post_id', null)
        .eq('is_deleted', false)
        .limit(limit)

      // Apply community filter
      if (community !== 'NYC') {
        const lines = SUBWAY_COMMUNITIES[community]
        if (Array.isArray(lines)) {
          query = query.in('user_subway_line', lines)
        }
      }

      // Apply sorting
      if (feedType === 'hot') {
        query = query.order('vote_score', { ascending: false })
                     .order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Cursor pagination
      if (cursor) {
        query = query.lt('created_at', cursor)
      }

      const { data: posts, error } = await query
      if (error) throw error

      return await this.enrichPosts(posts || [], limit, currentUser)
    } catch (error) {
      // Fallback to direct posts table query
      // ... (existing fallback logic with community filter)
    }
  }
}
```

---

## Testing Strategy

### Performance Testing

```sql
-- 1. Create test dataset (1M posts)
INSERT INTO posts (user_id, user_subway_line, content, score, community)
SELECT
  (SELECT id FROM users ORDER BY random() LIMIT 1),
  (ARRAY['A','B','C','1','2','3','4','7','G','J','L','N'])[floor(random() * 12 + 1)],
  'Test post ' || generate_series,
  floor(random() * 100),
  'dimes_square'
FROM generate_series(1, 1000000);

-- 2. Analyze table
ANALYZE posts;

-- 3. Test query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['A', 'C', 'E'])
ORDER BY score DESC, created_at DESC
LIMIT 20;

-- Expected result:
-- Planning Time: <1ms
-- Execution Time: 5-15ms
-- Buffers: shared hit=~100
```

### Correctness Testing

```sql
-- Test 1: Verify denormalization consistency
SELECT COUNT(*)
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_subway_line != u.subway_line;
-- Expected: 0 (no inconsistencies)

-- Test 2: Verify filtering accuracy
SELECT user_subway_line, COUNT(*)
FROM posts
WHERE deleted_at IS NULL
  AND user_subway_line = ANY(ARRAY['A', 'C', 'E'])
GROUP BY user_subway_line;
-- Expected: Only A, C, E lines

-- Test 3: Verify RPC creates correct data
SELECT user_subway_line, COUNT(*)
FROM posts
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_subway_line;
-- Expected: Distribution matches user creation pattern
```

---

## Rollback Strategy

If denormalization causes issues:

```sql
-- Step 1: Remove column constraint
ALTER TABLE posts
  ALTER COLUMN user_subway_line DROP NOT NULL;

-- Step 2: Drop new indexes
DROP INDEX IF EXISTS idx_posts_subway_line_hot;
DROP INDEX IF EXISTS idx_posts_subway_line_new;
DROP INDEX IF EXISTS idx_posts_subway_line;

-- Step 3: Revert RPCs to not populate field
-- (Keep column for now, just stop populating)

-- Step 4: Monitor and plan full removal
ALTER TABLE posts DROP COLUMN user_subway_line;
```

---

## Maintenance Considerations

### Data Consistency

**Problem:** What if a user's subway_line changes? (Edge case)

**Solution 1 (Recommended):** Subway line is immutable identity
- Never allow changing subway_line after creation
- Add constraint to prevent updates

```sql
-- Prevent subway_line updates
CREATE OR REPLACE FUNCTION prevent_subway_line_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.subway_line IS DISTINCT FROM NEW.subway_line THEN
    RAISE EXCEPTION 'subway_line cannot be changed after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_subway_line_change
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_subway_line_change();
```

**Solution 2 (If changes allowed):** Cascade updates
```sql
-- Update posts when user subway_line changes (expensive!)
CREATE OR REPLACE FUNCTION sync_user_subway_line()
RETURNS trigger AS $$
BEGIN
  IF OLD.subway_line IS DISTINCT FROM NEW.subway_line THEN
    UPDATE posts
    SET user_subway_line = NEW.subway_line
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_subway_line
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_subway_line();
```

**Verdict:** Solution 1 (immutable) fits YipYap's design better.

### Monitoring

```sql
-- Monitor query performance
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%user_subway_line%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Monitor index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'posts'
ORDER BY idx_scan DESC;
```

---

## Alternatives Considered (Rejected)

### Alternative 1: Materialized View per Community

**Idea:** Create separate materialized views for each subway line group.

```sql
CREATE MATERIALIZED VIEW hot_posts_blue AS
SELECT p.*
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.subway_line = ANY(ARRAY['A', 'C', 'E'])
  AND p.deleted_at IS NULL;
```

**Rejected because:**
- 11 materialized views (one per community) = 11x storage
- Refresh complexity and lag
- No real-time updates without manual refresh
- Harder to maintain

### Alternative 2: Partition by Subway Line

**Idea:** Use PostgreSQL table partitioning by subway_line.

```sql
CREATE TABLE posts (...) PARTITION BY LIST (user_subway_line);
CREATE TABLE posts_a PARTITION OF posts FOR VALUES IN ('A');
CREATE TABLE posts_b PARTITION OF posts FOR VALUES IN ('B');
-- ... etc
```

**Rejected because:**
- Over-engineering for current scale
- Complex partitioning strategy (22 partitions)
- Queries spanning multiple lines still need partition pruning
- Migration complexity is very high

### Alternative 3: Application-Level Caching

**Idea:** Cache feed results in Redis/memory by community type.

**Rejected because:**
- Adds infrastructure complexity (Redis)
- Cache invalidation is hard with real-time updates
- Doesn't solve underlying query performance
- Better to optimize at database layer first

---

## Conclusion

**Denormalization is the clear winner** for YipYap's subway line filtering:

1. **3-5x faster queries** (5-15ms vs 50-100ms)
2. **Minimal storage overhead** (~2 MB for 1M posts)
3. **Simple implementation** (4 migrations, minimal code changes)
4. **Maintains data integrity** (RPCs handle all writes)
5. **Immutable identity** (subway_line never changes = perfect for denorm)
6. **Scales to 10M+ posts** (index-only scans)

The trade-off is acceptable:
- Slight increase in write complexity (populate one extra field)
- 2 bytes per post storage cost
- In exchange for 3-5x read performance improvement on hottest path

Given that YipYap's feed queries are the most frequent operation and subway line is immutable, denormalization is the optimal architectural choice.
