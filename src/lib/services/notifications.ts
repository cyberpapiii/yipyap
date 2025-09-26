import { writable } from 'svelte/store'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number // in milliseconds, 0 for persistent
  action?: {
    label: string
    handler: () => void
  }
}

// Notification store
const { subscribe, update } = writable<Notification[]>([])

// Auto-remove timeout handlers
const timeoutHandlers = new Map<string, NodeJS.Timeout>()

export const notifications = {
  subscribe,

  // Add a notification
  add: (notification: Omit<Notification, 'id'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullNotification: Notification = {
      id,
      duration: 5000, // Default 5 seconds
      ...notification
    }

    update(items => [...items, fullNotification])

    // Auto-remove after duration (unless duration is 0)
    if (fullNotification.duration && fullNotification.duration > 0) {
      const timeout = setTimeout(() => {
        notifications.remove(id)
      }, fullNotification.duration)

      timeoutHandlers.set(id, timeout)
    }

    return id
  },

  // Remove a notification
  remove: (id: string) => {
    // Clear timeout if exists
    const timeout = timeoutHandlers.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutHandlers.delete(id)
    }

    update(items => items.filter(item => item.id !== id))
  },

  // Clear all notifications
  clear: () => {
    // Clear all timeouts
    for (const [id, timeout] of timeoutHandlers) {
      clearTimeout(timeout)
    }
    timeoutHandlers.clear()

    update(() => [])
  },

  // Convenience methods for different types
  success: (title: string, message?: string, options?: Partial<Notification>) =>
    notifications.add({ type: 'success', title, message, ...options }),

  error: (title: string, message?: string, options?: Partial<Notification>) =>
    notifications.add({ type: 'error', title, message, duration: 8000, ...options }),

  warning: (title: string, message?: string, options?: Partial<Notification>) =>
    notifications.add({ type: 'warning', title, message, ...options }),

  info: (title: string, message?: string, options?: Partial<Notification>) =>
    notifications.add({ type: 'info', title, message, ...options })
}

// Export for voting service integration
export const voteNotifications = {
  voteFailed: (error: string) => {
    notifications.error(
      'Vote Failed',
      `Your vote could not be saved: ${error}`,
      {
        duration: 6000,
        action: {
          label: 'Retry',
          handler: () => {
            // Could emit a retry event here
            console.log('Vote retry requested')
          }
        }
      }
    )
  },

  voteSuccess: (voteType: 'up' | 'down', itemType: 'post' | 'comment') => {
    const action = voteType === 'up' ? 'upvoted' : 'downvoted'
    notifications.success(
      `${itemType === 'post' ? 'Post' : 'Comment'} ${action}`,
      undefined,
      { duration: 2000 }
    )
  },

  networkError: () => {
    notifications.error(
      'Connection Issue',
      'Please check your internet connection and try again',
      {
        duration: 8000,
        action: {
          label: 'Retry',
          handler: () => {
            window.location.reload()
          }
        }
      }
    )
  }
}