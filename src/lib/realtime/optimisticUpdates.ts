import type { PostWithStats, CommentWithStats, AnonymousUser } from '$lib/types'

export interface OptimisticOperation {
  id: string
  type: 'vote' | 'post' | 'comment'
  timestamp: number
  rollbackData: any
  confirmed: boolean
}

export interface VoteOptimisticOperation extends OptimisticOperation {
  type: 'vote'
  targetId: string
  targetType: 'post' | 'comment'
  voteType: 'up' | 'down' | null
  rollbackData: {
    previousVote: 'up' | 'down' | null
    previousScore: number
  }
}

export interface PostOptimisticOperation extends OptimisticOperation {
  type: 'post'
  postData: PostWithStats
  rollbackData: null // New posts don't need rollback data
}

export interface CommentOptimisticOperation extends OptimisticOperation {
  type: 'comment'
  commentData: CommentWithStats
  rollbackData: null // New comments don't need rollback data
}

/**
 * Manages optimistic UI updates with rollback capabilities
 * Provides immediate feedback while ensuring consistency with server state
 */
export class OptimisticUpdateManager {
  private operations = new Map<string, OptimisticOperation>()
  private timeoutHandlers = new Map<string, NodeJS.Timeout>()

  // Configuration
  private readonly OPERATION_TIMEOUT = 10000 // 10 seconds
  private readonly MAX_PENDING_OPERATIONS = 50

  /**
   * Apply optimistic vote update
   */
  applyOptimisticVote(
    targetId: string,
    targetType: 'post' | 'comment',
    newVoteType: 'up' | 'down' | null,
    currentVote: 'up' | 'down' | null,
    currentScore: number,
    updateCallback: (targetId: string, updates: any) => void
  ): string {
    const operationId = this.generateOperationId('vote', targetId)

    // Calculate optimistic score change
    const scoreChange = this.calculateVoteScoreChange(currentVote, newVoteType)
    const optimisticScore = currentScore + scoreChange

    // Create operation
    const operation: VoteOptimisticOperation = {
      id: operationId,
      type: 'vote',
      timestamp: Date.now(),
      targetId,
      targetType,
      voteType: newVoteType,
      rollbackData: {
        previousVote: currentVote,
        previousScore: currentScore
      },
      confirmed: false
    }

    // Store operation
    this.operations.set(operationId, operation)

    // Apply optimistic update
    const updates = {
      vote_score: optimisticScore,
      user_vote: newVoteType
    }

    updateCallback(targetId, updates)

    // Set up timeout for rollback
    this.setupOperationTimeout(operationId, () => {
      this.rollbackVoteOperation(operationId, updateCallback)
    })

    return operationId
  }

  /**
   * Apply optimistic post creation
   */
  applyOptimisticPost(
    postData: {
      content: string
      thread_id?: string | null
      parent_post_id?: string | null
    },
    currentUser: AnonymousUser,
    updateCallback: (post: PostWithStats) => void
  ): string {
    const operationId = this.generateOperationId('post')

    // Create optimistic post data
    const optimisticPost: PostWithStats = {
      id: `optimistic_${operationId}`,
      content: postData.content,
      anonymous_user_id: currentUser.id,
      thread_id: postData.thread_id || null,
      parent_post_id: postData.parent_post_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      vote_score: 0,
      comment_count: 0,
      anonymous_user: currentUser,
      user_vote: null,
      is_user_post: true,
      replies: []
    }

    // Create operation
    const operation: PostOptimisticOperation = {
      id: operationId,
      type: 'post',
      timestamp: Date.now(),
      postData: optimisticPost,
      rollbackData: null,
      confirmed: false
    }

    // Store operation
    this.operations.set(operationId, operation)

    // Apply optimistic update
    updateCallback(optimisticPost)

    // Set up timeout for removal
    this.setupOperationTimeout(operationId, () => {
      this.rollbackPostOperation(operationId, updateCallback)
    })

    return operationId
  }

  /**
   * Apply optimistic comment creation
   */
  applyOptimisticComment(
    commentData: {
      content: string
      post_id: string
      parent_comment_id?: string | null
    },
    currentUser: AnonymousUser,
    updateCallback: (comment: CommentWithStats) => void
  ): string {
    const operationId = this.generateOperationId('comment')

    // Create optimistic comment data
    const optimisticComment: CommentWithStats = {
      id: `optimistic_${operationId}`,
      content: commentData.content,
      post_id: commentData.post_id,
      parent_comment_id: commentData.parent_comment_id || null,
      anonymous_user_id: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      vote_score: 0,
      reply_count: 0,
      depth: commentData.parent_comment_id ? 1 : 0,
      anonymous_user: currentUser,
      user_vote: null,
      is_user_comment: true,
      replies: []
    }

    // Create operation
    const operation: CommentOptimisticOperation = {
      id: operationId,
      type: 'comment',
      timestamp: Date.now(),
      commentData: optimisticComment,
      rollbackData: null,
      confirmed: false
    }

    // Store operation
    this.operations.set(operationId, operation)

    // Apply optimistic update
    updateCallback(optimisticComment)

    // Set up timeout for removal
    this.setupOperationTimeout(operationId, () => {
      this.rollbackCommentOperation(operationId, updateCallback)
    })

    return operationId
  }

