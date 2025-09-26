/**
 * Push Notification Routes for YipYap Backend
 * Handles VAPID setup, subscription management, and notification sending
 */

const express = require('express');
const webpush = require('web-push');
const jwt = require('jsonwebtoken');
const router = express.Router();

// VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yipyap.com';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_JWT_ISSUER = process.env.SUPABASE_JWT_ISSUER;
const SUPABASE_JWT_AUDIENCE = process.env.SUPABASE_JWT_AUDIENCE;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID keys are required. Generate them using: npx web-push generate-vapid-keys');
  process.exit(1);
}

if (!SUPABASE_JWT_SECRET) {
  console.error('SUPABASE_JWT_SECRET is required to verify auth tokens');
  process.exit(1);
}

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// In-memory storage for subscriptions (replace with database in production)
const subscriptions = new Map();
const userSubscriptions = new Map(); // userId -> subscription

// Middleware to authenticate user (implement based on your auth system)
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const verificationOptions = {
      algorithms: ['HS256']
    };

    if (SUPABASE_JWT_ISSUER) {
      verificationOptions.issuer = SUPABASE_JWT_ISSUER;
    }

    if (SUPABASE_JWT_AUDIENCE) {
      verificationOptions.audience = SUPABASE_JWT_AUDIENCE;
    }

    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, verificationOptions);
    const userId = decoded?.sub || decoded?.user_id || decoded?.userId;

    if (!userId) {
      throw new Error('Token missing subject');
    }

    req.userId = userId;
    next();
  } catch (error) {
    console.error('Token verification failed:', error instanceof Error ? error.message : error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Subscribe to push notifications
router.post('/subscribe', authenticateUser, async (req, res) => {
  try {
    const { subscription, preferences = {}, deviceInfo = {} } = req.body;
    const userId = req.userId;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Store subscription with user preferences
    const subscriptionData = {
      subscription,
      userId,
      preferences: {
        replies: preferences.replies !== false,
        scoreMilestones: preferences.scoreMilestones !== false,
        mentions: preferences.mentions !== false,
        following: preferences.following !== false,
        ...preferences
      },
      deviceInfo,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    // Store in memory (replace with database)
    subscriptions.set(subscription.endpoint, subscriptionData);
    userSubscriptions.set(userId, subscription.endpoint);

    console.log(`Push subscription saved for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription saved successfully',
      subscriptionId: subscription.endpoint
    });

  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateUser, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.userId;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    // Remove subscription
    subscriptions.delete(endpoint);

    // Remove user mapping
    if (userSubscriptions.get(userId) === endpoint) {
      userSubscriptions.delete(userId);
    }

    console.log(`Push subscription removed for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription removed successfully'
    });

  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Update push notification preferences
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const { endpoint, preferences } = req.body;
    const userId = req.userId;

    if (!endpoint || !preferences) {
      return res.status(400).json({ error: 'Endpoint and preferences required' });
    }

    const subscriptionData = subscriptions.get(endpoint);
    if (!subscriptionData || subscriptionData.userId !== userId) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update preferences
    subscriptionData.preferences = {
      ...subscriptionData.preferences,
      ...preferences
    };
    subscriptionData.lastUsed = new Date().toISOString();

    subscriptions.set(endpoint, subscriptionData);

    console.log(`Push preferences updated for user ${userId}`);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: subscriptionData.preferences
    });

  } catch (error) {
    console.error('Error updating push preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Send test notification
router.post('/test', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const endpoint = userSubscriptions.get(userId);

    if (!endpoint) {
      return res.status(404).json({ error: 'No subscription found for user' });
    }

    const subscriptionData = subscriptions.get(endpoint);
    if (!subscriptionData) {
      return res.status(404).json({ error: 'Subscription data not found' });
    }

    const payload = {
      title: 'YipYap Test Notification',
      body: 'This is a test notification to verify your push setup is working!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'test-notification',
      data: {
        url: '/',
        type: 'test'
      }
    };

    await webpush.sendNotification(subscriptionData.subscription, JSON.stringify(payload));

    console.log(`Test notification sent to user ${userId}`);

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending test notification:', error);

    if (error.statusCode === 410) {
      // Subscription is no longer valid, remove it
      const userId = req.userId;
      const endpoint = userSubscriptions.get(userId);
      if (endpoint) {
        subscriptions.delete(endpoint);
        userSubscriptions.delete(userId);
      }
      return res.status(410).json({ error: 'Subscription expired' });
    }

    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Send notification for post reply
router.post('/notify/reply', authenticateUser, async (req, res) => {
  try {
    const { postId, postAuthorId, replyAuthor, replyContent } = req.body;

    if (!postId || !postAuthorId || !replyAuthor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const endpoint = userSubscriptions.get(postAuthorId);
    if (!endpoint) {
      return res.status(404).json({ error: 'No subscription found for post author' });
    }

    const subscriptionData = subscriptions.get(endpoint);
    if (!subscriptionData || !subscriptionData.preferences.replies) {
      return res.status(200).json({ message: 'Notifications disabled for replies' });
    }

    const payload = {
      title: 'New Reply on YipYap',
      body: `${replyAuthor} replied to your post: "${replyContent.substring(0, 50)}${replyContent.length > 50 ? '...' : ''}"`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `reply-${postId}`,
      data: {
        url: `/post/${postId}`,
        postId: postId,
        type: 'reply'
      }
    };

    await webpush.sendNotification(subscriptionData.subscription, JSON.stringify(payload));

    console.log(`Reply notification sent to user ${postAuthorId}`);

    res.json({
      success: true,
      message: 'Reply notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending reply notification:', error);
    handleNotificationError(error, req.body.postAuthorId);
    res.status(500).json({ error: 'Failed to send reply notification' });
  }
});

// Send notification for score milestone
router.post('/notify/milestone', authenticateUser, async (req, res) => {
  try {
    const { postId, authorId, milestone, currentScore } = req.body;

    if (!postId || !authorId || !milestone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const endpoint = userSubscriptions.get(authorId);
    if (!endpoint) {
      return res.status(404).json({ error: 'No subscription found for user' });
    }

    const subscriptionData = subscriptions.get(endpoint);
    if (!subscriptionData || !subscriptionData.preferences.scoreMilestones) {
      return res.status(200).json({ message: 'Notifications disabled for score milestones' });
    }

    const milestoneText = getMilestoneText(milestone, currentScore);

    const payload = {
      title: 'Score Milestone Reached!',
      body: milestoneText,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `milestone-${postId}`,
      data: {
        url: `/post/${postId}`,
        postId: postId,
        type: 'milestone',
        milestone: milestone
      }
    };

    await webpush.sendNotification(subscriptionData.subscription, JSON.stringify(payload));

    console.log(`Milestone notification sent to user ${authorId}`);

    res.json({
      success: true,
      message: 'Milestone notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending milestone notification:', error);
    handleNotificationError(error, req.body.authorId);
    res.status(500).json({ error: 'Failed to send milestone notification' });
  }
});

// Send bulk notifications (for admin use)
router.post('/notify/bulk', authenticateUser, async (req, res) => {
  try {
    const { title, body, targetUsers = [], filters = {} } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    let targetSubscriptions = [];

    if (targetUsers.length > 0) {
      // Send to specific users
      targetSubscriptions = targetUsers
        .map(userId => userSubscriptions.get(userId))
        .filter(endpoint => endpoint && subscriptions.has(endpoint))
        .map(endpoint => subscriptions.get(endpoint));
    } else {
      // Send to all users (apply filters)
      targetSubscriptions = Array.from(subscriptions.values())
        .filter(sub => applyNotificationFilters(sub, filters));
    }

    const payload = {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'bulk-notification',
      data: {
        url: '/',
        type: 'announcement'
      }
    };

    const promises = targetSubscriptions.map(subscriptionData =>
      webpush.sendNotification(subscriptionData.subscription, JSON.stringify(payload))
        .catch(error => {
          console.error(`Failed to send notification to ${subscriptionData.userId}:`, error);
          handleNotificationError(error, subscriptionData.userId);
        })
    );

    await Promise.allSettled(promises);

    console.log(`Bulk notification sent to ${targetSubscriptions.length} users`);

    res.json({
      success: true,
      message: `Bulk notification sent to ${targetSubscriptions.length} users`
    });

  } catch (error) {
    console.error('Error sending bulk notification:', error);
    res.status(500).json({ error: 'Failed to send bulk notification' });
  }
});

// Get subscription statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const totalSubscriptions = subscriptions.size;
    const activeSubscriptions = Array.from(subscriptions.values())
      .filter(sub => {
        const lastUsed = new Date(sub.lastUsed);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return lastUsed > thirtyDaysAgo;
      }).length;

    const preferenceStats = {
      replies: 0,
      scoreMilestones: 0,
      mentions: 0,
      following: 0
    };

    Array.from(subscriptions.values()).forEach(sub => {
      Object.keys(preferenceStats).forEach(pref => {
        if (sub.preferences[pref]) {
          preferenceStats[pref]++;
        }
      });
    });

    res.json({
      total: totalSubscriptions,
      active: activeSubscriptions,
      preferences: preferenceStats
    });

  } catch (error) {
    console.error('Error getting subscription stats:', error);
    res.status(500).json({ error: 'Failed to get subscription stats' });
  }
});

// Helper functions

function getMilestoneText(milestone, currentScore) {
  switch (milestone) {
    case 10:
      return `Your post reached ${currentScore} points! 🎉`;
    case 50:
      return `Wow! Your post hit ${currentScore} points! 🔥`;
    case 100:
      return `Amazing! Your post reached ${currentScore} points! 🚀`;
    case 500:
      return `Incredible! Your post hit ${currentScore} points! ⭐`;
    case 1000:
      return `Legendary! Your post reached ${currentScore} points! 👑`;
    default:
      return `Your post reached ${currentScore} points!`;
  }
}

function applyNotificationFilters(subscriptionData, filters) {
  // Apply any filtering logic here
  if (filters.activeOnly) {
    const lastUsed = new Date(subscriptionData.lastUsed);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (lastUsed <= sevenDaysAgo) return false;
  }

  return true;
}

function handleNotificationError(error, userId) {
  if (error.statusCode === 410 || error.statusCode === 404) {
    // Subscription is no longer valid, remove it
    const endpoint = userSubscriptions.get(userId);
    if (endpoint) {
      subscriptions.delete(endpoint);
      userSubscriptions.delete(userId);
      console.log(`Removed expired subscription for user ${userId}`);
    }
  }
}

module.exports = router;
