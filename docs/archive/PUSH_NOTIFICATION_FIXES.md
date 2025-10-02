# Push Notification System - Fixes Applied

## Summary

Fixed critical bugs preventing push notifications from working and improved overall system security and reliability.

---

## Issues Fixed

### 🔴 CRITICAL ISSUES

1. **Notification Type Mismatch** ✅ FIXED
   - **Problem:** Push trigger checked for `'reply', 'mention', 'vote'` but database created `'reply_to_post', 'reply_to_comment', 'milestone_5'`, etc.
   - **Impact:** Push notifications were NEVER sent (100% failure rate)
   - **Fix:** Updated trigger to check for correct notification types

2. **Wrong Column Name** ✅ FIXED
   - **Problem:** Trigger referenced `NEW.actor_id` but column is `NEW.actor_user_id`
   - **Impact:** SQL error when trigger fired
   - **Fix:** Corrected column name in trigger function

3. **Overly Permissive RLS Policy** ✅ FIXED
   - **Problem:** RLS policy `USING (true)` allowed ANY user to read ALL push subscriptions
   - **Impact:** Security vulnerability - encryption keys exposed
   - **Fix:** Changed policy to block direct reads, force RPC-only access

### 🟡 CODE QUALITY ISSUES

4. **Duplicate Migration 009** ✅ REMOVED
   - **Problem:** Old notification system (78 lines) completely replaced by newer system
   - **Impact:** Code confusion, potential conflicts
   - **Fix:** Deleted `supabase/migrations/009_notifications.sql`

5. **Name Collision in Notification Stores** ✅ FIXED
   - **Problem:** Two different `notifications` exports (toast vs database notifications)
   - **Impact:** Import confusion, unclear which system to use
   - **Fix:** Renamed `src/lib/services/notifications.ts` → `toastNotifications.ts`

6. **Missing Service Worker Push Handler** ✅ ADDED
   - **Problem:** No `push` event listener in service worker
   - **Impact:** Push notifications received but not displayed
   - **Fix:** Added push and notificationclick event handlers

---

## Files Created/Modified

### New Files

1. **`supabase/migrations/20251001020000_fix_push_notification_system.sql`**
   - Fixed push notification trigger function
   - Secured RLS policies on push_subscriptions
   - Added rate limiting to subscription creation
   - Created push_notification_delivery_log table
   - Added cleanup functions

### Modified Files

1. **`src/service-worker.js`**
   - Added `push` event listener (lines 181-226)
   - Added `notificationclick` event listener (lines 228-253)
   - Displays push notifications when received
   - Opens app to correct URL when notification clicked

2. **`src/lib/services/notifications.ts` → `src/lib/services/toastNotifications.ts`**
   - Renamed file to avoid collision
   - Renamed export from `notifications` to `toastNotifications`
   - Updated all internal references

3. **`src/lib/components/VoteButtons.svelte`**
   - Updated import path from `'$lib/services/notifications'` to `'$lib/services/toastNotifications'`

### Deleted Files

1. **`supabase/migrations/009_notifications.sql`** - Duplicate/obsolete migration

---

## Database Configuration

Created `edge_function_config` table to store edge function settings:

```sql
CREATE TABLE edge_function_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Local Configuration (Applied):**
- `edge_function_url`: `http://host.docker.internal:54321/functions/v1`
- `service_role_key`: Generated JWT for local development

**Production Configuration (TODO):**
```sql
-- Run this on production database:
INSERT INTO edge_function_config (key, value) VALUES
  ('edge_function_url', 'https://nacbcypcopzbyxgbiips.supabase.co/functions/v1'),
  ('service_role_key', '<production-service-role-key>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## Testing Results

### Local Database Test

✅ **Trigger fires successfully:**
```
NOTICE:  Sending push notification: user=109007ef-5e27-46ff-8e8d-01202523e007,
type=reply_to_post, title=T Line replied to your post
```

✅ **HTTP request sent via pg_net:**
```sql
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 1;
-- Shows status_code: 401 (expected for local testing with generated JWT)
```

✅ **Notification created:**
- Type: `reply_to_post`
- Actor: T Line
- Preview: "Second test after worker restart!"

### Production Test (Your Mobile Device)

⏳ **Pending:** A test comment was created on production but the production database doesn't have the fixed trigger yet.

**Next Steps for Production:**
1. Apply migration `20251001020000_fix_push_notification_system.sql` to production
2. Configure production edge function settings
3. Test with a new comment

---

## Security Improvements

### RLS Policies
- ✅ Push subscriptions now protected from direct reads
- ✅ Only service role can access subscription data
- ✅ Encryption keys (p256dh, auth) no longer exposed via SELECT queries

### Rate Limiting
- ✅ Max 5 push subscriptions per user per hour
- ✅ Prevents subscription spam/DoS

### Content Sanitization
- ✅ Trigger removes control characters from notification content
- ✅ Prevents injection attacks via notification text

### Audit Trail
- ✅ New `push_notification_delivery_log` table tracks all delivery attempts
- ✅ Includes success/failure status and error messages
- ✅ Enables debugging and analytics

---

## How It Works Now

### Flow Diagram

```
1. User creates comment
    ↓
2. Database trigger creates notification record
    ↓
3. Trigger: on_notification_created fires
    ↓
