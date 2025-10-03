<script lang="ts">
	import { ChevronDown, MapPin } from 'lucide-svelte'
	import type { CommunityType } from '$lib/types'
	import { getCommunity } from '$lib/config/communities'
	import { getGeographicCommunity } from '$lib/config/communities'
	import CommunityBadge from './CommunityBadge.svelte'

	let {
		selectedCommunity,
		postCount,
		onClick
	}: {
		selectedCommunity: CommunityType | 'dimes_square'
		postCount: number
		onClick: () => void
	} = $props()

	// Check if this is a geographic community or subway line community
	const isGeographic = $derived(selectedCommunity === 'dimes_square' || selectedCommunity === 'nyc')
	const community = $derived(isGeographic ? null : getCommunity(selectedCommunity as CommunityType))
	const geoCommunity = $derived(
		selectedCommunity === 'dimes_square' ? getGeographicCommunity('dimes_square') :
		selectedCommunity === 'nyc' ? getGeographicCommunity('nyc') :
		null
	)

	function handleClick() {
		// Haptic feedback
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}
		onClick()
	}
</script>

<button
	onclick={handleClick}
	class="
		flex flex-col items-start gap-1 mt-2
		transition-all duration-200 ease-out
		hover:opacity-80 active:scale-[0.98]
		touch-manipulation
		focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-lg
	"
	aria-label="Select community"
	type="button"
>
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2">
			{#if isGeographic && geoCommunity}
				<!-- Geographic communities - show emoji, name, and location icon -->
				<div class="flex items-center gap-2">
					<span class="text-2xl">{geoCommunity.emoji}</span>
					<span class="text-xl font-bold">{geoCommunity.name}</span>
					{#if geoCommunity.geofence}
						<MapPin size={18} class="text-primary" />
					{/if}
				</div>
			{:else if community}
				<!-- Other subway line communities - show subway line badges -->
				{#each community.subwayLines as line}
					<div class="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
						style="background-color: {line === 'A' || line === 'C' || line === 'E' ? '#0062CF' : line === 'B' || line === 'D' || line === 'F' || line === 'M' ? '#EB6800' : line === 'N' || line === 'Q' || line === 'R' || line === 'W' ? '#F6BC26' : line === '1' || line === '2' || line === '3' ? '#D82233' : line === '4' || line === '5' || line === '6' ? '#009952' : line === '7' ? '#9A38A1' : line === 'T' ? '#008EB7' : line === 'G' ? '#799534' : line === 'L' ? '#7C858C' : '#8E5C33'}; color: {line === 'N' || line === 'Q' || line === 'R' || line === 'W' ? '#000' : '#FFF'}">
						{line}
					</div>
				{/each}
			{/if}
		</div>
		<ChevronDown
			size={24}
			class="transition-transform duration-200 text-muted-foreground"
			aria-hidden="true"
		/>
	</div>
	{#if postCount > 0}
		<span class="text-base text-muted-foreground">
			{postCount} {postCount === 1 ? 'post' : 'posts'}
		</span>
	{/if}
</button>
