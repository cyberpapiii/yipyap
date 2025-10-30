/**
 * Haptic Feedback Utility
 * Provides unified haptic feedback for iOS 18+ and Android devices
 */

import { browser } from '$app/environment'

// Haptic action types
export type HapticAction =
	| 'vote-up'
	| 'vote-down'
	| 'vote-remove'
	| 'post-success'
	| 'comment-success'
	| 'delete'
	| 'error'
	| 'navigation'
	| 'selection'
	| 'menu-open'
	| 'menu-close'

// Haptic pattern definitions (duration in ms or array of [vibrate, pause, vibrate])
const HAPTIC_PATTERNS: Record<HapticAction, number | number[]> = {
	'vote-up': 10,
	'vote-down': 15,
	'vote-remove': 5,
	'post-success': [10, 50, 15],
	'comment-success': 20,
	delete: [8, 30, 8, 30, 8],
	error: [50, 100, 50],
	navigation: 10,
	selection: 15,
	'menu-open': 5,
	'menu-close': 10
}

// Device detection
export function isIOS(): boolean {
	if (!browser) return false
	return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

export function isAndroid(): boolean {
	if (!browser) return false
	return /Android/.test(navigator.userAgent)
}

export function supportsVibration(): boolean {
	if (!browser) return false
	return 'vibrate' in navigator
}

// iOS workaround refs (set by store initialization)
let iosHapticLabel: HTMLLabelElement | null = null

export function setIOSHapticRef(labelElement: HTMLLabelElement | null): void {
	iosHapticLabel = labelElement
}

// Debouncing to prevent haptic fatigue
let lastHapticTime = 0
const DEBOUNCE_MS = 100

/**
 * Trigger haptic feedback based on action type
 * Automatically handles iOS WebKit workaround vs Android Vibration API
 */
export function triggerHaptic(action: HapticAction): void {
	if (!browser) return

	// Debounce rapid haptic triggers
	const now = Date.now()
	if (now - lastHapticTime < DEBOUNCE_MS) {
		return
	}
	lastHapticTime = now

	const pattern = HAPTIC_PATTERNS[action]

	// iOS 18+ WebKit workaround
	if (isIOS() && iosHapticLabel) {
		// iOS doesn't support custom patterns well, so just trigger the label click
		// This gives a consistent "selection" haptic feel
		iosHapticLabel.click()
		return
	}

	// Android/Desktop with Vibration API
	if (supportsVibration()) {
		try {
			navigator.vibrate(pattern)
		} catch (error) {
			// Silently fail - haptics are a nice-to-have, not critical
			if (import.meta.env.DEV) {
				console.warn('[Haptics] Vibration failed:', error)
			}
		}
		return
	}

	// Unsupported device - gracefully do nothing
	if (import.meta.env.DEV) {
		console.log(`[Haptics] Triggered: ${action} (not supported on this device)`)
	}
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic(): void {
	if (!browser) return

	if (supportsVibration()) {
		try {
			navigator.vibrate(0)
		} catch (error) {
			// Silently fail
		}
	}
}
