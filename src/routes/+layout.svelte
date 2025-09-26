<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import { realtime } from '$lib/stores/realtime'
  import { authStore } from '$lib/stores/auth'
  import { cacheAnonymousUser, getDeviceId } from '$lib/auth'
  import type { AnonymousUser } from '$lib/types'
  import { Toaster, Button } from '$lib/components/ui'
  import BottomNav from '$lib/components/BottomNav.svelte'

  let theme: 'light' | 'dark' = 'dark'

  function applyTheme(t: 'light' | 'dark') {
    theme = t
    const root = document.documentElement
    if (t === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('yipyap_theme', t)
  }

  function toggleTheme() {
    applyTheme(theme === 'light' ? 'dark' : 'light')
  }

  onMount(async () => {
    try {
      // Theme restore
      const savedTheme = (localStorage.getItem('yipyap_theme') as 'light' | 'dark') || 'dark'
      applyTheme(savedTheme)

      // Initialize anonymous user via helper RPC
      const deviceId = getDeviceId()
      if (!deviceId) {
        console.warn('Device ID could not be generated. Supabase auth bootstrap skipped.')
      } else {
        authStore.setDeviceId(deviceId)
        const { data: user, error } = await (supabase as any).rpc('get_or_create_user', {
          device_id_param: deviceId
        })

        if (error) {
          console.error('Failed to bootstrap anonymous user', error)
        } else if (user) {
          cacheAnonymousUser(user as AnonymousUser)
          authStore.setUser(user as AnonymousUser)
        }
      }

      // Initialize realtime system
      await realtime.initialize(supabase as any)
    } catch (e) {
      console.error('App init failed:', e)
    }
  })
</script>

<header class="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="mx-auto max-w-md px-4 h-12 flex items-center justify-center">
    <a href="/" class="text-2xl font-bold tracking-tight">YipYap</a>
  </div>
  <Toaster />
</header>

<main class="min-h-screen pb-24" style="padding-bottom: calc(env(safe-area-inset-bottom) + 6rem)">
  <slot />
  <div class="h-24"></div>
</main>

<BottomNav active="home" />
