<script lang="ts">
	let { count }: { count: number } = $props()

	// Display text based on count
	const displayText = $derived(() => {
		if (count === 0) return ''
		if (count > 99) return '99+'
		return count.toString()
	})

	// Only show badge if count > 0
	const shouldShow = $derived(count > 0)
</script>

{#if shouldShow}
	<div class="notification-badge" role="status" aria-label="{count} unread notifications">
		<span class="badge-text">{displayText()}</span>
	</div>
{/if}

<style>
	.notification-badge {
		position: absolute;
		top: 2px;
		right: -8px;
		background-color: #FF6B6B;
		border: 2px solid #101010;
		border-radius: 50%;
		min-width: 18px;
		min-height: 18px;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		animation: fadeIn 0.2s ease-out;
		pointer-events: none;
		box-sizing: border-box;
	}

	.badge-text {
		color: #FFFFFF;
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
