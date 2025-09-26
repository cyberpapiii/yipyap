// Configuration constants for YipYap

import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

const supabaseUrl = PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn('Supabase configuration is missing. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.')
}

export const config = {
	supabase: {
		url: supabaseUrl,
		anonKey: supabaseAnonKey
	},
	app: {
		name: 'YipYap',
		description: 'Anonymous social posting platform',
		maxPostLength: 100,
		maxCommentDepth: 2,
		postsPerPage: 20,
		commentsPerPage: 50
	}
} as const
