create sequence "public"."notif_queue_id_seq";

revoke references on table "public"."comments" from "anon";

revoke select on table "public"."comments" from "anon";

revoke trigger on table "public"."comments" from "anon";

revoke truncate on table "public"."comments" from "anon";

revoke delete on table "public"."comments" from "authenticated";

revoke insert on table "public"."comments" from "authenticated";

revoke references on table "public"."comments" from "authenticated";

revoke select on table "public"."comments" from "authenticated";

revoke trigger on table "public"."comments" from "authenticated";

revoke truncate on table "public"."comments" from "authenticated";

revoke update on table "public"."comments" from "authenticated";

revoke delete on table "public"."comments" from "service_role";

revoke insert on table "public"."comments" from "service_role";

revoke references on table "public"."comments" from "service_role";

revoke select on table "public"."comments" from "service_role";

revoke trigger on table "public"."comments" from "service_role";

revoke truncate on table "public"."comments" from "service_role";

revoke update on table "public"."comments" from "service_role";

revoke delete on table "public"."edge_function_config" from "anon";

revoke insert on table "public"."edge_function_config" from "anon";

revoke references on table "public"."edge_function_config" from "anon";

revoke select on table "public"."edge_function_config" from "anon";

revoke trigger on table "public"."edge_function_config" from "anon";

revoke truncate on table "public"."edge_function_config" from "anon";

revoke update on table "public"."edge_function_config" from "anon";

revoke delete on table "public"."edge_function_config" from "authenticated";

revoke insert on table "public"."edge_function_config" from "authenticated";

revoke references on table "public"."edge_function_config" from "authenticated";

revoke select on table "public"."edge_function_config" from "authenticated";

revoke trigger on table "public"."edge_function_config" from "authenticated";

revoke truncate on table "public"."edge_function_config" from "authenticated";

revoke update on table "public"."edge_function_config" from "authenticated";

revoke delete on table "public"."edge_function_config" from "service_role";

revoke insert on table "public"."edge_function_config" from "service_role";

revoke references on table "public"."edge_function_config" from "service_role";

revoke select on table "public"."edge_function_config" from "service_role";

revoke trigger on table "public"."edge_function_config" from "service_role";

revoke truncate on table "public"."edge_function_config" from "service_role";

revoke update on table "public"."edge_function_config" from "service_role";

revoke delete on table "public"."emoji_subway_mapping" from "anon";

revoke insert on table "public"."emoji_subway_mapping" from "anon";

revoke references on table "public"."emoji_subway_mapping" from "anon";

revoke select on table "public"."emoji_subway_mapping" from "anon";

revoke trigger on table "public"."emoji_subway_mapping" from "anon";

revoke truncate on table "public"."emoji_subway_mapping" from "anon";

revoke update on table "public"."emoji_subway_mapping" from "anon";

revoke delete on table "public"."emoji_subway_mapping" from "authenticated";

revoke insert on table "public"."emoji_subway_mapping" from "authenticated";

revoke references on table "public"."emoji_subway_mapping" from "authenticated";

revoke select on table "public"."emoji_subway_mapping" from "authenticated";

revoke trigger on table "public"."emoji_subway_mapping" from "authenticated";

revoke truncate on table "public"."emoji_subway_mapping" from "authenticated";

revoke update on table "public"."emoji_subway_mapping" from "authenticated";

revoke delete on table "public"."emoji_subway_mapping" from "service_role";

revoke insert on table "public"."emoji_subway_mapping" from "service_role";

revoke references on table "public"."emoji_subway_mapping" from "service_role";

revoke select on table "public"."emoji_subway_mapping" from "service_role";

revoke trigger on table "public"."emoji_subway_mapping" from "service_role";

revoke truncate on table "public"."emoji_subway_mapping" from "service_role";

revoke update on table "public"."emoji_subway_mapping" from "service_role";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke references on table "public"."posts" from "anon";

revoke select on table "public"."posts" from "anon";

revoke trigger on table "public"."posts" from "anon";

revoke truncate on table "public"."posts" from "anon";

revoke delete on table "public"."posts" from "authenticated";

revoke insert on table "public"."posts" from "authenticated";

revoke references on table "public"."posts" from "authenticated";

revoke select on table "public"."posts" from "authenticated";

revoke trigger on table "public"."posts" from "authenticated";

revoke truncate on table "public"."posts" from "authenticated";

revoke update on table "public"."posts" from "authenticated";

revoke delete on table "public"."posts" from "service_role";

revoke insert on table "public"."posts" from "service_role";

revoke references on table "public"."posts" from "service_role";

revoke select on table "public"."posts" from "service_role";

revoke trigger on table "public"."posts" from "service_role";

revoke truncate on table "public"."posts" from "service_role";

revoke update on table "public"."posts" from "service_role";

revoke delete on table "public"."push_notification_delivery_log" from "anon";

revoke insert on table "public"."push_notification_delivery_log" from "anon";

revoke references on table "public"."push_notification_delivery_log" from "anon";

revoke select on table "public"."push_notification_delivery_log" from "anon";

revoke trigger on table "public"."push_notification_delivery_log" from "anon";

revoke truncate on table "public"."push_notification_delivery_log" from "anon";

revoke update on table "public"."push_notification_delivery_log" from "anon";

revoke delete on table "public"."push_notification_delivery_log" from "authenticated";

revoke insert on table "public"."push_notification_delivery_log" from "authenticated";

revoke references on table "public"."push_notification_delivery_log" from "authenticated";

revoke select on table "public"."push_notification_delivery_log" from "authenticated";

revoke trigger on table "public"."push_notification_delivery_log" from "authenticated";

revoke truncate on table "public"."push_notification_delivery_log" from "authenticated";

revoke update on table "public"."push_notification_delivery_log" from "authenticated";

revoke delete on table "public"."push_notification_delivery_log" from "service_role";

revoke insert on table "public"."push_notification_delivery_log" from "service_role";

revoke references on table "public"."push_notification_delivery_log" from "service_role";

revoke select on table "public"."push_notification_delivery_log" from "service_role";

