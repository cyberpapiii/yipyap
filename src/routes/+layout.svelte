<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { supabase } from '$lib/supabase'
  import { realtime } from '$lib/stores/realtime'
  import { authStore } from '$lib/stores/auth'
  import { cacheAnonymousUser, getDeviceId, ensureAnonymousUser } from '$lib/auth'
  import type { AnonymousUser, GeographicCommunity } from '$lib/types'
  import { Toaster } from '$lib/components/ui'
  import BottomNav from '$lib/components/layout/BottomNav.svelte'
  import CommunityPicker from '$lib/components/community/CommunityPicker.svelte'
  import { composeStore, anonymousUser as currentUserStore, showComposeModal } from '$lib/stores'
  import { createRealtimeAPI } from '$lib/api/realtime'
  import { notificationsStore } from '$lib/stores/notifications'
  import { communityStore } from '$lib/stores/community'
  import { onboardingStore } from '$lib/stores/onboarding'
  import { isPWA, isDesktop, isIOSSafari, canInstallPWA, initPWAInstallListener } from '$lib/utils/pwa'
  import InstallGate from '$lib/components/onboarding/InstallGate.svelte'
  import QuickOnboarding from '$lib/components/onboarding/QuickOnboarding.svelte'

  const api = createRealtimeAPI(supabase as any)
  const cu = currentUserStore

  // Lazy load ComposeModal component
  let ComposeModal = $state<any>(null)

  // Load ComposeModal when needed
  $effect(() => {
    if ($showComposeModal && !ComposeModal) {
      import('$lib/components/compose/ComposeModal.svelte').then(module => {
        ComposeModal = module.default
      })
    }
  })

  // Determine active nav based on current route
  const activePage = $derived(
    $page.url.pathname === '/notifications' ? 'profile' :
    $page.url.pathname.startsWith('/thread') ? 'thread' :
    'home'
  )

  function handleSelectCommunity(community: any) {
    communityStore.selectCommunity(community)
  }

  function handleClosePicker() {
    communityStore.closePicker()
  }

  async function onSubmit(content: string, replyTo?: any, community?: GeographicCommunity) {
    let user = get(cu)
    if (!user) {
      try {
        user = await ensureAnonymousUser(supabase as any) || undefined
      } catch (error) {
        console.error('Failed to bootstrap anonymous user for submit', error)
      }
    }

    if (!user) {
      composeStore.setError('Unable to create anonymous identity. Please try again.')
      return
    }

    try {
      if (replyTo) {
        // Determine correct postId and parentCommentId based on reply type
        if (replyTo.type === 'comment') {
          // Replying to a comment: use comment's post_id and comment's id as parent
          await api.createCommentOptimistic({
            content,
            postId: replyTo.post_id,
            parentCommentId: replyTo.id
          }, user)
        } else {
          // Replying to a post: use post's id and no parent
          await api.createCommentOptimistic({
            content,
            postId: replyTo.id,
            parentCommentId: null
          }, user)
        }
      } else {
        await api.createPostOptimistic({ content, community }, user)
      }
    } catch (error: any) {
      // Check for foreign key violation (post was deleted)
      if (error?.code === '23503' && error?.details?.includes('post_id')) {
        throw new Error('This post has been deleted. Redirecting to home...')
      }
      // Re-throw other errors
      throw error
    }
  }

  onMount(async () => {
    try {
      // Initialize PWA install prompt listener
      initPWAInstallListener()

      // FIRST CHECK: Are we in PWA mode?
      const inPWA = isPWA()

      if (!inPWA) {
        // NOT IN PWA - Show install gate and block app
        console.log('[Onboarding] Not in PWA, showing install gate')

        if (isDesktop()) {
          onboardingStore.showGate('desktop-block')
          return // Don't initialize app
        }

        if (isIOSSafari()) {
          onboardingStore.showGate('ios-manual')
          return // Don't initialize app
        }

        // Mobile browser with install capability
        if (canInstallPWA()) {
          onboardingStore.showGate('prompt')
        } else {
          // Can't install for some reason, show iOS instructions as fallback
          onboardingStore.showGate('ios-manual')
        }
        return // Don't initialize app until installed
      }

      // IN PWA - Initialize app normally
      console.log('[Onboarding] In PWA mode, initializing app')

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

      // Initialize notifications store
      notificationsStore.initialize(supabase as any)

      // Fetch initial unread count
      await notificationsStore.fetchUnreadCount()

      // Subscribe to realtime notification updates
      notificationsStore.subscribeToRealtime()

      // Check location permission on app startup (don't await - runs in background)
      // This ensures the location toggle shows correct state when user navigates to profile
      communityStore.checkLocation().catch((err) => {
        console.warn('Failed to check location on app startup:', err)
      })

      // Show quick onboarding if not completed
      if (!onboardingStore.hasCompleted()) {
        console.log('[Onboarding] Starting quick onboarding')
        onboardingStore.startQuickOnboarding()
      }
    } catch (e) {
      console.error('App init failed:', e)
    }
  })
