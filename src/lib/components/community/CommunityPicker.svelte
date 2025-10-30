<script lang="ts">
	import { Check, X, MapPin } from 'lucide-svelte'
	import type { CommunityType } from '$lib/types'
	import { getAllCommunities, getCommunity, getAllGeographicCommunities } from '$lib/config/communities'
	import CommunityBadge from './CommunityBadge.svelte'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		isOpen,
		selectedCommunity,
		onSelect,
		onClose
	}: {
		isOpen: boolean
		selectedCommunity: CommunityType | 'dimes_square'
		onSelect: (community: CommunityType | 'dimes_square') => void
		onClose: () => void
	} = $props()

	const communities = getAllCommunities().filter(c => c.id !== 'nyc') // Exclude NYC from subway filters
	const geographicCommunities = getAllGeographicCommunities() // Include both NYC and Dimes Square
	let isClosing = $state(false)

	function handleSelect(communityId: CommunityType | 'dimes_square') {
		// Haptic feedback
		hapticsStore.trigger('selection')
		isClosing = true
		setTimeout(() => {
			onSelect(communityId)
			isClosing = false
		}, 150)
	}

	function handleClose() {
		// Haptic feedback
		hapticsStore.trigger('menu-close')
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

	// Lock body scroll when picker is open
	$effect(() => {
		if (isOpen) {
			// Store original overflow
			const originalBodyOverflow = document.body.style.overflow
			const originalDocumentOverflow = document.documentElement.style.overflow
			const scrollY = window.scrollY

			// Lock scroll with position fixed to prevent iOS scroll issues
			document.body.style.position = 'fixed'
			document.body.style.top = `-${scrollY}px`
			document.body.style.width = '100%'
			document.body.style.overflow = 'hidden'
			document.documentElement.style.overflow = 'hidden'

			// Add keydown listener
			document.addEventListener('keydown', handleKeydown)

			return () => {
				// Restore scroll
				document.body.style.position = ''
				document.body.style.top = ''
				document.body.style.width = ''
				document.body.style.overflow = originalBodyOverflow
				document.documentElement.style.overflow = originalDocumentOverflow

				// Restore scroll position
				window.scrollTo(0, scrollY)

				// Remove listener
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
	<!-- Overlay - Modal layer: z-1000-1999 (CommunityPicker at z-1100, above ComposeModal) -->
	<div
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 backdrop-enter"
		style="z-index: 1100;"
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
			<div
				class="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0"
				style="overscroll-behavior: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch;"
				onclick={(e) => e.stopPropagation()}
				ontouchstart={(e) => e.stopPropagation()}
				ontouchmove={(e) => e.stopPropagation()}
			>
				<div class="space-y-2">
					<!-- Locations (Geographic Communities) -->
					{#each geographicCommunities as geoCommunity}
						{@const isSelected = geoCommunity.id === selectedCommunity}
						<button
							onclick={() => handleSelect(geoCommunity.id)}
							class="
								w-full flex items-center gap-4 p-4 rounded-xl
								transition-all duration-200 ease-out
								hover:bg-accent/50 active:scale-[0.98]
								touch-manipulation
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
							"
							style={isSelected ? 'background-color: rgba(1, 115, 92, 0.15); border: 1px solid rgba(1, 115, 92, 0.3);' : 'border: 1px solid rgba(107, 107, 107, 0.15);'}
							aria-label="Select {geoCommunity.name} location"
							type="button"
						>
							<!-- Community Info -->
							<div class="flex-1 flex flex-col items-start gap-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="text-lg font-bold text-foreground">
										{geoCommunity.emoji} {geoCommunity.name}
									</span>
									{#if geoCommunity.geofence}
										<div class="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
											style="background-color: rgba(1, 115, 92, 0.15); color: rgb(1, 115, 92);">
											<MapPin size={12} />
											<span>{geoCommunity.geofence.radiusMiles < 1 ? `${geoCommunity.geofence.radiusMiles} mi` : `${geoCommunity.geofence.radiusMiles} mi`}</span>
										</div>
									{/if}
								</div>
								<div class="text-sm text-muted-foreground">
									{geoCommunity.description}
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

					<!-- Separator -->
					<div class="py-3">
						<div class="flex items-center gap-3">
							<div class="flex-1 h-px" style="background-color: rgba(107, 107, 107, 0.2);"></div>
							<div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Filter by Line
							</div>
							<div class="flex-1 h-px" style="background-color: rgba(107, 107, 107, 0.2);"></div>
						</div>
					</div>

					<!-- Subway Line Communities -->
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
							aria-label="Filter by {community.name} line"
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
