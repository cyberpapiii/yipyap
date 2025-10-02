# Component Organization Quick Reference

This guide provides a quick lookup table for where components belong in the YipYap codebase.

## 📋 Component Folder Reference Table

| Folder | Purpose | When to Use | Examples |
|--------|---------|-------------|----------|
| **`common/`** | Generic, reusable components with no domain-specific logic | Creating utility components used across multiple features | `LoadingSpinner`, `ErrorBoundary`, `EmptyState` |
| **`feed/`** | Post and comment display, voting, and interactions | Building features related to viewing or interacting with posts/comments | `PostCard`, `CommentCard`, `VoteButtons`, `Feed` |
| **`community/`** | User identity, subway lines, community features | Creating features related to user identity or community selection | `AnonymousAvatar`, `SubwayLinePicker`, `CommunityBadge` |
| **`compose/`** | Content creation and submission | Building features for creating posts, comments, or other content | `ComposeModal`, `ImageUploader`, `PollCreator` |
| **`layout/`** | App structure, navigation, and chrome | Creating app-level UI like headers, navigation, or sidebars | `BottomNav`, `TopHeader`, `Sidebar` |
| **`notifications/`** | Notification display and settings | Building notification-related features | `NotificationCard`, `NotificationBadge`, `NotificationSettings` |
| **`ui/`** | shadcn-svelte component library | ⚠️ **Reserved for shadcn-svelte only** - do not add custom components | `Button`, `Card`, `Input` |

---

## 🎯 Decision Tree: Where Does My Component Go?

```
Is it a shadcn-svelte component?
├─ YES → ui/ (managed by shadcn CLI)
└─ NO ↓

Is it completely generic with no domain logic?
├─ YES → common/ (e.g., LoadingSpinner, ErrorMessage)
└─ NO ↓

Does it display or interact with posts/comments?
├─ YES → feed/ (e.g., PostCard, CommentList, VoteButtons)
└─ NO ↓

Does it relate to user identity or communities?
├─ YES → community/ (e.g., UserAvatar, CommunityPicker)
└─ NO ↓

Does it create new content?
├─ YES → compose/ (e.g., PostComposer, CommentInput)
└─ NO ↓

Is it app-level navigation or layout?
├─ YES → layout/ (e.g., Header, Navigation, Footer)
└─ NO ↓

Is it notification-related?
├─ YES → notifications/ (e.g., NotificationList, NotificationBell)
└─ NO → Consider creating a new folder for your feature
```

---

## 📝 Component Examples by Folder

### `common/` - Generic Utilities

**Characteristics:**
- No business logic specific to YipYap
- Could be copy-pasted to any project
- Pure presentation or utility components

**Examples:**
```
common/
├── LoadingSpinner.svelte       # Generic spinner animation
├── ErrorBoundary.svelte        # Error handling wrapper
├── EmptyState.svelte           # "No results" placeholder
├── ConfirmDialog.svelte        # Generic confirmation modal
└── Tooltip.svelte              # Generic tooltip component
```

---

### `feed/` - Posts & Comments

**Characteristics:**
- Displays posts, comments, or related content
- Handles voting, replies, and post interactions
- Connected to the feed/thread stores

**Examples:**
```
feed/
├── Feed.svelte                  # Feed container with infinite scroll
├── PostCard.svelte              # Individual post display
├── PostCardSkeleton.svelte      # Loading placeholder
├── CommentCard.svelte           # Comment with threading
├── CommentCardSkeleton.svelte   # Loading placeholder
├── VoteButtons.svelte           # Upvote/downvote UI
├── ReplyButton.svelte           # Reply action button
└── ShareButton.svelte           # Share post button
```

**Potential Additions:**
- `PostActions.svelte` - Action menu (edit, delete, report)
- `EmbedCard.svelte` - Display embedded links/media
- `PollCard.svelte` - Display poll within post

---

### `community/` - Identity & Communities

**Characteristics:**
- Related to user identity (anonymous or otherwise)
- Community/subway line selection and display
- User profile features

**Examples:**
```
community/
├── AnonymousAvatar.svelte       # Subway line badge
├── SubwayLinePicker.svelte      # Change subway line modal
├── CommunityBadge.svelte        # Community badge display
├── CommunityPicker.svelte       # Filter by community modal
├── CommunitySelector.svelte     # Community dropdown
├── UserProfileCard.svelte       # User profile display
└── IdentityRerollButton.svelte  # Reroll thread identity
```

**Potential Additions:**
- `CommunityList.svelte` - Browse all communities
- `TrendingCommunities.svelte` - Show popular communities
- `CommunityInfo.svelte` - Community description/rules

---

### `compose/` - Content Creation

**Characteristics:**
- Forms and inputs for creating content
- Handles text input, validation, submission
- Connected to composeStore

