# YipYap PWA Quick Start Guide

Get push notifications working in 5 steps.

## Prerequisites

- Node.js 18+
- Supabase running locally
- iOS 16.4+ device OR Android 5+ device (for testing)

## Step 1: Convert Badge Icon (2 minutes)

```bash
# Install ImageMagick if needed
brew install imagemagick

# Convert SVG to PNG
convert -background none -size 96x96 static/badge-96.svg static/badge-96.png

# Verify
ls -lh static/badge-96.png
```

**Alternative:** Use online converter at https://cloudconvert.com/svg-to-png

## Step 2: Apply Database Migration (1 minute)

```bash
# Reset local database (applies all migrations)
supabase db reset --yes

# Verify tables created
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM push_subscriptions;"
```

Expected output: `0` (table exists but empty)

## Step 3: Start Dev Server (1 minute)

```bash
# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

Visit: http://localhost:5173

## Step 4: Test Locally in Chrome (5 minutes)

1. Open Chrome DevTools (F12)
2. Go to Application tab → Service Workers
3. Verify service worker is active
4. In Console, run:
   ```javascript
   // Check push support
   console.log('ServiceWorker' in navigator)
   console.log('PushManager' in window)
   console.log('Notification' in window)

   // Check service worker
   navigator.serviceWorker.getRegistration().then(reg => {
     console.log('SW Active:', !!reg?.active)
   })
   ```

5. Expected output: All `true`

## Step 5: Test Push Subscription (2 minutes)

In browser console:

```javascript
// Import service (in your app code)
import { subscribeToPushNotifications, getPushSubscriptionStatus } from '$lib/services/pushNotifications'
import { supabase } from '$lib/supabase'

// Check status
const status = await getPushSubscriptionStatus()
console.log(status)
// Should show: { supported: true, permission: 'default', ... }

// Subscribe (will prompt for permission)
const result = await subscribeToPushNotifications(
  supabase,
  'your-user-id',
  'your-device-id'
)

console.log(result)
// Should show: { success: true, subscription: {...} }
```

**Verify in database:**

```sql
SELECT * FROM push_subscriptions;
```

Should show your subscription with endpoint and keys.

## Testing on iOS (15 minutes)

### Deploy to HTTPS

```bash
# Option 1: Vercel preview
vercel deploy --preview

# Option 2: ngrok tunnel
ngrok http 5173
```

Copy your HTTPS URL (e.g., `https://abc123.vercel.app`)

### Install on iOS Device

1. Open Safari on iOS device
2. Visit your HTTPS URL
3. Tap Share button (box with arrow)
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add" in top-right
6. Close Safari

### Launch PWA

1. Find "YipYap" icon on home screen
2. Tap to launch (must launch from home screen, not Safari)
3. Verify it opens in standalone mode (no Safari UI)

### Subscribe to Push

1. In the app, trigger subscription flow (you'll need to add UI for this)
2. Grant notification permission when prompted
3. Check in database that subscription was saved

### Send Test Notification

From your development machine:

```typescript
// Create edge function or use this in your app:
await supabase.rpc('get_active_push_subscriptions', {
  p_user: 'user-id'
})

// Then send push via web-push library
// (See docs/PWA_PUSH_NOTIFICATIONS.md for full example)
```

## Testing on Android (10 minutes)

### Deploy to HTTPS (same as iOS)

### Install PWA

1. Open Chrome on Android device
2. Visit your HTTPS URL
3. Tap menu (three dots) → "Install app" or "Add to Home Screen"
4. Tap "Install"
5. App icon appears on home screen

### Subscribe and Test (same as iOS)

## Troubleshooting

### "Service worker not registered"

```javascript
// Force registration
navigator.serviceWorker.register('/service-worker.js', { type: 'module' })
```

### "Push notifications not supported"

Check:
- HTTPS (required, except localhost)
- Browser version (Chrome 42+, Safari 16.4+)
- iOS: Must be in standalone mode (launched from home screen)

### "Permission denied"

Desktop:
- Chrome → Settings → Privacy → Site Settings → Notifications
- Allow for your domain

iOS:
- Settings → YipYap → Notifications → Allow Notifications

Android:
- Settings → Apps → YipYap → Notifications → Enable

### Subscription fails with "Invalid VAPID key"

Verify key format:

```javascript
import { PUBLIC_VAPID_KEY } from '$env/static/public'
console.log('VAPID key length:', PUBLIC_VAPID_KEY.length)
// Should be 88 characters
```

### iOS notifications not arriving

1. Verify standalone mode:
   ```javascript
   console.log(window.navigator.standalone)
   // Must be true
   ```

2. Check Settings → YipYap → Notifications → Allow Notifications

3. Lock device and wait 30-60 seconds

4. Check device console for errors:
   - Xcode → Window → Devices and Simulators
   - Select device → View Device Logs

## Next Steps

After successful testing:

1. **Create Edge Function** for sending push notifications
2. **Add UI** for subscription management in settings
3. **Implement notification feed** at `/notifications`
4. **Add badge** to bottom nav showing unread count
5. **Deploy to production** with proper VAPID keys

## Production Deployment

```bash
# Generate production VAPID keys
npx web-push generate-vapid-keys

# Set in Vercel
vercel env add PUBLIC_VAPID_KEY
vercel env add VAPID_PRIVATE_KEY

# Deploy
vercel deploy --prod

# Test on real devices
```

## API Reference

### Subscribe to Push

```typescript
import { subscribeToPushNotifications } from '$lib/services/pushNotifications'

const result = await subscribeToPushNotifications(supabase, userId, deviceId)
if (result.success) {
  console.log('Subscribed!', result.subscription)
} else {
  console.error('Failed:', result.error)
}
```

### Check Status

```typescript
import { getPushSubscriptionStatus } from '$lib/services/pushNotifications'

const status = await getPushSubscriptionStatus()
console.log(status)
// {
//   supported: boolean,
//   permission: 'granted' | 'denied' | 'default',
//   subscribed: boolean,
//   isIOSPWA: boolean,
//   canSubscribe: boolean,
//   serviceWorkerActive: boolean
// }
```

### Unsubscribe

```typescript
import { unsubscribeFromPushNotifications } from '$lib/services/pushNotifications'

await unsubscribeFromPushNotifications(supabase, userId, deviceId)
```

## Common Commands

```bash
# Start dev server
npm run dev

# Apply migrations
supabase db reset --yes

# Check service worker
# In browser console:
navigator.serviceWorker.getRegistration()

# Check subscriptions in database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT * FROM push_subscriptions;"

# Deploy to Vercel preview
vercel deploy --preview

# Deploy to production
vercel deploy --prod

# Generate new VAPID keys
npx web-push generate-vapid-keys
```

## Resources

- Full Documentation: `/docs/PWA_PUSH_NOTIFICATIONS.md`
- Implementation Summary: `/docs/PWA_IMPLEMENTATION_SUMMARY.md`
- VAPID Keys Guide: `/docs/VAPID_KEYS.md`

## Support

Issues? Check:
1. Browser console for errors
2. Service worker status in DevTools
3. Database for subscription records
4. Environment variables are set correctly

---

**Last Updated:** 2025-10-01
**Estimated Time:** 25 minutes for complete setup and testing
