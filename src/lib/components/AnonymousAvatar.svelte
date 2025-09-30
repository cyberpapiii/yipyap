<script lang="ts">
	import type { AnonymousAvatarProps } from '$lib/types'
	import { tv } from 'tailwind-variants'

	let { user, size = 'md', showTooltip = false }: AnonymousAvatarProps = $props()

	// Subway line to color mapping based on real NYC MTA colors
	const subwayLineColors: Record<string, string> = {
		// Red lines (IRT)
		'1': 'mta-red',
		'2': 'mta-red',
		'3': 'mta-red',
		// Green lines (IRT)
		'4': 'mta-dark-green',
		'5': 'mta-dark-green',
		'6': 'mta-dark-green',
		// Purple line (IRT)
		'7': 'mta-purple',
		// Blue lines (IND/BMT)
		'A': 'mta-blue',
		'C': 'mta-blue',
		'E': 'mta-blue',
		// Orange lines (IND/BMT)
		'B': 'mta-orange',
		'D': 'mta-orange',
		'F': 'mta-orange',
		'M': 'mta-orange',
		// Yellow lines (IND/BMT)
		'N': 'mta-yellow',
		'Q': 'mta-yellow',
		'R': 'mta-yellow',
		'W': 'mta-yellow',
		// Light green line (IND/BMT)
		'G': 'mta-light-green',
		// Brown lines (IND/BMT)
		'J': 'mta-brown',
		'Z': 'mta-brown',
		// Grey line (IND/BMT)
		'L': 'mta-grey'
	}

	const avatarVariants = tv({
		base: 'inline-flex items-center justify-center rounded-full font-bold select-none transition-all duration-200 ease-out ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:scale-110 hover:shadow-lg cursor-pointer',
		variants: {
			size: {
				sm: 'h-7 w-7 text-base min-h-[28px] min-w-[28px]',
				md: 'h-9 w-9 text-xl min-h-[36px] min-w-[36px]',
				lg: 'h-11 w-11 text-2xl min-h-[44px] min-w-[44px]'
			}
		}
	})

	// Text color based on background (yellow lines need black text)
	const textColorClass = $derived(() => {
		const needsBlackText = ['N', 'Q', 'R', 'W'] // Yellow line variants
		return needsBlackText.includes(user.subway_line) ? 'text-black' : 'text-white'
	})

	const chipVariants = tv({
		base: 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-medium transition-all duration-200 ease-out ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[32px]',
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
			'1': '1 Line (Red)', '2': '2 Line (Red)', '3': '3 Line (Red)',
			'4': '4 Line (Green)', '5': '5 Line (Green)', '6': '6 Line (Green)',
			'7': '7 Line (Purple)',
			'A': 'A Line (Blue)', 'C': 'C Line (Blue)', 'E': 'E Line (Blue)',
			'B': 'B Line (Orange)', 'D': 'D Line (Orange)', 'F': 'F Line (Orange)', 'M': 'M Line (Orange)',
			'N': 'N Line (Yellow)', 'Q': 'Q Line (Yellow)', 'R': 'R Line (Yellow)', 'W': 'W Line (Yellow)',
			'G': 'G Line (Light Green)',
			'J': 'J Line (Brown)', 'Z': 'Z Line (Brown)',
			'L': 'L Line (Grey)'
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
			'mta-dark-green': 'green',
			'mta-purple': 'purple'
		}
		const colorName = colorNames[user.subway_color] || 'blue'
		return `Anonymous user with ${user.subway_line} subway line icon and ${colorName} background`
	})
</script>

{#if showTooltip}
	<div
		class="{chipVariants({ size })} {bgColorClass()} {textColorClass()}"
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
		class="{avatarVariants({ size })} {bgColorClass()} {textColorClass()}"
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