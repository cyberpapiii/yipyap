// Database Types
export interface Database {
  public: {
    Tables: {
      posts: {
        Row: Post
        Insert: PostInsert
        Update: PostUpdate
      }
      comments: {
        Row: Comment
        Insert: CommentInsert
        Update: CommentUpdate
      }
      votes: {
        Row: Vote
        Insert: VoteInsert
        Update: VoteUpdate
      }
      anonymous_users: {
        Row: AnonymousUser
        Insert: AnonymousUserInsert
        Update: AnonymousUserUpdate
      }
    }
    Views: {
      post_with_stats: {
        Row: PostWithStats
      }
      comment_with_stats: {
        Row: CommentWithStats
      }
    }
    Functions: Record<string, unknown>
    Enums: {
      vote_type: 'up' | 'down'
      subway_line: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'Z'
      subway_color: 'mta-blue' | 'mta-orange' | 'mta-light-green' | 'mta-brown' | 'mta-grey' | 'mta-yellow' | 'mta-red' | 'mta-dark-green' | 'mta-purple'
    }
  }
}

// Core Data Models
export interface Post {
  id: string
  content: string
  anonymous_user_id: string
  thread_id: string | null
  parent_post_id: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  vote_score: number
  comment_count: number
}

export interface PostInsert {
  content: string
  anonymous_user_id: string
  thread_id?: string | null
  parent_post_id?: string | null
}

export interface PostUpdate {
  content?: string
  is_deleted?: boolean
  vote_score?: number
  comment_count?: number
}

export interface Comment {
  id: string
  content: string
  post_id: string
  parent_comment_id: string | null
  anonymous_user_id: string
  created_at: string
  updated_at: string
  is_deleted: boolean
  vote_score: number
  reply_count: number
  depth: number
}

export interface CommentInsert {
  content: string
  post_id: string
  parent_comment_id?: string | null
  anonymous_user_id: string
  depth?: number
}

export interface CommentUpdate {
  content?: string
  is_deleted?: boolean
  vote_score?: number
  reply_count?: number
}

export interface Vote {
  id: string
  anonymous_user_id: string
  post_id: string | null
  comment_id: string | null
  vote_type: 'up' | 'down'
  created_at: string
}

export interface VoteInsert {
  anonymous_user_id: string
  post_id?: string | null
  comment_id?: string | null
  vote_type: 'up' | 'down'
}

export interface VoteUpdate {
  vote_type?: 'up' | 'down'
}

export interface AnonymousUser {
  id: string
  device_id: string
  subway_line: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'Z'
  subway_color: 'mta-blue' | 'mta-orange' | 'mta-light-green' | 'mta-brown' | 'mta-grey' | 'mta-yellow' | 'mta-red' | 'mta-dark-green' | 'mta-purple'
  created_at: string
  last_seen_at: string
}

export interface AnonymousUserInsert {
  device_id: string
  subway_line: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'Z'
  subway_color: 'mta-blue' | 'mta-orange' | 'mta-light-green' | 'mta-brown' | 'mta-grey' | 'mta-yellow' | 'mta-red' | 'mta-dark-green' | 'mta-purple'
}

export interface AnonymousUserUpdate {
  subway_line?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'Z'
  subway_color?: 'mta-blue' | 'mta-orange' | 'mta-light-green' | 'mta-brown' | 'mta-grey' | 'mta-yellow' | 'mta-red' | 'mta-dark-green' | 'mta-purple'
  last_seen_at?: string
}

// Enhanced Models with Stats
export interface PostWithStats extends Post {
  anonymous_user: AnonymousUser
  user_vote?: 'up' | 'down' | null
  is_user_post: boolean
  replies: CommentWithStats[]
}

export interface CommentWithStats extends Comment {
  anonymous_user: AnonymousUser
  user_vote?: 'up' | 'down' | null
  is_user_comment: boolean
  replies: CommentWithStats[]
}

// UI State Types
export interface FeedState {
  posts: PostWithStats[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

export interface ThreadState {
  post: PostWithStats | null
  comments: CommentWithStats[]
  loading: boolean
  error: string | null
  hasMore: boolean
  cursor: string | null
}

export interface ComposeState {
  content: string
  isSubmitting: boolean
  error: string | null
  replyTo?: {
    type: 'post' | 'comment'
    id: string
    content: string
    author: AnonymousUser
  }
}

// Anonymous Identity Types
export type SubwayLine = '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'L' | 'M' | 'N' | 'Q' | 'R' | 'W' | 'Z'
export type AnonymousColor = 'purple' | 'blue' | 'green' | 'orange' | 'red'
export type AnonymousEmoji = '🎭' | '🦄' | '🚀' | '🌟' | '🔥' | '💫' | '🎨' | '🌈' | '⚡' | '🎪'

export interface AnonymousIdentity {
  emoji: AnonymousEmoji
  color: AnonymousColor
}

// Feed Types
export type FeedType = 'hot' | 'new'
export type SortOrder = 'hot' | 'new' | 'top'

// Navigation Types
export interface NavItem {
  name: string
  href: string
  icon: any // Lucide icon component
  isActive?: boolean
}

// Component Props Types
export interface PostCardProps {
  post: PostWithStats
  showReplies?: boolean
  isInThread?: boolean
  onVote?: (postId: string, voteType: 'up' | 'down' | null) => Promise<void>
  onReply?: (post: PostWithStats) => void
  onDelete?: (postId: string) => Promise<void>
}

export interface CommentCardProps {
  comment: CommentWithStats
  depth?: number
  maxDepth?: number
  onVote?: (commentId: string, voteType: 'up' | 'down' | null) => Promise<void>
  onReply?: (comment: CommentWithStats) => void
  onDelete?: (commentId: string) => Promise<void>
}

export interface VoteButtonsProps {
  voteScore: number
  userVote?: 'up' | 'down' | null
  onVote: (voteType: 'up' | 'down' | null) => Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  orientation?: 'vertical' | 'horizontal'
}

export interface AnonymousAvatarProps {
  user: AnonymousUser
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
  total?: number
}

// Form Types
export interface PostFormData {
  content: string
  parentPostId?: string
  threadId?: string
}

export interface CommentFormData {
  content: string
  postId: string
  parentCommentId?: string
}

// Error Types
export interface AppError {
  message: string
  code?: string
  details?: any
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>
}[keyof T]