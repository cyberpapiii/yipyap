import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_VAPID_KEY } from '$env/static/public'

export interface PushSubscription {
  id?: string
  user_id: string
  device_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
  user_agent?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface PushNotificationStatus {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
  isIOSPWA: boolean
  canSubscribe: boolean
  serviceWorkerActive: boolean
}

/**
 * Check if device is iOS in PWA standalone mode
 */
export function isIOSPWA(): boolean {
  if (typeof window === 'undefined') return false

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isStandalone =
    'standalone' in (window.navigator as any) &&
    (window.navigator as any).standalone === true

  return isIOS && isStandalone
}

/**
 * Check if iOS Safari (not in standalone mode)
 */
export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isStandalone =
    'standalone' in (window.navigator as any) &&
    (window.navigator as any).standalone === true

  return isIOS && !isStandalone
}

/**
 * Check if browser supports push notifications
 */
export function canUsePushNotifications(): boolean {
  if (typeof window === 'undefined') return false

  // Check if service worker is supported
  if (!('serviceWorker' in navigator)) return false

  // Check if push manager is supported
  if (!('PushManager' in window)) return false

  // Check if notifications are supported
  if (!('Notification' in window)) return false

  // iOS only supports push in PWA standalone mode
  if (isIOSSafari()) return false

  return true
}

/**
 * Get current push notification status
 */
export async function getPushSubscriptionStatus(): Promise<PushNotificationStatus> {
  const status: PushNotificationStatus = {
    supported: canUsePushNotifications(),
    permission: 'default' as NotificationPermission,
    subscribed: false,
    isIOSPWA: isIOSPWA(),
    canSubscribe: false,
    serviceWorkerActive: false
  }

  if (!status.supported) {
    return status
  }

  // Check notification permission
  status.permission = Notification.permission

  // Check if service worker is active
  const registration = await navigator.serviceWorker.getRegistration()
  status.serviceWorkerActive = !!registration?.active

  if (!status.serviceWorkerActive) {
    return status
  }

  // Check if already subscribed
  try {
    const subscription = await registration.pushManager.getSubscription()
    status.subscribed = !!subscription
    status.canSubscribe = !status.subscribed && status.permission !== 'denied'
  } catch (error) {
    console.error('[PushNotifications] Error checking subscription:', error)
  }

  return status
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Request notification permission and subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string
): Promise<{ success: boolean; error?: string; subscription?: PushSubscription }> {
  // Check if push notifications are supported
  if (!canUsePushNotifications()) {
    return {
      success: false,
      error: isIOSSafari()
        ? 'Push notifications require adding BingBong to your Home Screen on iOS'
        : 'Push notifications are not supported on this device'
    }
  }

  // Request notification permission
  let permission: NotificationPermission
  try {
    permission = await Notification.requestPermission()
  } catch (error) {
    console.error('[PushNotifications] Error requesting permission:', error)
    return {
      success: false,
      error: 'Failed to request notification permission'
    }
  }

  if (permission !== 'granted') {
    return {
      success: false,
      error: 'Notification permission denied'
    }
  }

  // Get service worker registration
  let registration: ServiceWorkerRegistration
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) {
      return {
        success: false,
        error: 'Service worker not registered'
      }
    }
    registration = reg
  } catch (error) {
    console.error('[PushNotifications] Error getting service worker:', error)
    return {
      success: false,
      error: 'Service worker not available'
    }
  }

  // Check if already subscribed
  try {
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      // Already subscribed - save to database
      const pushSub = convertSubscriptionToDbFormat(
        existingSubscription,
        userId,
        deviceId
      )
      await savePushSubscription(supabase, pushSub)
      return {
        success: true,
        subscription: pushSub
      }
    }
  } catch (error) {
    console.error('[PushNotifications] Error checking existing subscription:', error)
  }

  // Subscribe to push notifications
  try {
    const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    })

    const pushSub = convertSubscriptionToDbFormat(subscription, userId, deviceId)

    // Save subscription to database
    await savePushSubscription(supabase, pushSub)

    console.log('[PushNotifications] Successfully subscribed to push notifications')
    return {
      success: true,
      subscription: pushSub
    }
  } catch (error) {
    console.error('[PushNotifications] Error subscribing to push:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe to push notifications'
    }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return { success: false, error: 'Service worker not registered' }
    }

    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }

    // Remove from database
    await removePushSubscription(supabase, userId, deviceId)

    console.log('[PushNotifications] Successfully unsubscribed from push notifications')
    return { success: true }
  } catch (error) {
    console.error('[PushNotifications] Error unsubscribing from push:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unsubscribe'
    }
  }
}

/**
 * Convert browser PushSubscription to database format
 */
function convertSubscriptionToDbFormat(
  subscription: globalThis.PushSubscription,
  userId: string,
  deviceId: string
): PushSubscription {
  const keys = subscription.toJSON().keys as { p256dh: string; auth: string }

  return {
    user_id: userId,
    device_id: deviceId,
    endpoint: subscription.endpoint,
    keys_p256dh: keys.p256dh,
    keys_auth: keys.auth,
    user_agent: navigator.userAgent,
    enabled: true
  }
}

/**
 * Save push subscription to database via RPC
 */
async function savePushSubscription(
  supabase: SupabaseClient,
  subscription: PushSubscription
): Promise<void> {
  const { error } = await supabase.rpc('rpc_save_push_subscription', {
    p_user: subscription.user_id,
    p_device_id: subscription.device_id,
    p_endpoint: subscription.endpoint,
    p_keys_p256dh: subscription.keys_p256dh,
    p_keys_auth: subscription.keys_auth,
    p_user_agent: subscription.user_agent || null
  })

  if (error) {
    console.error('[PushNotifications] Error saving subscription to database:', error)
    throw error
  }
}

/**
 * Remove push subscription from database via RPC
 */
async function removePushSubscription(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string
): Promise<void> {
  const { error } = await supabase.rpc('rpc_remove_push_subscription', {
    p_user: userId,
    p_device_id: deviceId
  })

  if (error) {
    console.error('[PushNotifications] Error removing subscription from database:', error)
    throw error
  }
}

/**
 * Test push notification (send a test notification to yourself)
 */
export async function sendTestNotification(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('rpc_send_test_push', {
      p_user: userId
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('[PushNotifications] Error sending test notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send test notification'
    }
  }
}
