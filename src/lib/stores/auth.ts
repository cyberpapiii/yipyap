import { writable } from 'svelte/store'
import type { AnonymousUser } from '$lib/types'

// Anonymous user store
export const anonymousUser = writable<AnonymousUser | null>(null)

// Alias for compatibility
export const currentUser = anonymousUser

// Device ID store
export const deviceId = writable<string>('')

// Auth loading state
export const authLoading = writable<boolean>(true)

// Auth functions
export const authStore = {
	// Set the anonymous user
	setUser: (user: AnonymousUser | null) => {
		anonymousUser.set(user)
		authLoading.set(false)
	},

	// Set device ID
	setDeviceId: (id: string) => {
		deviceId.set(id)
	},

	// Clear auth state
	clear: () => {
		anonymousUser.set(null)
		deviceId.set('')
		authLoading.set(false)
	},

	// Check if user is authenticated (has anonymous identity)
	isAuthenticated: () => {
		let user: AnonymousUser | null = null
		anonymousUser.subscribe(u => user = u)()
		return user !== null
	}
}