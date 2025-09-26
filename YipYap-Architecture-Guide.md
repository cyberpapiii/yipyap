# YipYap Core Architecture Guide

## Overview

This document outlines the core SvelteKit application structure for YipYap, an anonymous social posting platform. The architecture is designed to be scalable, maintainable, and provide a solid foundation for other specialists to build upon.

## 📁 Project Structure

```
src/
├── lib/
│   ├── types/
│   │   └── index.ts              # All TypeScript type definitions
│   ├── stores/
│   │   ├── auth.ts               # Anonymous user authentication state
│   │   ├── feeds.ts              # Hot/New feed state management
│   │   ├── compose.ts            # Post composition state
│   │   ├── thread.ts             # Thread view state
│   │   └── index.ts              # Store exports
│   ├── components/
│   │   ├── AnonymousAvatar.svelte # Anonymous user identity display
│   │   ├── VoteButtons.svelte     # Upvote/downvote component
│   │   ├── PostCard.svelte        # Post display component
│   │   ├── CommentCard.svelte     # Comment display component
│   │   ├── Feed.svelte            # Feed container with infinite scroll
│   │   ├── ComposeModal.svelte    # Post/comment composition modal
│   │   └── index.ts               # Component exports
│   ├── api/
│   │   ├── posts.ts              # Posts/comments API functions
│   │   └── index.ts              # API exports
│   ├── utils/
│   │   └── date.ts               # Date formatting utilities
│   ├── auth.ts                   # Anonymous authentication utilities
│   ├── supabase.ts              # Supabase client configuration
│   ├── config.ts                # Application configuration
│   └── index.ts                 # Library exports
├── routes/
│   ├── +layout.svelte           # Main app layout with bottom navigation
│   ├── +layout.ts               # Layout load function (client)
│   ├── +layout.server.ts        # Layout load function (server)
│   ├── +page.svelte             # Hot feed (/)
│   ├── new/
│   │   └── +page.svelte         # New feed (/new)
│   ├── compose/
│   │   └── +page.svelte         # Compose page (/compose)
│   └── thread/
│       └── [id]/
│           └── +page.svelte     # Thread view (/thread/[id])
├── hooks.server.ts              # Server hooks for auth
├── app.html                     # HTML template
├── app.css                      # Global styles and CSS variables
└── app.d.ts                     # Global type declarations
```

## 🔧 Core Systems

### 1. Anonymous Authentication

YipYap uses a device-based anonymous authentication system:

- **Device Identification**: Uses browser fingerprinting + localStorage for device ID
- **Anonymous Identities**: Random emoji + color combinations (🎭 Purple Anonymous)
- **Server-side Creation**: Anonymous users created via server hooks
- **Client-side Caching**: User data cached in localStorage for performance

**Key Files:**
- `src/lib/auth.ts` - Authentication utilities
- `src/hooks.server.ts` - Server-side user creation
- `src/lib/stores/auth.ts` - Authentication state management

### 2. State Management

Uses Svelte 5 stores for reactive state management:

- **Auth Store**: Current anonymous user and device ID
- **Feed Stores**: Separate stores for hot/new feeds with pagination
- **Compose Store**: Modal state and form data
- **Thread Store**: Thread view and comments state

### 3. Component Architecture

**Core Components:**
- `AnonymousAvatar` - Displays user identity (emoji + color)
- `VoteButtons` - Handles upvoting/downvoting with animations
- `PostCard` - Post display with replies preview
- `CommentCard` - Nested comment display with threading
- `Feed` - Infinite scroll feed container
- `ComposeModal` - Modal for creating posts/comments

### 4. Routing & Navigation

**Routes:**
- `/` - Hot feed (trending posts)
- `/new` - New feed (chronological posts)
- `/compose` - Full-page compose view
- `/thread/[id]` - Thread view with comments

**Navigation:**
- Fixed bottom navigation bar
- Mobile-first design with safe area support
- Active route highlighting

### 5. Data Layer

**API Architecture:**
- `PostsAPI` class for all post/comment operations
- Server-side rendering with load functions
- Optimistic updates for voting
- Pagination support for feeds and comments

**Database Integration:**
- Supabase with TypeScript types
- SSR-compatible client configuration
- View-based queries for performance

## 🎨 Design System

### Color Scheme
- Dark mode optimized
- Purple primary color (#8b5cf6)
- Anonymous identity colors (purple, blue, green, orange, red)
- Vote colors (green for up, red for down)

### Typography & Spacing
- System font stack
- Consistent spacing with Tailwind classes
- Responsive design with mobile-first approach

## 🔌 Key Features Implemented

### ✅ Completed Core Features

1. **Anonymous Identity System**
   - Device-based identification
   - Emoji + color combinations
   - Persistent across sessions

2. **Responsive Layout**
   - Bottom navigation
   - Mobile-first design
   - Safe area support for iOS

3. **Post & Comment System**
   - Rich text support
   - Nested threading (3 levels deep)
   - Character limits (500 chars)

4. **Voting System**
   - Upvote/downvote functionality
   - Animated vote buttons
   - Score display with formatting

5. **Feed System**
   - Hot feed (score + time algorithm)
   - New feed (chronological)
   - Infinite scroll pagination

6. **Thread Views**
   - Full post display
   - Nested comment threading
   - Reply functionality

7. **Compose System**
   - Modal and full-page compose
   - Character counting
   - Reply context display

### 🚧 Ready for Implementation

The following are structured but need API integration:

- **Real-time Updates** - Supabase subscriptions
- **Push Notifications** - PWA notifications
- **Content Moderation** - Automated filtering
- **Media Support** - Image/video uploads
- **Search & Discovery** - Full-text search

## 🛠 Development Setup

### Environment Variables
Create `.env.local`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup
The application expects these Supabase tables:
- `anonymous_users` - User identities
- `posts` - Post content
- `comments` - Comment content
- `votes` - User votes
- `post_with_stats` - View with aggregated data
- `comment_with_stats` - View with aggregated data

### Running the Application
```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview build
```

## 🔗 Integration Points

### For Database Specialist
- Schema is defined in `src/lib/types/index.ts`
- Views needed: `post_with_stats`, `comment_with_stats`
- RLS policies for anonymous users
- Aggregation functions for vote counts

### For API Specialist
- API functions in `src/lib/api/posts.ts`
- Mock functions in route files need implementation
- Real-time subscriptions for live updates
- Caching strategies for performance

### For PWA Specialist
- Service worker registration
- Offline data caching
- Push notification setup
- App manifest configuration

### For Security Specialist
- Content sanitization in components
- Rate limiting for anonymous users
- Spam detection algorithms
- CSRF protection

## 📋 TODO Items

The following items have mock implementations and need real API integration:

1. **Feed Loading** - Replace console.log with actual API calls
2. **Voting** - Implement real vote persistence
3. **Post Creation** - Connect to Supabase insert functions
4. **Real-time Updates** - Add Supabase subscriptions
5. **Error Handling** - Implement proper error boundaries
6. **Loading States** - Add skeleton screens and spinners
7. **Performance** - Add component lazy loading
8. **Testing** - Add unit and integration tests

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] SSL certificates configured
- [ ] CDN setup for static assets
- [ ] Analytics integration
- [ ] Error monitoring (Sentry)
- [ ] Performance monitoring
- [ ] SEO optimization

---

This architecture provides a solid foundation for YipYap with proper separation of concerns, type safety, and scalability. Each system is designed to be easily extended and maintained as the application grows.