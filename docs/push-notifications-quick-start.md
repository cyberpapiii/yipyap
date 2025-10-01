# Push Notifications Quick Start

Quick reference for setting up push notifications in YipYap.

## Prerequisites

✅ Service worker at `/static/service-worker.js`
✅ PWA manifest at `/static/manifest.json`
✅ VAPID keys in `.env`
✅ Database migration applied

## One-Time Setup (5 minutes)

### 1. Apply Database Migrations

```bash
cd /Users/robdezendorf/Documents/GitHub/yipyap
supabase db reset --yes
```

### 2. Deploy Edge Function

```bash
supabase functions deploy send-push-notification --no-verify-jwt
```

### 3. Set Secrets

```bash
# Copy from .env file
supabase secrets set VAPID_PUBLIC_KEY="BMoATi0MHeTaaX1SOEuz7D-b-xGsXD-4F5o4gBaO_ouXkObKSjcEpqWCLW6jUBEXZ1ZNWAjyEMym4XYcxJ-hgSU"
supabase secrets set VAPID_PRIVATE_KEY="RP5xAWEcm4imTRjsiOVEVMYo6_nXJnPViEFLJh0_rV4"
supabase secrets set VAPID_SUBJECT="mailto:notifications@yipyap.app"
```

### 4. Configure Database for Trigger

```bash
# Get service role key
supabase status

# Connect to database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

# Run these SQL commands:
```

```sql
ALTER DATABASE postgres SET app.settings.edge_function_url = 'http://host.docker.internal:54321/functions/v1';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY_FROM_SUPABASE_STATUS';
```

## Testing (2 minutes)

### Test in Browser

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/notifications`
3. Click "Push Notifications" toggle
4. Grant permission
5. Open a second browser/incognito window
6. Create a new user and reply to first user's post
7. First user should receive push notification

### Test Edge Function

```bash
# Get your anon key from .env
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push-notification' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "user-uuid",
    "title": "Test",
    "body": "Test notification"
  }'
```

## File Structure

```
/Users/robdezendorf/Documents/GitHub/yipyap/
├── static/
│   ├── service-worker.js                    # Handles push events
│   └── manifest.json                        # PWA manifest
├── src/lib/
│   ├── services/
│   │   └── pushNotifications.ts             # Client API
│   └── components/
│       └── PushNotificationToggle.svelte    # UI toggle
├── supabase/
│   ├── migrations/
│   │   ├── 20251001000000_push_subscriptions.sql    # Table + RPCs
│   │   └── 20251001010000_push_notification_trigger.sql  # Auto-send trigger
│   └── functions/
│       └── send-push-notification/
│           └── index.ts                     # Edge Function
└── .env                                     # VAPID keys
```

## Common Issues

### "Permission Denied"
- User blocked notifications
- Fix: Browser settings → Site settings → Notifications → Allow

### "Not Supported"
- iOS Safari (not in PWA mode)
- Fix: Add to Home Screen first

### "Service Worker Inactive"
- Service worker not registered
- Fix: Hard refresh (Cmd+Shift+R) and check DevTools → Application

### No Notifications Received
1. Check Edge Function logs: `supabase functions logs send-push-notification`
2. Check subscription saved: `SELECT * FROM push_subscriptions;`
3. Check trigger fired: `SELECT * FROM net._http_response ORDER BY created_at DESC LIMIT 5;`

## Environment Variables

```ini
# .env (already configured)
PUBLIC_VAPID_KEY=BMoATi0MHeTaaX1SOEuz7D-b-xGsXD-4F5o4gBaO_ouXkObKSjcEpqWCLW6jUBEXZ1ZNWAjyEMym4XYcxJ-hgSU
VAPID_PRIVATE_KEY=RP5xAWEcm4imTRjsiOVEVMYo6_nXJnPViEFLJh0_rV4
```

## Useful Commands

```bash
# View Edge Function logs
supabase functions logs send-push-notification --tail

# Check subscriptions in DB
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT * FROM push_subscriptions;"

# Check notifications
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;"

# Check trigger responses
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT * FROM net._http_response ORDER BY created_at DESC LIMIT 5;"

# Restart Supabase
supabase stop && supabase start
```

## Next Steps After Setup

1. ✅ Test notification toggle works
2. ✅ Test receiving notifications
3. ✅ Test clicking notification opens thread
4. ✅ Test unsubscribe works
5. ✅ Test on mobile device (PWA mode)
6. ✅ Monitor Edge Function logs for errors

## Support

- Service Worker: `/static/service-worker.js`
- Toggle Component: `/src/lib/components/PushNotificationToggle.svelte`
- Push Service: `/src/lib/services/pushNotifications.ts`
- Edge Function: `/supabase/functions/send-push-notification/index.ts`
- Full docs: `/docs/push-notifications-deployment.md`
