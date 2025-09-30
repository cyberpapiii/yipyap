<script lang="ts">
	import { onMount } from 'svelte'
	import { Check, X } from 'lucide-svelte'
	import type { CommunityType } from '$lib/types'
	import { getAllCommunities, getCommunity } from '$lib/config/communities'
	import CommunityBadge from './CommunityBadge.svelte'

	let {
		isOpen,
		selectedCommunity,
		onSelect,
		onClose
	}: {
		isOpen: boolean
		selectedCommunity: CommunityType
		onSelect: (community: CommunityType) => void
		onClose: () => void
	} = $props()

	const communities = getAllCommunities()
	let isClosing = $state(false)

	function handleSelect(communityId: CommunityType) {
		// Haptic feedback
		if ('vibrate' in navigator) {
			navigator.vibrate(20)
		}
		isClosing = true
		setTimeout(() => {
			onSelect(communityId)
			isClosing = false
		}, 150)
	}

	function handleClose() {
		// Haptic feedback
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		isClosing = true
		setTimeout(() => {
			onClose()
			isClosing = false
		}, 150)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose()
		}
	}

	onMount(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeydown)
			return () => {
				document.removeEventListener('keydown', handleKeydown)
			}
		}
	})
</script>

<style>
	.picker-enter {
		animation: picker-grow-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-origin: top center;
	}

	.picker-exit {
		animation: picker-shrink-out 0.15s cubic-bezier(0.4, 0, 1, 1);
		transform-origin: top center;
	}

	@keyframes picker-grow-in {
		0% {
			transform: scale(0.7);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes picker-shrink-out {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(0.7);
			opacity: 0;
		}
	}

	.backdrop-enter {
		animation: backdrop-fade-in 0.2s ease-out;
	}

	@keyframes backdrop-fade-in {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}
</style>

{#if isOpen}
	<!-- Overlay -->
	<div
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 backdrop-enter"
		style="z-index: 9999;"
		onclick={(e) => e.target === e.currentTarget && handleClose()}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
	>
		<!-- Picker content -->
		<div
			class="rounded-2xl w-full max-w-md flex flex-col shadow-xl overflow-hidden"
			class:picker-enter={!isClosing}
			class:picker-exit={isClosing}
			style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.1); max-height: min(80vh, 600px);"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between p-4"
				style="border-bottom: 1px solid rgba(107, 107, 107, 0.1);"
			>
				<h2 class="text-2xl font-bold text-foreground">Choose Community</h2>
				<button
					onclick={handleClose}
					class="p-2 hover:bg-accent rounded-xl transition-colors touch-manipulation"
					aria-label="Close"
					type="button"
				>
					<X size={24} class="text-foreground" />
				</button>
			</div>

			<!-- Communities list -->
			<div class="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
				<div class="space-y-2">
					{#each communities as community}
						{@const isSelected = community.id === selectedCommunity}
						<button
							onclick={() => handleSelect(community.id)}
							class="
								w-full flex items-center gap-4 p-4 rounded-xl
								transition-all duration-200 ease-out
								hover:bg-accent/50 active:scale-[0.98]
								touch-manipulation
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
							"
							style={isSelected ? 'background-color: rgba(1, 115, 92, 0.15);' : ''}
							aria-label="Select {community.name} community"
							type="button"
						>
							<!-- Community Info -->
							<div class="flex-1 flex flex-col items-start gap-1 min-w-0">
								<div class="text-lg font-bold text-foreground">
									{community.name}
								</div>
								<!-- Subway Line Badges -->
								<div class="flex items-center gap-1.5 flex-wrap mt-1">
									{#if community.subwayLines.length > 0}
										{#each community.subwayLines as line}
											<CommunityBadge {line} size="xs" />
										{/each}
									{:else}
										<!-- NYC circles -->
										<div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
											style="background-color: #F6BC26; color: #000">
											N
										</div>
										<div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
											style="background-color: #0062CF; color: #FFF">
											Y
										</div>
										<div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
											style="background-color: #EB6800; color: #FFF">
											C
										</div>
									{/if}
								</div>
							</div>

							<!-- Checkmark for selected -->
							{#if isSelected}
								<div class="flex-shrink-0">
									<div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
										<Check size={16} class="text-primary-foreground" />
									</div>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
