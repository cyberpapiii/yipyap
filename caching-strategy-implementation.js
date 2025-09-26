// YipYap Comprehensive Caching Strategy Implementation
// Multi-layer caching system for optimal performance

import Redis from 'redis';

// =============================================
// REDIS CACHE MANAGER
// =============================================

class CacheManager {
  constructor(config = {}) {
    this.redis = Redis.createClient({
      url: config.redisUrl || process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this.defaultTTL = config.defaultTTL || 300; // 5 minutes
    this.keyPrefix = config.keyPrefix || 'yipyap:';
    this.compressionThreshold = config.compressionThreshold || 1024; // 1KB

    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  // Generate cache key with prefix
  generateKey(namespace, identifier) {
    return `${this.keyPrefix}${namespace}:${identifier}`;
  }

  // Compress large data before storing
  async compressData(data) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > this.compressionThreshold) {
      const { gzip } = await import('zlib');
      const { promisify } = await import('util');
      const gzipAsync = promisify(gzip);
      const compressed = await gzipAsync(Buffer.from(jsonString));
      return { compressed: compressed.toString('base64'), isCompressed: true };
    }
    return { compressed: jsonString, isCompressed: false };
  }

  // Decompress data when retrieving
  async decompressData(data) {
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      if (parsed.isCompressed) {
        const { gunzip } = await import('zlib');
        const { promisify } = await import('util');
        const gunzipAsync = promisify(gunzip);
        const decompressed = await gunzipAsync(Buffer.from(parsed.compressed, 'base64'));
        return JSON.parse(decompressed.toString());
      }
      return parsed.compressed ? JSON.parse(parsed.compressed) : parsed;
    } catch (error) {
      console.error('Error decompressing data:', error);
      return null;
    }
  }

