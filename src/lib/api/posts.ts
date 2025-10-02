import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  PostWithStats,
  CommentWithStats,
  PostFormData,
  CommentFormData,
  PaginatedResponse,
  FeedType,
  AnonymousUser,
  CommunityType,
} from '$lib/types'
import { getSubwayLinesForCommunity } from '$lib/config/communities'

/**
 * API functions for posts and comments
 */

export class PostsAPI {
  constructor(private supabase: SupabaseClient<Database>) {}

  private voteToInt(v: 'up' | 'down' | null): number {
    if (v === 'up') return 1
    if (v === 'down') return -1
    return 0 // null vote (remove vote)
  }

  private fallbackAnonymousUser(userId: string): AnonymousUser {
	return {
	  id: userId,
	  device_id: '',
	  subway_line: 'A' as 'A',
	  subway_color: 'mta-blue' as 'mta-blue',
	  created_at: '',
	  last_seen_at: ''
	}
  }

  private async getAnonymousProfiles(userIds: string[]): Promise<Map<string, AnonymousUser>> {
    const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
    if (!uniqueIds.length) {
      return new Map()
    }

    const { data, error } = await (this.supabase as any)
      .from('anonymous_users')
      .select('id, device_id, subway_line, subway_color, created_at, last_seen_at')
      .in('id', uniqueIds)

    if (error) throw error

    const map = new Map<string, AnonymousUser>()
    for (const row of data || []) {
      map.set(row.id, {
        id: row.id,
        device_id: row.device_id ?? '',
        subway_line: row.subway_line as AnonymousUser['subway_line'],
        subway_color: row.subway_color as AnonymousUser['subway_color'],
        created_at: row.created_at ?? '',
        last_seen_at: row.last_seen_at ?? row.created_at ?? ''
      })
    }
    return map
  }

  private async attachAnonymousIdentities<T extends { anonymous_user_id: string }>(
    items: T[]
  ): Promise<Array<T & { anonymous_user: AnonymousUser }>> {
    if (!items?.length) {
      return []
    }

    const identities = await this.getAnonymousProfiles(items.map((item) => item.anonymous_user_id))

    return items.map((item) => ({
      ...item,
      anonymous_user: identities.get(item.anonymous_user_id) ?? this.fallbackAnonymousUser(item.anonymous_user_id)
    }))
  }

	/**
	 * Get posts for feed (hot or new)
	 */
	async getFeedPosts(
		feedType: FeedType,
		cursor?: string,
		limit = 20,
		currentUser?: AnonymousUser | null,
		community: CommunityType = 'nyc'
	): Promise<PaginatedResponse<PostWithStats>> {
		try {
			// Build query with community filtering
			const subwayLines = getSubwayLinesForCommunity(community)

			// If filtering by community, we need to JOIN with anonymous_users table
			let query: any

			if (community === 'nyc' || subwayLines.length === 0) {
				// No filtering - use simple query
				query = (this.supabase as any)
				  .from('post_with_stats')
				  .select('*')
				  .is('parent_post_id', null)
				  .eq('is_deleted', false)
				  .limit(limit)
			} else {
				// Filter by community - use denormalized user_subway_line field
				// This avoids JOIN and relationship ambiguity with PGRST201 error
				query = (this.supabase as any)
				  .from('post_with_stats')
				  .select('*')
				  .is('parent_post_id', null)
				  .eq('is_deleted', false)
				  .in('user_subway_line', subwayLines)
				  .limit(limit)
			}

			// Apply ordering
			if (feedType === 'hot') {
				query = query.order('vote_score', { ascending: false }).order('created_at', { ascending: false })
			} else {
				query = query.order('created_at', { ascending: false })
			}

			// Apply cursor pagination
			if (cursor) query = query.lt('created_at', cursor)

			const { data: posts, error } = await query
			if (error) throw error
			return await this.enrichPosts(posts || [], limit, currentUser)
		} catch (error: any) {
			if (error?.code === 'PGRST205') {
				if (feedType === 'hot') {
					const { data: hot, error: err } = await (this.supabase as any)
					  .from('hot_posts')
					  .select('*')
					  .eq('community', 'dimes_square')
					  .is('deleted_at', null)
					  .order('hot_score', { ascending: false })
					  .order('created_at', { ascending: false })
					  .limit(limit)
					if (err) throw err
					const mapped = (hot || []).map((p: any) => ({
						id: p.id,
						content: p.content,
						anonymous_user_id: p.user_id,
						thread_id: null,
						parent_post_id: null,
						created_at: p.created_at,
						updated_at: p.updated_at,
						is_deleted: !!p.deleted_at,
						vote_score: p.score ?? 0,
						comment_count: p.comment_count ?? 0
					}))
					return await this.enrichPosts(mapped, limit, currentUser)
				} else {
					const { data: posts, error: err } = await (this.supabase as any)
					  .from('posts')
					  .select('*')
					  .eq('community', 'dimes_square')
					  .is('deleted_at', null)
					  .order('created_at', { ascending: false })
					  .limit(limit)
					if (err) throw err
					const mapped = (posts || []).map((p: any) => ({
						id: p.id,
						content: p.content,
						anonymous_user_id: p.user_id,
						thread_id: null,
						parent_post_id: null,
						created_at: p.created_at,
						updated_at: p.updated_at,
						is_deleted: !!p.deleted_at,
						vote_score: p.score ?? 0,
						comment_count: p.comment_count ?? 0
					}))
					return await this.enrichPosts(mapped, limit, currentUser)
				}
			}
			console.error('Error fetching feed posts:', error)
			throw error
		}
	}

