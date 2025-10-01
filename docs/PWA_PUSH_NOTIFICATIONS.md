# YipYap PWA & Push Notifications Implementation Guide

Complete guide for Progressive Web App (PWA) functionality and Web Push Notifications in YipYap.

## Table of Contents

1. [Overview](#overview)
2. [PWA Features](#pwa-features)
3. [Push Notifications](#push-notifications)
4. [Setup & Configuration](#setup--configuration)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Overview

YipYap is now a full-featured Progressive Web App with Web Push Notifications support for:

- **iOS Safari** (when installed as PWA via "Add to Home Screen")
- **Android Chrome** (when installed as PWA)
- **Desktop browsers** (Chrome, Edge, Firefox, Safari 16+)

### Key Features

- Installable app with offline support
- Background push notifications
- Notification badge on app icon
- Thread navigation from notifications
- Optimistic caching for performance

---

## PWA Features

### Manifest Configuration

**File:** `/static/manifest.json`

The PWA manifest defines how YipYap appears when installed:

```json
{
  "name": "YipYap",
  "short_name": "YipYap",
  "display": "standalone",
  "theme_color": "#101010",
  "icons": [...]
}
```

**Key properties:**
- `display: standalone` - Runs as a standalone app (no browser UI)
- `gcm_sender_id` - Required for Chrome push notifications
- `shortcuts` - App shortcuts for Hot, New, and Notifications

### Service Worker

**File:** `/static/service-worker.js`

The service worker provides:
- Offline caching (app shell, images, data)
- Push notification handling
- Background sync for offline actions
- Automatic cache cleanup

**Caching strategies:**
- **Cache First**: Static assets, images (24hr TTL)
- **Network First**: API data, navigation
- **Stale While Revalidate**: Frequently updated content

### Installation Flow

**Desktop:**
1. Visit YipYap in Chrome/Edge
2. Click install icon in address bar
3. Click "Install" in prompt

**Android:**
1. Visit YipYap in Chrome
2. Tap "Add to Home Screen" in menu
3. Tap "Install" in prompt

**iOS:**
1. Visit YipYap in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Tap "Add" in top-right

---

## Push Notifications

### Architecture

YipYap uses **Web Push API** with VAPID authentication for secure, serverless push notifications.

#### Flow:

```
User Action → Trigger → Database → Edge Function → Push Service → Device
```

1. **User subscribes** - Requests notification permission, saves subscription
2. **Event occurs** - Comment reply or post milestone
3. **Database trigger** - Creates notification record
4. **Edge function** - Sends push via Web Push API
5. **Service worker** - Receives and displays notification
6. **User clicks** - Opens thread in app

### Notification Types

YipYap sends notifications for:

1. **Reply to Post** - Someone replies to your post
2. **Reply to Comment** - Someone replies to your comment
3. **Milestone 5** - Your post reached 5 upvotes
4. **Milestone 10** - Your post reached 10 upvotes
5. **Milestone 25** - Your post reached 25 upvotes

### Notification Data Structure

```typescript
{
  title: "A Line replied to your post",
  body: "Preview of reply content...",
  postId: "uuid",
  commentId: "uuid",
  notificationId: "uuid",
  url: "/thread/uuid"
}
```

### Database Schema

**Table:** `push_subscriptions`

Stores user push subscriptions with encryption keys:

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,  -- Encryption public key
  keys_auth TEXT NOT NULL,     -- Auth secret
  user_agent TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, device_id)
);
```

**Table:** `notifications`

Stores notification history and read state:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  comment_id UUID REFERENCES comments(id),
  type TEXT NOT NULL,  -- 'reply_to_post', 'milestone_5', etc.
  read BOOLEAN DEFAULT false,
  actor_user_id UUID,
  actor_subway_line TEXT,
  actor_subway_color TEXT,
  preview_content TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
```

### Push Notification Service

**File:** `/src/lib/services/pushNotifications.ts`

Main API for managing push subscriptions:

```typescript
import { subscribeToPushNotifications, getPushSubscriptionStatus } from '$lib/services/pushNotifications'

// Check if push is supported and status
const status = await getPushSubscriptionStatus()
console.log(status)
// {
//   supported: true,
//   permission: 'granted',
//   subscribed: true,
//   isIOSPWA: false,
//   canSubscribe: false,
//   serviceWorkerActive: true
// }

// Subscribe to push notifications
const result = await subscribeToPushNotifications(supabase, userId, deviceId)
if (result.success) {
  console.log('Subscribed!', result.subscription)
} else {
  console.error('Failed:', result.error)
}

// Unsubscribe
await unsubscribeFromPushNotifications(supabase, userId, deviceId)
```

---

## Setup & Configuration

### 1. Environment Variables

Add to `.env`:

```bash
# Push Notifications (VAPID)
PUBLIC_VAPID_KEY=BMoATi0MHeTaaX1SOEuz7D-b-xGsXD-4F5o4gBaO_ouXkObKSjcEpqWCLW6jUBEXZ1ZNWAjyEMym4XYcxJ-hgSU
VAPID_PRIVATE_KEY=RP5xAWEcm4imTRjsiOVEVMYo6_nXJnPViEFLJh0_rV4
VAPID_SUBJECT=mailto:your-email@example.com
```

**Note:** The provided keys are pre-generated. For production, generate new keys:

```bash
npx web-push generate-vapid-keys
```

### 2. Database Migration

Apply the push subscriptions migration:

```bash
# Local development
supabase db reset --yes

# Or apply specific migration
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f supabase/migrations/20251001000000_push_subscriptions.sql
```

Verify tables were created:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d push_subscriptions"
```

### 3. Icon Assets

Ensure these icon files exist in `/static/`:

- `icon-192.png` - 192x192 app icon (already exists)
- `icon-512.png` - 512x512 app icon (already exists)
- `apple-touch-icon.png` - 180x180 iOS icon (already exists)
- `badge-96.svg` - 96x96 monochrome badge (created)

**To convert badge SVG to PNG:**

```bash
# Using ImageMagick
convert -background none -size 96x96 static/badge-96.svg static/badge-96.png

# Or using online tool:
# https://cloudconvert.com/svg-to-png
```

### 4. Service Worker Registration

The service worker is automatically registered in `/src/app.html` via SvelteKit's built-in support.

Verify registration in browser console:

```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg)
})
```

---

## Testing

### Local Testing (Desktop Chrome)

1. Start development server:
   ```bash
   npm run dev
   ```

2. Open Chrome at `http://localhost:5173`