revoke trigger on table "public"."push_notification_delivery_log" from "service_role";

revoke truncate on table "public"."push_notification_delivery_log" from "service_role";

revoke update on table "public"."push_notification_delivery_log" from "service_role";

revoke references on table "public"."push_subscriptions" from "anon";

revoke select on table "public"."push_subscriptions" from "anon";

revoke trigger on table "public"."push_subscriptions" from "anon";

revoke truncate on table "public"."push_subscriptions" from "anon";

revoke delete on table "public"."push_subscriptions" from "authenticated";

revoke insert on table "public"."push_subscriptions" from "authenticated";

revoke references on table "public"."push_subscriptions" from "authenticated";

revoke select on table "public"."push_subscriptions" from "authenticated";

revoke trigger on table "public"."push_subscriptions" from "authenticated";

revoke truncate on table "public"."push_subscriptions" from "authenticated";

revoke update on table "public"."push_subscriptions" from "authenticated";

revoke delete on table "public"."push_subscriptions" from "service_role";

revoke insert on table "public"."push_subscriptions" from "service_role";

revoke references on table "public"."push_subscriptions" from "service_role";

revoke select on table "public"."push_subscriptions" from "service_role";

revoke trigger on table "public"."push_subscriptions" from "service_role";

revoke truncate on table "public"."push_subscriptions" from "service_role";

revoke update on table "public"."push_subscriptions" from "service_role";

revoke references on table "public"."thread_identities" from "anon";

revoke select on table "public"."thread_identities" from "anon";

revoke trigger on table "public"."thread_identities" from "anon";

revoke truncate on table "public"."thread_identities" from "anon";

revoke delete on table "public"."thread_identities" from "authenticated";

revoke insert on table "public"."thread_identities" from "authenticated";

revoke references on table "public"."thread_identities" from "authenticated";

revoke select on table "public"."thread_identities" from "authenticated";

revoke trigger on table "public"."thread_identities" from "authenticated";

revoke truncate on table "public"."thread_identities" from "authenticated";

revoke update on table "public"."thread_identities" from "authenticated";

revoke delete on table "public"."thread_identities" from "service_role";

revoke insert on table "public"."thread_identities" from "service_role";

revoke references on table "public"."thread_identities" from "service_role";

revoke select on table "public"."thread_identities" from "service_role";

revoke trigger on table "public"."thread_identities" from "service_role";

revoke truncate on table "public"."thread_identities" from "service_role";

revoke update on table "public"."thread_identities" from "service_role";

revoke delete on table "public"."thread_identity_rerolls" from "anon";

revoke insert on table "public"."thread_identity_rerolls" from "anon";

revoke references on table "public"."thread_identity_rerolls" from "anon";

revoke select on table "public"."thread_identity_rerolls" from "anon";

revoke trigger on table "public"."thread_identity_rerolls" from "anon";

revoke truncate on table "public"."thread_identity_rerolls" from "anon";

revoke update on table "public"."thread_identity_rerolls" from "anon";

revoke delete on table "public"."thread_identity_rerolls" from "authenticated";

revoke insert on table "public"."thread_identity_rerolls" from "authenticated";

revoke references on table "public"."thread_identity_rerolls" from "authenticated";

revoke select on table "public"."thread_identity_rerolls" from "authenticated";

revoke trigger on table "public"."thread_identity_rerolls" from "authenticated";

revoke truncate on table "public"."thread_identity_rerolls" from "authenticated";

revoke update on table "public"."thread_identity_rerolls" from "authenticated";

revoke delete on table "public"."thread_identity_rerolls" from "service_role";

revoke insert on table "public"."thread_identity_rerolls" from "service_role";

revoke references on table "public"."thread_identity_rerolls" from "service_role";

revoke select on table "public"."thread_identity_rerolls" from "service_role";

revoke trigger on table "public"."thread_identity_rerolls" from "service_role";

revoke truncate on table "public"."thread_identity_rerolls" from "service_role";

revoke update on table "public"."thread_identity_rerolls" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

revoke delete on table "public"."users_emoji_backup" from "anon";

revoke insert on table "public"."users_emoji_backup" from "anon";

revoke references on table "public"."users_emoji_backup" from "anon";

revoke select on table "public"."users_emoji_backup" from "anon";

revoke trigger on table "public"."users_emoji_backup" from "anon";

revoke truncate on table "public"."users_emoji_backup" from "anon";

revoke update on table "public"."users_emoji_backup" from "anon";

revoke delete on table "public"."users_emoji_backup" from "authenticated";

revoke insert on table "public"."users_emoji_backup" from "authenticated";

revoke references on table "public"."users_emoji_backup" from "authenticated";

revoke select on table "public"."users_emoji_backup" from "authenticated";

revoke trigger on table "public"."users_emoji_backup" from "authenticated";

revoke truncate on table "public"."users_emoji_backup" from "authenticated";

revoke update on table "public"."users_emoji_backup" from "authenticated";

revoke delete on table "public"."users_emoji_backup" from "service_role";

revoke insert on table "public"."users_emoji_backup" from "service_role";

revoke references on table "public"."users_emoji_backup" from "service_role";

revoke select on table "public"."users_emoji_backup" from "service_role";

revoke trigger on table "public"."users_emoji_backup" from "service_role";

revoke truncate on table "public"."users_emoji_backup" from "service_role";

revoke update on table "public"."users_emoji_backup" from "service_role";

revoke references on table "public"."votes" from "anon";

revoke select on table "public"."votes" from "anon";

revoke trigger on table "public"."votes" from "anon";

revoke truncate on table "public"."votes" from "anon";

revoke delete on table "public"."votes" from "authenticated";

revoke insert on table "public"."votes" from "authenticated";

revoke references on table "public"."votes" from "authenticated";

revoke select on table "public"."votes" from "authenticated";

revoke trigger on table "public"."votes" from "authenticated";

revoke truncate on table "public"."votes" from "authenticated";

revoke update on table "public"."votes" from "authenticated";

revoke delete on table "public"."votes" from "service_role";

revoke insert on table "public"."votes" from "service_role";

