import { createClient } from '@supabase/supabase-js'
import { config } from '$lib/config'
import type { Database } from '$lib/types'

const { url, anonKey } = config.supabase

if (!url || !anonKey) {
	throw new Error('Supabase URL or anon key is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your environment.')
}

export const supabase = createClient<Database>(url, anonKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
})
