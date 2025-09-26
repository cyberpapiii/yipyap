<script lang="ts">
	/**
	 * VisuallyHidden component for screen reader only content
	 * Content is hidden visually but accessible to screen readers
	 */
	let {
		children,
		focusable = false,
		tag = 'span'
	}: {
		children: any
		focusable?: boolean
		tag?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
	} = $props()
</script>

<svelte:element
	this={tag}
	class="visually-hidden {focusable ? 'focusable' : ''}"
	tabindex={focusable ? 0 : undefined}
>
	{@render children()}
</svelte:element>

<style>
	/* Visually hidden but accessible to screen readers */
	.visually-hidden {
		position: absolute !important;
		width: 1px !important;
		height: 1px !important;
		padding: 0 !important;
		margin: -1px !important;
		overflow: hidden !important;
		clip: rect(0, 0, 0, 0) !important;
		white-space: nowrap !important;
		border: 0 !important;
	}

	/* Show when focused (for focusable elements) */
	.visually-hidden.focusable:focus {
		position: static !important;
		width: auto !important;
		height: auto !important;
		padding: inherit !important;
		margin: inherit !important;
		overflow: visible !important;
		clip: auto !important;
		white-space: inherit !important;
		border: inherit !important;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		z-index: 9999;
	}
</style>