<script lang="ts">
	import type { Notification } from '$lib/types'
	import AnonymousAvatar from './AnonymousAvatar.svelte'
	import { formatDistanceToNow } from '$lib/utils/date'
	import { goto } from '$app/navigation'

	let {
		notification,
		onclick
	}: {
		notification: Notification
		onclick?: () => void
	} = $props()

	// Determine if notification is unread
	const isUnread = $derived(!notification.read)

	// Determine background color based on read status
	const bgColor = $derived(isUnread ? '#1E1E1E' : '#181818')

	// Format the timestamp
	const timestamp = $derived(formatDistanceToNow(new Date(notification.created_at)))

	// Generate notification text based on type
	const actionText = $derived(() => {
		switch (notification.type) {
			case 'reply_to_post':
				return `${notification.actor_subway_line} Line replied to your post`
			case 'reply_to_comment':
				return `${notification.actor_subway_line} Line replied to your comment`
			case 'milestone_5':
				return 'Your post reached 5 upvotes!'
			case 'milestone_10':
				return 'Your post reached 10 upvotes!'
			case 'milestone_25':
				return 'Your post reached 25 upvotes!'
			default:
				return 'New notification'
		}
	})

	// Get content preview
	const previewContent = $derived(() => {
		return notification.preview_content || null
	})

	// Check if this is a reply notification (not milestone)
	const isReply = $derived(notification.type === 'reply_to_post' || notification.type === 'reply_to_comment')

	// Mock user object for AnonymousAvatar (only for reply notifications)
	const actorUser = $derived(() => {
		if (!isReply || !notification.actor_subway_line || !notification.actor_subway_color) {
			return null
		}
		return {
			id: notification.actor_user_id || '',
			subway_line: notification.actor_subway_line as any,
			subway_color: notification.actor_subway_color as any,
			device_id: '',
			total_karma: 0,
			created_at: '',
			last_seen_at: ''
		}
	})

	function handleClick(e: MouseEvent) {
		// Haptic feedback
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}

		// Call provided onclick handler
		onclick?.()

		// Navigate to thread
		let url = `/thread/${notification.post_id}`
		if (notification.comment_id) {
			url += `#comment-${notification.comment_id}`
		}
		goto(url)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			handleClick(e as any)
		}
	}
</script>

<button
	class="notification-card"
	style="background-color: {bgColor};"
	onclick={handleClick}
	onkeydown={handleKeydown}
	aria-label={actionText()}
>
	<div class="notification-content">
		<!-- Left side: Avatar (only for reply notifications) -->
		{#if actorUser()}
			<div class="avatar-wrapper">
				<AnonymousAvatar user={actorUser()} size="md" />
			</div>
		{:else}
			<div class="avatar-wrapper milestone-icon">
				<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
					<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#6B6B6B"/>
				</svg>
			</div>
		{/if}

		<!-- Center: Text content -->
		<div class="text-content">
			<div class="action-text">{actionText()}</div>
			{#if previewContent()}
				<div class="preview-text">{previewContent()}</div>
			{/if}
		</div>

		<!-- Right side: Timestamp and unread indicator -->
		<div class="meta-content">
			<div class="timestamp">{timestamp}</div>
			{#if isUnread}
				<div class="unread-dot"></div>
			{/if}
		</div>
	</div>
</button>

<style>
	.notification-card {
		display: block;
		width: 100%;
		border: 1px solid rgba(107, 107, 107, 0.1);
		border-radius: 12px;
		padding: 16px;
		cursor: pointer;
		transition: all 0.2s ease-out;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.notification-card:hover {
		transform: scale(1.01);
	}

	.notification-card:active {
		transform: scale(0.98);
	}

	.notification-card:focus-visible {
		outline: 2px solid rgba(107, 107, 107, 0.5);
		outline-offset: 2px;
	}

	.notification-content {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.avatar-wrapper {
		flex-shrink: 0;
	}

	.milestone-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
	}

	.text-content {
		flex: 1;
		min-width: 0;
	}

	.action-text {
		color: #FFFFFF;
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 4px;
		line-height: 1.4;
	}

	.preview-text {
		color: #6B6B6B;
		font-size: 14px;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.meta-content {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.timestamp {
		color: #6B6B6B;
		font-size: 12px;
		white-space: nowrap;
	}

	.unread-dot {
		width: 8px;
		height: 8px;
		background-color: #FF6B6B;
		border-radius: 50%;
		border: 2px solid #101010;
	}
</style>
