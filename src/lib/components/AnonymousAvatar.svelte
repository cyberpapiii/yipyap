<script lang="ts">
	import type { AnonymousAvatarProps } from '$lib/types'
	import { tv } from 'tailwind-variants'

	let { user, size = 'md', showTooltip = false }: AnonymousAvatarProps = $props()

	// Subway line to color mapping based on MTA colors
	const subwayLineColors: Record<string, string> = {
		'A': 'mta-blue',
		'B': 'mta-orange',
		'G': 'mta-light-green',
		'J': 'mta-brown',
		'L': 'mta-grey',
		'N': 'mta-yellow',
		'1': 'mta-red',
		'4': 'mta-dark-green',
		'7': 'mta-purple',
		'T': 'mta-teal'
	}

	const avatarVariants = tv({
		base: 'inline-flex items-center justify-center rounded-full font-bold select-none transition-all duration-200 ease-out ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:scale-110 hover:shadow-lg cursor-pointer text-white',
		variants: {
			size: {
				sm: 'h-7 w-7 text-base min-h-[28px] min-w-[28px]',
				md: 'h-9 w-9 text-xl min-h-[36px] min-w-[36px]',
				lg: 'h-11 w-11 text-2xl min-h-[44px] min-w-[44px]'
			}
		}
	})

	const chipVariants = tv({
		base: 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-white font-medium transition-all duration-200 ease-out ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[32px]',
		variants: {
			size: {
				sm: 'text-xs px-1.5 py-0.5',
				md: 'text-sm px-2 py-1',
				lg: 'text-base px-2.5 py-1.5'
			}
		}
	})

	// Get the background color class for the subway line (always use correct mapping)
	const bgColorClass = $derived(() => {
		// Always use the correct color mapping based on subway line
		const correctColor = subwayLineColors[user.subway_line] || 'mta-blue'
		return `bg-${correctColor}`
	})

	// Enhanced display name with better accessibility
	const displayName = $derived(() => {
		const lineNames: Record<string, string> = {
			'A': 'A Line (Blue)',
			'B': 'B Line (Orange)',
			'G': 'G Line (Light Green)',
			'J': 'J Line (Brown)',
			'L': 'L Line (Grey)',
			'N': 'N Line (Yellow)',
			'1': '1 Line (Red)',
			'4': '4 Line (Dark Green)',
			'7': '7 Line (Purple)',
			'T': 'T Line (Teal)'
		}
		return `${lineNames[user.subway_line] || user.subway_line} Anonymous`
	})

	// Accessible description for screen readers
	const accessibleDescription = $derived(() => {
		const colorNames: Record<string, string> = {
			'mta-blue': 'blue',
			'mta-orange': 'orange',
			'mta-light-green': 'light green',
			'mta-brown': 'brown',
			'mta-grey': 'grey',
			'mta-yellow': 'yellow',
			'mta-red': 'red',
			'mta-dark-green': 'dark green',
			'mta-purple': 'purple',
			'mta-teal': 'teal'
		}
		const colorName = colorNames[user.subway_color] || 'blue'
		return `Anonymous user with ${user.subway_line} subway line icon and ${colorName} background`
	})
</script>

{#if showTooltip}
	<div
		class="{chipVariants({ size })} {bgColorClass()}"
		title={displayName()}
		role="img"
		aria-label={accessibleDescription()}
		aria-describedby="avatar-{user.id}-tooltip"
	>
		<span
			class="{size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-xl'} leading-none font-bold"
			aria-hidden="true"
		>
			{user.subway_line}
		</span>
		<span class="font-medium" aria-hidden="true">Anonymous</span>
		<!-- Hidden tooltip for screen readers -->
		<span id="avatar-{user.id}-tooltip" class="sr-only">
			{accessibleDescription()}
		</span>
	</div>
{:else}
	<div
		class="{avatarVariants({ size })} {bgColorClass()}"
		title={displayName()}
		role="img"
		aria-label={accessibleDescription()}
	>
		<span
			class="leading-none {size === 'sm' ? '' : 'transform hover:scale-110 transition-transform duration-200'}"
			aria-hidden="true"
		>
			{user.subway_line}
		</span>
	</div>
{/if}

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>