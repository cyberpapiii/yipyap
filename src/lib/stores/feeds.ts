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

	// Track the last optimistic/server-confirmed vote state to guard against stale overwrites
	const VOTE_GUARD_TTL = 15000 // 15s guard window
	const voteGuard = new Map<string, { score: number; userVote: 'up' | 'down' | null; timestamp: number }>()

	const updateVoteGuard = (post: PostWithStats) => {
		voteGuard.set(post.id, {
			score: post.vote_score,
			userVote: post.user_vote ?? null,
			timestamp: Date.now()
		})
	}

	const maybeApplyVoteGuard = (post: PostWithStats): PostWithStats => {
		const guard = voteGuard.get(post.id)
		if (!guard || !guard.userVote) return post

		const isExpired = Date.now() - guard.timestamp > VOTE_GUARD_TTL
		if (isExpired) {
			voteGuard.delete(post.id)
			return post
		}

		// If we still show (or expect) the user's vote, avoid overwriting with a lower score or dropping user_vote
		const voteMatches = post.user_vote === guard.userVote || (!post.user_vote && guard.userVote)

		if (voteMatches) {
			// Keep the higher optimistic/server-confirmed score; stale data will be reconciled after TTL
			const guardedScore = post.vote_score < guard.score ? guard.score : post.vote_score
			return {
				...post,
				vote_score: guardedScore,
				user_vote: post.user_vote ?? guard.userVote
			}
		}

		return post
	}

	return {
		subscribe,
		// Set loading state
		setLoading: (loading: boolean) => update(state => ({ ...state, loading })),

		// Set error state
		setError: (error: string | null) => update(state => ({ ...state, error, loading: false })),

		// Set posts (replace all)
		setPosts: (posts: PostWithStats[]) => update(state => {
			const guardedPosts = posts.map(post => {
				const guarded = maybeApplyVoteGuard(post)
				// Refresh guard with the value we're keeping so future updates compare correctly
				if (guarded.user_vote) {
					updateVoteGuard(guarded)
				}
				return guarded
			})

			return {
				...state,
				posts: guardedPosts,
				loading: false,
				error: null
			}
		}),

		// Add posts (append)
		addPosts: (newPosts: PostWithStats[], hasMore: boolean, cursor: string | null) =>
			update(state => ({
				...state,
				posts: [
					...state.posts,
					...newPosts.map(post => {
						const guarded = maybeApplyVoteGuard(post)
						if (guarded.user_vote) updateVoteGuard(guarded)
						return guarded
					})
				],
				hasMore,
				cursor,
				loading: false,
				error: null
			})),

		// Add single post to top
		addPost: (post: PostWithStats) => update(state => {
			const guarded = maybeApplyVoteGuard(post)
			if (guarded.user_vote) updateVoteGuard(guarded)
			return {
				...state,
				posts: [guarded, ...state.posts]
			}
		}),

		// Update a specific post (supports _scoreDelta for incremental score updates)
		updatePost: (postId: string, updates: Partial<PostWithStats> & { _scoreDelta?: number }) =>
			update(state => ({
				...state,
				posts: state.posts.map(post => {
					if (post.id !== postId) return post

					// If the update explicitly clears the user's vote, drop any guard entry
					if ('user_vote' in updates && updates.user_vote === null) {
						voteGuard.delete(postId)
					}

					const before = { score: post.vote_score, vote: post.user_vote }

					// Handle incremental score delta from realtime vote events
					if (updates._scoreDelta !== undefined) {
						const { _scoreDelta, ...restUpdates } = updates
						const next = {
							...post,
							...restUpdates,
							vote_score: post.vote_score + _scoreDelta
						}

						const guardedNext = maybeApplyVoteGuard(next)

						if (guardedNext.user_vote) {
							updateVoteGuard(guardedNext)
						}

						return guardedNext
					}

					const next = { ...post, ...updates }
					const guardedNext = maybeApplyVoteGuard(next)

					if (guardedNext.user_vote) {
						updateVoteGuard(guardedNext)
					}

					// Standard update (absolute values)
					return guardedNext
				})
			})),

		// Remove a post
		removePost: (postId: string) => update(state => {
			voteGuard.delete(postId)
			return {
				...state,
				posts: state.posts.filter(post => post.id !== postId)
			}
		}),

		// Replace a post with new data while preserving position
		replacePost: (postId: string, newPost: PostWithStats) => update(state => {
			const guardedNewPost = maybeApplyVoteGuard(newPost)
			if (guardedNewPost.user_vote) updateVoteGuard(guardedNewPost)
			// Check if the new post already exists (race condition with realtime)
			const newPostExists = state.posts.some(p => p.id === guardedNewPost.id)

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
					return guardedNewPost
				}
				return post
			})

			if (!replaced) {
				// Old post not found, add new post to top
				return {
					...state,
					posts: [guardedNewPost, ...state.posts]
				}
			}

			return {
				...state,
				posts
			}
		}),

		// Set community filter (clears posts)
		setCommunity: (community: CommunityType) => update(state => {
			voteGuard.clear()
			return {
				posts: [],
				loading: false,
				error: null,
				hasMore: true,
				cursor: null,
				community
			}
		}),

		// Clear all posts
		clear: () => update(state => {
			voteGuard.clear()
			return {
				posts: [],
				loading: false,
				error: null,
				hasMore: true,
				cursor: null,
				community: state.community
			}
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
