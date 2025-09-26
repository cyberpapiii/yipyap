// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
	namespace App {
		interface Error {
			message: string
			code?: string
			status?: number
		}
		interface Locals {
			supabase: SupabaseClient
			getAnonymousUser(): Promise<any | null>
			getDeviceId(): string
		}
		interface PageData {
			supabase: SupabaseClient
			anonymousUser?: any | null
		}
		interface PageState {
			// Navigation state
			selectedTab?: 'hot' | 'new' | 'compose'
			// Modal states
			showComposeModal?: boolean
			showThreadModal?: boolean
			// Form states
			composeContent?: string
			replyTo?: {
				type: 'post' | 'comment'
				id: string
				content: string
			}
		}
		// interface Platform {}
	}
}

export {};
