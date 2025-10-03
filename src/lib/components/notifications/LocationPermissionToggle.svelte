<script lang="ts">
	import { onMount } from 'svelte'
	import { MapPin } from 'lucide-svelte'
	import { communityStore } from '$lib/stores/community'
	import type { LocationPermission } from '$lib/services/geolocation'

	let locationPermission = $state<LocationPermission | null>(null)
	let isCheckingLocation = $state(false)
	let error = $state<string | null>(null)

	onMount(async () => {
		// Subscribe to community store for permission status
		communityStore.subscribe(state => {
			locationPermission = state.locationPermission
			isCheckingLocation = state.isCheckingLocation
		})

		// Check current status on mount if not already known
		if (!locationPermission) {
			await communityStore.checkLocation()
		}
	})

	async function handleToggle() {
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}

		error = null

		try {
			if (locationPermission === 'granted') {
				// Show info about how to disable in browser settings
				error = 'To disable location access, change your browser settings.'
			} else {
				// Try to request location permission
				await communityStore.retryLocation()
				const state = $communityStore

				if (state.locationPermission === 'granted') {
					// Success haptic
					if ('vibrate' in navigator) {
						navigator.vibrate([10, 50, 10])
					}
				} else if (state.locationPermission === 'denied') {
					error = 'Location permission denied. Please enable it in your browser settings.'
					// Error haptic
					if ('vibrate' in navigator) {
						navigator.vibrate([10, 30, 10, 30, 10])
					}
				}
			}
		} catch (err) {
			console.error('[LocationPermissionToggle] Error:', err)
			error = err instanceof Error ? err.message : 'Failed to check location'
			// Error haptic
			if ('vibrate' in navigator) {
				navigator.vibrate([10, 30, 10, 30, 10])
			}
		}
	}

	function getStatusText(): string {
		if (!locationPermission) {
			return 'Checking...'
		}
		switch (locationPermission) {
			case 'granted':
				return 'Enabled'
			case 'denied':
				return 'Permission Denied'
			case 'prompt':
				return 'Not Requested'
			case 'unsupported':
				return 'Not Supported'
			default:
				return 'Unknown'
		}
	}

	function getStatusColor(): string {
		if (!locationPermission || locationPermission === 'prompt' || locationPermission === 'denied' || locationPermission === 'unsupported') {
			return '#6B6B6B' // Muted gray
		}
		if (locationPermission === 'granted') {
			return '#00933C' // MTA green (4 train)
		}
		return '#6B6B6B'
	}

	function canToggle(): boolean {
		return locationPermission !== 'unsupported' && !isCheckingLocation
	}

	function isEnabled(): boolean {
		return locationPermission === 'granted'
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
				<MapPin size={20} class="opacity-70" />
			</div>
			<div class="flex-1">
				<div class="font-medium text-base">Location Access</div>
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
			aria-label="Toggle location access"
		>
			<!-- Background -->
			<div
				class="absolute inset-0 rounded-full transition-colors duration-200"
				style="background-color: {isEnabled() && canToggle() ? '#00933C' : 'rgba(107, 107, 107, 0.3)'};"
			></div>

			<!-- Knob -->
			<div
				class="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-lg"
				style="transform: translateX({isEnabled() && canToggle() ? '20px' : '0'});"
			>
				{#if isCheckingLocation}
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

	<!-- Help text -->
	{#if locationPermission === 'unsupported'}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			<p class="text-xs" style="color: #6B6B6B;">
				Your browser does not support location services.
			</p>
		</div>
	{:else if locationPermission === 'denied'}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			<p class="text-xs" style="color: #6B6B6B;">
				To enable location access, update your browser settings and tap the toggle again.
			</p>
		</div>
	{:else if locationPermission === 'prompt' || !locationPermission}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			<p class="text-xs" style="color: #6B6B6B;">
				Required to post in location-restricted communities like Dimes Square.
			</p>
		</div>
	{/if}
</div>
