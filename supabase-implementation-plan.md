# YipYap Supabase Implementation Plan

## Overview
This document outlines the comprehensive Supabase implementation for YipYap, an anonymous local discussion app with unique features like emoji-based identities, two-level threading, and location-based posting.

## Core Features Architecture

### 1. Anonymous Posting System
- Device-based anonymous authentication
- Emoji + color identity per thread
- Location-based post visibility (1.5-mile radius)
- Automatic post deletion at -5 score

### 2. Threading System
- Two-level comment depth maximum
- Real-time updates for all interactions
- Vote-based content moderation

### 3. Real-time Features
- Live feed updates
- Real-time voting
- Push notifications for replies and score milestones

## Database Schema Design

### Core Tables

#### 1. Device Sessions (Anonymous Auth)
```sql
-- Device-based anonymous authentication
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL, -- Generated client-side, stored locally
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP WITH TIME ZONE,

    -- Rate limiting fields
    posts_today INTEGER DEFAULT 0,
    votes_today INTEGER DEFAULT 0,
    comments_today INTEGER DEFAULT 0,
    last_post_at TIMESTAMP WITH TIME ZONE,
    last_vote_at TIMESTAMP WITH TIME ZONE,
    last_comment_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_device_sessions_device_id ON device_sessions(device_id);
CREATE INDEX idx_device_sessions_last_active ON device_sessions(last_active);
CREATE INDEX idx_device_sessions_banned ON device_sessions(is_banned, ban_expires_at);
```

#### 2. Posts
```sql
-- Main posts table with spatial data
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL CHECK (char_length(content) <= 500),

    -- Location data (PostGIS)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_name TEXT, -- Human-readable location

    -- Thread identity (unique per post thread)
    thread_emoji TEXT NOT NULL,
    thread_color TEXT NOT NULL,

    -- Engagement metrics
    score INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    -- Auto-moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT, -- 'low_score', 'reported', 'spam'

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index for location-based queries (critical for performance)
CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_score ON posts(score DESC);
CREATE INDEX idx_posts_active_feed ON posts(created_at DESC, score DESC)
    WHERE is_deleted = FALSE;
```

#### 3. Comments
```sql
-- Two-level threading system
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,

    -- Threading (max 2 levels)
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    thread_depth INTEGER NOT NULL DEFAULT 1 CHECK (thread_depth <= 2),

    -- Content
    content TEXT NOT NULL CHECK (char_length(content) <= 500),

    -- Thread identity (inherited from post or unique for top-level comments)
    thread_emoji TEXT NOT NULL,
    thread_color TEXT NOT NULL,

    -- Engagement
    score INTEGER DEFAULT 0,

    -- Auto-moderation
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for threading and performance
CREATE INDEX idx_comments_post_id ON comments(post_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_thread_depth ON comments(thread_depth);
CREATE INDEX idx_comments_score ON comments(score DESC);
```

#### 4. Votes
```sql
-- Vote tracking with device-based deduplication
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,

    -- Polymorphic voting (posts or comments)
    votable_type TEXT NOT NULL CHECK (votable_type IN ('post', 'comment')),
    votable_id UUID NOT NULL,

    -- Vote value
    vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one vote per device per item
    UNIQUE(device_session_id, votable_type, votable_id)
);

-- Indexes for vote aggregation
CREATE INDEX idx_votes_votable ON votes(votable_type, votable_id);
CREATE INDEX idx_votes_device ON votes(device_session_id);
```

#### 5. Thread Identities
```sql
-- Manage emoji/color combinations per device per post
CREATE TABLE thread_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    -- Identity for this thread
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One identity per device per post thread
    UNIQUE(device_session_id, post_id)
);

CREATE INDEX idx_thread_identities_lookup ON thread_identities(device_session_id, post_id);
```

#### 6. Notifications
```sql
-- Push notification queue and history
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,

    -- Notification type and data
    notification_type TEXT NOT NULL CHECK (
        notification_type IN ('reply', 'score_milestone', 'post_deleted')
    ),

    -- Reference data
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Notification content
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB, -- Additional data for deep linking

    -- Delivery tracking
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_device_unread ON notifications(device_session_id)
    WHERE is_read = FALSE;
CREATE INDEX idx_notifications_unsent ON notifications(is_sent, created_at)
    WHERE is_sent = FALSE;
```

## Row Level Security (RLS) Policies

