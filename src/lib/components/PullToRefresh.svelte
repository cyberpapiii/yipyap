<script lang="ts">
	import { onMount } from 'svelte'
	import { RefreshCw, ChevronDown } from 'lucide-svelte'

	let {
		onRefresh,
		children,
		disabled = false,
		threshold = 80
	}: {
		onRefresh: () => Promise<void>
		children: () => any
		disabled?: boolean
		threshold?: number
	} = $props()

	let containerElement: HTMLElement
let pullDistance = $state(0)
let isPulling = $state(false)
let isRefreshing = $state(false)
	let startY = 0
	let currentY = 0

	const maxPull = threshold * 1.5

	// Touch event handlers
	function handleTouchStart(e: TouchEvent) {
		if (disabled || isRefreshing) return

		// Only start pull if at the top of the container
		if (containerElement.scrollTop === 0 && e.touches.length === 1) {
			startY = e.touches[0].clientY
			isPulling = true
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || disabled || isRefreshing || e.touches.length !== 1) return

		currentY = e.touches[0].clientY
		const deltaY = currentY - startY

		// Only allow pulling down when at the top
		if (deltaY > 0 && containerElement.scrollTop === 0) {
			e.preventDefault()

			// Apply elastic resistance
			const elasticDistance = Math.min(deltaY * 0.5, maxPull)
			pullDistance = elasticDistance

			// Light haptic feedback at threshold
			if (pullDistance >= threshold && pullDistance < threshold + 5) {
				if ('vibrate' in navigator) {
					navigator.vibrate(10)
				}
			}
		}
	}

	async function handleTouchEnd() {
		if (!isPulling || disabled) return

		isPulling = false

		// Trigger refresh if pulled far enough
		if (pullDistance >= threshold && !isRefreshing) {
			await triggerRefresh()
		} else {
			// Snap back
			pullDistance = 0
		}
	}

	async function triggerRefresh() {
		if (disabled || isRefreshing) return

		isRefreshing = true

		// Medium haptic feedback for refresh
		if ('vibrate' in navigator) {
			navigator.vibrate([20, 10, 20])
		}

		try {
			await onRefresh()
		} finally {
			isRefreshing = false
			pullDistance = 0
		}
	}

	// Calculate pull progress
let pullProgress = $state(0)
let shouldTriggerRefresh = $state(false)

	$effect(() => {
		pullProgress = Math.min(pullDistance / threshold, 1)
		shouldTriggerRefresh = pullDistance >= threshold
	})

	onMount(() => {
		if (!containerElement) return

		containerElement.addEventListener('touchstart', handleTouchStart, { passive: false })
		containerElement.addEventListener('touchmove', handleTouchMove, { passive: false })
		containerElement.addEventListener('touchend', handleTouchEnd)

		return () => {
			if (containerElement) {
				containerElement.removeEventListener('touchstart', handleTouchStart)
				containerElement.removeEventListener('touchmove', handleTouchMove)
				containerElement.removeEventListener('touchend', handleTouchEnd)
			}
		}
	})
</script>

<div
	bind:this={containerElement}
	class="relative w-full h-full overflow-y-auto overscroll-y-none"
	style:transform={`translateY(${pullDistance * 0.3}px)`}
	style:transition={!isPulling ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : ''}
>
	<!-- Pull to refresh indicator -->
	{#if pullDistance > 0}
		<div
			class="absolute top-0 left-0 right-0 z-20 flex items-center justify-center"
			style:height={`${Math.min(pullDistance, maxPull)}px`}
			style:transform={`translateY(-${Math.min(pullDistance, maxPull)}px)`}
			style:transition={!isPulling ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : ''}
		>
			<div
				class="flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-sm rounded-full border border-line/50 shadow-lg"
				style:opacity={Math.min(pullProgress * 2, 1)}
				style:transform={`scale(${Math.min(0.8 + pullProgress * 0.4, 1.2)})`}
			>
				{#if isRefreshing}
					<RefreshCw
						size={20}
						class="text-accent animate-spin"
					/>
					<span class="text-sm font-medium text-accent">
						Refreshing...
					</span>
				{:else if shouldTriggerRefresh}
					<RefreshCw
						size={20}
						class="text-accent animate-pull-refresh"
					/>
					<span class="text-sm font-medium text-accent">
						Release to refresh
					</span>
				{:else}
					<span
						class="text-muted-foreground transition-transform duration-200"
						style={`transform: rotate(${pullProgress * 180}deg)`}
					>
						<ChevronDown size={20} />
					</span>
					<span class="text-sm font-medium text-muted-foreground">
						Pull to refresh
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="relative">
		{@render children()}
	</div>
</div>

<style>
	/* Prevent momentum scrolling conflicts */
	div {
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
</style>
