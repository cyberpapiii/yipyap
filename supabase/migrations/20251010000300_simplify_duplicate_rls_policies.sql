-- Migration: Simplify Duplicate RLS Policies
-- Priority: LOW
-- Impact: Cleaner security model, minimal performance gain
--
-- Issue: Several tables have duplicate read policies with similar names:
-- - "Anyone can view active posts" and "Public can read active posts"
-- - "Anyone can view active comments" and "Public can read active comments"
-- - "Anyone can view thread identities" and "Public can read thread identities"
-- - "Anyone can view votes" and "Public can read votes"
--
-- This migration removes the duplicate policies to simplify the security model.

-- ============================================================================
-- POSTS TABLE
-- ============================================================================

-- Drop duplicate read policy
DROP POLICY IF EXISTS "Anyone can view active posts" ON posts;

-- Keep: "Public can read active posts"
-- This policy allows anonymous read access to non-deleted posts

COMMENT ON POLICY "Public can read active posts" ON posts IS
  'Allows anonymous read access to all non-deleted posts';


-- ============================================================================
-- COMMENTS TABLE
-- ============================================================================

-- Drop duplicate read policy
DROP POLICY IF EXISTS "Anyone can view active comments" ON comments;

-- Keep: "Public can read active comments"
-- This policy allows anonymous read access to non-deleted comments

COMMENT ON POLICY "Public can read active comments" ON comments IS
  'Allows anonymous read access to all non-deleted comments';


-- ============================================================================
-- THREAD_IDENTITIES TABLE
-- ============================================================================

-- Drop duplicate read policy
DROP POLICY IF EXISTS "Anyone can view thread identities" ON thread_identities;

-- Keep: "Public can read thread identities"
-- This policy allows reading per-thread anonymous identities

COMMENT ON POLICY "Public can read thread identities" ON thread_identities IS
  'Allows reading per-thread anonymous identities for all users';


-- ============================================================================
-- VOTES TABLE
-- ============================================================================

-- Drop duplicate read policy
DROP POLICY IF EXISTS "Anyone can view votes" ON votes;

-- Keep: "Public can read votes"
-- This policy allows reading vote information for score calculations

COMMENT ON POLICY "Public can read votes" ON votes IS
  'Allows reading vote information for displaying scores and user vote status';


-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this query to verify no duplicate policies remain:
--
-- SELECT
--   tablename,
--   COUNT(*) as policy_count,
--   string_agg(policyname, ' | ') as policies
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;
--
-- Expected result: Each table should have distinct, non-overlapping policies


-- ============================================================================
-- REMAINING RLS POLICIES (Post-Migration)
-- ============================================================================

-- posts:
--   - "Public can read active posts" (SELECT on public role)
--   - "Users can update their own posts" (UPDATE for ownership)
--
-- comments:
--   - "Public can read active comments" (SELECT on public role)
--   - "Users can update their own comments" (UPDATE for ownership)
--
-- votes:
--   - "Public can read votes" (SELECT on public role)
--
-- thread_identities:
--   - "Public can read thread identities" (SELECT on public role)
--
-- users:
--   - "Anyone can create user accounts" (INSERT for anonymous bootstrap)
--   - "Users can view their own profile" (SELECT for own data)
--   - "Users can update their own profile" (UPDATE for own data)
--
-- notifications:
--   - "Users can read their own notifications" (SELECT for own notifications)
--
-- push_subscriptions:
--   - "No direct reads - use RPCs only" (Restrictive policy)
--   - "Service role can read subscriptions" (Service role access)
--
-- push_notification_delivery_log:
--   - "Users can read own delivery logs" (SELECT for own logs)
--   - "Service role can insert logs" (INSERT for webhook handler)
