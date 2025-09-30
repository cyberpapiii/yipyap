# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YipYap is a local-first anonymous social playground built with SvelteKit 5 (using runes) and Supabase realtime. Users interact anonymously using device-based identification with NYC subway line branding (e.g., "A Line", "7 Line") instead of traditional accounts.

## Development Commands

### Essential Commands
```bash
npm install           # Install dependencies
supabase start        # Start local Supabase stack
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type checking and Svelte diagnostics
supabase db reset --yes  # Rebuild local DB and replay migrations
```

### Database Operations
```bash
# Apply a specific migration
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/XXX_migration_name.sql

# Connect to local database directly
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

### Environment Setup
The app requires `.env` with:
```ini
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Local Supabase uses JWT secret: `super-secret-jwt-token-with-at-least-32-characters-long`

Regenerate tokens using: `node ./scripts/generate-supabase-token.mjs anon`

## Architecture

### Anonymous Authentication System
- **Device-based identity**: Uses device fingerprinting + localStorage (`yipyap_device_id`)
- **No traditional auth**: Users identified by unique device IDs
- **Subway line branding**: Users assigned NYC subway line identifiers (A, B, G, J, L, N, 1, 4, 7, T) with MTA colors
- **Thread-specific identities**: Users can have different emoji/color per thread using deterministic hashing
- **Bootstrap flow**: `+layout.svelte:19-35` calls `get_or_create_user` RPC on mount
- **Caching**: Anonymous user cached in localStorage for fast subsequent loads

Key files:
- `src/lib/auth.ts`: Device fingerprinting, identity generation, caching
- `src/lib/stores/auth.ts`: Auth state management
- `supabase/migrations/010_anonymous_identity.sql`: Anonymous user creation RPC

### Database Architecture & RLS

**Critical**: All writes MUST go through RPCs defined in `supabase/migrations/006_write_rpcs_and_identity.sql` and `018_add_delete_rpcs.sql`. Direct table writes are blocked by RLS policies in `007_rls_lockdown.sql`.

#### Core Tables
- `users`: Anonymous user profiles (device_id, subway_line, subway_color, karma)
- `posts`: Top-level posts (content, user_id, community, score, comment_count)
- `comments`: Replies to posts/comments (content, post_id, parent_comment_id, depth, score)
- `votes`: User votes on posts/comments (user_id, post_id/comment_id, vote_type)
- `thread_identities`: Per-thread emoji/color for users (user_id, post_id, emoji, color_code)
- `notifications`: User notifications (type, user_id, post_id, comment_id)

#### Views with Stats
- `post_with_stats`: Posts with vote_score and comment_count
- `comment_with_stats`: Comments with vote_score and reply_count
- `hot_posts`: Posts ranked by hot score algorithm

#### Write RPCs (Rate Limited)
- `rpc_create_post(p_user, p_content)`: Create post (10/hour limit)
- `rpc_create_comment(p_user, p_post, p_parent, p_content)`: Create comment (30/hour, max depth 1)
- `rpc_vote_post(p_user, p_post, p_vote)`: Vote on post (50/hour)
- `rpc_vote_comment(p_user, p_comment, p_vote)`: Vote on comment (50/hour)
- `rpc_delete_post(p_user, p_post)`: Soft delete post (must own)
- `rpc_delete_comment(p_user, p_comment)`: Soft delete comment (must own)
- `rpc_ensure_thread_identity(user_uuid, post_uuid)`: Get/create deterministic thread identity
- `rpc_reroll_thread_identity(user_uuid, post_uuid)`: Reroll thread identity (once per thread)

#### Read RPCs
- `get_or_create_user(device_id_param)`: Bootstrap anonymous user

### State Management (Svelte 5 Runes)

The app uses Svelte stores with runes for reactivity:

#### Core Stores
- `authStore` (`src/lib/stores/auth.ts`): Anonymous user state, device ID, auth loading
- `hotFeed` / `newFeed` (`src/lib/stores/feeds.ts`): Separate stores for hot/new feeds
- `activeFeedType`: Current active feed ('hot' | 'new')
- `threadStore` (`src/lib/stores/thread.ts`): Thread detail state
- `composeStore` (`src/lib/stores/compose.ts`): Compose modal state
- `realtime` (`src/lib/stores/realtime.ts`): Realtime connection and subscription manager

