# Push Notification System - Implementation Summary

## Problem Solved

**Original Issue**: Supabase production doesn't support `pg_net` or direct HTTP calls from database triggers, making it impossible to trigger edge functions when database notifications are created.

**Solution**: Use **Supabase Database Webhooks** - a fully supported, production-ready feature that triggers HTTP requests when database events occur.

## Architecture

```
Database INSERT
  notifications table
         ↓
  Supabase Webhook
   (automatic trigger)
         ↓
  Edge Function
  send-push-notification
         ↓
  Fetch push subscriptions
  from database
         ↓
  Send Web Push via
  web-push library
         ↓
  User receives notification
  (even if app is closed)
```

## What Changed

### 1. Edge Function (`supabase/functions/send-push-notification/index.ts`)

**Added support for three payload formats:**

1. **Supabase Webhook** (production):
   ```json
   {
     "type": "INSERT",
     "table": "notifications",
     "record": { ... all notification fields ... }
   }
   ```

2. **Direct JSON** (testing):
   ```json
   {
     "userId": "uuid",
     "title": "Title",
     "body": "Body"
   }
   ```

3. **Query Parameters** (legacy):
   ```
   ?userId=uuid&title=Title&body=Body
   ```

**Key Features:**
- Auto-builds notification title/body from notification type
- Handles reply notifications (reply_to_post, reply_to_comment)
- Handles milestone notifications (milestone_5, milestone_10, milestone_25)
- Fetches user's push subscriptions
- Sends Web Push notifications to all devices
- Removes expired/invalid subscriptions automatically
- Full error handling and logging

### 2. Database Migration (`supabase/migrations/20251001030000_remove_pgnet_trigger_use_webhooks.sql`)

**Removed:**
- Database trigger that tried to use `pg_net.http_post()`
- Trigger function `trigger_send_push_notification()`

**Kept:**
- Notification tables and indexes
- Push subscription tables
- Delivery log table for monitoring
- All RPC functions

**Why:** `pg_net` is not available in Supabase production. Webhooks are the production-supported mechanism.

### 3. Documentation

Created comprehensive guides:
- `/docs/PUSH_NOTIFICATION_ARCHITECTURE.md` - Architectural overview
- `/docs/PUSH_NOTIFICATION_DEPLOYMENT.md` - Step-by-step deployment guide
- `/docs/PUSH_NOTIFICATION_SUMMARY.md` - This file

### 4. Testing Script

Created `/scripts/test-webhook-format.sh` to test all three payload formats.

## Deployment Steps

### Phase 1: Code Changes (No Downtime)

1. ✅ Updated edge function to handle webhook format
2. ✅ Created migration to remove pg_net trigger
3. ✅ Created deployment documentation

### Phase 2: Database Migration

```bash
# Apply migration locally
supabase db reset --yes

# Deploy to production
supabase link --project-ref [your-project-ref]
supabase db push
```

### Phase 3: Deploy Edge Function

```bash
# Deploy function
supabase functions deploy send-push-notification

# Set secrets
supabase secrets set VAPID_PUBLIC_KEY="your-public-key"
supabase secrets set VAPID_PRIVATE_KEY="your-private-key"
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

### Phase 4: Configure Webhook (Dashboard Only)

**Cannot be automated** - must be done in Supabase Dashboard:

1. Go to: **Database → Webhooks → Create a new hook**

2. Settings:
   - **Name**: `send-push-notification`
   - **Table**: `notifications`
   - **Events**: ✓ Insert only
   - **Method**: POST
   - **URL**: `https://[project-ref].supabase.co/functions/v1/send-push-notification`

3. HTTP Headers:
   - `Authorization`: `Bearer [service-role-key]`
   - `Content-Type`: `application/json`

4. Advanced:
   - **Timeout**: 5000ms
   - **Retry**: Enabled
   - **Max Retries**: 3

### Phase 5: Test End-to-End

1. Create a comment in the app (triggers notification)
2. Check webhook logs: **Database → Webhooks → Logs**
3. Check edge function logs: **Edge Functions → Logs**
4. Verify push notification received

## How It Works

### Notification Flow

1. **User creates a comment** → Triggers database `insert` on `comments` table
2. **Database trigger** (`create_reply_notification()`) → Creates record in `notifications` table
3. **Supabase webhook fires** → HTTP POST to edge function with notification data
4. **Edge function receives webhook** → Parses payload, builds notification content
5. **Edge function queries database** → Fetches user's push subscriptions
6. **Edge function sends push** → Calls Web Push API for each subscription
7. **Service worker receives push** → Displays notification on device

### Notification Types

#### Reply Notifications

**reply_to_post:**
- Title: `A Line replied to your post`
- Body: Preview of reply content