revoke references on table "public"."votes" from "service_role";

revoke select on table "public"."votes" from "service_role";

revoke trigger on table "public"."votes" from "service_role";

revoke truncate on table "public"."votes" from "service_role";

revoke update on table "public"."votes" from "service_role";

create table "public"."notif_queue" (
    "id" bigint not null default nextval('notif_queue_id_seq'::regclass),
    "kind" text not null,
    "user_id" uuid not null,
    "post_id" uuid,
    "comment_id" uuid,
    "payload" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "processed_at" timestamp with time zone
);


alter table "public"."notif_queue" enable row level security;

alter table "public"."comments" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."posts" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."thread_identities" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."users" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."votes" alter column "id" set default extensions.uuid_generate_v4();

alter sequence "public"."notif_queue_id_seq" owned by "public"."notif_queue"."id";

CREATE UNIQUE INDEX notif_queue_pkey ON public.notif_queue USING btree (id);

alter table "public"."notif_queue" add constraint "notif_queue_pkey" PRIMARY KEY using index "notif_queue_pkey";

alter table "public"."notif_queue" add constraint "notif_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."notif_queue" validate constraint "notif_queue_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_milestone_notif()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE thresholds int[] := ARRAY[5,10]; v_old int; v_new int; author uuid; t int;
BEGIN
  v_old := COALESCE(OLD.score,0); v_new := COALESCE(NEW.score,0);
  IF v_new = v_old THEN RETURN NEW; END IF;
  SELECT user_id INTO author FROM posts WHERE id = NEW.id;
  FOREACH t IN ARRAY thresholds LOOP
    IF v_old < t AND v_new >= t THEN
      INSERT INTO notif_queue(kind, user_id, post_id, payload)
      VALUES ('milestone', author, NEW.id, jsonb_build_object('threshold', t, 'score', v_new));
    END IF;
  END LOOP;
  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_reply_notif()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE target_user uuid; post_owner uuid; BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF NEW.parent_id IS NULL THEN
    target_user := post_owner;
  ELSE
    SELECT user_id INTO target_user FROM comments WHERE id = NEW.parent_id;
  END IF;
  IF target_user IS NOT NULL AND target_user <> NEW.user_id THEN
    INSERT INTO notif_queue(kind, user_id, post_id, comment_id, payload)
    VALUES ('reply', target_user, NEW.post_id, NEW.id,
            jsonb_build_object('author_id', NEW.user_id, 'content', NEW.content));
  END IF;
  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.webhook_send_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_title TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Only process reply notifications
  IF NEW.type NOT IN ('reply_to_post', 'reply_to_comment') THEN
    RETURN NEW;
  END IF;

  -- Get service role key from config
  SELECT value INTO v_service_role_key
  FROM edge_function_config
  WHERE key = 'service_role_key';

  IF v_service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not configured for webhooks';
    RETURN NEW;
  END IF;

  -- Build title dynamically
  IF NEW.type = 'reply_to_post' THEN
    v_title := COALESCE(NEW.actor_subway_line, 'Someone') || ' Line replied to your post';
  ELSE
    v_title := COALESCE(NEW.actor_subway_line, 'Someone') || ' Line replied to your comment';
  END IF;

  -- Call edge function using supabase_functions.http_request
  PERFORM supabase_functions.http_request(
    'https://nacbcypcopzbyxgbiips.supabase.co/functions/v1/send-push-notification',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer ' || v_service_role_key || '"}',
    jsonb_build_object(
      'userId', NEW.user_id::text,
      'title', v_title,
      'body', COALESCE(NEW.preview_content, 'You have a new reply'),
      'postId', NEW.post_id::text,
      'commentId', NEW.comment_id::text,
      'notificationId', NEW.id::text
    )::text,
    '5000'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send push notification webhook: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.best_score(score integer, created_at timestamp with time zone)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN score IS NULL THEN 0
    ELSE score::double precision / (pow(GREATEST(EXTRACT(EPOCH FROM (now() - created_at)), 1)::double precision, 0.5) + 1)
  END
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_delivery_logs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_notification_delivery_log
  WHERE created_at < (now() - interval '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old delivery logs', deleted_count;
  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications
  WHERE read = true
    AND read_at < (now() - interval '30 days')
    AND deleted_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_push_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete subscriptions not updated in 90 days
  DELETE FROM push_subscriptions
  WHERE updated_at < (now() - interval '90 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_comment(p_user uuid, p_post_id uuid, p_parent_comment_id uuid, p_content text)
 RETURNS comments
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_comment comments;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Insert comment
  INSERT INTO comments (user_id, post_id, parent_comment_id, content)
  VALUES (p_user, p_post_id, p_parent_comment_id, p_content)
  RETURNING * INTO v_comment;

  RETURN v_comment;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_milestone_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  milestone_type TEXT;
BEGIN
  -- Only process score increases on posts
  IF TG_TABLE_NAME != 'posts' THEN
    RETURN NEW;
  END IF;

  -- Only process score increases (not decreases)
  IF OLD.score >= NEW.score THEN
    RETURN NEW;
  END IF;

  -- Check which milestone was reached
  IF OLD.score < 5 AND NEW.score >= 5 THEN
    milestone_type := 'milestone_5';
  ELSIF OLD.score < 10 AND NEW.score >= 10 THEN
    milestone_type := 'milestone_10';
  ELSIF OLD.score < 25 AND NEW.score >= 25 THEN
    milestone_type := 'milestone_25';
  ELSE
    -- No milestone reached
    RETURN NEW;
  END IF;

  -- Create milestone notification
  -- Check if notification already exists to prevent duplicates
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.user_id
      AND post_id = NEW.id
      AND type = milestone_type
  ) THEN
    INSERT INTO notifications (
      user_id,
      post_id,
      type,
      preview_content
    ) VALUES (
      NEW.user_id,
      NEW.id,
      milestone_type,
      format('Your post reached %s upvotes!',
        CASE milestone_type
          WHEN 'milestone_5' THEN '5'
          WHEN 'milestone_10' THEN '10'
          WHEN 'milestone_25' THEN '25'
        END
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_post(p_user uuid, p_content text)
 RETURNS posts
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_post posts;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Insert post
  INSERT INTO posts (user_id, location, content_excerpt, content)
  VALUES (p_user, 'dimes_square', substr(p_content,1,500), p_content)
  RETURNING * INTO v_post;

  RETURN v_post;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_reply_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recipient_user_id UUID;
  actor_line TEXT;
  actor_color TEXT;
  notification_type TEXT;
BEGIN
  -- Determine recipient and notification type
  IF NEW.parent_id IS NULL THEN
    -- Reply to post
    SELECT user_id INTO recipient_user_id
    FROM posts
    WHERE id = NEW.post_id;

    notification_type := 'reply_to_post';
  ELSE
    -- Reply to comment
    SELECT user_id INTO recipient_user_id
    FROM comments
    WHERE id = NEW.parent_id;

    notification_type := 'reply_to_comment';
  END IF;

  -- Don't notify if replying to own post/comment
  IF recipient_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor's subway identity
  SELECT subway_line, subway_color INTO actor_line, actor_color
  FROM users
  WHERE id = NEW.user_id;

  -- Create notification with denormalized data
  INSERT INTO notifications (
    user_id,
    post_id,
    comment_id,
    type,
    actor_user_id,
    actor_subway_line,
    actor_subway_color,
    preview_content
  ) VALUES (
    recipient_user_id,
    NEW.post_id,
    NEW.id,
    notification_type,
    NEW.user_id,
    actor_line,
    actor_color,
    substr(NEW.content, 1, 100)
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.derive_identity(seed text)
 RETURNS TABLE(emoji text, color_code text)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];
  eidx int;
  cidx int;
BEGIN
  -- simple modulus over hex
  eidx := (('x' || substr(seed, 1, 8))::bit(32))::int;
  cidx := (('x' || substr(seed, 9, 8))::bit(32))::int;
  eidx := (abs(eidx) % array_length(emojis,1)) + 1;
  cidx := (abs(cidx) % array_length(colors,1)) + 1;
  RETURN QUERY SELECT emojis[eidx], colors[cidx];
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_thread_identity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    emoji_list TEXT[] := ARRAY['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'];
    color_list TEXT[] := ARRAY['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D5A6BD', '#AED6F1', '#A9DFBF', '#FAD7A0', '#D2B4DE', '#AED6F1'];
    selected_emoji TEXT;
    selected_color TEXT;
    target_post_id UUID;
BEGIN
    -- Only generate identity for new posts/comments, not updates
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Determine the post_id based on the table
    IF TG_TABLE_NAME = 'posts' THEN
        target_post_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        target_post_id := NEW.post_id;
    ELSE
        -- For other tables, skip identity generation
        RETURN NEW;
    END IF;

    -- Check if thread identity already exists
    IF NOT EXISTS (
        SELECT 1 FROM thread_identities
        WHERE user_id = NEW.user_id AND post_id = target_post_id
    ) THEN
        -- Generate random emoji and color
        selected_emoji := emoji_list[1 + floor(random() * array_length(emoji_list, 1))::integer];
        selected_color := color_list[1 + floor(random() * array_length(color_list, 1))::integer];
        selected_emoji := COALESCE(selected_emoji, '🎭');
        selected_color := COALESCE(selected_color, '#9B59B6');

        -- Insert thread identity
        INSERT INTO thread_identities (user_id, post_id, emoji, color_code)
        VALUES (NEW.user_id, target_post_id, selected_emoji, selected_color)
        ON CONFLICT (user_id, post_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_thread_path()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.thread_path = NEW.id::text;
        NEW.depth = 0;
    ELSE
        SELECT thread_path || '.' || NEW.id::text, depth + 1
        INTO NEW.thread_path, NEW.depth
        FROM comments WHERE id = NEW.parent_id;

        -- Enforce max depth
        IF NEW.depth > 1 THEN
            RAISE EXCEPTION 'Maximum comment depth (2 levels) exceeded';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_active_push_subscriptions(p_user uuid)
 RETURNS TABLE(id uuid, endpoint text, keys_p256dh text, keys_auth text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- This function is for internal use by push notification service
  -- Returns full subscription data including keys for encryption
  RETURN QUERY
  SELECT
    ps.id,
    ps.endpoint,
    ps.keys_p256dh,
    ps.keys_auth
  FROM push_subscriptions ps
  WHERE ps.user_id = p_user
    AND ps.enabled = true
  ORDER BY ps.updated_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_comments_tree(post_id_param uuid)
 RETURNS TABLE(id uuid, parent_id uuid, content text, created_at timestamp with time zone, depth integer, score integer, reply_count integer, user_emoji text, user_color text, user_subway_line text, user_subway_color text, thread_path text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT c.id, c.parent_id, c.content, c.created_at, c.depth, c.score, c.reply_count,
           COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
           COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue'), c.thread_path
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN thread_identities ti ON c.post_id = ti.post_id AND c.user_id = ti.user_id
    WHERE c.post_id = post_id_param AND c.deleted_at IS NULL
    ORDER BY c.thread_path;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_user(device_id_param text)
 RETURNS anonymous_users
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  user_record anonymous_users%ROWTYPE;
  subway_lines text[] := ARRAY['A','B','G','J','L','N','1','4','7','T'];
  subway_colors text[] := ARRAY[
    'mta-blue','mta-orange','mta-light-green','mta-brown','mta-grey',
    'mta-yellow','mta-red','mta-dark-green','mta-purple','mta-teal'
  ];
  -- Legacy emoji/color arrays for backward compatibility during transition
  emojis text[] := ARRAY['🎭','🦄','🚀','🌟','🔥','💫','🎨','🌈','⚡','🎪'];
  colors text[] := ARRAY['purple','blue','green','orange','red'];
  chosen_subway_line text;
  chosen_subway_color text;
  chosen_emoji text;
  chosen_color text;
  mapping_index integer;
BEGIN
  -- Try to find existing user
  SELECT id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
  INTO user_record
  FROM anonymous_users
  WHERE device_id = device_id_param;

  IF FOUND THEN
    -- Update last seen timestamp
    UPDATE users
    SET last_seen_at = NOW()
    WHERE id = user_record.id
    RETURNING id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
    INTO user_record;
    RETURN user_record;
  END IF;

  -- Generate new user identity with consistent mapping
  -- Choose a random index for consistent emoji/color/subway mapping
  mapping_index := 1 + (floor(random() * 10))::int;

  -- Map index to subway values
  chosen_subway_line := subway_lines[mapping_index];
  chosen_subway_color := subway_colors[mapping_index];

  -- Map to corresponding legacy emoji/color for backward compatibility
  CASE mapping_index
    WHEN 1 THEN chosen_emoji := '🎭'; chosen_color := 'purple';   -- A, mta-blue
    WHEN 2 THEN chosen_emoji := '🦄'; chosen_color := 'blue';     -- B, mta-orange
    WHEN 3 THEN chosen_emoji := '🚀'; chosen_color := 'green';    -- G, mta-light-green
    WHEN 4 THEN chosen_emoji := '🌟'; chosen_color := 'orange';   -- J, mta-brown
    WHEN 5 THEN chosen_emoji := '🔥'; chosen_color := 'red';      -- L, mta-grey
    WHEN 6 THEN chosen_emoji := '💫'; chosen_color := 'purple';   -- N, mta-yellow
    WHEN 7 THEN chosen_emoji := '🎨'; chosen_color := 'blue';     -- 1, mta-red
    WHEN 8 THEN chosen_emoji := '🌈'; chosen_color := 'green';    -- 4, mta-dark-green
    WHEN 9 THEN chosen_emoji := '⚡'; chosen_color := 'orange';   -- 7, mta-purple
    WHEN 10 THEN chosen_emoji := '🎪'; chosen_color := 'red';     -- T, mta-teal
    ELSE chosen_emoji := '🎭'; chosen_color := 'purple';          -- Default fallback
  END CASE;

  -- Create new user with both legacy and subway identity
  INSERT INTO users (device_id, emoji, color, subway_line, subway_color, last_seen_at)
  VALUES (device_id_param, chosen_emoji, chosen_color, chosen_subway_line, chosen_subway_color, NOW())
  RETURNING id, device_id, emoji, color, subway_line, subway_color, created_at, last_seen_at
  INTO user_record;

  RETURN user_record;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_posts_paginated(community_param text DEFAULT 'dimes_square'::text, sort_by text DEFAULT 'hot'::text, limit_param integer DEFAULT 20, offset_param integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, content text, created_at timestamp with time zone, score integer, comment_count integer, user_emoji text, user_color text, user_subway_line text, user_subway_color text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    IF sort_by = 'hot' THEN
        RETURN QUERY
        SELECT hp.id, hp.title, hp.content, hp.created_at, hp.score, hp.comment_count,
               hp.user_emoji, hp.user_color, hp.user_subway_line, hp.user_subway_color
        FROM hot_posts hp
        WHERE hp.community = community_param
        ORDER BY hp.hot_score DESC, hp.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'new' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    ELSIF sort_by = 'top' THEN
        RETURN QUERY
        SELECT p.id, p.title, p.content, p.created_at, p.score, p.comment_count,
               COALESCE(ti.emoji, u.emoji, '🤔'), COALESCE(ti.color_code, '#6B7280'),
               COALESCE(u.subway_line, 'A'), COALESCE(u.subway_color, 'mta-blue')
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN thread_identities ti ON p.id = ti.post_id AND p.user_id = ti.user_id
        WHERE p.community = community_param AND p.deleted_at IS NULL
        ORDER BY p.score DESC, p.created_at DESC
        LIMIT limit_param OFFSET offset_param;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_subway_identity(user_id_param uuid, post_id_param uuid)
 RETURNS TABLE(subway_line text, subway_color text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    -- For subway identities, we use the user's permanent subway identity
    -- rather than per-thread identities (different from emoji system)
    RETURN QUERY
    SELECT u.subway_line, u.subway_color
    FROM users u
    WHERE u.id = user_id_param;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_thread_identity(user_id_param uuid, post_id_param uuid)
 RETURNS TABLE(emoji text, color_code text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT ti.emoji, ti.color_code
    FROM thread_identities ti
    WHERE ti.user_id = user_id_param AND ti.post_id = post_id_param;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hash_text(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT encode(digest(input, 'sha256'), 'hex')
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin user ID: 784e1453-e77f-491c-ad61-d76c3f1d0f2d
  RETURN user_id = '784e1453-e77f-491c-ad61-d76c3f1d0f2d'::UUID;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_database_size()
 RETURNS TABLE(table_name text, table_size text, indexes_size text, total_size text, row_count bigint, size_bytes bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_foreign_key_indexes()
 RETURNS TABLE(table_name text, foreign_key_columns text, references_table text, has_index boolean, status text, recommendation text)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_hot_posts_refresh()
 RETURNS TABLE(view_name text, size text, row_count bigint, last_refresh timestamp with time zone, refresh_recommended boolean, recommendation text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    'hot_posts'::text AS view_name,
    pg_size_pretty(pg_relation_size('hot_posts')) AS size,
    COUNT(*)::bigint AS row_count,
    -- Estimate last refresh by checking materialized view metadata
    -- (Note: pg_stat_user_tables doesn't track materialized view refreshes directly)
    NULL::timestamp with time zone AS last_refresh,
    -- Recommend refresh if view is more than 5 minutes old
    true AS refresh_recommended,
    'Run: REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;' AS recommendation
  FROM hot_posts;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_index_usage()
 RETURNS TABLE(table_name text, index_name text, index_size text, times_used bigint, tuples_read bigint, tuples_fetched bigint, status text, recommendation text)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_sequential_scans()
 RETURNS TABLE(table_name text, sequential_scans bigint, tuples_read_by_seq_scan bigint, index_scans bigint, table_size text, row_count bigint, scan_pattern text, recommendation text)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.monitor_table_bloat()
 RETURNS TABLE(table_name text, live_tuples bigint, dead_tuples bigint, dead_tuple_percent numeric, table_size text, last_vacuum timestamp with time zone, last_autovacuum timestamp with time zone, status text, recommendation text)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_hot_posts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hot_posts;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_create_comment(p_user uuid, p_post uuid, p_parent uuid, p_content text)
 RETURNS comments
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cnt int;
  rec comments;
  parent_depth int;
BEGIN
  -- Updated validation: 1-500 characters (was 1-100)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;
  SELECT count(*) INTO cnt FROM comments WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 30 THEN RAISE EXCEPTION 'Comment rate limit exceeded'; END IF;
  IF p_parent IS NOT NULL THEN
    SELECT depth INTO parent_depth FROM comments WHERE id = p_parent;
    IF parent_depth IS NULL THEN RAISE EXCEPTION 'Parent not found'; END IF;
    IF parent_depth >= 1 THEN RAISE EXCEPTION 'Max depth exceeded'; END IF;
  END IF;
  INSERT INTO comments(user_id, post_id, parent_id, content)
  VALUES (p_user, p_post, p_parent, p_content)
  RETURNING * INTO rec;
  RETURN rec;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_create_post(p_user uuid, p_content text, p_community text DEFAULT 'nyc'::text)
 RETURNS posts
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cnt int;
  rec posts;
  u_subway_line text;
BEGIN
  -- Validate content length (1-500 characters)
  IF length(p_content) < 1 OR length(p_content) > 500 THEN
    RAISE EXCEPTION 'Invalid content length';
  END IF;

  -- Validate community
  IF p_community NOT IN ('nyc', 'dimes_square') THEN
    RAISE EXCEPTION 'Invalid community. Must be nyc or dimes_square';
  END IF;

  -- Check rate limit (10 posts per hour)
  SELECT count(*) INTO cnt FROM posts WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'Post rate limit exceeded';
  END IF;

  -- Get user's subway line
  SELECT subway_line INTO u_subway_line FROM users WHERE id = p_user;
  IF u_subway_line IS NULL THEN
    RAISE EXCEPTION 'User not found or has no subway line';
  END IF;

  -- Create post with community and user subway line
  INSERT INTO posts(user_id, community, title, content, user_subway_line)
  VALUES (p_user, p_community, substr(p_content, 1, 100), p_content, u_subway_line)
  RETURNING * INTO rec;

  RETURN rec;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_delete_comment(p_user uuid, p_comment uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin can delete any comment, regular users can only delete their own
  IF is_admin_user(p_user) THEN
    -- Admin: delete any comment
    UPDATE comments
    SET
      deleted_at = NOW(),
      deletion_reason = 'admin_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_comment;
  ELSE
    -- Regular user: only delete own comments
    UPDATE comments
    SET
      deleted_at = NOW(),
      deletion_reason = 'user_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_comment
      AND user_id = p_user;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or you do not have permission to delete it';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_delete_notification(p_user uuid, p_notification uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notification_owner UUID;
BEGIN
  -- Verify ownership
  SELECT user_id INTO notification_owner
  FROM notifications
  WHERE id = p_notification;

  IF notification_owner IS NULL THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  IF notification_owner != p_user THEN
    RAISE EXCEPTION 'Not authorized to delete this notification';
  END IF;

  -- Soft delete
  UPDATE notifications
  SET deleted_at = now()
  WHERE id = p_notification
    AND deleted_at IS NULL;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_delete_post(p_user uuid, p_post uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin can delete any post, regular users can only delete their own
  IF is_admin_user(p_user) THEN
    -- Admin: delete any post
    UPDATE posts
    SET
      deleted_at = NOW(),
      deletion_reason = 'admin_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_post;
  ELSE
    -- Regular user: only delete own posts
    UPDATE posts
    SET
      deleted_at = NOW(),
      deletion_reason = 'user_deleted',
      updated_at = NOW(),
      score = -5
    WHERE id = p_post
      AND user_id = p_user;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or you do not have permission to delete it';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_ensure_thread_identity(user_uuid uuid, post_uuid uuid)
 RETURNS TABLE(emoji text, color_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dev text;
  seed text;
  e text;
  c text;
BEGIN
  SELECT device_id INTO dev FROM users WHERE id = user_uuid;
  IF dev IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  seed := hash_text(dev || post_uuid::text);
  SELECT * INTO e,c FROM derive_identity(seed);
  INSERT INTO thread_identities(user_id, post_id, emoji, color_code)
  VALUES (user_uuid, post_uuid, e, c)
  ON CONFLICT (user_id, post_id) DO UPDATE SET emoji = EXCLUDED.emoji, color_code = EXCLUDED.color_code;
  RETURN QUERY SELECT e, c;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_hot(p_limit integer DEFAULT 20, p_cursor_score integer DEFAULT NULL::integer, p_cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT *
  FROM posts
  WHERE community = 'dimes_square'
    AND deleted_at IS NULL
    AND created_at >= (now() - interval '24 hours')
    AND (
      p_cursor_score IS NULL OR p_cursor_ts IS NULL OR
      (score < p_cursor_score) OR (score = p_cursor_score AND created_at < p_cursor_ts)
    )
  ORDER BY score DESC, created_at DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_feed_new(p_limit integer DEFAULT 20, p_cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT *
  FROM posts
  WHERE community = 'dimes_square'
    AND deleted_at IS NULL
    AND (p_cursor_ts IS NULL OR created_at < p_cursor_ts)
  ORDER BY created_at DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_get_notifications(p_user uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_unread_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, user_id uuid, post_id uuid, comment_id uuid, type text, read boolean, actor_user_id uuid, actor_subway_line text, actor_subway_color text, preview_content text, created_at timestamp with time zone, read_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = p_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate pagination params
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 100';
  END IF;

  IF p_offset < 0 THEN
    RAISE EXCEPTION 'Offset must be non-negative';
  END IF;

  -- Return paginated notifications
  RETURN QUERY
  SELECT
    n.id,
    n.user_id,
    n.post_id,
    n.comment_id,
    n.type,
    n.read,
    n.actor_user_id,
    n.actor_subway_line,
    n.actor_subway_color,
    n.preview_content,
    n.created_at,
    n.read_at
  FROM notifications n
  WHERE n.user_id = p_user
    AND n.deleted_at IS NULL
    AND (NOT p_unread_only OR n.read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_get_push_subscriptions(p_user uuid)
 RETURNS TABLE(id uuid, device_id text, endpoint text, enabled boolean, user_agent text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = p_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Return user's subscriptions (don't expose keys)
  RETURN QUERY
  SELECT
    ps.id,
    ps.device_id,
    ps.endpoint,
    ps.enabled,
    ps.user_agent,
    ps.created_at,
    ps.updated_at
  FROM push_subscriptions ps
  WHERE ps.user_id = p_user
  ORDER BY ps.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_get_thread(p_post uuid, p_sort text DEFAULT 'new'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, post_id uuid, parent_id uuid, user_id uuid, content text, created_at timestamp with time zone, updated_at timestamp with time zone, score integer, reply_count integer, depth integer, is_op boolean, identity_emoji text, identity_color text)
 LANGUAGE sql
 STABLE
AS $function$
  WITH base AS (
    SELECT c.*, (c.user_id = p.user_id) AS is_op,
           ti.emoji AS identity_emoji, ti.color_code AS identity_color
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    LEFT JOIN thread_identities ti ON ti.post_id = c.post_id AND ti.user_id = c.user_id
    WHERE c.post_id = p_post AND c.deleted_at IS NULL
  ), tops AS (
    SELECT * FROM base WHERE parent_id IS NULL
  )
  SELECT b.id, b.post_id, b.parent_id, b.user_id, b.content, b.created_at, b.updated_at,
         b.score, b.reply_count, b.depth, b.is_op, b.identity_emoji, b.identity_color
  FROM base b
  JOIN tops t ON (b.id = t.id OR b.parent_id = t.id)
  ORDER BY
    CASE WHEN p_sort = 'best' THEN best_score(t.score, t.created_at) END DESC NULLS LAST,
    CASE WHEN p_sort = 'new'  THEN t.created_at END DESC NULLS LAST,
    -- keep parent row before replies
    b.parent_id NULLS FIRST,
    b.created_at ASC
  LIMIT p_limit OFFSET p_offset;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_get_unread_count(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cnt INTEGER;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Count unread notifications
  SELECT COUNT(*) INTO cnt
  FROM notifications
  WHERE user_id = p_user
    AND read = false
    AND deleted_at IS NULL;

  RETURN cnt;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_mark_all_notifications_read(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Mark all unread notifications as read
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE user_id = p_user
    AND read = false
    AND deleted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_mark_notification_read(p_user uuid, p_notification uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notification_owner UUID;
BEGIN
  -- Verify ownership
  SELECT user_id INTO notification_owner
  FROM notifications
  WHERE id = p_notification;

  IF notification_owner IS NULL THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  IF notification_owner != p_user THEN
    RAISE EXCEPTION 'Not authorized to mark this notification as read';
  END IF;

  -- Mark as read
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE id = p_notification
    AND read = false; -- Only update if currently unread

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_remove_push_subscription(p_user uuid, p_device_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  subscription_owner UUID;
BEGIN
  -- Verify ownership
  SELECT user_id INTO subscription_owner
  FROM push_subscriptions
  WHERE user_id = p_user AND device_id = p_device_id;

  IF subscription_owner IS NULL THEN
    -- Subscription doesn't exist - that's okay
    RETURN true;
  END IF;

  -- Delete subscription
  DELETE FROM push_subscriptions
  WHERE user_id = p_user AND device_id = p_device_id;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_reroll_thread_identity(user_uuid uuid, post_uuid uuid)
 RETURNS TABLE(emoji text, color_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dev text;
  seed text;
  e text;
  c text;
BEGIN
  IF EXISTS (SELECT 1 FROM thread_identity_rerolls WHERE user_id = user_uuid AND post_id = post_uuid) THEN
    RAISE EXCEPTION 'Reroll already used for this thread';
  END IF;
  SELECT device_id INTO dev FROM users WHERE id = user_uuid;
  IF dev IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  seed := hash_text(dev || post_uuid::text || now()::text);
  SELECT * INTO e,c FROM derive_identity(seed);
  INSERT INTO thread_identities(user_id, post_id, emoji, color_code)
  VALUES (user_uuid, post_uuid, e, c)
  ON CONFLICT (user_id, post_id) DO UPDATE SET emoji = EXCLUDED.emoji, color_code = EXCLUDED.color_code;
  INSERT INTO thread_identity_rerolls(user_id, post_id) VALUES (user_uuid, post_uuid);
  RETURN QUERY SELECT e, c;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_save_push_subscription(p_user uuid, p_device_id text, p_endpoint text, p_keys_p256dh text, p_keys_auth text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_toggle_push_subscription(p_user uuid, p_device_id text, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  subscription_owner UUID;
BEGIN
  -- Verify ownership
  SELECT user_id INTO subscription_owner
  FROM push_subscriptions
  WHERE user_id = p_user AND device_id = p_device_id;

  IF subscription_owner IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Update enabled status
  UPDATE push_subscriptions
  SET enabled = p_enabled, updated_at = now()
  WHERE user_id = p_user AND device_id = p_device_id;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_update_subway_line(p_user uuid, p_subway_line text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_subway_color text;
BEGIN
  -- Validate subway line
  IF p_subway_line NOT IN ('1', '2', '3', '4', '5', '6', '7', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N', 'Q', 'R', 'W', 'Z') THEN
    RAISE EXCEPTION 'Invalid subway line';
  END IF;

  -- Map subway line to correct color
  v_subway_color := CASE
    WHEN p_subway_line IN ('1', '2', '3') THEN 'mta-red'
    WHEN p_subway_line IN ('4', '5', '6') THEN 'mta-dark-green'
    WHEN p_subway_line = '7' THEN 'mta-purple'
    WHEN p_subway_line IN ('A', 'C', 'E') THEN 'mta-blue'
    WHEN p_subway_line IN ('B', 'D', 'F', 'M') THEN 'mta-orange'
    WHEN p_subway_line IN ('N', 'Q', 'R', 'W') THEN 'mta-yellow'
    WHEN p_subway_line = 'G' THEN 'mta-light-green'
    WHEN p_subway_line IN ('J', 'Z') THEN 'mta-brown'
    WHEN p_subway_line = 'L' THEN 'mta-grey'
    ELSE 'mta-blue'
  END;

  -- Update user's subway line and color
  UPDATE users
  SET
    subway_line = p_subway_line,
    subway_color = v_subway_color,
    updated_at = now()
  WHERE id = p_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_vote_comment(p_user uuid, p_comment uuid, p_vote smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cnt int; BEGIN
  IF p_vote NOT IN (-1,0,1) THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  SELECT count(*) INTO cnt FROM votes WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 50 THEN RAISE EXCEPTION 'Vote rate limit exceeded'; END IF;
  IF p_vote = 0 THEN
    DELETE FROM votes WHERE user_id = p_user AND comment_id = p_comment;
  ELSE
    INSERT INTO votes(user_id, comment_id, vote_type) VALUES (p_user, p_comment, p_vote)
    ON CONFLICT (user_id, comment_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, updated_at = now();
  END IF;
END;$function$
;

CREATE OR REPLACE FUNCTION public.rpc_vote_post(p_user uuid, p_post uuid, p_vote smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cnt int; BEGIN
  IF p_vote NOT IN (-1,0,1) THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  SELECT count(*) INTO cnt FROM votes WHERE user_id = p_user AND within_last_hour(created_at);
  IF cnt >= 50 THEN RAISE EXCEPTION 'Vote rate limit exceeded'; END IF;
  IF p_vote = 0 THEN
    DELETE FROM votes WHERE user_id = p_user AND post_id = p_post;
  ELSE
    INSERT INTO votes(user_id, post_id, vote_type) VALUES (p_user, p_post, p_vote)
    ON CONFLICT (user_id, post_id) DO UPDATE SET vote_type = EXCLUDED.vote_type, updated_at = now();
  END IF;
END;$function$
;

CREATE OR REPLACE FUNCTION public.update_comment_counts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Update post comment count
        UPDATE posts
        SET comment_count = comment_count + 1, updated_at = NOW()
        WHERE id = NEW.post_id;

        -- Update parent comment reply count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE comments
            SET reply_count = reply_count + 1, updated_at = NOW()
            WHERE id = NEW.parent_id;
        END IF;

        -- Update user stats
        UPDATE users
        SET comments_created = comments_created + 1, updated_at = NOW()
        WHERE id = NEW.user_id;

        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- Update post comment count
        UPDATE posts
        SET comment_count = comment_count - 1, updated_at = NOW()
        WHERE id = OLD.post_id;

        -- Update parent comment reply count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE comments
            SET reply_count = reply_count - 1, updated_at = NOW()
            WHERE id = OLD.parent_id;
        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_content_score()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update post score
    IF NEW.post_id IS NOT NULL THEN
        UPDATE posts
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE post_id = NEW.post_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE post_id = NEW.post_id
            ), 0),
            updated_at = NOW()
        WHERE id = NEW.post_id;

        -- Auto-delete if score <= -5
        UPDATE posts
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = NEW.post_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    -- Update comment score
    IF NEW.comment_id IS NOT NULL THEN
        UPDATE comments
        SET
            score = COALESCE((
                SELECT SUM(vote_type)
                FROM votes
                WHERE comment_id = NEW.comment_id
            ), 0),
            vote_count = COALESCE((
                SELECT COUNT(*)
                FROM votes
                WHERE comment_id = NEW.comment_id
            ), 0),
            updated_at = NOW()
        WHERE id = NEW.comment_id;

        -- Auto-delete if score <= -5
        UPDATE comments
        SET deleted_at = NOW(), deletion_reason = 'auto_deleted_low_score'
        WHERE id = NEW.comment_id AND score <= -5 AND deleted_at IS NULL;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_post_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users
        SET posts_created = posts_created + 1, updated_at = NOW()
        WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_push_subscription_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_karma()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_user_id UUID;
    karma_change INTEGER;
BEGIN
    -- Determine karma change
    IF TG_OP = 'INSERT' THEN
        karma_change = NEW.vote_type;

        -- Get target user ID
        IF NEW.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = NEW.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = NEW.comment_id;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        karma_change = -OLD.vote_type;

        -- Get target user ID
        IF OLD.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = OLD.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = OLD.comment_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        karma_change = NEW.vote_type - OLD.vote_type;

        -- Get target user ID
        IF NEW.post_id IS NOT NULL THEN
            SELECT user_id INTO target_user_id FROM posts WHERE id = NEW.post_id;
        ELSE
            SELECT user_id INTO target_user_id FROM comments WHERE id = NEW.comment_id;
        END IF;
    END IF;

    -- Update user karma
    UPDATE users
    SET total_karma = total_karma + karma_change, updated_at = NOW()
    WHERE id = target_user_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.within_last_hour(ts timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ts >= (now() - interval '10 seconds')
$function$
;

CREATE TRIGGER trg_enqueue_reply_notif AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION enqueue_reply_notif();

CREATE TRIGGER send_push_notification_webhook AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://nacbcypcopzbyxgbiips.supabase.co/functions/v1/send-push-notification', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hY2JjeXBjb3B6Ynl4Z2JpaXBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkyMTc5NSwiZXhwIjoyMDc0NDk3Nzk1fQ.l7UnHG_ry6_542_ZC2hK5QMv8TyVZ363glKGAb0gdC0"}', '{}', '5000');

CREATE TRIGGER webhook_on_notification_created AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION webhook_send_push_notification();

CREATE TRIGGER trg_enqueue_milestone_notif AFTER UPDATE OF score ON public.posts FOR EACH ROW EXECUTE FUNCTION enqueue_milestone_notif();



