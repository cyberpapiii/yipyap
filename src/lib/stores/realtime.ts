import { writable, derived, get } from 'svelte/store'
import type { SupabaseClient } from '@supabase/supabase-js'
import { browser } from '$app/environment'

import { RealtimeConnectionManager } from '$lib/realtime/connectionManager'
import { FeedSubscriptionManager, ThreadSubscriptionManager } from '$lib/realtime/subscriptionManager'
import { OptimisticUpdateManager } from '$lib/realtime/optimisticUpdates'

import { hotFeed, newFeed, feedUtils, activeFeedType } from './feeds'
import { threadStore } from './thread'
import { currentUser } from './auth'
import { communityStore } from './community'

import type {
  Database,
  PostWithStats,
  CommentWithStats,
  AnonymousUser,
  FeedType,
  CommunityType
} from '$lib/types'
import { isLineInCommunity } from '$lib/config/communities'

export interface RealtimeState {
  isInitialized: boolean
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  error: string | null
  activeSubscriptions: {
    feeds: Set<FeedType>
    threads: Set<string>
  }
}

/**
 * Real-time store that orchestrates all real-time functionality
 * Integrates with existing Svelte stores to provide seamless real-time updates
 */
function createRealtimeStore() {
  // Internal state
  const state = writable<RealtimeState>({
    isInitialized: false,
    connectionStatus: 'disconnected',
    error: null,
    activeSubscriptions: {
      feeds: new Set(),
      threads: new Set()
    }
  })

  // Manager instances
  let connectionManager: RealtimeConnectionManager | null = null
  let feedSubscriptionManager: FeedSubscriptionManager | null = null
  let threadSubscriptionManager: ThreadSubscriptionManager | null = null
  let optimisticUpdateManager: OptimisticUpdateManager | null = null

  // Subscription cleanup functions
  const feedUnsubscribers = new Map<FeedType, () => void>()
  const threadUnsubscribers = new Map<string, () => void>()

  return {
    subscribe: state.subscribe,

    /**
     * Access the current realtime state snapshot
     */
    getState(): RealtimeState {
      return get(state)
    },

    /**
     * Initialize the real-time system
     */
    async initialize(supabase: SupabaseClient<Database>): Promise<void> {
      if (!browser) {
        return
      }

      if (!supabase) {
        throw new Error('Supabase client is required to initialize realtime store')
      }

      if (get(state).isInitialized) {
        return
      }

      console.log('Initializing real-time system...')

      try {
        // Create manager instances
        connectionManager = new RealtimeConnectionManager(supabase)
        feedSubscriptionManager = new FeedSubscriptionManager(connectionManager)
        threadSubscriptionManager = new ThreadSubscriptionManager(connectionManager)
        optimisticUpdateManager = new OptimisticUpdateManager()

        // Connect to real-time
        await connectionManager.connect()

        // Subscribe to connection status changes
        connectionManager.status.subscribe(status => {
          state.update(s => ({
            ...s,
            connectionStatus: status
          }))
        })

        // Listen for current user changes
        currentUser.subscribe(user => {
          if (feedSubscriptionManager) {
            feedSubscriptionManager.setCurrentUser(user)
          }
          if (threadSubscriptionManager) {
            threadSubscriptionManager.setCurrentUser(user)
          }
        })

        state.update(s => ({
          ...s,
          isInitialized: true,
          error: null
        }))

        console.log('Real-time system initialized successfully')

        // Auto-subscribe to active feed
        const activeType = get(activeFeedType)
        await realtime.subscribeToFeed(activeType)

      } catch (error) {
        console.error('Failed to initialize real-time system:', error)
        state.update(s => ({
          ...s,
          error: error instanceof Error ? error.message : 'Initialization failed',
          connectionStatus: 'error'
        }))
      }
    },

    /**
     * Subscribe to real-time feed updates
     */
    async subscribeToFeed(feedType: FeedType): Promise<void> {
      if (!feedSubscriptionManager || !get(state).isInitialized) {
        console.debug('Skipping feed subscription until real-time initializes')
        return
      }

      // Don't subscribe if already subscribed
      if (feedUnsubscribers.has(feedType)) {
        console.log(`Already subscribed to ${feedType} feed`)
        return
      }

      console.log(`Subscribing to ${feedType} feed updates`)

      const feedStore = feedUtils.getFeedStore(feedType)

      const unsubscribe = feedSubscriptionManager.subscribeToFeedPosts(
        feedType,
        // Handle new posts - filter by community
        (newPost: PostWithStats) => {
          console.log(`New ${feedType} post received:`, newPost.id)

          // Check if post already exists (from optimistic update)
          const currentPosts = get(feedStore)
          const postExists = currentPosts.posts.some(p => p.id === newPost.id)

          if (postExists) {
            console.log(`Post ${newPost.id} already exists, skipping duplicate`)
            return
          }

          // Check if post belongs to current community filter
          const currentCommunity = get(communityStore).selectedCommunity
          const postBelongsToCommunity = isLineInCommunity(
            newPost.anonymous_user.subway_line,
            currentCommunity
          )

          if (postBelongsToCommunity) {
            feedStore.addPost(newPost)
          } else {
            console.log(`Post ${newPost.id} filtered out (community: ${currentCommunity})`)
          }
        },
        // Handle post updates
        (postId: string, updates: Partial<PostWithStats>) => {
          console.log(`Post update received:`, postId, updates)
          feedStore.updatePost(postId, updates)
        },
        // Handle post deletions
        (postId: string) => {
          console.log(`Post deleted:`, postId)
          feedStore.removePost(postId)
        }
      )

      feedUnsubscribers.set(feedType, unsubscribe)

      state.update(s => ({
        ...s,
        activeSubscriptions: {
          ...s.activeSubscriptions,
          feeds: new Set([...s.activeSubscriptions.feeds, feedType])
        }
      }))
    },

    /**
     * Unsubscribe from feed updates
     */
    unsubscribeFromFeed(feedType: FeedType): void {
      const unsubscribe = feedUnsubscribers.get(feedType)
      if (unsubscribe) {
        unsubscribe()
        feedUnsubscribers.delete(feedType)

        state.update(s => {
          const newFeeds = new Set(s.activeSubscriptions.feeds)
          newFeeds.delete(feedType)
          return {
            ...s,
            activeSubscriptions: {
              ...s.activeSubscriptions,
              feeds: newFeeds
            }
          }
        })

        console.log(`Unsubscribed from ${feedType} feed`)
      }
    },

    /**
     * Subscribe to real-time thread updates
     */
    async subscribeToThread(postId: string): Promise<void> {
      if (!threadSubscriptionManager || !get(state).isInitialized) {
        console.warn('Cannot subscribe to thread - real-time not initialized')
        return
      }

      // Don't subscribe if already subscribed
      if (threadUnsubscribers.has(postId)) {
        console.log(`Already subscribed to thread ${postId}`)
        return
      }

      console.log(`Subscribing to thread updates: ${postId}`)

      const unsubscribe = threadSubscriptionManager.subscribeToThread(
        postId,
        // Handle new comments
        (newComment: CommentWithStats) => {
          console.log(`New comment received:`, newComment.id)
          threadStore.addComment(newComment)
        },
        // Handle comment updates
        (commentId: string, updates: Partial<CommentWithStats>) => {
          console.log(`Comment update received:`, commentId, updates)
          threadStore.updateComment(commentId, updates)
        },
        // Handle comment deletions
        (commentId: string) => {
          console.log(`Comment deleted:`, commentId)
          // Could implement comment deletion if needed
        },
        // Handle post updates
        (postId: string, updates: Partial<PostWithStats>) => {
          console.log(`Thread post update received:`, postId, updates)
          threadStore.updatePost(updates)
        }
      )

      threadUnsubscribers.set(postId, unsubscribe)

      state.update(s => ({
        ...s,
        activeSubscriptions: {
          ...s.activeSubscriptions,
          threads: new Set([...s.activeSubscriptions.threads, postId])
        }
      }))
    },

    /**
     * Unsubscribe from thread updates
     */
    unsubscribeFromThread(postId: string): void {
      const unsubscribe = threadUnsubscribers.get(postId)
      if (unsubscribe) {
        unsubscribe()
        threadUnsubscribers.delete(postId)

        state.update(s => {
          const newThreads = new Set(s.activeSubscriptions.threads)
          newThreads.delete(postId)
          return {
            ...s,
            activeSubscriptions: {
              ...s.activeSubscriptions,
              threads: newThreads
            }
          }
        })

        console.log(`Unsubscribed from thread ${postId}`)
      }
    },

    /**
     * Perform optimistic vote with real-time sync
     */
    async optimisticVote(
      targetId: string,
      targetType: 'post' | 'comment',
      voteType: 'up' | 'down' | null,
      apiCall: () => Promise<void>
    ): Promise<void> {
      if (!optimisticUpdateManager) {
        console.warn('Cannot perform optimistic vote - real-time not initialized')
        return
      }

      const user = get(currentUser)
      if (!user) {
        console.warn('Cannot vote - no current user')
        return
      }

      // Get current state
      let currentVote: 'up' | 'down' | null = null
      let currentScore = 0

      if (targetType === 'post') {
        // Find post in active feeds or thread
        const activeType = get(activeFeedType)
        const feedStore = feedUtils.getFeedStore(activeType)
        const feedState = get(feedStore)
        const post = feedState.posts.find(p => p.id === targetId)

        if (post) {
          currentVote = post.user_vote || null
          currentScore = post.vote_score
        } else {
          // Check thread store
          const threadState = get(threadStore)
          if (threadState.post?.id === targetId) {
            currentVote = threadState.post.user_vote || null
            currentScore = threadState.post.vote_score
          }
        }
      } else {
        // Find comment in thread
        const threadState = get(threadStore)
        const findComment = (comments: CommentWithStats[], id: string): CommentWithStats | null => {
          for (const comment of comments) {
            if (comment.id === id) return comment
            const found = findComment(comment.replies, id)
            if (found) return found
          }
          return null
        }

        const comment = findComment(threadState.comments, targetId)
        if (comment) {
          currentVote = comment.user_vote || null
          currentScore = comment.vote_score
        }
      }

      // Apply optimistic update
      const operationId = optimisticUpdateManager.applyOptimisticVote(
        targetId,
        targetType,
        voteType,
        currentVote,
        currentScore,
        (id, updates) => {
          if (targetType === 'post') {
            // Update all feed stores that might have this post
            hotFeed.updatePost(id, updates)
            newFeed.updatePost(id, updates)

            // Update thread store if this is the main post
            const threadState = get(threadStore)
            if (threadState.post?.id === id) {
              threadStore.updatePost(updates)
            }
          } else {
            // Update comment in thread store
            threadStore.updateComment(id, updates)
          }
        }
      )

      try {
        // Perform actual API call
        await apiCall()

        // Confirm the operation succeeded
        optimisticUpdateManager.confirmOperation(operationId)

        console.log(`Vote confirmed: ${operationId}`)
      } catch (error) {
        console.error('Vote failed, rolling back:', error)

        // Rollback the optimistic update
        optimisticUpdateManager.rollbackOperation(operationId, (operation) => {
          if (operation.type === 'vote') {
            const voteOp = operation as any
            const rollbackUpdates = {
              vote_score: voteOp.rollbackData.previousScore,
              user_vote: voteOp.rollbackData.previousVote
            }

            if (targetType === 'post') {
              hotFeed.updatePost(targetId, rollbackUpdates)
              newFeed.updatePost(targetId, rollbackUpdates)

              const threadState = get(threadStore)
              if (threadState.post?.id === targetId) {
                threadStore.updatePost(rollbackUpdates)
              }
            } else {
              threadStore.updateComment(targetId, rollbackUpdates)
            }
          }
        })

        throw error
      }
    },

    /**
     * Perform optimistic post creation
     */
    async optimisticCreatePost(
      postData: {
        content: string
        thread_id?: string | null
        parent_post_id?: string | null
      },
      apiCall: () => Promise<PostWithStats>
    ): Promise<PostWithStats> {
      if (!optimisticUpdateManager) {
        console.warn('Cannot create optimistic post - real-time not initialized')
        throw new Error('Real-time not initialized')
      }

      const user = get(currentUser)
      if (!user) {
        throw new Error('No current user')
      }

      // Apply optimistic update
      const operationId = optimisticUpdateManager.applyOptimisticPost(
        postData,
        user,
        (post) => {
          if (!post.parent_post_id) {
            // Top-level post - surface immediately in both feeds
            feedUtils.addPostToFeeds(post)
          }
          // Could also handle thread replies here
        }
      )

      try {
        // Perform actual API call
        const realPost = await apiCall()

        // Confirm operation and replace optimistic post with real data
        optimisticUpdateManager.confirmOperation(operationId, realPost)

        // Update stores with real data
        if (!realPost.parent_post_id) {
          const optimisticId = `optimistic_${operationId}`
          const normalizedPost = {
            ...realPost,
            is_user_post: true
          }

          feedUtils.replacePostInFeeds(optimisticId, normalizedPost)
        }

        console.log(`Post creation confirmed: ${operationId}`)
        return realPost

      } catch (error) {
        console.error('Post creation failed, rolling back:', error)

        // Rollback optimistic post
        optimisticUpdateManager.rollbackOperation(operationId, (operation) => {
          if (operation.type === 'post') {
            const postOp = operation as any
            feedUtils.removePostFromFeeds(postOp.postData.id)
          }
        })

        throw error
      }
    },

    /**
     * Perform optimistic comment creation
     */
    async optimisticCreateComment(
      commentData: {
        content: string
        post_id: string
        parent_comment_id?: string | null
      },
      apiCall: () => Promise<CommentWithStats>
    ): Promise<CommentWithStats> {
      if (!optimisticUpdateManager) {
        console.warn('Cannot create optimistic comment - real-time not initialized')
        throw new Error('Real-time not initialized')
      }

      const user = get(currentUser)
      if (!user) {
        throw new Error('No current user')
      }

      // Ensure thread-specific identity before creating comment
      // This makes optimistic and real comment use the same subway line
      try {
        const { data: threadIdentity } = await supabaseClient.rpc('rpc_ensure_thread_identity', {
          user_uuid: user.id,
          post_uuid: commentData.postId
        })

        // Use thread-specific identity if available
        if (threadIdentity) {
          user.subway_line = threadIdentity.subway_line
          user.subway_color = threadIdentity.subway_color
        }
      } catch (error) {
        console.warn('Failed to ensure thread identity, using global identity:', error)
        // Continue anyway with global identity
      }

      // Apply optimistic update with thread-specific identity
      const operationId = optimisticUpdateManager.applyOptimisticComment(
        commentData,
        user,
        (comment) => {
          threadStore.addComment(comment)
        }
      )

      try {
        // Perform actual API call
        const realComment = await apiCall()

        // Confirm operation
        optimisticUpdateManager.confirmOperation(operationId, realComment)

        // Replace optimistic comment with real comment (remove old, add new with real ID)
        threadStore.removeComment(`optimistic_${operationId}`)
        threadStore.addComment(realComment)

        console.log(`Comment creation confirmed: ${operationId}`)
        return realComment

      } catch (error) {
        console.error('Comment creation failed, rolling back:', error)

        // Rollback optimistic comment
        optimisticUpdateManager.rollbackOperation(operationId, (operation) => {
          if (operation.type === 'comment') {
            const commentOp = operation as any
            // Remove optimistic comment from thread store
            threadStore.removeComment(commentOp.data.id)
          }
        })

        throw error
      }
    },

    /**
     * Get real-time connection status
     */
    getConnectionStatus: () => {
      return derived(state, s => s.connectionStatus)
    },

    /**
     * Get whether real-time is connected
     */
    isConnected: () => {
      return derived(state, s => s.connectionStatus === 'connected')
    },

    /**
     * Manual reconnection
     */
    async reconnect(): Promise<void> {
      if (connectionManager) {
        await connectionManager.reconnect()
      }
    },

    /**
     * Cleanup and disconnect
     */
    async cleanup(): Promise<void> {
      console.log('Cleaning up real-time system...')

      // Unsubscribe from all feeds
      for (const feedType of feedUnsubscribers.keys()) {
        realtime.unsubscribeFromFeed(feedType)
      }

      // Unsubscribe from all threads
      for (const threadId of threadUnsubscribers.keys()) {
        realtime.unsubscribeFromThread(threadId)
      }

      // Cleanup managers
      if (connectionManager) {
        await connectionManager.disconnect()
        connectionManager = null
      }

      if (feedSubscriptionManager) {
        feedSubscriptionManager.cleanup()
        feedSubscriptionManager = null
      }

      if (threadSubscriptionManager) {
        threadSubscriptionManager.cleanup()
        threadSubscriptionManager = null
      }

      if (optimisticUpdateManager) {
        optimisticUpdateManager.cleanup()
        optimisticUpdateManager = null
      }

      state.set({
        isInitialized: false,
        connectionStatus: 'disconnected',
        error: null,
        activeSubscriptions: {
          feeds: new Set(),
          threads: new Set()
        }
      })

      console.log('Real-time system cleaned up')
    }
  }
}

// Create singleton instance
export const realtime = createRealtimeStore()

// Derived stores for easy access
export const realtimeStatus = realtime.getConnectionStatus()
export const isRealtimeConnected = realtime.isConnected()

// Auto-subscribe to feed changes
if (browser) {
  activeFeedType.subscribe(async (feedType) => {
    // Unsubscribe from other feeds first
    const allFeedTypes: FeedType[] = ['hot', 'new']
    for (const type of allFeedTypes) {
      if (type !== feedType) {
        realtime.unsubscribeFromFeed(type)
      }
    }

    // Subscribe to new active feed
    await realtime.subscribeToFeed(feedType)
  })
}
