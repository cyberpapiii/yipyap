/**
 * PWA Manager for YipYap
 * Coordinates all PWA features and provides a unified interface
 */

import offlineManager from './offlineManager.js';
import networkManager from './networkManager.js';
import installPromptManager from './installPrompt.js';
import pushNotificationManager from './pushNotifications.js';

class PWAManager {
  constructor() {
    this.isInitialized = false;
    this.listeners = new Set();
    this.state = {
      isOnline: navigator.onLine,
      isInstalled: false,
      notificationsEnabled: false,
      serviceWorkerReady: false,
      backgroundSyncPending: 0
    };

    this.init();
  }

  async init() {
    try {
      console.log('[PWA] Initializing PWA Manager...');

      // Initialize service worker
      await this.initServiceWorker();

      // Set up network monitoring
      this.initNetworkMonitoring();

      // Initialize offline capabilities
      this.initOfflineFeatures();

      // Set up install prompt handling
      this.initInstallPrompt();

      // Initialize push notifications
      this.initPushNotifications();

      // Set up periodic sync checks
      this.initPeriodicSync();

      this.isInitialized = true;
      this.notifyListeners('initialized', this.getStatus());

      console.log('[PWA] PWA Manager initialized successfully');

    } catch (error) {
      console.error('[PWA] Failed to initialize PWA Manager:', error);
      this.notifyListeners('initializationFailed', { error });
    }
  }

  // Initialize service worker
  async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');