### Device Sessions
```sql
-- Enable RLS
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own session
CREATE POLICY "Users can view own session" ON device_sessions
    FOR SELECT USING (
        device_id = current_setting('app.device_id')::TEXT
    );

-- Users can update their own session
CREATE POLICY "Users can update own session" ON device_sessions
    FOR UPDATE USING (
        device_id = current_setting('app.device_id')::TEXT
    );

-- Users can insert their own session
CREATE POLICY "Users can create own session" ON device_sessions
    FOR INSERT WITH CHECK (
        device_id = current_setting('app.device_id')::TEXT
    );
```

### Posts
```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-deleted posts within 1.5 miles
CREATE POLICY "View nearby posts" ON posts
    FOR SELECT USING (
        is_deleted = FALSE AND
        ST_DWithin(
            location,
            ST_GeogFromText('POINT(' ||
                current_setting('app.user_longitude')::FLOAT || ' ' ||
                current_setting('app.user_latitude')::FLOAT || ')'
            ),
            2414 -- 1.5 miles in meters
        )
    );

-- Users can create posts
CREATE POLICY "Create posts" ON posts
    FOR INSERT WITH CHECK (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
            AND is_banned = FALSE
        )
    );

-- Users can update their own posts (for score updates via triggers)
CREATE POLICY "Update own posts" ON posts
    FOR UPDATE USING (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
        )
    );
```

### Comments
```sql
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- View comments for visible posts
CREATE POLICY "View comments for visible posts" ON comments
    FOR SELECT USING (
        is_deleted = FALSE AND
        post_id IN (
            SELECT id FROM posts WHERE is_deleted = FALSE
        )
    );

-- Create comments on visible posts
CREATE POLICY "Create comments" ON comments
    FOR INSERT WITH CHECK (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
            AND is_banned = FALSE
        ) AND
        post_id IN (
            SELECT id FROM posts WHERE is_deleted = FALSE
        )
    );
```

### Votes
```sql
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Users can view all votes (for aggregation)
CREATE POLICY "View votes" ON votes
    FOR SELECT USING (true);

-- Users can create votes
CREATE POLICY "Create votes" ON votes
    FOR INSERT WITH CHECK (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
            AND is_banned = FALSE
        )
    );

-- Users can update their own votes
CREATE POLICY "Update own votes" ON votes
    FOR UPDATE USING (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
        )
    );

-- Users can delete their own votes
CREATE POLICY "Delete own votes" ON votes
    FOR DELETE USING (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id')::TEXT
        )
    );
```

## Database Functions and Triggers