</script>

<header class="sticky top-0 z-90 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style="border-bottom: 1px solid rgba(107, 107, 107, 0.1);">
  <!-- Navigation layer: z-100-199 (header at z-90) -->
  <div class="mx-auto max-w-md px-4 h-12 flex items-center justify-center">
    <a href="/" class="flex items-center" aria-label="BingBong home">
      <svg width="188" height="19" viewBox="0 0 188 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="18.1957" height="18.1957" rx="9.09783" fill="#009952"/>
        <path d="M9.66272 13.5978H5.42249V4.24139H9.96741C11.1142 4.25832 11.9267 4.59052 12.4049 5.23798C12.6927 5.63576 12.8365 6.11184 12.8365 6.6662C12.8365 7.23749 12.6927 7.69663 12.4049 8.04364C12.2441 8.2383 12.0071 8.41604 11.694 8.57684C12.1722 8.75035 12.5319 9.02541 12.7731 9.40204C13.0185 9.77867 13.1412 10.2357 13.1412 10.7731C13.1412 11.3275 13.0016 11.8247 12.7223 12.2648C12.5446 12.5568 12.3224 12.8023 12.0558 13.0012C11.7553 13.2297 11.3999 13.3863 10.9894 13.4709C10.5831 13.5555 10.1409 13.5978 9.66272 13.5978ZM9.61829 9.47821H7.2887V11.9728H9.58655C9.99703 11.9728 10.3165 11.9178 10.545 11.8078C10.9598 11.6047 11.1671 11.2154 11.1671 10.6398C11.1671 10.1532 10.9661 9.81887 10.5641 9.6369C10.3398 9.53534 10.0245 9.48244 9.61829 9.47821ZM10.5895 7.69452C10.8434 7.54218 10.9703 7.26923 10.9703 6.87567C10.9703 6.4398 10.8011 6.15204 10.4625 6.01239C10.1705 5.91506 9.79814 5.86639 9.34534 5.86639H7.2887V7.92938H9.58655C9.99703 7.92938 10.3313 7.85109 10.5895 7.69452Z" fill="white"/>
        <rect x="24.1957" width="18.1957" height="18.1957" rx="9.09783" fill="#0062CF"/>
        <path d="M32.3223 4.24139H34.2646V13.5978H32.3223V4.24139Z" fill="white"/>
        <rect x="48.3914" width="18.1957" height="18.1957" rx="9.09783" fill="#F6BC26"/>
        <path d="M61.3485 13.5978H59.3934L55.5721 6.95184V13.5978H53.7504V4.24139H55.8007L59.5267 10.7731V4.24139H61.3485V13.5978Z" fill="black"/>
        <rect x="72.5869" width="18.1957" height="18.1957" rx="9.09783" fill="#EB6800"/>
        <path d="M83.3541 13.3693C82.8378 13.6867 82.2031 13.8454 81.4498 13.8454C80.2099 13.8454 79.1943 13.4159 78.403 12.5568C77.5778 11.6935 77.1652 10.5129 77.1652 9.01483C77.1652 7.49986 77.582 6.28534 78.4156 5.37128C79.2493 4.45721 80.3517 4.00018 81.7228 4.00018C82.9119 4.00018 83.8662 4.30275 84.5856 4.9079C85.3092 5.50881 85.7239 6.25995 85.8297 7.16132H83.9064C83.7583 6.52232 83.3964 6.07587 82.8209 5.82196C82.4993 5.68231 82.1417 5.61249 81.7482 5.61249C80.9949 5.61249 80.375 5.89813 79.8883 6.46942C79.4059 7.03648 79.1647 7.8913 79.1647 9.03387C79.1647 10.1849 79.427 10.9995 79.9518 11.4777C80.4765 11.9559 81.0732 12.195 81.7418 12.195C82.3977 12.195 82.9352 12.0067 83.3541 11.6301C83.7731 11.2492 84.0312 10.752 84.1285 10.1384H81.964V8.57684H85.8615V13.5978H84.5665L84.3698 12.4299C83.9931 12.8742 83.6546 13.1874 83.3541 13.3693Z" fill="white"/>
        <rect x="96.7826" width="18.1957" height="18.1957" rx="9.09783" fill="#D82233"/>
        <path d="M106.445 13.5978H102.205V4.24139H106.75C107.897 4.25832 108.709 4.59052 109.188 5.23798C109.475 5.63576 109.619 6.11184 109.619 6.6662C109.619 7.23749 109.475 7.69663 109.188 8.04364C109.027 8.2383 108.79 8.41604 108.477 8.57684C108.955 8.75035 109.314 9.02541 109.556 9.40204C109.801 9.77867 109.924 10.2357 109.924 10.7731C109.924 11.3275 109.784 11.8247 109.505 12.2648C109.327 12.5568 109.105 12.8023 108.838 13.0012C108.538 13.2297 108.182 13.3863 107.772 13.4709C107.366 13.5555 106.924 13.5978 106.445 13.5978ZM106.401 9.47821H104.071V11.9728H106.369C106.78 11.9728 107.099 11.9178 107.328 11.8078C107.742 11.6047 107.95 11.2154 107.95 10.6398C107.95 10.1532 107.749 9.81887 107.347 9.6369C107.122 9.53534 106.807 9.48244 106.401 9.47821ZM107.372 7.69452C107.626 7.54218 107.753 7.26923 107.753 6.87567C107.753 6.4398 107.584 6.15204 107.245 6.01239C106.953 5.91506 106.581 5.86639 106.128 5.86639H104.071V7.92938H106.369C106.78 7.92938 107.114 7.85109 107.372 7.69452Z" fill="white"/>
        <rect x="120.978" width="18.1957" height="18.1957" rx="9.09783" fill="#7C858C"/>
        <path d="M130.146 13.8581C128.809 13.8581 127.787 13.4942 127.08 12.7663C126.132 11.8734 125.658 10.5869 125.658 8.90692C125.658 7.19305 126.132 5.9066 127.08 5.04755C127.787 4.31968 128.809 3.95575 130.146 3.95575C131.483 3.95575 132.505 4.31968 133.212 5.04755C134.155 5.9066 134.627 7.19305 134.627 8.90692C134.627 10.5869 134.155 11.8734 133.212 12.7663C132.505 13.4942 131.483 13.8581 130.146 13.8581ZM131.993 11.3444C132.446 10.7731 132.672 9.96063 132.672 8.90692C132.672 7.85744 132.444 7.04706 131.987 6.47577C131.534 5.90025 130.92 5.61249 130.146 5.61249C129.371 5.61249 128.754 5.89813 128.292 6.46942C127.831 7.04071 127.6 7.85321 127.6 8.90692C127.6 9.96063 127.831 10.7731 128.292 11.3444C128.754 11.9157 129.371 12.2014 130.146 12.2014C130.92 12.2014 131.536 11.9157 131.993 11.3444Z" fill="white"/>
        <rect x="145.174" width="18.1957" height="18.1957" rx="9.09783" fill="#9A38A1"/>
        <path d="M158.131 13.5978H156.176L152.355 6.95184V13.5978H150.533V4.24139H152.583L156.309 10.7731V4.24139H158.131V13.5978Z" fill="white"/>
        <rect x="169.37" width="18.1957" height="18.1957" rx="9.09783" fill="#799534"/>
        <path d="M180.137 13.3693C179.62 13.6867 178.986 13.8454 178.232 13.8454C176.993 13.8454 175.977 13.4159 175.186 12.5568C174.36 11.6935 173.948 10.5129 173.948 9.01483C173.948 7.49986 174.365 6.28534 175.198 5.37128C176.032 4.45721 177.134 4.00018 178.505 4.00018C179.694 4.00018 180.649 4.30275 181.368 4.9079C182.092 5.50881 182.507 6.25995 182.612 7.16132H180.689C180.541 6.52232 180.179 6.07587 179.604 5.82196C179.282 5.68231 178.924 5.61249 178.531 5.61249C177.778 5.61249 177.158 5.89813 176.671 6.46942C176.188 7.03648 175.947 7.8913 175.947 9.03387C175.947 10.1849 176.21 10.9995 176.734 11.4777C177.259 11.9559 177.856 12.195 178.524 12.195C179.18 12.195 179.718 12.0067 180.137 11.6301C180.556 11.2492 180.814 10.752 180.911 10.1384H178.747V8.57684H182.644V13.5978H181.349L181.152 12.4299C180.776 12.8742 180.437 13.1874 180.137 13.3693Z" fill="white"/>
      </svg>
    </a>
  </div>