	private async enrichPosts(posts: any[], limit: number, currentUser?: AnonymousUser | null): Promise<PaginatedResponse<PostWithStats>> {
		const postsWithVotes = currentUser && posts?.length
		  ? await this.addUserVotesToPosts(posts, currentUser.id)
		  : posts || []
		const withAnon = await this.attachAnonymousIdentities(postsWithVotes)

		// Batch fetch all replies for all posts in one query (fixes N+1)
		let repliesMap = new Map<string, any[]>()
		if (withAnon.length > 0) {
			try {
				const postIds = withAnon.map(p => p.id)
				const { data: allReplies, error } = await (this.supabase as any)
					.from('comment_with_stats')
					.select('*')
					.in('post_id', postIds)
					.is('parent_comment_id', null)
					.order('vote_score', { ascending: false })
					.order('created_at', { ascending: false })

				if (!error && allReplies) {
					// Add user votes to replies if we have a current user
					const repliesWithVotes = currentUser
						? await this.addUserVotesToComments(allReplies, currentUser.id)
						: allReplies

					// Attach anonymous identities to replies
					const repliesWithIdentities = await this.attachAnonymousIdentities(repliesWithVotes) as any[]

					// Group by post_id and take top 2 per post
					for (const reply of repliesWithIdentities) {
						if (!repliesMap.has(reply.post_id)) {
							repliesMap.set(reply.post_id, [])
						}
						const postReplies = repliesMap.get(reply.post_id)!
						if (postReplies.length < 2) {
							postReplies.push({
								...reply,
								is_user_comment: currentUser ? reply.anonymous_user_id === currentUser.id : false,
								replies: []
							})
						}
					}
				}
			} catch (error) {
				console.error('Failed to batch fetch replies:', error)
			}
		}

		// Attach replies to posts
		const postsWithReplies = withAnon.map((post) => ({
			...post,
			is_user_post: currentUser ? post.anonymous_user_id === currentUser.id : false,
			replies: repliesMap.get(post.id) || []
		}))

		const hasMore = posts?.length === limit
		const nextCursor = posts?.length ? posts[posts.length - 1].created_at : null
		return { data: postsWithReplies, hasMore, nextCursor }
	}

