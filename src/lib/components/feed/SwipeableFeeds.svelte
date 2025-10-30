<script lang="ts">
	import { browser } from '$app/environment'
	import { onMount } from 'svelte'
	import type { FeedType } from '$lib/types'
	import { hapticsStore } from '$lib/stores/haptics'

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
	let touchStartY = $state(0)
	let touchCurrentX = $state(0)
	let isDragging = $state(false)
	let containerTranslateX = $state(0)
	let isAnimating = $state(false)
	let containerElement: HTMLDivElement

	// Swipe configuration
	const SWIPE_THRESHOLD = 80 // Minimum distance to trigger feed change
	const RESISTANCE_FACTOR = 0.5 // Drag resistance (0.5 = 50% of finger movement)

	// Calculate active feed index (0 = new, 1 = hot)
	let activeIndex = $derived(activeFeed === 'new' ? 0 : 1)

	// Handle touch start
	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX
		touchStartY = e.touches[0].clientY
		touchCurrentX = e.touches[0].clientX
		isDragging = false // Will be set to true in touchmove if horizontal swipe detected
		isAnimating = false
	}

	// Handle touch move - follow finger with resistance
	function handleTouchMove(e: TouchEvent) {
		touchCurrentX = e.touches[0].clientX
		const deltaX = touchCurrentX - touchStartX
		const deltaY = Math.abs(e.touches[0].clientY - touchStartY)

		// Start dragging only if horizontal movement is detected
		if (!isDragging) {
			// If moved more than 10px horizontally and horizontal > vertical, start horizontal drag
			if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
				isDragging = true
			} else {
				// Not enough movement yet or vertical scroll, wait
				return
			}
		}

		// Prevent vertical scroll while swiping horizontally
		if (isDragging) {
			e.preventDefault()
		}

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
			// Haptic feedback for successful feed switch
			hapticsStore.trigger('selection')
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

	// Add touch listeners with passive: false for preventDefault to work
	onMount(() => {
		if (!containerElement) return

		// These need passive: false to allow preventDefault
		containerElement.addEventListener('touchstart', handleTouchStart as any, { passive: true })
		containerElement.addEventListener('touchmove', handleTouchMove as any, { passive: false })
		containerElement.addEventListener('touchend', handleTouchEnd as any, { passive: true })

		return () => {
			containerElement?.removeEventListener('touchstart', handleTouchStart as any)
			containerElement?.removeEventListener('touchmove', handleTouchMove as any)
			containerElement?.removeEventListener('touchend', handleTouchEnd as any)
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
	bind:this={containerElement}
	class="relative w-full overflow-hidden touch-pan-y"
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
