/**
 * Push Notification Manager for YipYap PWA
 * Handles push notification setup, subscription management, and VAPID configuration
 */

class PushNotificationManager {
  constructor() {
    this.vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY';
    this.apiEndpoint = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.subscription = null;
    this.isSupported = false;
    this.permission = 'default';

    this.checkSupport();
    this.loadExistingSubscription();
  }

  // Check if push notifications are supported
  checkSupport() {
    this.isSupported = 'serviceWorker' in navigator &&
                      'PushManager' in window &&
                      'Notification' in window;

    if (this.isSupported) {
      this.permission = Notification.permission;
      console.log('Push notifications are supported');
    } else {
      console.warn('Push notifications are not supported in this browser');
    }
  }

  // Load existing subscription from localStorage
  async loadExistingSubscription() {
    const savedSubscription = localStorage.getItem('yipyap_push_subscription');
    if (savedSubscription) {
      try {
        this.subscription = JSON.parse(savedSubscription);
        console.log('Loaded existing push subscription');

        // Verify subscription is still valid
        await this.verifySubscription();
      } catch (error) {
        console.error('Failed to parse saved subscription:', error);
        localStorage.removeItem('yipyap_push_subscription');
      }
    }
  }

  // Request notification permission
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported');
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      throw new Error('Push notifications are blocked. Please enable them in browser settings.');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    this.permission = permission;

