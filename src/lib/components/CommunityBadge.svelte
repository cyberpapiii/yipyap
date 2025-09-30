<script lang="ts">
	import type { SubwayLine } from '$lib/types'
	import { tv } from 'tailwind-variants'

	let {
		line,
		size = 'sm'
	}: {
		line: SubwayLine
		size?: 'xs' | 'sm' | 'md'
	} = $props()

	// Subway line to color mapping (same as AnonymousAvatar)
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
		'L': 'mta-grey',
		// Teal line (SIR)
		'T': 'mta-teal'
	}

	const badgeVariants = tv({
		base: 'inline-flex items-center justify-center rounded-full font-bold select-none',
		variants: {
			size: {
				xs: 'h-5 w-5 text-xs min-h-[20px] min-w-[20px]',
				sm: 'h-6 w-6 text-sm min-h-[24px] min-w-[24px]',
				md: 'h-8 w-8 text-base min-h-[32px] min-w-[32px]'
			}
		}
	})

	// Text color based on background (yellow lines need black text)
	const textColorClass = $derived(() => {
		const needsBlackText = ['N', 'Q', 'R', 'W'] // Yellow line variants
		return needsBlackText.includes(line) ? 'text-black' : 'text-white'
	})

	// Get the background color class for the subway line
	const bgColorClass = $derived(() => {
		const correctColor = subwayLineColors[line] || 'mta-blue'
		return `bg-${correctColor}`
	})
</script>

<div
	class="{badgeVariants({ size })} {bgColorClass()} {textColorClass()}"
	role="img"
	aria-label="{line} Line"
>
	<span class="leading-none" aria-hidden="true">
		{line}
	</span>
</div>
