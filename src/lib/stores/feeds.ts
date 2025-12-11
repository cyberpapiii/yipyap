import { writable } from 'svelte/store'
import type { PostWithStats, FeedState, FeedType, CommunityType } from '$lib/types'

// Create feed store
function createFeedStore() {
	const { subscribe, set, update } = writable<FeedState>({
		posts: [],
		loading: false,
		error: null,
		hasMore: true,
		cursor: null,
		community: 'nyc'
	})

	return {
		subscribe,
		// Set loading state
		setLoading: (loading: boolean) => update(state => ({ ...state, loading })),

		// Set error state
		setError: (error: string | null) => update(state => ({ ...state, error, loading: false })),

		// Set posts (replace all)
		setPosts: (posts: PostWithStats[]) => update(state => {
			const beforeFirst = state.posts[0]
			const afterFirst = posts[0]

			return {
				...state,
				posts,
				loading: false,
				error: null
			}
		}),

		// Add posts (append)
		addPosts: (newPosts: PostWithStats[], hasMore: boolean, cursor: string | null) =>
			update(state => ({
				...state,
				posts: [...state.posts, ...newPosts],
				hasMore,
				cursor,
				loading: false,
				error: null
			})),

		// Add single post to top
		addPost: (post: PostWithStats) => update(state => ({
			...state,
			posts: [post, ...state.posts]
		})),

		// Update a specific post (supports _scoreDelta for incremental score updates)
		updatePost: (postId: string, updates: Partial<PostWithStats> & { _scoreDelta?: number }) =>
			update(state => ({
				...state,
				posts: state.posts.map(post => {
					if (post.id !== postId) return post

					const before = { score: post.vote_score, vote: post.user_vote }

					// Handle incremental score delta from realtime vote events
					if (updates._scoreDelta !== undefined) {
						const { _scoreDelta, ...restUpdates } = updates
						const next = {
							...post,
							...restUpdates,
							vote_score: post.vote_score + _scoreDelta
						}

						return next
					}

					const next = { ...post, ...updates }

					// Standard update (absolute values)
					return next
				})
			})),

		// Remove a post
		removePost: (postId: string) => update(state => ({
			...state,
			posts: state.posts.filter(post => post.id !== postId)
		})),

		// Replace a post with new data while preserving position
			replacePost: (postId: string, newPost: PostWithStats) => update(state => {
			// Check if the new post already exists (race condition with realtime)
			const newPostExists = state.posts.some(p => p.id === newPost.id)

			if (newPostExists) {
				// New post already added by realtime, just remove the old one
				return {
					...state,
					posts: state.posts.filter(post => post.id !== postId)
				}
			}

			// Replace the old post with the new one
			let replaced = false
			const posts = state.posts.map(post => {
				if (post.id === postId) {
					replaced = true
					return newPost
				}
				return post
			})

			if (!replaced) {
				// Old post not found, add new post to top
				return {
					...state,
					posts: [newPost, ...state.posts]
				}
			}

			return {
				...state,
				posts
				}
			}),

		// Set community filter (clears posts)
		setCommunity: (community: CommunityType) => update(state => ({
			posts: [],
			loading: false,
			error: null,
			hasMore: true,
			cursor: null,
			community
		})),

		// Clear all posts
		clear: () => update(state => ({
			posts: [],
			loading: false,
			error: null,
			hasMore: true,
			cursor: null,
			community: state.community
		}))
	}
}

export type FeedStore = ReturnType<typeof createFeedStore>

// Feed stores for different feed types
export const hotFeed = createFeedStore()
export const newFeed = createFeedStore()

// Current active feed type
export const activeFeedType = writable<FeedType>('hot')

// Feed utilities
export const feedUtils = {
	// Get the appropriate feed store
	getFeedStore: (feedType: FeedType) => {
		return feedType === 'hot' ? hotFeed : newFeed
	},

	// Switch active feed
	switchFeed: (feedType: FeedType) => {
		activeFeedType.set(feedType)
	},

	// Update post in all relevant feeds
	updatePostInFeeds: (postId: string, updates: Partial<PostWithStats>) => {
		hotFeed.updatePost(postId, updates)
		newFeed.updatePost(postId, updates)
	},

	// Add post to all relevant feeds
	addPostToFeeds: (post: PostWithStats) => {
		hotFeed.addPost(post)
		newFeed.addPost(post)
	},

	// Replace a post across feeds
	replacePostInFeeds: (postId: string, newPost: PostWithStats) => {
		hotFeed.replacePost(postId, newPost)
		newFeed.replacePost(postId, newPost)
	},

	// Remove post from all relevant feeds
	removePostFromFeeds: (postId: string) => {
		hotFeed.removePost(postId)
		newFeed.removePost(postId)
	}
}
