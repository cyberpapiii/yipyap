import type { RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeConnectionManager } from './connectionManager'
import type { PostWithStats, CommentWithStats, AnonymousUser, FeedType } from '$lib/types'
import type { PostsAPI } from '$lib/api/posts'

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
  // Track pending votes to prevent double-counting (optimistic + realtime)
  private pendingVotes = new Set<string>()

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
   * Register a pending vote (called before optimistic update)
   * Prevents realtime event from double-counting the score
   */
  registerPendingVote(targetId: string): void {
    this.pendingVotes.add(targetId)
    // Auto-clear after 5 seconds (fallback in case confirmation never comes)
    setTimeout(() => this.pendingVotes.delete(targetId), 5000)
  }

  /**
   * Clear a pending vote (called after API success/failure)
   */
  clearPendingVote(targetId: string): void {
    this.pendingVotes.delete(targetId)
  }

  /**
   * Check if a vote is pending (optimistic update already applied)
   */
  isVotePending(targetId: string): boolean {
    return this.pendingVotes.has(targetId)
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

          // IMPORTANT: Do NOT send vote_score updates from POST events!
          // Vote scores are already handled by VOTE events with proper pending vote tracking.
          // Sending vote_score here can cause race conditions where a delayed POST UPDATE
          // overwrites optimistic vote state after the user has already voted.
          // The trigger fires synchronously with the vote, but the realtime event
          // delivery can be delayed, causing stale data to overwrite newer state.

          // Only update non-vote-related fields from POST events
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
    const vote = payload.new || payload.old
    if (!vote?.post_id) return

    // If it's the current user, update their vote state AND score
    if (this.currentUser && vote.user_id === this.currentUser.id) {
      let userVote: 'up' | 'down' | null = null

      if (payload.eventType !== 'DELETE') {
        userVote = vote.vote_type === 1 ? 'up' : vote.vote_type === -1 ? 'down' : null
      }

      // Skip score update if optimistic update already applied (prevent double-count)
      if (this.isVotePending(vote.post_id)) {
        // Only update user_vote (score already handled by optimistic update)
        onPostUpdate(vote.post_id, { user_vote: userVote })
        this.clearPendingVote(vote.post_id)
        return
      }

      // Calculate score delta based on event type
      let scoreDelta = 0
      switch (payload.eventType) {
        case 'INSERT':
          scoreDelta = payload.new.vote_type
          break
        case 'DELETE':
          scoreDelta = -payload.old.vote_type
          break
        case 'UPDATE':
          scoreDelta = payload.new.vote_type - payload.old.vote_type
          break
      }

      onPostUpdate(vote.post_id, {
        user_vote: userVote,
        _scoreDelta: scoreDelta
      } as Partial<PostWithStats> & { _scoreDelta?: number })
    }
  }

  /**
   * Enrich post data with related information (anonymous_user, user_vote, etc.)
   */
  private async enrichPostData(postData: any): Promise<PostWithStats | null> {
    // Create enriched post data from realtime payload

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
  // Track pending votes to prevent double-counting (optimistic + realtime)
  private pendingVotes = new Set<string>()

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
   * Register a pending vote (called before optimistic update)
   */
  registerPendingVote(targetId: string): void {
    this.pendingVotes.add(targetId)
    setTimeout(() => this.pendingVotes.delete(targetId), 5000)
  }

  /**
   * Clear a pending vote (called after API success/failure)
   */
  clearPendingVote(targetId: string): void {
    this.pendingVotes.delete(targetId)
  }

  /**
   * Check if a vote is pending
   */
  isVotePending(targetId: string): boolean {
    return this.pendingVotes.has(targetId)
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

          // IMPORTANT: Do NOT send vote_score updates from COMMENT events!
          // Vote scores are already handled by VOTE events with proper pending vote tracking.
          // Same issue as with POST events - delayed realtime delivery can overwrite
          // optimistic state with stale data.

          // Only update non-vote-related fields from COMMENT events
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
    const vote = payload.new || payload.old
    if (!vote?.comment_id) return

    // If it's the current user, update their vote state AND score
    if (this.currentUser && vote.user_id === this.currentUser.id) {
      let userVote: 'up' | 'down' | null = null

      if (payload.eventType !== 'DELETE') {
        userVote = vote.vote_type === 1 ? 'up' : vote.vote_type === -1 ? 'down' : null
      }

      // Skip score update if optimistic update already applied (prevent double-count)
      if (this.isVotePending(vote.comment_id)) {
        onCommentUpdate(vote.comment_id, { user_vote: userVote })
        this.clearPendingVote(vote.comment_id)
        return
      }

      // Calculate score delta based on event type
      let scoreDelta = 0
      switch (payload.eventType) {
        case 'INSERT':
          scoreDelta = payload.new.vote_type
          break
        case 'DELETE':
          scoreDelta = -payload.old.vote_type
          break
        case 'UPDATE':
          scoreDelta = payload.new.vote_type - payload.old.vote_type
          break
      }

      onCommentUpdate(vote.comment_id, {
        user_vote: userVote,
        _scoreDelta: scoreDelta
      } as Partial<CommentWithStats> & { _scoreDelta?: number })
    }
  }

  /**
   * Handle post vote events
   */
  private handlePostVoteEvent(
    payload: VoteRealtimePayload,
    onPostUpdate: (postId: string, updates: Partial<PostWithStats>) => void
  ): void {
    const vote = payload.new || payload.old
    if (!vote?.post_id) return

    // Only handle if it matches current thread post
    if (vote.post_id !== this.currentThreadId) return

    // If it's the current user, update their vote state AND score
    if (this.currentUser && vote.user_id === this.currentUser.id) {
      let userVote: 'up' | 'down' | null = null

      if (payload.eventType !== 'DELETE') {
        userVote = vote.vote_type === 1 ? 'up' : vote.vote_type === -1 ? 'down' : null
      }

      // Skip score update if optimistic update already applied (prevent double-count)
      if (this.isVotePending(vote.post_id)) {
        onPostUpdate(vote.post_id, { user_vote: userVote })
        this.clearPendingVote(vote.post_id)
        return
      }

      // Calculate score delta based on event type
      let scoreDelta = 0
      switch (payload.eventType) {
        case 'INSERT':
          scoreDelta = payload.new.vote_type
          break
        case 'DELETE':
          scoreDelta = -payload.old.vote_type
          break
        case 'UPDATE':
          scoreDelta = payload.new.vote_type - payload.old.vote_type
          break
      }

      onPostUpdate(vote.post_id, {
        user_vote: userVote,
        _scoreDelta: scoreDelta
      } as Partial<PostWithStats> & { _scoreDelta?: number })
    }
  }

  /**
   * Enrich comment data with related information
   */
  private async enrichCommentData(commentData: any): Promise<CommentWithStats | null> {
    // Create enriched comment data from realtime payload

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
