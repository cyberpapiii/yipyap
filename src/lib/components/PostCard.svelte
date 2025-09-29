<script lang="ts">
	import { MessageSquare, Clock, MoreHorizontal } from 'lucide-svelte'
	import VoteButtons from './VoteButtons.svelte'
	import AnonymousAvatar from './AnonymousAvatar.svelte'
	import type { PostCardProps } from '$lib/types'
	import { formatDistanceToNow } from '$lib/utils/date'
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'

	// Enhanced interaction state
	let cardElement: HTMLElement
	let isPressed = $state(false)
	let isHovered = $state(false)
	let rippleElements: HTMLElement[] = []

	let {
		post,
		showReplies = true,
		isInThread = false,
		onVote,
		onReply
	}: PostCardProps = $props()

	// Enhanced navigation with haptic feedback
	function openThread() {
		if (!isInThread) {
			// Haptic feedback for navigation
			if ('vibrate' in navigator) {
				navigator.vibrate(10)
			}
			goto(`/thread/${post.id}`)
		}
	}

	// Handle reply with feedback
	function handleReply(e: Event) {
		e.stopPropagation()
		// Haptic feedback for reply
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}
		onReply?.(post)
	}

	// Handle vote
	async function handleVote(voteType: 'up' | 'down' | null) {
		await onVote?.(post.id, voteType)
	}

	// Ripple effect for touch feedback
	function createRipple(e: MouseEvent | TouchEvent) {
		if (!cardElement || isInThread) return

		const rect = cardElement.getBoundingClientRect()
		const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX
		const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY

		const x = clientX - rect.left
		const y = clientY - rect.top

		const ripple = document.createElement('div')
		ripple.className = 'absolute bg-primary/10 rounded-full pointer-events-none animate-ping'
		ripple.style.left = `${x - 10}px`
		ripple.style.top = `${y - 10}px`
		ripple.style.width = '20px'
		ripple.style.height = '20px'

		cardElement.appendChild(ripple)
		rippleElements.push(ripple)

		// Remove ripple after animation
		setTimeout(() => {
			if (ripple.parentNode) {
				ripple.parentNode.removeChild(ripple)
			}
			rippleElements = rippleElements.filter(r => r !== ripple)
		}, 600)
	}

	const timeAgo = () => formatDistanceToNow(new Date(post.created_at))

	const formattedContent = () => post.content.replace(/\n/g, '<br>')

	// Touch and mouse event handlers
	function handleTouchStart(e: TouchEvent) {
		isPressed = true
		createRipple(e)
	}

	function handleTouchEnd() {
		isPressed = false
	}

	function handleMouseDown(e: MouseEvent) {
		isPressed = true
		createRipple(e)
	}

	function handleMouseUp() {
		isPressed = false
	}

	function handleMouseEnter() {
		isHovered = true
	}

	function handleMouseLeave() {
		isHovered = false
		isPressed = false
	}

	// Keyboard navigation
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			isPressed = true
			openThread()
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			isPressed = false
		}
	}

	// Cleanup ripples on unmount
	onMount(() => {
		return () => {
			rippleElements.forEach(ripple => {
				if (ripple.parentNode) {
					ripple.parentNode.removeChild(ripple)
				}
			})
		}
	})

</script>

<style>
	.icon-hover {
		transition: transform 0.3s ease;
	}
	.group:hover .icon-hover {
		transform: scale(1.2) rotate(15deg);
	}
</style>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
	bind:this={cardElement}
	class="
		relative overflow-hidden
	bg-card border border-border rounded-2xl p-4
		transition-all duration-300 ease-out
		will-change-transform
		touch-manipulation select-none
		{!isInThread ? 'cursor-pointer hover:bg-accent/20 hover:border-border hover:shadow-lg hover:shadow-primary/5' : ''}
		{isPressed ? 'scale-[0.98] bg-accent/40' : 'scale-100'}
		{isHovered && !isInThread ? 'transform-gpu' : ''}
		animate-fade-in
	"
	onclick={openThread}
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
	role={!isInThread ? 'button' : 'article'}
	tabindex={!isInThread ? 0 : undefined}
	aria-label={`Post by ${post.anonymous_user.emoji} anonymous user. ${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}. Posted ${timeAgo()}. ${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'}.`}
	aria-pressed={!isInThread ? isPressed : undefined}
>
	<div class="flex gap-3">
		<!-- Post content -->
		<div class="flex-1 min-w-0">
			<!-- Header -->
			<div class="flex items-center gap-2 mb-2">
				<AnonymousAvatar user={post.anonymous_user} size="sm" />
				<div class="flex items-center gap-1 text-xs text-muted-foreground">
					<Clock size={12} />
				<time datetime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
					{timeAgo()}
				</time>
				</div>
				{#if post.is_user_post}
					<span class="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
						You
					</span>
				{/if}
				<!-- More options button -->
				<button
					class="
						ml-auto p-2 -mr-2 rounded-md
						transition-all duration-200 ease-out
						hover:bg-accent text-muted-foreground hover:text-foreground
						active:scale-90 active:bg-accent/70
						touch-manipulation
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
					"
						onclick={(e) => {
						e.stopPropagation()
						// Haptic feedback for options
						if ('vibrate' in navigator) {
							navigator.vibrate(5)
						}
					}}
					aria-label="More options for this post"
					type="button"
				>
					<MoreHorizontal size={16} />
				</button>
			</div>

			<!-- Content -->
			<div class="prose prose-sm max-w-none text-foreground mb-3 selectable leading-relaxed">
				{@html formattedContent()}
			</div>

			<!-- Icon row -->
			<div class="flex items-center justify-end gap-4">
				<!-- Comment button -->
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
					aria-label={`Reply to post (${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'})`}
					type="button"
				>
					<MessageSquare size={16} />
					<span class="font-medium">{post.comment_count}</span>
				</button>

				<!-- Vote buttons -->
				<div
					role="none"
					onclick={(event) => event.stopPropagation()}
					onkeydown={(event) => event.stopPropagation()}
				>
					{#if onVote}
						<VoteButtons
							voteScore={post.vote_score}
							userVote={post.user_vote}
							onVote={handleVote}
							size="sm"
							orientation="horizontal"
						/>
					{:else}
						<div class="flex items-center gap-2 text-muted-foreground">
							<MessageSquare size={16} />
							<span class="text-sm font-medium tabular-nums">
								{post.vote_score}
							</span>
						</div>
					{/if}
				</div>
			</div>

		</div>
	</div>
</article>