3. Open DevTools → Application → Service Workers
   - Verify service worker is active

4. Test push subscription:
   ```javascript
   // In browser console
   const status = await window.getPushStatus()
   console.log(status)
   ```

5. Request notification permission when prompted

6. Create a test notification trigger (e.g., reply to your own post from another device/incognito)

### iOS Testing

**Requirements:**
- iOS 16.4+ (push notifications in PWA)
- Physical iOS device (push doesn't work in Simulator)
- HTTPS connection (use ngrok or deploy to staging)

**Setup:**

1. Deploy to HTTPS endpoint:
   ```bash
   # Option 1: Vercel staging
   vercel deploy --preview

   # Option 2: ngrok tunnel
   ngrok http 5173
   ```

2. On iOS device:
   - Open Safari
   - Visit your HTTPS URL
   - Tap Share → "Add to Home Screen"
   - Tap "Add"

3. Launch app from Home Screen (must be in standalone mode)

4. Test subscription:
   - Tap notification settings button
   - Grant permission when prompted
   - Verify subscription in database

5. Send test notification:
   ```javascript
   // From desktop browser console or API
   await fetch('/api/notifications/test', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ userId: 'your-user-id' })
   })
   ```

6. Lock device and wait for notification

**iOS Gotchas:**

- Push ONLY works in installed PWA (not in Safari browser)
- Must launch app from home screen icon
- Notification permission prompt only shows in standalone mode
- Service worker must be registered before permission request
- First push may take 30-60 seconds to arrive

### Android Testing

**Requirements:**
- Android 5.0+ (Lollipop)
- Chrome 42+
- Physical device or emulator

**Setup:**

1. Deploy to HTTPS (same as iOS)

2. On Android device:
   - Open Chrome
   - Visit your HTTPS URL
   - Tap menu → "Install app" or "Add to Home Screen"

3. Launch app from home screen

4. Test subscription and notifications (same as iOS steps 4-6)

**Android Gotchas:**

- Push works in both browser and installed PWA
- Some OEMs (Samsung, Xiaomi) have aggressive battery optimization that may delay notifications
- Test with device unlocked first, then locked

### Desktop Testing

**Chrome/Edge:**

1. Visit app in browser
2. Click install icon in address bar
3. Test push in both browser and installed PWA

**Firefox:**

1. Visit app in browser
2. Install via browser prompt
3. Test push (Firefox has different notification UI)

**Safari (macOS 13+):**

1. Visit app in Safari
2. Install via File → "Add to Dock"
3. Test push (requires macOS 13 Ventura+)

---

## Deployment

### Vercel Deployment

1. **Set Environment Variables** in Vercel dashboard:

   ```
   PUBLIC_VAPID_KEY=your_public_key
   VAPID_PRIVATE_KEY=your_private_key
   VAPID_SUBJECT=mailto:your-email@example.com
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Deploy:**

   ```bash
   vercel deploy --prod
   ```

3. **Verify PWA:**

   - Visit site in Chrome
   - Open DevTools → Lighthouse
   - Run PWA audit
   - Target: 90+ score

4. **Test Push:**

   - Install PWA on device
   - Subscribe to notifications
   - Trigger test notification
   - Verify delivery

### Edge Function for Sending Push

You'll need to create a Supabase Edge Function to send push notifications:

**File:** `supabase/functions/send-push/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import webPush from 'npm:web-push'

// Configure web-push
webPush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('PUBLIC_VAPID_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

serve(async (req) => {
  try {
    const { userId, title, body, postId, commentId, notificationId } = await req.json()

    // Get user's push subscriptions from database
    const subscriptions = await getActiveSubscriptions(userId)

    // Send push to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webPush.sendNotification(sub, JSON.stringify({
          title,
          body,
          postId,
          commentId,
          notificationId
        }))
      )
    )

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

