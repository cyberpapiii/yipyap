<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/stores'

	let {
		children,
		direction = 'right',
		duration = 300,
		easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
	}: {
		children: any
		direction?: 'left' | 'right' | 'up' | 'down' | 'fade'
		duration?: number
		easing?: string
	} = $props()

	let pageContainer: HTMLElement
	let isNavigating = $state(false)
	let currentPath: string = $page.url.pathname

	// Animation classes based on direction
	const animationClasses = {
		left: {
			enter: 'animate-slide-left',
			exit: 'animate-slide-right'
		},
		right: {
			enter: 'animate-slide-right',
			exit: 'animate-slide-left'
		},
		up: {
			enter: 'animate-slide-up',
			exit: 'animate-slide-down'
		},
		down: {
			enter: 'animate-slide-down',
			exit: 'animate-slide-up'
		},
		fade: {
			enter: 'animate-fade-in',
			exit: 'animate-fade-out'
		}
	}

	// Handle route changes
	$effect(() => {
		const nextPath = $page.url.pathname
		if (currentPath !== nextPath) {
			handleRouteChange(nextPath)
		}
	})

	async function handleRouteChange(newPath: string) {
		isNavigating = true

		// Haptic feedback for navigation
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}

		// Add exit animation to current content
		if (pageContainer) {
			pageContainer.classList.add(animationClasses[direction].exit)
		}

		// Wait for exit animation
		await new Promise(resolve => setTimeout(resolve, duration * 0.3))

		// Update path
		currentPath = newPath

		// Add enter animation to new content
		if (pageContainer) {
			pageContainer.classList.remove(animationClasses[direction].exit)
			pageContainer.classList.add(animationClasses[direction].enter)
		}

		// Clean up animation classes
		setTimeout(() => {
			if (pageContainer) {
				pageContainer.classList.remove(animationClasses[direction].enter)
			}
			isNavigating = false
		}, duration)
	}

	onMount(() => {
		// Set initial animation delay for smooth entry
		if (pageContainer) {
			pageContainer.classList.add('animate-fade-in')
		}
	})
</script>

<div
	bind:this={pageContainer}
	class="w-full h-full transition-transform transition-opacity will-change-transform"
	style:transition-duration={`${duration}ms`}
	style:transition-timing-function={easing}
	aria-live={isNavigating ? 'polite' : 'off'}
	aria-busy={isNavigating}
>
	{@render children()}
</div>

<style>
	/* Prevent content shift during transitions */
	div {
		backface-visibility: hidden;
		transform: translate3d(0, 0, 0);
	}
</style>