	/**
	 * Get a single post with full thread
	 */
	async getPost(
		postId: string,
		currentUser?: AnonymousUser | null
	): Promise<PostWithStats | null> {
		try {
			const { data: post, error } = await (this.supabase as any)
				.from('post_with_stats')
				.select('*')
				.eq('id', postId)
				.single()
			if (error) throw error
			if (!post) return null
				const postWithVote = currentUser
				  ? await this.addUserVotesToPosts([post], currentUser.id)
				  : [post]
				let repliesData: any = { data: [] }
				try {
				  repliesData = await this.getPostReplies(postId, 0, 100, currentUser)
				} catch {}
				const enriched = await this.attachAnonymousIdentities(postWithVote)
				const postWithIdentity = enriched[0] ?? {
				  ...postWithVote[0],
				  anonymous_user: this.fallbackAnonymousUser(post.anonymous_user_id)
				}
				return {
				  ...postWithIdentity,
				  is_user_post: currentUser ? post.anonymous_user_id === currentUser.id : false,
				  replies: repliesData.data
				}
		} catch (error: any) {
			if (error?.code === 'PGRST205') {
				const { data: p, error: err } = await (this.supabase as any)
				  .from('posts')
				  .select('*')
				  .eq('id', postId)
				  .single()
				if (err) throw err
				const base: any = {
					id: p.id,
					content: p.content,
					anonymous_user_id: p.user_id,
					thread_id: null,
					parent_post_id: null,
					created_at: p.created_at,
					updated_at: p.updated_at,
					is_deleted: !!p.deleted_at,
					vote_score: p.score ?? 0,
					comment_count: p.comment_count ?? 0
				}
				const postWithVote = currentUser
				  ? (await this.addUserVotesToPosts([base], currentUser.id))[0]
				  : base
				let repliesData: any = { data: [] }
				try {
				  repliesData = await this.getPostReplies(postId, 0, 100, currentUser)
				} catch {}
				const enriched = await this.attachAnonymousIdentities([postWithVote])
				const postWithIdentity = enriched[0] ?? {
				  ...postWithVote,
				  anonymous_user: this.fallbackAnonymousUser(base.anonymous_user_id)
				}
				return {
				  ...postWithIdentity,
				  is_user_post: currentUser ? base.anonymous_user_id === currentUser.id : false,
				  replies: repliesData.data
				}
			}
			console.error('Error fetching post:', error)
			throw error
		}
	}