Deploy edge function:

```bash
supabase functions deploy send-push
```

### Database Triggers

The notification system uses PostgreSQL triggers to automatically send push notifications when events occur. These are already set up in the migrations:

- `trigger_create_reply_notification` - Sends when someone replies
- `trigger_create_milestone_notification` - Sends when post hits milestone

To integrate with the edge function, you can use `pg_notify` in the trigger to call the edge function via webhooks.

---

## Troubleshooting

### Common Issues

#### 1. "Push notifications not supported"

**Symptoms:** Status shows `supported: false`

**Causes:**
- Browser doesn't support Push API (check caniuse.com)
- iOS Safari without PWA installed
- HTTP instead of HTTPS
- Service worker not registered

**Fix:**
```javascript
// Check what's missing
console.log('ServiceWorker' in navigator)
console.log('PushManager' in window)
console.log('Notification' in window)
console.log(window.isSecureContext) // Must be true
```

#### 2. Service Worker Not Activating

**Symptoms:** `serviceWorkerActive: false`

**Causes:**
- Service worker file not found
- JavaScript error in service worker
- Browser cache issue

**Fix:**
```javascript
// Check registration
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Registration:', reg)
  console.log('Active:', reg?.active)
  console.log('Waiting:', reg?.waiting)
  console.log('Installing:', reg?.installing)
})

// Force update
navigator.serviceWorker.getRegistration().then(reg => {
  reg?.update()
})

// Clear and re-register
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister())
  window.location.reload()
})
```

#### 3. Notification Permission Denied

**Symptoms:** `permission: 'denied'`

**Causes:**
- User clicked "Block" on permission prompt
- Browser setting blocks all notifications
- iOS not in standalone mode

**Fix:**

Desktop:
1. Chrome: Settings → Privacy → Site Settings → Notifications
2. Allow for your domain
3. Reload page

iOS:
1. Settings → YipYap (if installed) → Notifications
2. Enable "Allow Notifications"
3. Relaunch app from home screen