#### Feed Store Methods
- `setPosts(posts)`: Replace all posts
- `addPosts(newPosts, hasMore, cursor)`: Append posts (pagination)
- `addPost(post)`: Prepend single post
- `updatePost(postId, updates)`: Update specific post
- `removePost(postId)`: Remove post from feed
- `replacePost(postId, newPost)`: Replace post while preserving position

#### Feed Utils
- `feedUtils.getFeedStore(feedType)`: Get hot or new feed store
- `feedUtils.updatePostInFeeds(postId, updates)`: Update post across all feeds
- `feedUtils.removePostFromFeeds(postId)`: Remove post from all feeds

### Realtime System

**Architecture**: The app uses Supabase realtime with a sophisticated connection manager for reliability.

#### Connection Management (`src/lib/realtime/connectionManager.ts`)
- Exponential backoff with jitter for reconnection
- Browser visibility and network state handling
- Heartbeat monitoring for connection health
- Automatic resubscription after reconnection

#### Subscription Manager (`src/lib/realtime/subscriptionManager.ts`)
- Manages multiple channel subscriptions
- Tracks subscription state and health
- Handles automatic resubscription on reconnect

#### Optimistic Updates (`src/lib/realtime/optimisticUpdates.ts`)
- Immediate UI updates for votes and posts
- Rollback on error with user feedback
- Conflict resolution for concurrent updates

#### Realtime Store (`src/lib/stores/realtime.ts`)
Main API for realtime functionality:
- `realtime.initialize(supabase)`: Initialize connection manager
- `realtime.subscribeToFeed(feedType, onUpdate)`: Subscribe to feed updates
- `realtime.subscribeToThread(threadId, onUpdate)`: Subscribe to thread updates
- `realtime.disconnect()`: Cleanup all connections

#### Realtime Events
Tables enabled for realtime in `supabase/config.toml` and migrations:
- `posts`: INSERT, UPDATE, DELETE events
- `comments`: INSERT, UPDATE, DELETE events
- `votes`: INSERT, UPDATE, DELETE events

### API Layer

**PostsAPI** (`src/lib/api/posts.ts`): Main API class for data operations

#### Key Methods
- `getFeedPosts(feedType, cursor, limit, currentUser)`: Paginated feed with N+1 prevention
- `getPost(postId, currentUser)`: Single post with full thread
- `getPostReplies(postId, offset, limit, currentUser)`: Top-level comments
- `getCommentReplies(commentId, currentUser, depth, maxDepth)`: Nested replies (max depth 2)
- `createPost(data, currentUser)`: Create post via RPC
- `createComment(data, currentUser)`: Create comment via RPC
- `voteOnPost(postId, voteType, currentUser)`: Vote via RPC
- `voteOnComment(commentId, voteType, currentUser)`: Vote via RPC
- `deletePost(postId, currentUser)`: Soft delete via RPC
- `deleteComment(commentId, currentUser)`: Soft delete via RPC

#### N+1 Prevention
The API batches related data fetches:
- `getAnonymousProfiles(userIds)`: Batch fetch user profiles
- `attachAnonymousIdentities(items)`: Attach profiles to posts/comments
- `addUserVotesToPosts/Comments(items, userId)`: Batch fetch user votes
- Feed replies: Single query fetches all top 2 replies for all posts

### Component Structure

#### Key Components
- `Feed.svelte`: Main feed component with infinite scroll and pull-to-refresh
- `PostCard.svelte`: Post display with voting, replies preview, actions
- `CommentCard.svelte`: Comment display with nested threading
- `VoteButtons.svelte`: Voting UI with optimistic updates
- `AnonymousAvatar.svelte`: Subway line badge display
- `ComposeModal.svelte`: Post/comment composition with character limit
- `BottomNav.svelte`: Mobile bottom navigation
- `ConnectionStatus.svelte`: Realtime connection indicator
- `PullToRefresh.svelte`: Pull-to-refresh gesture handler

