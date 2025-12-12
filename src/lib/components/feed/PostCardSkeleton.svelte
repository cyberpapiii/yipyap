<script lang="ts">
	let {
		animated = true,
		delay = 0
	}: {
		animated?: boolean
		delay?: number
	} = $props()

	// Stagger animation delay for multiple skeletons
	const animationDelay = `${delay * 100}ms`
</script>

<div
	class="bg-card border border-line rounded-2xl p-4 animate-fade-in relative overflow-hidden"
	style:animation-delay={animationDelay}
	style:min-height="150px"
	aria-label="Loading post..."
	role="status"
>
	<div class="flex gap-3 items-start">
		<!-- Avatar skeleton -->
			<div
			class="h-10 w-10 bg-skeleton rounded-full {animated ? 'animate-loading-pulse' : ''}"
			style:animation-delay={`${delay * 100 + 100}ms`}
			></div>

		<!-- Content skeleton (mirrors PostCard layout) -->
		<div class="flex-1 min-w-0 space-y-3">
			<!-- Header row (time + menu) -->
			<div class="flex items-center gap-2">
				<div
					class="h-3 w-20 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
					style:animation-delay={`${delay * 100 + 150}ms`}
				></div>
				<div class="ml-auto">
				<div
						class="h-5 w-5 bg-skeleton rounded-md {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 100 + 200}ms`}
					></div>
				</div>
			</div>

			<!-- Body -->
			<div class="space-y-2">
				<div
					class="h-4 w-full bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
					style:animation-delay={`${delay * 100 + 250}ms`}
				></div>
				<div
					class="h-4 w-5/6 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
					style:animation-delay={`${delay * 100 + 300}ms`}
				></div>
			</div>

			<!-- Actions row (comment + votes) -->
			<div class="flex items-center justify-end gap-3">
				<div
					class="h-6 w-14 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
					style:animation-delay={`${delay * 100 + 350}ms`}
				></div>
				<div
					class="h-6 w-20 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
					style:animation-delay={`${delay * 100 + 400}ms`}
				></div>
			</div>
		</div>
	</div>

	<!-- Shimmer effect overlay -->
	{#if animated}
		<div
			class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
			aria-hidden="true"
		></div>
	{/if}
</div>