-- Fix Push Notification System
-- This migration fixes critical bugs in the push notification trigger and improves security

-- 1. Fix the push notification trigger function
CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_actor_subway_line TEXT;
  v_edge_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get configuration (will be set after migration)
  v_edge_url := current_setting('app.settings.edge_function_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Check if configuration exists
  IF v_edge_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Push notification configuration missing. Push notifications will not be sent. Set app.settings.edge_function_url and app.settings.service_role_key';
    RETURN NEW;
  END IF;

  -- Only send push notifications for reply types (milestones are opt-in later)
  IF NEW.type NOT IN ('reply_to_post', 'reply_to_comment') THEN
    RETURN NEW;
  END IF;

  -- Get notification type
  v_notification_type := NEW.type;

  -- Use denormalized actor data already in notification (FIXED: was actor_id, now actor_user_id)
  v_actor_subway_line := NEW.actor_subway_line;

  -- Build notification title and body based on type
  IF v_notification_type = 'reply_to_post' THEN
    v_title := COALESCE(v_actor_subway_line, 'Someone') || ' Line replied to your post';
    v_body := COALESCE(NEW.preview_content, 'You have a new reply');
  ELSIF v_notification_type = 'reply_to_comment' THEN
    v_title := COALESCE(v_actor_subway_line, 'Someone') || ' Line replied to your comment';
    v_body := COALESCE(NEW.preview_content, 'You have a new reply');
  ELSE
    v_title := 'New notification';
    v_body := 'You have a new notification';
  END IF;

  -- Sanitize content (remove control characters and null bytes)
  v_title := regexp_replace(v_title, '[^\x20-\x7E]', '', 'g');
  v_body := regexp_replace(v_body, '[^\x20-\x7E]', '', 'g');

  -- Log for debugging
  RAISE NOTICE 'Sending push notification: user=%, type=%, title=%', NEW.user_id, v_notification_type, v_title;

  -- Call Edge Function using pg_net.http_post
  PERFORM net.http_post(
    url := v_edge_url || '/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id::text,
      'title', v_title,
      'body', v_body,
      'postId', NEW.post_id::text,
      'commentId', NEW.comment_id::text,
      'notificationId', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Failed to trigger push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_send_push_notification IS
'Triggers push notifications via Edge Function when a new notification is created. FIXED: Uses correct column names and notification types.';

-- 2. Fix RLS policies on push_subscriptions table for security
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can read their own subscriptions" ON push_subscriptions;

-- Create a secure policy that blocks all direct reads (force RPC-only access)
-- This prevents exposure of encryption keys
CREATE POLICY "No direct reads - use RPCs only" ON push_subscriptions
  FOR SELECT
  USING (false); -- Block all direct SELECT queries

-- Allow service role to read (for edge function)
CREATE POLICY "Service role can read subscriptions" ON push_subscriptions
  FOR SELECT
  TO service_role
  USING (true);

COMMENT ON POLICY "No direct reads - use RPCs only" ON push_subscriptions IS
'Security: Blocks direct reads to prevent encryption key exposure. Use rpc_get_push_subscriptions instead.';

-- 3. Add rate limiting to push subscription creation
CREATE OR REPLACE FUNCTION rpc_save_push_subscription(
  p_user UUID,
  p_device_id TEXT,
  p_endpoint TEXT,
  p_keys_p256dh TEXT,
  p_keys_auth TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subscription_id UUID;
  v_subscription_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_user IS NULL OR p_device_id IS NULL OR p_endpoint IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;

  IF LENGTH(p_endpoint) < 10 OR LENGTH(p_endpoint) > 1000 THEN
    RAISE EXCEPTION 'Invalid endpoint length';
  END IF;

  -- Rate limit: Max 5 new subscriptions per user per hour
  SELECT COUNT(*) INTO v_subscription_count
  FROM push_subscriptions
  WHERE user_id = p_user
    AND created_at > (now() - interval '1 hour');

  IF v_subscription_count >= 5 THEN
    RAISE EXCEPTION 'Subscription rate limit exceeded. Please try again later.';
  END IF;

  -- Check if subscription already exists for this endpoint
  SELECT id INTO v_subscription_id
  FROM push_subscriptions
  WHERE endpoint = p_endpoint;

  IF v_subscription_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE push_subscriptions
    SET
      user_id = p_user,
      device_id = p_device_id,
      keys_p256dh = p_keys_p256dh,
      keys_auth = p_keys_auth,
      user_agent = COALESCE(p_user_agent, user_agent),
      enabled = true,
      updated_at = now()
    WHERE id = v_subscription_id;

    RETURN v_subscription_id;
  ELSE
    -- Create new subscription
    INSERT INTO push_subscriptions (
      user_id,
      device_id,
      endpoint,
      keys_p256dh,
      keys_auth,
      user_agent,
      enabled
    ) VALUES (
      p_user,
      p_device_id,
      p_endpoint,
      p_keys_p256dh,
      p_keys_auth,
      p_user_agent,
      true
    )
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION rpc_save_push_subscription IS
'Save or update push subscription with rate limiting (max 5 per hour per user)';

-- 4. Add notification delivery tracking table for debugging and analytics
CREATE TABLE IF NOT EXISTS push_notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON push_notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_user ON push_notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_created ON push_notification_delivery_log(created_at);

COMMENT ON TABLE push_notification_delivery_log IS
'Tracks push notification delivery for debugging and analytics';

-- Enable RLS on delivery log
ALTER TABLE push_notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own delivery logs
CREATE POLICY "Users can read own delivery logs" ON push_notification_delivery_log
  FOR SELECT
  USING (false); -- Block direct access, use RPCs only

-- Service role can insert
CREATE POLICY "Service role can insert logs" ON push_notification_delivery_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. Schedule automatic cleanup of old delivery logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_delivery_logs()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_notification_delivery_log
  WHERE created_at < (now() - interval '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old delivery logs', deleted_count;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_delivery_logs IS
'Cleanup delivery logs older than 30 days. Should be run via cron weekly.';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpc_save_push_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_delivery_logs TO service_role;

-- Instructions for completing setup
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Push Notification Migration Applied Successfully!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS TO COMPLETE SETUP:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Configure database settings:';
  RAISE NOTICE '   For LOCAL development:';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.settings.edge_function_url = ''http://host.docker.internal:54321/functions/v1'';';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.settings.service_role_key = ''<get-from-supabase-status>'';';
  RAISE NOTICE '';
  RAISE NOTICE '   For PRODUCTION:';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.settings.edge_function_url = ''https://nacbcypcopzbyxgbiips.supabase.co/functions/v1'';';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.settings.service_role_key = ''<production-service-role-key>'';';
  RAISE NOTICE '';
  RAISE NOTICE '2. Deploy edge function to production:';
  RAISE NOTICE '   supabase functions deploy send-push-notification';
  RAISE NOTICE '';
  RAISE NOTICE '3. Test push notifications:';
  RAISE NOTICE '   - Create a test comment';
  RAISE NOTICE '   - Check notifications table';
  RAISE NOTICE '   - Check net._http_response table for delivery logs';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
END $$;