	/**
	 * Get replies to a post
	 */
	async getPostReplies(
		postId: string,
		offset = 0,
		limit = 20,
		currentUser?: AnonymousUser | null
	): Promise<PaginatedResponse<CommentWithStats>> {
		try {
			const { data: comments, error } = await this.supabase
				.from('comment_with_stats')
				.select(`*
				`)
				.eq('post_id', postId)
				.is('parent_comment_id', null) // Top-level comments only
				.order('vote_score', { ascending: false })
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1)

			if (error) throw error

			// Get user votes
			const commentsWithVotes = currentUser && comments?.length
			  ? await this.addUserVotesToComments(comments, currentUser.id)
			  : comments || []

				const commentsWithIdentity = await this.attachAnonymousIdentities(commentsWithVotes)

				// PERFORMANCE FIX: Batch fetch all nested replies in one query instead of N+1
				// This reduces 20+ queries to just 1 query for a typical thread
				const commentIds = commentsWithIdentity.map(c => c.id)
				let repliesMap = new Map<string, any[]>()

				if (commentIds.length > 0) {
					// Fetch ALL nested replies at once
					const { data: allReplies, error: repliesError } = await this.supabase
						.from('comment_with_stats')
						.select('*')
						.in('parent_comment_id', commentIds)
						.order('vote_score', { ascending: false })
						.order('created_at', { ascending: false })

					if (!repliesError && allReplies) {
						// Add user votes to all replies in one batch
						const repliesWithVotes = currentUser
							? await this.addUserVotesToComments(allReplies, currentUser.id)
							: allReplies

						// Attach identities to all replies in one batch
						const repliesWithIdentities = await this.attachAnonymousIdentities(repliesWithVotes)

						// Group replies by parent_comment_id
						for (const reply of repliesWithIdentities) {
							if (!repliesMap.has(reply.parent_comment_id)) {
								repliesMap.set(reply.parent_comment_id, [])
							}
							repliesMap.get(reply.parent_comment_id)!.push({
								...reply,
								is_user_comment: currentUser ? reply.anonymous_user_id === currentUser.id : false,
								replies: [] // Only one level of nesting
							})
						}
					}
				}

				// Attach grouped replies to comments (no async needed!)
				const commentsWithReplies = commentsWithIdentity.map(comment => ({
					...comment,
					is_user_comment: currentUser ? comment.anonymous_user_id === currentUser.id : false,
					replies: repliesMap.get(comment.id) || []
				}))

			const hasMore = comments?.length === limit

			return {
				data: commentsWithReplies,
				hasMore,
				nextCursor: null // Comments use offset-based pagination
			}
		} catch (error) {
			console.error('Error fetching post replies:', error)
			throw error
		}
	}

	/**
	 * Get nested replies to a comment
	 */
  async getCommentReplies(
    commentId: string,
    currentUser?: AnonymousUser | null,
    depth = 0,
    maxDepth = 2
  ): Promise<CommentWithStats[]> {
		if (depth >= maxDepth) return []

		try {
			const { data: replies, error } = await this.supabase
				.from('comment_with_stats')
				.select(`*`)
				.eq('parent_comment_id', commentId)
				.order('vote_score', { ascending: false })
				.order('created_at', { ascending: false })
				.limit(10) // Limit nested replies

			if (error) throw error
			if (!replies?.length) return []

			// Get user votes
			const repliesWithVotes = currentUser
			  ? await this.addUserVotesToComments(replies, currentUser.id)
			  : replies

				const repliesWithIdentity = await this.attachAnonymousIdentities(repliesWithVotes)
				const repliesWithNestedReplies = await Promise.all(
					repliesWithIdentity.map(async (reply) => {
						const nestedReplies = await this.getCommentReplies(
							reply.id,
							currentUser,
							depth + 1,
							maxDepth
						)
						return {
						  ...reply,
						  is_user_comment: currentUser ? reply.anonymous_user_id === currentUser.id : false,
						  replies: nestedReplies
						}
					})
				)

			return repliesWithNestedReplies
		} catch (error) {
			console.error('Error fetching comment replies:', error)
			return []
		}
	}

	/**
	 * Create a new post
	 */
  async createPost(
    data: PostFormData,
    currentUser: AnonymousUser
  ): Promise<PostWithStats> {
    try {
      // 1. Use RPC to respect RLS and server-side validations
      const { data: created, error } = await (this.supabase as any)
        .rpc('rpc_create_post', {
          p_user: currentUser.id,
          p_content: data.content
        });
      if (error) throw error;

      // 2. Fetch the single created post directly from the view
      const { data: newPost, error: fetchError } = await this.supabase
        .from('post_with_stats')
        .select('*')
        .eq('id', created.id)
        .single();
      if (fetchError) throw fetchError;

      const typedPost = newPost as PostWithStats | null;
      if (!typedPost) {
        throw new Error('Failed to retrieve created post');
      }

      // 3. Manually enrich the post with identity and vote info (for consistency)
      const identities = await this.getAnonymousProfiles([typedPost.anonymous_user_id]);
      const anonymousUser = identities.get(typedPost.anonymous_user_id) ?? this.fallbackAnonymousUser(typedPost.anonymous_user_id);

      return {
        ...typedPost,
        anonymous_user: anonymousUser,
        is_user_post: true,
        user_vote: null, // A new post has no votes from the user yet
        replies: [] // A new post has no replies yet
      };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

	/**
	 * Create a new comment
	 */
  async createComment(
    data: CommentFormData,
    currentUser: AnonymousUser
  ): Promise<CommentWithStats> {
    try {
      // Use RPC to respect RLS and validations
      const { data: created, error } = await (this.supabase as any)
        .rpc('rpc_create_comment', {
          p_user: currentUser.id,
          p_post: data.postId,
          p_parent: data.parentCommentId || null,
          p_content: data.content
        })
      if (error) throw error

      const { data: fullComment, error: fetchError } = await this.supabase
        .from('comment_with_stats')
        .select(`*`)
        .eq('id', created.id)
        .single()
      if (fetchError) throw fetchError

      const typedComment = fullComment as CommentWithStats | null
      if (!typedComment) {
        throw new Error('Failed to retrieve created comment')
      }

      const identities = await this.getAnonymousProfiles([typedComment.anonymous_user_id])
      const anonymousUser = identities.get(typedComment.anonymous_user_id) ?? this.fallbackAnonymousUser(typedComment.anonymous_user_id)

      return {
        ...typedComment,
        anonymous_user: anonymousUser,
        is_user_comment: true,
        user_vote: null,
        replies: []
      }
    } catch (error) {
      console.error('Error creating comment:', error)
      throw error
    }
  }

	/**
	 * Vote on a post
	 */
  async voteOnPost(
    postId: string,
    voteType: 'up' | 'down' | null,
    currentUser: AnonymousUser
  ): Promise<void> {
    if (!currentUser?.id) {
      throw new Error('User must be authenticated to vote')
    }

    try {
      const v = this.voteToInt(voteType)
      const { error } = await (this.supabase as any)
        .rpc('rpc_vote_post', { p_user: currentUser.id, p_post: postId, p_vote: v })
      if (error) throw error
    } catch (error) {
      console.error('Error voting on post:', error)
      throw error
    }
  }

	/**
	 * Vote on a comment
	 */
  async voteOnComment(
    commentId: string,
    voteType: 'up' | 'down' | null,
    currentUser: AnonymousUser
  ): Promise<void> {
    if (!currentUser?.id) {
      throw new Error('User must be authenticated to vote')
    }

    try {
      const v = this.voteToInt(voteType)
      const { error } = await (this.supabase as any)
        .rpc('rpc_vote_comment', { p_user: currentUser.id, p_comment: commentId, p_vote: v })
      if (error) throw error
    } catch (error) {
      console.error('Error voting on comment:', error)
      throw error
    }
  }

	/**
	 * Delete a post (soft delete)
	 */
  async deletePost(
    postId: string,
    currentUser: AnonymousUser
  ): Promise<void> {
    try {
      const { error } = await (this.supabase as any)
        .rpc('rpc_delete_post', {
          p_user: currentUser.id,
          p_post: postId
        })

      if (error) throw error
    } catch (error) {
      console.error('Error deleting post:', error)
      throw error
    }
  }

	/**
	 * Delete a comment (soft delete)
	 */
  async deleteComment(
    commentId: string,
    currentUser: AnonymousUser
  ): Promise<void> {
    try {
      const { error } = await (this.supabase as any)
        .rpc('rpc_delete_comment', {
          p_user: currentUser.id,
          p_comment: commentId
        })

      if (error) throw error
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw error
    }
  }

	/**
	 * Add user votes to posts
	 */
	private async addUserVotesToPosts(
		posts: any[],
		userId: string
	): Promise<any[]> {
		if (!posts.length) return posts

		const postIds = posts.map(p => p.id)
		const { data: votes } = await this.supabase
		  .from('votes')
		  .select('post_id, vote_type')
		  .in('post_id', postIds)
		  .eq('user_id', userId)

		const typedVotes = (votes || []) as Array<{ post_id: string | null; vote_type: number | null }>
		const voteMap = new Map<string, number | null>(
		  typedVotes
		    .filter((v) => Boolean(v.post_id))
		    .map((v) => [v.post_id as string, v.vote_type])
		)

		return posts.map((post: any) => ({
		  ...post,
		  user_vote: voteMap.get(post.id) === 1 ? 'up' : voteMap.get(post.id) === -1 ? 'down' : null
		}))
	}

	/**
	 * Add user votes to comments
	 */
	private async addUserVotesToComments(
		comments: any[],
		userId: string
	): Promise<any[]> {
		if (!comments.length) return comments

		const commentIds = comments.map(c => c.id)
		const { data: votes } = await this.supabase
		  .from('votes')
		  .select('comment_id, vote_type')
		  .in('comment_id', commentIds)
		  .eq('user_id', userId)

		const typedVotes = (votes || []) as Array<{ comment_id: string | null; vote_type: number | null }>
		const voteMap = new Map<string, number | null>(
		  typedVotes
		    .filter((v) => Boolean(v.comment_id))
		    .map((v) => [v.comment_id as string, v.vote_type])
		)

		return comments.map((comment: any) => ({
		  ...comment,
		  user_vote: voteMap.get(comment.id) === 1 ? 'up' : voteMap.get(comment.id) === -1 ? 'down' : null
		}))
}
}
