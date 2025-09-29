import type { RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeConnectionManager } from './connectionManager'
import type { PostWithStats, CommentWithStats, AnonymousUser, FeedType } from '$lib/types'

export interface RealtimeEventPayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: any
  old: any
  errors: any[]
}

export interface PostRealtimePayload extends RealtimeEventPayload {
  new: PostWithStats
  old: PostWithStats
}

export interface CommentRealtimePayload extends RealtimeEventPayload {
  new: CommentWithStats
  old: CommentWithStats
}

export interface VoteRealtimePayload extends RealtimeEventPayload {
  new: {
    id: string
    post_id: string | null
    comment_id: string | null
    vote_type: number
    user_id: string
  }
  old: {
    id: string
    post_id: string | null
    comment_id: string | null
    vote_type: number
    user_id: string
  }
}

/**
 * Manages real-time subscriptions for feeds
 * Handles new posts, vote updates, and feed-specific filtering
 */
export class FeedSubscriptionManager {
  private connectionManager: RealtimeConnectionManager
  private activeSubscriptions = new Map<string, () => void>()
  private currentUser: AnonymousUser | null = null

  constructor(connectionManager: RealtimeConnectionManager) {
    this.connectionManager = connectionManager
  }

  /**
   * Set the current user for filtering user-specific events
   */
  setCurrentUser(user: AnonymousUser | null): void {
    this.currentUser = user
  }

  /**
   * Subscribe to new posts for feed updates
   */
  subscribeToFeedPosts(
    feedType: FeedType,
    onNewPost: (post: PostWithStats) => void,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void,
    onPostDelete: (postId: string) => void
  ): () => void {
    const channelName = `feed_${feedType}_posts`

    console.log(`Subscribing to feed posts: ${feedType}`)

    const unsubscribe = this.connectionManager.subscribeToChannel(
      channelName,
      {
        schema: 'public',
        table: 'posts',
        event: '*'
      },
      (payload: PostRealtimePayload) => {
        this.handlePostEvent(payload, onNewPost, onPostUpdate, onPostDelete)
      }
    )

    this.activeSubscriptions.set(channelName, unsubscribe)

    // Also subscribe to vote changes for post score updates
    const voteChannelName = `feed_${feedType}_votes`
    const voteUnsubscribe = this.connectionManager.subscribeToChannel(
      voteChannelName,
      {
        schema: 'public',
        table: 'votes',
        event: '*',
        filter: 'post_id=not.is.null'
      },
      (payload: VoteRealtimePayload) => {
        this.handleVoteEvent(payload, onPostUpdate)
      }
    )

    this.activeSubscriptions.set(voteChannelName, voteUnsubscribe)

    // Return combined unsubscribe function
    return () => {
      this.unsubscribeFromFeed(feedType)
    }
  }

  /**
   * Unsubscribe from feed updates
   */
  unsubscribeFromFeed(feedType: FeedType): void {
    const channelNames = [
      `feed_${feedType}_posts`,
      `feed_${feedType}_votes`
    ]

    for (const channelName of channelNames) {
      const unsubscribe = this.activeSubscriptions.get(channelName)
      if (unsubscribe) {
        unsubscribe()
        this.activeSubscriptions.delete(channelName)
      }
    }

    console.log(`Unsubscribed from feed: ${feedType}`)
  }

  /**
   * Handle post events (insert, update, delete)
   */
  private handlePostEvent(
    payload: PostRealtimePayload,
    onNewPost: (post: PostWithStats) => void,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void,
    onPostDelete: (postId: string) => void
  ): void {
    console.log('Post event:', payload.eventType, payload)

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new && !(payload.new as any).deleted_at) {
          // Transform database row to PostWithStats format
          // Note: We'll need to fetch additional data like anonymous_user info
          this.enrichPostData(payload.new).then(enrichedPost => {
            if (enrichedPost) {
              onNewPost(enrichedPost)
            }
          }).catch(err => {
            console.error('Error enriching post data:', err)
          })
        }
        break

