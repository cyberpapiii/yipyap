import { writable } from 'svelte/store'
import type { ComposeState, PostWithStats, CommentWithStats } from '$lib/types'

// Compose state store
export const composeState = writable<ComposeState>({
	content: '',
	isSubmitting: false,
	error: null
})

// Modal visibility
export const showComposeModal = writable<boolean>(false)

// Compose store functions
export const composeStore = {
	// Set content
	setContent: (content: string) =>
		composeState.update(state => ({ ...state, content })),

	// Set submitting state
	setSubmitting: (isSubmitting: boolean) =>
		composeState.update(state => ({ ...state, isSubmitting })),

	// Set error
	setError: (error: string | null) =>
		composeState.update(state => ({ ...state, error, isSubmitting: false })),

	// Set reply context
	setReplyTo: (replyTo: ComposeState['replyTo']) =>
		composeState.update(state => ({ ...state, replyTo })),

	// Clear compose state
	clear: () => composeState.set({
		content: '',
		isSubmitting: false,
		error: null
	}),

	// Open compose modal
	openModal: (replyTo?: ComposeState['replyTo']) => {
		// First close any existing modal state to prevent race conditions
		showComposeModal.set(false)

		// Clear previous state
		composeState.set({
			content: '',
			isSubmitting: false,
			error: null,
			replyTo: replyTo
		})

		// Open fresh modal on next tick to ensure clean state
		setTimeout(() => {
			showComposeModal.set(true)
		}, 0)
	},

	// Close compose modal
	closeModal: () => {
		showComposeModal.set(false)
		composeStore.clear()
	},

	// Quick reply setup (for replying to posts/comments)
	setupReply: (item: PostWithStats | CommentWithStats, type: 'post' | 'comment') => {
		const replyTo = {
			type,
			id: item.id,
			content: item.content,
			author: item.anonymous_user,
			// For comments, include the post_id so we know which post the comment belongs to
			post_id: type === 'comment' && 'post_id' in item ? item.post_id : undefined
		}
		composeStore.openModal(replyTo)
	}
}