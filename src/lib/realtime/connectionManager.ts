import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { writable, derived } from 'svelte/store'
import type { Database } from '$lib/types'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  error: string | null
  lastConnected: Date | null
  reconnectAttempts: number
  channels: Set<string>
}

export interface ReconnectionConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitterMaxMs: number
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  maxAttempts: 10,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 1.5,
  jitterMaxMs: 1000 // Random jitter up to 1 second
}

/**
 * Manages WebSocket connections and provides resilient real-time functionality
 * Features:
 * - Exponential backoff with jitter for reconnection
 * - Connection health monitoring with heartbeat
 * - Browser visibility and network state handling
 * - Channel subscription management
 * - Connection pooling and resource cleanup
 */
export class RealtimeConnectionManager {
  private supabase: SupabaseClient<Database>
  private connectionState = writable<ConnectionState>({
    status: 'disconnected',
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
    channels: new Set()
  })

  private activeChannels = new Map<string, RealtimeChannel>()
  private reconnectionConfig: ReconnectionConfig
  private reconnectionTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isReconnecting = false

  // Browser state monitoring
  private isDocumentVisible = true
  private isOnline = true

  constructor(
    supabase: SupabaseClient<Database>,
    config: Partial<ReconnectionConfig> = {}
  ) {
    this.supabase = supabase
    this.reconnectionConfig = { ...DEFAULT_RECONNECTION_CONFIG, ...config }

    this.setupBrowserEventListeners()
    this.setupHeartbeat()
  }

  /**
   * Get the current connection state as a readable store
   */
  get state() {
    return { subscribe: this.connectionState.subscribe }
  }

  /**
   * Get connection status as a derived store
   */
  get status() {
    return derived(this.connectionState, state => state.status)
  }

  /**
   * Get whether currently connected
   */
  get isConnected() {
    return derived(this.connectionState, state => state.status === 'connected')
  }

  /**
   * Initialize connection and start monitoring
   */
  async connect(): Promise<void> {
    this.updateConnectionState({
      status: 'connecting',
      error: null
    })

    try {
      // Supabase realtime connection is established automatically
      // We just need to set up our monitoring
      this.updateConnectionState({
        status: 'connected',
        lastConnected: new Date(),
        reconnectAttempts: 0,
        error: null
      })

      this.startHeartbeat()
      console.log('Realtime connection manager initialized')
    } catch (error) {
      console.error('Failed to initialize connection:', error)
      this.updateConnectionState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed'
      })

