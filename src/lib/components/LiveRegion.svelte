<script lang="ts">
	import { onMount } from 'svelte'

	/**
	 * Live region component for dynamic content announcements
	 * Announces changes to screen readers
	 */
	let {
		message = '',
		priority = 'polite',
		atomic = false,
		clearDelay = 5000
	}: {
		message?: string
		priority?: 'polite' | 'assertive' | 'off'
		atomic?: boolean
		clearDelay?: number | null
	} = $props()

	let liveRegionElement: HTMLElement
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	// Update message and handle clearing
	$effect(() => {
		if (message && liveRegionElement) {
			// Clear any existing timeout
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			// Set the message
			liveRegionElement.textContent = message

			// Auto-clear message after delay
			if (clearDelay && clearDelay > 0) {
				timeoutId = setTimeout(() => {
					if (liveRegionElement) {
						liveRegionElement.textContent = ''
					}
					timeoutId = null
				}, clearDelay)
			}
		}
	})

	onMount(() => {
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}
		}
	})
</script>

<div
	bind:this={liveRegionElement}
	class="sr-only"
	aria-live={priority}
	aria-atomic={atomic}
	role="status"
></div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
