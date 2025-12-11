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
	aria-label="Loading post..."
	role="status"
>
	<div class="flex gap-3">
		<!-- Vote buttons skeleton -->
		<div class="flex flex-col items-center gap-2">
			<div
				class="h-10 w-10 bg-skeleton rounded-full {animated ? 'animate-pulse-gentle' : ''}"
			></div>
			<div
				class="h-4 w-8 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
				style:animation-delay={`${delay * 100 + 150}ms`}
			></div>
			<div
				class="h-10 w-10 bg-skeleton rounded-full {animated ? 'animate-pulse-gentle' : ''}"
				style:animation-delay={`${delay * 100 + 300}ms`}
			></div>
		</div>

		<!-- Post content skeleton -->
		<div class="flex-1 min-w-0 space-y-3">
			<!-- Header skeleton -->
			<div class="flex items-center gap-2">
				<div
					class="h-6 w-6 bg-skeleton rounded-full {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 200}ms`}
				></div>
				<div
					class="h-3 w-16 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 250}ms`}
				></div>
				<div
					class="ml-auto h-6 w-6 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 300}ms`}
				></div>
			</div>

			<!-- Content skeleton -->
			<div class="space-y-2">
				<div
					class="h-4 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 350}ms`}
				></div>
				<div
					class="h-4 w-4/5 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 400}ms`}
				></div>
				<div
					class="h-4 w-3/5 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"
					style:animation-delay={`${delay * 100 + 450}ms`}
				></div>
			</div>

			<!-- Actions skeleton -->
			<div class="flex items-center gap-4">
				<div
					class="flex items-center gap-1"
					style:animation-delay={`${delay * 100 + 500}ms`}
				>
					<div class="h-4 w-4 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"></div>
					<div class="h-3 w-6 bg-skeleton rounded-lg {animated ? 'animate-pulse-gentle' : ''}"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Shimmer effect overlay -->
	{#if animated}
		<div
			class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"
			aria-hidden="true"
		></div>
	{/if}
</div>