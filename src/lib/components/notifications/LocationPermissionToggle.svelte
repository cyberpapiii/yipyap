<script lang="ts">
	import { onMount } from 'svelte'
	import { hapticsStore } from '$lib/stores/haptics'
	import { MapPin } from 'lucide-svelte'
	import { communityStore } from '$lib/stores/community'

	let error = $state<string | null>(null)

	// Derive values directly from store to avoid sync issues
	let locationPermission = $derived($communityStore.locationPermission)
	let isCheckingLocation = $derived($communityStore.isCheckingLocation)
	let locationEnabled = $derived($communityStore.locationEnabled)

	onMount(async () => {
		// Always check current status on mount to verify permission is still valid
		// and location can actually be fetched (not just that permission was granted)
		try {
			const location = await communityStore.checkLocation()
			if (!location && locationPermission === 'prompt') {
				// Permission API says 'granted' but location fetch failed
				// This can happen when permission is stale or location services are off
				error = 'Could not get location. Ensure location services are enabled.'
			}
		} catch (err) {
			console.error('[LocationPermissionToggle] Failed to check location:', err)
		}
	})

	async function handleToggle() {
		hapticsStore.trigger('selection')

		error = null

		try {
			if (locationEnabled && locationPermission === 'granted') {
				// User wants to disable - toggle app-level preference
				communityStore.setLocationEnabled(false)
				// Success haptic
				hapticsStore.trigger('post-success')
			} else if (!locationEnabled) {
				// User wants to enable - toggle app-level preference and check location
				communityStore.setLocationEnabled(true)
				await communityStore.checkLocation()
				const state = $communityStore

				if (state.locationPermission === 'granted') {
					// Success haptic
					hapticsStore.trigger('post-success')
				} else if (state.locationPermission === 'denied') {
					error = 'Location permission denied. Please enable it in your browser settings.'
					// Error haptic
					hapticsStore.trigger('error')
				}
			} else {
				// Location disabled or not yet granted - request permission
				await communityStore.retryLocation()
				const state = $communityStore

				if (state.locationPermission === 'granted') {
					// Success haptic
					hapticsStore.trigger('post-success')
				} else if (state.locationPermission === 'denied') {
					error = 'Location permission denied. Please enable it in your browser settings.'
					// Error haptic
					hapticsStore.trigger('error')
				}
			}
		} catch (err) {
			console.error('[LocationPermissionToggle] Error:', err)
			error = err instanceof Error ? err.message : 'Failed to check location'
			// Error haptic
			hapticsStore.trigger('error')
		}
	}

	function getStatusText(): string {
		// If user disabled in app, show that regardless of browser permission
		if (!locationEnabled) {
			return 'Disabled'
		}

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
		// If disabled in app, show gray
		if (!locationEnabled) {
			return '#6B6B6B'
		}

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
		return locationEnabled && locationPermission === 'granted'
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
	{#if !locationEnabled}
		<div class="mt-3 pt-3" style="border-top: 1px solid rgba(107, 107, 107, 0.1);">
			<p class="text-xs" style="color: #6B6B6B;">
				Location is disabled. You won't be able to post in NYC or location-restricted communities.
			</p>
		</div>
	{:else if locationPermission === 'unsupported'}
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
				Required to post in NYC and other location-restricted communities.
			</p>
		</div>
	{/if}
</div>
