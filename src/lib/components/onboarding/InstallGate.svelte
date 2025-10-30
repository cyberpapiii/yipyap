<script lang="ts">
	import { Loader2, Smartphone } from 'lucide-svelte'
	import { onboardingStore } from '$lib/stores/onboarding'
	import { promptInstall, getInstallInstructions } from '$lib/utils/pwa'
	import type { InstallGateType } from '$lib/types'
	import { hapticsStore } from '$lib/stores/haptics'

	let {
		gateType
	}: {
		gateType: InstallGateType
	} = $props()

	let isInstalling = $derived($onboardingStore.isInstalling)
	let instructions = getInstallInstructions()

	async function handleInstall() {
		onboardingStore.setInstalling(true)

		try {
			const result = await promptInstall()

			if (result === 'installed') {
				// Success! Gate will auto-hide when app reopens in PWA mode
				hapticsStore.trigger('post-success')
			} else if (result === 'dismissed') {
				// User dismissed the prompt
				onboardingStore.setInstalling(false)
				hapticsStore.trigger('selection')
			} else {
				// Unavailable - shouldn't happen but handle gracefully
				onboardingStore.setInstalling(false)
			}
		} catch (error) {
			console.error('[InstallGate] Install error:', error)
			onboardingStore.setInstalling(false)
		}
	}
</script>

<style>
	.subway-circle {
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.05);
			opacity: 0.8;
		}
	}
</style>

<!-- Full-screen gate - blocks entire app -->
<div
	class="fixed inset-0 flex items-center justify-center p-6"
	style="background-color: #101010; z-index: 2000;"
>
	<div class="w-full max-w-md">
		<!-- Logo/Branding -->
		<div class="text-center mb-8">
			<h1 class="text-5xl font-bold mb-2">BingBong</h1>
			<p class="text-xl text-muted-foreground">New York City's Message Board</p>
		</div>

		<!-- Animated subway lines - N Y C -->
		<div class="flex justify-center gap-3 mb-8 py-2">
			<div class="subway-circle w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
				style="background-color: #F6BC26; color: black; animation-delay: 0s; border: 2px solid rgba(255, 255, 255, 0.2);">
				N
			</div>
			<div class="subway-circle w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
				style="background-color: #0062CF; color: white; animation-delay: 0.2s; border: 2px solid rgba(255, 255, 255, 0.2);">
				Y
			</div>
			<div class="subway-circle w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
				style="background-color: #EB6800; color: white; animation-delay: 0.4s; border: 2px solid rgba(255, 255, 255, 0.2);">
				C
			</div>
		</div>

		<!-- Content Card -->
		<div
			class="rounded-2xl p-8 text-center"
			style="background-color: #1E1E1E; border: 1px solid rgba(107, 107, 107, 0.2);"
		>
			{#if gateType === 'desktop-block'}
				<!-- Desktop Block Message -->
				<div class="mb-6">
					<Smartphone size={48} class="mx-auto mb-4 text-muted-foreground" />
				</div>
				<h2 class="text-2xl font-bold mb-4">BingBong is Mobile-Only</h2>
				<p class="text-muted-foreground mb-6">
					Please visit on your mobile device to install and start posting.
				</p>

			{:else if gateType === 'ios-manual'}
				<!-- iOS Manual Install Instructions -->
				<h2 class="text-2xl font-bold mb-4">📱 Install BingBong</h2>
				<p class="text-muted-foreground mb-6">
					Follow these steps to install BingBong on your iPhone:
				</p>
				<div class="text-left space-y-4 mb-8">
					{#each instructions as instruction, i}
						<div class="flex items-start gap-3">
							<div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
								style="background-color: rgba(1, 115, 92, 0.2); color: rgb(1, 115, 92); font-weight: bold;">
								{i + 1}
							</div>
							<p class="text-sm text-foreground">{instruction}</p>
						</div>
					{/each}
				</div>
				<div class="p-4 rounded-xl" style="background-color: rgba(1, 115, 92, 0.1); border: 1px solid rgba(1, 115, 92, 0.2);">
					<p class="text-xs text-muted-foreground">
						💡 The Share button is located at the bottom of Safari (the square with an arrow pointing up)
					</p>
				</div>

			{:else}
				<!-- Android/Chrome Install Prompt -->
				<h2 class="text-2xl font-bold mb-4">📱 Install to Continue</h2>
				<p class="text-muted-foreground mb-8">
					BingBong works best as an installed app. Tap the button below to install and get started.
				</p>

				<button
					onclick={handleInstall}
					disabled={isInstalling}
					class="w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
					style="background-color: #00933C; color: white;"
				>
					{#if isInstalling}
						<Loader2 size={24} class="animate-spin" />
						<span>Opening installer...</span>
					{:else}
						<span>Install BingBong</span>
					{/if}
				</button>

				<p class="text-xs text-muted-foreground mt-6">
					Free • Works offline • No account needed
				</p>
			{/if}
		</div>

		<!-- Branding footer -->
		<div class="text-center mt-6">
			<p class="text-xs text-muted-foreground">
				Anonymous • Location-based • NYC only
			</p>
		</div>
	</div>
</div>
