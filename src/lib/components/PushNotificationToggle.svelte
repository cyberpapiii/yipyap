<script lang="ts">
	import { onMount } from 'svelte'
	import type { SupabaseClient } from '@supabase/supabase-js'
	import {
		subscribeToPushNotifications,
		unsubscribeFromPushNotifications,
		getPushSubscriptionStatus,
		type PushNotificationStatus
	} from '$lib/services/pushNotifications'

	let {
		supabase,
		userId,
		deviceId
	}: {
		supabase: SupabaseClient
		userId: string | undefined
		deviceId: string
	} = $props()

	let status = $state<PushNotificationStatus>({
		supported: false,
		permission: 'default',
		subscribed: false,
		isIOSPWA: false,
		canSubscribe: false,
		serviceWorkerActive: false
	})

	let loading = $state(false)
	let error = $state<string | null>(null)

	onMount(async () => {
		await checkStatus()
	})

	async function checkStatus() {
		status = await getPushSubscriptionStatus()
		console.log('[PushNotificationToggle] Status:', status)
	}

	async function handleToggle() {
		if (!userId) {
			error = 'User not authenticated'
			return
		}

		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}

		loading = true
		error = null

		try {
			if (status.subscribed) {
				// Unsubscribe
				const result = await unsubscribeFromPushNotifications(supabase, userId, deviceId)
				if (result.success) {
					await checkStatus()
				} else {
					error = result.error || 'Failed to unsubscribe'
				}
			} else {
				// Subscribe
				const result = await subscribeToPushNotifications(supabase, userId, deviceId)
				if (result.success) {
					await checkStatus()
					// Success haptic
					if ('vibrate' in navigator) {
						navigator.vibrate([10, 50, 10])
					}
				} else {
					error = result.error || 'Failed to subscribe'
					// Error haptic
					if ('vibrate' in navigator) {
						navigator.vibrate([10, 30, 10, 30, 10])
					}
				}
			}
		} catch (err) {
			console.error('[PushNotificationToggle] Error:', err)
			error = err instanceof Error ? err.message : 'An error occurred'
		} finally {
			loading = false
		}
	}

	function getStatusText(): string {
		if (!status.supported) {
			return 'Not Supported'
		}
		if (status.permission === 'denied') {
			return 'Permission Denied'
		}
		if (!status.serviceWorkerActive) {
			return 'Service Worker Inactive'
		}
		if (status.subscribed) {
			return 'Enabled'
		}
		return 'Disabled'
	}

	function getStatusColor(): string {
		if (!status.supported || status.permission === 'denied' || !status.serviceWorkerActive) {
			return '#6B6B6B' // Muted gray
		}
		if (status.subscribed) {
			return '#00933C' // MTA green (4 train)
		}
		return '#6B6B6B'
	}

	function canToggle(): boolean {
		return status.supported && status.serviceWorkerActive && status.permission !== 'denied' && !loading
	}
</script>

<div
	class="w-full p-4 rounded-2xl"
	style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.1);"
>
	<div class="flex items-center justify-between gap-4">
		<!-- Icon and text -->
		<div class="flex items-center gap-3 flex-1">
			<div
				class="w-10 h-10 rounded-full flex items-center justify-center"
				style="background-color: rgba(107, 107, 107, 0.2);"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
					<path d="M19.1493 8.70031V9.47474C19.1493 10.4043 19.4133 11.3129 19.9105 12.0862L21.1294 13.9816C22.2415 15.7131 21.3923 18.0661 19.4573 18.6128C14.4012 20.0447 9.04682 20.0447 3.9907 18.6128C2.05572 18.0661 1.20649 15.7131 2.31864 13.9816L3.53749 12.0862C4.03604 11.3065 4.3006 10.4002 4.29982 9.47474V8.70031C4.29982 4.44754 7.62415 1 11.724 1C15.8239 1 19.1493 4.44754 19.1493 8.70031Z" fill="currentColor" opacity="0.7"/>
					<path d="M6.49103 19.2002C6.85047 20.3048 7.55024 21.2673 8.49013 21.9498C9.43002 22.6324 10.5618 23 11.7234 23C12.885 23 14.0168 22.6324 14.9566 21.9498C15.8965 21.2673 16.5963 20.3048 16.9558 19.2002C13.4961 19.8493 9.95177 19.8493 6.49103 19.2002Z" fill="currentColor"/>
				</svg>
			</div>
			<div class="flex-1">
				<div class="font-medium text-base">Push Notifications</div>
				<div class="text-sm mt-0.5" style="color: {getStatusColor()};">
					{getStatusText()}
				</div>
			</div>
		</div>

		<!-- Toggle button -->
		<button
			onclick={handleToggle}
			disabled={!canToggle()}
			class="relative flex-shrink-0 transition-all hover:scale-105 active:scale-95"
			style="width: 52px; height: 32px; border-radius: 16px; {canToggle() ? '' : 'opacity: 0.5; cursor: not-allowed;'}"
			aria-label="Toggle push notifications"
		>
			<!-- Background -->
			<div
				class="absolute inset-0 rounded-full transition-colors duration-200"
				style="background-color: {status.subscribed && canToggle() ? '#00933C' : 'rgba(107, 107, 107, 0.3)'};"
			></div>

			<!-- Knob -->
			<div
				class="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-lg"
				style="transform: translateX({status.subscribed && canToggle() ? '20px' : '0'});"
			>
				{#if loading}
					<div class="absolute inset-0 flex items-center justify-center">
						<svg
							class="animate-spin"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
						>
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				{/if}
			</div>
		</button>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			<p class="text-sm" style="color: #FF6B6B;">{error}</p>
		</div>
	{/if}

	<!-- Debug info and help text -->
	{#if !status.supported || !status.serviceWorkerActive || (!canToggle() && status.permission !== 'denied')}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			{#if !status.supported}
				<p class="text-xs" style="color: #6B6B6B;">
					{#if !('serviceWorker' in navigator)}
						Your browser does not support push notifications.
					{:else if !status.isIOSPWA && /iPad|iPhone|iPod/.test(navigator.userAgent)}
						On iOS, add YipYap to your Home Screen to enable push notifications.
					{:else}
						Push notifications are not supported on this device.
					{/if}
				</p>
			{:else if !status.serviceWorkerActive}
				<p class="text-xs" style="color: #FF6B6B;">
					Service Worker not active. Try refreshing the page.
				</p>
			{:else if !canToggle() && status.permission !== 'denied'}
				<p class="text-xs" style="color: #6B6B6B;">
					Loading... Please wait.
				</p>
			{/if}
		</div>
	{/if}
</div>