  // Generic get method
  async get(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      const data = await this.redis.get(key);
      return await this.decompressData(data);
    } catch (error) {
      console.error(`Cache get error for ${namespace}:${identifier}:`, error);
      return null;
    }
  }

  // Generic set method
  async set(namespace, identifier, data, ttl = this.defaultTTL) {
    try {
      const key = this.generateKey(namespace, identifier);
      const compressed = await this.compressData(data);
      await this.redis.setex(key, ttl, JSON.stringify(compressed));
      return true;
    } catch (error) {
      console.error(`Cache set error for ${namespace}:${identifier}:`, error);
      return false;
    }
  }

  // Delete cache entry
  async del(namespace, identifier) {
    try {
      const key = this.generateKey(namespace, identifier);
      return await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for ${namespace}:${identifier}:`, error);
      return false;
    }
  }

  // Batch operations
  async mget(namespace, identifiers) {
    try {
      const keys = identifiers.map(id => this.generateKey(namespace, id));
      const results = await this.redis.mget(keys);

      return Promise.all(results.map(async (data, index) => ({
        identifier: identifiers[index],
        data: await this.decompressData(data)
      })));
    } catch (error) {
      console.error(`Cache mget error for ${namespace}:`, error);
      return identifiers.map(id => ({ identifier: id, data: null }));
    }
  }

  // Cache warming - preload frequently accessed data
  async warmCache(warmingData) {
    const promises = warmingData.map(({ namespace, identifier, data, ttl }) =>
      this.set(namespace, identifier, data, ttl)
    );

    try {
      await Promise.all(promises);
      console.log(`Cache warmed with ${warmingData.length} entries`);
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  // Invalidate pattern-based keys
  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }
}

// =============================================
// APPLICATION-SPECIFIC CACHE MANAGERS
// =============================================

class FeedCacheManager extends CacheManager {
  constructor(config) {
    super(config);
    this.feedTTL = 120; // 2 minutes for feeds
    this.userTTL = 3600; // 1 hour for user data
  }

  // Cache user feed with cursor-based pagination
  async cacheFeed(userId, cursor = 'latest', feedData) {
    const identifier = `${userId}:${cursor}`;
    return this.set('feed', identifier, {
      posts: feedData,
      timestamp: Date.now(),
      cursor: cursor
    }, this.feedTTL);
  }

  // Get cached feed
  async getFeed(userId, cursor = 'latest') {
    const identifier = `${userId}:${cursor}`;
    const cached = await this.get('feed', identifier);

    if (cached && this.isFeedFresh(cached.timestamp)) {
      return cached.posts;
    }
    return null;
  }

  // Check if feed data is fresh enough
  isFeedFresh(timestamp, maxAge = 120000) { // 2 minutes
    return Date.now() - timestamp < maxAge;
  }

  // Cache post data
  async cachePost(postId, postData) {
    return this.set('post', postId, {
      ...postData,
      timestamp: Date.now()
    }, 600); // 10 minutes
  }

  // Get cached post
  async getPost(postId) {
    return this.get('post', postId);
  }

  // Cache user profile
  async cacheUser(userId, userData) {
    return this.set('user', userId, {
      ...userData,
      timestamp: Date.now()
    }, this.userTTL);
  }

  // Get cached user
  async getUser(userId) {
    return this.get('user', userId);
  }

  // Invalidate user-related caches
  async invalidateUserCaches(userId) {
    const patterns = [
      `feed:${userId}:*`,
      `user:${userId}`,
      `post:*:user:${userId}`,
      `comments:*:user:${userId}`
    ];

    let totalInvalidated = 0;
    for (const pattern of patterns) {
      totalInvalidated += await this.invalidatePattern(pattern);
    }

    console.log(`Invalidated ${totalInvalidated} cache entries for user ${userId}`);
    return totalInvalidated;
  }

  // Cache vote counts for posts
  async cacheVoteCounts(postId, voteCounts) {
    return this.set('votes', postId, voteCounts, 300); // 5 minutes
  }

  // Get cached vote counts
  async getVoteCounts(postId) {
    return this.get('votes', postId);
  }

  // Batch cache multiple posts
  async cachePosts(posts) {
    const promises = posts.map(post =>
      this.cachePost(post.id, post)
    );
    return Promise.all(promises);
  }
}

// =============================================
// SERVICE WORKER CACHE STRATEGY
// =============================================

// Service Worker cache implementation
const SW_CACHE_CONFIG = {
  CACHE_NAME: 'yipyap-v1',

  // Static assets - cache first, update in background
  STATIC_CACHE: {
    name: 'static-v1',
    urls: [
      '/',
      '/app.js',
      '/app.css',
      '/manifest.json',
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png'
    ],
    strategy: 'CacheFirst',
    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
  },

  // API responses - network first, fallback to cache
  API_CACHE: {
    name: 'api-v1',
    strategy: 'NetworkFirst',
    maxAgeSeconds: 60 * 60, // 1 hour
    maxEntries: 100
  },

  // Images - cache first with size limits
  IMAGE_CACHE: {
    name: 'images-v1',
    strategy: 'CacheFirst',
    maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
    maxEntries: 50,
    maxSizeBytes: 10 * 1024 * 1024 // 10MB
  }
};

// Service Worker cache strategies
const cacheStrategies = {
  // Cache first strategy for static assets
  cacheFirst: async (request, cacheName, maxAge) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      // Check if cache is expired
      const cachedDate = new Date(cached.headers.get('sw-cache-date'));
      const now = new Date();

      if (now - cachedDate < maxAge * 1000) {
        return cached;
      }
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        const responseClone = response.clone();
        responseClone.headers.append('sw-cache-date', new Date().toISOString());
        cache.put(request, responseClone);
      }
      return response;
    } catch (error) {
      return cached || new Response('Network error', { status: 503 });
    }
  },

  // Network first strategy for dynamic content
  networkFirst: async (request, cacheName, maxAge) => {
    const cache = await caches.open(cacheName);

    try {
      const response = await fetch(request);
      if (response.ok) {
        const responseClone = response.clone();
        responseClone.headers.append('sw-cache-date', new Date().toISOString());
        cache.put(request, responseClone);
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) {
        const cachedDate = new Date(cached.headers.get('sw-cache-date'));
        const now = new Date();

        // Return cached version even if expired when network fails
        if (now - cachedDate < maxAge * 2 * 1000) {
          return cached;
        }
      }
      throw error;
    }
  }
};

// =============================================
// CLIENT-SIDE CACHE (REACT QUERY CONFIG)
// =============================================

import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Feed data - short stale time for fresh content
        staleTime: 2 * 60 * 1000, // 2 minutes
        cacheTime: 5 * 60 * 1000, // 5 minutes

        // Retry configuration
        retry: (failureCount, error) => {
          // Don't retry 4xx errors except 408, 429
          if (error?.status >= 400 && error?.status < 500) {
            return [408, 429].includes(error.status) && failureCount < 2;
          }
          // Retry 5xx errors up to 3 times
          return failureCount < 3;
        },

        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Background refetch settings
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false
      },

      mutations: {
        retry: false, // Don't retry mutations by default

        // Network error handling
        networkMode: 'offlineFirst'
      }
    }
  });
};

// Query-specific configurations
export const queryConfigs = {
  feed: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Background refetch every 5 minutes
  },

  post: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  },

  user: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  },

  comments: {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
  }
};

// =============================================
// CACHE WARMING STRATEGY
// =============================================

class CacheWarmingService {
  constructor(cacheManager) {
    this.cache = cacheManager;
    this.warmingQueue = [];
    this.isWarming = false;
  }

  // Add items to warming queue
  queueForWarming(items) {
    this.warmingQueue.push(...items);
    if (!this.isWarming) {
      this.processWarmingQueue();
    }
  }

  // Process warming queue
  async processWarmingQueue() {
    this.isWarming = true;

    while (this.warmingQueue.length > 0) {
      const batch = this.warmingQueue.splice(0, 10); // Process 10 at a time

      await Promise.all(batch.map(async (item) => {
        try {
          await this.warmCacheItem(item);
        } catch (error) {
          console.error('Cache warming error:', error);
        }
      }));

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isWarming = false;
  }

  // Warm specific cache item
  async warmCacheItem({ type, identifier, ttl }) {
    switch (type) {
      case 'user':
        const userData = await this.fetchUserData(identifier);
        if (userData) {
          await this.cache.cacheUser(identifier, userData);
        }
        break;

      case 'post':
        const postData = await this.fetchPostData(identifier);
        if (postData) {
          await this.cache.cachePost(identifier, postData);
        }
        break;

      case 'feed':
        const feedData = await this.fetchFeedData(identifier);
        if (feedData) {
          await this.cache.cacheFeed(identifier, 'latest', feedData);
        }
        break;
    }
  }

  // Fetch methods (implement based on your API)
  async fetchUserData(userId) {
    // Implementation depends on your API
    return null;
  }

  async fetchPostData(postId) {
    // Implementation depends on your API
    return null;
  }

  async fetchFeedData(userId) {
    // Implementation depends on your API
    return null;
  }
}

// =============================================
// CACHE MONITORING AND METRICS
// =============================================

class CacheMonitor {
  constructor(cacheManager) {
    this.cache = cacheManager;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    this.startMetricsCollection();
  }

  // Record cache hit
  recordHit(namespace) {
    this.metrics.hits++;
    console.debug(`Cache HIT: ${namespace}`);
  }

  // Record cache miss
  recordMiss(namespace) {
    this.metrics.misses++;
    console.debug(`Cache MISS: ${namespace}`);
  }

  // Calculate hit ratio
  getHitRatio() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0;
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.metrics,
      hitRatio: this.getHitRatio()
    };
  }

  // Start metrics collection interval
  startMetricsCollection() {
    setInterval(() => {
      const stats = this.getStats();
      console.log('[Cache Metrics]', stats);

      // Reset metrics for next interval
      Object.keys(this.metrics).forEach(key => {
        this.metrics[key] = 0;
      });
    }, 60000); // Every minute
  }
}

// =============================================
// EXPORTS AND INITIALIZATION
// =============================================

// Initialize cache manager
const feedCacheManager = new FeedCacheManager({
  redisUrl: process.env.REDIS_URL,
  defaultTTL: 300,
  keyPrefix: 'yipyap:',
  compressionThreshold: 1024
});

// Initialize cache monitor
const cacheMonitor = new CacheMonitor(feedCacheManager);

// Initialize cache warming service
const cacheWarmingService = new CacheWarmingService(feedCacheManager);

export {
  CacheManager,
  FeedCacheManager,
  CacheWarmingService,
  CacheMonitor,
  feedCacheManager,
  cacheMonitor,
  cacheWarmingService,
  SW_CACHE_CONFIG,
  cacheStrategies,
  createQueryClient,
  queryConfigs
};