Android:
1. Settings → Apps → YipYap → Notifications
2. Enable notifications
3. Relaunch app

#### 4. Push Subscription Fails

**Symptoms:** Subscribe returns error

**Causes:**
- Invalid VAPID key
- Service worker not active
- Browser doesn't support encryption
- Network error

**Fix:**
```javascript
// Verify VAPID key format
console.log('VAPID key length:', PUBLIC_VAPID_KEY.length) // Should be 88

// Check service worker state
const reg = await navigator.serviceWorker.ready
console.log('Service Worker ready:', reg.active.state) // Should be 'activated'

// Test subscription manually
const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey
})
console.log('Subscription:', sub.toJSON())
```

#### 5. Notifications Not Arriving (iOS)

**Symptoms:** Subscription works but no notifications

**Causes:**
- App not launched from home screen
- Device in Low Power Mode
- Notification settings disabled
- Push payload too large (4KB limit)
- Server not sending correctly

**Fix:**

1. Verify standalone mode:
   ```javascript
   console.log('Standalone:', window.navigator.standalone) // Must be true
   ```

2. Check notification settings:
   - iOS Settings → YipYap → Notifications → Allow Notifications

3. Test with simple payload:
   ```javascript
   // Minimal test notification
   {
     title: "Test",
     body: "Short message"
   }
   ```

4. Check Apple Push Notification service status:
   - https://developer.apple.com/system-status/

5. Verify endpoint:
   ```javascript
   // iOS push endpoint should contain apple.com
   const sub = await registration.pushManager.getSubscription()
   console.log(sub.endpoint) // Should include 'push.apple.com'
   ```

#### 6. Notifications Not Arriving (Android)

**Symptoms:** Subscription works but no notifications

**Causes:**
- Battery optimization blocking
- Firebase Cloud Messaging issues
- App not in foreground/background
- Notification channel settings

**Fix:**

1. Disable battery optimization:
   - Settings → Apps → YipYap → Battery → Unrestricted

2. Check notification channels:
   - Settings → Apps → YipYap → Notifications → All categories enabled

3. Test in airplane mode then reconnect:
   - Turn on airplane mode
   - Send notification
   - Turn off airplane mode
   - Notification should arrive within 30s

4. Verify FCM endpoint:
   ```javascript
   const sub = await registration.pushManager.getSubscription()
   console.log(sub.endpoint) // Should include 'fcm.googleapis.com'
   ```

#### 7. Database RPC Errors

**Symptoms:** "Function not found" or "Permission denied"

**Causes:**
- Migration not applied
- RPC function not granted to anon role
- User ID invalid

**Fix:**

1. Verify migration applied:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name LIKE 'rpc_%push%';
   ```

2. Check permissions:
   ```sql
   SELECT *
   FROM information_schema.routine_privileges
   WHERE routine_name = 'rpc_save_push_subscription'
   AND grantee = 'anon';
   ```

3. Re-apply migration:
   ```bash
   supabase db reset --yes
   ```

---

## Browser Support Matrix

| Browser | Version | PWA Install | Push Notifications | Notes |
|---------|---------|-------------|-------------------|-------|
| Chrome Desktop | 42+ | ✅ | ✅ | Full support |
| Chrome Android | 42+ | ✅ | ✅ | Full support |
| Edge Desktop | 79+ | ✅ | ✅ | Full support |
| Firefox Desktop | 44+ | ✅ | ✅ | Full support |
| Firefox Android | 68+ | ✅ | ✅ | Full support |
| Safari Desktop | 16.4+ | ✅ | ✅ | macOS 13+ only |
| Safari iOS | 16.4+ | ✅ | ✅ | Standalone PWA only |
| Samsung Internet | 4+ | ✅ | ✅ | Full support |

---

## Performance Considerations

### Cache Strategy

YipYap uses a multi-tier caching strategy:

1. **App Shell** (Cache First, permanent)
   - HTML, CSS, JavaScript bundles
   - Static assets

2. **Images** (Cache First, 24hr TTL)
   - User avatars
   - App icons

3. **API Data** (Network First, 1hr TTL)
   - Posts, comments
   - User data

4. **Runtime Assets** (Stale While Revalidate)
   - Dynamic content
   - Frequently updated data

### Service Worker Updates

Service workers auto-update when:
- App version changes (SvelteKit build number)
- 24 hours have passed since last check
- User force-refreshes page

To force update:
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  reg?.update()
})
```