  /**
   * Confirm an operation was successful
   */
  confirmOperation(
    operationId: string,
    serverData?: any
  ): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      console.warn(`Operation ${operationId} not found for confirmation`)
      return
    }

    // Clear timeout
    const timeout = this.timeoutHandlers.get(operationId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeoutHandlers.delete(operationId)
    }

    // Mark as confirmed
    operation.confirmed = true

    // If we have server data, we might want to update the UI with the real data
    if (serverData) {
      // Could emit an event here to update UI with real server data
    }

    // Clean up after a delay
    setTimeout(() => {
      this.operations.delete(operationId)
    }, 1000)

  }

  /**
   * Rollback an operation that failed or timed out
   */
  rollbackOperation(
    operationId: string,
    rollbackCallback?: (operation: OptimisticOperation) => void
  ): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      console.warn(`Operation ${operationId} not found for rollback`)
      return
    }

    console.warn(`Rolling back operation: ${operationId}`)

    // Clear timeout
    const timeout = this.timeoutHandlers.get(operationId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeoutHandlers.delete(operationId)
    }

    // Execute rollback based on operation type
    if (rollbackCallback) {
      rollbackCallback(operation)
    } else {
      // Default rollback handling
      switch (operation.type) {
        case 'vote':
          // Would need to restore previous vote state
          console.warn('Vote rollback requires custom callback')
          break
        case 'post':
          // Would need to remove optimistic post
          console.warn('Post rollback requires custom callback')
          break
        case 'comment':
          // Would need to remove optimistic comment
          console.warn('Comment rollback requires custom callback')
          break
      }
    }

    // Clean up
    this.operations.delete(operationId)
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): OptimisticOperation[] {
    return Array.from(this.operations.values()).filter(op => !op.confirmed)
  }

  /**
   * Check if an operation is pending
   */
  isOperationPending(operationId: string): boolean {
    const operation = this.operations.get(operationId)
    return operation ? !operation.confirmed : false
  }

  /**
   * Clean up expired operations
   */
  cleanup(): void {
    const now = Date.now()
    const expiredOperations = []

    for (const [id, operation] of this.operations) {
      if (now - operation.timestamp > this.OPERATION_TIMEOUT * 2) {
        expiredOperations.push(id)
      }
    }

    for (const id of expiredOperations) {
      const timeout = this.timeoutHandlers.get(id)
      if (timeout) {
        clearTimeout(timeout)
        this.timeoutHandlers.delete(id)
      }
      this.operations.delete(id)
    }

    // Optionally report cleaned operations
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(type: string, targetId?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `${type}_${targetId || 'new'}_${timestamp}_${random}`
  }

  /**
   * Calculate vote score change based on current and new vote
   */
  private calculateVoteScoreChange(
    currentVote: 'up' | 'down' | null,
    newVote: 'up' | 'down' | null
  ): number {
    let change = 0

    // Remove current vote effect
    if (currentVote === 'up') change -= 1
    else if (currentVote === 'down') change += 1

    // Add new vote effect
    if (newVote === 'up') change += 1
    else if (newVote === 'down') change -= 1

    return change
  }

  /**
   * Set up timeout for operation rollback
   */
  private setupOperationTimeout(
    operationId: string,
    rollbackCallback: () => void
  ): void {
    // Clean up operations to prevent memory leaks
    if (this.operations.size > this.MAX_PENDING_OPERATIONS) {
      this.cleanup()
    }

    const timeout = setTimeout(() => {
      console.warn(`Operation ${operationId} timed out`)
      rollbackCallback()
    }, this.OPERATION_TIMEOUT)

    this.timeoutHandlers.set(operationId, timeout)
  }

  /**
   * Rollback vote operation
   */
  private rollbackVoteOperation(
    operationId: string,
    updateCallback: (targetId: string, updates: any) => void
  ): void {
    const operation = this.operations.get(operationId) as VoteOptimisticOperation
    if (!operation) return

    // Restore previous state
    const updates = {
      vote_score: operation.rollbackData.previousScore,
      user_vote: operation.rollbackData.previousVote
    }

    updateCallback(operation.targetId, updates)
    this.operations.delete(operationId)

  }

  /**
   * Rollback post operation
   */
  private rollbackPostOperation(
    operationId: string,
    removeCallback: (post: PostWithStats) => void
  ): void {
    const operation = this.operations.get(operationId) as PostOptimisticOperation
    if (!operation) return

    // Remove optimistic post
    removeCallback(operation.postData)
    this.operations.delete(operationId)

  }

  /**
   * Rollback comment operation
   */
  private rollbackCommentOperation(
    operationId: string,
    removeCallback: (comment: CommentWithStats) => void
  ): void {
    const operation = this.operations.get(operationId) as CommentOptimisticOperation
    if (!operation) return

    // Remove optimistic comment
    removeCallback(operation.commentData)
    this.operations.delete(operationId)

  }
}