</header>

<Toaster position="top-center" />

<main class="min-h-screen pb-24" style="padding-bottom: calc(env(safe-area-inset-bottom) + 6rem)">
  <slot />
  <div class="h-24"></div>
</main>

<!-- Gradient overlay above bottom nav - Page elements layer: z-1-99 -->
<div class="fixed bottom-0 left-0 right-0 h-48 pointer-events-none z-40"
     style="background: linear-gradient(to top, rgba(16, 16, 16, 1) 0%, rgba(16, 16, 16, 0.8) 40%, transparent 100%); padding-bottom: env(safe-area-inset-bottom)">
</div>

<BottomNav active={activePage} />

{#if ComposeModal}
  <svelte:component this={ComposeModal} {onSubmit} />
{/if}

<!-- Community Picker Modal - rendered at root level -->
<CommunityPicker
  isOpen={$communityStore.isPickerOpen}
  selectedCommunity={$communityStore.selectedCommunity}
  onSelect={handleSelectCommunity}
  onClose={handleClosePicker}
/>

<!-- Install Gate - highest z-index, blocks app if not in PWA -->
{#if $onboardingStore.showInstallGate && $onboardingStore.installGateType}
  <InstallGate gateType={$onboardingStore.installGateType} />
{/if}

<!-- Quick Onboarding - shows after PWA install -->
{#if $onboardingStore.showQuickOnboarding}
  <QuickOnboarding />
{/if}
