/**
 * Performance Optimizer for YipYap PWA
 * Implements various performance optimization techniques
 */

class PerformanceOptimizer {
  constructor() {
    this.observers = new Map();
    this.deferredTasks = [];
    this.isIdle = false;

    this.initializePerformanceMonitoring();
    this.setupIdleCallback();
    this.setupResourceHints();
  }

  // Initialize performance monitoring
  initializePerformanceMonitoring() {
    if ('performance' in window && 'PerformanceObserver' in window) {
      // Monitor Largest Contentful Paint
      this.observeMetric('largest-contentful-paint', (entries) => {
        entries.forEach(entry => {
          console.log('LCP:', entry.startTime);
          this.trackMetric('lcp', entry.startTime);
        });
      });

      // Monitor First Input Delay
      this.observeMetric('first-input', (entries) => {
        entries.forEach(entry => {
          const fid = entry.processingStart - entry.startTime;
          console.log('FID:', fid);
          this.trackMetric('fid', fid);
        });
      });

      // Monitor Cumulative Layout Shift
      this.observeMetric('layout-shift', (entries) => {
        let cls = 0;
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        console.log('CLS:', cls);
        this.trackMetric('cls', cls);
      });

      // Monitor long tasks
      this.observeMetric('longtask', (entries) => {
        entries.forEach(entry => {
          console.warn('Long task detected:', entry.duration);
          this.trackMetric('longtask', entry.duration);
        });
      });
    }
  }

