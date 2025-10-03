<script lang="ts">
	import { browser } from '$app/environment'
	import type { FeedType } from '$lib/types'

	let {
		activeFeed,
		onFeedChange,
		children
	}: {
		activeFeed: FeedType
		onFeedChange: (feed: FeedType) => void
		children: any
	} = $props()

	// Touch state
	let touchStartX = $state(0)
	let touchCurrentX = $state(0)
	let isDragging = $state(false)
	let containerTranslateX = $state(0)
	let isAnimating = $state(false)

	// Swipe configuration
	const SWIPE_THRESHOLD = 80 // Minimum distance to trigger feed change
	const RESISTANCE_FACTOR = 0.5 // Drag resistance (0.5 = 50% of finger movement)

	// Calculate active feed index (0 = new, 1 = hot)
	let activeIndex = $derived(activeFeed === 'new' ? 0 : 1)

	// Handle touch start
	function handleTouchStart(e: TouchEvent) {
		// Don't intercept if touching inside a post card or scrollable element
		const target = e.target as HTMLElement
		if (target.closest('[role="article"]') || target.closest('[data-no-swipe]')) {
			return
		}

		touchStartX = e.touches[0].clientX
		touchCurrentX = e.touches[0].clientX
		isDragging = true
		isAnimating = false
	}

	// Handle touch move - follow finger with resistance
	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return

		touchCurrentX = e.touches[0].clientX
		const deltaX = touchCurrentX - touchStartX

		// Apply resistance
		const resistedDelta = deltaX * RESISTANCE_FACTOR

		// Calculate base position (-100% for hot, 0% for new)
		const basePosition = activeIndex * -100

		// Add the drag delta
		const newPosition = basePosition + (resistedDelta / window.innerWidth) * 100

		// Clamp between -100% (hot) and 0% (new)
		containerTranslateX = Math.max(-100, Math.min(0, newPosition))
	}

	// Handle touch end - snap to nearest feed
	function handleTouchEnd() {
		if (!isDragging) return

		isDragging = false
		const deltaX = touchCurrentX - touchStartX

		// Determine if swipe threshold was met
		if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
			// Swipe right (show new feed)
			if (deltaX > 0 && activeFeed === 'hot') {
				snapToFeed('new')
			}
			// Swipe left (show hot feed)
			else if (deltaX < 0 && activeFeed === 'new') {
				snapToFeed('hot')
			} else {
				// Swipe in wrong direction, snap back
				snapToFeed(activeFeed)
			}
		} else {
			// Not enough distance, snap back to current feed
			snapToFeed(activeFeed)
		}

		touchStartX = 0
		touchCurrentX = 0
	}

	// Snap to a specific feed with animation
	function snapToFeed(feed: FeedType) {
		isAnimating = true
		const targetIndex = feed === 'new' ? 0 : 1
		containerTranslateX = targetIndex * -100

		// Trigger feed change if different
		if (feed !== activeFeed) {
			onFeedChange(feed)
		}

		// Reset animation flag after transition
		setTimeout(() => {
			isAnimating = false
		}, 300)
	}

	// Watch for external feed changes (from buttons)
	$effect(() => {
		if (!isDragging) {
			const targetIndex = activeFeed === 'new' ? 0 : 1
			containerTranslateX = targetIndex * -100
		}
	})
</script>

<style>
	.feed-container {
		transform: translateX(var(--translate-x));
		transition: var(--transition);
		will-change: transform;
	}
</style>

<div
	class="relative w-full overflow-hidden"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	data-no-swipe
>
	<div
		class="feed-container flex w-full"
		style="
			--translate-x: {containerTranslateX}%;
			--transition: {isAnimating && !isDragging ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'};
		"
	>
		<!-- New Feed (left side, index 0) -->
		<div class="w-full flex-shrink-0">
			<div data-feed="new">
				{@render children({ feedType: 'new' })}
			</div>
		</div>

		<!-- Hot Feed (right side, index 1) -->
		<div class="w-full flex-shrink-0">
			<div data-feed="hot">
				{@render children({ feedType: 'hot' })}
			</div>
		</div>
	</div>
</div>
