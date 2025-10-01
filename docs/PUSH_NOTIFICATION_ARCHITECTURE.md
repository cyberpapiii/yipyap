# Push Notification Architecture Solution

## Problem Statement

Supabase production doesn't support `pg_net` or direct HTTP calls from database triggers, making it impossible to trigger edge functions directly from the database when notifications are created.

## Production-Ready Solution: Database Webhooks

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌──────────┐
│  Database   │─────▶│   Webhook    │─────▶│  Edge Function  │─────▶│  Push    │
│  Trigger    │      │  (Supabase)  │      │  send-push-*    │      │  Service │
└─────────────┘      └──────────────┘      └─────────────────┘      └──────────┘
     INSERT                HTTP POST             Process                 FCM/APNs
  notification           with record            notification              Web Push
```

### How It Works

1. **Database Trigger**: When a new notification is inserted into the `notifications` table, Supabase fires a database webhook
2. **Webhook Payload**: Supabase sends the entire row as JSON in the webhook body under the `record` field
3. **Edge Function**: The edge function parses the webhook payload and extracts notification data
4. **Push Delivery**: Edge function fetches push subscriptions and sends notifications via Web Push

### Webhook Payload Format

Supabase webhooks send data in this format:

```json
{
  "type": "INSERT",
  "table": "notifications",
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
    "read": false
  },
  "schema": "public",
  "old_record": null
}
```

### Implementation Steps

1. **Update Edge Function** to handle webhook format
2. **Configure Database Webhook** in Supabase Dashboard
3. **Remove Database Trigger** that tries to use pg_net (not supported in production)
4. **Test End-to-End** with production webhook

### Advantages

- ✅ Works in production (webhooks are fully supported)
- ✅ No additional infrastructure needed
- ✅ Works when app is closed
- ✅ Reliable delivery with retries (Supabase handles this)
- ✅ Pure Supabase stack
- ✅ Can handle both webhook and direct API calls

### Disadvantages

- ⚠️ Slight latency (webhook delivery ~100-500ms)
- ⚠️ Requires webhook configuration in Dashboard (not in migration)
- ⚠️ Webhook secret management

### Alternative Considered: Realtime + Background Sync

Using Supabase Realtime with a background service worker was considered but rejected because:

- ❌ Requires app to have been opened at least once recently
- ❌ Background sync is unreliable on iOS
- ❌ Service worker background execution is limited
- ❌ Not truly "instant" for closed apps

## Implementation Details

### Edge Function Modifications

The edge function needs to handle three input formats:

1. **Webhook format** (production): `{ type, table, record, schema }`
2. **Direct JSON** (testing): `{ userId, title, body, ... }`
3. **Query params** (legacy): `?userId=...&title=...`

### Webhook Configuration

**Dashboard Path**: Database → Webhooks → Create Webhook

**Settings**:
- **Table**: `notifications`
- **Events**: `INSERT`
- **Type**: POST
- **URL**: `https://[project-ref].supabase.co/functions/v1/send-push-notification`
- **HTTP Headers**:
  - `Authorization: Bearer [service-role-key]`
  - `Content-Type: application/json`
- **Webhook Secret**: Generate and store in edge function secrets

### Security Considerations

1. **Webhook Secret Verification**: Edge function should verify webhook signature
2. **Service Role Key**: Store in edge function secrets, not in webhook config
3. **Rate Limiting**: Already handled by Supabase at webhook level
4. **Payload Validation**: Validate all fields before processing

## Testing Strategy

### Local Testing

```bash
# Test with direct JSON (development)
curl -X POST http://127.0.0.1:54321/functions/v1/send-push-notification \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "uuid",
    "title": "Test",
    "body": "Test message"
  }'
```

### Webhook Testing

```bash
# Test with webhook format (production)
curl -X POST http://127.0.0.1:54321/functions/v1/send-push-notification \
  -H "Authorization: Bearer [service-role-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "notifications",
    "record": {
      "id": "uuid",
      "user_id": "uuid",
      "post_id": "uuid",
      "type": "reply_to_post",
      "actor_subway_line": "A",
      "preview_content": "Test reply"
    }
  }'
```

### Production Testing

1. Create a test notification in production database
2. Verify webhook fires in Supabase Dashboard → Database → Webhooks → Logs
3. Check edge function logs for execution
4. Verify push notification received on device

## Migration Path

### Phase 1: Update Edge Function (No Downtime)
- Modify edge function to handle webhook format
- Deploy updated edge function
- Keep existing direct-call functionality

### Phase 2: Configure Webhook (No Downtime)
- Create webhook in Supabase Dashboard
- Test webhook delivery
- Monitor logs

### Phase 3: Remove Old Trigger (Cleanup)
- Remove database trigger that tries to use pg_net
- Create migration to clean up trigger function
- Document that webhooks are the production mechanism

## Monitoring & Debugging

### Webhook Logs
- **Location**: Supabase Dashboard → Database → Webhooks → [Your Webhook] → Logs
- **Shows**: Delivery attempts, HTTP status, response time, retries

### Edge Function Logs
- **Location**: Supabase Dashboard → Edge Functions → send-push-notification → Logs
- **Shows**: Function execution, errors, console logs

### Push Delivery Logs
- **Location**: Database table `push_notification_delivery_log`
- **Shows**: Per-device delivery success/failure, error messages

## Cost Considerations

- **Webhooks**: Free (included in all Supabase plans)
- **Edge Functions**: Free tier includes 500K invocations/month
- **Web Push**: Free (uses browser push services)

## Conclusion

Database webhooks provide a production-ready, Supabase-native solution for triggering push notifications. The implementation requires minimal changes to the existing edge function and no additional infrastructure.
