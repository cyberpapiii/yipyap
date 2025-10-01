<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { supabase } from '$lib/supabase'
  import Feed from '$lib/components/Feed.svelte'
  import { composeStore, feedUtils, activeFeedType, realtime, anonymousUser as currentUserStore } from '$lib/stores'
  import { communityStore } from '$lib/stores/community'
  import type { FeedStore } from '$lib/stores/feeds'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import type { FeedType } from '$lib/types'
  import { ensureAnonymousUser } from '$lib/auth'
  import { PostsAPI } from '$lib/api/posts'

  const api = createRealtimeAPI(supabase as any)
  const postsApi = new PostsAPI(supabase as any)
  const cu = currentUserStore

  let feedType = $state<FeedType>('hot')
  let initializing = $state(false)
  let feedContainer: HTMLElement
  let touchStartX = 0
  let touchEndX = 0
  let isSwiping = $state(false)

  // Watch for community changes and reload feed
  $effect(() => {
    const community = $communityStore.selectedCommunity
    if (browser && !initializing) {
      // Reload current feed when community changes
      loadFeed(feedType)
    }
  })

  // Swipe handling
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX
    touchEndX = e.touches[0].clientX // Initialize to start position
    isSwiping = true
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping) return
    touchEndX = e.touches[0].clientX
  }

  function handleTouchEnd() {
    if (!isSwiping) return
    isSwiping = false

    const swipeDistance = touchEndX - touchStartX
    const minSwipeDistance = 80 // Increased threshold to prevent accidental swipes

    // Only trigger if there was actual movement
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      // Swiped right - go to previous feed (new)
      if (swipeDistance > 0 && feedType === 'hot') {
        switchFeed('new')
      }
      // Swiped left - go to next feed (hot)
      else if (swipeDistance < 0 && feedType === 'new') {
        switchFeed('hot')
      }
    }

    touchStartX = 0
    touchEndX = 0
  }

  onMount(async () => {
    if (!browser) return

    const saved = (localStorage.getItem('yipyap_feed') as FeedType) || 'hot'
    feedType = saved

    initializing = true
    try {
      // Wait for user to be initialized before loading feed
      // This ensures is_user_post flags are set correctly on first load
      let currentUserValue = get(cu)
      if (!currentUserValue) {
        // Wait up to 2 seconds for user initialization
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000)
          const unsubscribe = cu.subscribe((user) => {
            if (user) {
              clearTimeout(timeout)
              unsubscribe()
              resolve()
            }
          })
        })
      }

      await switchFeed(saved, { skipPersist: true })
    } finally {
      initializing = false
    }

    // Refresh feed when page becomes visible (e.g., returning from thread page)
    // This ensures comment counts and other updates are reflected
    const handleVisibilityChange = async () => {
      if (!document.hidden && browser) {
        const currentFeed = feedUtils.getFeedStore(feedType)
        const posts = get(currentFeed).posts

        // Only refresh if we have posts and aren't already loading
        if (posts.length > 0 && !get(currentFeed).loading) {
          try {
            // Fetch fresh data for visible posts to update comment counts
            const user = get(cu)
            const community = get(communityStore).selectedCommunity
            const freshData = await postsApi.getFeedPosts(feedType, undefined, 20, user, community)

            // Update the feed store with fresh data
            currentFeed.setPosts(freshData.data)
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
      localStorage.setItem('yipyap_feed', type)
    }

    // Haptic feedback for feed switch
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    feedUtils.switchFeed(type)

    if (!existing.posts.length) {
      store.clear()
      await loadFeed(type)
    }
  }

  async function loadFeed(type: FeedType, cursor?: string) {
    const feedStore: FeedStore = feedUtils.getFeedStore(type)
    if (!cursor) {
      feedStore.setLoading(true)
    }

    try {
      const currentUser = get(cu) || undefined
      const community = get(communityStore).selectedCommunity
      const response = cursor
        ? await api.getFeedPosts(type, cursor, 20, currentUser, community)
        : await api.loadFeedWithRealtime(type, undefined, 20, currentUser, community)

      if (cursor) {
        feedStore.addPosts(response.data, response.hasMore, response.nextCursor)
      } else {
        feedStore.setPosts(response.data)
      }
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
    console.log('onDelete called with postId:', postId)
    console.log('Current user:', user)

    if (!user) {
      console.error('No user found!')
      return
    }

    try {
      console.log('Calling api.deletePost...')
      await api.deletePost(postId, user)
      console.log('Delete API call successful')

      // Refresh the current feed to remove the deleted post
      await loadFeed(feedType)
      console.log('Feed refreshed')
    } catch (error) {
      console.error('Failed to delete post:', error)
      alert('Failed to delete post. Please try again.')
    }
  }

</script>

<div
  class="min-h-screen bg-background font-sans"
  bind:this={feedContainer}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  <div class="max-w-md mx-auto animate-fade-in">

    <!-- Feed component uses feed stores internally -->
    <Feed
      {feedType}
      onVote={onVote}
      onReply={onReply}
      onDelete={onDelete}
      onLoadMore={loadMore}
    />
  </div>

  <!-- Floating Feed Toggle -->
  <div class="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-30">
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
