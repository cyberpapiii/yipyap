# Push Notifications Deployment Guide

This guide covers deploying and configuring the YipYap push notification system.

## Prerequisites

- Supabase CLI installed
- Local Supabase running (`supabase start`)
- VAPID keys generated (already in `.env`)

## Architecture Overview

1. **Service Worker** (`/static/service-worker.js`) - Handles push events and displays notifications
2. **Push Service** (`/src/lib/services/pushNotifications.ts`) - Client-side API for subscribing/unsubscribing
3. **UI Component** (`/src/lib/components/PushNotificationToggle.svelte`) - User interface for enabling notifications
4. **Database** (`push_subscriptions` table) - Stores push subscription data
5. **Edge Function** (`/supabase/functions/send-push-notification`) - Sends push notifications via Web Push API
6. **Database Trigger** - Automatically calls Edge Function when notifications are created

## Local Development Setup

### 1. Apply Database Migrations

```bash
# Apply push subscriptions table and RPCs
supabase db reset --yes

# This will run:
# - 20251001000000_push_subscriptions.sql
# - 20251001010000_push_notification_trigger.sql
```

### 2. Deploy Edge Function Locally

```bash
# Deploy the send-push-notification function
supabase functions deploy send-push-notification --no-verify-jwt
```

### 3. Set Edge Function Secrets

You need to set the VAPID keys as Supabase secrets:

```bash
# Set VAPID public key
supabase secrets set VAPID_PUBLIC_KEY="BMoATi0MHeTaaX1SOEuz7D-b-xGsXD-4F5o4gBaO_ouXkObKSjcEpqWCLW6jUBEXZ1ZNWAjyEMym4XYcxJ-hgSU"

# Set VAPID private key
supabase secrets set VAPID_PRIVATE_KEY="RP5xAWEcm4imTRjsiOVEVMYo6_nXJnPViEFLJh0_rV4"

# Set VAPID subject (your email)
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

### 4. Configure Database Settings for Trigger

The trigger needs to know the Edge Function URL. For local development:

```bash
# Connect to your local database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

# Set configuration
ALTER DATABASE postgres SET app.settings.edge_function_url = 'http://host.docker.internal:54321/functions/v1';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';
```

To get your service role key:

```bash
supabase status
# Look for "service_role key" in the output
```

### 5. Enable pg_net Extension

The trigger uses `pg_net` to make HTTP requests:

```bash
# Connect to database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

# Enable extension (should already be enabled by migration)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

## Production Deployment

### 1. Push to Supabase Project

```bash
# Link to your Supabase project (first time only)
supabase link --project-ref your-project-ref

# Push database migrations
supabase db push

# Deploy Edge Function
supabase functions deploy send-push-notification

# Set production secrets
supabase secrets set VAPID_PUBLIC_KEY="your-production-public-key"
supabase secrets set VAPID_PRIVATE_KEY="your-production-private-key"
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

### 2. Configure Production Database

```bash
# Connect to production database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Set Edge Function URL for production
ALTER DATABASE postgres SET app.settings.edge_function_url = 'https://[YOUR-PROJECT-REF].supabase.co/functions/v1';

# Set service role key
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-production-service-role-key';
```

### 3. Update Environment Variables

Update your production `.env` with production VAPID public key:

```ini
PUBLIC_VAPID_KEY=your-production-public-key
```

## Testing the Implementation

### 1. Manual Testing via UI

1. Navigate to `/notifications` page
2. Click the Push Notifications toggle
3. Grant permission when prompted
4. Have another user reply to your post
5. You should receive a push notification

### 2. Test Edge Function Directly

```bash
# Test the Edge Function directly
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push-notification' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "your-user-uuid",
    "title": "Test Notification",
    "body": "This is a test push notification",
    "postId": "some-post-uuid"
  }'
```

### 3. Test Service Worker

1. Open DevTools → Application → Service Workers
2. Verify service worker is active
3. Open DevTools → Console
4. Test notification manually:

```javascript
// Request notification permission
Notification.requestPermission().then(permission => {
  console.log('Permission:', permission)
})

// Get current subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(sub => {
    console.log('Current subscription:', sub)
  })
})