**Examples:**
```
compose/
├── ComposeModal.svelte          # Main post/comment composer
├── ImageUploader.svelte         # Upload images to posts
├── PollCreator.svelte           # Create poll posts
├── CharacterCounter.svelte      # Show remaining characters
└── MentionAutocomplete.svelte   # @mention suggestions
```

**Potential Additions:**
- `DraftSaver.svelte` - Auto-save drafts
- `EmojiPicker.svelte` - Emoji selection for posts
- `LinkPreview.svelte` - Preview pasted URLs

---

### `layout/` - App Structure

**Characteristics:**
- Top-level app chrome
- Navigation elements
- Page structure components

**Examples:**
```
layout/
├── BottomNav.svelte             # Mobile bottom navigation
├── TopHeader.svelte             # App header/title bar
├── Sidebar.svelte               # Desktop sidebar navigation
├── PageContainer.svelte         # Standard page wrapper
└── TabBar.svelte                # Tab navigation (Hot/New/etc)
```

**Potential Additions:**
- `MobileDrawer.svelte` - Slide-out menu
- `Breadcrumbs.svelte` - Navigation breadcrumbs
- `Footer.svelte` - App footer with links

---

### `notifications/` - Notifications

**Characteristics:**
- Display notifications to users
- Manage notification preferences
- Handle push notification features

**Examples:**
```
notifications/
├── NotificationBadge.svelte     # Unread count indicator
├── NotificationCard.svelte      # Individual notification item
├── PushNotificationToggle.svelte # Enable/disable push
├── NotificationList.svelte      # List of all notifications
└── NotificationSettings.svelte  # Notification preferences
```

**Potential Additions:**
- `NotificationFilter.svelte` - Filter by notification type
- `NotificationPreferences.svelte` - Granular settings
- `NotificationSound.svelte` - Sound preferences

---

## 🔧 Import Path Quick Reference

### Absolute Imports (Preferred)

```typescript
// Feed components
import Feed from '$lib/components/feed/Feed.svelte'
import PostCard from '$lib/components/feed/PostCard.svelte'

// Community components
import AnonymousAvatar from '$lib/components/community/AnonymousAvatar.svelte'
import CommunityPicker from '$lib/components/community/CommunityPicker.svelte'

// Layout components
import BottomNav from '$lib/components/layout/BottomNav.svelte'

// Common components
import LoadingSpinner from '$lib/components/common/LoadingSpinner.svelte'

// UI library (barrel export)
import { Button, Card, Input } from '$lib/components/ui'
```

### Relative Imports (Within Same Folder)

```typescript
// Inside PostCard.svelte (feed folder)
import VoteButtons from './VoteButtons.svelte'  // Same folder
import AnonymousAvatar from '../community/AnonymousAvatar.svelte'  // Different folder
```

---

## ✅ Best Practices

### DO ✓
- **Use feature-based organization** - Group related components together
- **Keep components focused** - One component, one responsibility
- **Use descriptive names** - `PostCard` not `Card`, `VoteButtons` not `Buttons`
- **Co-locate related files** - Keep component and its skeleton/loading state together
- **Follow the folder conventions** - Don't create new folders without good reason

### DON'T ✗
- **Don't add components to root** - Always use a subfolder
- **Don't mix concerns** - Feed components shouldn't handle auth logic
- **Don't use generic names** - Avoid `Component.svelte` or `Item.svelte`
- **Don't nest too deeply** - Keep it flat (`feed/PostCard.svelte` not `feed/posts/card/PostCard.svelte`)
- **Don't create one-off folders** - If you only have one component, put it in an existing folder

---

## 🆕 Creating a New Component

### Step-by-Step Process

1. **Identify the component's primary purpose**
   - Is it for display? → `feed/`
   - Is it for creation? → `compose/`
   - Is it for navigation? → `layout/`
   - Is it generic? → `common/`

2. **Check if a similar component exists**
   - Look in the appropriate folder first
   - Consider extending an existing component

3. **Create the component file**
   ```bash
   touch src/lib/components/[folder]/[ComponentName].svelte
   ```

4. **Create a skeleton/loading version if needed**
   ```bash
   touch src/lib/components/[folder]/[ComponentName]Skeleton.svelte
   ```

5. **Import and use in your route/component**
   ```typescript
   import ComponentName from '$lib/components/[folder]/ComponentName.svelte'
   ```

---

## 📚 Related Documentation

- **PROJECT_STRUCTURE.md** - Complete project structure overview
- **CLAUDE.md** - Architecture and development guidelines
- **README.md** - Setup and development instructions

---

**Quick Tip:** When in doubt, ask yourself: "If I were looking for this component in 6 months, where would I expect to find it?" That's probably where it belongs.

**Last Updated:** October 2025 (Post-Cleanup)
