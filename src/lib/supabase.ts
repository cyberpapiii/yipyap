import { createClient } from '@supabase/supabase-js'
import { config } from '$lib/config'

const { url, anonKey } = config.supabase

if (!url || !anonKey) {
	throw new Error('Supabase URL or anon key is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your environment.')
}

export const supabase = createClient(url, anonKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
})