### 1. Vote Management Function
```sql
-- Function to handle voting with score updates
CREATE OR REPLACE FUNCTION handle_vote(
    p_votable_type TEXT,
    p_votable_id UUID,
    p_vote_value INTEGER
) RETURNS JSON AS $$
DECLARE
    v_device_session_id UUID;
    v_existing_vote INTEGER;
    v_new_score INTEGER;
    v_result JSON;
BEGIN
    -- Get current device session
    SELECT id INTO v_device_session_id
    FROM device_sessions
    WHERE device_id = current_setting('app.device_id')::TEXT;

    IF v_device_session_id IS NULL THEN
        RAISE EXCEPTION 'Device session not found';
    END IF;

    -- Check existing vote
    SELECT vote_value INTO v_existing_vote
    FROM votes
    WHERE device_session_id = v_device_session_id
    AND votable_type = p_votable_type
    AND votable_id = p_votable_id;

    -- Handle vote logic
    IF v_existing_vote IS NULL THEN
        -- New vote
        INSERT INTO votes (device_session_id, votable_type, votable_id, vote_value)
        VALUES (v_device_session_id, p_votable_type, p_votable_id, p_vote_value);

    ELSIF v_existing_vote = p_vote_value THEN
        -- Remove vote (clicking same vote)
        DELETE FROM votes
        WHERE device_session_id = v_device_session_id
        AND votable_type = p_votable_type
        AND votable_id = p_votable_id;

    ELSE
        -- Change vote
        UPDATE votes
        SET vote_value = p_vote_value, updated_at = NOW()
        WHERE device_session_id = v_device_session_id
        AND votable_type = p_votable_type
        AND votable_id = p_votable_id;
    END IF;

    -- Calculate new score
    SELECT COALESCE(SUM(vote_value), 0) INTO v_new_score
    FROM votes
    WHERE votable_type = p_votable_type
    AND votable_id = p_votable_id;

    -- Update score on target table
    IF p_votable_type = 'post' THEN
        UPDATE posts
        SET score = v_new_score, updated_at = NOW()
        WHERE id = p_votable_id;
    ELSE
        UPDATE comments
        SET score = v_new_score, updated_at = NOW()
        WHERE id = p_votable_id;
    END IF;

    -- Return result
    SELECT json_build_object(
        'new_score', v_new_score,
        'user_vote', (
            SELECT vote_value FROM votes
            WHERE device_session_id = v_device_session_id
            AND votable_type = p_votable_type
            AND votable_id = p_votable_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Auto-deletion Trigger
```sql
-- Function to handle auto-deletion at -5 score
CREATE OR REPLACE FUNCTION check_auto_delete() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.score <= -5 AND OLD.score > -5 THEN
        NEW.is_deleted = TRUE;
        NEW.deleted_reason = 'low_score';

        -- Create notification for original poster
        INSERT INTO notifications (
            device_session_id,
            notification_type,
            post_id,
            comment_id,
            title,
            body,
            data
        ) VALUES (
            NEW.device_session_id,
            'post_deleted',
            CASE WHEN TG_TABLE_NAME = 'posts' THEN NEW.id ELSE NULL END,
            CASE WHEN TG_TABLE_NAME = 'comments' THEN NEW.id ELSE NULL END,
            'Content Removed',
            'Your ' || TG_TABLE_NAME::TEXT || ' was removed due to low score.',
            json_build_object('reason', 'low_score', 'score', NEW.score)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER trigger_posts_auto_delete
    BEFORE UPDATE OF score ON posts
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_delete();

CREATE TRIGGER trigger_comments_auto_delete
    BEFORE UPDATE OF score ON comments
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_delete();
```

### 3. Thread Identity Management
```sql
-- Function to get or create thread identity
CREATE OR REPLACE FUNCTION get_thread_identity(
    p_post_id UUID
) RETURNS JSON AS $$
DECLARE
    v_device_session_id UUID;
    v_identity JSON;
    v_emoji TEXT;
    v_color TEXT;
    v_emojis TEXT[] := ARRAY['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
    v_colors TEXT[] := ARRAY['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
BEGIN
    -- Get device session
    SELECT id INTO v_device_session_id
    FROM device_sessions
    WHERE device_id = current_setting('app.device_id')::TEXT;

    -- Check existing identity
    SELECT json_build_object('emoji', emoji, 'color', color)
    INTO v_identity
    FROM thread_identities
    WHERE device_session_id = v_device_session_id
    AND post_id = p_post_id;

    IF v_identity IS NULL THEN
        -- Generate new identity
        v_emoji := v_emojis[floor(random() * array_length(v_emojis, 1) + 1)];
        v_color := v_colors[floor(random() * array_length(v_colors, 1) + 1)];

        -- Store identity
        INSERT INTO thread_identities (device_session_id, post_id, emoji, color)
        VALUES (v_device_session_id, p_post_id, v_emoji, v_color);

        v_identity := json_build_object('emoji', v_emoji, 'color', v_color);
    END IF;

    RETURN v_identity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Rate Limiting Functions
```sql
-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_action TEXT -- 'post', 'comment', 'vote'
) RETURNS BOOLEAN AS $$
DECLARE
    v_device_session_id UUID;
    v_session RECORD;
    v_limit_exceeded BOOLEAN := FALSE;
    v_now TIMESTAMP := NOW();
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get device session
    SELECT * INTO v_session
    FROM device_sessions
    WHERE device_id = current_setting('app.device_id')::TEXT;

    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Device session not found';
    END IF;

    -- Check if banned
    IF v_session.is_banned AND (
        v_session.ban_expires_at IS NULL OR
        v_session.ban_expires_at > v_now
    ) THEN
        RAISE EXCEPTION 'Device is banned: %', v_session.ban_reason;
    END IF;

    -- Check rate limits based on action
    CASE p_action
        WHEN 'post' THEN
            -- Max 10 posts per day, 1 per minute
            IF v_session.posts_today >= 10 THEN
                v_limit_exceeded := TRUE;
            ELSIF v_session.last_post_at IS NOT NULL AND
                  v_session.last_post_at > (v_now - INTERVAL '1 minute') THEN
                v_limit_exceeded := TRUE;
            END IF;

        WHEN 'comment' THEN
            -- Max 50 comments per day, 1 per 10 seconds
            IF v_session.comments_today >= 50 THEN
                v_limit_exceeded := TRUE;
            ELSIF v_session.last_comment_at IS NOT NULL AND
                  v_session.last_comment_at > (v_now - INTERVAL '10 seconds') THEN
                v_limit_exceeded := TRUE;
            END IF;

        WHEN 'vote' THEN
            -- Max 200 votes per day, 10 per minute
            IF v_session.votes_today >= 200 THEN
                v_limit_exceeded := TRUE;
            ELSIF v_session.last_vote_at IS NOT NULL AND
                  v_session.last_vote_at > (v_now - INTERVAL '6 seconds') THEN
                v_limit_exceeded := TRUE;
            END IF;
    END CASE;

    IF v_limit_exceeded THEN
        RETURN FALSE;
    END IF;

    -- Update counters and timestamps
    CASE p_action
        WHEN 'post' THEN
            UPDATE device_sessions
            SET posts_today = posts_today + 1,
                last_post_at = v_now,
                last_active = v_now
            WHERE id = v_session.id;

        WHEN 'comment' THEN
            UPDATE device_sessions
            SET comments_today = comments_today + 1,
                last_comment_at = v_now,
                last_active = v_now
            WHERE id = v_session.id;

        WHEN 'vote' THEN
            UPDATE device_sessions
            SET votes_today = votes_today + 1,
                last_vote_at = v_now,
                last_active = v_now
            WHERE id = v_session.id;
    END CASE;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Real-time Subscriptions Architecture

### 1. Feed Subscription
```sql
-- Materialized view for optimized feed queries
CREATE MATERIALIZED VIEW feed_posts AS
SELECT
    p.id,
    p.content,
    p.location,
    p.location_name,
    p.thread_emoji,
    p.thread_color,
    p.score,
    p.comment_count,
    p.created_at,
    p.updated_at,
    ST_X(p.location::geometry) as longitude,
    ST_Y(p.location::geometry) as latitude,
    -- Calculate distance from reference point (updated via function)
    NULL::FLOAT as distance_km
FROM posts p
WHERE p.is_deleted = FALSE
ORDER BY p.created_at DESC;

-- Create indexes
CREATE INDEX idx_feed_posts_location ON feed_posts USING GIST(location);
CREATE INDEX idx_feed_posts_score_time ON feed_posts(score DESC, created_at DESC);

-- Function to refresh feed for location
CREATE OR REPLACE FUNCTION refresh_feed_for_location(
    p_latitude FLOAT,
    p_longitude FLOAT
) RETURNS TABLE (
    id UUID,
    content TEXT,
    location_name TEXT,
    thread_emoji TEXT,
    thread_color TEXT,
    score INTEGER,
    comment_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    distance_km FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.content,
        p.location_name,
        p.thread_emoji,
        p.thread_color,
        p.score,
        p.comment_count,
        p.created_at,
        ST_Distance(
            p.location,
            ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')')
        ) / 1000.0 as distance_km
    FROM posts p
    WHERE p.is_deleted = FALSE
    AND ST_DWithin(
        p.location,
        ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')'),
        2414 -- 1.5 miles
    )
    ORDER BY p.created_at DESC, p.score DESC;
END;
$$ LANGUAGE plpgsql;
```

### 2. Real-time Trigger Functions
```sql
-- Function to broadcast real-time updates
CREATE OR REPLACE FUNCTION notify_realtime_update() RETURNS TRIGGER AS $$
DECLARE
    v_channel TEXT;
    v_payload JSON;
BEGIN
    -- Determine channel based on table
    CASE TG_TABLE_NAME
        WHEN 'posts' THEN
            v_channel := 'posts_changes';
            v_payload := json_build_object(
                'type', TG_OP,
                'post', row_to_json(COALESCE(NEW, OLD))
            );

        WHEN 'comments' THEN
            v_channel := 'post_comments:' || COALESCE(NEW.post_id, OLD.post_id)::TEXT;
            v_payload := json_build_object(
                'type', TG_OP,
                'comment', row_to_json(COALESCE(NEW, OLD))
            );

        WHEN 'votes' THEN
            v_channel := 'votes:' || COALESCE(NEW.votable_type, OLD.votable_type) || ':' || COALESCE(NEW.votable_id, OLD.votable_id)::TEXT;
            v_payload := json_build_object(
                'type', TG_OP,
                'vote', row_to_json(COALESCE(NEW, OLD))
            );
    END CASE;

    -- Send notification
    PERFORM pg_notify(v_channel, v_payload::TEXT);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for real-time updates
CREATE TRIGGER trigger_posts_realtime
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION notify_realtime_update();

CREATE TRIGGER trigger_comments_realtime
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_realtime_update();

CREATE TRIGGER trigger_votes_realtime
    AFTER INSERT OR UPDATE OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION notify_realtime_update();
```

## Edge Functions Implementation

### 1. Push Notifications Edge Function
```typescript
// supabase/functions/push-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  device_session_id: string
  notification_type: 'reply' | 'score_milestone' | 'post_deleted'
  title: string
  body: string
  data?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Process notification queue
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_sent', false)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    const pushPromises = notifications.map(async (notification) => {
      try {
        // Get device token from device_sessions if stored
        const { data: session } = await supabase
          .from('device_sessions')
          .select('device_id')
          .eq('id', notification.device_session_id)
          .single()

        if (!session) return

        // In a real implementation, you would:
        // 1. Look up push tokens for the device_id
        // 2. Send push notification via FCM/APNs
        // 3. Handle delivery confirmations

        console.log(`Would send notification to device ${session.device_id}:`, {
          title: notification.title,
          body: notification.body,
          data: notification.data
        })

        // Mark as sent
        await supabase
          .from('notifications')
          .update({
            is_sent: true,
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id)

      } catch (error) {
        console.error('Failed to send notification:', error)
      }
    })

    await Promise.all(pushPromises)

    return new Response(
      JSON.stringify({ processed: notifications.length }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
```

### 2. Daily Cleanup Edge Function
```typescript
// supabase/functions/daily-cleanup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Reset daily rate limits
    await supabase
      .from('device_sessions')
      .update({
        posts_today: 0,
        votes_today: 0,
        comments_today: 0
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Update all

    // Clean up old notifications (30+ days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    await supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())

    // Clean up inactive device sessions (90+ days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    await supabase
      .from('device_sessions')
      .delete()
      .lt('last_active', ninetyDaysAgo.toISOString())

    // Unban expired bans
    await supabase
      .from('device_sessions')
      .update({
        is_banned: false,
        ban_reason: null,
        ban_expires_at: null
      })
      .eq('is_banned', true)
      .not('ban_expires_at', 'is', null)
      .lt('ban_expires_at', new Date().toISOString())

    return new Response(
      JSON.stringify({ success: true, message: 'Daily cleanup completed' }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

## Performance Optimization Strategy

### 1. Indexing Strategy
```sql
-- Critical indexes for YipYap performance

-- Spatial index for location queries (most important)
CREATE INDEX idx_posts_location_gist ON posts USING GIST(location)
WHERE is_deleted = FALSE;

-- Composite index for feed queries
CREATE INDEX idx_posts_feed_optimized ON posts(created_at DESC, score DESC)
WHERE is_deleted = FALSE;

-- Index for comment threading
CREATE INDEX idx_comments_thread_lookup ON comments(post_id, parent_comment_id, created_at)
WHERE is_deleted = FALSE;

-- Index for vote aggregation
CREATE INDEX idx_votes_aggregation ON votes(votable_type, votable_id, vote_value);

-- Index for real-time subscriptions
CREATE INDEX idx_posts_realtime ON posts(updated_at DESC)
WHERE is_deleted = FALSE;

-- Partial index for active devices
CREATE INDEX idx_device_sessions_active ON device_sessions(last_active DESC)
WHERE is_banned = FALSE;
```

### 2. Materialized Views for Complex Queries
```sql
-- Materialized view for hot posts (high engagement)
CREATE MATERIALIZED VIEW hot_posts AS
SELECT
    p.*,
    (p.score * 1.0 / EXTRACT(EPOCH FROM (NOW() - p.created_at)) * 3600) as heat_score
FROM posts p
WHERE p.is_deleted = FALSE
    AND p.created_at > (NOW() - INTERVAL '24 hours')
    AND (p.score > 0 OR p.comment_count > 0);

-- Refresh hot posts every 15 minutes
CREATE INDEX idx_hot_posts_heat ON hot_posts(heat_score DESC);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY feed_posts;
END;
$$ LANGUAGE plpgsql;
```

### 3. Query Optimization Functions
```sql
-- Optimized function for nearby posts with pagination
CREATE OR REPLACE FUNCTION get_nearby_posts(
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    content TEXT,
    location_name TEXT,
    thread_emoji TEXT,
    thread_color TEXT,
    score INTEGER,
    comment_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    distance_m FLOAT,
    user_vote INTEGER
) AS $$
DECLARE
    v_device_session_id UUID;
    v_user_location GEOGRAPHY;
BEGIN
    -- Get device session for vote information
    SELECT ds.id INTO v_device_session_id
    FROM device_sessions ds
    WHERE ds.device_id = current_setting('app.device_id', true);

    -- Create user location point
    v_user_location := ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')');

    RETURN QUERY
    SELECT
        p.id,
        p.content,
        p.location_name,
        p.thread_emoji,
        p.thread_color,
        p.score,
        p.comment_count,
        p.created_at,
        ST_Distance(p.location, v_user_location)::FLOAT as distance_m,
        COALESCE(v.vote_value, 0) as user_vote
    FROM posts p
    LEFT JOIN votes v ON (
        v.votable_type = 'post'
        AND v.votable_id = p.id
        AND v.device_session_id = v_device_session_id
    )
    WHERE p.is_deleted = FALSE
        AND ST_DWithin(p.location, v_user_location, 2414) -- 1.5 miles
    ORDER BY p.created_at DESC, p.score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Anonymous Authentication Strategy

### 1. Device Registration Flow
```sql
-- Function to register or retrieve device session
CREATE OR REPLACE FUNCTION register_device_session(
    p_device_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_session RECORD;
    v_is_new BOOLEAN := FALSE;
BEGIN
    -- Try to get existing session
    SELECT * INTO v_session
    FROM device_sessions
    WHERE device_id = p_device_id;

    -- Create new session if doesn't exist
    IF v_session IS NULL THEN
        INSERT INTO device_sessions (device_id)
        VALUES (p_device_id)
        RETURNING * INTO v_session;
        v_is_new := TRUE;
    ELSE
        -- Update last active
        UPDATE device_sessions
        SET last_active = NOW()
        WHERE id = v_session.id
        RETURNING * INTO v_session;
    END IF;

    -- Return session info
    RETURN json_build_object(
        'session_id', v_session.id,
        'device_id', v_session.device_id,
        'is_new', v_is_new,
        'is_banned', v_session.is_banned,
        'ban_expires_at', v_session.ban_expires_at,
        'created_at', v_session.created_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Session Context Management
```sql
-- Function to set session context for RLS
CREATE OR REPLACE FUNCTION set_session_context(
    p_device_id TEXT,
    p_latitude FLOAT DEFAULT NULL,
    p_longitude FLOAT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Set device context
    PERFORM set_config('app.device_id', p_device_id, true);

    -- Set location context if provided
    IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
        PERFORM set_config('app.user_latitude', p_latitude::TEXT, true);
        PERFORM set_config('app.user_longitude', p_longitude::TEXT, true);
    END IF;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Migration Plan

### Migration 001: Core Schema
```sql
-- 001_create_core_schema.sql
BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Device sessions table
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP WITH TIME ZONE,
    posts_today INTEGER DEFAULT 0,
    votes_today INTEGER DEFAULT 0,
    comments_today INTEGER DEFAULT 0,
    last_post_at TIMESTAMP WITH TIME ZONE,
    last_vote_at TIMESTAMP WITH TIME ZONE,
    last_comment_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_device_sessions_device_id ON device_sessions(device_id);
CREATE INDEX idx_device_sessions_last_active ON device_sessions(last_active);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_name TEXT,
    thread_emoji TEXT NOT NULL,
    thread_color TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_score ON posts(score DESC);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    thread_depth INTEGER NOT NULL DEFAULT 1 CHECK (thread_depth <= 2),
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    thread_emoji TEXT NOT NULL,
    thread_color TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_post_id ON comments(post_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- Votes table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    votable_type TEXT NOT NULL CHECK (votable_type IN ('post', 'comment')),
    votable_id UUID NOT NULL,
    vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_session_id, votable_type, votable_id)
);

CREATE INDEX idx_votes_votable ON votes(votable_type, votable_id);

-- Thread identities table
CREATE TABLE thread_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_session_id, post_id)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN ('reply', 'score_milestone', 'post_deleted')
    ),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_device_unread ON notifications(device_session_id)
WHERE is_read = FALSE;

COMMIT;
```

### Migration 002: RLS Policies
```sql
-- 002_enable_rls.sql
BEGIN;

-- Enable RLS on all tables
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Device sessions policies
CREATE POLICY "device_sessions_own" ON device_sessions
    FOR ALL USING (device_id = current_setting('app.device_id', true));

-- Posts policies
CREATE POLICY "posts_view_nearby" ON posts
    FOR SELECT USING (
        is_deleted = FALSE AND
        ST_DWithin(
            location,
            ST_GeogFromText('POINT(' ||
                current_setting('app.user_longitude', true)::FLOAT || ' ' ||
                current_setting('app.user_latitude', true)::FLOAT || ')'
            ),
            2414
        )
    );

CREATE POLICY "posts_insert" ON posts
    FOR INSERT WITH CHECK (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id', true)
        )
    );

-- Comments policies
CREATE POLICY "comments_view" ON comments
    FOR SELECT USING (
        is_deleted = FALSE AND
        post_id IN (SELECT id FROM posts WHERE is_deleted = FALSE)
    );

CREATE POLICY "comments_insert" ON comments
    FOR INSERT WITH CHECK (
        device_session_id IN (
            SELECT id FROM device_sessions
            WHERE device_id = current_setting('app.device_id', true)
        )
    );

-- Votes policies
CREATE POLICY "votes_view" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_manage" ON votes FOR ALL USING (
    device_session_id IN (
        SELECT id FROM device_sessions
        WHERE device_id = current_setting('app.device_id', true)
    )
);

-- Thread identities policies
CREATE POLICY "thread_identities_own" ON thread_identities FOR ALL USING (
    device_session_id IN (
        SELECT id FROM device_sessions
        WHERE device_id = current_setting('app.device_id', true)
    )
);

-- Notifications policies
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (
    device_session_id IN (
        SELECT id FROM device_sessions
        WHERE device_id = current_setting('app.device_id', true)
    )
);

COMMIT;
```

### Migration 003: Functions and Triggers
```sql
-- 003_functions_triggers.sql
-- [Include all the functions and triggers from above sections]
```

## TypeScript Type Definitions

### Database Types
```typescript
// supabase/types/database.ts
export interface Database {
  public: {
    Tables: {
      device_sessions: {
        Row: {
          id: string
          device_id: string
          created_at: string
          last_active: string
          is_banned: boolean
          ban_reason: string | null
          ban_expires_at: string | null
          posts_today: number
          votes_today: number
          comments_today: number
          last_post_at: string | null
          last_vote_at: string | null
          last_comment_at: string | null
        }
        Insert: {
          id?: string
          device_id: string
          created_at?: string
          last_active?: string
          is_banned?: boolean
          ban_reason?: string | null
          ban_expires_at?: string | null
          posts_today?: number
          votes_today?: number
          comments_today?: number
          last_post_at?: string | null
          last_vote_at?: string | null
          last_comment_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          created_at?: string
          last_active?: string
          is_banned?: boolean
          ban_reason?: string | null
          ban_expires_at?: string | null
          posts_today?: number
          votes_today?: number
          comments_today?: number
          last_post_at?: string | null
          last_vote_at?: string | null
          last_comment_at?: string | null
        }
      }
      posts: {
        Row: {
          id: string
          device_session_id: string
          content: string
          location: string // PostGIS geography type as string
          location_name: string | null
          thread_emoji: string
          thread_color: string
          score: number
          comment_count: number
          is_deleted: boolean
          deleted_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_session_id: string
          content: string
          location: string
          location_name?: string | null
          thread_emoji: string
          thread_color: string
          score?: number
          comment_count?: number
          is_deleted?: boolean
          deleted_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_session_id?: string
          content?: string
          location?: string
          location_name?: string | null
          thread_emoji?: string
          thread_color?: string
          score?: number
          comment_count?: number
          is_deleted?: boolean
          deleted_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          post_id: string
          device_session_id: string
          parent_comment_id: string | null
          thread_depth: number
          content: string
          thread_emoji: string
          thread_color: string
          score: number
          is_deleted: boolean
          deleted_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          device_session_id: string
          parent_comment_id?: string | null
          thread_depth?: number
          content: string
          thread_emoji: string
          thread_color: string
          score?: number
          is_deleted?: boolean
          deleted_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          device_session_id?: string
          parent_comment_id?: string | null
          thread_depth?: number
          content?: string
          thread_emoji?: string
          thread_color?: string
          score?: number
          is_deleted?: boolean
          deleted_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          device_session_id: string
          votable_type: 'post' | 'comment'
          votable_id: string
          vote_value: -1 | 1
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_session_id: string
          votable_type: 'post' | 'comment'
          votable_id: string
          vote_value: -1 | 1
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_session_id?: string
          votable_type?: 'post' | 'comment'
          votable_id?: string
          vote_value?: -1 | 1
          created_at?: string
          updated_at?: string
        }
      }
      thread_identities: {
        Row: {
          id: string
          device_session_id: string
          post_id: string
          emoji: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          device_session_id: string
          post_id: string
          emoji: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          device_session_id?: string
          post_id?: string
          emoji?: string
          color?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          device_session_id: string
          notification_type: 'reply' | 'score_milestone' | 'post_deleted'
          post_id: string | null
          comment_id: string | null
          title: string
          body: string
          data: Record<string, any> | null
          is_sent: boolean
          sent_at: string | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          device_session_id: string
          notification_type: 'reply' | 'score_milestone' | 'post_deleted'
          post_id?: string | null
          comment_id?: string | null
          title: string
          body: string
          data?: Record<string, any> | null
          is_sent?: boolean
          sent_at?: string | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          device_session_id?: string
          notification_type?: 'reply' | 'score_milestone' | 'post_deleted'
          post_id?: string | null
          comment_id?: string | null
          title?: string
          body?: string
          data?: Record<string, any> | null
          is_sent?: boolean
          sent_at?: string | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      register_device_session: {
        Args: { p_device_id: string }
        Returns: {
          session_id: string
          device_id: string
          is_new: boolean
          is_banned: boolean
          ban_expires_at: string | null
          created_at: string
        }
      }
      handle_vote: {
        Args: {
          p_votable_type: 'post' | 'comment'
          p_votable_id: string
          p_vote_value: -1 | 1
        }
        Returns: {
          new_score: number
          user_vote: number | null
        }
      }
      get_thread_identity: {
        Args: { p_post_id: string }
        Returns: {
          emoji: string
          color: string
        }
      }
      get_nearby_posts: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_limit?: number
          p_offset?: number
        }
        Returns: Array<{
          id: string
          content: string
          location_name: string | null
          thread_emoji: string
          thread_color: string
          score: number
          comment_count: number
          created_at: string
          distance_m: number
          user_vote: number
        }>
      }
      check_rate_limit: {
        Args: { p_action: 'post' | 'comment' | 'vote' }
        Returns: boolean
      }
      set_session_context: {
        Args: {
          p_device_id: string
          p_latitude?: number
          p_longitude?: number
        }
        Returns: void
      }
    }
  }
}
```

## Testing Strategy

### 1. Database Function Tests
```sql
-- Test suite for core functions
-- test_voting_system.sql

BEGIN;
SELECT plan(10);

-- Test device registration
SELECT ok(
    (SELECT register_device_session('test-device-123')::jsonb->'is_new')::boolean,
    'Device registration creates new session'
);

-- Test vote handling
SELECT set_session_context('test-device-123');
INSERT INTO posts (device_session_id, content, location, thread_emoji, thread_color)
VALUES (
    (SELECT id FROM device_sessions WHERE device_id = 'test-device-123'),
    'Test post content',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    '🐶',
    '#FF6B6B'
);

SELECT ok(
    (SELECT handle_vote('post', (SELECT id FROM posts LIMIT 1), 1)::jsonb->'new_score')::int = 1,
    'Upvoting increases score to 1'
);

SELECT ok(
    (SELECT handle_vote('post', (SELECT id FROM posts LIMIT 1), 1)::jsonb->'new_score')::int = 0,
    'Clicking same vote removes it'
);

-- Test rate limiting
SELECT ok(
    check_rate_limit('post'),
    'Rate limiting allows first post'
);

SELECT * FROM finish();
ROLLBACK;
```

### 2. Performance Tests
```sql
-- Performance test suite
-- test_performance.sql

-- Test spatial query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM get_nearby_posts(37.7749, -122.4194, 20, 0);

-- Test vote aggregation performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT votable_id, SUM(vote_value) as score
FROM votes
WHERE votable_type = 'post'
GROUP BY votable_id;
```

## Deployment Checklist

### 1. Database Setup
- [ ] Run migration 001 (core schema)
- [ ] Run migration 002 (RLS policies)
- [ ] Run migration 003 (functions and triggers)
- [ ] Verify PostGIS extension is installed
- [ ] Test spatial queries with sample data

### 2. Edge Functions
- [ ] Deploy push-notifications function
- [ ] Deploy daily-cleanup function
- [ ] Set up cron job for daily cleanup
- [ ] Configure environment variables

### 3. Real-time Configuration
- [ ] Enable realtime on required tables
- [ ] Test real-time subscriptions
- [ ] Configure connection limits

### 4. Security
- [ ] Verify all RLS policies are working
- [ ] Test with different device IDs
- [ ] Validate rate limiting
- [ ] Test banned device handling

### 5. Performance
- [ ] Run ANALYZE on all tables
- [ ] Monitor query performance
- [ ] Set up materialized view refresh schedule
- [ ] Configure connection pooling

This comprehensive implementation plan provides a solid foundation for YipYap's anonymous, location-based discussion features with real-time updates, voting systems, and robust security through RLS policies.