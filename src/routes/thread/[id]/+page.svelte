<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy, onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { RefreshCw, ChevronDown } from 'lucide-svelte'
  import PostCard from '$lib/components/feed/PostCard.svelte'
  import CommentCard from '$lib/components/feed/CommentCard.svelte'
  import PostCardSkeleton from '$lib/components/feed/PostCardSkeleton.svelte'
  import CommentCardSkeleton from '$lib/components/feed/CommentCardSkeleton.svelte'
  import { composeStore, showComposeModal, threadStore, realtime, anonymousUser as currentUserStore, feedUtils, activeFeedType } from '$lib/stores'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import type { CommentWithStats, ComposeState, PostWithStats } from '$lib/types'
  import { supabase } from '$lib/supabase'
  import { ensureAnonymousUser } from '$lib/auth'

  const thread = threadStore
  const currentUser = currentUserStore
  const api = createRealtimeAPI(supabase as any)
  const pageStore = page

  // Helper to flatten nested comments into a single array for lookup
  function flattenComments(comments: CommentWithStats[]): CommentWithStats[] {
    const result: CommentWithStats[] = []
    for (const comment of comments) {
      result.push(comment)
      if (comment.replies?.length) {
        result.push(...flattenComments(comment.replies))
      }
    }
    return result
  }

  // Helper to merge comments recursively, preserving optimistic vote updates
  function mergeCommentsRecursively(
    freshComments: CommentWithStats[],
    currentMap: Map<string, CommentWithStats>
  ): CommentWithStats[] {
    return freshComments.map(fresh => {
      const current = currentMap.get(fresh.id)

      // Merge vote state if user has an optimistic vote
      let mergedComment = fresh
      if (current?.user_vote) {
        if (!fresh.user_vote) {
          // API hasn't caught up - preserve optimistic state
          mergedComment = {
            ...fresh,
            vote_score: current.vote_score,
            user_vote: current.user_vote
          }
        } else if (fresh.user_vote === current.user_vote && fresh.vote_score !== current.vote_score) {
          // Both agree on vote direction but differ in score - use higher
          mergedComment = {
            ...fresh,
            vote_score: Math.max(fresh.vote_score, current.vote_score),
            user_vote: fresh.user_vote
          }
        }
      }

      // Recursively merge nested replies
      if (fresh.replies?.length) {
        mergedComment = {
          ...mergedComment,
          replies: mergeCommentsRecursively(fresh.replies, currentMap)
        }
      }

      return mergedComment
    })
  }

  let postId = $state('')
  let initializing = $state(false)
  let loadError: string | null = $state(null)

  // Pull to refresh state
  let threadContainer: HTMLElement
  let refreshing = $state(false)
  let pullToRefreshY = $state(0)
  let isPulling = $state(false)
  let gestureAxis = $state<'none' | 'vertical' | 'horizontal'>('none')
  let startY = 0
  let currentY = 0
  let startX = 0
  let currentX = 0

  // Pull to refresh constants
  const PULL_THRESHOLD = 80
  const MAX_PULL = 120
  const SCROLL_TOP_THRESHOLD = 5
  const GESTURE_LOCK_THRESHOLD = 10

  onMount(() => {
    if (!browser) return

    const pageData = get(pageStore)
    postId = pageData.params.id

    void (async () => {
      initializing = true
      try {
        // Layout already initialized user and realtime - load thread and subscribe in parallel
        await Promise.all([
          hydrateThread(postId),
          realtime.subscribeToThread(postId)
        ])
      } catch (error) {
        console.error('Thread load failed', error)
        loadError = error instanceof Error ? error.message : 'Failed to load thread'
      } finally {
        initializing = false
      }
    })()

    // Setup touch event listeners
    if (threadContainer) {
      threadContainer.addEventListener('touchstart', handleTouchStart, { passive: false })
      threadContainer.addEventListener('touchmove', handleTouchMove, { passive: false })
      threadContainer.addEventListener('touchend', handleTouchEnd)
      threadContainer.addEventListener('touchcancel', handleTouchCancel)
    }

    return () => {
      if (threadContainer) {
        threadContainer.removeEventListener('touchstart', handleTouchStart)
        threadContainer.removeEventListener('touchmove', handleTouchMove)
        threadContainer.removeEventListener('touchend', handleTouchEnd)
        threadContainer.removeEventListener('touchcancel', handleTouchCancel)
      }
    }
  })

  onDestroy(() => {
    if (postId) {
      realtime.unsubscribeFromThread(postId)
      thread.clear()
    }
  })

  async function hydrateThread(id: string) {
    thread.setLoading(true)
    try {
      const user = get(currentUser) || undefined

      // First, check if we have this post in the feed store with optimistic updates
      // This ensures vote counts are consistent between feed and thread
      const activeType = get(activeFeedType)
      const feedStore = feedUtils.getFeedStore(activeType)
      const feedState = get(feedStore)
      const cachedPost = feedState.posts.find(p => p.id === id)

      // If we have a cached post, use it immediately for consistent UX
      // This shows the optimistic vote count while we load fresh data
      if (cachedPost) {
        thread.setPost({
          ...cachedPost,
          replies: [] // Replies will be loaded from API
        })
      }

      // Fetch post and comments in parallel
      const [fetchedPost, replies] = await Promise.all([
        api.getPost(id, user),
        api.getPostReplies(id, 0, 50, user)
      ])

      if (!fetchedPost) {
        loadError = 'Thread not found'
        thread.setError(loadError)
        return
      }

      // Smart merge: preserve optimistic updates while using fresh data
      // This handles the race condition where user votes, navigates to thread
      // before the API call completes, and the DB hasn't updated yet
      if (cachedPost?.user_vote) {
        // User has an optimistic vote in the feed store
        if (!fetchedPost.user_vote) {
          // API hasn't caught up yet - preserve optimistic state entirely
          const mergedPost = {
            ...fetchedPost,
            vote_score: cachedPost.vote_score,
            user_vote: cachedPost.user_vote
          }
          thread.setPost(mergedPost)
        } else if (fetchedPost.user_vote === cachedPost.user_vote) {
          // API has the vote, but scores might differ due to race condition
          // Use the higher score (optimistic includes our vote, API might not yet)
          const mergedPost = {
            ...fetchedPost,
            vote_score: Math.max(fetchedPost.vote_score, cachedPost.vote_score),
            user_vote: fetchedPost.user_vote
          }
          thread.setPost(mergedPost)
        } else {
          // Vote directions differ - API is authoritative (user may have changed vote)
          thread.setPost(fetchedPost)
        }
      } else {
        // No optimistic vote in cache - use API data
        thread.setPost(fetchedPost)
      }

      // Smart merge for comments: preserve optimistic vote updates
      // This handles the race condition where user votes on a comment,
      // then pull-to-refresh happens before the API call completes
      const currentComments = get(thread).comments
      const currentCommentMap = new Map(
        flattenComments(currentComments).map(c => [c.id, c])
      )

      const mergedComments = mergeCommentsRecursively(replies.data, currentCommentMap)
      thread.setComments(mergedComments)
      loadError = null
    } catch (error: any) {
      loadError = error?.message || 'Failed to load thread'
      thread.setError(loadError)
    } finally {
      thread.setLoading(false)
    }
  }

  function beginReply(target?: CommentWithStats | PostWithStats) {
    const threadState = get(thread)
    const post = threadState.post
    if (!post) {
      console.error('Cannot reply: Post not found')
      return
    }

    // Validate target has required properties
    if (target && 'post_id' in target) {
      // Replying to a comment
      if (!target.id || !target.content || !target.anonymous_user) {
        console.error('Cannot reply: Invalid comment data', target)
        return
      }
      composeStore.setupReply(target, 'comment')
    } else {
      // Replying to the post
      const replyTarget = target ?? post
      if (!replyTarget.id || !replyTarget.content || !replyTarget.anonymous_user) {
        console.error('Cannot reply: Invalid post data', replyTarget)
        return
      }
      composeStore.setupReply(replyTarget, 'post')
    }
  }

  async function onSubmit(contentValue: string, replyTo?: ComposeState['replyTo']) {
    const user = get(currentUser)
    const threadState = get(thread)
    const post = threadState.post

    if (!user || !post) {
      throw new Error('You need an anonymous identity to reply.')
    }

    if (!contentValue.trim()) {
      throw new Error('Reply cannot be empty.')
    }

    try {
      if (replyTo?.type === 'comment') {
        await api.createCommentOptimistic(
          { content: contentValue, postId: post.id, parentCommentId: replyTo.id },
          user
        )
      } else {
        await api.createCommentOptimistic(
          { content: contentValue, postId: post.id },
          user
        )
      }
    } catch (error: any) {
      // Check for foreign key violation (post was deleted)
      if (error?.code === '23503' && error?.details?.includes('post_id')) {
        throw new Error('This post has been deleted. Redirecting to home...')
      }
      // Re-throw other errors
      throw error
    }
  }

  async function voteOnPost(vote: 'up' | 'down' | null) {
    const user = get(currentUser)
    const post = get(thread).post
    if (!user || !post) return

    await api.voteOnPostOptimistic(post.id, vote, user)
  }

  async function voteOnComment(commentId: string, vote: 'up' | 'down' | null) {
    const user = get(currentUser)
    if (!user) return

    await api.voteOnCommentOptimistic(commentId, vote, user)
  }

  async function onDelete(postId: string) {
    const user = get(currentUser)
    if (!user) return

    try {
      await api.deletePost(postId, user)
      // Redirect back to home after deleting the post
      window.location.href = '/'
    } catch (error) {
      console.error('Failed to delete post:', error)
      alert('Failed to delete post. Please try again.')
    }
  }

  async function onDeleteComment(commentId: string) {
    const user = get(currentUser)
    if (!user) return

    try {
      await api.deleteComment(commentId, user)
      // Refresh the thread to remove the deleted comment
      await hydrateThread(postId)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      alert('Failed to delete comment. Please try again.')
    }
  }

  // Pull to refresh handlers
  function resetPullState() {
    isPulling = false
    pullToRefreshY = 0
  }

  function getGlobalScrollTop() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0
    const doc = document.documentElement
    const body = document.body
    return (
      window.scrollY ??
      doc?.scrollTop ??
      body?.scrollTop ??
      0
    )
  }

  function isAtTop() {
    const containerTop = threadContainer ? threadContainer.scrollTop : 0
    if (containerTop > SCROLL_TOP_THRESHOLD) return false

    const globalTop = getGlobalScrollTop()
    return globalTop <= SCROLL_TOP_THRESHOLD
  }

  async function refreshThread() {
    if ($thread.loading || refreshing) {
      resetPullState()
      return
    }

    refreshing = true
    // Haptic feedback for refresh
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }

    try {
      await hydrateThread(postId)
      // Haptic feedback on completion
      if ('vibrate' in navigator) {
        navigator.vibrate(10)
      }
    } finally {
      refreshing = false
      pullToRefreshY = 0
      isPulling = false
    }
  }

  function handleTouchStart(e: TouchEvent) {
    // Disable pull-to-refresh when compose modal is open
    if ($showComposeModal) return
    if ($thread.loading || refreshing) return
    if (e.touches.length !== 1) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    currentX = startX
    currentY = startY
    pullToRefreshY = 0
    isPulling = false
    gestureAxis = 'none'
  }

  function handleTouchMove(e: TouchEvent) {
    // Disable pull-to-refresh when compose modal is open
    if ($showComposeModal) {
      gestureAxis = 'none'
      resetPullState()
      return
    }
    if (e.touches.length !== 1) return
    currentX = e.touches[0].clientX
    currentY = e.touches[0].clientY
    const deltaX = currentX - startX
    const deltaY = currentY - startY

    if ($thread.loading || refreshing) {
      gestureAxis = 'none'
      resetPullState()
      return
    }

    const atTop = isAtTop()

    // Ignore horizontal gestures (e.g. back-swipe / sideways movement) so we don't
    // accidentally show pull-to-refresh.
    if (gestureAxis === 'none') {
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      if (absX > GESTURE_LOCK_THRESHOLD || absY > GESTURE_LOCK_THRESHOLD) {
        if (absX > absY * 1.1) {
          gestureAxis = 'horizontal'
          resetPullState()
          return
        }
        if (absY > absX * 1.1) {
          gestureAxis = 'vertical'
        }
      }
    }

    if (gestureAxis === 'horizontal') {
      resetPullState()
      return
    }

    if (gestureAxis !== 'vertical') return

    if (!isPulling) {
      if (deltaY > 0 && atTop) {
        // Prevent iOS rubber-band overscroll from pulling the whole page
        e.preventDefault()
        isPulling = true
        startY = currentY
        startX = currentX
        pullToRefreshY = 0
      }
      return
    }

    if (!atTop) {
      resetPullState()
      return
    }

    if (deltaY > 0) {
      e.preventDefault()
      pullToRefreshY = Math.min(deltaY * 0.5, MAX_PULL)
    } else {
      resetPullState()
    }
  }

  function handleTouchEnd() {
    // Disable pull-to-refresh when compose modal is open
    if ($showComposeModal) {
      gestureAxis = 'none'
      resetPullState()
      return
    }
    if (!isPulling) return

    isPulling = false
    gestureAxis = 'none'

    if (pullToRefreshY >= PULL_THRESHOLD) {
      refreshThread()
    } else {
      pullToRefreshY = 0
    }
  }

  function handleTouchCancel() {
    gestureAxis = 'none'
    resetPullState()
  }

  // Reset pull-to-refresh state whenever compose modal opens
  $effect(() => {
    if ($showComposeModal) {
      resetPullState()
    }
  })
