/**
 * Offline Manager for YipYap PWA
 * Manages offline data storage and synchronization for posts and comments
 */

class OfflineManager {
  constructor() {
    this.dbName = 'YipYapDB';
    this.dbVersion = 1;
    this.maxCachedPosts = 100;
    this.maxCachedComments = 500;
    this.db = null;

    this.initDB();
    this.setupSyncListeners();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createObjectStores(db);
      };
    });
  }

  createObjectStores(db) {
    // Cached posts store
    if (!db.objectStoreNames.contains('cached-posts')) {
      const postsStore = db.createObjectStore('cached-posts', { keyPath: 'id' });
      postsStore.createIndex('timestamp', 'cachedAt', { unique: false });
      postsStore.createIndex('score', 'score', { unique: false });
    }

    // Cached comments store
    if (!db.objectStoreNames.contains('cached-comments')) {
      const commentsStore = db.createObjectStore('cached-comments', { keyPath: 'id' });
      commentsStore.createIndex('postId', 'postId', { unique: false });
      commentsStore.createIndex('timestamp', 'cachedAt', { unique: false });
    }

    // Offline actions stores
    if (!db.objectStoreNames.contains('offline-posts')) {
      db.createObjectStore('offline-posts', { keyPath: 'id', autoIncrement: true });
    }

    if (!db.objectStoreNames.contains('offline-votes')) {
      db.createObjectStore('offline-votes', { keyPath: 'id', autoIncrement: true });
    }

    if (!db.objectStoreNames.contains('offline-comments')) {
      db.createObjectStore('offline-comments', { keyPath: 'id', autoIncrement: true });
    }
  }

  // Cache feed posts for offline access
  async cachePosts(posts) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['cached-posts'], 'readwrite');
    const store = tx.objectStore('cached-posts');

    const now = Date.now();
    const postsWithTimestamp = posts.map(post => ({
      ...post,
      cachedAt: now
    }));

    try {
      // Add new posts
      for (const post of postsWithTimestamp) {
        await store.put(post);
      }

      // Clean up old posts (keep only last 100)
      await this.cleanupOldPosts();

      console.log(`Cached ${posts.length} posts for offline access`);
    } catch (error) {
      console.error('Failed to cache posts:', error);
    }
  }

  // Cache comments for specific post
  async cacheComments(postId, comments) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['cached-comments'], 'readwrite');
    const store = tx.objectStore('cached-comments');

    const now = Date.now();
    const commentsWithTimestamp = comments.map(comment => ({
      ...comment,
      postId,
      cachedAt: now
    }));

    try {
      for (const comment of commentsWithTimestamp) {
        await store.put(comment);
      }

      // Clean up old comments
      await this.cleanupOldComments();

      console.log(`Cached ${comments.length} comments for post ${postId}`);
    } catch (error) {
      console.error('Failed to cache comments:', error);
    }
  }

  // Get cached posts for offline viewing
  async getCachedPosts(limit = 100) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['cached-posts'], 'readonly');
      const store = tx.objectStore('cached-posts');
      const index = store.index('timestamp');

      const request = index.openCursor(null, 'prev'); // Most recent first
      const posts = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && posts.length < limit) {
          posts.push(cursor.value);
          cursor.continue();
        } else {
          resolve(posts);
        }
      };

      request.onerror = () => {
        console.error('Failed to get cached posts:', request.error);
        reject(request.error);
      };
    });
  }

  // Get cached comments for a post
  async getCachedComments(postId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['cached-comments'], 'readonly');
      const store = tx.objectStore('cached-comments');
      const index = store.index('postId');

      const request = index.getAll(postId);

      request.onsuccess = () => {
        const comments = request.result.sort((a, b) => b.cachedAt - a.cachedAt);
        resolve(comments);
      };

      request.onerror = () => {
        console.error('Failed to get cached comments:', request.error);
        reject(request.error);
      };
    });
  }

  // Store offline post for later sync
  async storeOfflinePost(postData) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['offline-posts'], 'readwrite');
    const store = tx.objectStore('offline-posts');

    const offlinePost = {
      data: postData,
      createdAt: Date.now(),
      synced: false
    };

    try {
      await store.add(offlinePost);
      console.log('Stored post for offline sync');

      // Register background sync if available
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-posts');
      }

      return true;
    } catch (error) {
      console.error('Failed to store offline post:', error);
      return false;
    }
  }

  // Store offline vote for later sync
  async storeOfflineVote(postId, direction) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['offline-votes'], 'readwrite');
    const store = tx.objectStore('offline-votes');

    const offlineVote = {
      postId,
      direction,
      createdAt: Date.now(),
      synced: false
    };

    try {
      await store.add(offlineVote);
      console.log('Stored vote for offline sync');

      // Update cached post optimistically
      await this.updateCachedPostScore(postId, direction);

      // Register background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-votes');
      }

      return true;
    } catch (error) {
      console.error('Failed to store offline vote:', error);
      return false;
    }
  }

  // Store offline comment for later sync
  async storeOfflineComment(postId, commentData) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['offline-comments'], 'readwrite');
    const store = tx.objectStore('offline-comments');

    const offlineComment = {
      postId,
      data: commentData,
      createdAt: Date.now(),
      synced: false
    };

    try {
      await store.add(offlineComment);
      console.log('Stored comment for offline sync');

      // Register background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-comments');
      }

      return true;
    } catch (error) {
      console.error('Failed to store offline comment:', error);
      return false;
    }
  }

  // Optimistically update cached post score
  async updateCachedPostScore(postId, direction) {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['cached-posts'], 'readwrite');
    const store = tx.objectStore('cached-posts');

    try {
      const post = await store.get(postId);
      if (post) {
        const scoreChange = direction === 'up' ? 1 : -1;
        post.score = (post.score || 0) + scoreChange;
        post.userVote = direction;
        post.optimisticUpdate = true; // Mark as optimistic update

        await store.put(post);
        console.log(`Optimistically updated post ${postId} score`);
      }
    } catch (error) {
      console.error('Failed to update cached post score:', error);
    }
  }

  // Clean up old cached posts (keep last 100)
  async cleanupOldPosts() {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['cached-posts'], 'readwrite');
    const store = tx.objectStore('cached-posts');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev');
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          count++;
          if (count > this.maxCachedPosts) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clean up old cached comments (keep last 500)
  async cleanupOldComments() {
    if (!this.db) await this.initDB();

    const tx = this.db.transaction(['cached-comments'], 'readwrite');
    const store = tx.objectStore('cached-comments');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev');
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          count++;
          if (count > this.maxCachedComments) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Check if device is online
  isOnline() {
    return navigator.onLine;
  }

  // Setup network status listeners
  setupSyncListeners() {
    window.addEventListener('online', () => {
      console.log('Device came online, attempting sync...');
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
    });
  }

  // Attempt to sync when device comes online
  async syncWhenOnline() {
    if (!this.isOnline()) return;

    try {
      // Trigger service worker sync events
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;

        // Register all sync events
        await Promise.all([
          registration.sync.register('background-sync-posts'),
          registration.sync.register('background-sync-votes'),
          registration.sync.register('background-sync-comments')
        ]);

        console.log('Registered background sync events');
      }
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }

  // Get offline actions count for UI feedback
  async getOfflineActionsCount() {
    if (!this.db) await this.initDB();

    try {
      const tx = this.db.transaction(['offline-posts', 'offline-votes', 'offline-comments'], 'readonly');

      const [posts, votes, comments] = await Promise.all([
        tx.objectStore('offline-posts').count(),
        tx.objectStore('offline-votes').count(),
        tx.objectStore('offline-comments').count()
      ]);

      return {
        posts: posts.result || 0,
        votes: votes.result || 0,
        comments: comments.result || 0,
        total: (posts.result || 0) + (votes.result || 0) + (comments.result || 0)
      };
    } catch (error) {
      console.error('Failed to get offline actions count:', error);
      return { posts: 0, votes: 0, comments: 0, total: 0 };
    }
  }

  // Clear all cached data (for debugging or user preference)
  async clearAllCache() {
    if (!this.db) await this.initDB();

    const storeNames = ['cached-posts', 'cached-comments', 'offline-posts', 'offline-votes', 'offline-comments'];

    try {
      const tx = this.db.transaction(storeNames, 'readwrite');

      await Promise.all(
        storeNames.map(storeName => tx.objectStore(storeName).clear())
      );

      console.log('Cleared all cached data');
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }
}

// Create singleton instance
const offlineManager = new OfflineManager();

export default offlineManager;