<script lang="ts">
	import { ChevronUp, ChevronDown } from 'lucide-svelte'
	import type { VoteButtonsProps } from '$lib/types'
	import { tv } from 'tailwind-variants'
	import { onMount } from 'svelte'
	import { voteNotifications } from '$lib/services/notifications'

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

	// Haptic feedback function
	function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
		if ('vibrate' in navigator) {
			const patterns = {
				light: 10,
				medium: 20,
				heavy: 50
			}
			try {
				navigator.vibrate(patterns[type])
			} catch (e) {
				// Ignore vibration errors
			}
		}
	}

	const buttonVariants = tv({
		base: 'relative flex items-center justify-center rounded-full border-2 border-border touch-manipulation select-none transition-all duration-300 ease-out will-change-transform active:duration-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 focus-vote',
		variants: {
			size: {
				sm: 'h-6 w-6 min-h-[24px] min-w-[24px]',
				md: 'h-8 w-8 min-h-[32px] min-w-[32px]',
				lg: 'h-10 w-10 min-h-[40px] min-w-[40px]'
			},
			variant: {
				neutral: 'text-muted-foreground hover:text-foreground hover:bg-accent/70 hover:scale-110 active:scale-95 active:bg-accent transition-vote',
				upvoted: 'text-white bg-vote-up border-vote-up hover:bg-vote-up/90 hover:scale-110 active:scale-95 active:bg-vote-up shadow-vote transition-vote',
				downvoted: 'text-white bg-vote-down border-vote-down hover:bg-vote-down/90 hover:scale-110 active:scale-95 active:bg-vote-down shadow-vote transition-vote',
				animating: 'animate-vote-bounce',
				error: 'text-red-600 bg-red-100 border-2 border-red-300 animate-pulse',
				success: 'animate-vote-pulse shadow-vote-active'
			}
		}
	})

	const iconSizes = {
		sm: 14,
		md: 16,
		lg: 20
	}

	const scoreVariants = tv({
		base: 'font-semibold tabular-nums transition-all duration-300 ease-out will-change-transform',
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
		triggerHapticFeedback(newVote === 'up' ? 'medium' : 'light')

		// Start animation
		isAnimating = true
		scoreAnimating = true

		try {
			await onVote(newVote)

			// Show success feedback
			if (newVote !== previousVote) {
				successPulse = true
				setTimeout(() => {
					successPulse = false
				}, 600)

				// Show subtle notification for successful votes
				if (newVote === 'up') {
					// Could optionally show success toast for important actions
				}
			}
		} catch (error) {
			// Show error state
			errorState = true
			setTimeout(() => {
				errorState = false
			}, 2000)

			// Show error notification
			voteNotifications.voteFailed(error instanceof Error ? error.message : 'Vote failed')

			// Trigger error haptic feedback
			triggerHapticFeedback('heavy')
		} finally {
			// End animation after a delay
			setTimeout(() => {
				isAnimating = false
			}, 300)
			setTimeout(() => {
				scoreAnimating = false
			}, 400)
		}
	}

	async function handleDownvote() {
		if (disabled || isAnimating) return

		const newVote = userVote === 'down' ? null : 'down'
		const previousVote = userVote

		// Clear any previous error state
		errorState = false

		// Trigger haptic feedback
		triggerHapticFeedback(newVote === 'down' ? 'medium' : 'light')

		// Start animation
		isAnimating = true
		scoreAnimating = true

		try {
			await onVote(newVote)

			// Show success feedback
			if (newVote !== previousVote) {
				successPulse = true
				setTimeout(() => {
					successPulse = false
				}, 600)

				// Show subtle notification for successful votes
				if (newVote === 'down') {
					// Could optionally show success toast for important actions
				}
			}
		} catch (error) {
			// Show error state
			errorState = true
			setTimeout(() => {
				errorState = false
			}, 2000)

			// Show error notification
			voteNotifications.voteFailed(error instanceof Error ? error.message : 'Vote failed')

			// Trigger error haptic feedback
			triggerHapticFeedback('heavy')
		} finally {
			// End animation after a delay
			setTimeout(() => {
				isAnimating = false
			}, 300)
			setTimeout(() => {
				scoreAnimating = false
			}, 400)
		}
	}

	// Determine score color and animation state
	type ScoreColor = 'positive' | 'negative' | 'neutral'
	type VoteVariant = 'neutral' | 'upvoted' | 'downvoted' | 'animating' | 'error' | 'success'

	let scoreColor = $state<ScoreColor>('neutral')
	let formattedScore = $state(voteScore.toString())
	let upvoteVariant = $state<VoteVariant>('neutral')
	let downvoteVariant = $state<VoteVariant>('neutral')

	$effect(() => {
		scoreColor = voteScore > 0 ? 'positive' : voteScore < 0 ? 'negative' : 'neutral'
		formattedScore = Math.abs(voteScore) >= 1000 ? `${(voteScore / 1000).toFixed(1)}k` : voteScore.toString()

		if (lastVote !== userVote) {
			lastVote = userVote
		}

		if (errorState) {
			upvoteVariant = 'error'
			downvoteVariant = 'error'
			return
		}

		upvoteVariant = userVote === 'up' ? 'upvoted' : 'neutral'
		downvoteVariant = userVote === 'down' ? 'downvoted' : 'neutral'

		if (successPulse && userVote === 'up') {
			upvoteVariant = 'success'
		}
		if (successPulse && userVote === 'down') {
			downvoteVariant = 'success'
		}

		if (isAnimating && userVote === 'up') {
			upvoteVariant = 'animating'
		}
		if (isAnimating && userVote === 'down') {
			downvoteVariant = 'animating'
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
		{#if isAnimating}
			<div class="animate-spin text-current">
				<svg width={iconSizes[size]} height={iconSizes[size]} viewBox="0 0 24 24" fill="none" class="animate-spin">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416" class="animate-[spin_1s_linear_infinite]" />
				</svg>
			</div>
		{:else}
			<ChevronUp
				size={iconSizes[size]}
				class="transition-transform duration-200 {userVote === 'up' ? 'scale-110' : ''} {errorState ? 'animate-bounce' : ''}"
			/>
		{/if}

		<!-- Success pulse animation -->
		{#if successPulse && userVote === 'up'}
			<div class="absolute inset-0 rounded-full bg-vote-up/30 animate-vote-pulse"></div>
		{/if}

		<!-- Loading animation ring -->
		{#if userVote === 'up' && isAnimating && !errorState}
			<div class="absolute inset-0 rounded-full bg-vote-up/20 animate-ping"></div>
		{/if}

		<!-- Error state indicator -->
		{#if errorState}
			<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
		{/if}
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
		{#if isAnimating}
			<div class="animate-spin text-current">
				<svg width={iconSizes[size]} height={iconSizes[size]} viewBox="0 0 24 24" fill="none" class="animate-spin">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416" class="animate-[spin_1s_linear_infinite]" />
				</svg>
			</div>
		{:else}
			<ChevronDown
				size={iconSizes[size]}
				class="transition-transform duration-200 {userVote === 'down' ? 'scale-110' : ''} {errorState ? 'animate-bounce' : ''}"
			/>
		{/if}

		<!-- Success pulse animation -->
		{#if successPulse && userVote === 'down'}
			<div class="absolute inset-0 rounded-full bg-vote-down/30 animate-vote-pulse"></div>
		{/if}

		<!-- Loading animation ring -->
		{#if userVote === 'down' && isAnimating && !errorState}
			<div class="absolute inset-0 rounded-full bg-vote-down/20 animate-ping"></div>
		{/if}

		<!-- Error state indicator -->
		{#if errorState}
			<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
		{/if}
	</button>
</div>

<!-- Hidden error message for screen readers -->
{#if errorState}
	<div id="vote-error" class="sr-only" aria-live="polite">
		Vote failed. Please try again.
	</div>
{/if}
