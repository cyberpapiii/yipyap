import { writable, derived, get } from 'svelte/store'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database, Notification, NotificationState } from '$lib/types'
import { currentUser } from './auth'

// Create notifications store
function createNotificationsStore() {
	const { subscribe, set, update } = writable<NotificationState>({
		notifications: [],
		unreadCount: 0,
		loading: false,
		error: null,
		hasMore: true,
		cursor: null // Used as offset for pagination
	})

	let supabaseClient: SupabaseClient<Database> | null = null
	let realtimeChannel: RealtimeChannel | null = null

	return {
		subscribe,

		// Initialize the store with Supabase client
		initialize(supabase: SupabaseClient<Database>) {
			supabaseClient = supabase
		},

		// Fetch notifications with pagination (offset-based)
		async fetchNotifications(offset = 0, limit = 20, unreadOnly = false) {
			const user = get(currentUser)
			if (!user || !supabaseClient) {
				update(state => ({ ...state, error: 'User not authenticated' }))
				return
			}

			update(state => ({ ...state, loading: true, error: null }))

			try {
				const { data, error } = await supabaseClient.rpc('rpc_get_notifications' as any, {
					p_user: user.id,
					p_limit: limit,
					p_offset: offset,
					p_unread_only: unreadOnly
				})

				if (error) {
					console.error('Error fetching notifications:', error)
					update(state => ({
						...state,
						loading: false,
						error: 'Failed to load notifications'
					}))
					return
				}

				const notifications = (data || []) as Notification[]
				const hasMore = notifications.length === limit

				if (offset === 0) {
					// Initial load - replace all
					set({
						notifications,
						unreadCount: get({ subscribe }).unreadCount,
						loading: false,
						error: null,
						hasMore,
						cursor: null
					})
				} else {
					// Pagination - append
					update(state => ({
						...state,
						notifications: [...state.notifications, ...notifications],
						loading: false,
						error: null,
						hasMore,
						cursor: null
					}))
				}
			} catch (err) {
				console.error('Error fetching notifications:', err)
				update(state => ({
					...state,
					loading: false,
					error: 'An unexpected error occurred'
				}))
			}
		},

		// Fetch unread count
		async fetchUnreadCount() {
			const user = get(currentUser)
			if (!user || !supabaseClient) {
				return
			}

			try {
				const { data, error } = await supabaseClient.rpc('rpc_get_unread_count' as any, {
					p_user: user.id
				})

				if (error) {
					console.error('Error fetching unread count:', error)
					return
				}

				update(state => ({
					...state,
					unreadCount: (data as number) || 0
				}))
			} catch (err) {
				console.error('Error fetching unread count:', err)
			}
		},

		// Mark a notification as read (optimistic update)
		async markAsRead(notificationId: string) {
			const user = get(currentUser)
			if (!user || !supabaseClient) {
				return
			}

			// Optimistic update
			const currentState = get({ subscribe })
			const notification = currentState.notifications.find(n => n.id === notificationId)

			if (!notification || notification.read_at) {
				// Already read or not found
				return
			}

			const now = new Date().toISOString()

			// Update UI immediately
			update(state => ({
				...state,
				notifications: state.notifications.map(n =>
					n.id === notificationId
						? { ...n, read: true, read_at: now }
						: n
				),
				unreadCount: Math.max(0, state.unreadCount - 1)
			}))

			try {
				const { error } = await supabaseClient.rpc('rpc_mark_notification_read' as any, {
					p_user: user.id,
					p_notification: notificationId
				})

				if (error) {
					console.error('Error marking notification as read:', error)
					// Rollback on error
					update(state => ({
						...state,
						notifications: state.notifications.map(n =>
							n.id === notificationId
								? { ...n, read: false, read_at: null }
								: n
						),
						unreadCount: state.unreadCount + 1,
						error: 'Failed to mark notification as read'
					}))
				}
			} catch (err) {
				console.error('Error marking notification as read:', err)
				// Rollback on error
				update(state => ({
					...state,
					notifications: state.notifications.map(n =>
						n.id === notificationId
							? { ...n, read: false, read_at: null }
							: n
					),
					unreadCount: state.unreadCount + 1,
					error: 'Failed to mark notification as read'
				}))
			}
		},

		// Mark all notifications as read
		async markAllAsRead() {
			const user = get(currentUser)
			if (!user || !supabaseClient) {
				return
			}

			// Store previous state for rollback
			const previousState = get({ subscribe })
			const now = new Date().toISOString()

			// Optimistic update
			update(state => ({
				...state,
				notifications: state.notifications.map(n => ({
					...n,
					read: true,
					read_at: n.read_at || now
				})),
				unreadCount: 0
			}))

			try {
				const { error } = await supabaseClient.rpc('rpc_mark_all_notifications_read' as any, {
					p_user: user.id
				})

				if (error) {
					console.error('Error marking all notifications as read:', error)
					// Rollback on error
					set(previousState)
				}
			} catch (err) {
				console.error('Error marking all notifications as read:', err)
				// Rollback on error
				set(previousState)
			}
		},

		// Delete a notification
		async deleteNotification(notificationId: string) {
			const user = get(currentUser)
			if (!user || !supabaseClient) {
				return
			}

			// Store for rollback
			const previousState = get({ subscribe })
			const notification = previousState.notifications.find(n => n.id === notificationId)

			if (!notification) {
				return
			}

			// Optimistic update
			update(state => ({
				...state,
				notifications: state.notifications.filter(n => n.id !== notificationId),
				unreadCount: notification.read
					? state.unreadCount
					: Math.max(0, state.unreadCount - 1)
			}))

			try {
				const { error } = await supabaseClient.rpc('rpc_delete_notification' as any, {
					p_user: user.id,
					p_notification: notificationId
				})

				if (error) {
					console.error('Error deleting notification:', error)
					// Rollback on error
					set(previousState)
				}
			} catch (err) {
				console.error('Error deleting notification:', err)
				// Rollback on error
				set(previousState)
			}
		},

		// Subscribe to realtime updates
		subscribeToRealtime() {
			const user = get(currentUser)
			if (!user || !supabaseClient || realtimeChannel) {
				// Already subscribed or not ready
				return
			}

			realtimeChannel = supabaseClient
				.channel('notifications')
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'notifications',
						filter: `user_id=eq.${user.id}`
					},
					async (payload) => {
						// Fetch full notification with denormalized data via RPC
						// The INSERT payload includes basic fields but we want consistent data
						try {
							const { data } = await supabaseClient.rpc('rpc_get_notifications' as any, {
								p_user: user.id,
								p_limit: 1,
								p_offset: 0,
								p_unread_only: false
							})

							if (data && data.length > 0) {
								const newNotification = data[0] as Notification

								// Add to top of list
								update(state => ({
									...state,
									notifications: [newNotification, ...state.notifications],
									unreadCount: state.unreadCount + 1
								}))

								// Optional: Show browser notification if permission granted
								if (typeof window !== 'undefined' && 'Notification' in window) {
									if (Notification.permission === 'granted') {
										// Generate title and body based on notification type
										let title = 'New notification'
										let body = newNotification.preview_content || ''

										if (newNotification.type === 'reply_to_post') {
											title = `${newNotification.actor_subway_line} replied to your post`
										} else if (newNotification.type === 'reply_to_comment') {
											title = `${newNotification.actor_subway_line} replied to your comment`
										} else if (newNotification.type.startsWith('milestone_')) {
											const milestoneValue = newNotification.type.split('_')[1]
											title = `Your post reached ${milestoneValue} upvotes!`
										}

										new Notification(title, {
											body,
											icon: '/favicon.png',
											tag: newNotification.id
										})
									}
								}
							}
						} catch (err) {
							console.error('Error fetching new notification:', err)
						}
					}
				)
				.subscribe()
		},

		// Unsubscribe from realtime updates
		unsubscribeFromRealtime() {
			if (realtimeChannel) {
				realtimeChannel.unsubscribe()
				realtimeChannel = null
			}
		},

		// Reset store to initial state
		reset() {
			this.unsubscribeFromRealtime()
			set({
				notifications: [],
				unreadCount: 0,
				loading: false,
				error: null,
				hasMore: true,
				cursor: null
			})
		}
	}
}

// Export main notifications store
export const notificationsStore = createNotificationsStore()

// Export derived store for unread count (for easy binding in UI)
export const unreadCount = derived(
	notificationsStore,
	$store => $store.unreadCount
)
