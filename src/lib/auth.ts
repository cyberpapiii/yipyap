import { browser } from '$app/environment'
import type { AnonymousUser, AnonymousEmoji, AnonymousColor } from '$lib/types'
import { get } from 'svelte/store'
import { authStore, currentUser } from '$lib/stores'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous authentication utilities for YipYap
 * Handles device-based identification without traditional user accounts
 */

// Available emoji options for anonymous users
export const ANONYMOUS_EMOJIS: AnonymousEmoji[] = [
	'🎭', '🦄', '🚀', '🌟', '🔥', '💫', '🎨', '🌈', '⚡', '🎪'
]

// Available color options for anonymous users
export const ANONYMOUS_COLORS: AnonymousColor[] = [
	'purple', 'blue', 'green', 'orange', 'red'
]

// Color to CSS class mapping
export const COLOR_CLASSES = {
	purple: 'bg-anonymous-1 text-white',
	blue: 'bg-anonymous-2 text-white',
	green: 'bg-anonymous-3 text-white',
	orange: 'bg-anonymous-4 text-white',
	red: 'bg-anonymous-5 text-white'
} as const

/**
 * Generate a device fingerprint using available browser APIs
 * This creates a consistent identifier across sessions
 * Canvas fingerprint is cached to avoid expensive re-computation
 */
export function generateDeviceFingerprint(): string {
	if (!browser) return ''

	// Check for cached fingerprint first (avoids expensive canvas operation)
	const cachedFingerprint = localStorage.getItem('bingbong_fingerprint')
	if (cachedFingerprint) {
		return cachedFingerprint
	}

	const factors: string[] = []

	// Screen resolution
	factors.push(`${screen.width}x${screen.height}`)

	// Timezone
	factors.push(Intl.DateTimeFormat().resolvedOptions().timeZone)

	// Language
	factors.push(navigator.language)

	// Platform
	factors.push(navigator.platform)

	// User agent (partial, for stability)
	const ua = navigator.userAgent
	const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)
	if (browserMatch) {
		factors.push(browserMatch[0])
	}

	// Canvas fingerprint (lightweight version) - only computed once
	try {
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		if (ctx) {
			ctx.textBaseline = 'top'
			ctx.font = '14px Arial'
			ctx.fillText('YipYap', 2, 2)
			factors.push(canvas.toDataURL().slice(-50)) // Last 50 chars for brevity
		}
	} catch {
		// Ignore canvas errors
	}

	// Create hash from all factors
	const fingerprint = btoa(factors.join('|')).replace(/[/+=]/g, '').slice(0, 32)

	// Cache the fingerprint for future loads
	try {
		localStorage.setItem('bingbong_fingerprint', fingerprint)
	} catch {
		// Ignore storage errors
	}

	return fingerprint
}

/**
 * Get device ID from localStorage or generate new one
 */
export function getDeviceId(): string {
	if (!browser) return ''

	let deviceId = localStorage.getItem('bingbong_device_id')

	if (!deviceId) {
		// Try to use fingerprint as base
		const fingerprint = generateDeviceFingerprint()
		deviceId = fingerprint || crypto.randomUUID()
		localStorage.setItem('bingbong_device_id', deviceId)
	}

	return deviceId
}

/**
 * Generate random anonymous identity
 */
export function generateAnonymousIdentity(): { emoji: AnonymousEmoji; color: AnonymousColor } {
	const emoji = ANONYMOUS_EMOJIS[Math.floor(Math.random() * ANONYMOUS_EMOJIS.length)]
	const color = ANONYMOUS_COLORS[Math.floor(Math.random() * ANONYMOUS_COLORS.length)]

	return { emoji, color }
}

/**
 * Get or create anonymous user from localStorage cache
 */
export function getCachedAnonymousUser(): AnonymousUser | null {
	if (!browser) return null

	try {
		const cached = localStorage.getItem('bingbong_anonymous_user')
		if (cached) {
			const user = JSON.parse(cached) as AnonymousUser
			// Validate the cached user has required fields
			if (user.id && user.device_id && user.subway_line && user.subway_color) {
				return user
			} else {
				// Clear invalid cached user (likely from old emoji/color schema)
				localStorage.removeItem('bingbong_anonymous_user')
			}
		}
	} catch {
		// Ignore parsing errors
		localStorage.removeItem('bingbong_anonymous_user')
	}

	return null
}

