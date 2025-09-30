import { writable } from 'svelte/store'
import type { PostWithStats, FeedState, FeedType } from '$lib/types'

// Create feed store
function createFeedStore() {
	const { subscribe, set, update } = writable<FeedState>({
		posts: [],
		loading: false,
		error: null,
		hasMore: true,
		cursor: null
	})

	return {
		subscribe,
		// Set loading state
		setLoading: (loading: boolean) => update(state => ({ ...state, loading })),

		// Set error state
		setError: (error: string | null) => update(state => ({ ...state, error, loading: false })),

		// Set posts (replace all)
		setPosts: (posts: PostWithStats[]) => update(state => ({
			...state,
			posts,
			loading: false,
			error: null
		})),

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

		// Update a specific post
		updatePost: (postId: string, updates: Partial<PostWithStats>) =>
			update(state => ({
				...state,
				posts: state.posts.map(post =>
					post.id === postId ? { ...post, ...updates } : post
				)
			})),

		// Remove a post
		removePost: (postId: string) => update(state => ({
			...state,
			posts: state.posts.filter(post => post.id !== postId)
		})),

		// Replace a post with new data while preserving position
			replacePost: (postId: string, newPost: PostWithStats) => update(state => {
			let replaced = false
			const posts = state.posts.map(post => {
				if (post.id === postId) {
					replaced = true
					return newPost
				}
				return post
			})

			if (!replaced) {
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

		// Clear all posts
		clear: () => set({
			posts: [],
			loading: false,
			error: null,
			hasMore: true,
			cursor: null
		})
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
