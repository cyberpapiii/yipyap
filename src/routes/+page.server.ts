import type { PageServerLoad } from './$types'
import { PostsAPI } from '$lib/api/posts'
import { supabase } from '$lib/supabase'
import type { FeedType, CommunityType } from '$lib/types'

const DEFAULT_FEED: FeedType = 'hot'
const DEFAULT_COMMUNITY: CommunityType = 'nyc'
const PAGE_SIZE = 20

export const load: PageServerLoad = async () => {
	try {
		const api = new PostsAPI(supabase as any)
		const response = await api.getFeedPosts(
			DEFAULT_FEED,
			undefined,
			PAGE_SIZE,
			undefined,
			DEFAULT_COMMUNITY
		)

		return {
			initialFeed: {
				feedType: DEFAULT_FEED,
				community: DEFAULT_COMMUNITY,
				posts: response.data,
				hasMore: response.hasMore,
				cursor: response.nextCursor ?? null,
				timestamp: Date.now()
			}
		}
	} catch (error) {
		// If SSR fetch fails, continue without blocking hydration
		console.error('SSR feed load failed:', error)
		return {
			initialFeed: null
		}
	}
}
