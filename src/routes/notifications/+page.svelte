<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { get } from 'svelte/store'
	import { currentUser, authStore } from '$lib/stores/auth'
	import { supabase } from '$lib/supabase'
	import { notificationsStore } from '$lib/stores/notifications'
	import { getDeviceId } from '$lib/auth'
	import AnonymousAvatar from '$lib/components/community/AnonymousAvatar.svelte'
	import SubwayLinePicker from '$lib/components/community/SubwayLinePicker.svelte'
	import PushNotificationToggle from '$lib/components/notifications/PushNotificationToggle.svelte'
	import NotificationCard from '$lib/components/notifications/NotificationCard.svelte'
	import { RefreshCw, ChevronDown } from 'lucide-svelte'

	let user = $state(get(currentUser))
	let deviceId = $state('')
	let showLinePicker = $state(false)
	let isUpdating = $state(false)
	let refreshing = $state(false)
	let pullToRefreshY = $state(0)
	let isPulling = $state(false)
	let startY = 0
	let currentY = 0
	let feedOpacity = $state(1)

	const PULL_THRESHOLD = 80
	const MAX_PULL = 120
	const SCROLL_TOP_THRESHOLD = 5

	// Subway line to color mapping
	const subwayLineColors: Record<string, string> = {
		'1': 'mta-red', '2': 'mta-red', '3': 'mta-red',
		'4': 'mta-dark-green', '5': 'mta-dark-green', '6': 'mta-dark-green',
		'7': 'mta-purple',
		'A': 'mta-blue', 'C': 'mta-blue', 'E': 'mta-blue',
		'B': 'mta-orange', 'D': 'mta-orange', 'F': 'mta-orange', 'M': 'mta-orange',
		'N': 'mta-yellow', 'Q': 'mta-yellow', 'R': 'mta-yellow', 'W': 'mta-yellow',
		'G': 'mta-light-green',
		'J': 'mta-brown', 'Z': 'mta-brown',
		'L': 'mta-grey'
	}

	onMount(async () => {
		// Get device ID
		deviceId = getDeviceId()

		// Initialize notifications store
		notificationsStore.initialize(supabase)

		// Subscribe to current user updates
		const unsubscribe = currentUser.subscribe(value => {
			user = value
		})

		// Fetch initial notifications
		if (user) {
			await notificationsStore.fetchNotifications(0, 20, false)
			await notificationsStore.fetchUnreadCount()
			notificationsStore.subscribeToRealtime()
		}

		// Add touch event listeners with passive: false
		document.addEventListener('touchstart', handleTouchStart, { passive: true })
		document.addEventListener('touchmove', handleTouchMove, { passive: false })
		document.addEventListener('touchend', handleTouchEnd, { passive: true })

		return () => {
			unsubscribe()
			notificationsStore.unsubscribeFromRealtime()
			document.removeEventListener('touchstart', handleTouchStart)
			document.removeEventListener('touchmove', handleTouchMove)
			document.removeEventListener('touchend', handleTouchEnd)
		}
	})

	onDestroy(() => {
		notificationsStore.unsubscribeFromRealtime()
	})

	function openLinePicker() {
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		showLinePicker = true
	}

	function closeLinePicker() {
		showLinePicker = false
	}

	async function handleLineChange(newLine: string) {
		if (!user || isUpdating) return

		isUpdating = true
		closeLinePicker()

		try {
			// Call RPC to update subway line
			const { data, error } = await supabase.rpc('rpc_update_subway_line', {
				p_user: user.id,
				p_subway_line: newLine
			})

			if (error) throw error

			// Update local user state
			const updatedUser = {
				...user,
				subway_line: newLine as typeof user.subway_line,
				subway_color: subwayLineColors[newLine] as typeof user.subway_color
			}

			authStore.setUser(updatedUser)
		} catch (error) {
			console.error('Failed to update subway line:', error)
		} finally {
			isUpdating = false
		}
	}

	async function handleNotificationClick(notificationId: string) {
		await notificationsStore.markAsRead(notificationId)
	}

	async function handleMarkAllAsRead() {
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}
		await notificationsStore.markAllAsRead()
	}

	async function handleLoadMore() {
		const currentCount = $notificationsStore.notifications.length
		await notificationsStore.fetchNotifications(currentCount, 20, false)
	}

	async function refreshNotifications() {
		if (refreshing || !user) return

		refreshing = true
		feedOpacity = 0.5
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}

		try {
			await notificationsStore.fetchNotifications(0, 20, false)
			await notificationsStore.fetchUnreadCount()
			if ('vibrate' in navigator) {
				navigator.vibrate(10)
			}
		} finally {
			feedOpacity = 1
			refreshing = false
			pullToRefreshY = 0
			isPulling = false
		}
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return
		startY = e.touches[0].clientY
		currentY = startY
		const scrollTop = window.scrollY || document.documentElement.scrollTop
		isPulling = scrollTop <= SCROLL_TOP_THRESHOLD
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length !== 1) return
		currentY = e.touches[0].clientY
		const deltaY = currentY - startY
		const scrollTop = window.scrollY || document.documentElement.scrollTop

		if (!isPulling && deltaY > 0 && scrollTop <= SCROLL_TOP_THRESHOLD) {
			isPulling = true
			startY = currentY
			pullToRefreshY = 0
			return
		}

		if (isPulling && scrollTop <= SCROLL_TOP_THRESHOLD && deltaY > 0) {
			e.preventDefault()
			pullToRefreshY = Math.min(deltaY * 0.5, MAX_PULL)
		} else {
			isPulling = false
			pullToRefreshY = 0
		}
	}

	function handleTouchEnd() {
		if (!isPulling) return
		isPulling = false

		if (pullToRefreshY >= PULL_THRESHOLD) {
			refreshNotifications()
		} else {
			pullToRefreshY = 0
		}
	}
