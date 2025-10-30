<script lang="ts">
	import { ChevronUp, ChevronDown } from 'lucide-svelte'
	import type { VoteButtonsProps } from '$lib/types'
	import { tv } from 'tailwind-variants'
	import { onMount } from 'svelte'
	import { voteNotifications } from '$lib/services/toastNotifications'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		voteScore,
		userVote,
		onVote,
		disabled = false,
		size = 'md',
		orientation = 'vertical'
	}: VoteButtonsProps = $props()

	// Animation state
	let isAnimating = $state(false)
	let lastVote = $state(userVote)
	let scoreAnimating = $state(false)
	let errorState = $state(false)
	let successPulse = $state(false)

	const buttonVariants = tv({
		base: 'relative flex items-center justify-center rounded-full border-2 border-border touch-manipulation select-none transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 focus-vote',
		variants: {
			size: {
				sm: 'h-5 w-5 min-h-[20px] min-w-[20px]',
				md: 'h-7 w-7 min-h-[28px] min-w-[28px]',
				lg: 'h-9 w-9 min-h-[36px] min-w-[36px]'
			},
			variant: {
				neutral: 'text-muted-foreground hover:text-foreground hover:bg-accent/70 active:scale-95 active:bg-accent',
				upvoted: 'text-white bg-vote-up border-vote-up hover:bg-vote-up/90 active:scale-95',
				downvoted: 'text-white bg-vote-down border-vote-down hover:bg-vote-down/90 active:scale-95',
				animating: 'scale-95',
				error: 'text-red-600 bg-red-100 border-2 border-red-300',
				success: ''
			}
		}
	})

	const iconSizes = {
		sm: 14,
		md: 16,
		lg: 20
	}

	const scoreVariants = tv({
		base: 'font-semibold tabular-nums transition-all duration-200 ease-in-out',
		variants: {
			size: {
				sm: 'text-sm',
				md: 'text-base',
				lg: 'text-lg'
			},
			score: {
				positive: 'text-vote-up drop-shadow-sm',
				negative: 'text-vote-down drop-shadow-sm',
				neutral: 'text-muted-foreground'
			},
			animation: {
				normal: '',
				bounce: 'animate-score-bounce'
			}
		}
	})

	// Handle vote actions with animations, haptic feedback, and error handling
	async function handleUpvote() {
		if (disabled || isAnimating) return

		const newVote = userVote === 'up' ? null : 'up'
		const previousVote = userVote

		// Clear any previous error state
		errorState = false

		// Trigger haptic feedback
		hapticsStore.trigger(newVote === 'up' ? 'vote-up' : 'vote-remove')

		// Start animation
		isAnimating = true
		scoreAnimating = true

		// Call onVote without awaiting - let parent handle optimistic update
		onVote(newVote).catch(error => {
			// Show error state
			errorState = true
			setTimeout(() => {
				errorState = false
			}, 2000)

			// Show error notification
			voteNotifications.voteFailed(error instanceof Error ? error.message : 'Vote failed')

			// Trigger error haptic feedback
			hapticsStore.trigger('error')
		})

		// End animation quickly
		setTimeout(() => {
			isAnimating = false
			scoreAnimating = false
		}, 150)
	}

	async function handleDownvote() {
		if (disabled || isAnimating) return

		const newVote = userVote === 'down' ? null : 'down'
		const previousVote = userVote

		// Clear any previous error state
		errorState = false

		// Trigger haptic feedback
		hapticsStore.trigger(newVote === 'down' ? 'vote-down' : 'vote-remove')

		// Start animation
		isAnimating = true
		scoreAnimating = true

		// Call onVote without awaiting - let parent handle optimistic update
		onVote(newVote).catch(error => {
			// Show error state
			errorState = true
			setTimeout(() => {
				errorState = false
			}, 2000)

			// Show error notification
			voteNotifications.voteFailed(error instanceof Error ? error.message : 'Vote failed')

			// Trigger error haptic feedback
			hapticsStore.trigger('error')
		})

		// End animation quickly
		setTimeout(() => {
			isAnimating = false
			scoreAnimating = false
		}, 150)
	}

	// Determine score color and animation state
	type ScoreColor = 'positive' | 'negative' | 'neutral'
	type VoteVariant = 'neutral' | 'upvoted' | 'downvoted' | 'animating' | 'error' | 'success'

	const scoreColor = $derived<ScoreColor>(voteScore > 0 ? 'positive' : voteScore < 0 ? 'negative' : 'neutral')
	const formattedScore = $derived(Math.abs(voteScore) >= 1000 ? `${(voteScore / 1000).toFixed(1)}k` : voteScore.toString())

	const upvoteVariant = $derived.by((): VoteVariant => {
		if (errorState) return 'error'
		if (isAnimating && userVote === 'up') return 'animating'
		if (successPulse && userVote === 'up') return 'success'
		return userVote === 'up' ? 'upvoted' : 'neutral'
	})

	const downvoteVariant = $derived.by((): VoteVariant => {
		if (errorState) return 'error'
		if (isAnimating && userVote === 'down') return 'animating'
		if (successPulse && userVote === 'down') return 'success'
		return userVote === 'down' ? 'downvoted' : 'neutral'
	})

	// Track vote changes with $effect for side effects only
	$effect(() => {
		if (lastVote !== userVote) {
			lastVote = userVote
		}
	})
</script>

<div class="{orientation === 'horizontal' ? 'flex flex-row items-center gap-2' : 'flex flex-col items-center gap-2'}" role="group" aria-label="Vote on this content">
	<!-- Upvote button -->
	<button
		class={buttonVariants({
			size,
			variant: upvoteVariant
		})}
		onclick={handleUpvote}
		disabled={disabled || isAnimating}
		aria-label={userVote === 'up' ? 'Remove upvote' : 'Upvote this content'}
		aria-pressed={userVote === 'up'}
		aria-describedby={errorState ? 'vote-error' : undefined}
		type="button"
		title={disabled ? 'Voting disabled' : (userVote === 'up' ? 'Remove upvote' : 'Upvote this content')}
	>
		<ChevronUp
			size={iconSizes[size]}
			class="transition-all duration-150 ease-in-out"
		/>
	</button>

	<!-- Score display -->
	<div class="relative flex items-center justify-center">
		<span
			class={scoreVariants({
				size,
				score: scoreColor,
				animation: scoreAnimating ? 'bounce' : 'normal'
			})}
			aria-label={`Current score: ${voteScore} ${voteScore === 1 ? 'point' : 'points'}`}
			aria-live="polite"
		>
			{formattedScore}
		</span>
	</div>

	<!-- Downvote button -->
	<button
		class={buttonVariants({
			size,
			variant: downvoteVariant
		})}
		onclick={handleDownvote}
		disabled={disabled || isAnimating}
		aria-label={userVote === 'down' ? 'Remove downvote' : 'Downvote this content'}
		aria-pressed={userVote === 'down'}
		aria-describedby={errorState ? 'vote-error' : undefined}
		type="button"
		title={disabled ? 'Voting disabled' : (userVote === 'down' ? 'Remove downvote' : 'Downvote this content')}
	>
		<ChevronDown
			size={iconSizes[size]}
			class="transition-all duration-150 ease-in-out"
		/>
	</button>
</div>

<!-- Hidden error message for screen readers -->
{#if errorState}
	<div id="vote-error" class="sr-only" aria-live="polite">
		Vote failed. Please try again.
	</div>
{/if}