        console.log('[PWA] Service worker registered:', registration);

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New service worker is available
                  this.handleServiceWorkerUpdate(registration);
                }
              }
            });
          }
        });

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });

        this.state.serviceWorkerReady = true;
        this.notifyListeners('serviceWorkerReady', { registration });

      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
        throw error;
      }
    } else {
      console.warn('[PWA] Service workers not supported');
      throw new Error('Service workers not supported');
    }
  }

  // Initialize network monitoring
  initNetworkMonitoring() {
    const unsubscribe = networkManager.addListener((event, data) => {
      switch (event) {
        case 'online':
          this.handleOnline();
          break;
        case 'offline':
          this.handleOffline();
          break;
        case 'connectionQuality':
          this.handleConnectionQualityChange(data);
          break;
      }
    });

    this.state.isOnline = networkManager.getStatus().isOnline;
  }

  // Initialize offline features
  initOfflineFeatures() {
    // Set up automatic caching for critical content
    this.setupAutoCaching();

    // Monitor offline actions
    this.monitorOfflineActions();
  }

  // Initialize install prompt
  initInstallPrompt() {
    // The install prompt manager handles its own initialization
    // We just need to listen for events
    window.addEventListener('pwa-installable', () => {
      this.notifyListeners('installable');
    });

    window.addEventListener('appinstalled', () => {
      this.state.isInstalled = true;\n      this.notifyListeners('installed');\n    });\n\n    // Check if already installed\n    if (window.matchMedia('(display-mode: standalone)').matches) {\n      this.state.isInstalled = true;\n    }\n  }\n\n  // Initialize push notifications\n  initPushNotifications() {\n    const unsubscribe = pushNotificationManager.addEventListener((event, data) => {\n      switch (event) {\n        case 'subscribed':\n          this.state.notificationsEnabled = true;\n          this.notifyListeners('notificationsEnabled', data);\n          break;\n        case 'unsubscribed':\n          this.state.notificationsEnabled = false;\n          this.notifyListeners('notificationsDisabled');\n          break;\n        case 'permissionChanged':\n          this.notifyListeners('notificationPermissionChanged', data);\n          break;\n        case 'notificationClicked':\n          this.handleNotificationClick(data);\n          break;\n      }\n    });\n\n    this.state.notificationsEnabled = pushNotificationManager.getStatus().isSubscribed;\n  }\n\n  // Set up periodic sync checks\n  initPeriodicSync() {\n    // Check for pending offline actions every 30 seconds\n    setInterval(async () => {\n      if (this.state.isOnline) {\n        const offlineActions = await offlineManager.getOfflineActionsCount();\n        this.state.backgroundSyncPending = offlineActions.total;\n\n        if (offlineActions.total > 0) {\n          console.log(`[PWA] ${offlineActions.total} offline actions pending sync`);\n        }\n      }\n    }, 30000);\n  }\n\n  // Handle service worker updates\n  handleServiceWorkerUpdate(registration) {\n    console.log('[PWA] New service worker available');\n    \n    this.notifyListeners('updateAvailable', {\n      registration,\n      skipWaiting: () => {\n        if (registration.waiting) {\n          registration.waiting.postMessage({ type: 'SKIP_WAITING' });\n        }\n      }\n    });\n\n    // Show update notification to user\n    this.showUpdateNotification(registration);\n  }\n\n  // Handle service worker messages\n  handleServiceWorkerMessage(event) {\n    const { type, data } = event.data || {};\n\n    switch (type) {\n      case 'SYNC_SUCCESS':\n        this.handleSyncSuccess(data);\n        break;\n      case 'CACHE_UPDATED':\n        this.notifyListeners('cacheUpdated', data);\n        break;\n      case 'OFFLINE_READY':\n        this.notifyListeners('offlineReady');\n        break;\n      case 'NAVIGATE':\n        // Handle navigation requests from notifications\n        if (data.url) {\n          this.navigateTo(data.url);\n        }\n        break;\n    }\n  }\n\n  // Handle online state\n  handleOnline() {\n    console.log('[PWA] Device came online');\n    this.state.isOnline = true;\n    this.notifyListeners('online');\n\n    // Trigger background sync\n    this.triggerBackgroundSync();\n\n    // Refresh critical data\n    this.refreshCriticalData();\n  }\n\n  // Handle offline state\n  handleOffline() {\n    console.log('[PWA] Device went offline');\n    this.state.isOnline = false;\n    this.notifyListeners('offline');\n  }\n\n  // Handle connection quality changes\n  handleConnectionQualityChange(data) {\n    this.notifyListeners('connectionQualityChanged', data);\n\n    // Adjust caching strategy based on connection quality\n    if (data.connectionQuality?.quality === 'poor') {\n      this.enableDataSaverMode();\n    } else {\n      this.disableDataSaverMode();\n    }\n  }\n\n  // Handle sync success\n  handleSyncSuccess(data) {\n    console.log('[PWA] Sync successful:', data);\n    this.notifyListeners('syncSuccess', data);\n\n    // Update pending sync count\n    this.updateBackgroundSyncCount();\n  }\n\n  // Handle notification clicks\n  handleNotificationClick(data) {\n    console.log('[PWA] Notification clicked:', data);\n    \n    // Navigate to the relevant page\n    if (data.url) {\n      this.navigateTo(data.url);\n    }\n\n    this.notifyListeners('notificationClicked', data);\n  }\n\n  // Set up automatic caching\n  setupAutoCaching() {\n    // Cache critical resources when online\n    if (this.state.isOnline) {\n      this.precacheCriticalResources();\n    }\n\n    // Set up intelligent caching based on user behavior\n    this.setupIntelligentCaching();\n  }\n\n  // Monitor offline actions\n  monitorOfflineActions() {\n    // Listen for offline actions from the app\n    window.addEventListener('yipyap:offline-action', async (event) => {\n      const { action, data } = event.detail;\n\n      switch (action) {\n        case 'post':\n          await offlineManager.storeOfflinePost(data);\n          break;\n        case 'vote':\n          await offlineManager.storeOfflineVote(data.postId, data.direction);\n          break;\n        case 'comment':\n          await offlineManager.storeOfflineComment(data.postId, data);\n          break;\n      }\n\n      this.updateBackgroundSyncCount();\n    });\n  }\n\n  // Show update notification\n  showUpdateNotification(registration) {\n    // Create update notification UI\n    const updateBanner = document.createElement('div');\n    updateBanner.className = 'pwa-update-banner';\n    updateBanner.innerHTML = `\n      <div class=\"update-content\">\n        <span class=\"update-icon\">🚀</span>\n        <div class=\"update-text\">\n          <strong>App Update Available</strong>\n          <p>A new version of YipYap is ready!</p>\n        </div>\n        <div class=\"update-actions\">\n          <button class=\"update-btn update-btn-primary\">Update</button>\n          <button class=\"update-btn update-btn-secondary\">Later</button>\n        </div>\n      </div>\n    `;\n\n    // Add styles if not present\n    if (!document.querySelector('#pwa-update-styles')) {\n      const styles = document.createElement('style');\n      styles.id = 'pwa-update-styles';\n      styles.textContent = `\n        .pwa-update-banner {\n          position: fixed;\n          top: 0;\n          left: 0;\n          right: 0;\n          background: linear-gradient(135deg, #667eea, #764ba2);\n          color: white;\n          padding: 16px;\n          z-index: 9999;\n          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n        }\n\n        .update-content {\n          display: flex;\n          align-items: center;\n          max-width: 1200px;\n          margin: 0 auto;\n          gap: 16px;\n        }\n\n        .update-icon {\n          font-size: 32px;\n        }\n\n        .update-text {\n          flex: 1;\n        }\n\n        .update-text strong {\n          display: block;\n          font-size: 16px;\n          margin-bottom: 4px;\n        }\n\n        .update-text p {\n          margin: 0;\n          opacity: 0.9;\n          font-size: 14px;\n        }\n\n        .update-actions {\n          display: flex;\n          gap: 8px;\n        }\n\n        .update-btn {\n          padding: 8px 16px;\n          border: none;\n          border-radius: 6px;\n          font-weight: 600;\n          cursor: pointer;\n          transition: all 0.2s;\n        }\n\n        .update-btn-primary {\n          background: white;\n          color: #667eea;\n        }\n\n        .update-btn-primary:hover {\n          background: #f8f9fa;\n        }\n\n        .update-btn-secondary {\n          background: rgba(255, 255, 255, 0.2);\n          color: white;\n        }\n\n        .update-btn-secondary:hover {\n          background: rgba(255, 255, 255, 0.3);\n        }\n\n        @media (max-width: 640px) {\n          .update-content {\n            flex-direction: column;\n            text-align: center;\n            gap: 12px;\n          }\n\n          .update-actions {\n            width: 100%;\n          }\n\n          .update-btn {\n            flex: 1;\n          }\n        }\n      `;\n      document.head.appendChild(styles);\n    }\n\n    // Add event listeners\n    updateBanner.querySelector('.update-btn-primary').addEventListener('click', () => {\n      if (registration.waiting) {\n        registration.waiting.postMessage({ type: 'SKIP_WAITING' });\n      }\n      updateBanner.remove();\n      \n      // Show reload prompt after a brief delay\n      setTimeout(() => {\n        if (confirm('Update installed! Reload to use the new version?')) {\n          window.location.reload();\n        }\n      }, 1000);\n    });\n\n    updateBanner.querySelector('.update-btn-secondary').addEventListener('click', () => {\n      updateBanner.remove();\n    });\n\n    document.body.appendChild(updateBanner);\n\n    // Auto-hide after 10 seconds if no action\n    setTimeout(() => {\n      if (document.body.contains(updateBanner)) {\n        updateBanner.remove();\n      }\n    }, 10000);\n  }\n\n  // Trigger background sync\n  async triggerBackgroundSync() {\n    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {\n      try {\n        const registration = await navigator.serviceWorker.ready;\n        \n        await Promise.all([\n          registration.sync.register('background-sync-posts'),\n          registration.sync.register('background-sync-votes'),\n          registration.sync.register('background-sync-comments')\n        ]);\n\n        console.log('[PWA] Background sync triggered');\n      } catch (error) {\n        console.error('[PWA] Failed to trigger background sync:', error);\n      }\n    }\n  }\n\n  // Refresh critical data when coming online\n  async refreshCriticalData() {\n    try {\n      // Dispatch event to refresh feeds\n      window.dispatchEvent(new CustomEvent('pwa:refresh-critical-data'));\n      \n      console.log('[PWA] Critical data refresh triggered');\n    } catch (error) {\n      console.error('[PWA] Failed to refresh critical data:', error);\n    }\n  }\n\n  // Enable data saver mode\n  enableDataSaverMode() {\n    document.documentElement.setAttribute('data-data-saver', 'true');\n    this.notifyListeners('dataSaverEnabled');\n    console.log('[PWA] Data saver mode enabled');\n  }\n\n  // Disable data saver mode\n  disableDataSaverMode() {\n    document.documentElement.removeAttribute('data-data-saver');\n    this.notifyListeners('dataSaverDisabled');\n    console.log('[PWA] Data saver mode disabled');\n  }\n\n  // Precache critical resources\n  async precacheCriticalResources() {\n    if ('serviceWorker' in navigator) {\n      try {\n        const registration = await navigator.serviceWorker.ready;\n        \n        registration.active?.postMessage({\n          type: 'CACHE_URLS',\n          urls: [\n            '/api/posts?limit=20',\n            '/api/posts?sort=new&limit=10'\n          ]\n        });\n\n        console.log('[PWA] Critical resources precaching initiated');\n      } catch (error) {\n        console.error('[PWA] Failed to precache critical resources:', error);\n      }\n    }\n  }\n\n  // Set up intelligent caching\n  setupIntelligentCaching() {\n    // Cache frequently accessed content\n    let pageViews = 0;\n    let lastCacheUpdate = 0;\n\n    window.addEventListener('beforeunload', async () => {\n      pageViews++;\n\n      // Update cache every 5 page views or every 10 minutes\n      if (pageViews % 5 === 0 || Date.now() - lastCacheUpdate > 600000) {\n        lastCacheUpdate = Date.now();\n        \n        // Get current page data and cache it\n        const currentPath = window.location.pathname;\n        if (currentPath.includes('/posts/') || currentPath === '/') {\n          // Cache current page content\n          this.cacheCurrentPage();\n        }\n      }\n    });\n  }\n\n  // Cache current page\n  async cacheCurrentPage() {\n    try {\n      // This would integrate with your app's data layer\n      // to cache the current page's posts and comments\n      window.dispatchEvent(new CustomEvent('pwa:cache-current-page'));\n    } catch (error) {\n      console.error('[PWA] Failed to cache current page:', error);\n    }\n  }\n\n  // Update background sync count\n  async updateBackgroundSyncCount() {\n    try {\n      const offlineActions = await offlineManager.getOfflineActionsCount();\n      this.state.backgroundSyncPending = offlineActions.total;\n      this.notifyListeners('backgroundSyncCountChanged', offlineActions);\n    } catch (error) {\n      console.error('[PWA] Failed to update background sync count:', error);\n    }\n  }\n\n  // Navigate to URL\n  navigateTo(url) {\n    // Use your app's navigation system\n    if (url && url !== window.location.pathname) {\n      window.location.href = url;\n    }\n  }\n\n  // Public API methods\n\n  // Add event listener\n  addEventListener(callback) {\n    this.listeners.add(callback);\n    \n    // Immediately notify of current state\n    callback('status', this.getStatus());\n\n    return () => this.listeners.delete(callback);\n  }\n\n  // Get current PWA status\n  getStatus() {\n    return {\n      ...this.state,\n      isInitialized: this.isInitialized,\n      networkStatus: networkManager.getStatus(),\n      installPrompt: installPromptManager.getInstallAnalytics(),\n      pushNotifications: pushNotificationManager.getSubscriptionStatus()\n    };\n  }\n\n  // Force refresh app\n  async forceRefresh() {\n    try {\n      // Clear caches\n      if ('caches' in window) {\n        const cacheNames = await caches.keys();\n        await Promise.all(\n          cacheNames.map(cacheName => caches.delete(cacheName))\n        );\n      }\n\n      // Reload page\n      window.location.reload(true);\n    } catch (error) {\n      console.error('[PWA] Failed to force refresh:', error);\n    }\n  }\n\n  // Manually trigger install prompt\n  async showInstallPrompt() {\n    return await installPromptManager.manualInstall();\n  }\n\n  // Subscribe to push notifications\n  async enableNotifications() {\n    try {\n      await pushNotificationManager.subscribe();\n      return true;\n    } catch (error) {\n      console.error('[PWA] Failed to enable notifications:', error);\n      throw error;\n    }\n  }\n\n  // Unsubscribe from push notifications\n  async disableNotifications() {\n    try {\n      await pushNotificationManager.unsubscribe();\n      return true;\n    } catch (error) {\n      console.error('[PWA] Failed to disable notifications:', error);\n      throw error;\n    }\n  }\n\n  // Show test notification\n  async sendTestNotification() {\n    try {\n      await pushNotificationManager.showTestNotification();\n      return true;\n    } catch (error) {\n      console.error('[PWA] Failed to send test notification:', error);\n      throw error;\n    }\n  }\n\n  // Get offline actions count\n  async getOfflineActionsCount() {\n    return await offlineManager.getOfflineActionsCount();\n  }\n\n  // Clear all cached data\n  async clearAllCache() {\n    try {\n      await offlineManager.clearAllCache();\n      \n      if ('caches' in window) {\n        const cacheNames = await caches.keys();\n        await Promise.all(\n          cacheNames.map(cacheName => caches.delete(cacheName))\n        );\n      }\n\n      this.notifyListeners('cacheCleared');\n      return true;\n    } catch (error) {\n      console.error('[PWA] Failed to clear cache:', error);\n      return false;\n    }\n  }\n\n  // Notify all listeners\n  notifyListeners(event, data) {\n    this.listeners.forEach(callback => {\n      try {\n        callback(event, data);\n      } catch (error) {\n        console.error('[PWA] Listener error:', error);\n      }\n    });\n  }\n\n  // Destroy PWA manager\n  destroy() {\n    this.listeners.clear();\n  }\n}\n\n// Create singleton instance\nconst pwaManager = new PWAManager();\n\n// Make it globally available for debugging\nif (typeof window !== 'undefined') {\n  window.pwaManager = pwaManager;\n}\n\nexport default pwaManager;