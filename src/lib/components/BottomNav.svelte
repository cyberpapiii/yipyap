<script lang="ts">
  import { composeStore } from '$lib/stores/compose'
  export let active: 'home' | 'thread' | 'profile' = 'home'

  function openComposer() {
    // Haptic feedback for compose button
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }
    composeStore.openModal()
  }

  function handleNavClick() {
    // Haptic feedback for navigation
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
     style="border-top: 1px solid rgba(107, 107, 107, 0.1); padding-bottom: env(safe-area-inset-bottom)">
  <div class="mx-auto flex h-12 max-w-md items-center justify-around px-8">
    <a
      href="/"
      aria-label="Home"
      class="flex h-full items-center justify-center transition-colors"
      style="color: {active === 'home' ? '#FFFFFF' : '#6B6B6B'}"
      onclick={handleNavClick}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M1.17645 9.80176C1.17645 8.53702 1.79093 7.35113 2.82419 6.62177L9.96032 1.5845C11.306 0.634576 13.104 0.634575 14.4497 1.5845L21.5859 6.62177C22.6191 7.35113 23.2336 8.53702 23.2336 9.80177V18.8135C23.2336 20.9632 21.4909 22.7059 19.3412 22.7059H5.06889C2.91916 22.7059 1.17645 20.9632 1.17645 18.8134V9.80176Z" fill="currentColor"/>
      </svg>
    </a>
    <button
      class="transition-all active:scale-95 overflow-visible"
      aria-label="Compose"
      onclick={openComposer}
    >
      <svg width="48" height="40" viewBox="-1 -1 82 68" fill="none" aria-hidden="true" class="overflow-visible">
        <rect x="0.5" y="0.5" width="79" height="65" rx="14.5" fill="#1E1E1E" stroke="#6B6B6B" stroke-opacity="0.5" stroke-width="1"/>
        <line x1="40" y1="18.8" x2="40" y2="45.2" stroke="#6B6B6B" stroke-width="3.6" stroke-linecap="round"/>
        <line x1="53.2" y1="31.9999" x2="26.8" y2="31.9999" stroke="#6B6B6B" stroke-width="3.6" stroke-linecap="round"/>
      </svg>
    </button>
    <button
      class="flex h-full items-center justify-center transition-colors"
      style="color: {active === 'profile' ? '#FFFFFF' : '#6B6B6B'}"
      aria-label="Notifications"
      disabled
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19.1493 8.70031V9.47474C19.1493 10.4043 19.4133 11.3129 19.9105 12.0862L21.1294 13.9816C22.2415 15.7131 21.3923 18.0661 19.4573 18.6128C14.4012 20.0447 9.04682 20.0447 3.9907 18.6128C2.05572 18.0661 1.20649 15.7131 2.31864 13.9816L3.53749 12.0862C4.03604 11.3065 4.3006 10.4002 4.29982 9.47474V8.70031C4.29982 4.44754 7.62415 1 11.724 1C15.8239 1 19.1493 4.44754 19.1493 8.70031Z" fill="currentColor"/>
        <path d="M6.49103 19.2002C6.85047 20.3048 7.55024 21.2673 8.49013 21.9498C9.43002 22.6324 10.5618 23 11.7234 23C12.885 23 14.0168 22.6324 14.9566 21.9498C15.8965 21.2673 16.5963 20.3048 16.9558 19.2002C13.4961 19.8493 9.95177 19.8493 6.49103 19.2002Z" fill="currentColor"/>
      </svg>
    </button>
  </div>
</nav>
