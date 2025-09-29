<script lang="ts">
	import { onMount, tick } from 'svelte'
	import { Loader2, RefreshCw, AlertCircle, ChevronDown } from 'lucide-svelte'
	import PostCard from './PostCard.svelte'
	import PostCardSkeleton from './PostCardSkeleton.svelte'
	import type { FeedType, PostWithStats } from '$lib/types'
	import { feedUtils } from '$lib/stores'

	let {
		feedType,
		onVote,
		onReply,
		onLoadMore
	}: {
		feedType: FeedType
		onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
		onReply?: (post: PostWithStats) => void
		onLoadMore?: () => Promise<void>
	} = $props()

	// Enhanced state management
	let loadingMore = $state(false)
	let feedContainer: HTMLElement
	let refreshing = $state(false)
	let pullToRefreshY = $state(0)
	let isPulling = $state(false)
	let startY = 0
	let currentY = 0

	// Pull to refresh constants
	const PULL_THRESHOLD = 80
	const MAX_PULL = 120

	const feedStore = $derived.by(() => feedUtils.getFeedStore(feedType))

	// Handle infinite scroll
	function handleScroll() {
		if (!feedContainer || loadingMore) return

		const { scrollTop, scrollHeight, clientHeight } = feedContainer
		const scrolled = scrollTop + clientHeight
		const threshold = scrollHeight - (clientHeight * 0.8)

		if (scrolled >= threshold && $feedStore.hasMore && !$feedStore.loading) {
			loadMore()
		}
	}

	// Load more posts
	async function loadMore() {
		if (!onLoadMore || $feedStore.loading || !$feedStore.hasMore) return

		loadingMore = true
		try {
			await onLoadMore()
		} finally {
			loadingMore = false
		}
	}

	// Enhanced refresh with pull-to-refresh
	async function refreshFeed() {
		if (!onLoadMore || $feedStore.loading) return

		refreshing = true
		// Haptic feedback for refresh
		if ('vibrate' in navigator) {
			navigator.vibrate(20)
		}

		try {
			feedStore.clear()
			await onLoadMore()
		} finally {
			refreshing = false
			pullToRefreshY = 0
			isPulling = false
		}
	}

	// Pull to refresh handlers
	function handleTouchStart(e: TouchEvent) {
		if (feedContainer.scrollTop === 0 && e.touches.length === 1) {
			startY = e.touches[0].clientY
			isPulling = true
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || e.touches.length !== 1) return

		currentY = e.touches[0].clientY
		const deltaY = currentY - startY

		if (deltaY > 0 && feedContainer.scrollTop === 0) {
			e.preventDefault()
			pullToRefreshY = Math.min(deltaY * 0.5, MAX_PULL)
		}
	}

	function handleTouchEnd() {
		if (!isPulling) return

		if (pullToRefreshY >= PULL_THRESHOLD) {
			refreshFeed()
		} else {
			pullToRefreshY = 0
		}
		isPulling = false
	}

	onMount(() => {
		if (!feedContainer) return

		feedContainer.addEventListener('scroll', handleScroll)
		feedContainer.addEventListener('touchstart', handleTouchStart, { passive: false })
		feedContainer.addEventListener('touchmove', handleTouchMove, { passive: false })
		feedContainer.addEventListener('touchend', handleTouchEnd)

		return () => {
			if (feedContainer) {
				feedContainer.removeEventListener('scroll', handleScroll)
				feedContainer.removeEventListener('touchstart', handleTouchStart)
				feedContainer.removeEventListener('touchmove', handleTouchMove)
				feedContainer.removeEventListener('touchend', handleTouchEnd)
			}
		}
	})
</script>

<div
	bind:this={feedContainer}
	class="flex-1 overflow-y-auto custom-scrollbar overscroll-y-none"
	style:transform={`translateY(${pullToRefreshY * 0.3}px)`}
	style:transition={!isPulling ? 'transform 0.3s ease-out' : ''}
>
	<!-- Pull to refresh indicator -->
	{#if pullToRefreshY > 0}
		<div
			class="absolute top-0 left-0 right-0 z-20 flex items-center justify-center h-16 bg-background/80 backdrop-blur-sm"
			style:transform={`translateY(-${64 - pullToRefreshY}px)`}
			style:transition={!isPulling ? 'transform 0.3s ease-out' : ''}
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

	<div class="max-w-2xl mx-auto px-4 pb-4 space-y-4 relative">
		<!-- Feed header -->
		<div class="flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md py-3 z-10">
			<h1 class="text-xl font-bold text-foreground">
				Dimes Square
				{#if $feedStore.posts.length > 0}
					<span class="text-sm font-normal text-muted-foreground ml-2">
						{$feedStore.posts.length} {$feedStore.posts.length === 1 ? 'post' : 'posts'}
					</span>
				{/if}
			</h1>
			<button
				onclick={refreshFeed}
				disabled={$feedStore.loading || refreshing}
				class="
					p-2.5 rounded-xl transition-all duration-200 ease-out
					hover:bg-accent active:scale-95 active:bg-accent/70
					disabled:opacity-50 disabled:cursor-not-allowed
					touch-manipulation
					focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
				"
				aria-label="Refresh feed"
				type="button"
			>
				<RefreshCw
					size={20}
					class={$feedStore.loading || refreshing ? 'animate-spin' : 'transition-transform duration-200 hover:rotate-90'}
				/>
			</button>
		</div>

		<!-- Error state -->
		{#if $feedStore.error}
			<div class="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
				<AlertCircle size={20} />
				<p>{$feedStore.error}</p>
				<button
					onclick={refreshFeed}
					class="ml-auto px-3 py-1 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
				>
					Retry
				</button>
			</div>
		{/if}

		<!-- Loading state (initial) -->
		{#if $feedStore.loading && $feedStore.posts.length === 0}
			<div class="space-y-4">
				{#each Array(5) as _, index}
					<PostCardSkeleton delay={index} />
				{/each}
			</div>
		{/if}

		<!-- Posts -->
		{#if $feedStore.posts.length > 0}
			<div class="space-y-4">
				{#each $feedStore.posts as post, index (post.id)}
					<div
						class="animate-stagger-fade-in"
						style:animation-delay={`${Math.min(index * 50, 300)}ms`}
					>
						<PostCard
							{post}
							{onVote}
							{onReply}
							showReplies={true}
							isInThread={false}
						/>
					</div>
				{/each}
			</div>

			<!-- Load more indicator -->
			{#if loadingMore}
				<div class="flex justify-center py-8 animate-fade-in">
					<div class="flex items-center gap-3 text-muted-foreground px-4 py-2 bg-muted/30 rounded-full backdrop-blur-sm">
						<Loader2 size={18} class="animate-spin" />
						<span class="text-sm font-medium">Loading more posts...</span>
					</div>
				</div>
			{/if}

			<!-- End of feed indicator -->
			{#if !$feedStore.hasMore && !loadingMore}
				<div class="text-center py-8 text-muted-foreground">
					<p>You've reached the end of the {feedType} feed</p>
				</div>
			{/if}
		{/if}

		<!-- Empty state -->
		{#if !$feedStore.loading && $feedStore.posts.length === 0 && !$feedStore.error}
			<div class="text-center py-12 text-muted-foreground">
				<div class="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
					<RefreshCw size={24} />
				</div>
				<h3 class="text-lg font-medium mb-2">No posts yet</h3>
				<p>Be the first to post in the {feedType} feed!</p>
			</div>
		{/if}
	</div>
</div>
