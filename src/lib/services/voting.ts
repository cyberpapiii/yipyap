import { supabase } from '$lib/supabase'
import { OptimisticUpdateManager } from '$lib/realtime/optimisticUpdates'
import type { AnonymousUser, PostWithStats } from '$lib/types'

/**
 * Voting service with optimistic UI updates
 * Provides immediate feedback while ensuring data consistency
 */
export class VotingService {
  private optimisticManager = new OptimisticUpdateManager()
  private pendingOperations = new Set<string>()

  /**
   * Vote on a post with optimistic updates
   */
  async voteOnPost(
    post: PostWithStats,
    voteType: 'up' | 'down',
    currentUser: AnonymousUser,
    updateCallback: (postId: string, updates: Partial<PostWithStats>) => void,
    errorCallback?: (error: string) => void
  ): Promise<void> {
    const currentVote = post.user_vote
    const newVoteType = this.calculateNewVoteType(currentVote, voteType)

    console.log(`Voting on post ${post.id}: ${currentVote} -> ${newVoteType}`)

    // Apply optimistic update immediately
    const operationId = this.optimisticManager.applyOptimisticVote(
      post.id,
      'post',
      newVoteType,
      currentVote,
      post.vote_score,
      updateCallback
    )

    this.pendingOperations.add(operationId)

    try {
      // Send vote to server
      await this.sendVoteToServer(post.id, newVoteType, currentUser, 'post')

      // Confirm successful operation
      this.optimisticManager.confirmOperation(operationId)
      console.log(`Vote confirmed for post ${post.id}`)
    } catch (error) {
      console.error(`Vote failed for post ${post.id}:`, error)

      // Rollback optimistic update
      this.optimisticManager.rollbackOperation(operationId, (operation) => {
        if (operation.type === 'vote') {
          const voteOp = operation as any
          updateCallback(voteOp.targetId, {
            vote_score: voteOp.rollbackData.previousScore,
            user_vote: voteOp.rollbackData.previousVote
          })
        }
      })

      // Notify user of error
      if (errorCallback) {
        errorCallback(error instanceof Error ? error.message : 'Failed to vote')
      }
    } finally {
      this.pendingOperations.delete(operationId)
    }
  }

  /**
   * Vote on a comment with optimistic updates
   */
  async voteOnComment(
    commentId: string,
    currentVote: 'up' | 'down' | null,
    currentScore: number,
    voteType: 'up' | 'down',
    currentUser: AnonymousUser,
    updateCallback: (commentId: string, updates: any) => void,
    errorCallback?: (error: string) => void
  ): Promise<void> {
    const newVoteType = this.calculateNewVoteType(currentVote, voteType)

    console.log(`Voting on comment ${commentId}: ${currentVote} -> ${newVoteType}`)

    // Apply optimistic update immediately
    const operationId = this.optimisticManager.applyOptimisticVote(
      commentId,
      'comment',
      newVoteType,
      currentVote,
      currentScore,
      updateCallback
    )

    this.pendingOperations.add(operationId)

    try {
      // Send vote to server
      await this.sendVoteToServer(commentId, newVoteType, currentUser, 'comment')

      // Confirm successful operation
      this.optimisticManager.confirmOperation(operationId)
      console.log(`Vote confirmed for comment ${commentId}`)
    } catch (error) {
      console.error(`Vote failed for comment ${commentId}:`, error)

      // Rollback optimistic update
      this.optimisticManager.rollbackOperation(operationId, (operation) => {
        if (operation.type === 'vote') {
          const voteOp = operation as any
          updateCallback(voteOp.targetId, {
            vote_score: voteOp.rollbackData.previousScore,
            user_vote: voteOp.rollbackData.previousVote
          })
        }
      })

      // Notify user of error
      if (errorCallback) {
        errorCallback(error instanceof Error ? error.message : 'Failed to vote')
      }
    } finally {
      this.pendingOperations.delete(operationId)
    }
  }

  /**
   * Check if a post is currently being voted on
   */
  isPostVotePending(postId: string): boolean {
    const pendingOps = this.optimisticManager.getPendingOperations()
    return pendingOps.some(op =>
      op.type === 'vote' &&
      (op as any).targetId === postId &&
      (op as any).targetType === 'post'
    )
  }

  /**
   * Check if a comment is currently being voted on
   */
  isCommentVotePending(commentId: string): boolean {
    const pendingOps = this.optimisticManager.getPendingOperations()
    return pendingOps.some(op =>
      op.type === 'vote' &&
      (op as any).targetId === commentId &&
      (op as any).targetType === 'comment'
    )
  }

  /**
   * Get count of pending operations
   */
  getPendingOperationsCount(): number {
    return this.pendingOperations.size
  }

  /**
   * Cleanup expired operations
   */
  cleanup(): void {
    this.optimisticManager.cleanup()
  }

  /**
   * Calculate new vote type based on current vote and user action
   */
  private calculateNewVoteType(
    currentVote: 'up' | 'down' | null,
    voteType: 'up' | 'down'
  ): 'up' | 'down' | null {
    // If clicking the same vote type, toggle it off
    if (currentVote === voteType) {
      return null
    }
    // Otherwise, set the new vote type
    return voteType
  }

  /**
   * Send vote to server
   */
  private async sendVoteToServer(
    targetId: string,
    voteType: 'up' | 'down' | null,
    currentUser: AnonymousUser,
    targetType: 'post' | 'comment'
  ): Promise<void> {
    if (voteType === null) {
      // Remove vote
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq(targetType === 'post' ? 'post_id' : 'comment_id', targetId)
        .eq('user_id', currentUser.id)

      if (error) throw error
    } else {
      // Insert or update vote
      const voteData = {
        user_id: currentUser.id,
        vote_type: voteType === 'up' ? 1 : -1,
        ...(targetType === 'post'
          ? { post_id: targetId, comment_id: null }
          : { comment_id: targetId, post_id: null }
        )
      }

      const { error } = await supabase
        .from('votes')
        .upsert(voteData, {
          onConflict: targetType === 'post'
            ? 'user_id,post_id'
            : 'user_id,comment_id'
        })

      if (error) throw error
    }
  }
}

// Export singleton instance
export const votingService = new VotingService()

// Cleanup interval to prevent memory leaks
if (typeof window !== 'undefined') {
  setInterval(() => {
    votingService.cleanup()
  }, 30000) // Cleanup every 30 seconds
}