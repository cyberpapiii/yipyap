<script lang="ts">
	let {
		depth = 0,
		animated = true,
		delay = 0,
		showReplies = true
	}: {
		depth?: number
		animated?: boolean
		delay?: number
		showReplies?: boolean
	} = $props()

	// Calculate indentation based on depth
	const indentClass = $derived(() => {
		const indentLevels = ['', 'ml-4', 'ml-8', 'ml-12']
		return indentLevels[Math.min(depth, 3)] || 'ml-12'
	})

	const animationDelay = `${delay * 80}ms`
</script>

<div class={`${indentClass} ${depth > 0 ? 'border-l border-line/70 pl-4' : ''}`}>
	<div
	class="bg-card/50 border border-line/60 rounded-xl p-3 mb-2 animate-fade-in relative overflow-hidden"
		style:animation-delay={animationDelay}
		aria-label="Loading comment..."
		role="status"
	>
		<div class="flex gap-3">
			<!-- Avatar -->
			<div
				class="h-9 w-9 bg-skeleton rounded-full {animated ? 'animate-loading-pulse' : ''}"
				style:animation-delay={`${delay * 80 + 100}ms`}
			></div>

			<!-- Comment content skeleton -->
			<div class="flex-1 min-w-0 space-y-2">
				<!-- Header skeleton -->
				<div class="flex items-center gap-2">
					<div
						class="h-2.5 w-14 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 120}ms`}
					></div>
					<div
						class="h-2.5 w-10 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 170}ms`}
					></div>
					<div
						class="ml-auto h-4 w-4 bg-skeleton rounded-md {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 220}ms`}
					></div>
				</div>

				<!-- Content skeleton -->
				<div class="space-y-1.5">
					<div
						class="h-3.5 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 250}ms`}
					></div>
					<div
						class="h-3.5 w-4/5 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 300}ms`}
					></div>
				</div>

				<!-- Actions skeleton -->
				<div class="flex justify-end">
					<div
						class="h-5 w-16 bg-skeleton rounded-lg {animated ? 'animate-loading-pulse' : ''}"
						style:animation-delay={`${delay * 80 + 350}ms`}
					></div>
				</div>
			</div>
		</div>

		<!-- Shimmer effect overlay -->
		{#if animated}
			<div
				class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
				style:animation-delay={`${delay * 80 + 100}ms`}
				aria-hidden="true"
			></div>
		{/if}
	</div>

	<!-- Nested reply skeletons -->
	{#if showReplies && depth < 2}
		<div class="space-y-1 ml-4">
			<!-- svelte-ignore svelte_self_deprecated -->
			<svelte:self
				depth={depth + 1}
				{animated}
				delay={delay + 1}
				showReplies={false}
			/>
		</div>
	{/if}
</div>