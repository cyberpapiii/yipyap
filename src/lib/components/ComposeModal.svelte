<script lang="ts">
	import { browser } from '$app/environment'
	import { X, Send, Loader2 } from 'lucide-svelte'
	import { onMount } from 'svelte'
	import AnonymousAvatar from './AnonymousAvatar.svelte'
	import { Button } from '$lib/components/ui'
	import { composeStore, showComposeModal, composeState } from '$lib/stores'
	import type { ComposeState } from '$lib/types'

	let {
		onSubmit
	}: {
		onSubmit: (content: string, replyTo?: ComposeState['replyTo']) => Promise<void>
	} = $props()

	let textareaElement = $state<HTMLTextAreaElement | null>(null)
	let content = $state('')
	let isClosing = $state(false)
	let showSuccess = $state(false)
	let successPosition = $state({ top: '50%', left: '50%' })
	let keyboardHeight = $state(0)

	// Auto-resize textarea
	function autoResize() {
		if (!textareaElement) return
		textareaElement.style.height = 'auto'
		textareaElement.style.height = textareaElement.scrollHeight + 'px'
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault()
		if (!content.trim() || $composeState.isSubmitting) return

		composeStore.setSubmitting(true)
		composeStore.setError(null)

		try {
			await onSubmit(content.trim(), $composeState.replyTo)

			// Success haptic feedback
			if ('vibrate' in navigator) {
				navigator.vibrate([10, 50, 10])
			}

			// Capture modal position before closing
			const modalElement = document.querySelector('.modal-exit') || document.querySelector('.modal-enter')
			if (modalElement) {
				const rect = modalElement.getBoundingClientRect()
				successPosition = {
					top: `${rect.top + rect.height / 2}px`,
					left: `${rect.left + rect.width / 2}px`
				}
			}

			// Trigger success sequence
			isClosing = true
			setTimeout(() => {
				showSuccess = true
				setTimeout(() => {
					content = ''
					composeStore.closeModal()
					showSuccess = false
					isClosing = false
					successPosition = { top: '50%', left: '50%' }
				}, 800)
			}, 300)
		} catch (error) {
			// Error haptic feedback
			if ('vibrate' in navigator) {
				navigator.vibrate([50, 100, 50])
			}
			composeStore.setError(error instanceof Error ? error.message : 'Failed to post')
		}
	}

	// Handle close
	function handleClose() {
		if (!$composeState.isSubmitting && !isClosing) {
			isClosing = true
			setTimeout(() => {
				composeStore.closeModal()
				content = ''
				isClosing = false
				successPosition = { top: '50%', left: '50%' }
			}, 250) // Match exit animation duration
		}
	}

	// Handle key shortcuts
	function handleKeydown(e: KeyboardEvent) {
		// Cmd/Ctrl + Enter to submit
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault()
			handleSubmit(e)
		}
		// Escape to close
		if (e.key === 'Escape' && !$composeState.isSubmitting) {
			handleClose()
		}
	}

	// Character count
	const maxLength = 500
	const charCount = $derived.by(() => content.length)
	const isOverLimit = $derived.by(() => charCount > maxLength)
	const canSubmit = $derived.by(() => content.trim().length > 0 && !isOverLimit && !$composeState.isSubmitting)

	// Track keyboard height with visualViewport
	$effect(() => {
		if (!$showComposeModal || !browser) return

		function handleViewportChange() {
			if (window.visualViewport) {
				const vvHeight = window.visualViewport.height
				const windowHeight = window.innerHeight
				const newKeyboardHeight = Math.max(0, windowHeight - vvHeight)

				// Only update if meaningful change (avoid micro-adjustments)
				if (Math.abs(newKeyboardHeight - keyboardHeight) > 10) {
					keyboardHeight = newKeyboardHeight
				}
			}
		}

		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportChange)
			window.visualViewport.addEventListener('scroll', handleViewportChange)
			handleViewportChange() // Initial calculation
		}

		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', handleViewportChange)
				window.visualViewport.removeEventListener('scroll', handleViewportChange)
			}
			keyboardHeight = 0
		}
	})

	// Focus the textarea when modal opens
	$effect(() => {
		if ($showComposeModal && textareaElement) {
			// Multiple attempts to ensure focus on mobile
			textareaElement.focus()

			// Try again after animation starts
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.focus()
					textareaElement.click()
				}
			}, 150)

			// Final attempt after animation completes
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.focus()
				}
			}, 450)
		}
	})

	onMount(() => {
		document.addEventListener('keydown', handleKeydown)

		return () => {
			document.removeEventListener('keydown', handleKeydown)
		}
	})

	// Update content when it changes
	$effect(() => {
		composeStore.setContent(content)
	})

	// Auto-resize on content change
	$effect(() => {
		if (content !== undefined) {
			setTimeout(autoResize, 0)
		}
	})
