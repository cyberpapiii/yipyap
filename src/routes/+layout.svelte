<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import { realtime } from '$lib/stores/realtime'
  import { authStore } from '$lib/stores/auth'
  import { cacheAnonymousUser, getDeviceId } from '$lib/auth'
  import type { AnonymousUser } from '$lib/types'
  import { Toaster } from '$lib/components/ui'
  import BottomNav from '$lib/components/BottomNav.svelte'

  onMount(async () => {
    try {
      // Force dark theme always
      const root = document.documentElement
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')

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

<header class="sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style="border-bottom: 1px solid rgba(107, 107, 107, 0.1);">
  <div class="mx-auto max-w-md px-4 h-12 flex items-center justify-center">
    <a href="/" class="flex items-center">
      <svg width="180" height="25" viewBox="0 0 140 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="18.1957" height="18.1957" rx="9.09783" fill="#D82233"/>
        <path d="M13.3063 4.24139L10.1769 10.0812V13.5978H8.22186V10.0812L4.98456 4.24139H7.28876L9.23114 8.31659L11.091 4.24139H13.3063Z" fill="white"/>
        <rect x="24.2609" width="18.1957" height="18.1957" rx="9.09783" fill="#0062CF"/>
        <path d="M32.3875 4.24139H34.3299V13.5978H32.3875V4.24139Z" fill="white"/>
        <rect x="48.5217" width="18.1957" height="18.1957" rx="9.09783" fill="#F6BC26"/>
        <path d="M58.248 10.2336H56.2612V13.5978H54.3188V4.24139H58.394C59.3334 4.24139 60.0825 4.4826 60.6411 4.96503C61.1996 5.44745 61.4789 6.19436 61.4789 7.20575C61.4789 8.31024 61.1996 9.091 60.6411 9.54803C60.0825 10.0051 59.2848 10.2336 58.248 10.2336ZM59.162 8.28485C59.416 8.06057 59.5429 7.7051 59.5429 7.21844C59.5429 6.73179 59.4138 6.38479 59.1557 6.17743C58.9018 5.97007 58.5442 5.86639 58.0829 5.86639H56.2612V8.62128H58.0829C58.5442 8.62128 58.9039 8.50913 59.162 8.28485Z" fill="white"/>
        <rect x="72.7826" width="18.1957" height="18.1957" rx="9.09783" fill="#009952"/>
        <path d="M86.0889 4.24139L82.9595 10.0812V13.5978H81.0045V10.0812L77.7672 4.24139H80.0714L82.0137 8.31659L83.8736 4.24139H86.0889Z" fill="white"/>
        <rect x="97.0435" width="18.1957" height="18.1957" rx="9.09783" fill="#EB6800"/>
        <path d="M107.912 11.6745H104.466L103.818 13.5978H101.774L105.113 4.24139H107.322L110.635 13.5978H108.515L107.912 11.6745ZM107.366 10.0622L106.198 6.38055L104.992 10.0622H107.366Z" fill="white"/>
        <rect x="121.304" width="18.1957" height="18.1957" rx="9.09783" fill="#8E5C33"/>
        <path d="M131.031 10.2336H129.044V13.5978H127.101V4.24139H131.177C132.116 4.24139 132.865 4.4826 133.424 4.96503C133.982 5.44745 134.262 6.19436 134.262 7.20575C134.262 8.31024 133.982 9.091 133.424 9.54803C132.865 10.0051 132.067 10.2336 131.031 10.2336ZM131.945 8.28485C132.199 8.06057 132.326 7.7051 132.326 7.21844C132.326 6.73179 132.196 6.38479 131.938 6.17743C131.684 5.97007 131.327 5.86639 130.866 5.86639H129.044V8.62128H130.866C131.327 8.62128 131.687 8.50913 131.945 8.28485Z" fill="white"/>
      </svg>
    </a>
  </div>
  <Toaster />
</header>

<main class="min-h-screen pb-24" style="padding-bottom: calc(env(safe-area-inset-bottom) + 6rem)">
  <slot />
  <div class="h-24"></div>
</main>

<!-- Gradient overlay above bottom nav -->
<div class="fixed bottom-0 left-0 right-0 h-48 pointer-events-none z-20"
     style="background: linear-gradient(to top, rgba(16, 16, 16, 1) 0%, rgba(16, 16, 16, 0.8) 40%, transparent 100%); padding-bottom: env(safe-area-inset-bottom)">
</div>

<BottomNav active="home" />
