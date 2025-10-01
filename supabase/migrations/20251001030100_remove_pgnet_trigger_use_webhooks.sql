-- ============================================================================
-- Remove pg_net Trigger and Use Webhooks Instead
-- ============================================================================
--
-- Problem:
-- The previous migration attempted to use pg_net.http_post() to call edge
-- functions from database triggers. This works locally but is NOT supported
-- in Supabase production.
--
-- Solution:
-- Use Supabase Database Webhooks instead:
-- 1. Webhooks are fully supported in production
-- 2. Configured via Supabase Dashboard (Database → Webhooks)
-- 3. No database trigger needed - webhook fires on table events
-- 4. Edge function handles webhook payload format
--
-- This migration:
-- 1. Removes the old trigger and function that tried to use pg_net
-- 2. Documents how to configure webhooks in production
-- 3. Keeps delivery log table for monitoring
-- ============================================================================

-- 1. Drop ALL triggers that depend on the function we're removing
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;
DROP TRIGGER IF EXISTS on_notification_created ON notifications;

-- 2. Drop the old function that tried to use pg_net.http_post
DROP FUNCTION IF EXISTS trigger_send_push_notification();

-- 3. Add comment documenting the webhook approach
COMMENT ON TABLE notifications IS
'YipYap notification system - reply and milestone notifications.
Push notifications are triggered via Supabase Database Webhooks (not pg_net).
Configure webhook in Dashboard: Database → Webhooks → Create Webhook
  Table: notifications
  Events: INSERT
  URL: https://[project-ref].supabase.co/functions/v1/send-push-notification
  Headers: Authorization: Bearer [service-role-key]';

-- 4. Keep the delivery log table for monitoring
COMMENT ON TABLE push_notification_delivery_log IS
'Tracks push notification delivery for debugging and analytics.
Note: With webhooks, this table is populated by the edge function, not triggers.';

-- ============================================================================
-- WEBHOOK CONFIGURATION INSTRUCTIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Push Notification Webhook Configuration';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Database trigger removed. Push notifications now use webhooks.';
  RAISE NOTICE '';
  RAISE NOTICE 'SETUP INSTRUCTIONS FOR PRODUCTION:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Deploy the updated edge function:';
  RAISE NOTICE '   $ supabase functions deploy send-push-notification';
  RAISE NOTICE '';
  RAISE NOTICE '2. Configure webhook in Supabase Dashboard:';
  RAISE NOTICE '   a) Go to: Database → Webhooks → Create a new hook';
  RAISE NOTICE '   b) Settings:';
  RAISE NOTICE '      - Name: send-push-notification';
  RAISE NOTICE '      - Table: notifications';
  RAISE NOTICE '      - Events: ✓ Insert';
  RAISE NOTICE '      - Type: HTTP Request';
  RAISE NOTICE '      - Method: POST';
  RAISE NOTICE '      - URL: https://[project-ref].supabase.co/functions/v1/send-push-notification';
  RAISE NOTICE '   c) HTTP Headers:';
  RAISE NOTICE '      - Authorization: Bearer [service-role-key]';
  RAISE NOTICE '      - Content-Type: application/json';
  RAISE NOTICE '';
  RAISE NOTICE '3. Test the webhook:';
  RAISE NOTICE '   a) Create a test comment that triggers a notification';
  RAISE NOTICE '   b) Check webhook logs: Database → Webhooks → [Your Webhook] → Logs';
  RAISE NOTICE '   c) Check edge function logs: Edge Functions → send-push-notification';
  RAISE NOTICE '   d) Verify push notification received on device';
  RAISE NOTICE '';
  RAISE NOTICE 'LOCAL DEVELOPMENT:';
  RAISE NOTICE 'For local testing, you can call the edge function directly:';
  RAISE NOTICE '';
  RAISE NOTICE '  curl -X POST http://127.0.0.1:54321/functions/v1/send-push-notification \';
  RAISE NOTICE '    -H "Authorization: Bearer [service-role-key]" \';
  RAISE NOTICE '    -H "Content-Type: application/json" \';
  RAISE NOTICE '    -d ''{"userId":"uuid","title":"Test","body":"Test message"}''';
  RAISE NOTICE '';
  RAISE NOTICE 'Or test with webhook format:';
  RAISE NOTICE '';
  RAISE NOTICE '  curl -X POST http://127.0.0.1:54321/functions/v1/send-push-notification \';
  RAISE NOTICE '    -H "Authorization: Bearer [service-role-key]" \';
  RAISE NOTICE '    -H "Content-Type: application/json" \';
  RAISE NOTICE '    -d ''{"type":"INSERT","table":"notifications","record":{"id":"...","user_id":"...","type":"reply_to_post","actor_subway_line":"A","preview_content":"Test"}}''';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary:
-- - Removed pg_net trigger (not supported in production)
-- - Push notifications now use Supabase Database Webhooks
-- - Edge function updated to handle webhook payload format
-- - Webhook must be configured manually in Dashboard
-- - Delivery log table retained for monitoring
--
-- Production checklist:
-- [✓] Edge function supports webhook format
-- [ ] Deploy edge function to production
-- [ ] Configure webhook in Supabase Dashboard
-- [ ] Test webhook delivery
-- [ ] Monitor webhook logs
-- ============================================================================