</script>

<div
	class="min-h-screen bg-background pb-24"
	style="padding-bottom: calc(env(safe-area-inset-bottom) + 6rem); transform: translateY({pullToRefreshY * 0.3}px); transition: {!isPulling ? 'transform 0.3s ease-out' : ''}"
>
	<!-- Pull to refresh indicator - Page elements layer: z-1-99 -->
	{#if pullToRefreshY > 0}
		<div
			class="absolute top-0 left-0 right-0 z-30 flex items-center justify-center backdrop-blur-sm"
			style="height: 80px; background: linear-gradient(to bottom, rgba(16, 16, 16, 0.95) 0%, rgba(16, 16, 16, 0.8) 50%, transparent 100%); transform: translateY(-{80 - pullToRefreshY}px); transition: {!isPulling ? 'transform 0.3s ease-out' : ''}; border-bottom: 2px solid #6B6B6B"
		>
			<div class="flex items-center gap-2 text-accent">
				{#if pullToRefreshY >= PULL_THRESHOLD}
					<RefreshCw
						size={20}
						class={refreshing ? 'animate-spin' : ''}
					/>
					<span class="text-sm font-medium">
						{refreshing ? 'Refreshing...' : 'Release to refresh'}
					</span>
				{:else}
					<ChevronDown
						size={20}
						class="transition-transform duration-200"
						style="transform: rotate({Math.min(pullToRefreshY / PULL_THRESHOLD * 180, 180)}deg)"
					/>
					<span class="text-sm font-medium">Pull to refresh</span>
				{/if}
			</div>
		</div>
	{/if}

	<div class="max-w-md mx-auto">
		<!-- Profile Section -->
		{#if user}
			<div class="p-4 mb-2" style="border-bottom: 1px solid rgba(107, 107, 107, 0.1);">
				<h1 class="text-3xl font-bold mb-4">Profile</h1>

				<!-- Profile Card -->
				<button
					onclick={openLinePicker}
					class="w-full p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mb-3"
					style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.1);"
				>
					<div class="flex items-center gap-4">
						<AnonymousAvatar user={user} size="lg" />
						<div class="flex-1 text-left">
							<div class="flex items-center gap-2 mb-1">
								<span class="text-lg font-semibold">{user.subway_line} Line</span>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-muted-foreground">
									<path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</div>
							<p class="text-sm text-muted-foreground">Tap to change your line</p>
						</div>
						<div class="text-right">
							<div class="text-2xl font-bold">{user.total_karma || 0}</div>
							<div class="text-xs text-muted-foreground">karma</div>
						</div>
					</div>
				</button>

				<!-- Push Notification Toggle -->
				<PushNotificationToggle
					{supabase}
					userId={user.id}
					{deviceId}
				/>
			</div>
		{/if}

		<!-- Notifications Section -->
		<div class="p-4" style="opacity: {feedOpacity}; transition: opacity 0.3s ease-out;">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-3xl font-bold">Notifications</h2>
				{#if $notificationsStore.unreadCount > 0}
					<button
						onclick={handleMarkAllAsRead}
						class="text-sm transition-colors hover:text-white"
						style="color: #6B6B6B;"
					>
						Mark all as read
					</button>
				{/if}
			</div>

			<!-- Loading skeleton -->
			{#if $notificationsStore.loading && $notificationsStore.notifications.length === 0}
				<div class="space-y-3">
					{#each Array(4) as _, i}
						<div
							class="skeleton-card"
							style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.1); border-radius: 12px; padding: 16px;"
						>
							<div class="flex gap-3">
								<div class="skeleton-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #2A2A2A;"></div>
								<div class="flex-1">
									<div class="skeleton-line" style="width: 70%; height: 14px; background-color: #2A2A2A; border-radius: 4px; margin-bottom: 8px;"></div>
									<div class="skeleton-line" style="width: 90%; height: 12px; background-color: #252525; border-radius: 4px;"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			<!-- Empty state -->
			{:else if $notificationsStore.notifications.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="mx-auto mb-3 opacity-50">
						<path d="M19.1493 8.70031V9.47474C19.1493 10.4043 19.4133 11.3129 19.9105 12.0862L21.1294 13.9816C22.2415 15.7131 21.3923 18.0661 19.4573 18.6128C14.4012 20.0447 9.04682 20.0447 3.9907 18.6128C2.05572 18.0661 1.20649 15.7131 2.31864 13.9816L3.53749 12.0862C4.03604 11.3065 4.3006 10.4002 4.29982 9.47474V8.70031C4.29982 4.44754 7.62415 1 11.724 1C15.8239 1 19.1493 4.44754 19.1493 8.70031Z" fill="currentColor"/>
						<path d="M6.49103 19.2002C6.85047 20.3048 7.55024 21.2673 8.49013 21.9498C9.43002 22.6324 10.5618 23 11.7234 23C12.885 23 14.0168 22.6324 14.9566 21.9498C15.8965 21.2673 16.5963 20.3048 16.9558 19.2002C13.4961 19.8493 9.95177 19.8493 6.49103 19.2002Z" fill="currentColor"/>
					</svg>
					<p>No notifications yet</p>
				</div>
			<!-- Notification list -->
			{:else}
				<div class="space-y-3">
					{#each $notificationsStore.notifications as notification (notification.id)}
						<NotificationCard {notification} onclick={() => handleNotificationClick(notification.id)} />
					{/each}
				</div>

				<!-- Load more -->
				{#if $notificationsStore.hasMore}
					<div class="mt-4 text-center">
						<button
							onclick={handleLoadMore}
							disabled={$notificationsStore.loading}
							class="px-4 py-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
							style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.1); color: #FFFFFF;"
						>
							{$notificationsStore.loading ? 'Loading...' : 'Load more'}
						</button>
					</div>
				{/if}
			{/if}

			<!-- Error message -->
			{#if $notificationsStore.error}
				<div class="mt-4 p-4 rounded-lg" style="background-color: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3);">
					<p style="color: #FF6B6B;">{$notificationsStore.error}</p>
				</div>
			{/if}
		</div>
	</div>
</div>

{#if showLinePicker}
	<SubwayLinePicker
		currentLine={user?.subway_line}
		onSelect={handleLineChange}
		onClose={closeLinePicker}
	/>
{/if}
