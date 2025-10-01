import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

interface NotificationPayload {
  userId: string
  title: string
  body: string
  postId?: string
  commentId?: string
  notificationId?: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    id: string
    user_id: string
    post_id?: string
    comment_id?: string
    type: string
    actor_user_id?: string
    actor_subway_line?: string
    actor_subway_color?: string
    preview_content?: string
    created_at: string
    read: boolean
  }
  schema: string
  old_record: any
}

interface PushSubscription {
  id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

/**
 * Build notification title and body from database notification record
 */
function buildNotificationContent(record: WebhookPayload['record']): { title: string; body: string } {
  const actorLine = record.actor_subway_line || 'Someone'
  const preview = record.preview_content || 'You have a new notification'

  switch (record.type) {
    case 'reply_to_post':
      return {
        title: `${actorLine} Line replied to your post`,
        body: preview
      }
    case 'reply_to_comment':
      return {
        title: `${actorLine} Line replied to your comment`,
        body: preview
      }
    case 'milestone_5':
      return {
        title: 'Your post is heating up!',
        body: 'Your post reached 5 upvotes'
      }
    case 'milestone_10':
      return {
        title: 'Your post is popular!',
        body: 'Your post reached 10 upvotes'
      }
    case 'milestone_25':
      return {
        title: 'Your post is trending!',
        body: 'Your post reached 25 upvotes'
      }
    default:
      return {
        title: 'New notification',
        body: preview
      }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request - handle three formats:
    // 1. Supabase webhook (production): { type, table, record, schema }
    // 2. Direct JSON (testing): { userId, title, body, ... }
    // 3. Query params (legacy): ?userId=...&title=...
    let payload: NotificationPayload

    const url = new URL(req.url)
    const hasQueryParams = url.searchParams.has('userId')

    // Try to parse as JSON first
    let bodyData: any
    try {
      bodyData = await req.json()
    } catch {
      bodyData = null
    }

    // Check if it's a Supabase webhook payload
    if (bodyData && bodyData.type && bodyData.table && bodyData.record) {
      console.log('[SendPush] Received Supabase webhook')
      const webhookData = bodyData as WebhookPayload

      // Only process INSERT events on notifications table
      if (webhookData.type !== 'INSERT' || webhookData.table !== 'notifications') {
        console.log('[SendPush] Ignoring non-INSERT event or wrong table')
        return new Response(
          JSON.stringify({ success: true, message: 'Event ignored' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const record = webhookData.record
      const { title, body } = buildNotificationContent(record)

      payload = {
        userId: record.user_id,
        title,
        body,
        postId: record.post_id,
        commentId: record.comment_id,
        notificationId: record.id
      }

      console.log('[SendPush] Webhook payload parsed:', payload)
    } else if (hasQueryParams) {
      // Legacy: Query parameters
      console.log('[SendPush] Received webhook via query params')
      payload = {
        userId: url.searchParams.get('userId') || '',
        title: url.searchParams.get('title') || '',
        body: url.searchParams.get('body') || '',
        postId: url.searchParams.get('postId') || undefined,
        commentId: url.searchParams.get('commentId') || undefined,
        notificationId: url.searchParams.get('notificationId') || undefined
      }
    } else if (bodyData && bodyData.userId) {
      // Direct API call with JSON body
      console.log('[SendPush] Received direct API call via JSON body')
      payload = bodyData as NotificationPayload
    } else {
      return new Response(
        JSON.stringify({
          error: 'Invalid request format. Expected webhook payload, JSON body, or query params'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('[SendPush] Processing notification for user:', payload.userId)

    const { userId, title, body, postId, commentId, notificationId } = payload

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body', receivedPayload: payload }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get VAPID keys from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@yipyap.app'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[SendPush] VAPID keys not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: VAPID keys missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Configure web-push
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Initialize Supabase client with service role key (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all push subscriptions for this user
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth')
      .eq('user_id', userId)
      .eq('enabled', true)

    if (fetchError) {
      console.error('[SendPush] Error fetching subscriptions:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions', details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[SendPush] No subscriptions found for user:', userId)
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[SendPush] Found ${subscriptions.length} subscriptions for user ${userId}`)

    // Prepare notification data
    const notificationData = {
      title,
      body,
      data: {
        postId,
        commentId,
        notificationId,
        url: postId ? `/thread/${postId}` : '/'
      },
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationId || `notification-${Date.now()}`,
      requireInteraction: false,
      timestamp: Date.now()
    }

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: PushSubscription) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth
            }
          }

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(notificationData),
            {
              TTL: 86400 // 24 hours
            }
          )

          console.log(`[SendPush] Successfully sent to subscription ${sub.id}`)
          return { success: true, subscriptionId: sub.id }
        } catch (error: any) {
          console.error(`[SendPush] Error sending to subscription ${sub.id}:`, error)

          // Handle expired or invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[SendPush] Subscription ${sub.id} is expired/invalid, removing...`)

            // Remove expired subscription from database
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id)
          }

          return {
            success: false,
            subscriptionId: sub.id,
            error: error.message,
            statusCode: error.statusCode
          }
        }
      })
    )

    // Count successful sends
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length

    const failureCount = results.length - successCount

    console.log(
      `[SendPush] Sent ${successCount}/${subscriptions.length} notifications (${failureCount} failed)`
    )

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        total: subscriptions.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('[SendPush] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
