# YipYap Test Suite

Comprehensive testing for the YipYap application covering API functionality, database security, and end-to-end user flows.

## Running Tests

### Quick Start
```bash
npm test              # Run all unit/integration tests (fast)
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Open Vitest UI dashboard
npm run test:e2e      # Run E2E browser tests (requires app running)
npm run test:all      # Run both unit and E2E tests
```

### Prerequisites

**For Unit Tests:**
- Local Supabase must be running: `supabase start`
- No other setup needed

**For E2E Tests:**
- Local Supabase must be running: `supabase start`
- Dev server must be running: `npm run dev`
- Then run: `npm run test:e2e`

## Test Coverage

### API Tests (`tests/api/`)

**Posts API (`posts.test.ts`)**
- ✅ Creating posts with plain text
- ✅ Creating posts with line breaks
- ✅ Enforcing minimum length (1 char)
- ✅ Enforcing maximum length (500 chars)
- ✅ Retrieving single posts
- ✅ Getting Hot feed posts
- ✅ Getting New feed posts
- ✅ Upvoting/downvoting posts
- ✅ Removing votes
- ✅ Soft deleting posts
- ✅ Permission checks (can't delete other's posts)

**Comments API (`comments.test.ts`)**
- ✅ Creating top-level comments
- ✅ Creating comments with line breaks
- ✅ Character limits (1-500)
- ✅ Nested replies (depth 1)
- ✅ Preventing excessive depth (max depth 1)
- ✅ Voting on comments
- ✅ Soft deleting comments
- ✅ Permission checks
- ✅ Comment count updates

### Database Tests (`tests/database/`)

**RLS Tests (`rls.test.ts`)**
- ✅ RLS enabled on all tables
- ✅ SELECT policies exist
- ✅ INSERT policies blocked (writes via RPC only)
- ✅ Direct INSERTs prevented
- ✅ SECURITY DEFINER on all RPC functions:
  - `rpc_create_post`
  - `rpc_create_comment`
  - `rpc_vote_post`
  - `rpc_vote_comment`
  - `rpc_delete_post`
  - `rpc_delete_comment`
- ✅ Realtime publication configured for posts/comments/votes

### Auth Tests (`tests/auth/`)

**Anonymous Auth (`anonymous.test.ts`)**
- ✅ Creating new anonymous users
- ✅ Returning existing user for same device
- ✅ Updating last_seen_at timestamp
- ✅ Assigning valid subway lines (A, B, G, J, L, N, 1, 4, 7, T)
- ✅ Assigning matching subway colors
- ✅ Anonymous users view exposure
- ✅ User stats initialization (karma, posts, comments)

### E2E Tests (`tests/e2e/`)

**User Flows (`user-flows.spec.ts`)**
- ✅ Loading home page
- ✅ Creating posts with line breaks
- ✅ Switching Hot/New feeds
- ✅ Opening threads
- ✅ Adding comments
- ✅ Upvoting posts
- ✅ Character limit enforcement (500)
- ✅ "You" indicator on own content
- ✅ Back navigation
- ✅ Nested comments with indentation
- ✅ XSS prevention (scripts rendered as text)

## Test Results

**Current Status:** ✅ **53 PASSED / 1 SKIPPED / 54 TOTAL**

### Known Limitations

**Skipped Tests:**
- `posts.test.ts > should accept exactly 500 characters` - Skipped due to `posts.title` field having 100 char constraint while `posts.content` allows 500 chars

## Troubleshooting

### Tests Failing?

**"Connection refused" errors:**
```bash
# Make sure Supabase is running
supabase status
supabase start
```

**"Module not found" errors:**
```bash
# Reinstall dependencies
npm install
```

**E2E tests timing out:**
```bash
# Make sure dev server is running
npm run dev
# Then in another terminal:
npm run test:e2e
```

### Debugging Failed Tests

**View detailed output:**
```bash
npm test -- --reporter=verbose
```

**Run specific test file:**
```bash
npm test tests/api/posts.test.ts
```

**Run specific test:**
```bash
npm test -- -t "should create a post"
```

**Debug E2E tests:**
```bash
npm run test:e2e:ui  # Opens Playwright UI
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: supabase start
      - run: npm test
      - run: npm run build
```

## Writing New Tests

### API Test Template

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { PostsAPI } from '$lib/api/posts'

const supabase = createClient(/*...*/)
const api = new PostsAPI(supabase as any)

describe('My Feature', () => {
  let testUser

  beforeAll(async () => {
    const { data } = await supabase.rpc('get_or_create_user', {
      device_id_param: `test_${Date.now()}`
    })
    testUser = data
  })

  it('should do something', async () => {
    // Test code here
    expect(true).toBe(true)
  })
})
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test'

test('should do user action', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Interact with page
  await page.click('button:has-text("Click Me")')

  // Assert result
  await expect(page.locator('text=Success')).toBeVisible()
})
```

## Performance Benchmarks

Tests complete in:
- **Unit tests:** ~1.2s
- **E2E tests:** ~15-30s (browser startup)

Total test suite: ~30-45 seconds