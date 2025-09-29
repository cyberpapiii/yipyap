<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy, onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { Button } from '$lib/components/ui'
  import PostCard from '$lib/components/PostCard.svelte'
  import CommentCard from '$lib/components/CommentCard.svelte'
  import ComposeModal from '$lib/components/ComposeModal.svelte'
  import { composeStore, threadStore, realtime, anonymousUser as currentUserStore } from '$lib/stores'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import type { CommentWithStats, ComposeState, PostWithStats } from '$lib/types'
  import { supabase } from '$lib/supabase'

  const thread = threadStore
  const currentUser = currentUserStore
  const api = createRealtimeAPI(supabase as any)
  const pageStore = page

  let postId = $state('')
  let initializing = $state(false)
  let loadError: string | null = $state(null)

  onMount(async () => {
    if (!browser) return

    const pageData = get(pageStore)
    postId = pageData.params.id

    initializing = true
    try {
      if (!realtime.getState().isInitialized) {
        await realtime.initialize(supabase as any)
      }

      await hydrateThread(postId)
      await realtime.subscribeToThread(postId)
    } catch (error) {
      console.error('Thread load failed', error)
      loadError = error instanceof Error ? error.message : 'Failed to load thread'
    } finally {
      initializing = false
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
      const fetchedPost = await api.getPost(id, user)
      if (!fetchedPost) {
        loadError = 'Thread not found'
        thread.setError(loadError)
        return
      }

      thread.setPost(fetchedPost)

      const replies = await api.getPostReplies(id, 0, 50, user)
      thread.setComments(replies.data)
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
    if (!post) return

    if (target && 'post_id' in target) {
      composeStore.setupReply(target, 'comment')
    } else {
      composeStore.setupReply(target ?? post, 'post')
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
</script>

<svelte:head>
  <title>Thread</title>
</svelte:head>

{#if initializing || $thread.loading}
  <div class="max-w-2xl mx-auto p-4 space-y-4">
    <div class="h-28 rounded-xl bg-muted animate-pulse"></div>
    <div class="h-40 rounded-xl bg-muted animate-pulse"></div>
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

<!-- Floating reply text box -->
<div class="fixed bottom-20 left-4 right-4 max-w-2xl mx-auto z-10 pb-4">
  <div class="bg-card border border-border rounded-2xl shadow-lg">
    <button
      class="w-full text-left text-muted-foreground text-sm p-3 rounded-xl hover:bg-accent/50 transition-colors"
      onclick={() => beginReply()}
    >
      Add a reply...
    </button>
  </div>
</div>

<ComposeModal onSubmit={onSubmit} />
