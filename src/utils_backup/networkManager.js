/**
 * Network Manager for YipYap PWA
 * Handles online/offline state management and provides network status to components
 */

class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.connectionQuality = 'unknown';
    this.retryAttempts = 0;
    this.maxRetryAttempts = 3;
    this.retryDelay = 1000; // Start with 1 second

    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Monitor connection quality
    this.initConnectionMonitoring();

    // Check initial state
    this.checkConnectionState();
  }

  // Initialize connection quality monitoring
  initConnectionMonitoring() {
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (connection) {
        this.updateConnectionQuality(connection);

        connection.addEventListener('change', () => {
          this.updateConnectionQuality(connection);
        });
      }
    }

    // Fallback: Periodic connectivity checks
    setInterval(() => {
      this.performConnectivityCheck();
    }, 30000); // Check every 30 seconds
  }

  // Update connection quality based on network information
  updateConnectionQuality(connection) {
    const effectiveType = connection.effectiveType || 'unknown';
    const downlink = connection.downlink || 0;
    const rtt = connection.rtt || 0;

    this.connectionQuality = {
      effectiveType,
      downlink,
      rtt,
      saveData: connection.saveData || false,
      quality: this.calculateConnectionQuality(effectiveType, downlink, rtt)
    };

    this.notifyListeners('connectionQuality', this.connectionQuality);
  }

  // Calculate overall connection quality
  calculateConnectionQuality(effectiveType, downlink, rtt) {
    if (effectiveType === '4g' && downlink > 1.5 && rtt < 300) {
      return 'excellent';
    } else if (effectiveType === '4g' || (downlink > 0.7 && rtt < 600)) {
      return 'good';
    } else if (effectiveType === '3g' || (downlink > 0.3 && rtt < 1000)) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  // Perform active connectivity check
  async performConnectivityCheck() {
    try {
      // Try to fetch a small resource to verify connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/favicon.png', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const wasOnline = this.isOnline;
      this.isOnline = response.ok;

      if (this.isOnline && !wasOnline) {
        this.handleOnline();
      } else if (!this.isOnline && wasOnline) {
        this.handleOffline();
      }

    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;

      if (wasOnline) {
        this.handleOffline();
      }
    }
  }

  // Handle online event
  handleOnline() {
    console.log('[Network] Device came online');
    this.isOnline = true;
    this.retryAttempts = 0;
    this.retryDelay = 1000;

    this.notifyListeners('online');
    this.triggerBackgroundSync();
    this.showConnectionStatus('online');
  }

  // Handle offline event
  handleOffline() {
    console.log('[Network] Device went offline');
    this.isOnline = false;
    this.notifyListeners('offline');
    this.showConnectionStatus('offline');
  }

  // Check current connection state
  async checkConnectionState() {
    if (this.isOnline) {
      await this.performConnectivityCheck();
    }
  }

  // Add listener for network events
  addListener(callback) {
    this.listeners.add(callback);

    // Immediately notify new listener of current state
    callback('status', {
      isOnline: this.isOnline,
      connectionQuality: this.connectionQuality
    });

    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback(event, {
          isOnline: this.isOnline,
          connectionQuality: this.connectionQuality,
          ...data
        });
      } catch (error) {
        console.error('[Network] Listener error:', error);
      }
    });
  }

  // Show connection status to user
  showConnectionStatus(status) {
    const existingBanner = document.querySelector('.network-status-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.className = `network-status-banner network-status-${status}`;
    banner.innerHTML = status === 'online'
      ? `<span class="status-icon">✅</span> Back online`
      : `<span class="status-icon">⚠️</span> You're offline`;

    // Add banner styles if not present
    if (!document.querySelector('#network-status-styles')) {
      const styles = document.createElement('style');
      styles.id = 'network-status-styles';
      styles.textContent = `
        .network-status-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 12px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          z-index: 9999;
          transform: translateY(-100%);
          transition: transform 0.3s ease;
        }

        .network-status-banner.show {
          transform: translateY(0);
        }

        .network-status-online {
          background: #10b981;
          color: white;
        }

        .network-status-offline {
          background: #ef4444;
          color: white;
        }

        .status-icon {
          margin-right: 8px;
        }

        @media (max-width: 640px) {
          .network-status-banner {
            font-size: 13px;
            padding: 10px;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => {
      banner.classList.add('show');
    });

    // Auto-hide after delay
    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.remove('show');
        setTimeout(() => {
          if (banner.parentNode) {
            banner.parentNode.removeChild(banner);
          }
        }, 300);
      }
    }, status === 'online' ? 3000 : 5000);
  }

  // Trigger background sync when coming online
  async triggerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Register all background sync events
        await Promise.all([
          registration.sync.register('background-sync-posts'),
          registration.sync.register('background-sync-votes'),
          registration.sync.register('background-sync-comments')
        ]);

        console.log('[Network] Background sync registered');
      } catch (error) {
        console.error('[Network] Failed to register background sync:', error);
      }
    }
  }

  // Make a network request with retry logic
  async fetchWithRetry(url, options = {}) {
    if (!this.isOnline) {
      throw new Error('Device is offline');
    }

    const maxRetries = options.maxRetries || this.maxRetryAttempts;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Reset retry state on success
        this.retryAttempts = 0;
        this.retryDelay = 1000;

        return response;

      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break; // Don't delay after final attempt
        }

        // Check if error indicates network issue
        if (error.name === 'AbortError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')) {

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));

          // Exponential backoff
          this.retryDelay = Math.min(this.retryDelay * 2, 10000);

          console.log(`[Network] Retrying request (attempt ${attempt + 2}/${maxRetries + 1})`);\n        } else {\n          // Non-network error, don't retry\n          break;\n        }\n      }\n    }\n\n    this.retryAttempts++;\n    throw lastError;\n  }\n\n  // Get current network status\n  getStatus() {\n    return {\n      isOnline: this.isOnline,\n      connectionQuality: this.connectionQuality,\n      retryAttempts: this.retryAttempts\n    };\n  }\n\n  // Check if device is on a metered connection\n  isMeteredConnection() {\n    if ('connection' in navigator) {\n      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;\n      return connection?.saveData === true;\n    }\n    return false;\n  }\n\n  // Get recommended cache strategy based on connection\n  getRecommendedCacheStrategy() {\n    if (!this.isOnline) {\n      return 'cache-only';\n    }\n\n    if (this.isMeteredConnection()) {\n      return 'cache-first';\n    }\n\n    switch (this.connectionQuality?.quality) {\n      case 'excellent':\n      case 'good':\n        return 'network-first';\n      case 'fair':\n        return 'stale-while-revalidate';\n      case 'poor':\n        return 'cache-first';\n      default:\n        return 'stale-while-revalidate';\n    }\n  }\n\n  // Preload critical resources when connection improves\n  async preloadCriticalResources() {\n    if (!this.isOnline || this.connectionQuality?.quality === 'poor') {\n      return;\n    }\n\n    try {\n      // Send message to service worker to cache critical URLs\n      if ('serviceWorker' in navigator) {\n        const registration = await navigator.serviceWorker.ready;\n        registration.active?.postMessage({\n          type: 'CACHE_URLS',\n          urls: [\n            '/',\n            '/api/posts?limit=20',\n            '/manifest.json'\n          ]\n        });\n      }\n    } catch (error) {\n      console.error('[Network] Failed to preload resources:', error);\n    }\n  }\n\n  // Estimate data usage for request\n  estimateDataUsage(url, options = {}) {\n    // Basic estimation - could be enhanced with actual measurements\n    const baseSize = 2000; // Base size in bytes\n    let estimatedSize = baseSize;\n\n    if (url.includes('/api/posts')) {\n      estimatedSize = 15000; // ~15KB for posts API\n    } else if (url.includes('/api/comments')) {\n      estimatedSize = 8000; // ~8KB for comments\n    } else if (options.method === 'POST') {\n      estimatedSize = 5000; // ~5KB for POST requests\n    }\n\n    return estimatedSize;\n  }\n\n  // Check if request should be made based on connection\n  shouldMakeRequest(url, options = {}) {\n    if (!this.isOnline) {\n      return false;\n    }\n\n    if (this.isMeteredConnection()) {\n      const estimatedSize = this.estimateDataUsage(url, options);\n      \n      // Limit large requests on metered connections\n      if (estimatedSize > 20000) { // 20KB threshold\n        return false;\n      }\n    }\n\n    if (this.connectionQuality?.quality === 'poor' && !options.priority) {\n      return false;\n    }\n\n    return true;\n  }\n\n  // Destroy the network manager\n  destroy() {\n    window.removeEventListener('online', this.handleOnline);\n    window.removeEventListener('offline', this.handleOffline);\n    this.listeners.clear();\n  }\n}\n\n// Create singleton instance\nconst networkManager = new NetworkManager();\n\nexport default networkManager;