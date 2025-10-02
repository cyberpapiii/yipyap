# YipYap Project Structure

This document provides a comprehensive overview of the YipYap/BingBong codebase organization after the October 2025 cleanup and reorganization.

## 📁 Directory Overview

```
/Users/robdezendorf/Documents/GitHub/yipyap/
├── src/                          # Application source code
│   ├── routes/                   # SvelteKit pages and layouts
│   ├── lib/                      # Shared library code
│   │   ├── components/           # UI components (organized by feature)
│   │   ├── stores/               # Svelte stores for state management
│   │   ├── api/                  # API clients and data fetching
│   │   ├── services/             # Business logic and utilities
│   │   ├── realtime/             # Real-time connection management
│   │   ├── config/               # App configuration
│   │   ├── types/                # TypeScript type definitions
│   │   └── utils/                # Helper utilities
│   ├── app.html                  # HTML template
│   ├── app.css                   # Global styles
│   └── service-worker.js         # PWA service worker
│
├── static/                       # Static assets (icons, manifest)
├── supabase/                     # Database migrations and config
├── scripts/                      # Utility scripts (seeding, testing)
├── tests/                        # Test files
└── docs/                         # Project documentation
```

---

## 🧩 Component Organization

Components are organized by **feature/purpose** rather than dumped at the root level. This makes it easy to find related components and understand where to add new ones.

### Component Folder Structure

```
src/lib/components/
├── common/                       # Shared, generic components
│   └── LoadingSpinner.svelte     # Generic loading spinner
│
├── feed/                         # Post and comment display
│   ├── Feed.svelte               # Feed container with infinite scroll
│   ├── PostCard.svelte           # Individual post display
│   ├── PostCardSkeleton.svelte   # Loading placeholder for posts
│   ├── CommentCard.svelte        # Comment display with threading
│   ├── CommentCardSkeleton.svelte # Loading placeholder for comments
│   └── VoteButtons.svelte        # Voting UI with animations
│
├── community/                    # Identity and community features
│   ├── AnonymousAvatar.svelte    # Subway line badge/avatar
│   ├── SubwayLinePicker.svelte   # Subway line selection modal
│   ├── CommunityBadge.svelte     # Community badge display
│   ├── CommunityPicker.svelte    # Community filter modal
│   └── CommunitySelector.svelte  # Community dropdown button
│
├── compose/                      # Content creation
│   └── ComposeModal.svelte       # Post/comment composition modal
│
├── layout/                       # App structure and navigation
│   └── BottomNav.svelte          # Mobile bottom navigation bar
│
├── notifications/                # Notification system
│   ├── NotificationBadge.svelte  # Unread count badge
│   ├── NotificationCard.svelte   # Individual notification display
│   └── PushNotificationToggle.svelte # Push notification settings
│
└── ui/                           # shadcn-svelte component library
    ├── button/                   # Button components
    ├── card/                     # Card components
    ├── input/                    # Input components
    ├── textarea/                 # Textarea components
    └── sonner/                   # Toast notification components
```

### Where to Add New Components

| Component Type | Folder | Example |
|----------------|--------|---------|
| Post/comment display | `feed/` | RepostCard.svelte |
| User identity/profile | `community/` | ProfileCard.svelte |
| Content creation | `compose/` | ImageUploadModal.svelte |
| App navigation/chrome | `layout/` | TopHeader.svelte |
| Notification features | `notifications/` | NotificationSettings.svelte |
| Generic utilities | `common/` | ErrorBoundary.svelte |
| UI library components | `ui/` | (shadcn-svelte only) |

---

## 📂 Key Directories Explained

### `/src/routes/` - SvelteKit Pages

```
routes/
├── +layout.svelte                # Root layout (header, nav, modals)
├── +page.svelte                  # Home feed (hot/new tabs)
├── notifications/
│   └── +page.svelte              # Notifications & profile page
└── thread/[id]/
    └── +page.svelte              # Thread detail view
```

**Convention:** Each folder represents a route. `+page.svelte` is the page component, `+layout.svelte` wraps child pages.

### `/src/lib/stores/` - State Management

```
stores/
├── auth.ts                       # Anonymous user authentication
├── feeds.ts                      # Feed state (hot/new feeds)
├── thread.ts                     # Thread detail state
├── compose.ts                    # Compose modal state
├── realtime.ts                   # Real-time connection orchestration
├── community.ts                  # Community filter state
├── notifications.ts              # Notifications state
└── index.ts                      # Barrel export (re-exports all stores)
```

**Key Stores:**
- `authStore` / `currentUser` - Current anonymous user
- `hotFeed` / `newFeed` - Separate stores for each feed type
- `composeStore` - Controls compose modal visibility and state
- `realtime` - Manages WebSocket connections and subscriptions

### `/src/lib/api/` - Data Layer

```
api/
├── posts.ts                      # PostsAPI class - all CRUD operations
├── realtime.ts                   # RealtimePostsAPI - optimistic updates
└── index.ts                      # Barrel export
```

**Key Classes:**
- `PostsAPI` - Main data access layer (calls Supabase RPCs)
- `RealtimePostsAPI` - Wraps PostsAPI with optimistic update functionality

**Important:** All database writes MUST go through RPCs (e.g., `rpc_create_post`). Direct table access is blocked by Row-Level Security.

### `/src/lib/services/` - Business Logic

