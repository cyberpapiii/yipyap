# Push Notification Deployment Guide

## Overview

This guide walks you through deploying push notifications to production using Supabase Database Webhooks.

## Architecture

```
User creates comment
    ↓
Database trigger creates notification record
    ↓
Supabase Webhook fires (automatic)
    ↓
Edge Function receives webhook payload
    ↓
Edge Function fetches push subscriptions
    ↓
Edge Function sends Web Push notifications
    ↓
User receives push notification (even if app is closed)
```

## Prerequisites

- ✅ Supabase project deployed to production
- ✅ Edge function code updated to handle webhooks
- ✅ VAPID keys generated and configured
- ✅ At least one user with a valid push subscription

## Step 1: Apply Database Migrations

### Local Testing

```bash
# Start local Supabase
supabase start

# Apply latest migrations
supabase db reset --yes

# Verify migrations applied
supabase db diff
```

### Production Deployment

```bash
# Link to your production project (if not already linked)
supabase link --project-ref [your-project-ref]

# Push migrations to production
supabase db push

# Verify migrations
supabase db remote list
```

## Step 2: Deploy Edge Function

### Deploy to Production

```bash
# Deploy the send-push-notification function
supabase functions deploy send-push-notification

# Verify deployment
supabase functions list
```

### Set Edge Function Secrets

The edge function needs VAPID keys to send push notifications.

```bash
# Set VAPID public key
supabase secrets set VAPID_PUBLIC_KEY="your-vapid-public-key"

# Set VAPID private key
supabase secrets set VAPID_PRIVATE_KEY="your-vapid-private-key"

# Set VAPID subject (your contact email or website)
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

**Generate VAPID keys** (if you haven't already):

```bash
# Using Node.js web-push library
npx web-push generate-vapid-keys

# Copy the output:
# Public Key: BN...
# Private Key: ...
```

### Verify Function Works

Test the deployed function with a direct API call:

```bash
# Get your service role key from Supabase Dashboard
# Settings → API → service_role key

curl -X POST https://[your-project-ref].supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "[test-user-uuid]",
    "title": "Test Notification",
    "body": "This is a test push notification"
  }'
```

Expected response:
```json
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "total": 1
}
```

## Step 3: Configure Database Webhook

### Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Database → Webhooks**

### Create New Webhook

Click **"Create a new hook"** and configure:

#### Basic Settings
- **Name**: `send-push-notification`
- **Table**: `notifications`
- **Events**: Check only **Insert** ✓
- **Type**: HTTP Request

#### HTTP Request Settings
- **Method**: POST
- **URL**: `https://[your-project-ref].supabase.co/functions/v1/send-push-notification`

#### HTTP Headers

Add these headers:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer [service-role-key]` |
| `Content-Type` | `application/json` |

**Important**: Replace `[service-role-key]` with your actual service role key from **Settings → API → service_role key**

#### Advanced Settings (Optional)

- **Timeout**: 5000ms (5 seconds)
- **Retry Logic**: Enable retries
- **Max Retries**: 3

### Test the Webhook

1. Click **"Send test event"** in the webhook configuration
2. Check the **Logs** tab to see if the webhook fired successfully
3. Look for HTTP 200 response

## Step 4: End-to-End Testing

### Test in Production

1. **Create a test comment** that triggers a notification:
   - Open your YipYap app in production
   - Make sure you're subscribed to push notifications
   - Create a post
   - Reply to that post from a different device/browser
   - Check if push notification is received

2. **Monitor webhook logs**:
   - Dashboard → Database → Webhooks → `send-push-notification` → Logs
   - Look for successful webhook deliveries (HTTP 200)

3. **Monitor edge function logs**:
   - Dashboard → Edge Functions → `send-push-notification` → Logs
   - Look for `[SendPush] Received Supabase webhook`
   - Check for successful push delivery logs

4. **Check delivery logs in database**:
   ```sql
   SELECT * FROM push_notification_delivery_log
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## Step 5: Monitoring & Debugging

### Webhook Not Firing

**Check webhook configuration:**
- Verify table name is `notifications` (lowercase)
- Verify event is `INSERT` only
- Check URL has correct project ref
- Verify Authorization header includes service role key

**Check webhook logs:**
- Dashboard → Database → Webhooks → Logs
- Look for errors or failed deliveries

### Edge Function Errors