### Offline Support

YipYap works offline with:
- Cached app shell (always available)
- Cached posts/comments (up to 1 hour old)
- Background sync for queued actions
- Offline indicator in UI

---

## Security

### VAPID Keys

VAPID keys authenticate your push notifications and prevent spoofing.

**Private key security:**
- Store in environment variables only
- Never commit to git
- Rotate periodically (invalidates existing subscriptions)

**Key rotation process:**
1. Generate new keys
2. Update environment variables
3. Deploy new version
4. Users must re-subscribe (old subscriptions invalid)

### Subscription Storage

Push subscriptions are stored with:
- Encrypted at rest in Supabase
- Foreign key to users table (cascade delete)
- Unique constraint on user + device
- RLS policies prevent unauthorized access

### Content Security Policy

Add to headers for production:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  img-src 'self' data: https:;
```

---

## Monitoring & Analytics

### Service Worker Metrics

Track in analytics:

```javascript
// Registration success/failure
navigator.serviceWorker.register('/service-worker.js')
  .then(() => analytics.track('SW_REGISTERED'))
  .catch(() => analytics.track('SW_REGISTRATION_FAILED'))

// Push subscription success/failure
await subscribeToPushNotifications()
  .then(() => analytics.track('PUSH_SUBSCRIBED'))
  .catch(() => analytics.track('PUSH_SUBSCRIPTION_FAILED'))

// Notification shown
self.addEventListener('push', (event) => {
  analytics.track('NOTIFICATION_SHOWN')
})

// Notification clicked
self.addEventListener('notificationclick', (event) => {
  analytics.track('NOTIFICATION_CLICKED')
})
```

### Database Queries

Monitor push subscription metrics:

```sql
-- Total subscriptions
SELECT COUNT(*) FROM push_subscriptions WHERE enabled = true;

-- Subscriptions per user
SELECT user_id, COUNT(*)
FROM push_subscriptions
WHERE enabled = true
GROUP BY user_id;

-- Subscription growth
SELECT DATE(created_at), COUNT(*)
FROM push_subscriptions
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);

-- Active devices by platform
SELECT
  CASE
    WHEN user_agent LIKE '%iPhone%' THEN 'iOS'
    WHEN user_agent LIKE '%Android%' THEN 'Android'
    ELSE 'Desktop'
  END as platform,
  COUNT(*)
FROM push_subscriptions
WHERE enabled = true
GROUP BY platform;
```

---

## Next Steps

### Immediate

1. ✅ Apply database migration
2. ✅ Configure environment variables
3. ✅ Convert badge SVG to PNG
4. Test locally on desktop Chrome
5. Deploy to staging with HTTPS
6. Test on iOS device
7. Test on Android device

### Short-term

1. Create edge function for sending push
2. Add push subscription UI to settings page
3. Add notification feed page at `/notifications`
4. Integrate notification badge in bottom nav
5. Set up notification triggers for replies/milestones

### Long-term

1. Add notification preferences (per-type opt-in/out)
2. Implement quiet hours for notifications
3. Add notification sound customization
4. Track push notification analytics
5. Set up automated cleanup cron job
6. Implement notification rate limiting
7. Add rich notification actions (reply, upvote)

---

## Resources

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Apple PWA Documentation](https://developer.apple.com/documentation/webkit/supporting_web_push_notifications_in_safari)
- [Chrome Push Notifications](https://developers.google.com/web/fundamentals/push-notifications)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review browser console for errors
3. Verify database migration applied
4. Test in different browsers/devices
5. Check VAPID keys are correct

---

**Last Updated:** 2025-10-01
**YipYap Version:** 1.0.0
**Minimum iOS:** 16.4+
**Minimum Android:** 5.0+ (Chrome 42+)