</script>

<style>
	.modal-enter {
		animation: modal-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.modal-exit {
		animation: modal-slide-out 0.25s cubic-bezier(0.4, 0, 1, 1);
	}

	.modal-success {
		animation: modal-success 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes modal-slide-in {
		0% {
			transform: translateY(100%) scale(0.9);
			opacity: 0;
		}
		60% {
			transform: translateY(-8px) scale(1.02);
			opacity: 1;
		}
		100% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}

	@keyframes modal-slide-out {
		0% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(0) scale(0.3);
			opacity: 0;
		}
	}

	.modal-overlay-exit {
		animation: overlay-fade-out 0.3s ease-out forwards;
	}

	@keyframes overlay-fade-out {
		0% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	.success-indicator {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 101;
		animation: success-pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes success-pop {
		0% {
			transform: translate(-50%, -50%) scale(0);
			opacity: 0;
		}
		40% {
			transform: translate(-50%, -50%) scale(1.1);
			opacity: 1;
		}
		70% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -50%) scale(0.8);
			opacity: 0;
		}
	}

</style>

{#if showSuccess}
	<!-- Success checkmark -->
	<div class="success-indicator" style="top: {successPosition.top}; left: {successPosition.left};">
		<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="50" cy="50" r="48" fill="#009952"/>
			<path d="M30 52L43 65L70 38" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</div>
{/if}

{#if $showComposeModal}
	<!-- Modal overlay - pure background, no flex positioning -->
	<div
		class="fixed inset-0 bg-black/60 {isClosing ? 'modal-overlay-exit' : ''}"
		style="z-index: 100;"
		onclick={handleClose}
		role="button"
		tabindex="0"
		onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && handleClose()}
	>
	</div>

	<!-- Modal content - independently positioned at bottom, pushed up by keyboard -->
	<div
		class="fixed left-0 right-0 mx-auto w-full max-w-lg max-h-[70vh] flex flex-col shadow-xl rounded-t-2xl {isClosing ? 'modal-exit' : 'modal-enter'}"
		style="z-index: 101; bottom: {keyboardHeight}px; background-color: #101010; border: 1px solid rgba(107, 107, 107, 0.1); border-bottom: none; padding-bottom: env(safe-area-inset-bottom);"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
	>
			<!-- Header -->
			<div class="flex items-center justify-between p-4">
				<h2 class="text-2xl font-bold">
					{$composeState.replyTo ? 'Reply' : 'New Post'}
				</h2>
				<button
					onclick={handleClose}
					disabled={$composeState.isSubmitting}
					class="p-2 hover:bg-accent rounded-xl transition-colors disabled:opacity-50"
					aria-label="Close"
				>
					<X size={24} />
				</button>
			</div>

			<!-- Reply context -->
			{#if $composeState.replyTo}
				<div class="px-4 pb-2 bg-muted/30">
					<div class="flex items-start gap-2">
						<AnonymousAvatar user={$composeState.replyTo.author} size="sm" />
						<div class="flex-1 min-w-0">
							<p class="text-sm text-muted-foreground mb-1">
								Replying to {$composeState.replyTo.author.emoji} Anonymous
							</p>
							<p class="text-sm text-foreground line-clamp-2 selectable">
								{$composeState.replyTo.content}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={handleSubmit} class="flex-1 flex flex-col">
				<!-- Textarea -->
				<div class="flex-1 p-4">
					<textarea
						bind:this={textareaElement}
						bind:value={content}
						oninput={autoResize}
						placeholder={$composeState.replyTo ? "Write your reply..." : "What's on your mind?"}
						class="w-full bg-transparent border-0 outline-none resize-none placeholder:text-muted-foreground text-foreground min-h-24 max-h-48"
						disabled={$composeState.isSubmitting}
						maxlength={maxLength}
					></textarea>
				</div>

				<!-- Footer -->
				<div class="p-4">
					<!-- Error message -->
					{#if $composeState.error}
						<div class="mb-3 p-3 bg-destructive/10 rounded-xl text-sm text-destructive" style="border: 1px solid rgba(220, 38, 38, 0.2);">
							{$composeState.error}
						</div>
					{/if}

					<!-- Actions -->
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium {isOverLimit ? 'text-destructive' : 'text-muted-foreground'}">
								{charCount}/{maxLength}
							</span>
							<Button
								type="submit"
								variant="default"
								disabled={!canSubmit}
								class="gap-2 btn-primary text-base px-6 py-2"
							>
								{#if $composeState.isSubmitting}
									<Loader2 size={18} class="animate-spin" />
									<span>Posting...</span>
								{:else}
									<Send size={18} />
									<span>Post</span>
								{/if}
							</Button>
						</div>
				</div>
			</form>
	</div>
{/if}