/**
 * Cache anonymous user in localStorage
 */
export function cacheAnonymousUser(user: AnonymousUser): void {
	if (!browser) return

	try {
		localStorage.setItem('bingbong_anonymous_user', JSON.stringify(user))
	} catch {
		// Ignore storage errors (e.g., quota exceeded)
	}
}

/**
 * Clear cached anonymous user
 */
export function clearCachedAnonymousUser(): void {
	if (!browser) return

	localStorage.removeItem('bingbong_anonymous_user')
	localStorage.removeItem('bingbong_device_id')
	localStorage.removeItem('bingbong_fingerprint')
}

/**
 * Initialize anonymous authentication
 * This should be called on app startup
 */
export async function initializeAuth(): Promise<AnonymousUser | null> {
	if (!browser) return null

	// First check cache
	const cached = getCachedAnonymousUser()
	if (cached) {
		authStore.setUser(cached)
		return cached
	}

	// If no cache, the server will handle creation
	// The user will be available via the layout load function
	return null
}

/**
 * Refresh anonymous user from server
 */
export async function refreshAnonymousUser(supabase: SupabaseClient): Promise<AnonymousUser | null> {
	try {
		const deviceId = getDeviceId()
		if (!deviceId) return null

		const { data: user } = await supabase
			.from('anonymous_users')
			.select('*')
			.eq('device_id', deviceId)
			.single()

		if (user) {
			cacheAnonymousUser(user)
			authStore.setUser(user)
			return user
		}

		return null
	} catch (error) {
		console.error('Error refreshing anonymous user:', error)
		return null
	}
}

/**
 * Ensure an anonymous user exists for this device, creating one if needed.
 */
export async function ensureAnonymousUser(supabase: SupabaseClient): Promise<AnonymousUser | null> {
	const existing = get(currentUser)
	if (existing) {
		return existing
	}

	const device = getDeviceId()
	if (!device) {
		return null
	}

	const { data, error } = await supabase.rpc('get_or_create_user', {
		device_id_param: device
	})

	if (error) {
		console.error('Failed to ensure anonymous user', error)
		throw error
	}

	if (data) {
		const user = data as AnonymousUser
		cacheAnonymousUser(user)
		authStore.setUser(user)
		return user
	}

	return null
}

/**
 * Update anonymous user identity (emoji/color)
 */
export async function updateAnonymousIdentity(
	supabase: SupabaseClient,
	emoji?: AnonymousEmoji,
	color?: AnonymousColor
): Promise<AnonymousUser | null> {
	try {
		const deviceId = getDeviceId()
		if (!deviceId) return null

		const updates: Partial<AnonymousUser> = {}
		if (emoji) updates.emoji = emoji
		if (color) updates.color = color

		const { data: user, error } = await supabase
			.from('anonymous_users')
			.update(updates)
			.eq('device_id', deviceId)
			.select()
			.single()

		if (error) throw error

		if (user) {
			cacheAnonymousUser(user)
			authStore.setUser(user)
		}

		return user
	} catch (error) {
		console.error('Error updating anonymous identity:', error)
		return null
	}
}

/**
 * Check if user owns a post/comment
 */
export function isUserContent(contentUserId: string, currentUser: AnonymousUser | null): boolean {
	return currentUser ? contentUserId === currentUser.id : false
}

/**
 * Get display name for anonymous user
 */
export function getAnonymousDisplayName(user: AnonymousUser): string {
	// Use subway line as primary identifier
	const subwayLineNames = {
		'A': 'A Line',
		'B': 'B Line',
		'G': 'G Line',
		'J': 'J Line',
		'L': 'L Line',
		'N': 'N Line',
		'1': '1 Line',
		'4': '4 Line',
		'7': '7 Line',
		'T': 'T Line'
	}

	// Fallback to emoji if still available
	if (user.emoji && user.color) {
		const colorNames = {
			purple: 'Purple',
			blue: 'Blue',
			green: 'Green',
			orange: 'Orange',
			red: 'Red'
		}
		return `${user.emoji} ${colorNames[user.color]} Anonymous`
	}

	return `${subwayLineNames[user.subway_line]} Anonymous`
}
