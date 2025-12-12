<script lang="ts">
	import { browser } from '$app/environment'
	import { onDestroy, onMount, tick } from 'svelte'
	import { get } from 'svelte/store'
	import { pushState, replaceState } from '$app/navigation'
	import { page } from '$app/stores'
	import { RefreshCw, ChevronDown, ArrowLeft } from 'lucide-svelte'
	import PostCard from '$lib/components/feed/PostCard.svelte'
	import CommentCard from '$lib/components/feed/CommentCard.svelte'
	import PostCardSkeleton from '$lib/components/feed/PostCardSkeleton.svelte'
	import CommentCardSkeleton from '$lib/components/feed/CommentCardSkeleton.svelte'
	import { composeStore, showComposeModal, threadStore, realtime, anonymousUser as currentUserStore, feedUtils, activeFeedType } from '$lib/stores'
	import { createRealtimeAPI } from '$lib/api/realtime'
	import type { CommentWithStats, ComposeState, PostWithStats } from '$lib/types'
	import { supabase } from '$lib/supabase'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		postId,
		onClose
	}: {
		postId: string
		onClose: () => void
	} = $props()

	const thread = threadStore
	const currentUser = currentUserStore
	const api = createRealtimeAPI(supabase as any)

	// Overlay animation state
	let isVisible = $state(false)
	let overlayElement: HTMLElement
	let contentElement: HTMLElement

	// Swipe-to-dismiss state
	let swipeStartX = 0
	let swipeCurrentX = 0
	let isDismissing = $state(false)
	let swipeOffset = $state(0)
	let isSwipingHorizontal = $state(false)
	let gestureAxis = $state<'none' | 'vertical' | 'horizontal'>('none')

	// Swipe constants
	const DISMISS_THRESHOLD = 100 // px to trigger dismiss
	const SWIPE_LOCK_THRESHOLD = 10 // px before we lock gesture direction

	// Loading state
	let initializing = $state(false)
	let loadError: string | null = $state(null)

	// Pull to refresh state
	let refreshing = $state(false)
	let pullToRefreshY = $state(0)
	let rawPullToRefreshY = $state(0)
	let isPulling = $state(false)
	let pullGestureAxis = $state<'none' | 'vertical' | 'horizontal'>('none')
	let startY = 0
	let currentY = 0
	let startX = 0
	let currentX = 0
	let pullRaf = 0

	const PULL_THRESHOLD = 80
	const MAX_PULL = 120
	const SCROLL_TOP_THRESHOLD = 5
	const GESTURE_LOCK_THRESHOLD = 10
	const PULL_SMOOTHING = 0.35

	// Helper functions from thread page
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

	function mergeCommentsRecursively(
		freshComments: CommentWithStats[],
		currentMap: Map<string, CommentWithStats>
	): CommentWithStats[] {
		return freshComments.map(fresh => {
			const current = currentMap.get(fresh.id)
			let mergedComment = fresh
			if (current?.user_vote) {
				if (!fresh.user_vote) {
					mergedComment = {
						...fresh,
						vote_score: current.vote_score,
						user_vote: current.user_vote
					}
				} else if (fresh.user_vote === current.user_vote && fresh.vote_score !== current.vote_score) {
					mergedComment = {
						...fresh,
						vote_score: Math.max(fresh.vote_score, current.vote_score),
						user_vote: fresh.user_vote
					}
				}
			}
			if (fresh.replies?.length) {
				mergedComment = {
					...mergedComment,
					replies: mergeCommentsRecursively(fresh.replies, currentMap)
				}
			}
			return mergedComment
		})
	}

	// Mount and load thread
	onMount(async () => {
		if (!browser) return

		// Animate in
		await tick()
		requestAnimationFrame(() => {
			isVisible = true
		})

		// Load thread data
		initializing = true
		try {
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

		// Setup swipe-to-dismiss listeners on overlay
		if (overlayElement) {
			overlayElement.addEventListener('touchstart', handleSwipeStart, { passive: true })
			overlayElement.addEventListener('touchmove', handleSwipeMove, { passive: false })
			overlayElement.addEventListener('touchend', handleSwipeEnd)
		}

		return () => {
			if (overlayElement) {
				overlayElement.removeEventListener('touchstart', handleSwipeStart)
				overlayElement.removeEventListener('touchmove', handleSwipeMove)
				overlayElement.removeEventListener('touchend', handleSwipeEnd)
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
			const activeType = get(activeFeedType)
			const feedStore = feedUtils.getFeedStore(activeType)
			const feedState = get(feedStore)
			const cachedPost = feedState.posts.find(p => p.id === id)

			if (cachedPost) {
				thread.setPost({
					...cachedPost,
					replies: []
				})
			}

			const [fetchedPost, replies] = await Promise.all([
				api.getPost(id, user),
				api.getPostReplies(id, 0, 50, user)
			])

			if (!fetchedPost) {
				loadError = 'Thread not found'
				thread.setError(loadError)
				return
			}

			// Smart merge for post
			if (cachedPost?.user_vote) {
				if (!fetchedPost.user_vote) {
					thread.setPost({
						...fetchedPost,
						vote_score: cachedPost.vote_score,
						user_vote: cachedPost.user_vote
					})
				} else if (fetchedPost.user_vote === cachedPost.user_vote) {
					thread.setPost({
						...fetchedPost,
						vote_score: Math.max(fetchedPost.vote_score, cachedPost.vote_score),
						user_vote: fetchedPost.user_vote
					})
				} else {
					thread.setPost(fetchedPost)
				}
			} else {
				thread.setPost(fetchedPost)
			}

			// Smart merge for comments
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

	// Swipe-to-dismiss handlers
	function handleSwipeStart(e: TouchEvent) {
		if (e.touches.length !== 1) return
		swipeStartX = e.touches[0].clientX
		swipeCurrentX = swipeStartX
		startX = swipeStartX
		startY = e.touches[0].clientY
		gestureAxis = 'none'
		isDismissing = false
		isSwipingHorizontal = false
	}

	function handleSwipeMove(e: TouchEvent) {
		if (e.touches.length !== 1) return

		swipeCurrentX = e.touches[0].clientX
		currentX = swipeCurrentX
		currentY = e.touches[0].clientY

		const deltaX = currentX - startX
		const deltaY = currentY - startY

		// Lock gesture direction
		if (gestureAxis === 'none') {
			const absX = Math.abs(deltaX)
			const absY = Math.abs(deltaY)
			if (absX > SWIPE_LOCK_THRESHOLD || absY > SWIPE_LOCK_THRESHOLD) {
				if (absX > absY * 1.2) {
					gestureAxis = 'horizontal'
					isSwipingHorizontal = true
				} else {
					gestureAxis = 'vertical'
					isSwipingHorizontal = false
				}
			}
		}

		// Only handle horizontal swipes for dismissal
		if (gestureAxis !== 'horizontal') return

		// Only allow swiping right (to dismiss)
		if (deltaX > 0) {
			e.preventDefault()
			swipeOffset = deltaX * 0.8 // Add some resistance
			isDismissing = deltaX > DISMISS_THRESHOLD
		}
	}

	function handleSwipeEnd() {
		if (gestureAxis !== 'horizontal') {
			swipeOffset = 0
			gestureAxis = 'none'
			return
		}

		const deltaX = swipeCurrentX - swipeStartX
		if (deltaX > DISMISS_THRESHOLD) {
			// Dismiss with animation
			hapticsStore.trigger('navigation')
			dismissOverlay()
		} else {
			// Snap back
			swipeOffset = 0
		}

		isDismissing = false
		gestureAxis = 'none'
		isSwipingHorizontal = false
	}

	async function dismissOverlay() {
		isVisible = false
		// Wait for animation
		await new Promise(resolve => setTimeout(resolve, 300))
		onClose()
	}

	function handleBackClick() {
		hapticsStore.trigger('navigation')
		dismissOverlay()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			dismissOverlay()
		}
	}

	// Pull to refresh handlers
	function schedulePullRender() {
		if (pullRaf) return
		pullRaf = requestAnimationFrame(() => {
			pullRaf = 0
			const next = pullToRefreshY + (rawPullToRefreshY - pullToRefreshY) * PULL_SMOOTHING
			if (Math.abs(rawPullToRefreshY - next) < 0.5) {
				pullToRefreshY = rawPullToRefreshY
				return
			}
			pullToRefreshY = next
			schedulePullRender()
		})
	}

	function resetPullState() {
		isPulling = false
		rawPullToRefreshY = 0
		schedulePullRender()
	}

	function isAtTop() {
		if (!contentElement) return true
		return contentElement.scrollTop <= SCROLL_TOP_THRESHOLD
	}

	async function refreshThread() {
		if ($thread.loading || refreshing) {
			resetPullState()
			return
		}

		refreshing = true
		hapticsStore.trigger('selection')

		try {
			await hydrateThread(postId)
			hapticsStore.trigger('navigation')
		} finally {
			refreshing = false
			rawPullToRefreshY = 0
			schedulePullRender()
			isPulling = false
		}
	}

	// Reply and voting handlers
	function beginReply(target?: CommentWithStats | PostWithStats) {
		const threadState = get(thread)
		const post = threadState.post
		if (!post) return

		if (target && 'post_id' in target) {
			composeStore.setupReply(target, 'comment')
		} else {
			const replyTarget = target ?? post
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
			if (error?.code === '23503' && error?.details?.includes('post_id')) {
				throw new Error('This post has been deleted. Redirecting to home...')
			}
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
			dismissOverlay()
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
			await hydrateThread(postId)
		} catch (error) {
			console.error('Failed to delete comment:', error)
			alert('Failed to delete comment. Please try again.')
		}
	}

	// Handle content scroll for pull-to-refresh
	function handleContentTouchStart(e: TouchEvent) {
		if ($showComposeModal) return
		if ($thread.loading || refreshing) return
		if (e.touches.length !== 1) return

		startX = e.touches[0].clientX
		startY = e.touches[0].clientY
		currentX = startX
		currentY = startY
		rawPullToRefreshY = 0
		pullToRefreshY = 0
		isPulling = false
		pullGestureAxis = 'none'
	}

	function handleContentTouchMove(e: TouchEvent) {
		if ($showComposeModal) {
			pullGestureAxis = 'none'
			resetPullState()
			return
		}
		if (e.touches.length !== 1) return

		currentX = e.touches[0].clientX
		currentY = e.touches[0].clientY
		const deltaX = currentX - startX
		const deltaY = currentY - startY

		if ($thread.loading || refreshing) {
			pullGestureAxis = 'none'
			resetPullState()
			return
		}

		const atTop = isAtTop()

		if (pullGestureAxis === 'none') {
			const absX = Math.abs(deltaX)
			const absY = Math.abs(deltaY)
			if (absX > GESTURE_LOCK_THRESHOLD || absY > GESTURE_LOCK_THRESHOLD) {
				if (absX > absY * 1.1) {
					pullGestureAxis = 'horizontal'
					resetPullState()
					return
				}
				if (absY > absX * 1.1) {
					pullGestureAxis = 'vertical'
				}
			}
		}

		if (pullGestureAxis === 'horizontal') {
			resetPullState()
			return
		}

		if (pullGestureAxis !== 'vertical') return

		if (!isPulling) {
			if (deltaY > 0 && atTop) {
				e.preventDefault()
				isPulling = true
				startY = currentY
				startX = currentX
				rawPullToRefreshY = 0
				schedulePullRender()
			}
			return
		}

		if (!atTop) {
			resetPullState()
			return
		}

		if (deltaY > 0) {
			e.preventDefault()
			rawPullToRefreshY = Math.min(deltaY * 0.5, MAX_PULL)
			schedulePullRender()
		} else {
			resetPullState()
		}
	}

	function handleContentTouchEnd() {
		if ($showComposeModal) {
			pullGestureAxis = 'none'
			resetPullState()
			return
		}
		if (!isPulling) return

		isPulling = false
		pullGestureAxis = 'none'

		if (pullToRefreshY >= PULL_THRESHOLD) {
			refreshThread()
		} else {
			rawPullToRefreshY = 0
			schedulePullRender()
		}
	}

	$effect(() => {
		if ($showComposeModal) {
			resetPullState()
		}
	})
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
	style:opacity={isVisible ? 1 : 0}
	onclick={handleBackdropClick}
	role="button"
	tabindex="-1"
	aria-label="Close thread"
/>

<!-- Overlay panel -->
<div
	bind:this={overlayElement}
	class="fixed inset-y-0 right-0 z-[101] w-full bg-background shadow-2xl transition-transform duration-300 ease-out overflow-hidden"
	style:transform={isVisible ? `translateX(${swipeOffset}px)` : 'translateX(100%)'}
	style:transition={isSwipingHorizontal ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'}
>
	<!-- Pull to refresh indicator -->
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
					<RefreshCw size={20} class={refreshing ? 'animate-spin' : ''} />
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

	<!-- Scrollable content -->
	<div
		bind:this={contentElement}
		class="h-full overflow-y-auto overscroll-y-none"
		style:transform={$showComposeModal ? '' : `translateY(${pullToRefreshY * 0.3}px)`}
		style:transition={!isPulling ? 'transform 0.3s ease-out' : ''}
		ontouchstart={handleContentTouchStart}
		ontouchmove={handleContentTouchMove}
		ontouchend={handleContentTouchEnd}
	>
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
				<!-- Back button -->
				<button
					onclick={handleBackClick}
					class="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center gap-1 group w-fit touch-manipulation"
				>
					<ArrowLeft size={16} class="transition-transform duration-200 group-hover:-translate-x-1" />
					<span>Back</span>
				</button>

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

				<!-- Bottom spacer for floating reply box -->
				<div class="h-32"></div>
			</div>
		{/if}
	</div>

	<!-- Floating reply text box -->
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

	<!-- Dismiss indicator on swipe -->
	{#if isDismissing}
		<div class="absolute left-4 top-1/2 -translate-y-1/2 text-accent animate-pulse">
			<ArrowLeft size={32} />
		</div>
	{/if}
</div>