#### UI Component Library
Uses `shadcn-svelte` components in `src/lib/components/ui/`:
- Button, Card, Input, Textarea, Sonner (toasts)

### Routing (SvelteKit)

- `/` (`src/routes/+page.svelte`): Home feed (hot/new tabs)
- `/thread/[id]` (`src/routes/thread/[id]/+page.svelte`): Thread detail view
- `+layout.svelte`: App shell with header, toaster, bottom nav

### Styling

- **Framework**: Tailwind CSS 4.x
- **Theme**: Dark mode only (`+layout.svelte:14-17` forces dark)
- **Custom colors**: MTA subway line colors defined in `app.css`
- **Mobile-first**: Safe area insets for iOS notch (`padding-bottom: env(safe-area-inset-bottom)`)
- **Scrollbar hiding**: Aggressive hiding across all browsers including iOS

## Common Patterns

### Creating a Post
```typescript
import { supabase } from '$lib/supabase'
import { PostsAPI } from '$lib/api/posts'
import { get } from 'svelte/store'
import { currentUser } from '$lib/stores'

const api = new PostsAPI(supabase)
const user = get(currentUser)

const post = await api.createPost(
  { content: 'Hello YipYap!' },
  user
)
```

### Subscribing to Realtime Updates
```typescript
import { realtime } from '$lib/stores/realtime'
import { feedUtils } from '$lib/stores/feeds'

// In component onMount
const unsubscribe = realtime.subscribeToFeed('hot', (update) => {
  if (update.eventType === 'INSERT') {
    feedUtils.addPostToFeeds(update.new)
  }
})

// Cleanup
onDestroy(() => {
  unsubscribe()
})
```

### Optimistic Voting
```typescript
import { voteOnPost } from '$lib/services/voting'

async function handleVote(postId: string, newVote: 'up' | 'down' | null) {
  await voteOnPost(postId, newVote, currentUser, feedStore)
  // Optimistic update happens immediately
  // Rollback on error with toast notification
}
```

### Using Feed Stores
```typescript
import { hotFeed, activeFeedType } from '$lib/stores/feeds'

// Update a post across all feeds
feedUtils.updatePostInFeeds(postId, {
  vote_score: newScore,
  user_vote: newVote
})

// Remove deleted post from all feeds
feedUtils.removePostFromFeeds(postId)
```

## Important Constraints

### Database Constraints
- **Content length**: Posts and comments must be 1-500 characters (migration 017)
- **Comment depth**: Maximum depth of 1 (replies to replies blocked)
- **Voting**: Users can only vote up/down, not both (vote_type constraint)
- **Deletion**: Soft deletes only via RPCs that verify ownership

### Rate Limits (per hour)
- Posts: 10/hour per user
- Comments: 30/hour per user
- Votes: 50/hour per user

### RLS Security
- All writes blocked except via RPCs
- Users can only delete their own content
- Vote manipulation prevented by unique constraints

## Supabase Configuration

**Ports**:
- API: 54321
- DB: 54322
- Studio: 54323
- Inbucket (email): 54324

**Realtime**: Enabled for posts, comments, votes tables
**Auth**: Disabled (anonymous only, `enable_signup = false`)
**Storage**: Enabled (50MiB limit)

## Type Safety

All types defined in `src/lib/types/index.ts`:
- Database schema types mirror Supabase tables
- Enhanced types include relationships (e.g., `PostWithStats` includes `anonymous_user` and `replies`)
- API responses typed with `PaginatedResponse<T>` and `ApiResponse<T>`

## Migration Strategy

When creating new migrations:
1. Create SQL file in `supabase/migrations/` with format `NNN_description.sql`
2. Test locally with `supabase db reset --yes`
3. Update TypeScript types in `src/lib/types/index.ts` if schema changes
4. If adding tables, consider RLS policies and realtime configuration
5. If modifying user-facing fields, update display components

## Debugging

- **Connection issues**: Check `ConnectionStatus.svelte` indicator
- **RLS errors**: Verify using correct RPC, not direct table access
- **Realtime not working**: Check `supabase/config.toml` has table in realtime publication
- **Vote not updating**: Check optimistic update rollback in browser console
- **Type errors**: Run `npm run check` for Svelte type checking