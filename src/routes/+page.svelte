<script lang="ts">
  import { browser } from '$app/environment'
  import { pushState } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { supabase } from '$lib/supabase'
  import Feed from '$lib/components/feed/Feed.svelte'
  import SwipeableFeeds from '$lib/components/feed/SwipeableFeeds.svelte'
  import CommunitySelector from '$lib/components/community/CommunitySelector.svelte'
  import ThreadOverlay from '$lib/components/thread/ThreadOverlay.svelte'
  import { RefreshCw } from 'lucide-svelte'
  import { composeStore, feedUtils, activeFeedType, realtime, anonymousUser as currentUserStore } from '$lib/stores'
  import { communityStore } from '$lib/stores/community'
  import type { FeedStore } from '$lib/stores/feeds'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import type { FeedType, CommunityType, GeographicCommunity, PostWithStats } from '$lib/types'
  import { ensureAnonymousUser } from '$lib/auth'
  import { PostsAPI } from '$lib/api/posts'
  import { hapticsStore } from '$lib/stores/haptics'

  const api = createRealtimeAPI(supabase as any)
  const postsApi = new PostsAPI(supabase as any)
  const cu = currentUserStore
  const selectedDisplayCommunity = $derived(
    $communityStore.selectedPostCommunity === 'dimes_square'
      ? 'dimes_square'
      : $communityStore.selectedCommunity
  )

  const { data } = $props<{
    data: {
      initialFeed?: {
        feedType: FeedType
        community: CommunityType
        posts: PostWithStats[]
        hasMore: boolean
        cursor: string | null
        timestamp: number
      } | null
    }
  }>()

  const setFeedCookie = (type: FeedType) => {
    if (!browser) return
    // 1 year
    document.cookie = `bingbong_feed=${type}; Max-Age=31536000; Path=/; SameSite=Lax`
  }

  const getInitialFeedType = (): FeedType => {
    if (!browser) return 'hot'
    try {
      const raw = localStorage.getItem('bingbong_feed')
      return raw === 'new' ? 'new' : 'hot'
    } catch {
      return 'hot'
    }
  }

  // Prefer SSR-selected feedType (cookie-backed) to avoid hydration flicker.
  let feedType = $state<FeedType>(data.initialFeed?.feedType ?? getInitialFeedType())
  let initializing = $state(false)
  let refreshing = $state(false)
  let lastFeedSync = $state(0)
  const REFRESH_COOLDOWN_MS = 8000

  // Shallow routing: thread overlay state from page.state OR query param
  // Query param is used for direct URL access (shared links, refresh)
  const openThreadId = $derived.by(() => {
    // First check page state (for in-app shallow navigation)
    const stateThreadId = ($page.state as { threadId?: string })?.threadId
    if (stateThreadId) return stateThreadId
    // Fall back to query param (for direct URL access)
    return $page.url.searchParams.get('thread')
  })

  // Open thread using shallow routing (feed stays mounted!)
  function openThread(postId: string) {
    if (!browser) return
    // Push state with thread ID - URL changes but page doesn't navigate
    pushState(`/thread/${postId}`, { threadId: postId })
  }

  // Close thread overlay
  function closeThread() {
    if (!browser) return
    // Check if we came from a query param (direct link) vs pushState
    const hasQueryParam = $page.url.searchParams.get('thread')
    if (hasQueryParam) {
      // For direct links, replace URL to remove query param
      pushState('/', {})
    } else {
      // For in-app navigation, go back in history
      history.back()
    }
  }

  const FEED_CACHE_PREFIX = 'bingbong_feed_cache_v1'
  const INITIAL_FEED_LIMIT = 12
  const PAGINATED_FEED_LIMIT = 15
  const REFRESH_FEED_LIMIT = 15
  let feedLoadSeq = 0

  // Derived feed store for header
  const currentFeedStore = $derived.by(() => feedUtils.getFeedStore(feedType))

  const getCacheKey = (type: FeedType, community: CommunityType | GeographicCommunity) =>
    `${FEED_CACHE_PREFIX}:${type}:${community}`

  const loadCachedFeed = (type: FeedType, community: CommunityType | GeographicCommunity) => {
    if (!browser) return null
    try {
      const raw = sessionStorage.getItem(getCacheKey(type, community))
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        posts: PostWithStats[]
        hasMore: boolean
        cursor: string | null
        timestamp: number
      }
      return parsed
    } catch {
      return null
    }
  }

  const saveCachedFeed = (type: FeedType, community: CommunityType | GeographicCommunity, payload: {
    posts: PostWithStats[]
    hasMore: boolean
    cursor: string | null
    timestamp: number
  }) => {
    if (!browser) return
    try {
      sessionStorage.setItem(getCacheKey(type, community), JSON.stringify(payload))
    } catch {
      // Ignore quota/cache errors
    }
  }

  const getCommunityFilters = (): {
    subwayLineCommunity: CommunityType
    geographicCommunity: GeographicCommunity | undefined
  } => {
    const communityState = get(communityStore)
    const geographicCommunity =
      communityState.selectedPostCommunity === 'dimes_square' ? 'dimes_square' : undefined
    const subwayLineCommunity = geographicCommunity ? 'nyc' : communityState.selectedCommunity
    return { subwayLineCommunity, geographicCommunity }
  }

  // Watch for community changes and reload feed
  $effect(() => {
    const communityKey = `${$communityStore.selectedCommunity}:${$communityStore.selectedPostCommunity}`
    if (browser && !initializing) {
      // Reload current feed when community changes
      loadFeed(feedType)
    }
  })

  // Handle feed change from swipe
  function handleFeedChange(newFeed: FeedType) {
    switchFeed(newFeed)
  }

  // Handle community picker open
  function handleOpenPicker() {
    communityStore.openPicker()
  }

  // Handle refresh from header button
  async function handleRefresh() {
    if (refreshing) return

    // Allow manual refresh even inside cooldown, but still track timestamp
    refreshing = true
    hapticsStore.trigger('selection')

    try {
      await loadFeed(feedType)
      hapticsStore.trigger('navigation')
    } finally {
      refreshing = false
    }
  }

  // No scroll restoration needed - feed stays mounted with shallow routing!

  onMount(() => {
    if (!browser) return

    // Ensure SSR cookie stays in sync with local preference.
    setFeedCookie(feedType)

    ;(async () => {
      try {
        const navigation = await import('$app/navigation') as { prefetchRoutes?: (paths?: string[]) => Promise<void> }
        await navigation.prefetchRoutes?.(['/thread/[id]'])
      } catch {
        // Ignore preload failures
      }
    })()

    ;(async () => {
      const saved = feedType
      initializing = true
      try {
        const selectedCommunity = $communityStore.selectedCommunity
        const selectedPostCommunity = $communityStore.selectedPostCommunity
        const communityKey = selectedPostCommunity === 'dimes_square' ? 'dimes_square' : selectedCommunity
        const feedStore = feedUtils.getFeedStore(feedType)

        // If we already have posts in the client store (e.g. returning from a thread),
        // do NOT overwrite them with SSR data. This preserves the list shape so
        // SvelteKit/browser scroll restoration stays accurate.
        const existing = get(feedStore)
        if (existing.posts.length > 0) {
          const cachedMeta = loadCachedFeed(feedType, communityKey)
          lastFeedSync = cachedMeta?.timestamp ?? Date.now()
          initializing = false
          feedUtils.switchFeed(feedType)
          return
        }

        // If SSR provided an initial feed and it matches current filter, hydrate immediately
        // Don't wait for user - SSR feed is already available and user_vote can be null
        if (data.initialFeed && data.initialFeed.feedType === feedType && data.initialFeed.community === selectedCommunity) {
          feedStore.setPosts(data.initialFeed.posts)
          lastFeedSync = data.initialFeed.timestamp
          saveCachedFeed(feedType, communityKey, {
            posts: data.initialFeed.posts,
            hasMore: data.initialFeed.hasMore,
            cursor: data.initialFeed.cursor,
            timestamp: data.initialFeed.timestamp
          })

          // Mark initialization complete immediately since we have SSR data
          initializing = false
          feedUtils.switchFeed(feedType)

          // Refresh with user votes in background once user is available
          const currentUserValue = get(cu)
          if (!currentUserValue) {
            // Subscribe to user becoming available and refresh votes
            const unsubscribe = cu.subscribe(async (user) => {
              if (user) {
                unsubscribe()
                // Silently refresh to get user_vote states
                try {
                  const { subwayLineCommunity, geographicCommunity } = getCommunityFilters()
                  const freshData = await postsApi.getFeedPosts(
                    feedType,
                    undefined,
                    REFRESH_FEED_LIMIT,
                    user,
                    subwayLineCommunity,
                    geographicCommunity
                  )
                  const feedStore = feedUtils.getFeedStore(feedType)
                  feedStore.setPosts(freshData.data)
                  lastFeedSync = Date.now()
                } catch {
                  // Ignore - SSR data is still valid
                }
              }
            })
          }
          return
        }

        // Fall back to cached feed snapshot for instant render
        const cached = loadCachedFeed(feedType, communityKey)
        if (cached) {
          const feedStore = feedUtils.getFeedStore(feedType)
          feedStore.setPosts(cached.posts)
          lastFeedSync = cached.timestamp
        }

        await switchFeed(feedType, { skipPersist: true })
      } finally {
        initializing = false
      }
    })()

    // Refresh feed when page becomes visible (e.g., returning from another app/tab)
    // This handles cases outside SPA navigation (tab switching, app switching on mobile)
    const handleVisibilityChange = async () => {
      if (!document.hidden && browser) {
        const currentFeed = feedUtils.getFeedStore(feedType)
        const posts = get(currentFeed).posts
        const now = Date.now()
        const withinCooldown = now - lastFeedSync < REFRESH_COOLDOWN_MS

        // Only refresh if we have posts and aren't already loading
        if (posts.length > 0 && !get(currentFeed).loading && !withinCooldown) {
          try {
            // Fetch fresh data for visible posts to update comment counts
            const user = get(cu)
            const { subwayLineCommunity, geographicCommunity } = getCommunityFilters()
            const freshData = await postsApi.getFeedPosts(
              feedType,
              undefined,
              REFRESH_FEED_LIMIT,
              user,
              subwayLineCommunity,
              geographicCommunity
            )

            // Smart merge: update posts in-place to preserve scroll position
            // Using updatePost() instead of setPosts() avoids array replacement
            const currentState = get(currentFeed)
            const currentPostMap = new Map(currentState.posts.map(p => [p.id, p]))

            for (const freshPost of freshData.data) {
              const currentPost = currentPostMap.get(freshPost.id)
              if (!currentPost) continue // Skip posts not in current view

              // Determine the final values to use
              let finalVoteScore = freshPost.vote_score
              let finalUserVote = freshPost.user_vote ?? null

              if (currentPost.user_vote && !freshPost.user_vote) {
                // API hasn't caught up - preserve optimistic state
                finalVoteScore = currentPost.vote_score
                finalUserVote = currentPost.user_vote
              } else if (currentPost.user_vote && freshPost.user_vote &&
                  currentPost.user_vote === freshPost.user_vote &&
                  currentPost.vote_score !== freshPost.vote_score) {
                // Both agree on vote direction but differ in score - use higher
                finalVoteScore = Math.max(currentPost.vote_score, freshPost.vote_score)
                finalUserVote = currentPost.user_vote
              }

              // Update in-place to preserve DOM and scroll position
              currentFeed.updatePost(freshPost.id, {
                vote_score: finalVoteScore,
                user_vote: finalUserVote,
                comment_count: freshPost.comment_count
              })
            }
            lastFeedSync = now
          } catch (error) {
            console.error('Error refreshing feed on visibility change:', error)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  async function switchFeed(type: FeedType, options: { skipPersist?: boolean } = {}) {
    const store = feedUtils.getFeedStore(type)
    const existing = get(store)

    feedType = type
    if (!options.skipPersist) {
      localStorage.setItem('bingbong_feed', type)
      setFeedCookie(type)
    }

    // Haptic feedback for button-based feed switch only
    // Swipe haptics handled in SwipeableFeeds touchend (must be immediate)
    // Note: This only works for button clicks, not swipes (iOS gesture context issue)
    hapticsStore.trigger('navigation', true)

    feedUtils.switchFeed(type)

    if (!existing.posts.length) {
      store.clear()
      await loadFeed(type)
    }
  }

  async function loadFeed(type: FeedType, cursor?: string) {
    const requestSeq = ++feedLoadSeq
    const feedStore: FeedStore = feedUtils.getFeedStore(type)
    if (!cursor) {
      feedStore.setLoading(true)
    }

    try {
      const currentUser = get(cu) || undefined
      const { subwayLineCommunity, geographicCommunity } = getCommunityFilters()
      const requestKey = `${type}:${cursor ?? ''}:${subwayLineCommunity}:${geographicCommunity ?? 'nyc'}`

      const pageSize = cursor ? PAGINATED_FEED_LIMIT : INITIAL_FEED_LIMIT
      const response = cursor
        ? await api.getFeedPosts(type, cursor, pageSize, currentUser, subwayLineCommunity, geographicCommunity)
        : await api.loadFeedWithRealtime(type, undefined, pageSize, currentUser, subwayLineCommunity, geographicCommunity)

      // If the user switched feed/community while this request was in flight, ignore stale responses.
      if (requestSeq !== feedLoadSeq) return
      const nowFilters = getCommunityFilters()
      const nowKey = `${type}:${cursor ?? ''}:${nowFilters.subwayLineCommunity}:${nowFilters.geographicCommunity ?? 'nyc'}`
      if (nowKey !== requestKey) return

      if (cursor) {
        feedStore.addPosts(response.data, response.hasMore, response.nextCursor)
      } else {
        feedStore.setPosts(response.data)
      }

      // Track last sync time for cooldown gating
      lastFeedSync = Date.now()
      const communityState = get(communityStore)
      const communityKey = communityState.selectedPostCommunity === 'dimes_square'
        ? 'dimes_square'
        : communityState.selectedCommunity
      saveCachedFeed(type, communityKey, {
        posts: get(feedStore).posts,
        hasMore: response.hasMore,
        cursor: response.nextCursor ?? null,
        timestamp: lastFeedSync
      })
    } catch (error: any) {
      const message = error?.message || 'Failed to load feed'
      feedStore.setError(message)
    }
  }

  async function loadMore() {
    const store = feedUtils.getFeedStore(feedType)
    const state = get(store)
    if (state.loading || !state.hasMore) return

    store.setLoading(true)
    await loadFeed(feedType, state.cursor || undefined)
  }

  async function onVote(postId: string, vote: 'up' | 'down' | null) {
    const user = get(cu)
    if (!user) return

    await api.voteOnPostOptimistic(postId, vote, user)
  }

  function onReply(post: any) {
    composeStore.setupReply(post, 'post')
  }

  async function onDelete(postId: string) {
    const user = get(cu)

    if (!user) {
      console.error('No user found!')
      return
    }

    try {
      await api.deletePost(postId, user)

      // Refresh the current feed to remove the deleted post
      await loadFeed(feedType)
    } catch (error) {
      console.error('Failed to delete post:', error)
      alert('Failed to delete post. Please try again.')
    }
  }

</script>

<div class="min-h-screen bg-background font-sans">
  <div class="max-w-md mx-auto">
    <!-- Fixed Feed Header - stays in place while feeds swipe -->
    <div class="max-w-2xl mx-auto px-4">
      <div class="flex items-start justify-between sticky top-0 bg-background/90 backdrop-blur-md py-6 pt-8 px-2 z-10">
        <CommunitySelector
          selectedCommunity={selectedDisplayCommunity}
          postCount={$currentFeedStore.posts.length}
          onClick={handleOpenPicker}
        />
        <button
          onclick={handleRefresh}
          disabled={$currentFeedStore.loading || refreshing}
          class="
            p-3 rounded-xl transition-all duration-200 ease-out
            hover:bg-accent active:scale-95 active:bg-accent/70
            disabled:opacity-50 disabled:cursor-not-allowed
            touch-manipulation
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          "
          aria-label="Refresh feed"
          type="button"
        >
          <RefreshCw
            size={24}
            class={$currentFeedStore.loading || refreshing ? 'animate-spin' : 'transition-transform duration-200 hover:rotate-90'}
          />
        </button>
      </div>
    </div>

    <!-- Swipeable Feeds Container (only posts slide) -->
    <SwipeableFeeds activeFeed={feedType} onFeedChange={handleFeedChange}>
      {#snippet children({ feedType: currentFeed })}
        <Feed
          feedType={currentFeed}
          onVote={onVote}
          onReply={onReply}
          onDelete={onDelete}
          onLoadMore={loadMore}
          hideHeader={true}
        />
      {/snippet}
    </SwipeableFeeds>
  </div>

  <!-- Floating Feed Toggle - Page elements layer: z-1-99 -->
  <div class="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50">
    <div class="inline-flex bg-card border border-border rounded-full p-1 shadow-lg backdrop-blur-sm gap-1">
      <button
        onclick={() => switchFeed('new')}
        class="text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200"
        style={feedType === 'new'
          ? 'background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground));'
          : ''}
        class:text-muted-foreground={feedType !== 'new'}
        class:hover:text-foreground={feedType !== 'new'}
        class:hover:bg-accent={feedType !== 'new'}
      >
        New
      </button>

      <button
        onclick={() => switchFeed('hot')}
        class="text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200"
        style={feedType === 'hot'
          ? 'background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground));'
          : ''}
        class:text-muted-foreground={feedType !== 'hot'}
        class:hover:text-foreground={feedType !== 'hot'}
        class:hover:bg-accent={feedType !== 'hot'}
      >
        Hot
      </button>
    </div>
  </div>
</div>

<!-- Thread Overlay (shallow routing - feed stays mounted!) -->
{#if openThreadId}
  <ThreadOverlay postId={openThreadId} onClose={closeThread} />
{/if}
