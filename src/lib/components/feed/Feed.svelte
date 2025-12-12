<script lang="ts">
	import { onMount } from 'svelte'
	import { Loader2, RefreshCw, AlertCircle, ChevronDown } from 'lucide-svelte'
	import PostCard from './PostCard.svelte'
	import PostCardSkeleton from './PostCardSkeleton.svelte'
	import CommunitySelector from '../community/CommunitySelector.svelte'
	import type { FeedType, PostWithStats } from '$lib/types'
	import { feedUtils } from '$lib/stores'
	import { communityStore } from '$lib/stores/community'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		feedType,
		onVote,
		onReply,
		onDelete,
		onLoadMore,
		hideHeader = false,
		scrollKey
	}: {
		feedType: FeedType
		onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
		onReply?: (post: PostWithStats) => void
		onDelete?: (postId: string) => Promise<void>
		onLoadMore?: () => Promise<void>
		hideHeader?: boolean
		scrollKey?: string
	} = $props()

	// Enhanced state management
	let loadingMore = $state(false)
	let feedContainer: HTMLElement
	let refreshing = $state(false)
	let pullToRefreshY = $state(0) // rendered (smoothed)
	let rawPullToRefreshY = $state(0) // raw gesture value
	let isPulling = $state(false)
	let gestureAxis = $state<'none' | 'vertical' | 'horizontal'>('none')
	let startY = 0
	let currentY = 0
	let startX = 0
	let currentX = 0
	let feedOpacity = $state(1)
	let isTransitioning = $state(false)
	let pullRaf = 0
	let restoringScroll = false
	let scrollPersistRaf = 0

	// Pull to refresh constants
	const PULL_THRESHOLD = 80
	const MAX_PULL = 120
	const SCROLL_TOP_THRESHOLD = 5
	const GESTURE_LOCK_THRESHOLD = 10
	const PULL_SMOOTHING = 0.35
	const ESTIMATED_CARD_HEIGHT = 240
	const OVERSCAN = 4

	const feedStore = $derived.by(() => feedUtils.getFeedStore(feedType))
	let windowStart = $state(0)
	let windowEnd = $state(12)

	function restoreScrollPosition() {
		if (!feedContainer || !scrollKey) return
		if (restoringScroll) return
		restoringScroll = true
		let attempts = 0

		const apply = () => {
			attempts += 1
			try {
				const raw = sessionStorage.getItem(scrollKey!)
				const saved = raw === null ? 0 : Number(raw)
				if (!Number.isFinite(saved)) {
					restoringScroll = false
					return
				}

				const max = Math.max(0, feedContainer.scrollHeight - feedContainer.clientHeight)
				// If the container isn't scrollable yet (e.g., posts not rendered), retry a few frames.
				if (max === 0 && attempts < 8) {
					requestAnimationFrame(apply)
					return
				}

				feedContainer.scrollTop = Math.min(Math.max(0, saved), max)
				updateWindow()
			} finally {
				restoringScroll = false
			}
		}

		requestAnimationFrame(apply)
	}

	function persistScrollImmediate() {
		if (!feedContainer || !scrollKey) return
		try {
			sessionStorage.setItem(scrollKey, String(feedContainer.scrollTop || 0))
		} catch {
			// ignore
		}
	}

	function schedulePersistScroll() {
		if (!feedContainer || !scrollKey) return
		if (scrollPersistRaf) return
		scrollPersistRaf = requestAnimationFrame(() => {
			scrollPersistRaf = 0
			persistScrollImmediate()
		})
	}

	// Handle community picker
	function handleOpenPicker() {
		communityStore.openPicker()
	}

	function updateWindow() {
		if (!feedContainer) {
			windowEnd = Math.min($feedStore.posts.length, Math.max(windowEnd, 12))
			return
		}

		const total = $feedStore.posts.length
		if (!total) {
			windowStart = 0
			windowEnd = 0
			return
		}

		const { scrollTop, clientHeight } = feedContainer
		const startIndex = Math.max(Math.floor(scrollTop / ESTIMATED_CARD_HEIGHT) - OVERSCAN, 0)
		const endIndex = Math.min(
			total,
			Math.ceil((scrollTop + clientHeight) / ESTIMATED_CARD_HEIGHT) + OVERSCAN
		)

		windowStart = startIndex
		windowEnd = endIndex
	}

	// Handle infinite scroll
	function handleScroll() {
		if (!feedContainer || loadingMore) return

		const { scrollTop, scrollHeight, clientHeight } = feedContainer
		const scrolled = scrollTop + clientHeight
		const threshold = scrollHeight - (clientHeight * 0.8)

		updateWindow()
		schedulePersistScroll()

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
	function schedulePullRender() {
		if (pullRaf) return
		pullRaf = requestAnimationFrame(() => {
			pullRaf = 0
			const next = pullToRefreshY + (rawPullToRefreshY - pullToRefreshY) * PULL_SMOOTHING
			// Snap when very close to avoid endless micro-updates
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

	// Smooth transition for feed changes
	async function transitionFeed(callback: () => Promise<void>) {
		isTransitioning = true
		feedOpacity = 0

		await new Promise(resolve => setTimeout(resolve, 200))
		await callback()

		feedOpacity = 1
		await new Promise(resolve => setTimeout(resolve, 300))
		isTransitioning = false
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
		const containerTop = feedContainer ? feedContainer.scrollTop : 0
		if (containerTop > SCROLL_TOP_THRESHOLD) return false

		const globalTop = getGlobalScrollTop()
		return globalTop <= SCROLL_TOP_THRESHOLD
	}

	async function refreshFeed() {
		if (!onLoadMore) {
			resetPullState()
			return
		}

		if ($feedStore.loading || refreshing) {
			resetPullState()
			return
		}

		refreshing = true
		// Haptic feedback for refresh
		hapticsStore.trigger('selection')

		try {
			await transitionFeed(async () => {
				feedStore.clear()
				await onLoadMore()
			})
		} finally {
			refreshing = false
			rawPullToRefreshY = 0
			schedulePullRender()
			isPulling = false
		}
	}

	// Pull to refresh handlers
	function handleTouchStart(e: TouchEvent) {
		// Snapshot scrollTop at touchstart so "tap during momentum scroll" restores precisely.
		// (Scroll events can lag behind the exact moment the user taps.)
		persistScrollImmediate()

		if ($feedStore.loading || refreshing) return
		if (e.touches.length !== 1) return

		startX = e.touches[0].clientX
		startY = e.touches[0].clientY
		currentX = startX
		currentY = startY
		rawPullToRefreshY = 0
		pullToRefreshY = 0
		isPulling = false
		gestureAxis = 'none'
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 1) return
		currentX = e.touches[0].clientX
		currentY = e.touches[0].clientY
		const deltaX = currentX - startX
		const deltaY = currentY - startY

		if ($feedStore.loading || refreshing) {
			resetPullState()
			return
		}

		// Ignore horizontal swipes (e.g., switching feeds) so we don't show pull-to-refresh.
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

		// If we haven't locked into a vertical gesture yet, do nothing.
		if (gestureAxis !== 'vertical') return

		const atTop = isAtTop()

		if (!isPulling) {
			if (deltaY > 0 && atTop) {
				// Prevent iOS rubber-band overscroll from pulling the whole page (layout header included)
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

	function handleTouchEnd() {
		if (!isPulling) return

		isPulling = false
		gestureAxis = 'none'

		if (pullToRefreshY >= PULL_THRESHOLD) {
			refreshFeed()
		} else {
			rawPullToRefreshY = 0
			schedulePullRender()
		}
	}

	function handleTouchCancel() {
		gestureAxis = 'none'
		resetPullState()
	}

	onMount(() => {
		if (!feedContainer) return

		updateWindow()
		restoreScrollPosition()

		feedContainer.addEventListener('scroll', handleScroll)
		feedContainer.addEventListener('touchstart', handleTouchStart, { passive: false })
		feedContainer.addEventListener('touchmove', handleTouchMove, { passive: false })
		feedContainer.addEventListener('touchend', handleTouchEnd)
		feedContainer.addEventListener('touchcancel', handleTouchCancel)

		return () => {
			schedulePersistScroll()
			if (feedContainer) {
				feedContainer.removeEventListener('scroll', handleScroll)
				feedContainer.removeEventListener('touchstart', handleTouchStart)
				feedContainer.removeEventListener('touchmove', handleTouchMove)
				feedContainer.removeEventListener('touchend', handleTouchEnd)
				feedContainer.removeEventListener('touchcancel', handleTouchCancel)
			}
		}
	})

	$effect(() => {
		updateWindow()
	})

	$effect(() => {
		// When feed/community changes, restore saved position for this key.
		if (!feedContainer) return
		restoreScrollPosition()
	})
</script>

<div
	bind:this={feedContainer}
	class="flex-1 overflow-y-auto custom-scrollbar overscroll-y-none"
	style:transform={`translateY(${pullToRefreshY * 0.3}px)`}
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

	<div class="max-w-2xl mx-auto px-4 pb-4 space-y-4 relative">
		<!-- Feed header - Page elements layer: z-1-99 (sticky header at z-10) -->
		{#if !hideHeader}
			<div class="flex items-start justify-between sticky top-0 bg-background/90 backdrop-blur-md py-6 pt-8 px-2 z-10">
				<CommunitySelector
					selectedCommunity={$communityStore.selectedCommunity}
					postCount={$feedStore.posts.length}
					onClick={handleOpenPicker}
				/>
				<button
					onclick={refreshFeed}
					disabled={$feedStore.loading || refreshing}
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
						class={$feedStore.loading || refreshing ? 'animate-spin' : 'transition-transform duration-200 hover:rotate-90'}
					/>
				</button>
			</div>
		{/if}

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
			<div class="space-y-4" style="opacity: {feedOpacity}; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
				<div style={`height: ${Math.max(windowStart * ESTIMATED_CARD_HEIGHT, 0)}px`}></div>
				{#each $feedStore.posts.slice(windowStart, windowEnd) as post, index (post.id)}
					<div
						class="animate-stagger-fade-in"
						style:animation-delay={`${Math.min((windowStart + index) * 50, 300)}ms`}
					>
						<PostCard
							{post}
							{onVote}
							{onReply}
							{onDelete}
							showReplies={true}
							isInThread={false}
						/>
					</div>
				{/each}
				<div style={`height: ${Math.max(($feedStore.posts.length - windowEnd) * ESTIMATED_CARD_HEIGHT, 0)}px`}></div>
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
