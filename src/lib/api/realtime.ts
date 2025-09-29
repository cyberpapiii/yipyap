import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  PostWithStats,
  CommentWithStats,
  PostFormData,
  CommentFormData,
  AnonymousUser,
  FeedType
} from '$lib/types'

import { PostsAPI } from './posts'
import { realtime } from '$lib/stores/realtime'

/**
 * Enhanced API layer that provides real-time optimistic updates
 * Wraps the existing PostsAPI with optimistic update functionality
 */
export class RealtimePostsAPI extends PostsAPI {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase)
  }

  /**
   * Vote on a post with optimistic updates
   */
  async voteOnPostOptimistic(
    postId: string,
    voteType: 'up' | 'down' | null,
    currentUser: AnonymousUser
  ): Promise<void> {
    return realtime.optimisticVote(
      postId,
      'post',
      voteType,
      async () => {
        await super.voteOnPost(postId, voteType, currentUser)
      }
    )
  }

  /**
   * Vote on a comment with optimistic updates
   */
  async voteOnCommentOptimistic(
    commentId: string,
    voteType: 'up' | 'down' | null,
    currentUser: AnonymousUser
  ): Promise<void> {
    return realtime.optimisticVote(
      commentId,
      'comment',
      voteType,
      async () => {
        await super.voteOnComment(commentId, voteType, currentUser)
      }
    )
  }

  /**
   * Create a post with optimistic updates
   */
  async createPostOptimistic(
    data: PostFormData,
    currentUser: AnonymousUser
  ): Promise<PostWithStats> {
    return realtime.optimisticCreatePost(
      {
        content: data.content,
        thread_id: data.threadId,
        parent_post_id: data.parentPostId
      },
      async () => {
        return await super.createPost(data, currentUser)
      }
    )
  }

  /**
   * Create a comment with optimistic updates
   */
  async createCommentOptimistic(
    data: CommentFormData,
    currentUser: AnonymousUser
  ): Promise<CommentWithStats> {
    return realtime.optimisticCreateComment(
      {
        content: data.content,
        post_id: data.postId,
        parent_comment_id: data.parentCommentId
      },
      async () => {
        return await super.createComment(data, currentUser)
      }
    )
  }

  /**
   * Delete a post
   */
  async deletePost(
    postId: string,
    currentUser: AnonymousUser
  ): Promise<void> {
    return super.deletePost(postId, currentUser)
  }

  /**
   * Delete a comment
   */
  async deleteComment(
    commentId: string,
    currentUser: AnonymousUser
  ): Promise<void> {
    return super.deleteComment(commentId, currentUser)
  }

  /**
   * Load feed posts and automatically subscribe to real-time updates
   */
  async loadFeedWithRealtime(
    feedType: FeedType,
    cursor?: string,
    limit = 20,
    currentUser?: AnonymousUser | null
  ) {
    // First load the initial data
    const result = await super.getFeedPosts(feedType, cursor, limit, currentUser)

    // Subscribe to real-time updates for this feed
    await realtime.subscribeToFeed(feedType)

    return result
  }

  /**
   * Load thread and automatically subscribe to real-time updates
   */
  async loadThreadWithRealtime(
    postId: string,
    currentUser?: AnonymousUser | null
  ) {
    // First load the initial data
    const post = await super.getPost(postId, currentUser)

    // Subscribe to real-time updates for this thread
    if (post) {
      await realtime.subscribeToThread(postId)
    }

    return post
  }

  /**
   * Unsubscribe from feed real-time updates
   */
  unsubscribeFromFeedRealtime(feedType: FeedType): void {
    realtime.unsubscribeFromFeed(feedType)
  }

  /**
   * Unsubscribe from thread real-time updates
   */
  unsubscribeFromThreadRealtime(postId: string): void {
    realtime.unsubscribeFromThread(postId)
  }
}

/**
 * Factory function to create a real-time enabled API instance
 */
export function createRealtimeAPI(supabase: SupabaseClient<Database>): RealtimePostsAPI {
  return new RealtimePostsAPI(supabase)
}

// Types for real-time events
export interface RealtimePostEvent {
  type: 'post_created' | 'post_updated' | 'post_deleted'
  postId: string
  data?: Partial<PostWithStats>
}

export interface RealtimeCommentEvent {
  type: 'comment_created' | 'comment_updated' | 'comment_deleted'
  commentId: string
  postId: string
  data?: Partial<CommentWithStats>
}

export interface RealtimeVoteEvent {
  type: 'vote_created' | 'vote_updated' | 'vote_deleted'
  targetId: string
  targetType: 'post' | 'comment'
  userId: string
  voteType: 'up' | 'down' | null
}

/**
 * Event bus for real-time events (if needed for custom handling)
 */
class RealtimeEventBus {
  private listeners: Map<string, Array<(event: any) => void>> = new Map()

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error)
        }
      })
    }
  }

  off(event: string): void {
    this.listeners.delete(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const realtimeEventBus = new RealtimeEventBus()

// Helper functions for working with real-time events
export const realtimeHelpers = {
  /**
   * Listen for post events
   */
  onPostEvent(callback: (event: RealtimePostEvent) => void) {
    const unsubscribeCreate = realtimeEventBus.on('post_created', callback)
    const unsubscribeUpdate = realtimeEventBus.on('post_updated', callback)
    const unsubscribeDelete = realtimeEventBus.on('post_deleted', callback)

    return () => {
      unsubscribeCreate()
      unsubscribeUpdate()
      unsubscribeDelete()
    }
  },

  /**
   * Listen for comment events
   */
  onCommentEvent(callback: (event: RealtimeCommentEvent) => void) {
    const unsubscribeCreate = realtimeEventBus.on('comment_created', callback)
    const unsubscribeUpdate = realtimeEventBus.on('comment_updated', callback)
    const unsubscribeDelete = realtimeEventBus.on('comment_deleted', callback)

    return () => {
      unsubscribeCreate()
      unsubscribeUpdate()
      unsubscribeDelete()
    }
  },

  /**
   * Listen for vote events
   */
  onVoteEvent(callback: (event: RealtimeVoteEvent) => void) {
    const unsubscribeCreate = realtimeEventBus.on('vote_created', callback)
    const unsubscribeUpdate = realtimeEventBus.on('vote_updated', callback)
    const unsubscribeDelete = realtimeEventBus.on('vote_deleted', callback)

    return () => {
      unsubscribeCreate()
      unsubscribeUpdate()
      unsubscribeDelete()
    }
  },

  /**
   * Emit a post event
   */
  emitPostEvent(event: RealtimePostEvent) {
    realtimeEventBus.emit(event.type, event)
  },

  /**
   * Emit a comment event
   */
  emitCommentEvent(event: RealtimeCommentEvent) {
    realtimeEventBus.emit(event.type, event)
  },

  /**
   * Emit a vote event
   */
  emitVoteEvent(event: RealtimeVoteEvent) {
    realtimeEventBus.emit(event.type, event)
  }
}