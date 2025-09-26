<script lang="ts">
	import type { AnonymousAvatarProps } from '$lib/types'
	import { tv } from 'tailwind-variants'

	let { user, size = 'md', showTooltip = false }: AnonymousAvatarProps = $props()

	const avatarVariants = tv({
		base: 'inline-flex items-center justify-center rounded-full font-medium select-none transition-all duration-200 ease-out ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:scale-110 hover:shadow-lg cursor-pointer',
		variants: {
			size: {
				sm: 'h-6 w-6 text-xs min-h-[24px] min-w-[24px]',
				md: 'h-8 w-8 text-sm min-h-[32px] min-w-[32px]',
				lg: 'h-10 w-10 text-base min-h-[40px] min-w-[40px]'
			},
			color: {
				purple: 'bg-anonymous-1 text-white',
				blue: 'bg-anonymous-2 text-white',
				green: 'bg-anonymous-3 text-white',
				orange: 'bg-anonymous-4 text-white',
				red: 'bg-anonymous-5 text-white'
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
			},
			color: {
				purple: 'bg-anonymous-1',
				blue: 'bg-anonymous-2',
				green: 'bg-anonymous-3',
				orange: 'bg-anonymous-4',
				red: 'bg-anonymous-5'
			}
		}
	})

	// Enhanced display name with better accessibility
	const displayName = $derived(() => {
		const colorNames = {
			purple: 'Purple',
			blue: 'Blue',
			green: 'Green',
			orange: 'Orange',
			red: 'Red'
		}
		return `${user.emoji} ${colorNames[user.color]} Anonymous`
	})

	// Accessible description for screen readers
	const accessibleDescription = $derived(() => {
		const emojiDescriptions: Record<string, string> = {
			'🎭': 'theater mask',
			'🦄': 'unicorn',
			'🚀': 'rocket',
			'🌟': 'star',
			'🔥': 'fire',
			'💫': 'sparkles',
			'🎨': 'art palette',
			'🌈': 'rainbow',
			'⚡': 'lightning bolt',
			'🎪': 'circus tent'
		}
		const emojiDescription = emojiDescriptions[user.emoji] || user.emoji
		const colorNames = {
			purple: 'purple',
			blue: 'blue',
			green: 'green',
			orange: 'orange',
			red: 'red'
		}
		return `Anonymous user with ${emojiDescription} icon and ${colorNames[user.color]} background`
	})
</script>

{#if showTooltip}
	<div
		class={chipVariants({ size, color: user.color })}
		title={displayName()}
		role="img"
		aria-label={accessibleDescription()}
		aria-describedby="avatar-{user.id}-tooltip"
	>
		<span
			class="{size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-xl'} leading-none"
			aria-hidden="true"
		>
			{user.emoji}
		</span>
		<span class="font-medium" aria-hidden="true">Anonymous</span>
		<!-- Hidden tooltip for screen readers -->
		<span id="avatar-{user.id}-tooltip" class="sr-only">
			{accessibleDescription()}
		</span>
	</div>
{:else}
	<div
		class={avatarVariants({ size, color: user.color })}
		title={displayName()}
		role="img"
		aria-label={accessibleDescription()}
	>
		<span
			class="leading-none {size === 'sm' ? '' : 'transform hover:scale-110 transition-transform duration-200'}"
			aria-hidden="true"
		>
			{user.emoji}
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