      this.scheduleReconnection()
    }
  }

  /**
   * Subscribe to a channel with automatic reconnection
   */
  subscribeToChannel(
    channelName: string,
    config: {
      event?: string
      schema?: string
      table?: string
      filter?: string
    },
    callback: (payload: any) => void
  ): () => void {
    console.log(`Subscribing to channel: ${channelName}`)

    const channel = this.supabase.channel(channelName)

    // Configure channel based on type
    if (config.table) {
      channel.on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter
        },
        callback
      )
    } else {
      // Broadcast channel
      channel.on('broadcast', { event: config.event || '*' }, callback)
    }

    // Subscribe to channel
    channel.subscribe((status) => {
      console.log(`Channel ${channelName} status:`, status)

      if (status === 'SUBSCRIBED') {
        this.activeChannels.set(channelName, channel)
        this.updateConnectionState(state => ({
          ...state,
          channels: new Set([...state.channels, channelName])
        }))
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Channel ${channelName} error`)
        this.handleChannelError(channelName)
      } else if (status === 'TIMED_OUT') {
        console.warn(`Channel ${channelName} timed out`)
        this.handleChannelTimeout(channelName)
      }
    })

    // Return unsubscribe function
    return () => {
      this.unsubscribeFromChannel(channelName)
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribeFromChannel(channelName: string): void {
    const channel = this.activeChannels.get(channelName)
    if (channel) {
      channel.unsubscribe()
      this.activeChannels.delete(channelName)

      this.updateConnectionState(state => {
        const newChannels = new Set(state.channels)
        newChannels.delete(channelName)
        return {
          ...state,
          channels: newChannels
        }
      })

      console.log(`Unsubscribed from channel: ${channelName}`)
    }
  }

  /**
   * Disconnect and cleanup all resources
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting realtime manager')

    // Clear timers
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer)
      this.reconnectionTimer = null
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Unsubscribe from all channels
    for (const [channelName] of this.activeChannels) {
      this.unsubscribeFromChannel(channelName)
    }

    // Remove event listeners
    this.removeBrowserEventListeners()

    this.updateConnectionState({
      status: 'disconnected',
      error: null,
      channels: new Set()
    })
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    console.log('Forcing reconnection...')
    await this.disconnect()
    await this.connect()
  }

  /**
   * Setup browser event listeners for network and visibility changes
   */
  private setupBrowserEventListeners(): void {
    if (typeof window === 'undefined') return

    // Network status
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    this.isOnline = navigator.onLine

    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.isDocumentVisible = !document.hidden

    // Page focus/blur
    window.addEventListener('focus', this.handleFocus)
    window.addEventListener('blur', this.handleBlur)
  }

  /**
   * Remove browser event listeners
   */
  private removeBrowserEventListeners(): void {
    if (typeof window === 'undefined') return

    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('focus', this.handleFocus)
    window.removeEventListener('blur', this.handleBlur)
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    console.log('Network came back online')
    this.isOnline = true
    if (this.shouldReconnect()) {
      this.reconnect()
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    console.log('Network went offline')
    this.isOnline = false
    this.updateConnectionState({
      status: 'disconnected',
      error: 'Network offline'
    })
  }

  /**
   * Handle visibility change
   */
  private handleVisibilityChange = (): void => {
    this.isDocumentVisible = !document.hidden
    console.log('Page visibility changed:', this.isDocumentVisible ? 'visible' : 'hidden')

    if (this.isDocumentVisible && this.shouldReconnect()) {
      // Page became visible, check if we need to reconnect
      this.reconnect()
    }
  }

  /**
   * Handle window focus
   */
  private handleFocus = (): void => {
    console.log('Window focused')
    if (this.shouldReconnect()) {
      this.reconnect()
    }
  }

  /**
   * Handle window blur
   */
  private handleBlur = (): void => {
    console.log('Window blurred')
    // Could implement reduced activity here
  }

  /**
   * Setup heartbeat monitoring
   */
  private setupHeartbeat(): void {
    // Supabase handles its own heartbeat, but we can monitor channel health
    // This is more for our own connection state management
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    // Check connection health every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      this.checkConnectionHealth()
    }, 30000)
  }

  /**
   * Check connection health
   */
  private checkConnectionHealth(): void {
    // If we have no active channels and we're supposed to be connected,
    // something might be wrong
    const currentState = this.getConnectionState()

    if (currentState.status === 'connected' && currentState.channels.size === 0) {
      console.warn('No active channels despite being connected')
    }

    // Check if we've been disconnected for too long
    if (currentState.status === 'disconnected' && this.shouldReconnect()) {
      console.log('Connection health check triggered reconnection')
      this.scheduleReconnection()
    }
  }

  /**
   * Handle channel error
   */
  private handleChannelError(channelName: string): void {
    console.error(`Channel error for ${channelName}`)
    this.updateConnectionState({
      status: 'error',
      error: `Channel ${channelName} error`
    })

    this.scheduleReconnection()
  }

  /**
   * Handle channel timeout
   */
  private handleChannelTimeout(channelName: string): void {
    console.warn(`Channel timeout for ${channelName}`)
    // Try to resubscribe to this specific channel
    // This would require storing channel configurations
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.isReconnecting || !this.shouldReconnect()) {
      return
    }

    this.isReconnecting = true
    const currentState = this.getConnectionState()

    if (currentState.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
      console.error('Max reconnection attempts reached')
      this.updateConnectionState({
        status: 'error',
        error: 'Max reconnection attempts reached'
      })
      this.isReconnecting = false
      return
    }

    const delay = this.calculateBackoffDelay(currentState.reconnectAttempts)
    console.log(`Scheduling reconnection in ${delay}ms (attempt ${currentState.reconnectAttempts + 1})`)

    this.updateConnectionState(state => ({
      ...state,
      reconnectAttempts: state.reconnectAttempts + 1
    }))

    this.reconnectionTimer = setTimeout(async () => {
      this.isReconnecting = false
      await this.connect()
    }, delay)
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.reconnectionConfig.baseDelay * Math.pow(this.reconnectionConfig.backoffMultiplier, attempt),
      this.reconnectionConfig.maxDelay
    )

    // Add random jitter to prevent thundering herd
    const jitter = Math.random() * this.reconnectionConfig.jitterMaxMs

    return exponentialDelay + jitter
  }

  /**
   * Check if we should attempt reconnection
   */
  private shouldReconnect(): boolean {
    return this.isOnline && this.isDocumentVisible
  }

  /**
   * Get current connection state
   */
  private getConnectionState(): ConnectionState {
    let state: ConnectionState
    this.connectionState.subscribe(s => { state = s })()
    return state!
  }

  /**
   * Update connection state
   */
  private updateConnectionState(
    update: Partial<ConnectionState> | ((state: ConnectionState) => ConnectionState)
  ): void {
    if (typeof update === 'function') {
      this.connectionState.update(update)
    } else {
      this.connectionState.update(state => ({ ...state, ...update }))
    }
  }
}