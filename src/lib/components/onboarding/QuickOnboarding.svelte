<script lang="ts">
	import { X, ChevronRight, MapPin } from 'lucide-svelte'
	import { onMount } from 'svelte'
	import { onboardingStore } from '$lib/stores/onboarding'
	import { communityStore } from '$lib/stores/community'
	import { currentUser } from '$lib/stores/auth'
	import AnonymousAvatar from '../community/AnonymousAvatar.svelte'

	let currentStep = $derived($onboardingStore.currentOnboardingStep)
	let user = $derived($currentUser)
	let locationPermission = $derived($communityStore.locationPermission)

	// Touch handling for swipe
	let touchStartX = $state(0)
	let touchEndX = $state(0)

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].clientX
		handleSwipe()
	}

	function handleSwipe() {
		const swipeThreshold = 50
		const diff = touchStartX - touchEndX

		if (Math.abs(diff) < swipeThreshold) return

		if (diff > 0) {
			// Swiped left - next step
			handleNext()
		} else {
			// Swiped right - previous step
			handlePrev()
		}
	}

	function handleNext() {
		if (currentStep === 0) {
			onboardingStore.nextStep()
		} else if (currentStep === 1) {
			// On location step, complete onboarding
			onboardingStore.completeOnboarding()
		}
	}

	function handlePrev() {
		if (currentStep > 0) {
			onboardingStore.prevStep()
		}
	}

	async function handleEnableLocation() {
		if ('vibrate' in navigator) {
			navigator.vibrate(15)
		}

		try {
			await communityStore.checkLocation()

			// Success haptic
			if ('vibrate' in navigator) {
				navigator.vibrate([10, 50, 10])
			}

			// Complete onboarding
			onboardingStore.completeOnboarding()
		} catch (error) {
			console.error('[QuickOnboarding] Location error:', error)
		}
	}

	function handleSkipLocation() {
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		onboardingStore.completeOnboarding()
	}

	function handleSkipAll() {
		if ('vibrate' in navigator) {
			navigator.vibrate(10)
		}
		onboardingStore.skipOnboarding()
	}

	// Auto-advance from location step if already granted
	$effect(() => {
		if (currentStep === 1 && locationPermission === 'granted') {
			// Already have location, auto-complete
			setTimeout(() => {
				onboardingStore.completeOnboarding()
			}, 1500)
		}
	})
</script>

<style>
	.slide-enter {
		animation: slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slide-in {
		0% {
			transform: translateX(100%);
			opacity: 0;
		}
		100% {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.badge-pulse {
		animation: badge-pulse 1.5s ease-in-out;
	}

	@keyframes badge-pulse {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}
</style>

<!-- Full-screen modal -->
<div
	class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
	style="z-index: 1500;"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<!-- Modal Card -->
	<div
		class="w-full max-w-md rounded-2xl p-8 relative slide-enter"
		style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.2);"
	>
		<!-- Skip button -->
		<button
			onclick={handleSkipAll}
			class="absolute top-4 right-4 p-2 hover:bg-accent rounded-lg transition-colors"
			aria-label="Skip onboarding"
		>
			<X size={20} class="text-muted-foreground" />
		</button>

		<!-- Step Content -->
		{#if currentStep === 0}
			<!-- Step 1: Identity -->
			<div class="text-center">
				<div class="mb-6 flex justify-center badge-pulse">
					{#if user}
						<AnonymousAvatar {user} size="lg" />
					{:else}
						<div class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
							style="background-color: #6B6B6B; color: white;">
							🗽
						</div>
					{/if}
				</div>

				<h2 class="text-3xl font-bold mb-3">
					{#if user}
						You're {user.subway_line} Line
					{:else}
						You're Anonymous
					{/if}
				</h2>

				<p class="text-muted-foreground mb-8">
					No account needed. Your subway line identity is tied to this device.
				</p>

				<button
					onclick={handleNext}
					class="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
					style="background-color: #00933C; color: white;"
				>
					<span>Cool, what's next?</span>
					<ChevronRight size={20} />
				</button>

				<p class="text-xs text-muted-foreground mt-4">
					Swipe left to continue →
				</p>
			</div>

		{:else if currentStep === 1}
			<!-- Step 2: Location -->
			<div class="text-center">
				<div class="mb-6">
					<div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
						style="background-color: rgba(1, 115, 92, 0.2);">
						<MapPin size={40} class="text-primary" />
					</div>
				</div>

				<h2 class="text-3xl font-bold mb-3">Enable Location to Post</h2>

				{#if locationPermission === 'granted'}
					<p class="text-primary mb-8">
						✓ Location enabled! You're all set.
					</p>
				{:else}
					<p class="text-muted-foreground mb-8">
						Post in NYC or location-restricted communities like Dimes Square.
					</p>

					<div class="space-y-3 mb-6">
						<button
							onclick={handleEnableLocation}
							class="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
							style="background-color: #00933C; color: white;"
						>
							Enable Location
						</button>
					</div>

					<p class="text-xs text-muted-foreground">
						You can enable this later in your profile settings
					</p>
				{/if}
			</div>
		{/if}

		<!-- Progress Dots -->
		<div class="flex justify-center gap-2 mt-8">
			<div
				class="w-2 h-2 rounded-full transition-all"
				style="background-color: {currentStep === 0 ? '#00933C' : 'rgba(107, 107, 107, 0.3)'};"
			></div>
			<div
				class="w-2 h-2 rounded-full transition-all"
				style="background-color: {currentStep === 1 ? '#00933C' : 'rgba(107, 107, 107, 0.3)'};"
			></div>
		</div>
	</div>
</div>
