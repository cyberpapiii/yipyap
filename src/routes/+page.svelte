<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { Button } from '$lib/components/ui'
  import { supabase } from '$lib/supabase'
  import Feed from '$lib/components/Feed.svelte'
  import ComposeModal from '$lib/components/ComposeModal.svelte'
  import { composeStore, feedUtils, activeFeedType, realtime, anonymousUser as currentUserStore } from '$lib/stores'
  import type { FeedStore } from '$lib/stores/feeds'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import type { FeedType } from '$lib/types'
  import { ensureAnonymousUser } from '$lib/auth'

  const api = createRealtimeAPI(supabase as any)
  const cu = currentUserStore

  let feedType = $state<FeedType>('hot')
  let initializing = $state(false)

  onMount(async () => {
    if (!browser) return

    const saved = (localStorage.getItem('yipyap_feed') as FeedType) || 'hot'
    feedType = saved

    initializing = true
    try {
      if (!realtime.getState().isInitialized) {
        await realtime.initialize(supabase as any)
      }
      await switchFeed(saved, { skipPersist: true })
    } finally {
      initializing = false
    }
  })

  async function switchFeed(type: FeedType, options: { skipPersist?: boolean } = {}) {
    const store = feedUtils.getFeedStore(type)
    const existing = get(store)

    feedType = type
    if (!options.skipPersist) {
      localStorage.setItem('yipyap_feed', type)
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
      const response = cursor
        ? await api.getFeedPosts(type, cursor, 20, currentUser)
        : await api.loadFeedWithRealtime(type, undefined, 20, currentUser)

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

  async function onSubmit(content: string, replyTo?: any) {
    let user = get(cu)
    if (!user) {
      try {
        user = await ensureAnonymousUser(supabase as any) || undefined
      } catch (error) {
        console.error('Failed to bootstrap anonymous user for submit', error)
      }
    }

    if (!user) {
      composeStore.setError('Unable to create anonymous identity. Please try again.')
      return
    }

    try {
      if (replyTo) {
        await api.createCommentOptimistic({ content, postId: replyTo.id, parentCommentId: null }, user)
      } else {
        await api.createPostOptimistic({ content }, user)
      }
      composeStore.closeModal()
    } catch (e) {
      composeStore.setError('Failed to submit')
    }
  }
</script>

<div class="min-h-screen bg-background font-sans">
  <div class="max-w-md mx-auto animate-fade-in">
    <!-- Feed Toggle -->
    <div class="px-4 pt-4 flex justify-center">
      <div class="relative inline-flex bg-muted rounded-lg p-1.5">
        <!-- Sliding indicator -->
        <div
          class="absolute top-1.5 bottom-1.5 bg-primary rounded-md transition-all duration-300 ease-out {feedType === 'new' ? 'translate-x-0' : 'translate-x-full'}"
          style="width: calc(50% - 6px);"
        ></div>

        <button
          onclick={() => switchFeed('new')}
          class="relative z-10 text-lg font-bold px-6 py-2 rounded-md transition-all duration-200 {feedType === 'new' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        >
          New <span class="w-3 inline-block text-center">{#if feedType === 'new'}●{/if}</span>
        </button>

        <button
          onclick={() => switchFeed('hot')}
          class="relative z-10 text-lg font-bold px-6 py-2 rounded-md transition-all duration-200 {feedType === 'hot' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        >
          Hot <span class="w-3 inline-block text-center">{#if feedType === 'hot'}●{/if}</span>
        </button>
      </div>
    </div>

    <!-- Feed component uses feed stores internally -->
    <Feed
      {feedType}
      onVote={onVote}
      onReply={onReply}
      onLoadMore={loadMore}
    />

    <ComposeModal onSubmit={onSubmit} />
  </div>
</div>
