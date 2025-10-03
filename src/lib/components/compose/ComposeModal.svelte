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
	let baselineInnerHeight = 0
	const KEYBOARD_THRESHOLD = 120

	// Community selector state
	let selectedCommunity = $state<GeographicCommunity>('nyc')
	let isCheckingGeofence = $state(false)
	let geofenceError = $state<string | null>(null)
	const geographicCommunities = getAllGeographicCommunities()

	// Track pending timeouts for cleanup
	let pendingSuccessTimeout: ReturnType<typeof setTimeout> | null = null
	let pendingAnimationTimeout: ReturnType<typeof setTimeout> | null = null

	function calculateKeyboardOffset(viewport?: VisualViewport | null) {
		if (!browser) return 0
		const target = viewport ?? (browser ? window.visualViewport : null)
		if (!target) return 0
		const diff = window.innerHeight - target.height - target.offsetTop
		if (diff > KEYBOARD_THRESHOLD) {
			return diff
		}

		// Fallback when the keyboard causes innerHeight to shrink but no visual viewport diff
		if (!baselineInnerHeight) {
			baselineInnerHeight = window.innerHeight
		}
		if (window.innerHeight > baselineInnerHeight) {
			baselineInnerHeight = window.innerHeight
		}
		const fallbackDiff = baselineInnerHeight - window.innerHeight
		return fallbackDiff > KEYBOARD_THRESHOLD ? fallbackDiff : 0
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
			if ('vibrate' in navigator) {
				navigator.vibrate([10, 50, 10])
			}

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
			if ('vibrate' in navigator) {
				navigator.vibrate([50, 100, 50])
			}

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
		if (!$composeState.isSubmitting && !isClosing) {
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

			isClosing = true
			setTimeout(() => {
				composeStore.closeModal()
				content = ''
				isClosing = false
				successPosition = { top: '50%', left: '50%' }
			}, MODAL_EXIT_DURATION_MS) // Use timing constant
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
	// Uses overflow hidden instead of position fixed to avoid layout shifts
	$effect(() => {
		if (!browser) return

		if ($showComposeModal) {
			// Store the current scroll position
			const scrollY = window.scrollY
			const scrollX = window.scrollX

			// Store original styles
			const originalBodyPosition = document.body.style.position
			const originalBodyTop = document.body.style.top
			const originalBodyLeft = document.body.style.left
			const originalBodyWidth = document.body.style.width
			const originalBodyOverflow = document.body.style.overflow
			const originalDocumentOverflow = document.documentElement.style.overflow

			// iOS-specific: Use position fixed on body for reliable scroll lock
			document.body.style.position = 'fixed'
			document.body.style.top = `-${scrollY}px`
			document.body.style.left = `-${scrollX}px`
			document.body.style.width = '100%'
			document.body.style.overflow = 'hidden'
			document.documentElement.style.overflow = 'hidden'

			// Track if we should ignore scroll events (during keyboard open)
			let isKeyboardOpening = false
			let keyboardOpenTimeout: ReturnType<typeof setTimeout> | null = null

			// Prevent programmatic scroll attempts, but allow iOS keyboard scroll
			const preventScroll = (e: Event) => {
				// Don't fight iOS during keyboard opening (first 500ms after focus)
				if (isKeyboardOpening) return

				// Restore scroll position if it changes after keyboard is open
				if (window.scrollY !== scrollY || window.scrollX !== scrollX) {
					window.scrollTo(scrollX, scrollY)
				}
			}

			// Monitor and prevent any scroll changes
			window.addEventListener('scroll', preventScroll, { passive: true })
			document.addEventListener('scroll', preventScroll, { passive: true })

			// Also block touchmove on the document (but allow it on the modal)
			const preventDocumentTouch = (e: TouchEvent) => {
				// Only prevent if touching outside the modal
				const target = e.target as HTMLElement
				if (!target.closest('[role="dialog"]')) {
					e.preventDefault()
				}
			}
			document.addEventListener('touchmove', preventDocumentTouch, { passive: false })

			// Focus textarea on the next DOM update cycle.
			// This ensures the element is rendered and focusable.
			// Using { preventScroll: true } is critical to stop iOS from scrolling the background page.
			tick().then(() => {
				if (textareaElement) {
					textareaElement.focus({ preventScroll: true })
				}
			})

			return () => {

				// Remove event listeners
				window.removeEventListener('scroll', preventScroll)
				document.removeEventListener('scroll', preventScroll)
				document.removeEventListener('touchmove', preventDocumentTouch)

				// Restore original styles
				document.body.style.position = originalBodyPosition
				document.body.style.top = originalBodyTop
				document.body.style.left = originalBodyLeft
				document.body.style.width = originalBodyWidth
				document.body.style.overflow = originalBodyOverflow
				document.documentElement.style.overflow = originalDocumentOverflow

				// Restore scroll position after layout is restored
				requestAnimationFrame(() => {
					window.scrollTo(scrollX, scrollY)
				})
			}
		}
	})

	onMount(() => {
		document.addEventListener('keydown', handleKeydown)

		let viewport: VisualViewport | null = null
		baselineInnerHeight = browser ? window.innerHeight : 0
		let rafId: number | null = null

		// Throttled update using requestAnimationFrame to prevent vibration
		const updateOffset = () => {
			// Cancel any pending update
			if (rafId !== null) {
				cancelAnimationFrame(rafId)
			}

			// Schedule update on next frame
			rafId = requestAnimationFrame(() => {
				keyboardOffset = calculateKeyboardOffset(viewport)
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
		keyboardOffset = $showComposeModal ? calculateKeyboardOffset() : 0
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
	<!-- Modal overlay (WCAG 4.1.2: Remove conflicting role/tabindex, backdrop is purely decorative) - Modal layer: z-1000-1999 -->
	<div
		class="fixed inset-0 bg-black/60 flex items-end justify-center p-4 {isClosing ? 'modal-overlay-exit' : ''}"
		style={`z-index: 1000; padding-bottom: calc(env(safe-area-inset-bottom) + ${keyboardOffset}px); overflow: hidden; overscroll-behavior: none; will-change: padding-bottom;`}
		onclick={(e) => e.target === e.currentTarget && handleClose()}
	>
		<!-- Modal content -->
		<div
			bind:this={modalContainerElement}
			class="w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-xl rounded-2xl {isClosing ? 'modal-exit' : 'modal-enter'}"
			style="background-color: #101010; border: 1px solid rgba(107, 107, 107, 0.1);"
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
				<div class="px-4 pt-2 pb-3 border-b" style="border-color: rgba(107, 107, 107, 0.1);">
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
								class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 {isSelected && !hasError ? 'bg-primary text-primary-foreground' : ''} {hasError ? 'bg-destructive/10 text-destructive' : ''} {!isSelected ? 'bg-muted/30 text-foreground hover:bg-muted' : ''}"
								style={isSelected && !hasError ? 'border: 2px solid rgba(255, 255, 255, 0.2);' : hasError ? 'border: 1px solid rgba(220, 38, 38, 0.2);' : 'border: 1px solid rgba(107, 107, 107, 0.1);'}
								aria-pressed={isSelected}
								aria-label="Post to {community.name}"
							>
								<span class="text-lg">{community.emoji}</span>
								<span class="font-medium text-sm">{community.name}</span>
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
						<div class="mt-2 p-2 bg-destructive/10 rounded-lg text-xs text-destructive flex items-start gap-2" style="border: 1px solid rgba(220, 38, 38, 0.2);">
							<Lock size={14} class="shrink-0 mt-0.5" />
							<span>{geofenceError}</span>
						</div>
					{/if}

					<!-- Community description -->
					{#if selectedCommunity}
						{@const community = geographicCommunities.find(c => c.id === selectedCommunity)}
						{#if community}
							<p class="mt-2 text-xs text-muted-foreground">
								{community.description}
							</p>
						{/if}
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
						class="w-full bg-transparent border-0 outline-none resize-none placeholder:text-muted-foreground text-foreground min-h-24 max-h-48"
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
