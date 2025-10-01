# Send Push Notification Edge Function

Supabase Edge Function for sending Web Push notifications to YipYap users.

## Overview

This Edge Function is triggered automatically by **Supabase Database Webhooks** when new notifications are created. It fetches push subscriptions for the target user and sends Web Push notifications to all their registered devices.

**Architecture**: Database INSERT → Webhook → Edge Function → Web Push API → User's Device

## Deployment

```bash
# Deploy function
supabase functions deploy send-push-notification --no-verify-jwt

# Set required secrets
supabase secrets set VAPID_PUBLIC_KEY="your-public-key"
supabase secrets set VAPID_PRIVATE_KEY="your-private-key"
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

## Environment Variables (Secrets)

Required secrets (set via `supabase secrets set`):

- `VAPID_PUBLIC_KEY` - VAPID public key for Web Push
- `VAPID_PRIVATE_KEY` - VAPID private key for Web Push (keep secure!)
- `VAPID_SUBJECT` - Contact email for VAPID (optional, defaults to mailto:notifications@yipyap.app)

Automatically available:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

## Input Formats

The function accepts three payload formats:

### 1. Supabase Webhook (Production)

Automatically sent by Supabase webhook on notification INSERT:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "record": {
    "id": "uuid",
    "user_id": "uuid",
    "type": "reply_to_post | reply_to_comment | milestone_*",
    "actor_subway_line": "A",
    "preview_content": "Reply text...",
    "post_id": "uuid",
    "comment_id": "uuid"
  }
}
```

### 2. Direct JSON (Testing)

For manual testing and development:

```json
{
  "userId": "uuid",
  "title": "string",
  "body": "string",
  "postId": "uuid (optional)",
  "commentId": "uuid (optional)",
  "notificationId": "uuid (optional)"
}
```

### 3. Query Parameters (Legacy)

```
?userId=uuid&title=Title&body=Body&postId=uuid
```

**Response:**

```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "total": 2
}
```

**Error Response:**

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Usage

### Manual Testing

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push-notification' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "user-uuid",
    "title": "Test Notification",
    "body": "This is a test",
    "postId": "post-uuid"
  }'
```

### From Database Webhook

The function is automatically called by Supabase Database Webhook when notifications are inserted. Configure webhook in Dashboard: Database → Webhooks → Create webhook on `notifications` table.

### From Application Code

```typescript
import { supabase } from '$lib/supabase'

const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: user.id,
    title: 'New Reply',
    body: 'Someone replied to your post',
    postId: post.id
  }
})
```

## Features

- **Multi-device Support**: Sends to all registered devices for a user
- **Automatic Cleanup**: Removes expired subscriptions (410 Gone, 404 Not Found)
- **Error Handling**: Gracefully handles failures, logs errors
- **CORS Support**: Allows cross-origin requests for testing
- **Delivery Stats**: Returns count of successful/failed deliveries
- **iOS Support**: Works with iOS PWA push notifications

## Notification Format

The function sends notifications in this format:

```json
{
  "title": "Notification title",
  "body": "Notification body text",
  "data": {
    "url": "/thread/post-id",
    "postId": "uuid",
    "commentId": "uuid",
    "notificationId": "uuid"
  },
  "icon": "/icon-192.png",
  "badge": "/badge-96.png",
  "tag": "yipyap-timestamp",
  "timestamp": 1234567890
}
```

## Error Codes

- `400` - Missing required fields
- `500` - Server configuration error (VAPID keys not set)
- `500` - Database error fetching subscriptions
- `500` - Unexpected error

## Logs

View function logs:

```bash
# Tail all logs
supabase functions logs send-push-notification --tail

# View recent logs
supabase functions logs send-push-notification

# Filter by status
supabase functions logs send-push-notification --filter "status=200"
```

## Dependencies

- `@supabase/supabase-js@2.39.7` - Supabase client
- `web-push@3.6.7` - Web Push library for sending notifications

## Security

- Uses service role key to bypass RLS (required to read all subscriptions)
- VAPID private key stored securely in Supabase secrets
- Validates required fields before processing
- Removes invalid subscriptions automatically

## Performance

- **Cold start**: ~100ms
- **Warm execution**: ~10-50ms per request
- **Parallel sending**: Sends to all devices concurrently
- **Automatic retries**: Web Push library handles retries

## Monitoring

### Check Recent Invocations

```bash
supabase functions logs send-push-notification --limit 50
```

### Check Error Rate

```bash
supabase functions logs send-push-notification --filter "level=error"
```

### Database Metrics

```sql
-- Check pg_net responses (if called via trigger)
SELECT * FROM net._http_response
WHERE url LIKE '%send-push-notification%'
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### "VAPID keys not configured"

Set the secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY="your-key"
supabase secrets set VAPID_PRIVATE_KEY="your-key"
```

### "No subscriptions found"

User hasn't enabled push notifications. Check:

```sql
SELECT * FROM push_subscriptions WHERE user_id = 'uuid';
```

### "Failed to send to subscription"

- Check if subscription is expired (automatically removed)
- Verify VAPID keys are correct
- Check device is online and accessible

### Logs show errors

```bash
# View detailed error logs
supabase functions logs send-push-notification --filter "level=error" --limit 100
```

## Development

### Local Testing

1. Start Supabase: `supabase start`
2. Deploy function: `supabase functions deploy send-push-notification --no-verify-jwt`
3. Set secrets (see above)
4. Test via curl or database trigger

### Updating

```bash
# Make changes to index.ts
# Redeploy
supabase functions deploy send-push-notification --no-verify-jwt
```

## Related Files

- **Service Worker**: `/static/service-worker.js` - Receives push events
- **Client Service**: `/src/lib/services/pushNotifications.ts` - Subscribe/unsubscribe API
- **UI Component**: `/src/lib/components/PushNotificationToggle.svelte` - User toggle
- **Database Trigger**: `/supabase/migrations/20251001010000_push_notification_trigger.sql` - Auto-invokes function
- **Migration**: `/supabase/migrations/20251001000000_push_subscriptions.sql` - Database schema

## Documentation

- **Quick Start**: `/docs/push-notifications-quick-start.md`
- **Deployment**: `/docs/push-notifications-deployment.md`
- **Summary**: `/docs/push-notifications-summary.md`