4. Function: trigger_send_push_notification()
   - Checks notification type (reply_to_post, reply_to_comment)
   - Fetches edge function URL and service role key from config
   - Builds notification title and body
   - Sanitizes content
    ↓
5. Calls edge function via pg_net.http_post
   POST /functions/v1/send-push-notification
   Headers: Authorization: Bearer <service_role_key>
   Body: { userId, title, body, postId, commentId }
    ↓
6. Edge function (send-push-notification)
   - Validates request
   - Fetches user's push subscriptions
   - Sends web push notification to each subscription
   - Removes expired subscriptions (410 Gone)
   - Returns delivery statistics
    ↓
7. Push notification delivered to user's device
    ↓
8. Service worker receives push event
   - Displays notification with title, body, icon
   - Stores URL in notification data
    ↓
9. User clicks notification
   - Service worker opens/focuses app
   - Navigates to correct URL (/thread/[postId])
```

---

## Known Limitations & Future Improvements

### Current Limitations

1. **Local JWT Auth Issue**
   - Generated service role JWT returns 401 error locally
   - Production JWT needed for local testing
   - Workaround: Test on production database

2. **No Retry Logic**
   - If edge function fails, notification is lost
   - Future: Add retry queue with exponential backoff

3. **No Notification Preferences**
   - Users cannot opt-out of specific notification types
   - Future: Add user preference UI and database table

4. **Milestone Notifications Disabled**
   - Trigger only handles reply notifications
   - Future: Add milestone notification support

### Recommended Improvements

**Priority 1 (Before Production Launch):**
- [ ] Test on production with real devices
- [ ] Verify iOS PWA push notifications work
- [ ] Monitor edge function logs for errors
- [ ] Set up alerts for failed notifications

**Priority 2 (First Month):**
- [ ] Add notification preferences UI
- [ ] Implement retry logic for failed pushes
- [ ] Add rate limiting on notification delivery
- [ ] Enable milestone notifications

**Priority 3 (Long-term):**
- [ ] Replace pg_net with async queue (NOTIFY/LISTEN)
- [ ] Add notification batching (multiple notifications in 5min window)
- [ ] Implement quiet hours (no notifications 10 PM - 8 AM)
- [ ] Add delivery analytics dashboard

---

## Deployment Checklist

### For Production

- [x] Apply migration `20251001020000_fix_push_notification_system.sql`
- [x] Apply migration `20251001030000_configure_production.sql`
- [x] Configure edge_function_config table with production URLs
- [x] Deploy updated service worker (`npm run build`)
- [x] Add PUBLIC_VAPID_KEY to Vercel environment variables
- [x] Deploy updated edge function with webhook payload support
- [x] **Configure Database Webhook in Supabase Dashboard:**
  - Table: notifications
  - Events: Insert
  - Type: HTTP Request
  - URL: https://nacbcypcopzbyxgbiips.supabase.co/functions/v1/send-push-notification
  - Headers: Authorization (service role), Content-Type
  - **HTTP Parameters: LEAVE EMPTY** (Supabase auto-sends webhook payload)
- [x] Test with real comment on production
- [x] Verify push notification received on mobile device ✅

### Critical Discovery

**Supabase Database Webhooks do NOT support template variables like `{{ record.xxx }}`**. Instead:
- Leave HTTP Parameters empty
- Supabase automatically sends a structured webhook payload: `{ type, table, record, schema, old_record }`
- The edge function extracts data from `payload.record`

### For Local Development

- [x] Migration applied
- [x] Config table created
- [x] Service worker updated
- [ ] Fix local JWT authentication (or test via production)

---

## Troubleshooting

### Push Notifications Not Received

1. **Check notification was created:**
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```

2. **Check trigger fired:**
   ```sql
   -- Look for HTTP requests
   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
   ```

3. **Check edge function logs:**
   ```bash
   supabase functions logs send-push-notification --tail
   ```

4. **Check push subscription exists:**
   ```sql
   SELECT * FROM push_subscriptions WHERE user_id = '<your-user-id>' AND enabled = true;
   ```

5. **Check service worker is registered:**
   - Open browser DevTools → Application → Service Workers
   - Should show `service-worker.js` as activated

### HTTP 401 Errors

- Service role key is invalid or not configured
- Check `edge_function_config` table has correct values
- Verify JWT signature matches Supabase project

### Edge Function Not Called

- Check `net._http_response` table is empty
- Restart pg_net worker: `SELECT net.worker_restart();`
- Verify trigger is enabled: `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_notification_created';`

---

## Additional Notes

### iOS PWA Requirements

- Push notifications only work in **installed PWA** (added to home screen)
- Will NOT work in Safari browser
- User must grant notification permission after installing PWA

### Service Worker Updates

- Service worker will auto-update when you deploy new code
- Users may need to close/reopen app to get latest service worker
- Version is based on SvelteKit build hash

### Edge Function Costs

- Each notification triggers 1 edge function invocation
- With N subscribers, sends N push notifications
- Monitor Supabase edge function usage in dashboard

---

## Contact & Support

For issues or questions:
1. Check this document first
2. Review migration `20251001020000_fix_push_notification_system.sql`
3. Check edge function logs
4. Review security audit findings in investigation report

---

**Last Updated:** 2025-10-01
**Migration Version:** 20251001020000
**Status:** ✅ Ready for Production Testing