// Test notification display
new Notification('Test', {
  body: 'This is a test notification',
  icon: '/icon-192.png'
})
```

### 4. Test Database Trigger

Insert a test notification directly to verify the trigger fires:

```sql
-- Connect to database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

-- Insert test notification (replace UUIDs with real ones)
INSERT INTO notifications (user_id, actor_id, type, post_id, read)
VALUES (
  'your-user-uuid',
  'actor-user-uuid',
  'reply',
  'some-post-uuid',
  false
);

-- Check if trigger fired (check Edge Function logs)
-- You can also check the net._http_response table for pg_net responses
SELECT * FROM net._http_response ORDER BY created_at DESC LIMIT 5;
```

## Troubleshooting

### No Notifications Received

1. **Check Service Worker**
   - Open DevTools → Application → Service Workers
   - Verify "service-worker.js" is active
   - Check for errors in Console

2. **Check Subscription**
   - Open DevTools → Console
   - Run: `navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription().then(console.log))`
   - Should show subscription object, not null

3. **Check Database**
   ```sql
   -- Verify subscription is saved
   SELECT * FROM push_subscriptions WHERE user_id = 'your-user-uuid';
   ```

4. **Check Edge Function Logs**
   ```bash
   # View Edge Function logs
   supabase functions logs send-push-notification --tail
   ```

5. **Check Trigger Execution**
   ```sql
   -- Check pg_net responses
   SELECT * FROM net._http_response ORDER BY created_at DESC LIMIT 10;
   ```

### Permission Denied

- User has blocked notifications in browser settings
- Instruct user to:
  1. Click lock icon in address bar
  2. Click "Site settings"
  3. Change "Notifications" to "Allow"
  4. Refresh page and try again

### iOS Not Working

- Push notifications on iOS require PWA standalone mode
- User must "Add to Home Screen" first
- iOS Safari (browser) does not support push notifications

### VAPID Key Errors

```bash
# Regenerate VAPID keys if needed
npm install -g web-push
web-push generate-vapid-keys

# Update .env and Supabase secrets with new keys
```

## Monitoring

### Check Subscription Health

```sql
-- Count active subscriptions
SELECT COUNT(*) FROM push_subscriptions WHERE enabled = true;

-- Subscriptions by user
SELECT user_id, COUNT(*) as device_count
FROM push_subscriptions
WHERE enabled = true
GROUP BY user_id;

-- Recent subscriptions
SELECT * FROM push_subscriptions
ORDER BY created_at DESC
LIMIT 10;
```

### Check Notification Delivery

```sql
-- Recent pg_net HTTP calls
SELECT
  id,
  created_at,
  status_code,
  content,
  error_msg
FROM net._http_response
ORDER BY created_at DESC
LIMIT 20;
```

### Edge Function Metrics

```bash
# View Edge Function logs with filters
supabase functions logs send-push-notification --filter "status=200"
supabase functions logs send-push-notification --filter "level=error"
```

## Performance Considerations

1. **Rate Limiting**: The trigger fires on every notification insert. Consider batching for high-volume scenarios.

2. **Subscription Cleanup**: Failed subscriptions (410 Gone) are automatically removed by the Edge Function.

3. **TTL**: Push notifications have a 24-hour TTL. Offline devices will receive notifications when they come online (within 24h).

4. **Payload Size**: Keep notification content concise. Maximum payload is ~4KB.

## Security Notes

1. **VAPID Keys**: Keep private key secure. Never expose in client-side code.

2. **Service Role Key**: Used by Edge Function to bypass RLS. Never expose publicly.

3. **Subscription Endpoint**: Each subscription has a unique endpoint. Don't share endpoints between users.

4. **RLS Policies**: `push_subscriptions` table is protected by RLS. Users can only access their own subscriptions.

## Next Steps

1. Add notification preferences (e.g., "only replies", "all activity")
2. Add quiet hours (don't send notifications during specific times)
3. Add notification grouping (batch multiple notifications)
4. Add notification action buttons ("Reply", "View Thread")
5. Add notification analytics (delivery rate, click-through rate)