    if (permission === 'granted') {
      console.log('Push notification permission granted');
      this.trackEvent('notification_permission_granted');
      return true;
    } else {
      console.log('Push notification permission denied');
      this.trackEvent('notification_permission_denied');
      throw new Error('Push notification permission denied');
    }
  }

  // Subscribe to push notifications
  async subscribe(options = {}) {
    try {
      // Request permission first
      await this.requestPermission();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });

        console.log('Created new push subscription');
      } else {
        console.log('Using existing push subscription');
      }

      this.subscription = subscription;

      // Save subscription to localStorage
      localStorage.setItem('yipyap_push_subscription', JSON.stringify(subscription));

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription, options);

      this.trackEvent('push_subscription_created');

      return subscription;

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      this.trackEvent('push_subscription_failed', { error: error.message });
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    try {
      if (!this.subscription) {
        console.log('No subscription to unsubscribe from');
        return true;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push service
        await subscription.unsubscribe();
        console.log('Unsubscribed from push notifications');
      }

      // Remove from server
      await this.removeSubscriptionFromServer();

      // Clear local storage
      localStorage.removeItem('yipyap_push_subscription');
      this.subscription = null;

      this.trackEvent('push_unsubscribed');

      return true;

    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  // Send subscription to server
  async sendSubscriptionToServer(subscription, options = {}) {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          subscription: subscription,
          preferences: {
            replies: options.replies !== false,
            scoreMilestones: options.scoreMilestones !== false,
            mentions: options.mentions !== false,
            following: options.following !== false
          },
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save subscription: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Subscription saved to server:', result);

      return result;

    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  // Remove subscription from server
  async removeSubscriptionFromServer() {
    try {
      if (!this.subscription) return;

      const response = await fetch(`${this.apiEndpoint}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (!response.ok) {
        console.warn('Failed to remove subscription from server:', response.statusText);
      }

    } catch (error) {
      console.error('Error removing subscription from server:', error);
    }
  }

  // Update push notification preferences
  async updatePreferences(preferences) {
    try {
      if (!this.subscription) {
        throw new Error('No active subscription to update');
      }

      const response = await fetch(`${this.apiEndpoint}/api/push/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint,
          preferences: preferences
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update preferences: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Push preferences updated:', result);

      this.trackEvent('push_preferences_updated', preferences);

      return result;

    } catch (error) {
      console.error('Failed to update push preferences:', error);
      throw error;
    }
  }

  // Test push notification
  async sendTestNotification() {
    try {
      if (!this.subscription) {
        throw new Error('No active subscription for test notification');
      }

      const response = await fetch(`${this.apiEndpoint}/api/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send test notification: ${response.statusText}`);
      }

      console.log('Test notification sent successfully');
      this.trackEvent('test_notification_sent');

      return true;

    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  // Verify subscription is still valid
  async verifySubscription() {
    if (!this.subscription) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();

      if (!currentSubscription ||
          currentSubscription.endpoint !== this.subscription.endpoint) {
        console.log('Subscription is no longer valid');
        localStorage.removeItem('yipyap_push_subscription');
        this.subscription = null;
        return false;
      }

      return true;

    } catch (error) {
      console.error('Failed to verify subscription:', error);
      return false;
    }
  }

  // Show notification permission prompt with custom UI
  showPermissionPrompt(options = {}) {
    return new Promise((resolve, reject) => {
      if (this.permission === 'granted') {
        resolve(true);
        return;
      }

      if (this.permission === 'denied') {
        reject(new Error('Notifications are blocked'));
        return;
      }

      // Create custom permission prompt
      const promptContainer = document.createElement('div');
      promptContainer.innerHTML = `
        <div class="notification-prompt-overlay">
          <div class="notification-prompt-modal">
            <div class="notification-prompt-header">
              <span class="notification-icon">🔔</span>
              <h3>Stay Updated</h3>
              <p>Get notified about replies to your posts and score milestones</p>
            </div>
            <div class="notification-benefits">
              <div class="benefit">
                <span class="benefit-icon">💬</span>
                <span>Replies to your posts</span>
              </div>
              <div class="benefit">
                <span class="benefit-icon">🏆</span>
                <span>Score milestones</span>
              </div>
              <div class="benefit">
                <span class="benefit-icon">👥</span>
                <span>New followers</span>
              </div>
            </div>
            <div class="notification-prompt-actions">
              <button id="allow-notifications" class="notification-btn-primary">Allow Notifications</button>
              <button id="deny-notifications" class="notification-btn-secondary">Not Now</button>
            </div>
          </div>
        </div>
      `;

      // Add styles
      const styles = `
        <style>
          .notification-prompt-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
          }

          .notification-prompt-modal {
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 380px;
            margin: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            animation: slideUp 0.3s ease-out;
          }

          .notification-prompt-header {
            text-align: center;
            margin-bottom: 20px;
          }

          .notification-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 16px;
          }

          .notification-prompt-header h3 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
            color: #1a73e8;
          }

          .notification-prompt-header p {
            margin: 0;
            color: #666;
            font-size: 14px;
            line-height: 1.4;
          }

          .notification-benefits {
            margin-bottom: 24px;
          }

          .benefit {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            font-size: 14px;
          }

          .benefit-icon {
            width: 24px;
            margin-right: 12px;
            text-align: center;
          }

          .notification-prompt-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .notification-btn-primary {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
          }

          .notification-btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #ddd;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          }
        </style>
      `;

      document.head.insertAdjacentHTML('beforeend', styles);
      document.body.appendChild(promptContainer);

      // Handle allow button
      document.getElementById('allow-notifications').addEventListener('click', async () => {
        promptContainer.remove();
        try {
          await this.requestPermission();
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });

      // Handle deny button
      document.getElementById('deny-notifications').addEventListener('click', () => {
        promptContainer.remove();
        this.trackEvent('notification_permission_prompt_denied');
        resolve(false);
      });

      this.trackEvent('notification_permission_prompt_shown');
    });
  }

  // Get current subscription status
  getSubscriptionStatus() {
    return {
      isSupported: this.isSupported,
      permission: this.permission,
      isSubscribed: !!this.subscription,
      subscription: this.subscription
    };
  }

  // Utility: Convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get auth token (implement based on your auth system)
  getAuthToken() {
    return localStorage.getItem('yipyap_auth_token') || '';
  }

  // Track analytics events
  trackEvent(event, data = {}) {
    if (window.gtag) {
      window.gtag('event', event, {
        event_category: 'Push Notifications',
        ...data
      });
    }
    console.log('Push Notification Event:', event, data);
  }
}

// Create and export singleton instance
const pushNotificationManager = new PushNotificationManager();

export default pushNotificationManager;