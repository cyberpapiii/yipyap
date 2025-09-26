<script lang="ts">
	import { notifications, type Notification } from '$lib/services/notifications'
	import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-svelte'
	import { fade, fly } from 'svelte/transition'

	// Icon mapping for notification types
	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertCircle,
		info: Info
	}

	// Color classes for different notification types
	const colorClasses = {
		success: 'bg-vote-up text-white border-vote-up-700',
		error: 'bg-vote-down text-white border-vote-down-700',
		warning: 'bg-orange-500 text-white border-orange-700',
		info: 'bg-primary-600 text-white border-primary-700'
	}
</script>

<!-- Toast Container -->
<div class="toast-container fixed top-4 right-4 z-50 pointer-events-none">
	{#each $notifications as notification, index (notification.id)}
		<div
			class="relative mb-3 max-w-sm pointer-events-auto"
			style="top: {index * 4}px"
			in:fly={{ x: 300, duration: 300, delay: index * 100 }}
			out:fly={{ x: 300, duration: 200 }}
		>
			<div
				class="flex items-start p-4 rounded-lg shadow-lg border-l-4 backdrop-blur-sm {colorClasses[notification.type]}"
				role="alert"
				aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
			>
				<!-- Icon -->
				<div class="flex-shrink-0 mr-3">
					<svelte:component this={icons[notification.type]} size={20} class="mt-0.5" />
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					<h4 class="font-semibold text-sm leading-tight">
						{notification.title}
					</h4>
					{#if notification.message}
						<p class="text-sm opacity-90 mt-1 leading-relaxed">
							{notification.message}
						</p>
					{/if}

					<!-- Action button -->
					{#if notification.action}
						<button
							class="inline-flex items-center mt-2 px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors duration-200"
							onclick={notification.action.handler}
						>
							{notification.action.label}
						</button>
					{/if}
				</div>

				<!-- Close button -->
				<button
					class="flex-shrink-0 ml-2 p-1 rounded hover:bg-white/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
					onclick={() => notifications.remove(notification.id)}
					aria-label="Close notification"
				>
					<X size={16} />
				</button>
			</div>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		max-height: 100vh;
		overflow: hidden;
	}

	/* Ensure proper stacking */
	.toast-container > * {
		position: relative;
		z-index: 1;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.toast-container [role="alert"] {
			border: 2px solid currentColor;
		}
	}

	/* Reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.toast-container [role="alert"] {
			transition: none;
		}
	}
</style>