```
services/
├── auth.ts                       # Device fingerprinting, user creation
├── pushNotifications.ts          # Push notification handling
└── toastNotifications.ts         # Toast notification helpers
```

### `/src/lib/realtime/` - WebSocket Management

```
realtime/
├── connectionManager.ts          # Connection health, reconnection logic
├── subscriptionManager.ts        # Feed/thread channel subscriptions
├── optimisticUpdates.ts          # Optimistic UI updates with rollback
└── index.ts                      # Barrel export
```

**Architecture:**
- Connection manager handles WebSocket lifecycle
- Subscription managers handle channel subscriptions per feed/thread
- Optimistic update manager provides instant UI feedback

### `/src/lib/config/` - Configuration

```
config/
├── index.ts                      # App-wide configuration
└── communities.ts                # Community/subway line mappings
```

### `/src/lib/types/` - TypeScript Types

```
types/
└── index.ts                      # All type definitions (Database, API, UI)
```

**Key Types:**
- `Database` - Supabase schema types (tables, views, RPCs)
- `PostWithStats` - Post with vote/comment counts
- `CommentWithStats` - Comment with vote/reply counts
- `AnonymousUser` - Device-based anonymous user

---

## 🔑 Key Files and Their Purposes

### Core Application Files

| File | Purpose |
|------|---------|
| `src/app.html` | HTML template, service worker registration |
| `src/app.css` | Global styles, Tailwind imports, CSS variables |
| `src/app.d.ts` | Global TypeScript definitions (Locals, PageData) |
| `src/service-worker.js` | PWA service worker for offline support |

### Configuration Files

| File | Purpose |
|------|---------|
| `svelte.config.js` | SvelteKit configuration |
| `vite.config.ts` | Vite build tool configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | Dependencies and scripts |

### Database Files

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase local development config |
| `supabase/migrations/*.sql` | Database migration files (numbered) |

---

## 🎨 Import Path Examples

### Component Imports

```typescript
// Feed components
import Feed from '$lib/components/feed/Feed.svelte'
import PostCard from '$lib/components/feed/PostCard.svelte'
import VoteButtons from '$lib/components/feed/VoteButtons.svelte'

// Community components
import AnonymousAvatar from '$lib/components/community/AnonymousAvatar.svelte'
import CommunityPicker from '$lib/components/community/CommunityPicker.svelte'

// Layout components
import BottomNav from '$lib/components/layout/BottomNav.svelte'

// UI library (shadcn-svelte)
import { Button } from '$lib/components/ui'
import { Card } from '$lib/components/ui'
```

### Store Imports

```typescript
import { currentUser, authStore } from '$lib/stores/auth'
import { hotFeed, newFeed, activeFeedType } from '$lib/stores/feeds'
import { composeStore, showComposeModal } from '$lib/stores/compose'
import { realtime } from '$lib/stores/realtime'

// Or use barrel export
import { currentUser, composeStore, realtime } from '$lib/stores'
```

### API Imports

```typescript
import { PostsAPI } from '$lib/api/posts'
import { createRealtimeAPI } from '$lib/api/realtime'
```

### Type Imports

```typescript
import type {
  PostWithStats,
  CommentWithStats,
  AnonymousUser,
  Database
} from '$lib/types'
```

---

## 📝 Naming Conventions

### Components
- **PascalCase** for component files: `PostCard.svelte`, `AnonymousAvatar.svelte`
- **Descriptive names** that indicate purpose: `PostCardSkeleton` (not `PostLoader`)

### Stores
- **camelCase** for store files: `auth.ts`, `feeds.ts`
- **Descriptive exports**: `currentUser`, `hotFeed`, `composeStore`

### API Classes
- **PascalCase** for classes: `PostsAPI`, `RealtimePostsAPI`
- **Suffix with purpose**: `*API`, `*Manager`, `*Service`

### Types
- **PascalCase** for interfaces: `AnonymousUser`, `PostWithStats`
- **Descriptive names**: `PaginatedResponse<T>`, `ApiResponse<T>`

---

## 🚀 Adding New Features

### Example: Adding a "Trending" Feed

1. **Create route** (if needed): `src/routes/trending/+page.svelte`
2. **Add feed component**: Use existing `Feed.svelte` from `feed/` folder
3. **Add store**: Extend `src/lib/stores/feeds.ts` with `trendingFeed`
4. **Add API method**: Extend `PostsAPI` with `getTrendingPosts()`
5. **Wire up real-time**: Subscribe to trending feed in `realtime` store

### Example: Adding a "Direct Messages" Feature

1. **Create route**: `src/routes/messages/+page.svelte`
2. **Create components**:
   - `src/lib/components/messages/MessageList.svelte`
   - `src/lib/components/messages/MessageCard.svelte`
   - `src/lib/components/messages/MessageComposer.svelte`
3. **Add store**: `src/lib/stores/messages.ts`
4. **Add API**: Extend `PostsAPI` or create `MessagesAPI`
5. **Add types**: Define `Message`, `Conversation` types in `types/index.ts`

---

## 📚 Related Documentation

- **COMPONENT_GUIDE.md** - Quick reference table for component organization
- **CLAUDE.md** - Claude Code instructions and architecture overview
- **YipYap-Architecture-Guide.md** - Detailed architecture documentation
- **README.md** - Project setup and development guide

---

**Last Updated:** October 2025 (Post-Cleanup)
**Maintained By:** YipYap Development Team
