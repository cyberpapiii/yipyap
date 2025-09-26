import { writable } from 'svelte/store'
import type { ThreadState, PostWithStats, CommentWithStats } from '$lib/types'

// Thread state store
export const threadState = writable<ThreadState>({
	post: null,
	comments: [],
	loading: false,
	error: null,
	hasMore: true,
	cursor: null
})

// Thread store functions
export const threadStore = {
	subscribe: threadState.subscribe,
	// Set loading state
	setLoading: (loading: boolean) =>
		threadState.update(state => ({ ...state, loading })),

	// Set error state
	setError: (error: string | null) =>
		threadState.update(state => ({ ...state, error, loading: false })),

	// Set thread post
	setPost: (post: PostWithStats) =>
		threadState.update(state => ({ ...state, post, loading: false, error: null })),

	// Set comments (replace all)
	setComments: (comments: CommentWithStats[]) =>
		threadState.update(state => ({
			...state,
			comments,
			loading: false,
			error: null
		})),

	// Add comments (append)
	addComments: (newComments: CommentWithStats[], hasMore: boolean, cursor: string | null) =>
		threadState.update(state => ({
			...state,
			comments: [...state.comments, ...newComments],
			hasMore,
			cursor,
			loading: false,
			error: null
		})),

	// Add single comment
	addComment: (comment: CommentWithStats) =>
		threadState.update(state => ({
			...state,
			comments: [comment, ...state.comments]
		})),

	// Update a specific comment
	updateComment: (commentId: string, updates: Partial<CommentWithStats>) =>
		threadState.update(state => ({
			...state,
			comments: updateCommentsRecursively(state.comments, commentId, updates)
		})),

	// Update thread post
	updatePost: (updates: Partial<PostWithStats>) =>
		threadState.update(state => ({
			...state,
			post: state.post ? { ...state.post, ...updates } : null
		})),

	// Clear thread state
	clear: () => threadState.set({
		post: null,
		comments: [],
		loading: false,
		error: null,
		hasMore: true,
		cursor: null
	}),

	// Load thread
	loadThread: (postId: string, post?: PostWithStats) => {
		if (post) {
			threadStore.setPost(post)
		} else {
			threadStore.setLoading(true)
		}
	}
}

// Helper function to update comments recursively (for nested replies)
function updateCommentsRecursively(
	comments: CommentWithStats[],
	commentId: string,
	updates: Partial<CommentWithStats>
): CommentWithStats[] {
	return comments.map(comment => {
		if (comment.id === commentId) {
			return { ...comment, ...updates }
		}
		if (comment.replies && comment.replies.length > 0) {
			return {
				...comment,
				replies: updateCommentsRecursively(comment.replies, commentId, updates)
			}
		}
		return comment
	})
}