      case 'UPDATE':
        if (payload.new && payload.old) {
          const updates: Partial<PostWithStats> = {}

          // Compare old and new to determine what changed
          if (payload.new.vote_score !== payload.old.vote_score) {
            updates.vote_score = payload.new.vote_score
          }
          if (payload.new.comment_count !== payload.old.comment_count) {
            updates.comment_count = payload.new.comment_count
          }
          if (payload.new.content !== payload.old.content) {
            updates.content = payload.new.content
            updates.updated_at = payload.new.updated_at
          }
          // Map deleted_at to is_deleted flag expected by store
          const newDeleted = (payload.new as any).deleted_at !== null
          const oldDeleted = (payload.old as any).deleted_at !== null
          if (newDeleted !== oldDeleted) {
            (updates as any).is_deleted = newDeleted
          }

          if (Object.keys(updates).length > 0) {
            onPostUpdate(payload.new.id, updates)
          }
        }
        break

      case 'DELETE':
        if (payload.old) {
          onPostDelete(payload.old.id)
        }
        break
    }
  }

  /**
   * Handle vote events to update post scores
   */
  private handleVoteEvent(
    payload: VoteRealtimePayload,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): void {
    console.log('Vote event:', payload.eventType, payload)

    if (payload.new?.post_id) {
      // We need to calculate the new vote score
      // For now, we'll trigger a refresh of the specific post
      // In a production app, you might want to maintain vote counts in memory
      this.triggerPostRefresh(payload.new.post_id, onPostUpdate)
    }
  }

  /**
   * Enrich post data with related information (anonymous_user, user_vote, etc.)
   */
  private async enrichPostData(postData: any): Promise<PostWithStats | null> {
    // This would typically fetch additional data from the API
    // For now, we'll create a minimal version
    // In a real implementation, you'd want to call your posts API
    console.warn('Post data enrichment not fully implemented - using minimal data')

    const authorId = postData.anonymous_user_id ?? postData.user_id
    const voteScore = postData.vote_score ?? postData.score ?? 0
    const commentCount = postData.comment_count ?? postData.reply_count ?? 0

    return {
      id: postData.id,
      content: postData.content,
      anonymous_user_id: authorId,
      thread_id: postData.thread_id ?? null,
      parent_post_id: postData.parent_post_id ?? null,
      created_at: postData.created_at,
      updated_at: postData.updated_at ?? postData.created_at,
      is_deleted: Boolean(postData.is_deleted ?? postData.deleted_at),
      vote_score: voteScore,
      comment_count: commentCount,
      anonymous_user: {
        id: authorId,
        emoji: (postData.emoji ?? postData.identity_emoji ?? '🎭') as any,
        color: (postData.color ?? postData.identity_color ?? 'purple') as any,
        subway_line: (postData.subway_line ?? postData.user_subway_line ?? 'A') as any,
        subway_color: (postData.subway_color ?? postData.user_subway_color ?? 'mta-blue') as any,
        device_id: '',
        created_at: '',
        last_seen_at: ''
      },
      user_vote: null,
      is_user_post: this.currentUser?.id === authorId,
      replies: []
    }
  }

  /**
   * Trigger post refresh for vote score updates
   */
  private async triggerPostRefresh(
    postId: string,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): Promise<void> {
    // In a real implementation, you'd fetch the updated vote score
    // For now, we'll emit a generic update event
    console.log(`Triggering refresh for post ${postId} due to vote change`)

    // This is a placeholder - you'd implement actual vote score fetching
    onPostUpdate(postId, {
      // Will be updated by the actual API call in the component
    })
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    for (const [channelName, unsubscribe] of this.activeSubscriptions) {
      unsubscribe()
    }
    this.activeSubscriptions.clear()
  }
}

/**
 * Manages real-time subscriptions for individual threads
 * Handles new comments, vote updates, and nested reply management
 */
