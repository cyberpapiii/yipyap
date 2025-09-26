<script lang="ts">
	let {
		size = 'md',
		variant = 'primary',
		text,
		centered = true
	}: {
		size?: 'sm' | 'md' | 'lg'
		variant?: 'primary' | 'muted' | 'accent'
		text?: string
		centered?: boolean
	} = $props()

	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6',
		lg: 'w-8 h-8'
	}

	const variantClasses = {
		primary: 'text-primary',
		muted: 'text-muted-foreground',
		accent: 'text-accent-foreground'
	}

	const textSizes = {
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base'
	}
</script>

<div
	class="flex {centered ? 'items-center justify-center' : 'items-start'} gap-3 animate-fade-in"
	role="status"
	aria-label={text || 'Loading'}
>
	<!-- Spinning indicator -->
	<div
		class="{sizeClasses[size]} {variantClasses[variant]} animate-spin"
		style="animation-duration: 1s; animation-timing-function: linear; animation-iteration-count: infinite;"
	>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="w-full h-full"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" opacity="0.25" />
			<path d="M21 12a9 9 0 0 0-9-9" class="animate-pulse" />
		</svg>
	</div>

	<!-- Loading text -->
	{#if text}
		<span
			class="{textSizes[size]} {variantClasses[variant]} font-medium animate-pulse-gentle"
			aria-live="polite"
		>
			{text}
		</span>
	{/if}
</div>

<style>
	/* Enhanced spinner animation */
	@keyframes spinner {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spinner 1s linear infinite;
	}
</style>