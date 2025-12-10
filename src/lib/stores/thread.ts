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

	// Add single comment (with duplicate prevention and proper nesting)
	addComment: (comment: CommentWithStats) =>
		threadState.update(state => {
			// Check if comment already exists in top-level OR nested replies (prevent duplicates)
			const exists = commentExistsRecursively(state.comments, comment.id)
			if (exists) {
				return state
			}

			// If comment has a parent, nest it under the parent
			if (comment.parent_comment_id) {
				return {
					...state,
					comments: addCommentToParent(state.comments, comment.parent_comment_id, comment)
				}
			}

			// Otherwise, add as top-level comment
			return {
				...state,
				comments: [comment, ...state.comments]
			}
		}),

	// Update a specific comment (supports _scoreDelta for incremental score updates)
	updateComment: (commentId: string, updates: Partial<CommentWithStats> & { _scoreDelta?: number }) =>
		threadState.update(state => ({
			...state,
			comments: updateCommentsRecursively(state.comments, commentId, updates)
		})),

	// Remove a specific comment (for rollback)
	removeComment: (commentId: string) =>
		threadState.update(state => ({
			...state,
			comments: removeCommentRecursively(state.comments, commentId)
		})),

	// Update thread post (supports _scoreDelta for incremental score updates)
	updatePost: (updates: Partial<PostWithStats> & { _scoreDelta?: number }) =>
		threadState.update(state => {
			if (!state.post) return state

			// Handle incremental score delta from realtime vote events
			if (updates._scoreDelta !== undefined) {
				const { _scoreDelta, ...restUpdates } = updates
				return {
					...state,
					post: {
						...state.post,
						...restUpdates,
						vote_score: state.post.vote_score + _scoreDelta
					}
				}
			}

			// Standard update (absolute values)
			return {
				...state,
				post: { ...state.post, ...updates }
			}
		}),

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
// Supports _scoreDelta for incremental score updates from realtime vote events
function updateCommentsRecursively(
	comments: CommentWithStats[],
	commentId: string,
	updates: Partial<CommentWithStats> & { _scoreDelta?: number }
): CommentWithStats[] {
	return comments.map(comment => {
		if (comment.id === commentId) {
			// Handle incremental score delta
			if (updates._scoreDelta !== undefined) {
				const { _scoreDelta, ...restUpdates } = updates
				return {
					...comment,
					...restUpdates,
					vote_score: comment.vote_score + _scoreDelta
				}
			}
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

// Helper function to remove comments recursively (for rollback)
function removeCommentRecursively(
	comments: CommentWithStats[],
	commentId: string
): CommentWithStats[] {
	return comments
		.filter(comment => comment.id !== commentId)
		.map(comment => {
			if (comment.replies && comment.replies.length > 0) {
				return {
					...comment,
					replies: removeCommentRecursively(comment.replies, commentId)
				}
			}
			return comment
		})
}

// Helper function to check if comment exists recursively (including nested replies)
function commentExistsRecursively(
	comments: CommentWithStats[],
	commentId: string
): boolean {
	for (const comment of comments) {
		if (comment.id === commentId) {
			return true
		}
		if (comment.replies && comment.replies.length > 0) {
			if (commentExistsRecursively(comment.replies, commentId)) {
				return true
			}
		}
	}
	return false
}

// Helper function to add a comment to its parent's replies array
function addCommentToParent(
	comments: CommentWithStats[],
	parentId: string,
	newComment: CommentWithStats
): CommentWithStats[] {
	return comments.map(comment => {
		// Found the parent - add new comment to its replies
		if (comment.id === parentId) {
			return {
				...comment,
				replies: [newComment, ...(comment.replies || [])]
			}
		}
		// Keep searching in nested replies
		if (comment.replies && comment.replies.length > 0) {
			return {
				...comment,
				replies: addCommentToParent(comment.replies, parentId, newComment)
			}
		}
		return comment
	})
}