</script>

<svelte:head>
  <title>Thread</title>
</svelte:head>

<div
  bind:this={threadContainer}
  class="min-h-screen bg-background overscroll-y-none"
  style:transform={$showComposeModal ? '' : `translateY(${pullToRefreshY * 0.3}px)`}
  style:transition={!isPulling ? 'transform 0.3s ease-out' : ''}
>
  <!-- Pull to refresh indicator - Page elements layer: z-1-99 -->
  {#if pullToRefreshY > 0}
    <div
      class="absolute top-0 left-0 right-0 z-30 flex items-center justify-center backdrop-blur-sm"
      style:height="80px"
      style:background="linear-gradient(to bottom, rgba(16, 16, 16, 0.95) 0%, rgba(16, 16, 16, 0.8) 50%, transparent 100%)"
      style:transform={`translateY(-${80 - pullToRefreshY}px)`}
      style:transition={!isPulling ? 'transform 0.3s ease-out' : ''}
      style:border-bottom="2px solid #6B6B6B"
    >
      <div class="flex items-center gap-2 text-accent">
        {#if pullToRefreshY >= PULL_THRESHOLD}
          <RefreshCw
            size={20}
            class={refreshing ? 'animate-spin' : 'animate-pull-refresh'}
          />
          <span class="text-sm font-medium">
            {refreshing ? 'Refreshing...' : 'Release to refresh'}
          </span>
        {:else}
          <ChevronDown
            size={20}
            class="transition-transform duration-200"
            style={`transform: rotate(${Math.min(pullToRefreshY / PULL_THRESHOLD * 180, 180)}deg)`}
          />
          <span class="text-sm font-medium">Pull to refresh</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if initializing || $thread.loading}
    <div class="max-w-2xl mx-auto p-4 space-y-4">
      <PostCardSkeleton />
      <div class="space-y-2">
        <CommentCardSkeleton depth={0} delay={0} showReplies={false} />
        <CommentCardSkeleton depth={0} delay={1} showReplies={false} />
      </div>
    </div>
  {:else if loadError}
    <div class="p-8 text-center text-destructive">{loadError}</div>
  {:else if $thread.post}
    {@const post = $thread.post!}
    <div class="max-w-2xl mx-auto p-4 space-y-6 animate-fade-in">
    <a href="/" class="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center gap-1 group w-fit">
      <span class="transition-transform duration-200 group-hover:-translate-x-1">←</span>
      <span>Back</span>
    </a>

    <div class="pt-4">
      <PostCard
      post={post}
      isInThread={true}
      onVote={async (_postId, voteType) => voteOnPost(voteType)}
      onReply={() => beginReply()}
      onDelete={onDelete}
      />
    </div>

    <div>
      <h3 class="text-sm text-muted-foreground">Replies ({$thread.comments.length})</h3>
    </div>

    {#if $thread.comments.length}
      <div class="space-y-3">
        {#each $thread.comments as comment (comment.id)}
          <CommentCard
            comment={comment}
            onVote={(commentId, voteType) => voteOnComment(commentId, voteType)}
            onReply={beginReply}
            onDelete={onDeleteComment}
          />
        {/each}
      </div>
    {:else}
      <div class="p-6 border border-dashed border-line rounded-xl text-center text-sm text-muted-foreground">
        No replies yet. Be the first to join the conversation.
      </div>
    {/if}
    </div>
  {/if}
</div>

<!-- Floating reply text box - Page elements layer: z-1-99 -->
<div class="fixed bottom-20 left-4 right-4 max-w-2xl mx-auto z-50 pb-4">
  <div class="bg-card border border-border rounded-2xl shadow-lg">
    <button
      class="w-full text-left text-muted-foreground text-sm p-3 rounded-xl hover:bg-accent/50 transition-colors"
      onclick={() => beginReply()}
    >
      Add a reply...
    </button>
  </div>
</div>
