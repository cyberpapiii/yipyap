# YipYap VAPID Keys Reference

## Current Keys (Pre-generated)

These keys are already configured in `.env` and ready to use for development and testing.

### Public Key (PUBLIC_VAPID_KEY)
```
BMoATi0MHeTaaX1SOEuz7D-b-xGsXD-4F5o4gBaO_ouXkObKSjcEpqWCLW6jUBEXZ1ZNWAjyEMym4XYcxJ-hgSU
```

### Private Key (VAPID_PRIVATE_KEY)
```
RP5xAWEcm4imTRjsiOVEVMYo6_nXJnPViEFLJh0_rV4
```

**IMPORTANT:** Keep the private key secret! Do not expose it in client-side code.

## Generating New Keys

For production, you should generate your own VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Output:
```
=======================================

Public Key:
[your-public-key]

Private Key:
[your-private-key]

=======================================
```

Then update:
1. `.env` file with both keys
2. Vercel environment variables for production
3. Any edge functions that send push notifications

## Key Usage

### Client-Side (Public Key Only)
The public key is used to subscribe to push notifications:

```typescript
// src/lib/services/pushNotifications.ts
import { PUBLIC_VAPID_KEY } from '$env/static/public'

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
})
```

### Server-Side (Both Keys)
The private key is used to sign push notification requests:

```typescript
// Supabase Edge Function
import webPush from 'npm:web-push'

webPush.setVapidDetails(
  'mailto:your-email@example.com',
  Deno.env.get('PUBLIC_VAPID_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

await webPush.sendNotification(subscription, payload)
```

## Key Rotation

If you need to rotate keys (e.g., if private key is compromised):

1. Generate new keys:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. Update environment variables

3. Deploy new version

4. **All existing subscriptions will be invalidated** - users must re-subscribe

## Security Best Practices

1. **Never commit private key to git** (it's in `.env`, which is gitignored)
2. **Use different keys for dev/staging/production**
3. **Store private key in secure environment variables only**
4. **Rotate keys periodically** (e.g., every 6-12 months)
5. **Monitor for unauthorized use** (unexpected push notifications)

## Verification

To verify your keys are working:

```bash
# Test with curl
curl -X POST \
  -H "Authorization: vapid t=[JWT], k=[PUBLIC_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}' \
  [PUSH_ENDPOINT]
```

Or use the test function in the app (once implemented):

```typescript
import { sendTestNotification } from '$lib/services/pushNotifications'

await sendTestNotification(supabase, userId)
```

---

**Key Generation Date:** 2025-09-30
**Environment:** Development/Testing
**Status:** Active
