#!/bin/bash
# Test push notification system with webhook format

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Push Notification Webhook Tester${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Configuration
EDGE_FUNCTION_URL="${EDGE_FUNCTION_URL:-http://127.0.0.1:54321/functions/v1/send-push-notification}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"

# Check if service role key is provided
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${YELLOW}SERVICE_ROLE_KEY not set. Attempting to get from supabase status...${NC}"
  SERVICE_ROLE_KEY=$(supabase status 2>/dev/null | grep "service_role key" | awk '{print $NF}')

  if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}ERROR: Could not find service role key.${NC}"
    echo "Please set SERVICE_ROLE_KEY environment variable or start supabase locally."
    exit 1
  fi
fi

echo -e "${GREEN}✓ Service role key found${NC}"
echo ""

# Get a test user ID from the database
echo -e "${BLUE}Getting test user from database...${NC}"
TEST_USER_ID=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -t -A -c "SELECT id FROM users LIMIT 1" 2>/dev/null || echo "")

if [ -z "$TEST_USER_ID" ]; then
  echo -e "${RED}ERROR: No users found in database. Please create a user first.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Test user ID: ${TEST_USER_ID}${NC}"
echo ""

# Generate test UUIDs for post/comment/notification
TEST_POST_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TEST_NOTIFICATION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Test 1: Direct JSON format (for development/testing)
echo -e "${BLUE}Test 1: Direct JSON format${NC}"
echo "Testing edge function with direct JSON payload..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$TEST_USER_ID\",
    \"title\": \"Direct JSON Test\",
    \"body\": \"This is a test notification sent via direct JSON\",
    \"postId\": \"$TEST_POST_ID\",
    \"notificationId\": \"$TEST_NOTIFICATION_ID\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test 1 PASSED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Test 1 FAILED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Webhook format (production)
echo -e "${BLUE}Test 2: Webhook format (reply_to_post)${NC}"
echo "Testing edge function with Supabase webhook payload..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"INSERT\",
    \"table\": \"notifications\",
    \"schema\": \"public\",
    \"record\": {
      \"id\": \"$TEST_NOTIFICATION_ID\",
      \"user_id\": \"$TEST_USER_ID\",
      \"post_id\": \"$TEST_POST_ID\",
      \"comment_id\": null,
      \"type\": \"reply_to_post\",
      \"actor_user_id\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"actor_subway_line\": \"A\",
      \"actor_subway_color\": \"mta-blue\",
      \"preview_content\": \"This is a test reply from webhook format\",
      \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
      \"read\": false,
      \"read_at\": null,
      \"deleted_at\": null
    },
    \"old_record\": null
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test 2 PASSED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Test 2 FAILED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Webhook format (milestone)
echo -e "${BLUE}Test 3: Webhook format (milestone_5)${NC}"
echo "Testing edge function with milestone notification..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"INSERT\",
    \"table\": \"notifications\",
    \"schema\": \"public\",
    \"record\": {
      \"id\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"user_id\": \"$TEST_USER_ID\",
      \"post_id\": \"$TEST_POST_ID\",
      \"comment_id\": null,
      \"type\": \"milestone_5\",
      \"actor_user_id\": null,
      \"actor_subway_line\": null,
      \"actor_subway_color\": null,
      \"preview_content\": \"Your post reached 5 upvotes!\",
      \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
      \"read\": false,
      \"read_at\": null,
      \"deleted_at\": null
    },
    \"old_record\": null
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Test 3 PASSED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Test 3 FAILED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 4: Invalid event (should be ignored)
echo -e "${BLUE}Test 4: Invalid event (should be ignored)${NC}"
echo "Testing edge function with UPDATE event (should ignore)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"UPDATE\",
    \"table\": \"notifications\",
    \"schema\": \"public\",
    \"record\": {
      \"id\": \"$TEST_NOTIFICATION_ID\",
      \"user_id\": \"$TEST_USER_ID\",
      \"type\": \"reply_to_post\"
    },
    \"old_record\": {}
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "ignored"; then
  echo -e "${GREEN}✓ Test 4 PASSED (HTTP $HTTP_CODE, event ignored)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Test 4 FAILED (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
fi
echo ""

echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Testing complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy edge function: supabase functions deploy send-push-notification"
echo "2. Configure webhook in Supabase Dashboard"
echo "3. Create a real notification in the app"
echo "4. Check if push notification is received"
echo ""