export class ThreadSubscriptionManager {
  private connectionManager: RealtimeConnectionManager
  private activeSubscriptions = new Map<string, () => void>()
  private currentUser: AnonymousUser | null = null
  private currentThreadId: string | null = null

  constructor(connectionManager: RealtimeConnectionManager) {
    this.connectionManager = connectionManager
  }

  /**
   * Set the current user for filtering user-specific events
   */
  setCurrentUser(user: AnonymousUser | null): void {
    this.currentUser = user
  }

  /**
   * Subscribe to thread updates (comments and votes)
   */
  subscribeToThread(
    postId: string,
    onNewComment: (comment: CommentWithStats) => void,
    onCommentUpdate: (commentId: string, updates: Partial<CommentWithStats>) => void,
    onCommentDelete: (commentId: string) => void,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): () => void {
    this.currentThreadId = postId

    console.log(`Subscribing to thread: ${postId}`)

    // Subscribe to new comments
    const commentsChannelName = `thread_${postId}_comments`
    const commentsUnsubscribe = this.connectionManager.subscribeToChannel(
      commentsChannelName,
      {
        schema: 'public',
        table: 'comments',
        event: '*',
        filter: `post_id=eq.${postId}`
      },
      (payload: CommentRealtimePayload) => {
        this.handleCommentEvent(payload, onNewComment, onCommentUpdate, onCommentDelete)
      }
    )

    this.activeSubscriptions.set(commentsChannelName, commentsUnsubscribe)

    // Subscribe to vote changes on comments
    const commentVotesChannelName = `thread_${postId}_comment_votes`
    const commentVotesUnsubscribe = this.connectionManager.subscribeToChannel(
      commentVotesChannelName,
      {
        schema: 'public',
        table: 'votes',
        event: '*',
        filter: 'comment_id=not.is.null'
      },
      (payload: VoteRealtimePayload) => {
        this.handleCommentVoteEvent(payload, onCommentUpdate)
      }
    )

    this.activeSubscriptions.set(commentVotesChannelName, commentVotesUnsubscribe)

    // Subscribe to vote changes on the main post
    const postVotesChannelName = `thread_${postId}_post_votes`
    const postVotesUnsubscribe = this.connectionManager.subscribeToChannel(
      postVotesChannelName,
      {
        schema: 'public',
        table: 'votes',
        event: '*',
        filter: `post_id=eq.${postId}`
      },
      (payload: VoteRealtimePayload) => {
        this.handlePostVoteEvent(payload, onPostUpdate)
      }
    )

    this.activeSubscriptions.set(postVotesChannelName, postVotesUnsubscribe)

    // Return combined unsubscribe function
    return () => {
      this.unsubscribeFromThread(postId)
    }
  }

  /**
   * Unsubscribe from thread updates
   */
  unsubscribeFromThread(postId: string): void {
    const channelNames = [
      `thread_${postId}_comments`,
      `thread_${postId}_comment_votes`,
      `thread_${postId}_post_votes`
    ]

    for (const channelName of channelNames) {
      const unsubscribe = this.activeSubscriptions.get(channelName)
      if (unsubscribe) {
        unsubscribe()
        this.activeSubscriptions.delete(channelName)
      }
    }

    if (this.currentThreadId === postId) {
      this.currentThreadId = null
    }

    console.log(`Unsubscribed from thread: ${postId}`)
  }

  /**
   * Handle comment events (insert, update, delete)
   */
  private handleCommentEvent(
    payload: CommentRealtimePayload,
    onNewComment: (comment: CommentWithStats) => void,
    onCommentUpdate: (commentId: string, updates: Partial<CommentWithStats>) => void,
    onCommentDelete: (commentId: string) => void
  ): void {
    console.log('Comment event:', payload.eventType, payload)

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new && !payload.new.is_deleted) {
          this.enrichCommentData(payload.new).then(enrichedComment => {
            if (enrichedComment) {
              onNewComment(enrichedComment)
            }
          }).catch(err => {
            console.error('Error enriching comment data:', err)
          })
        }
        break