**Check edge function logs:**
- Dashboard → Edge Functions → `send-push-notification` → Logs
- Look for JavaScript errors or exceptions

**Common issues:**
- Missing VAPID keys (check secrets)
- Invalid user_id (user doesn't exist)
- No push subscriptions (user not subscribed)

### Push Notification Not Received

**Verify push subscription:**
```sql
SELECT * FROM push_subscriptions
WHERE user_id = '[user-uuid]'
  AND enabled = true;
```

**Check browser console:**
- Open browser DevTools
- Check for service worker errors
- Verify push subscription is registered

**Check device settings:**
- Browser notification permission granted
- System notification settings enabled
- No "Do Not Disturb" mode

## Webhook Payload Reference

The webhook sends this payload to your edge function:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "schema": "public",
  "record": {
    "id": "uuid",
    "user_id": "uuid",
    "post_id": "uuid",
    "comment_id": "uuid",
    "type": "reply_to_post",
    "actor_user_id": "uuid",
    "actor_subway_line": "A",
    "actor_subway_color": "mta-blue",
    "preview_content": "Reply content...",
    "created_at": "2025-10-01T12:00:00Z",
    "read": false,
    "read_at": null,
    "deleted_at": null
  },
  "old_record": null
}
```

## Security Considerations

### Webhook Security

- ✅ Service role key in Authorization header (not in URL)
- ✅ HTTPS only (enforced by Supabase)
- ✅ Edge function validates payload structure
- ✅ Edge function only processes INSERT events on notifications table

### Edge Function Security

- ✅ Service role key stored in secrets (not environment variables)
- ✅ VAPID keys stored in secrets
- ✅ User ID validation (user must exist)
- ✅ Push subscription validation (only enabled subscriptions)
- ✅ Rate limiting (handled by Supabase)

### Database Security

- ✅ RLS enabled on all tables
- ✅ Push subscription keys not exposed via RLS
- ✅ Notifications created via triggers (not user input)

## Cost Considerations

### Supabase Costs

| Resource | Free Tier | Pro Tier |
|----------|-----------|----------|
| Edge Functions | 500K invocations/month | 2M invocations/month |
| Database | 500MB | 8GB |
| Webhooks | Unlimited | Unlimited |

### Scaling Estimates

**Assumptions:**
- 1,000 active users
- Each user receives 5 notifications/day
- 30 days/month

**Calculations:**
- 1,000 users × 5 notifications × 30 days = **150,000 notifications/month**
- 150,000 webhook calls = 150,000 edge function invocations
- Well within free tier (500K invocations)

## Rollback Plan

If you need to disable push notifications:

### Disable Webhook

1. Dashboard → Database → Webhooks
2. Find `send-push-notification` webhook
3. Click **"Disable"** (or delete)

### Rollback Migration

```bash
# This won't affect existing notifications, just removes webhook support
supabase db reset

# Or manually drop the migration
supabase db remote execute "
  DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;
  DROP FUNCTION IF EXISTS trigger_send_push_notification();
"
```

## Success Checklist

- [ ] Migrations applied to production
- [ ] Edge function deployed
- [ ] VAPID keys configured as secrets
- [ ] Webhook configured in Dashboard
- [ ] Test notification sent successfully
- [ ] Webhook logs show HTTP 200
- [ ] Edge function logs show successful execution
- [ ] Push notification received on device
- [ ] Monitoring set up (webhook logs, edge function logs, delivery log table)

## Troubleshooting Commands

```bash
# Check edge function deployment
supabase functions list

# View edge function logs
supabase functions logs send-push-notification

# Test edge function directly
curl -X POST https://[project-ref].supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{"userId":"[uuid]","title":"Test","body":"Test"}'

# Check database webhook configuration
# (Must be done in Dashboard, no CLI command available)
```

## Support

If you encounter issues:

1. Check Supabase Dashboard logs (Webhooks and Edge Functions)
2. Check browser console for client-side errors
3. Query `push_notification_delivery_log` table for delivery failures
4. Review this deployment guide again
5. Check Supabase Discord or GitHub Discussions

## Next Steps

After successful deployment:

1. **Monitor webhook reliability** for the first few days
2. **Set up alerting** for webhook failures
3. **Schedule cleanup jobs** for old delivery logs
4. **Implement user notification preferences** (opt-out for milestones)
5. **Add notification analytics** (open rates, click-through rates)
