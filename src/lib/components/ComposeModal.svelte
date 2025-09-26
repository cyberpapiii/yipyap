<script lang="ts">
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
			content = ''
			composeStore.closeModal()
		} catch (error) {
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
	const maxLength = 100
	const charCount = $derived.by(() => content.length)
	const isOverLimit = $derived.by(() => charCount > maxLength)
	const canSubmit = $derived.by(() => content.trim().length > 0 && !isOverLimit && !$composeState.isSubmitting)

	onMount(() => {
		if (textareaElement) {
			textareaElement.focus()
		}
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
			transform: translateY(100%) scale(0.95);
			opacity: 0;
		}
	}
</style>

{#if $showComposeModal}
	<!-- Modal overlay -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4"
		onclick={(e) => e.target === e.currentTarget && handleClose()}
		role="button"
		tabindex="0"
		onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && handleClose()}
	>
		<!-- Modal content -->
		<div class="bg-background border border-border rounded-t-lg sm:rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl {isClosing ? 'modal-exit' : 'modal-enter'}" style="background-color: black; opacity: 1;">
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-border/60">
				<h2 class="text-lg font-semibold">
					{$composeState.replyTo ? 'Reply' : 'New Post'}
				</h2>
				<button
					onclick={handleClose}
					disabled={$composeState.isSubmitting}
					class="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
					aria-label="Close"
				>
					<X size={20} />
				</button>
			</div>

			<!-- Reply context -->
			{#if $composeState.replyTo}
				<div class="p-4 bg-muted/50 border-b border-line/60">
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
				<div class="p-4 border-t border-border/60">
					<!-- Error message -->
					{#if $composeState.error}
						<div class="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
							{$composeState.error}
						</div>
					{/if}

					<!-- Actions -->
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium {isOverLimit ? 'text-destructive' : 'text-muted-foreground'}">
								{charCount}/{maxLength}
							</span>
							<Button
								type="submit"
								variant="default"
								disabled={!canSubmit}
								class="gap-2 btn-primary"
							>
								{#if $composeState.isSubmitting}
									<Loader2 size={16} class="animate-spin" />
									<span>Posting...</span>
								{:else}
									<Send size={16} />
									<span>Post</span>
								{/if}
							</Button>
						</div>
				</div>
			</form>
		</div>
	</div>
{/if}