      case 'UPDATE':
        if (payload.new && payload.old) {
          const updates: Partial<CommentWithStats> = {}

          if (payload.new.vote_score !== payload.old.vote_score) {
            updates.vote_score = payload.new.vote_score
          }
          if (payload.new.reply_count !== payload.old.reply_count) {
            updates.reply_count = payload.new.reply_count
          }
          if (payload.new.content !== payload.old.content) {
            updates.content = payload.new.content
            updates.updated_at = payload.new.updated_at
          }
          if (payload.new.is_deleted !== payload.old.is_deleted) {
            updates.is_deleted = payload.new.is_deleted
          }

          if (Object.keys(updates).length > 0) {
            onCommentUpdate(payload.new.id, updates)
          }
        }
        break

      case 'DELETE':
        if (payload.old) {
          onCommentDelete(payload.old.id)
        }
        break
    }
  }

  /**
   * Handle comment vote events
   */
  private handleCommentVoteEvent(
    payload: VoteRealtimePayload,
    onCommentUpdate: (commentId: string, updates: Partial<CommentWithStats>) => void
  ): void {
    console.log('Comment vote event:', payload.eventType, payload)

    if (payload.new?.comment_id) {
      this.triggerCommentRefresh(payload.new.comment_id, onCommentUpdate)
    }
  }

  /**
   * Handle post vote events
   */
  private handlePostVoteEvent(
    payload: VoteRealtimePayload,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): void {
    console.log('Post vote event:', payload.eventType, payload)

    if (payload.new?.post_id && payload.new.post_id === this.currentThreadId) {
      this.triggerPostRefresh(payload.new.post_id, onPostUpdate)
    }
  }

  /**
   * Enrich comment data with related information
   */
  private async enrichCommentData(commentData: any): Promise<CommentWithStats | null> {
    console.warn('Comment data enrichment not fully implemented - using minimal data')

    const authorId = commentData.anonymous_user_id ?? commentData.user_id
    const voteScore = commentData.vote_score ?? commentData.score ?? 0
    const replyCount = commentData.reply_count ?? commentData.comment_count ?? 0

    return {
      id: commentData.id,
      content: commentData.content,
      post_id: commentData.post_id,
      parent_comment_id: commentData.parent_comment_id ?? commentData.parent_id ?? null,
      anonymous_user_id: authorId,
      created_at: commentData.created_at,
      updated_at: commentData.updated_at ?? commentData.created_at,
      is_deleted: Boolean(commentData.is_deleted ?? commentData.deleted_at),
      vote_score: voteScore,
      reply_count: replyCount,
      depth: commentData.depth ?? 0,
      anonymous_user: {
        id: authorId,
        emoji: (commentData.emoji ?? commentData.identity_emoji ?? '🎭') as any,
        color: (commentData.color ?? commentData.identity_color ?? 'purple') as any,
        subway_line: (commentData.subway_line ?? commentData.user_subway_line ?? 'A') as any,
        subway_color: (commentData.subway_color ?? commentData.user_subway_color ?? 'mta-blue') as any,
        device_id: '',
        created_at: '',
        last_seen_at: ''
      },
      user_vote: null,
      is_user_comment: this.currentUser?.id === authorId,
      replies: []
    }
  }

  /**
   * Trigger comment refresh for vote score updates
   */
  private async triggerCommentRefresh(
    commentId: string,
    onCommentUpdate: (commentId: string, updates: Partial<CommentWithStats>) => void
  ): Promise<void> {
    console.log(`Triggering refresh for comment ${commentId} due to vote change`)
    onCommentUpdate(commentId, {})
  }

  /**
   * Trigger post refresh for vote score updates
   */
  private async triggerPostRefresh(
    postId: string,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): Promise<void> {
    console.log(`Triggering refresh for post ${postId} due to vote change`)
    onPostUpdate(postId, {})
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    for (const [channelName, unsubscribe] of this.activeSubscriptions) {
      unsubscribe()
    }
    this.activeSubscriptions.clear()
    this.currentThreadId = null
  }
}
