#!/bin/bash
# Simple test for webhook format (no dependencies)

set -e

# Service role key (generated with super-secret-jwt-token-with-at-least-32-characters-long)
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoiaHR0cDovLzEyNy4wLjAuMTo1NDMyMS9hdXRoL3YxIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsInN1YiI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImlhdCI6MTc1ODgyNzEzOSwiZXhwIjoyMDc0NDAzMTM5fQ.Lw3Xr5B2_r7n8uYLEqxE9p4gK3jM5wN7oZ1qR8sT4vU"

EDGE_FUNCTION_URL="http://127.0.0.1:54321/functions/v1/send-push-notification"

echo "Testing Webhook Format Support"
echo "==============================="
echo ""

# Test: Webhook format
echo "Test: Webhook payload format"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "notifications",
    "schema": "public",
    "record": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "123e4567-e89b-12d3-a456-426614174001",
      "post_id": "123e4567-e89b-12d3-a456-426614174002",
      "comment_id": null,
      "type": "reply_to_post",
      "actor_user_id": "123e4567-e89b-12d3-a456-426614174003",
      "actor_subway_line": "A",
      "actor_subway_color": "mta-blue",
      "preview_content": "This is a test reply from webhook",
      "created_at": "2025-10-01T12:00:00Z",
      "read": false,
      "read_at": null,
      "deleted_at": null
    },
    "old_record": null
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Test PASSED - Edge function accepts webhook format"
else
  echo "✗ Test FAILED - Check edge function logs"
fi
echo ""
echo "Note: If the test succeeds but shows 'No subscriptions found', that's expected."
echo "The edge function parsed the webhook correctly. To test actual push delivery,"
echo "you need to register a push subscription first."
