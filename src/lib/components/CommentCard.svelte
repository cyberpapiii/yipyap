<script lang="ts">
	import { Clock, MoreHorizontal } from 'lucide-svelte'
	import { onMount } from 'svelte'
	import VoteButtons from './VoteButtons.svelte'
	import AnonymousAvatar from './AnonymousAvatar.svelte'
	import type { CommentCardProps } from '$lib/types'
	import { formatDistanceToNow } from '$lib/utils/date'

	let {
		comment,
		depth = 0,
		maxDepth = 3,
		onVote,
		onReply,
		onDelete
	}: CommentCardProps = $props()

	// Animation state
	let isHovered = $state(false)
	let isPressed = $state(false)
	let showOptionsMenu = $state(false)

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

	// Handle delete
	async function handleDelete() {
		// Warning haptic before confirm
		if ('vibrate' in navigator) {
			navigator.vibrate(30)
		}

		if (confirm('Are you sure you want to delete this comment?')) {
			// Delete action haptic
			if ('vibrate' in navigator) {
				navigator.vibrate([10, 50, 10])
			}
			await onDelete?.(comment.id)
		}
		showOptionsMenu = false
	}

	// Toggle options menu
	function toggleOptionsMenu(e: Event) {
		e.stopPropagation()
		showOptionsMenu = !showOptionsMenu
		if ('vibrate' in navigator) {
			navigator.vibrate(5)
		}
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

	// Removed formattedContent - using plain text with CSS whitespace handling
	let timeAgo = $state('')
	let indentClass = $state('')
	let depthStyles = $state({ opacity: 1, borderColor: '' })
	let showNestedReplies = $state(depth < maxDepth)

	// Click outside handler to close options menu
	function handleClickOutside(e: Event) {
		if (!showOptionsMenu) return
		const target = e.target as HTMLElement
		if (!target.closest('.options-menu-container')) {
			showOptionsMenu = false
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside)
		return () => {
			document.removeEventListener('click', handleClickOutside)
		}
	})

	$effect(() => {
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
			bg-card/60 border border-border/60 rounded-xl p-3 mb-1.5
			transition-all duration-300 ease-out
			hover:bg-card/80 hover:border-border hover:shadow-sm
			{isPressed ? 'scale-[0.99] bg-card/90' : 'scale-100'}
			will-change-transform
		"
		role="article"
	>
		<div class="flex gap-3 items-start">
			<!-- Avatar -->
			<div class="flex-shrink-0">
				<AnonymousAvatar user={comment.anonymous_user} size="md" />
			</div>

			<!-- Comment content -->
			<div class="flex-1 min-w-0" style:opacity={depthStyles.opacity}>
				<!-- Header -->
				<div class="flex items-start gap-2 -mb-2">
					<div class="flex items-center gap-1 text-xs" style="color: #6B6B6B;">
						<Clock size={12} />
						<time datetime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>
							{timeAgo}
						</time>
					</div>
					{#if comment.is_user_comment}
						<span class="text-[9px] px-1 py-0.5 rounded" style="color: #6B6B6B; background-color: rgba(107, 107, 107, 0.1);">
							You
						</span>
					{/if}
					<div class="relative ml-auto options-menu-container">
						<button
							class="
								p-0 rounded-md
								transition-all duration-200 ease-out
								hover:bg-accent hover:text-foreground
								active:scale-90 active:bg-accent/70
								touch-manipulation
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
							"
							style="color: #6B6B6B;"
							onclick={toggleOptionsMenu}
							aria-label="More options for this comment"
							type="button"
						>
							<MoreHorizontal size={16} />
						</button>

						<!-- Options dropdown menu -->
						{#if showOptionsMenu}
							<div
								class="
									absolute top-full right-0 mt-1 min-w-32
									bg-card border border-border rounded-xl shadow-lg
									py-1 z-10 animate-fade-in
								"
								role="menu"
							>
								{#if comment.is_user_comment && onDelete}
									<button
										class="
											w-full px-3 py-2 text-left text-sm
											text-red-500 hover:bg-red-500/10 hover:text-red-600
											transition-colors flex items-center gap-2
										"
										onclick={handleDelete}
										role="menuitem"
									>
										🗑️ Delete Comment
									</button>
								{:else}
									<div class="px-3 py-2 text-xs text-muted-foreground">
										No options available
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- Content -->
				<div class="prose prose-sm max-w-none text-foreground mb-3 selectable leading-relaxed whitespace-pre-line">
					{comment.content}
				</div>

				<!-- Icon row -->
				<div class="flex items-center justify-end gap-4">
					<!-- Reply button -->
					{#if onReply}
						<button
							class="
								flex items-center gap-1.5 px-2 py-1
								rounded-md transition-all duration-200 ease-out
								text-sm text-muted-foreground
								hover:text-foreground hover:bg-accent/50
								active:scale-90 active:bg-accent/70
								touch-manipulation
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
							"
							onclick={handleReply}
							type="button"
							aria-label={`Reply to comment by ${comment.anonymous_user.subway_line} line user`}
						>
							<span class="font-medium">Reply</span>
						</button>
					{/if}

					<!-- Vote buttons -->
					<div
						role="none"
						onclick={(event) => event.stopPropagation()}
						onkeydown={(event) => event.stopPropagation()}
					>
						{#if onVote}
							<VoteButtons
								voteScore={comment.vote_score}
								userVote={comment.user_vote}
								onVote={handleVote}
								size="sm"
								orientation="horizontal"
							/>
						{:else}
							<div class="flex items-center gap-2 text-muted-foreground">
								<span class="text-sm font-medium tabular-nums">
									{comment.vote_score}
								</span>
							</div>
						{/if}
					</div>
				</div>

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
						{onDelete}
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
