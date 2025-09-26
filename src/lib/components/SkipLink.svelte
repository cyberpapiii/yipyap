<script lang="ts">
	/**
	 * Skip link component for keyboard navigation
	 * Allows users to skip to main content or navigation
	 */
	let {
		href,
		children
	}: {
		href: string
		children: any
	} = $props()

	function handleClick(e: Event) {
		e.preventDefault()

		// Find target element
		const target = document.querySelector(href)
		if (target) {
			// Focus the target element
			if (target instanceof HTMLElement) {
				// Make sure element is focusable
				if (!target.hasAttribute('tabindex')) {
					target.setAttribute('tabindex', '-1')
				}
				target.focus()

				// Announce to screen readers
				target.setAttribute('aria-live', 'polite')
				target.setAttribute('aria-atomic', 'true')

				// Clean up after a short delay
				setTimeout(() => {
					target.removeAttribute('aria-live')
					target.removeAttribute('aria-atomic')
				}, 100)
			}

			// Scroll to element smoothly
			target.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'nearest'
			})
		}
	}
</script>

<a
	{href}
	class="skip-link"
	onclick={handleClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			handleClick(e)
		}
	}}
>
	{@render children()}
</a>

<style>
	.skip-link {
		position: absolute;
		top: -40px;
		left: 6px;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		padding: 8px 12px;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 600;
		font-size: 14px;
		z-index: 10000;
		transition: top 0.2s ease;
		box-shadow: 0 4px 12px hsl(var(--primary) / 0.5);
	}

	.skip-link:focus {
		top: 6px;
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}

	.skip-link:hover {
		background: hsl(var(--primary) / 0.9);
	}

	.skip-link:active {
		transform: translateY(1px);
	}
</style>
