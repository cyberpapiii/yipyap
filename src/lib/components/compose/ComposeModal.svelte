<script lang="ts">
	import { browser } from '$app/environment'
	import { X, Send, Loader2, MapPin, Lock, Check } from 'lucide-svelte'
	import { onMount, tick } from 'svelte'
	import AnonymousAvatar from '../community/AnonymousAvatar.svelte'
	import { Button } from '$lib/components/ui'
	import { composeStore, showComposeModal, composeState } from '$lib/stores'
	import type { ComposeState, GeographicCommunity } from '$lib/types'
	import { getAllGeographicCommunities, requiresGeofence } from '$lib/config/communities'
	import { communityStore } from '$lib/stores/community'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		onSubmit
	}: {
		onSubmit: (content: string, replyTo?: ComposeState['replyTo'], community?: GeographicCommunity) => Promise<void>
	} = $props()

	// Animation timing constants
	const MODAL_ENTER_DURATION_MS = 400
	const MODAL_EXIT_DURATION_MS = 250
	const SUCCESS_DELAY_MS = 300
	const SUCCESS_ANIMATION_DURATION_MS = 800

	let textareaElement = $state<HTMLTextAreaElement | null>(null)
	let modalContainerElement = $state<HTMLDivElement | null>(null)
	let content = $state('')
	let isClosing = $state(false)
	let showSuccess = $state(false)
	let successPosition = $state({ top: '50%', left: '50%' })
	let keyboardOffset = $state(0)
	let targetKeyboardOffset = $state(0)
	let baselineInnerHeight = 0
	const KEYBOARD_THRESHOLD = 120
	const MAX_KEYBOARD_HEIGHT = 400 // iOS keyboards are typically 260-350px, cap to prevent crazy values
	const IOS_TOOLBAR_BUFFER = 16 // Small buffer to clear iOS autocomplete toolbar
	let keyboardSettleTimeout: ReturnType<typeof setTimeout> | null = null

	// Community selector state
	let selectedCommunity = $state<GeographicCommunity>('nyc')
	let isCheckingGeofence = $state(false)
	let geofenceError = $state<string | null>(null)
	const geographicCommunities = getAllGeographicCommunities()

	// Derive location permission from community store
	let locationPermission = $derived($communityStore.locationPermission)


	// Track pending timeouts for cleanup
	let pendingSuccessTimeout: ReturnType<typeof setTimeout> | null = null
	let pendingAnimationTimeout: ReturnType<typeof setTimeout> | null = null

	function calculateKeyboardOffset(viewport?: VisualViewport | null) {
		if (!browser) return 0
		const target = viewport ?? (browser ? window.visualViewport : null)
		if (!target) return 0
		const diff = window.innerHeight - target.height - target.offsetTop
		if (diff > KEYBOARD_THRESHOLD) {
			// Clamp to reasonable max to prevent crazy values during iOS transitions
			return Math.min(diff, MAX_KEYBOARD_HEIGHT)
		}

		// Fallback when the keyboard causes innerHeight to shrink but no visual viewport diff
		if (!baselineInnerHeight) {
			baselineInnerHeight = window.innerHeight
		}
		if (window.innerHeight > baselineInnerHeight) {
			baselineInnerHeight = window.innerHeight
		}
		const fallbackDiff = baselineInnerHeight - window.innerHeight
		if (fallbackDiff > KEYBOARD_THRESHOLD) {
			return Math.min(fallbackDiff, MAX_KEYBOARD_HEIGHT)
		}
		return 0
	}

	// Auto-resize textarea
	function autoResize() {
		if (!textareaElement) return
		textareaElement.style.height = 'auto'
		textareaElement.style.height = textareaElement.scrollHeight + 'px'
	}

	// Check geofence for selected community
	async function checkGeofence(): Promise<boolean> {
		if (!requiresGeofence(selectedCommunity)) {
			geofenceError = null
			return true
		}

		isCheckingGeofence = true
		geofenceError = null

		const result = await communityStore.canPostInCommunity(selectedCommunity)
		isCheckingGeofence = false

		if (!result.canPost) {
			geofenceError = result.reason || 'You must be in this location to post'
			return false
		}

		return true
	}

	// Handle community selection change
	async function handleCommunityChange(community: GeographicCommunity) {
		selectedCommunity = community

		// Immediately refocus the textarea to prevent the keyboard from dismissing.
		if (textareaElement) {
			textareaElement.focus({ preventScroll: true })
		}

		await checkGeofence()

		// Ensure focus is still on the textarea after the async operation.
		if (textareaElement) {
			textareaElement.focus({ preventScroll: true })
		}
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault()
		if (!content.trim() || $composeState.isSubmitting) return

		// Check geofence before submitting
		const canPost = await checkGeofence()
		if (!canPost) return

		composeStore.setSubmitting(true)
		composeStore.setError(null)

		try {
			await onSubmit(content.trim(), $composeState.replyTo, selectedCommunity)

			// Success haptic feedback
			hapticsStore.trigger($composeState.replyTo ? 'comment-success' : 'post-success')

			// Capture modal position using Svelte binding before closing
			if (modalContainerElement) {
				const rect = modalContainerElement.getBoundingClientRect()
				successPosition = {
					top: `${rect.top + rect.height / 2}px`,
					left: `${rect.left + rect.width / 2}px`
				}
			}

			// Reset submitting state BEFORE starting close animation
			composeStore.setSubmitting(false)

			// Trigger success sequence with timing constants
			isClosing = true
			pendingSuccessTimeout = setTimeout(() => {
				showSuccess = true
				pendingAnimationTimeout = setTimeout(() => {
					content = ''
					composeStore.closeModal()
					showSuccess = false
					isClosing = false
					successPosition = { top: '50%', left: '50%' }
					pendingSuccessTimeout = null
					pendingAnimationTimeout = null
				}, SUCCESS_ANIMATION_DURATION_MS)
			}, SUCCESS_DELAY_MS)
		} catch (error) {
			// Clean up any pending timeouts
			if (pendingSuccessTimeout) {
				clearTimeout(pendingSuccessTimeout)
				pendingSuccessTimeout = null
			}
			if (pendingAnimationTimeout) {
				clearTimeout(pendingAnimationTimeout)
				pendingAnimationTimeout = null
			}

			// Reset animation state
			isClosing = false
			showSuccess = false

			// Error haptic feedback
			hapticsStore.trigger('error')

			const errorMessage = error instanceof Error ? error.message : 'Failed to post'
			composeStore.setError(errorMessage)
			composeStore.setSubmitting(false)

			// If post was deleted, redirect to home after showing error
			if (errorMessage.includes('has been deleted')) {
				setTimeout(() => {
					composeStore.closeModal()
					window.location.href = '/'
				}, 2000)
			}
		}
	}

	// Handle close
	function handleClose() {
		// Don't close while submitting, but allow close even if isClosing is true
		// to handle rapid taps (force close if stuck)
		if ($composeState.isSubmitting) return

		// Clean up any pending success animations
		if (pendingSuccessTimeout) {
			clearTimeout(pendingSuccessTimeout)
			pendingSuccessTimeout = null
		}
		if (pendingAnimationTimeout) {
			clearTimeout(pendingAnimationTimeout)
			pendingAnimationTimeout = null
		}

		// Reset animation state
		showSuccess = false

		// If already closing, force immediate close
		if (isClosing) {
			composeStore.closeModal()
			content = ''
			isClosing = false
			successPosition = { top: '50%', left: '50%' }
			return
		}

		isClosing = true
		setTimeout(() => {
			composeStore.closeModal()
			content = ''
			isClosing = false
			successPosition = { top: '50%', left: '50%' }
		}, MODAL_EXIT_DURATION_MS) // Use timing constant
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

	// Character count and validation
	const maxLength = 500
	const charCount = $derived.by(() => content.length)
	const trimmedLength = $derived.by(() => content.trim().length)
	const isOverLimit = $derived.by(() => charCount > maxLength)
	const validationMessage = $derived.by(() => {
		if (trimmedLength === 0 && content.length > 0) {
			return 'Content cannot be only whitespace'
		}
		if (charCount > maxLength) {
			return `Content exceeds limit by ${charCount - maxLength} characters`
		}
		return null
	})
	const canSubmit = $derived.by(() => {
		return trimmedLength >= 1 && trimmedLength <= maxLength && !$composeState.isSubmitting && !geofenceError
	})
	const submitLabel = $derived.by(() => ($composeState.replyTo ? 'Reply' : 'Post'))
	const submittingLabel = $derived.by(() => ($composeState.replyTo ? 'Replying...' : 'Posting...'))
	const replyIdentityLabel = $derived.by(() => {
		const replyTo = $composeState.replyTo
		if (!replyTo) return ''
		const line = replyTo.author?.subway_line
		return line ? `${line} Anonymous` : 'Anonymous'
	})

	// Lock body scroll when modal is open to prevent iOS scroll-to-focus behavior
	// Uses simpler overflow hidden approach to avoid layout shifts
	$effect(() => {
		if (!browser) return

		if ($showComposeModal) {
			// Store original overflow styles
			const originalBodyOverflow = document.body.style.overflow
			const originalDocumentOverflow = document.documentElement.style.overflow

			// Simple overflow hidden - less aggressive than position:fixed
			document.body.style.overflow = 'hidden'
			document.documentElement.style.overflow = 'hidden'

			// Block touchmove on the backdrop (but allow it on the modal content)
			const preventBackdropTouch = (e: TouchEvent) => {
				const target = e.target as HTMLElement
				// Allow touches inside the modal dialog and its children
				if (!target.closest('[role="dialog"]') && !target.closest('.modal-content-area')) {
					e.preventDefault()
				}
			}
			document.addEventListener('touchmove', preventBackdropTouch, { passive: false })

			// Focus textarea after a short delay to let iOS settle
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.focus({ preventScroll: true })
				}
			}, 50)

			return () => {
				// Remove event listener
				document.removeEventListener('touchmove', preventBackdropTouch)

				// Restore original styles
				document.body.style.overflow = originalBodyOverflow
				document.documentElement.style.overflow = originalDocumentOverflow
			}
		}
	})

	onMount(() => {
		document.addEventListener('keydown', handleKeydown)

		let viewport: VisualViewport | null = null
		baselineInnerHeight = browser ? window.innerHeight : 0
		let rafId: number | null = null

		// Debounced update to let iOS settle before applying keyboard offset
		// This prevents the modal from jumping around during keyboard animation
		const updateOffset = () => {
			// Cancel any pending update
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
			}

			// Schedule update on next frame
			rafId = requestAnimationFrame(() => {
				const newOffset = calculateKeyboardOffset(viewport)

				// If keyboard is closing (offset decreasing to 0), apply immediately
				if (newOffset === 0 && keyboardOffset > 0) {
					if (keyboardSettleTimeout) {
						clearTimeout(keyboardSettleTimeout)
						keyboardSettleTimeout = null
					}
					targetKeyboardOffset = 0
					keyboardOffset = 0
					rafId = null
					return
				}

				// If keyboard is opening or changing, debounce to let iOS settle
				targetKeyboardOffset = newOffset

				// Clear any existing settle timeout
				if (keyboardSettleTimeout) {
					clearTimeout(keyboardSettleTimeout)
				}

				// Wait a bit for iOS to settle, then apply the offset
				// This prevents the modal from jumping to incorrect positions during keyboard animation
				keyboardSettleTimeout = setTimeout(() => {
					// Only apply if the value hasn't changed significantly (iOS has settled)
					const currentOffset = calculateKeyboardOffset(viewport)
					// Use the more stable of the two values (prevents oscillation)
					const finalOffset = Math.abs(currentOffset - targetKeyboardOffset) < 50
						? targetKeyboardOffset
						: currentOffset
					// Add buffer for iOS autocomplete toolbar that sits above keyboard
					keyboardOffset = Math.min(finalOffset, MAX_KEYBOARD_HEIGHT) + IOS_TOOLBAR_BUFFER
					keyboardSettleTimeout = null
				}, 100) // 100ms settle time

				rafId = null
			})
		}

		if (browser && window.visualViewport) {
			viewport = window.visualViewport
			viewport.addEventListener('resize', updateOffset)
			viewport.addEventListener('scroll', updateOffset)
			updateOffset()
		}

		window.addEventListener('resize', updateOffset)

		return () => {
			// Cancel any pending animation frame
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
			}

			// Cancel keyboard settle timeout
			if (keyboardSettleTimeout) {
				clearTimeout(keyboardSettleTimeout)
				keyboardSettleTimeout = null
			}

			// Clean up pending timeouts
			if (pendingSuccessTimeout) {
				clearTimeout(pendingSuccessTimeout)
			}
			if (pendingAnimationTimeout) {
				clearTimeout(pendingAnimationTimeout)
			}

			document.removeEventListener('keydown', handleKeydown)
			if (viewport) {
				viewport.removeEventListener('resize', updateOffset)
				viewport.removeEventListener('scroll', updateOffset)
			}
			window.removeEventListener('resize', updateOffset)
		}
	})

	$effect(() => {
		if ($showComposeModal) {
			// Reset animation state when modal opens (handles rapid open/close)
			isClosing = false
			showSuccess = false
		} else {
			// Reset keyboard offset when modal closes
			keyboardOffset = 0
			targetKeyboardOffset = 0
			if (keyboardSettleTimeout) {
				clearTimeout(keyboardSettleTimeout)
				keyboardSettleTimeout = null
			}
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
	/* Animation durations match constants: MODAL_ENTER_DURATION_MS=400ms, MODAL_EXIT_DURATION_MS=250ms */
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

	/* Success animation duration matches SUCCESS_ANIMATION_DURATION_MS=800ms */
	.success-indicator {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001; /* Modal layer: success animation above modal backdrop */
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

	/* WCAG 2.3.3 Level A: Reduced Motion Support */
	/* Disable/reduce animations for users with motion sensitivity */
	@media (prefers-reduced-motion: reduce) {
		.modal-enter,
		.modal-exit {
			animation: none !important;
			transition: opacity 0.2s ease;
		}

		.modal-overlay-exit {
			animation: none !important;
			transition: opacity 0.2s ease;
		}

		.success-indicator {
			animation: none !important;
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
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
	<!-- Backdrop - covers full screen, separate from modal positioning -->
	<div
		class="fixed inset-0 bg-black/60 {isClosing ? 'modal-overlay-exit' : ''}"
		style="z-index: 1000;"
		onclick={handleClose}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	></div>

	<!-- Modal positioning container - handles keyboard offset -->
	<div
		class="fixed inset-0 flex items-end justify-center p-4 pointer-events-none"
		style={`z-index: 1001; padding-bottom: calc(env(safe-area-inset-bottom) + ${keyboardOffset}px); transition: padding-bottom 0.15s ease-out;`}
	>
		<!-- Modal content -->
		<div
			bind:this={modalContainerElement}
			class="modal-content-area pointer-events-auto w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-xl rounded-2xl {isClosing ? 'modal-exit' : 'modal-enter'}"
			style="background-color: #101010; border: 1px solid rgba(107, 107, 107, 0.1);"
			role="dialog"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-3">
				<h2 class="text-2xl font-bold">
					{$composeState.replyTo ? 'Reply' : 'New Post'}
				</h2>
				<button
					onclick={handleClose}
					disabled={$composeState.isSubmitting}
					class="p-2 hover:bg-accent rounded-xl transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
								Replying to {replyIdentityLabel}
							</p>
							<p class="text-sm text-foreground line-clamp-2 selectable">
								{$composeState.replyTo.content}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Community Selector (only show for new posts, not replies) -->
			{#if !$composeState.replyTo}
				<div class="px-4 pt-1 pb-3 border-b" style="border-color: rgba(107, 107, 107, 0.1);">
					<div class="block text-sm font-medium text-muted-foreground mb-2">
						Post to:
					</div>
					<div class="flex gap-2">
						{#each geographicCommunities as community}
							{@const isSelected = selectedCommunity === community.id}
							{@const needsGeofence = requiresGeofence(community.id)}
							{@const hasError = isSelected && geofenceError}
							<button
								type="button"
								onclick={(e) => { e.preventDefault(); handleCommunityChange(community.id); }}
								disabled={$composeState.isSubmitting || isCheckingGeofence}
								class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 {isSelected && !hasError ? 'bg-primary text-primary-foreground' : ''} {hasError ? 'bg-destructive/10 text-destructive' : ''} {!isSelected ? 'bg-muted/30 text-foreground hover:bg-muted' : ''}"
								style={isSelected && !hasError ? 'border: 2px solid rgba(255, 255, 255, 0.2);' : hasError ? 'border: 2px solid hsl(var(--destructive));' : 'border: 1px solid rgba(107, 107, 107, 0.1);'}
								aria-pressed={isSelected}
								aria-label="Post to {community.name}"
							>
								<span class="text-base">{community.emoji}</span>
								<span class="font-medium text-xs">{community.name}</span>
								{#if needsGeofence}
									{#if isCheckingGeofence && isSelected}
										<Loader2 size={14} class="animate-spin" />
									{:else if hasError}
										<Lock size={14} />
									{:else if isSelected}
										<Check size={14} />
									{:else}
										<MapPin size={14} />
									{/if}
								{/if}
							</button>
						{/each}
					</div>

					<!-- Geofence error message -->
					{#if geofenceError}
						<div class="mt-2 p-2 bg-destructive/10 rounded-lg text-xs text-destructive flex items-start gap-2" style="border: 1px solid hsl(var(--destructive));">
							<Lock size={14} class="shrink-0 mt-0.5" />
							<div>
								<span>{geofenceError}</span>
								{#if locationPermission === 'denied'}
									<button onclick={() => communityStore.retryLocation()} class="mt-2 text-xs font-bold underline">Try Again</button>
								{/if}
							</div>
						</div>
					{/if}


				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={handleSubmit} class="flex-1 flex flex-col overflow-hidden">
				<!-- Textarea -->
				<div class="flex-1 p-4 overflow-y-auto">
					<textarea
						bind:this={textareaElement}
						bind:value={content}
						oninput={autoResize}
						placeholder={$composeState.replyTo ? "Write your reply..." : "What's on your mind?"}
						class="w-full bg-transparent border-0 outline-none resize-none placeholder:text-muted-foreground text-foreground min-h-20 max-h-48"
						disabled={$composeState.isSubmitting}
						maxlength={maxLength}
					></textarea>
				</div>

				<!-- Footer -->
				<div class="px-4 pt-4 pb-4">
					<!-- Error message -->
					{#if $composeState.error}
						<div class="mb-3 p-3 bg-destructive/10 rounded-xl text-sm text-destructive" style="border: 1px solid rgba(220, 38, 38, 0.2);">
							{$composeState.error}
						</div>
					{/if}

					<!-- Validation warning -->
					{#if validationMessage && !$composeState.error}
						<div class="mb-3 p-3 bg-yellow-500/10 rounded-xl text-sm text-yellow-500" style="border: 1px solid rgba(234, 179, 8, 0.2);">
							⚠️ {validationMessage}
						</div>
					{/if}

					<!-- Actions -->
						<div class="flex items-center justify-between">
							<!-- WCAG 4.1.3: Screen reader announces character count changes -->
							<span
								class="text-sm font-medium {isOverLimit ? 'text-destructive' : 'text-muted-foreground'}"
								aria-live="polite"
								role="status"
							>
								{charCount}/{maxLength}
							</span>
							<Button
								type="submit"
								variant="default"
								disabled={!canSubmit}
								class="gap-2 btn-primary text-base px-6 py-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
							>
								{#if $composeState.isSubmitting}
									<Loader2 size={18} class="animate-spin" />
									<span>{submittingLabel}</span>
								{:else}
									<Send size={18} />
									<span>{submitLabel}</span>
								{/if}
							</Button>
						</div>
				</div>
			</form>
		</div>
	</div>
{/if}
