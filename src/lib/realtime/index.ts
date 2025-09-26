// Re-export all real-time modules
export { RealtimeConnectionManager } from './connectionManager'
export { FeedSubscriptionManager, ThreadSubscriptionManager } from './subscriptionManager'
export { OptimisticUpdateManager } from './optimisticUpdates'

// Re-export types
export type {
  ConnectionStatus,
  ConnectionState,
  ReconnectionConfig
} from './connectionManager'

export type {
  RealtimeEventPayload,
  PostRealtimePayload,
  CommentRealtimePayload,
  VoteRealtimePayload
} from './subscriptionManager'

export type {
  OptimisticOperation,
  VoteOptimisticOperation,
  PostOptimisticOperation,
  CommentOptimisticOperation
} from './optimisticUpdates'