  // Observe performance metrics
  observeMetric(type, callback) {
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe({ entryTypes: [type] });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Could not observe ${type}:`, error);
    }
  }

  // Setup idle callback for deferred tasks
  setupIdleCallback() {
    if ('requestIdleCallback' in window) {
      const processIdleTasks = (deadline) => {
        this.isIdle = true;

        while (deadline.timeRemaining() > 0 && this.deferredTasks.length > 0) {
          const task = this.deferredTasks.shift();
          try {
            task();
          } catch (error) {
            console.error('Error in deferred task:', error);
          }
        }

        if (this.deferredTasks.length > 0) {
          requestIdleCallback(processIdleTasks);
        } else {
          this.isIdle = false;
        }
      };

      requestIdleCallback(processIdleTasks);
    }
  }

  // Setup resource hints for critical resources
  setupResourceHints() {
    // Preload critical fonts
    this.preloadResource('/fonts/inter-var.woff2', 'font', 'font/woff2');

    // DNS prefetch for external domains
    this.dnsPrefetch('https://api.yipyap.com');
    this.dnsPrefetch('https://cdn.yipyap.com');

    // Preconnect to critical third-party origins
    this.preconnect('https://api.yipyap.com');
  }

  // Preload critical resources
  preloadResource(href, as, type = null, crossorigin = null) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;

    if (type) link.type = type;
    if (crossorigin) link.crossOrigin = crossorigin;

    document.head.appendChild(link);
  }

  // DNS prefetch for external domains
  dnsPrefetch(href) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  // Preconnect to critical origins
  preconnect(href, crossorigin = false) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    if (crossorigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // Defer non-critical tasks to idle time
  deferTask(task) {
    if (typeof task !== 'function') {
      console.warn('Deferred task must be a function');
      return;
    }

    this.deferredTasks.push(task);

    if ('requestIdleCallback' in window && !this.isIdle) {
      requestIdleCallback(() => {
        if (this.deferredTasks.length > 0) {
          const deferredTask = this.deferredTasks.shift();
          deferredTask();
        }
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(task, 0);
    }
  }

  // Lazy load modules
  async lazyLoadModule(importFn) {
    return new Promise((resolve, reject) => {
      this.deferTask(async () => {
        try {
          const module = await importFn();
          resolve(module);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Optimize images for different screen densities
  getOptimizedImageSrc(baseSrc, width = 320, quality = 80) {
    if (!baseSrc) return '';

    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = Math.round(width * devicePixelRatio);

    // Generate optimized image URL based on your CDN or image service
    const extension = baseSrc.split('.').pop().toLowerCase();
    const baseName = baseSrc.replace(`.${extension}`, '');

    // Example for a generic image optimization service
    return `${baseName}?w=${targetWidth}&q=${quality}&format=webp`;
  }

  // Debounce function for performance-sensitive operations
  debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };

      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) func(...args);
    };
  }

  // Throttle function for scroll/resize events
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Virtual scrolling helper for large lists
  calculateVirtualScrollItems(containerHeight, itemHeight, totalItems, scrollTop, buffer = 5) {
    const visibleItems = Math.ceil(containerHeight / itemHeight);
    const firstVisibleIndex = Math.floor(scrollTop / itemHeight);

    const startIndex = Math.max(0, firstVisibleIndex - buffer);
    const endIndex = Math.min(totalItems - 1, firstVisibleIndex + visibleItems + buffer);

    return {
      startIndex,
      endIndex,
      visibleItems: endIndex - startIndex + 1,
      offsetY: startIndex * itemHeight
    };
  }

  // Code splitting helper
  async loadComponentChunk(chunkName) {
    try {
      // Dynamic import with chunk name
      const module = await import(
        /* webpackChunkName: "[request]" */
        `../components/${chunkName}`
      );
      return module.default || module;
    } catch (error) {
      console.error(`Failed to load component chunk ${chunkName}:`, error);
      throw error;
    }
  }

  // Prefetch route chunks based on user interaction
  prefetchRouteChunk(routeName) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        import(
          /* webpackChunkName: "[request]" */
          /* webpackPrefetch: true */
          `../pages/${routeName}`
        ).catch(error => {
          console.warn(`Failed to prefetch route ${routeName}:`, error);
        });
      });
    }
  }

  // Memory usage monitoring
  monitorMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      const usage = {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };

      console.log('Memory usage:', usage);

      // Warn if memory usage is high
      if (usage.used / usage.limit > 0.8) {
        console.warn('High memory usage detected:', usage);
        this.trackMetric('memory_warning', usage.used);
      }

      return usage;
    }

    return null;
  }

  // Bundle size analyzer helper
  analyzeBundleSize() {
    if ('performance' in window) {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(resource =>
        resource.name.includes('.js') && resource.transferSize
      );

      const totalJSSize = jsResources.reduce((total, resource) => {
        return total + resource.transferSize;
      }, 0);

      console.log('Total JS bundle size:', Math.round(totalJSSize / 1024), 'KB');

      const bundleAnalysis = {
        totalSize: Math.round(totalJSSize / 1024),
        resources: jsResources.map(resource => ({
          name: resource.name.split('/').pop(),
          size: Math.round(resource.transferSize / 1024)
        }))
      };

      this.trackMetric('bundle_size', bundleAnalysis.totalSize);

      return bundleAnalysis;
    }

    return null;
  }

  // Track performance metrics
  trackMetric(name, value, extra = {}) {
    // Send to analytics service
    if (window.gtag) {
      window.gtag('event', 'performance_metric', {
        event_category: 'Performance',
        event_label: name,
        value: Math.round(value),
        custom_map: extra
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance metric - ${name}:`, value, extra);
    }
  }

  // Get performance recommendations
  getPerformanceRecommendations() {
    const recommendations = [];

    // Check FCP
    const fcp = this.getMetric('fcp');
    if (fcp > 1800) {
      recommendations.push({
        type: 'warning',
        metric: 'First Contentful Paint',
        value: fcp,
        recommendation: 'Consider optimizing critical rendering path'
      });
    }

    // Check LCP
    const lcp = this.getMetric('lcp');
    if (lcp > 2500) {
      recommendations.push({
        type: 'error',
        metric: 'Largest Contentful Paint',
        value: lcp,
        recommendation: 'Optimize largest content element loading'
      });
    }

    // Check FID
    const fid = this.getMetric('fid');
    if (fid > 100) {
      recommendations.push({
        type: 'warning',
        metric: 'First Input Delay',
        value: fid,
        recommendation: 'Reduce JavaScript execution time'
      });
    }

    // Check CLS
    const cls = this.getMetric('cls');
    if (cls > 0.1) {
      recommendations.push({
        type: 'warning',
        metric: 'Cumulative Layout Shift',
        value: cls,
        recommendation: 'Reserve space for dynamic content'
      });
    }

    return recommendations;
  }

  // Get stored metric value
  getMetric(name) {
    return this.metrics?.[name] || 0;
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    this.deferredTasks = [];
  }
}

// Create singleton instance
const performanceOptimizer = new PerformanceOptimizer();

export default performanceOptimizer;