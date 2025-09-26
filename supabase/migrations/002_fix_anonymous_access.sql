-- Fix RLS policies to allow anonymous access for testing
-- This allows the app to work without authentication

-- Drop existing policies that require authentication
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can manage their own votes" ON votes;
DROP POLICY IF EXISTS "Users can manage their thread identities" ON thread_identities;

-- Create new policies that allow anonymous access
CREATE POLICY "Anyone can create posts" ON posts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create comments" ON comments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can manage votes" ON votes
    FOR ALL WITH CHECK (true);

CREATE POLICY "Anyone can manage thread identities" ON thread_identities
    FOR ALL WITH CHECK (true);

-- Keep the existing read policies as they are already permissive
-- Keep user policies as they handle both authenticated and anonymous users