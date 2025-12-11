import { browser } from '$app/environment'

/**
 * PWA detection and installation utilities
 */

// Store the beforeinstallprompt event globally
let deferredPrompt: any = null

/**
 * Check if app is running as an installed PWA
 */
export function isPWA(): boolean {
  if (!browser) return false

  // Check if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  // iOS Safari specific check
  const isIOSStandalone = (window.navigator as any).standalone === true

  return isStandalone || isIOSStandalone
}

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
  if (!browser) return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/**
 * Check if device is desktop
 */
export function isDesktop(): boolean {
  return !isMobile()
}

/**
 * Check if device is iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (!browser) return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Check if browser is iOS Safari (not in standalone mode)
 */
export function isIOSSafari(): boolean {
  if (!browser) return false
  return isIOS() && !isPWA()
}

/**
 * Check if browser is Android Chrome
 */
export function isAndroidChrome(): boolean {
  if (!browser) return false
  return /Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent)
}

/**
 * Initialize PWA install prompt listener
 * Call this once on app load
 */
export function initPWAInstallListener(): void {
  if (!browser) return

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault()
    // Stash the event so it can be triggered later
    deferredPrompt = e
  })

  // Listen for successful app install
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
  })
}

/**
 * Check if PWA can be installed (prompt is available)
 */
export function canInstallPWA(): boolean {
  if (!browser) return false

  // If we already captured the beforeinstallprompt event
  if (deferredPrompt) return true

  // On iOS, installation is always "available" via manual steps
  if (isIOSSafari()) return true

  // On Android Chrome, we need to wait for the event
  if (isAndroidChrome()) return Boolean(deferredPrompt)

  return false
}

/**
 * Prompt user to install the PWA
 * Returns promise that resolves when user makes a choice
 */
export async function promptInstall(): Promise<'installed' | 'dismissed' | 'unavailable'> {
  if (!browser) return 'unavailable'

  // iOS doesn't support programmatic install, must use manual instructions
  if (isIOSSafari()) {
    return 'unavailable' // Caller should show manual instructions instead
  }

  // Check if we have the install prompt
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available')
    return 'unavailable'
  }

  try {
    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice

    // Clear the deferred prompt
    deferredPrompt = null

    return outcome === 'accepted' ? 'installed' : 'dismissed'
  } catch (error) {
    console.error('[PWA] Error showing install prompt:', error)
    return 'unavailable'
  }
}

/**
 * Get install instructions for the current platform
 */
export function getInstallInstructions(): string[] {
  if (isIOSSafari()) {
    return [
      'Tap the Share button',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" to install'
    ]
  }

  if (isAndroidChrome()) {
    return [
      'Tap "Install" when prompted',
      'Or tap menu (⋮) → "Install app"'
    ]
  }

  return ['Installation not available on this device']
}
