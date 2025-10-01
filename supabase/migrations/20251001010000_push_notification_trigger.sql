-- Push Notification Trigger
-- This migration sets up automatic push notification sending when a new notification is created

-- Function to call the Edge Function via pg_net HTTP extension
CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_post_content TEXT;
  v_comment_content TEXT;
  v_actor_subway_line TEXT;
BEGIN
  -- Only send push notifications for certain types
  IF NEW.type NOT IN ('reply', 'mention', 'vote') THEN
    RETURN NEW;
  END IF;

  -- Get notification details
  v_notification_type := NEW.type;

  -- Get actor's subway line for display
  SELECT subway_line INTO v_actor_subway_line
  FROM users
  WHERE id = NEW.actor_id;

  -- Build notification title and body based on type
  IF v_notification_type = 'reply' THEN
    -- Get post or comment content for context
    IF NEW.comment_id IS NOT NULL THEN
      SELECT content INTO v_comment_content
      FROM comments
      WHERE id = NEW.comment_id;

      v_title := v_actor_subway_line || ' Line replied to you';
      v_body := CASE
        WHEN LENGTH(v_comment_content) > 100 THEN SUBSTRING(v_comment_content, 1, 100) || '...'
        ELSE v_comment_content
      END;
    ELSIF NEW.post_id IS NOT NULL THEN
      SELECT content INTO v_post_content
      FROM posts
      WHERE id = NEW.post_id;

      v_title := v_actor_subway_line || ' Line replied to your post';
      v_body := CASE
        WHEN LENGTH(v_post_content) > 100 THEN SUBSTRING(v_post_content, 1, 100) || '...'
        ELSE v_post_content
      END;
    ELSE
      v_title := v_actor_subway_line || ' Line replied to you';
      v_body := 'You have a new reply';
    END IF;

  ELSIF v_notification_type = 'mention' THEN
    v_title := v_actor_subway_line || ' Line mentioned you';
    v_body := 'You were mentioned in a comment';

  ELSIF v_notification_type = 'vote' THEN
    v_title := 'Someone upvoted your post';
    v_body := 'Your post is getting popular!';

  ELSE
    -- Default notification
    v_title := 'New notification';
    v_body := 'You have a new notification';
  END IF;

  -- Call Edge Function using pg_net.http_post
  -- Note: This requires the pg_net extension to be enabled
  -- The Edge Function URL should be configured via environment variable or hardcoded
  PERFORM net.http_post(
    url := current_setting('app.settings.edge_function_url', true) || '/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_created ON notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_push_notification();

-- Enable pg_net extension if not already enabled
-- This extension allows making HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Add configuration settings for Edge Function
-- These should be set via ALTER DATABASE or environment variables
-- For local development:
-- ALTER DATABASE postgres SET app.settings.edge_function_url = 'http://host.docker.internal:54321/functions/v1';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

COMMENT ON FUNCTION trigger_send_push_notification IS
'Triggers push notifications to be sent via Edge Function when a new notification is created';
