<script lang="ts">
	import { Clock, MoreHorizontal } from 'lucide-svelte'
	import VoteButtons from './VoteButtons.svelte'
	import AnonymousAvatar from '../community/AnonymousAvatar.svelte'
	import type { PostCardProps } from '$lib/types'
	import { formatDistanceToNow } from '$lib/utils/date'
import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import { currentUser } from '$lib/stores/auth'
	import { hapticsStore } from '$lib/stores/haptics'

	// Admin user ID
	const ADMIN_USER_ID = '784e1453-e77f-491c-ad61-d76c3f1d0f2d'
	const isAdmin = $derived($currentUser?.id === ADMIN_USER_ID)

	// Enhanced interaction state
	let cardElement: HTMLElement
	let isPressed = $state(false)
	let isHovered = $state(false)
	let rippleElements: HTMLElement[] = []
	let showOptionsMenu = $state(false)
	let isExpanded = $state(false)
	let hasPrefetchedThread = $state(false)

	let {
		post,
		showReplies = true,
		isInThread = false,
		onVote,
		onReply,
		onDelete
	}: PostCardProps = $props()

	// Truncation logic
	const TRUNCATE_LENGTH = 280
	const shouldTruncate = $derived(post.content.length > TRUNCATE_LENGTH && !isInThread && !isExpanded)
	const displayContent = $derived(shouldTruncate ? post.content.slice(0, TRUNCATE_LENGTH) + '...' : post.content)

	// Enhanced navigation with haptic feedback
	function openThread() {
		if (!isInThread) {
			// Haptic feedback for navigation
			hapticsStore.trigger('navigation')
			goto(`/thread/${post.id}`)
		}
	}

	async function prefetchThread() {
		if (hasPrefetchedThread) return
		hasPrefetchedThread = true
		try {
			const navigation = await import('$app/navigation') as { prefetch?: (url: string) => Promise<void> }
			await navigation.prefetch?.(`/thread/${post.id}`)
		} catch {
			hasPrefetchedThread = false
		}
	}

	// Handle reply with feedback
	function handleReply(e: Event) {
		e.stopPropagation()
		// Haptic feedback for reply
		hapticsStore.trigger('selection')
		onReply?.(post)
	}

	// Handle vote
	async function handleVote(voteType: 'up' | 'down' | null) {
		await onVote?.(post.id, voteType)
	}

	// Handle delete
	async function handleDelete(e: Event) {
		e.stopPropagation() // Prevent navigation to thread
		e.preventDefault()

		// Delete action haptic
		hapticsStore.trigger('delete')

		try {
			await onDelete?.(post.id)
		} catch (error) {
			console.error('Delete error:', error)
		}

		showOptionsMenu = false
	}

	// Toggle options menu
	function toggleOptionsMenu(e: Event) {
		e.stopPropagation()
		showOptionsMenu = !showOptionsMenu
		hapticsStore.trigger(showOptionsMenu ? 'menu-open' : 'menu-close')
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

	// No longer needed - using plain text with CSS whitespace handling
	// const formattedContent = () => post.content.replace(/\n/g, '<br>')

	// Touch and mouse event handlers
	function handleTouchStart(e: TouchEvent) {
		isPressed = true
		void prefetchThread()
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
		void prefetchThread()
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
	style="content-visibility: auto; contain-intrinsic-size: 320px;"
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
	aria-label={`Post by ${post.anonymous_user.subway_line} line anonymous user. ${post.content.slice(0, 100)}${post.content.length > 100 ? '...' : ''}. Posted ${timeAgo()}. ${post.comment_count} ${post.comment_count === 1 ? 'reply' : 'replies'}.`}
	aria-pressed={!isInThread ? isPressed : undefined}
>
	<div class="flex gap-3 items-start">
		<!-- Avatar -->
		<div class="flex-shrink-0">
			<AnonymousAvatar user={post.anonymous_user} size="md" />
		</div>

		<!-- Post content -->
		<div class="flex-1 min-w-0">
			<!-- Header -->
			<div class="flex items-start gap-2 -mb-2">
				<div class="flex items-center gap-1 text-xs" style="color: #6B6B6B;">
					<Clock size={12} />
				<time datetime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
					{timeAgo()}
				</time>
				</div>
				{#if post.is_user_post}
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
						aria-label="More options for this post"
						type="button"
					>
						<MoreHorizontal size={16} />
					</button>

					<!-- Options dropdown menu - Page elements layer: z-1-99 -->
					{#if showOptionsMenu}
						<div
							class="
								absolute top-full right-0 mt-1 min-w-32
								bg-card border border-border rounded-xl shadow-lg
								py-1 z-20 animate-fade-in
							"
							role="menu"
						>
							{#if (post.is_user_post || isAdmin) && onDelete}
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

			<!-- Content (secure plain text with preserved line breaks) -->
			<div class="prose prose-sm max-w-none text-foreground mb-3 selectable leading-relaxed whitespace-pre-line break-words overflow-wrap-anywhere">
				{displayContent}
			</div>

			<!-- See more button -->
			{#if shouldTruncate}
				<button
					onclick={(e) => { e.stopPropagation(); isExpanded = true }}
					class="text-sm text-accent hover:text-accent/80 font-medium transition-colors"
					type="button"
				>
					See more
				</button>
			{/if}

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
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

