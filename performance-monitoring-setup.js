// YipYap Performance Monitoring Implementation
// This file provides comprehensive performance tracking for the YipYap application

class PerformanceMonitor {
  constructor(config = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint || '/api/analytics/performance',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 5000,
      enableConsoleLogging: config.enableConsoleLogging || false,
      ...config
    };

    this.metrics = [];
    this.observers = new Map();
    this.init();
  }

  init() {
    this.setupWebVitalsTracking();
    this.setupCustomMetricsTracking();
    this.setupResourceTimingTracking();
    this.setupNavigationTimingTracking();
    this.startMetricsFlushing();
  }

  // Core Web Vitals tracking
  setupWebVitalsTracking() {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];

      this.trackMetric({
        name: 'lcp',
        value: lastEntry.startTime,
        rating: this.getLCPRating(lastEntry.startTime),
        timestamp: Date.now(),
        url: window.location.pathname
      });
    });

    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    this.observers.set('lcp', lcpObserver);

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        this.trackMetric({
          name: 'fid',
          value: entry.processingStart - entry.startTime,
          rating: this.getFIDRating(entry.processingStart - entry.startTime),
          timestamp: Date.now(),
          url: window.location.pathname
        });
      });
    });

    fidObserver.observe({ type: 'first-input', buffered: true });
    this.observers.set('fid', fidObserver);

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      this.trackMetric({
        name: 'cls',
        value: clsValue,
        rating: this.getCLSRating(clsValue),
        timestamp: Date.now(),
        url: window.location.pathname
      });
    });

    clsObserver.observe({ type: 'layout-shift', buffered: true });
    this.observers.set('cls', clsObserver);
  }

  // Custom application metrics
  setupCustomMetricsTracking() {
    // Feed load time tracking
    window.yipyapPerformance = {
      markFeedLoadStart: () => {
        performance.mark('feed-load-start');
      },

      markFeedLoadEnd: () => {
        performance.mark('feed-load-end');
        performance.measure('feed-load-time', 'feed-load-start', 'feed-load-end');

        const measure = performance.getEntriesByName('feed-load-time')[0];
        this.trackMetric({
          name: 'feed_load_time',
          value: measure.duration,
          rating: measure.duration < 1500 ? 'good' : measure.duration < 2500 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
          url: window.location.pathname
        });
      },

      // Post interaction tracking
      markPostInteractionStart: (postId, action) => {
        const markName = `post-${action}-${postId}-start`;
        performance.mark(markName);
        return markName;
      },

      markPostInteractionEnd: (startMark, postId, action) => {
        const endMark = `post-${action}-${postId}-end`;
        const measureName = `post-${action}-${postId}-duration`;

        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);

        const measure = performance.getEntriesByName(measureName)[0];
        this.trackMetric({
          name: `post_${action}_time`,
          value: measure.duration,
          postId: postId,
          rating: measure.duration < 200 ? 'good' : measure.duration < 500 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
          url: window.location.pathname
        });
      }
    };
  }

  // Resource timing tracking
  setupResourceTimingTracking() {
    const resourceObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        // Track JS bundle loading performance
        if (entry.name.includes('.js')) {
          this.trackMetric({
            name: 'js_load_time',
            value: entry.responseEnd - entry.startTime,
            resource: entry.name,
            size: entry.transferSize,
            timestamp: Date.now(),
            url: window.location.pathname
          });
        }

        // Track API response times
        if (entry.name.includes('/api/')) {
          this.trackMetric({
            name: 'api_response_time',
            value: entry.responseEnd - entry.startTime,
            endpoint: entry.name,
            timestamp: Date.now(),
            url: window.location.pathname
          });
        }
      });
    });

    resourceObserver.observe({ type: 'resource', buffered: true });
    this.observers.set('resource', resourceObserver);
  }

  // Navigation timing tracking
  setupNavigationTimingTracking() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];

        this.trackMetric({
          name: 'ttfb',
          value: nav.responseStart - nav.requestStart,
          rating: this.getTTFBRating(nav.responseStart - nav.requestStart),
          timestamp: Date.now(),
          url: window.location.pathname
        });

        this.trackMetric({
          name: 'dom_content_loaded',
          value: nav.domContentLoadedEventEnd - nav.navigationStart,
          timestamp: Date.now(),
          url: window.location.pathname
        });

        this.trackMetric({
          name: 'load_complete',
          value: nav.loadEventEnd - nav.navigationStart,
          timestamp: Date.now(),
          url: window.location.pathname
        });
      }, 0);
    });
  }

  // Metric rating helpers
  getLCPRating(value) {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  getFIDRating(value) {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  getCLSRating(value) {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  getTTFBRating(value) {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs-improvement';
    return 'poor';
  }

  // Track custom metric
  trackMetric(metric) {
    this.metrics.push({
      ...metric,
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo()
    });

    if (this.config.enableConsoleLogging) {
      console.log('[Performance]', metric);
    }

    // Flush if batch size reached
    if (this.metrics.length >= this.config.batchSize) {
      this.flushMetrics();
    }
  }

  // Get session ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('yipyap_session_id');
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem('yipyap_session_id', sessionId);
    }
    return sessionId;
  }

  // Get user ID (implement based on your auth system)
  getUserId() {
    // This should integrate with your authentication system
    return localStorage.getItem('yipyap_user_id') || 'anonymous';
  }

  // Get connection information
  getConnectionInfo() {
    if ('connection' in navigator) {
      return {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      };
    }
    return null;
  }

  // Generate unique ID
  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() :
           'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (c) => {
             const r = Math.random() * 16 | 0;
             const v = c === 'x' ? r : (r & 0x3 | 0x8);
             return v.toString(16);
           });
  }

  // Flush metrics to server
  async flushMetrics() {
    if (this.metrics.length === 0) return;

    const metricsToSend = this.metrics.splice(0);

    try {
      await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: metricsToSend }),
      });
    } catch (error) {
      console.error('[Performance] Failed to send metrics:', error);
      // Optionally re-queue metrics for retry
    }
  }

  // Start periodic flushing
  startMetricsFlushing() {
    setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushMetrics();
    });
  }

  // Bundle size monitoring
  static monitorBundleSize() {
    const bundleSizeObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if (entry.name.includes('main.') && entry.name.includes('.js')) {
          const sizeKB = Math.round(entry.transferSize / 1024);
          const gzipSizeKB = Math.round(entry.encodedBodySize / 1024);

          // Alert if bundle size exceeds target
          if (gzipSizeKB > 150) {
            console.warn(`[Performance] Bundle size exceeds target: ${gzipSizeKB}KB gzip (target: 150KB)`);
          }

          // Track bundle size metric
          window.performanceMonitor?.trackMetric({
            name: 'bundle_size',
            value: sizeKB,
            gzipSize: gzipSizeKB,
            resource: entry.name,
            timestamp: Date.now(),
            url: window.location.pathname
          });
        }
      });
    });

    bundleSizeObserver.observe({ type: 'resource', buffered: true });
  }

  // Cleanup observers
  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.flushMetrics();
  }
}

// Initialize performance monitoring
const performanceMonitor = new PerformanceMonitor({
  apiEndpoint: '/api/analytics/performance',
  batchSize: 10,
  flushInterval: 5000,
  enableConsoleLogging: process.env.NODE_ENV === 'development'
});

// Monitor bundle size
PerformanceMonitor.monitorBundleSize();

// Export for global access
window.performanceMonitor = performanceMonitor;

export default PerformanceMonitor;