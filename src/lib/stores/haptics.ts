/**
 * Haptics Store
 * Manages haptic feedback system initialization and provides trigger API
 */

import { writable } from 'svelte/store'
import { setIOSHapticRef, triggerHaptic as triggerHapticUtil, type HapticAction } from '$lib/utils/haptics'

// Store state
export const hapticSupported = writable<boolean>(false)
export const hapticInitialized = writable<boolean>(false)

/**
 * Initialize haptic system
 * Must be called from +layout.svelte after iOS elements are mounted
 */
export function initializeHaptics(labelElement: HTMLLabelElement | null): void {
	// Set iOS workaround reference
	setIOSHapticRef(labelElement)

	// Mark as initialized
	hapticInitialized.set(true)

	// Check if device supports haptics
	const supported = 'vibrate' in navigator || labelElement !== null
	hapticSupported.set(supported)
}

/**
 * Trigger haptic feedback for a specific action
 * This is the main API that components should use
 * @param action - The haptic action to trigger
 * @param bypassDebounce - Set to true for gesture-based haptics (swipes) to bypass debounce timer
 */
export function triggerHaptic(action: HapticAction, bypassDebounce = false): void {
	triggerHapticUtil(action, bypassDebounce)
}

// Export the store API
export const hapticsStore = {
	initialize: initializeHaptics,
	trigger: triggerHaptic
}
