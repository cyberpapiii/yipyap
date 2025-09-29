<script lang="ts">
	import { Clock, MoreHorizontal } from 'lucide-svelte'
	import VoteButtons from './VoteButtons.svelte'
	import AnonymousAvatar from './AnonymousAvatar.svelte'
	import type { CommentCardProps } from '$lib/types'
	import { formatDistanceToNow } from '$lib/utils/date'

	let {
		comment,
		depth = 0,
		maxDepth = 3,
		onVote,
		onReply
	}: CommentCardProps = $props()

	// Animation state
	let isHovered = $state(false)
	let isPressed = $state(false)

	// Handle vote
	async function handleVote(voteType: 'up' | 'down' | null) {
		await onVote?.(comment.id, voteType)
	}

	// Handle reply with haptic feedback
	function handleReply(e: Event) {
		e.stopPropagation()
		// Haptic feedback for reply
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		onReply?.(comment)
	}

	// Touch interaction handlers
	function handleMouseEnter() {
		isHovered = true
	}

	function handleMouseLeave() {
		isHovered = false
		isPressed = false
	}

	function handleMouseDown() {
		isPressed = true
	}

	function handleMouseUp() {
		isPressed = false
	}

	let formattedContent = $state('')
	let timeAgo = $state('')
	let indentClass = $state('')
	let depthStyles = $state({ opacity: 1, borderColor: '' })
	let showNestedReplies = $state(depth < maxDepth)

	$effect(() => {
		formattedContent = comment.content.replace(/\n/g, '<br>')
		timeAgo = formatDistanceToNow(new Date(comment.created_at))
		const indentLevels = ['', 'ml-2', 'ml-4', 'ml-6']
		indentClass = indentLevels[Math.min(depth, 3)] || 'ml-6'
		const opacity = Math.max(0.7, 1 - depth * 0.1)
		depthStyles = {
			opacity,
			borderColor: depth > 0 ? `hsl(0 0% 20% / ${opacity})` : ''
		}
		showNestedReplies = depth < maxDepth
	})
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	class={`${indentClass} ${depth > 0 ? 'border-l-2 pl-2' : ''} animate-fade-in`}
	style:border-color={depth > 0 ? depthStyles.borderColor : ''}
	style:animation-delay={`${depth * 100}ms`}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
>
	<div
		class="
			relative
			bg-card/60 border border-border/60 rounded-xl p-2 mb-1.5
			transition-all duration-300 ease-out
			hover:bg-card/80 hover:border-border hover:shadow-sm
			{isPressed ? 'scale-[0.99] bg-card/90' : 'scale-100'}
			will-change-transform
		"
		role="article"
	>
		<div class="flex gap-2">
			<!-- Vote buttons -->
			{#if onVote}
				<VoteButtons
					voteScore={comment.vote_score}
					userVote={comment.user_vote}
					onVote={handleVote}
					size="sm"
				/>
			{/if}

			<!-- Comment content -->
			<div class="flex-1 min-w-0" style:opacity={depthStyles.opacity}>
				<!-- Header -->
				<div class="flex items-center gap-1.5 mb-1.5">
					<AnonymousAvatar user={comment.anonymous_user} size="sm" />
					<div class="flex items-center gap-1 text-xs text-muted-foreground">
						<Clock size={10} />
						<time datetime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>
							{timeAgo}
						</time>
					</div>
					{#if comment.is_user_comment}
						<span class="text-xs text-primary bg-primary/10 px-1 py-0.5 rounded text-[10px]">
							You
						</span>
					{/if}
					<button
						class="
							ml-auto p-1 -mr-1 rounded-md
							transition-all duration-200 ease-out
							hover:bg-accent text-muted-foreground hover:text-foreground
							active:scale-90 active:bg-accent/70
							touch-manipulation
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
						"
						aria-label="More options for this comment"
						type="button"
						onclick={(e) => {
							e.stopPropagation()
							// Haptic feedback for options
							if ('vibrate' in navigator) {
								navigator.vibrate(5)
							}
						}}
					>
						<MoreHorizontal size={12} />
					</button>
				</div>

				<!-- Content -->
				<div class="text-sm text-foreground mb-1.5 selectable leading-snug">
					{@html formattedContent}
				</div>

				<!-- Actions -->
				{#if onReply}
					<button
						class="
							text-xs text-muted-foreground font-medium
							px-1.5 py-0.5 -mx-1.5 rounded-md
							transition-all duration-200 ease-out
							hover:text-foreground hover:bg-accent/50
							active:scale-95 active:bg-accent/70
							touch-manipulation
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
						"
						onclick={handleReply}
						type="button"
						aria-label={`Reply to comment by ${comment.anonymous_user.emoji}`}
					>
						Reply
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Nested replies with staggered animation -->
	{#if showNestedReplies && comment.replies && comment.replies.length > 0}
		<div class="space-y-0.5 animate-fade-in" style:animation-delay={`${(depth + 1) * 150}ms`}>
			{#each comment.replies as reply, index}
				<div
					class="animate-slide-up"
					style:animation-delay={`${(depth + 1) * 150 + index * 100}ms`}
				>
					<!-- svelte-ignore svelte_self_deprecated -->
					<svelte:self
						comment={reply}
						depth={depth + 1}
						{maxDepth}
						{onVote}
						{onReply}
					/>
				</div>
			{/each}
		</div>
	{:else if comment.reply_count > 0}
		<div class="ml-2 text-xs text-muted-foreground font-medium opacity-60">
			{comment.reply_count} more {comment.reply_count === 1 ? 'reply' : 'replies'}
		</div>
	{/if}
</article>
