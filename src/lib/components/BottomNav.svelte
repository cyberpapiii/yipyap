<script lang="ts">
  import { Home, PlusCircle, Bell } from 'lucide-svelte'
  import { composeStore } from '$lib/stores/compose'
  export let active: 'home' | 'thread' | 'profile' = 'home'

  function openComposer() {
    composeStore.openModal()
  }
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
     style="padding-bottom: calc(env(safe-area-inset-bottom) / 2)">
  <div class="mx-auto max-w-md px-6 py-2 grid grid-cols-3 items-center">
    <a href="/" class="flex flex-col items-center gap-1 text-xs {active==='home' ? 'text-foreground' : 'text-muted-foreground'}">
      <Home size={20} />
      <span>Home</span>
    </a>
    <button class="flex flex-col items-center gap-1 text-xs text-foreground" aria-label="Compose" onclick={openComposer}>
      <PlusCircle size={22} />
      <span>Post</span>
    </button>
    <button class="flex flex-col items-center gap-1 text-xs text-muted-foreground" aria-label="Notifications" disabled>
      <Bell size={20} />
      <span>Alerts</span>
    </button>
  </div>
</nav>
