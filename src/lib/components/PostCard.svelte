<script lang="ts">
	import { Clock, MoreHorizontal } from 'lucide-svelte'
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
	let showOptionsMenu = $state(false)

	let {
		post,
		showReplies = true,
		isInThread = false,
		onVote,
		onReply,
		onDelete
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

	// Handle delete
	async function handleDelete() {
		if (confirm('Are you sure you want to delete this post?')) {
			await onDelete?.(post.id)
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

	// Click outside handler to close options menu
	function handleClickOutside(e: Event) {
		if (!showOptionsMenu) return
		const target = e.target as HTMLElement
		if (!target.closest('.options-menu-container')) {
			showOptionsMenu = false
		}
	}

	// Cleanup ripples on unmount
	onMount(() => {
		document.addEventListener('click', handleClickOutside)
		return () => {
			document.removeEventListener('click', handleClickOutside)
			rippleElements.forEach(ripple => {
				if (ripple.parentNode) {
					ripple.parentNode.removeChild(ripple)
				}
			})
		}
	})

</script>


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
	<div class="flex gap-3 items-start">
		<!-- Avatar -->
		<AnonymousAvatar user={post.anonymous_user} size="md" />

		<!-- Post content -->
		<div class="flex-1 min-w-0">
			<!-- Header -->
			<div class="flex items-center gap-2 mb-0.5">
				<div class="flex items-center gap-1 text-xs" style="color: #6B6B6B;">
					<Clock size={12} />
				<time datetime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
					{timeAgo()}
				</time>
				</div>
				{#if post.is_user_post}
					<span class="text-xs px-1.5 py-0.5 rounded" style="color: #6B6B6B; background-color: rgba(107, 107, 107, 0.1);">
						You
					</span>
				{/if}
				<div class="relative ml-auto options-menu-container">
					<button
						class="
							p-2 -mr-2 rounded-md
							transition-all duration-200 ease-out
							hover:bg-accent hover:text-foreground
							active:scale-90 active:bg-accent/70
							touch-manipulation
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
						"
						style="color: #6B6B6B;"
						onclick={toggleOptionsMenu}
						aria-label="More options for this post"
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
							{#if post.is_user_post && onDelete}
								<button
									class="
										w-full px-3 py-2 text-left text-sm
										text-red-500 hover:bg-red-500/10 hover:text-red-600
										transition-colors flex items-center gap-2
									"
									onclick={handleDelete}
									role="menuitem"
								>
									🗑️ Delete Post
								</button>
							{/if}
						</div>
					{/if}
				</div>
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
						text-sm text-foreground
						hover:bg-accent/50
						active:scale-90 active:bg-accent/70
						touch-manipulation
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
					"
					onclick={handleReply}
					aria-label={`Reply to post (${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'})`}
					type="button"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
						<path d="M11.9973 21C10.0004 20.9997 8.06029 20.3353 6.48243 19.1114C4.90457 17.8874 3.77857 16.1735 3.2817 14.2394C2.78483 12.3053 2.94531 10.2608 3.73787 8.42795C4.53044 6.59506 5.91008 5.0778 7.65959 4.11506C9.40909 3.15231 11.4291 2.79875 13.4016 3.11004C15.3741 3.42132 17.1871 4.37978 18.5551 5.83452C19.9231 7.28925 20.7684 9.15764 20.958 11.1455C21.1476 13.1334 20.6707 15.1279 19.6023 16.815L20.9973 21L16.8123 19.605C15.3727 20.5187 13.7024 21.0026 11.9973 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
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
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
								<path d="M11.9973 21C10.0004 20.9997 8.06029 20.3353 6.48243 19.1114C4.90457 17.8874 3.77857 16.1735 3.2817 14.2394C2.78483 12.3053 2.94531 10.2608 3.73787 8.42795C4.53044 6.59506 5.91008 5.0778 7.65959 4.11506C9.40909 3.15231 11.4291 2.79875 13.4016 3.11004C15.3741 3.42132 17.1871 4.37978 18.5551 5.83452C19.9231 7.28925 20.7684 9.15764 20.958 11.1455C21.1476 13.1334 20.6707 15.1279 19.6023 16.815L20.9973 21L16.8123 19.605C15.3727 20.5187 13.7024 21.0026 11.9973 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
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

