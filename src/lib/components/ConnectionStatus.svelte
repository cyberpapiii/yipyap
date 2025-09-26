<script lang="ts">
	import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-svelte'
	import { realtimeStatus, realtime } from '$lib/stores'

	let showDetails = $state(false)

	const statusConfig = {
		connected: {
			icon: Wifi,
			text: 'Connected',
			color: 'text-green-500',
			bgColor: 'bg-green-500/10',
			borderColor: 'border-green-500/20'
		},
		connecting: {
			icon: Loader2,
			text: 'Connecting',
			color: 'text-yellow-500',
			bgColor: 'bg-yellow-500/10',
			borderColor: 'border-yellow-500/20'
		},
		disconnected: {
			icon: WifiOff,
			text: 'Disconnected',
			color: 'text-gray-500',
			bgColor: 'bg-gray-500/10',
			borderColor: 'border-gray-500/20'
		},
		error: {
			icon: AlertTriangle,
			text: 'Error',
			color: 'text-red-500',
			bgColor: 'bg-red-500/10',
			borderColor: 'border-red-500/20'
		}
	}

	const config = $derived(statusConfig[$realtimeStatus])
	const IconComponent = $derived(config.icon)

	async function handleReconnect() {
		try {
			await realtime.reconnect()
		} catch (error) {
			console.error('Manual reconnection failed:', error)
		}
	}

	function toggleDetails() {
		showDetails = !showDetails
	}
</script>

<!-- Connection status indicator -->
<div class="fixed bottom-20 right-4 z-50">
	<div class="relative">
		<!-- Main status indicator -->
		<button
			class="
				flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md
				border transition-all duration-200 ease-out
				hover:scale-105 active:scale-95
				{config.bgColor} {config.borderColor}
				shadow-lg
			"
			onclick={toggleDetails}
			aria-label="Connection status: {config.text}"
		>
			<div class="{config.color}">
				{#if $realtimeStatus === 'connecting'}
					<IconComponent size={16} class="animate-spin" />
				{:else}
					<IconComponent size={16} />
				{/if}
			</div>
			<span class="text-xs font-medium {config.color}">
				{config.text}
			</span>
		</button>

		<!-- Details panel -->
		{#if showDetails}
			<div
				class="
					absolute bottom-full right-0 mb-2 w-64
					bg-card border border-line rounded-lg p-3
					backdrop-blur-md shadow-xl
					animate-fade-in
				"
			>
				<div class="text-sm space-y-2">
					<div class="flex items-center justify-between">
						<span class="font-medium">Real-time Status</span>
						<span class="{config.color} text-xs">
							{config.text}
						</span>
					</div>

					<div class="text-xs text-muted-foreground space-y-1">
						<div>Live updates for posts and votes</div>
						{#if $realtimeStatus === 'connected'}
							<div class="text-green-600">✓ Receiving real-time updates</div>
						{:else if $realtimeStatus === 'connecting'}
							<div class="text-yellow-600">⏳ Establishing connection...</div>
						{:else if $realtimeStatus === 'disconnected'}
							<div class="text-gray-600">⭕ Not connected</div>
						{:else if $realtimeStatus === 'error'}
							<div class="text-red-600">❌ Connection failed</div>
						{/if}
					</div>

					{#if $realtimeStatus === 'disconnected' || $realtimeStatus === 'error'}
					<button
						class="
								w-full mt-3 px-3 py-1.5
								bg-primary text-primary-foreground
								rounded text-xs font-medium
								hover:bg-primary/90 transition-colors
							"
						onclick={handleReconnect}
						>
							Reconnect
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Click outside to close details -->
{#if showDetails}
	<div
		class="fixed inset-0 z-40"
		onclick={() => (showDetails = false)}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault()
				showDetails = false
			}
		}}
		role="button"
		tabindex="0"
		aria-label="Close connection status details"
	></div>
{/if}