**reply_to_comment:**
- Title: `A Line replied to your comment`
- Body: Preview of reply content

#### Milestone Notifications

**milestone_5:**
- Title: `Your post is heating up!`
- Body: `Your post reached 5 upvotes`

**milestone_10:**
- Title: `Your post is popular!`
- Body: `Your post reached 10 upvotes`

**milestone_25:**
- Title: `Your post is trending!`
- Body: `Your post reached 25 upvotes`

## Advantages of Webhook Approach

✅ **Production Ready**: Webhooks are fully supported in Supabase production
✅ **No Extra Infrastructure**: Pure Supabase stack
✅ **Reliable**: Supabase handles retries automatically
✅ **Works When App Closed**: Server-side trigger
✅ **Monitoring**: Built-in webhook and edge function logs
✅ **Flexible**: Edge function can still be called directly for testing
✅ **Scalable**: Supabase handles webhook delivery at scale

## Monitoring

### Webhook Logs
**Location**: Dashboard → Database → Webhooks → send-push-notification → Logs

**Shows:**
- HTTP status codes
- Response times
- Retry attempts
- Error messages

### Edge Function Logs
**Location**: Dashboard → Edge Functions → send-push-notification → Logs

**Shows:**
- Console logs (`console.log`, `console.error`)
- Execution time
- Errors and stack traces

### Delivery Log Table
**Query**: `SELECT * FROM push_notification_delivery_log`

**Shows:**
- Per-subscription delivery status
- Success/failure
- Error messages
- Timestamp

## Cost Analysis

### Supabase Free Tier
- ✅ 500K edge function invocations/month
- ✅ Unlimited webhooks
- ✅ 500MB database

### Estimated Usage (1,000 active users)
- Users: 1,000
- Notifications per user per day: 5
- Monthly notifications: 150,000

**Result:** Well within free tier (only 30% of free edge function limit)

## Security

### Webhook Security
- ✅ HTTPS only (enforced by Supabase)
- ✅ Service role key in Authorization header (not URL)
- ✅ Edge function validates payload structure
- ✅ Only processes INSERT events on notifications table

### Push Subscription Security
- ✅ Encryption keys not exposed via RLS
- ✅ Service role required to read full subscriptions
- ✅ User can only manage their own subscriptions
- ✅ VAPID keys stored in edge function secrets

## Troubleshooting

### Webhook Not Firing
1. Check webhook is enabled in Dashboard
2. Verify table name is `notifications` (lowercase)
3. Check Authorization header has correct service role key
4. View webhook logs for errors

### Push Not Received
1. Verify user has push subscription: `SELECT * FROM push_subscriptions WHERE user_id = '...'`
2. Check browser notification permission granted
3. Check edge function logs for errors
4. Query delivery log: `SELECT * FROM push_notification_delivery_log WHERE user_id = '...'`

### Edge Function Errors
1. Check VAPID keys are set: `supabase secrets list`
2. View edge function logs for stack traces
3. Test edge function directly with curl
4. Verify Supabase service role key is valid

## Next Steps

After deployment:

1. **Monitor webhook reliability** for first few days
2. **Set up alerting** for webhook failures (if needed)
3. **Schedule cleanup jobs** for old delivery logs (`cleanup_old_delivery_logs()`)
4. **Implement user preferences** (allow users to opt out of milestone notifications)
5. **Add analytics** (track notification open rates, click-through rates)

## Files Changed

### New Files
- `/docs/PUSH_NOTIFICATION_ARCHITECTURE.md`
- `/docs/PUSH_NOTIFICATION_DEPLOYMENT.md`
- `/docs/PUSH_NOTIFICATION_SUMMARY.md`
- `/supabase/migrations/20251001030000_remove_pgnet_trigger_use_webhooks.sql`
- `/scripts/test-webhook-format.sh`
- `/scripts/test-push-webhook.sh`

### Modified Files
- `/supabase/functions/send-push-notification/index.ts`
  - Added webhook payload parsing
  - Added notification content builder
  - Added support for all notification types

## Success Criteria

- ✅ Edge function handles webhook format
- ✅ Migration removes pg_net dependency
- ✅ Documentation complete
- [ ] Migration applied to production
- [ ] Edge function deployed
- [ ] Webhook configured in Dashboard
- [ ] End-to-end test successful
- [ ] Push notification received on device

## Conclusion

The push notification system is now production-ready using Supabase Database Webhooks. This solution:

- **Works in production** (no pg_net dependency)
- **Requires no additional infrastructure**
- **Is reliable and scalable**
- **Provides full monitoring**
- **Is secure and maintainable**

The only manual step is configuring the webhook in the Supabase Dashboard, which takes ~2 minutes.
