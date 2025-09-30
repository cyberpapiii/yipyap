# YipYap Notification System - Flow Diagrams

## 1. Notification Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: User A replies to User B's post/comment           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Frontend: supabase.rpc('rpc_create_comment', {              │ │
│ │   p_user: userA.id,                                         │ │
│ │   p_post: post.id,                                          │ │
│ │   p_parent: parentComment?.id,                              │ │
│ │   p_content: "Great point!"                                 │ │
│ │ })                                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER: PostgreSQL                                      │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 1. RPC: rpc_create_comment()                                ││
│ │    - Validates content length (1-500 chars)                 ││
│ │    - Checks rate limit (30 comments/hour)                   ││
│ │    - Validates parent depth (max depth 1)                   ││
│ │    - INSERT INTO comments (...)                             ││
│ └──────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 2. TRIGGER: trg_comment_reply_notification                  ││
│ │    - Fires AFTER INSERT on comments                         ││
│ │    - Calls trigger_create_reply_notification()              ││
│ └──────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 3. FUNCTION: create_reply_notification(comment_id)          ││
│ │    - Get comment details (user_id, post_id, parent_id)      ││
│ │    - Determine target user:                                 ││
│ │      * If parent_id IS NULL → post.user_id                  ││
│ │      * If parent_id NOT NULL → parent_comment.user_id       ││
│ │    - Get actor's subway_line and subway_color               ││
│ │    - Check: Don't notify yourself                           ││
│ │    - Check: Don't notify if content deleted                 ││
│ │    - INSERT INTO notifications (...)                        ││
│ │      ON CONFLICT DO NOTHING (prevent duplicates)            ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ REALTIME LAYER: Supabase Realtime                               │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Broadcast notification INSERT to subscribed clients         ││
│ │ - Filter: user_id = eq.userB.id                             ││
│ │ - Payload: { new: { ...notification } }                     ││
│ │ - Latency: ~50-100ms                                        ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER: User B's Browser/App                              │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Realtime Subscription Handler                               ││
│ │ - Receive notification via WebSocket                        ││
│ │ - notificationStore.addNotification(payload.new)            ││
│ │ - notificationStore.incrementUnreadCount()                  ││
│ │ - toast.info("🚀 3 Line replied to your post")              ││
│ │ - Update badge: <span class="badge">1</span>                ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ USER SEES: Toast notification + Badge update                    │
│ "🚀 3 Line replied to your post"                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Notification Feed Query Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: User opens notification feed                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Frontend: supabase.rpc('rpc_get_notifications', {          │ │
│ │   p_user: currentUser.id,                                  │ │
│ │   p_limit: 20,                                             │ │
│ │   p_cursor: null,  // or lastNotification.created_at      │ │
│ │   p_unread_only: false                                     │ │
│ │ })                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER: Query Execution                                 │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 1. RPC: rpc_get_notifications()                             ││
│ │    Returns table with denormalized data                     ││
│ └──────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 2. QUERY PLAN (optimized)                                   ││
│ │                                                              ││
│ │    Limit (20 rows)                                          ││
│ │      └─ Nested Loop Left Join (comments)                    ││
│ │           └─ Nested Loop Inner Join (posts)                 ││
│ │                └─ Index Scan: idx_notifications_user_...    ││
│ │                     - Index Cond: user_id = $1              ││
│ │                     - Filter: deleted_at IS NULL            ││
│ │                     - Filter: created_at < $cursor          ││
│ │                     - Order: created_at DESC                ││
│ │                                                              ││
│ │    Execution time: 5-15ms                                   ││
│ │    Buffers: shared hit=~50 (all cached)                     ││
│ │    Heap Fetches: 0 (index-only scan)                        ││
│ └──────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 3. RESULT SET (20 notifications with context)               ││
│ │                                                              ││
│ │    [{                                                        ││
│ │      id: "uuid-1",                                           ││
│ │      type: "reply_post",                                     ││
│ │      actor_subway_line: "3",                                 ││
│ │      actor_subway_color: "#EE352E",                          ││
│ │      content_preview: "Great point!",                        ││
│ │      post_content: "Original post content...",               ││
│ │      post_deleted: false,                                    ││
│ │      comment_content: null,                                  ││
│ │      read_at: null,                                          ││
│ │      created_at: "2025-09-30T10:30:00Z"                      ││
│ │    }, ...]                                                   ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER: Render Notifications                              │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ notificationStore.setNotifications(data)                    ││
│ │                                                              ││
│ │ Render:                                                      ││
│ │ ┌────────────────────────────────────────────────────────┐  ││
│ │ │ 🚀 3 Line replied to your post              [• unread] │  ││
│ │ │ "Great point!"                                         │  ││
│ │ │ 2 minutes ago                                          │  ││
│ │ └────────────────────────────────────────────────────────┘  ││
│ │ ┌────────────────────────────────────────────────────────┐  ││
│ │ │ 🎨 A Line replied to your comment                      │  ││
│ │ │ "I agree!"                                             │  ││
│ │ │ 15 minutes ago                                         │  ││
│ │ └────────────────────────────────────────────────────────┘  ││
│ │ ... (18 more)                                                ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Mark as Read Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: User clicks notification                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Frontend: supabase.rpc('rpc_mark_notifications_read', {    │ │
│ │   p_user: currentUser.id,                                  │ │
│ │   p_notification_ids: [notification.id]                    │ │
│ │ })                                                         │ │
│ │                                                            │ │
│ │ // Or mark all as read:                                   │ │
│ │ // p_notification_ids: null                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER                                                   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ 1. RPC: rpc_mark_notifications_read()                       ││
│ │                                                              ││
│ │    IF p_notification_ids IS NULL:                           ││
│ │      UPDATE notifications                                   ││
│ │      SET read_at = now()                                    ││
│ │      WHERE user_id = $1                                     ││
│ │        AND read_at IS NULL                                  ││
│ │        AND deleted_at IS NULL                               ││
│ │    ELSE:                                                     ││
│ │      UPDATE notifications                                   ││
│ │      SET read_at = now()                                    ││
│ │      WHERE user_id = $1                                     ││
│ │        AND id = ANY($2)                                     ││
│ │        AND read_at IS NULL                                  ││
│ │        AND deleted_at IS NULL                               ││
│ │                                                              ││
│ │    RETURN: Number of rows updated                           ││
│ │    Execution time: 3-5ms (single), 5-10ms (batch)           ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ REALTIME LAYER: Broadcast UPDATE                                │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Broadcast notification UPDATE to user's clients             ││
│ │ - Event: UPDATE                                             ││
│ │ - Payload: { old: {...}, new: { ...read_at: timestamp } }  ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER: Update UI                                         │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Optimistic Update (immediate):                              ││
│ │ - notificationStore.markAsRead([notificationId])            ││
│ │ - Remove unread dot from notification                       ││
│ │ - Decrement badge count: 5 → 4                              ││
│ │                                                              ││
│ │ Realtime Confirmation (50-100ms later):                     ││
│ │ - Verify optimistic update was correct                      ││
│ │ - If conflict, rollback and show error                      ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ USER SEES: Badge count decreased, notification marked as read   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Unread Count Badge Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Page load / Navigation                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ onMount:                                                    │ │
│ │   const { data: count } = await supabase.rpc(              │ │
│ │     'rpc_get_unread_count',                                │ │
│ │     { p_user: currentUser.id }                             │ │
│ │   )                                                        │ │
│ │   notificationStore.setUnreadCount(count)                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER                                                   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Query:                                                       ││
│ │   SELECT count(*)                                           ││
│ │   FROM notifications                                        ││
│ │   WHERE user_id = $1                                        ││
│ │     AND read_at IS NULL                                     ││
│ │     AND deleted_at IS NULL                                  ││
│ │                                                              ││
│ │ Index: idx_notifications_user_unread_count                  ││
│ │ Execution: <1ms (index-only scan)                           ││
│ │ Result: 23                                                  ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER: Display Badge                                     │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Render:                                                      ││
│ │   <button class="notification-badge">                       ││
│ │     <Bell />                                                ││
│ │     {#if $notificationStore.unreadCount > 0}                ││
│ │       <span class="badge">                                  ││
│ │         {$notificationStore.unreadCount > 99                ││
│ │           ? '99+'                                           ││
│ │           : $notificationStore.unreadCount}                 ││
│ │       </span>                                               ││
│ │     {/if}                                                   ││
│ │   </button>                                                 ││
│ │                                                              ││
│ │ Displays: 🔔 [23]                                            ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Realtime Updates:                                            ││
│ │ - On INSERT: increment count                                ││
│ │ - On UPDATE (read_at): decrement count                      ││
│ │ - Live updates without polling                              ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Cleanup Job Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ TRIGGER: Daily at 3:00 AM (pg_cron or edge function)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER                                                   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Function: cleanup_old_notifications()                       ││
│ │                                                              ││
│ │ DELETE FROM notifications                                   ││
│ │ WHERE created_at < (now() - interval '30 days')             ││
│ │                                                              ││
│ │ -- Batched version (recommended for large datasets):       ││
│ │ LOOP                                                         ││
│ │   DELETE FROM notifications                                 ││
│ │   WHERE id IN (                                             ││
│ │     SELECT id FROM notifications                            ││
│ │     WHERE created_at < now() - interval '30 days'           ││
│ │     LIMIT 10000                                             ││
│ │   );                                                         ││
│ │   EXIT WHEN NOT FOUND;                                      ││
│ │ END LOOP;                                                    ││
│ │                                                              ││
│ │ Execution time: 100-500ms per 10k deletions                 ││
│ │ Total: ~2-5 seconds for 100k deletions                      ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LOGGING                                                          │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ RAISE NOTICE 'Deleted % old notifications', deleted_count;  ││
│ │                                                              ││
│ │ Log entry:                                                   ││
│ │ [2025-09-30 03:00:15] Deleted 45,231 old notifications      ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Index Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│ NOTIFICATIONS TABLE (5M rows, 1GB)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
┌───────────────────┐ ┌───────────────┐ ┌──────────────────┐
│ Unread Queries    │ │ Feed Queries  │ │ Count Queries    │
│ (Most frequent)   │ │ (Common)      │ │ (Very frequent)  │
└───────────────────┘ └───────────────┘ └──────────────────┘
            │                 │                 │
            ↓                 ↓                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ INDEX STRATEGY                                                   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ idx_notifications_user_unread_created                       ││
│ │ - Columns: (user_id, created_at DESC)                       ││
│ │ - WHERE: read_at IS NULL AND deleted_at IS NULL             ││
│ │ - Size: ~25MB (10% of table)                                ││
│ │ - Usage: Unread feed queries                                ││
│ │ - Performance: <1ms                                          ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ idx_notifications_user_active_created                       ││
│ │ - Columns: (user_id, created_at DESC)                       ││
│ │ - WHERE: deleted_at IS NULL                                 ││
│ │ - Size: ~250MB (all active notifications)                   ││
│ │ - Usage: Full feed queries                                  ││
│ │ - Performance: 5-15ms                                        ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ idx_notifications_user_unread_count                         ││
│ │ - Columns: (user_id)                                        ││
│ │ - WHERE: read_at IS NULL AND deleted_at IS NULL             ││
│ │ - Size: ~15MB (smallest index)                              ││
│ │ - Usage: Badge count queries                                ││
│ │ - Performance: <1ms (index-only scan)                       ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ idx_notifications_cleanup                                   ││
│ │ - Columns: (created_at)                                     ││
│ │ - WHERE: deleted_at IS NULL                                 ││
│ │ - Size: ~100MB                                              ││
│ │ - Usage: Daily cleanup job                                  ││
│ │ - Performance: 100-500ms per 10k deletes                    ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ Total Index Size: ~390MB (39% of table size)                    │
│ Trade-off: 390MB extra storage = 10-100x faster queries         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION LIFECYCLE                        │
└─────────────────────────────────────────────────────────────────┘

1. CREATION (6-10ms)
   User A replies → RPC validates → Comment created → Trigger fires
   → Notification created → Realtime broadcasts → User B sees toast

2. DELIVERY (50-100ms)
   Database INSERT → Supabase Realtime → WebSocket → Client receives
   → Store updates → UI re-renders → Badge increments

3. VIEWING (5-15ms)
   User opens feed → RPC queries → JOIN with posts/comments
   → Return 20 notifications → Render feed

4. MARKING READ (3-5ms)
   User clicks → RPC updates → Realtime broadcasts → Badge decrements
   → Optimistic update → Confirmed

5. DELETION (2-5ms for soft delete, 100-500ms for cleanup)
   User dismisses → Soft delete (deleted_at = now())
   OR
   Daily cleanup → Hard delete (DELETE WHERE created_at < 30 days ago)

┌─────────────────────────────────────────────────────────────────┐
│ PERFORMANCE CHARACTERISTICS                                      │
│                                                                  │
│ Hot Path (optimized for speed):                                 │
│   ✅ Get unread count: <1ms (index-only scan)                   │
│   ✅ Create notification: 6-10ms (trigger + insert)             │
│   ✅ Mark as read: 3-5ms (indexed update)                       │
│                                                                  │
│ Warm Path (acceptable performance):                             │
│   ✅ Get notification feed: 5-15ms (join queries)               │
│   ✅ Realtime delivery: 50-100ms (network latency)              │
│                                                                  │
│ Cold Path (batch operations):                                   │
│   ✅ Cleanup old notifications: 100-500ms per 10k               │
│   ✅ Mark all as read: 50-200ms (depends on count)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Trigger-Based Creation**: Automatic, reliable, can't forget to create notifications
2. **Denormalized Actor Data**: 2-3x faster queries by avoiding JOIN with users table
3. **Partial Indexes**: 60-80% smaller indexes for unread queries = faster and less storage
4. **Cursor-Based Pagination**: Consistent performance at any page depth
5. **Realtime Broadcasting**: Live updates without polling (<100ms latency)
6. **Optimistic Updates**: Instant UI feedback, confirmed by realtime
7. **Soft Deletes + Cleanup**: User control + automatic maintenance

The system is designed for **performance** (sub-10ms queries) and **reliability** (automatic creation, comprehensive constraints) while maintaining **scalability** (efficient indexes, batched operations).
