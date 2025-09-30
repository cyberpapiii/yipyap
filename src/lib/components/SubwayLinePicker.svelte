<script lang="ts">
	import { onMount } from 'svelte'

	let {
		currentLine,
		onSelect,
		onClose
	}: {
		currentLine?: string
		onSelect: (line: string) => void
		onClose: () => void
	} = $props()

	// All NYC subway lines with their colors
	const subwayLines = [
		{ line: 'A', color: '#0039A6', name: 'A Line' },
		{ line: 'B', color: '#FF6319', name: 'B Line' },
		{ line: 'C', color: '#0039A6', name: 'C Line' },
		{ line: 'D', color: '#FF6319', name: 'D Line' },
		{ line: 'E', color: '#0039A6', name: 'E Line' },
		{ line: 'F', color: '#FF6319', name: 'F Line' },
		{ line: 'G', color: '#6CBE45', name: 'G Line' },
		{ line: 'J', color: '#996633', name: 'J Line' },
		{ line: 'L', color: '#A7A9AC', name: 'L Line' },
		{ line: 'M', color: '#FF6319', name: 'M Line' },
		{ line: 'N', color: '#FCCC0A', name: 'N Line' },
		{ line: 'Q', color: '#FCCC0A', name: 'Q Line' },
		{ line: 'R', color: '#FCCC0A', name: 'R Line' },
		{ line: 'W', color: '#FCCC0A', name: 'W Line' },
		{ line: 'Z', color: '#996633', name: 'Z Line' },
		{ line: '1', color: '#EE352E', name: '1 Line' },
		{ line: '2', color: '#EE352E', name: '2 Line' },
		{ line: '3', color: '#EE352E', name: '3 Line' },
		{ line: '4', color: '#00933C', name: '4 Line' },
		{ line: '5', color: '#00933C', name: '5 Line' },
		{ line: '6', color: '#00933C', name: '6 Line' },
		{ line: '7', color: '#B933AD', name: '7 Line' }
	]

	// Sort lines by color groups
	const sortedLines = subwayLines.sort((a, b) => {
		const colorOrder = ['#EE352E', '#00933C', '#B933AD', '#0039A6', '#FF6319', '#FCCC0A', '#6CBE45', '#996633', '#A7A9AC']
		return colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color)
	})

	function handleSelect(line: string) {
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}
		onSelect(line)
	}

	function handleClose() {
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		onClose()
	}

	// Yellow lines need black text
	function getTextColor(color: string) {
		return color === '#FCCC0A' ? '#000000' : '#FFFFFF'
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown)
		return () => {
			document.removeEventListener('keydown', handleKeydown)
		}
	})

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose()
		}
	}
</script>

<style>
	.picker-enter {
		animation: picker-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes picker-slide-in {
		0% {
			transform: translateY(100%) scale(0.95);
			opacity: 0;
		}
		100% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}
</style>

<!-- Overlay -->
<div
	class="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 sm:pb-4"
	style="z-index: 100; padding-bottom: calc(env(safe-area-inset-bottom) + 5rem);"
	onclick={(e) => e.target === e.currentTarget && handleClose()}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Escape' && handleClose()}
>
	<!-- Picker content -->
	<div class="rounded-2xl w-full max-w-lg flex flex-col shadow-xl picker-enter" style="background-color: #101010; border: 1px solid rgba(107, 107, 107, 0.1); max-height: 70vh;">
		<!-- Header -->
		<div class="flex items-center justify-between p-4" style="border-bottom: 1px solid rgba(107, 107, 107, 0.1);">
			<h2 class="text-2xl font-bold">Choose Your Line</h2>
			<button
				onclick={handleClose}
				class="p-2 hover:bg-accent rounded-xl transition-colors"
				aria-label="Close"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>

		<!-- Subway lines grid -->
		<div class="p-4 overflow-y-auto">
			<div class="grid grid-cols-4 gap-3">
				{#each sortedLines as { line, color, name }}
					<button
						onclick={() => handleSelect(line)}
						class="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 active:scale-95 relative"
						style="background-color: {currentLine === line ? 'rgba(107, 107, 107, 0.2)' : 'transparent'};"
						aria-label="Select {name}"
					>
						<div
							class="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl shadow-lg"
							style="background-color: {color}; color: {getTextColor(color)};"
						>
							{line}
						</div>
						{#if currentLine === line}
							<div class="absolute top-1 right-1">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
									<circle cx="10" cy="10" r="10" fill="#00933C"/>
									<path d="M6 10L8.5 12.5L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
