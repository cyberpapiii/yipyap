import { build, files, version } from '$service-worker';

// Create a unique cache name using the build version
const CACHE_NAME = `yipyap-${version}`;
const RUNTIME_CACHE = `yipyap-runtime-${version}`;
const DATA_CACHE = `yipyap-data-${version}`;
const IMAGE_CACHE = `yipyap-images-${version}`;

// Combine build files and static files for app shell
const APP_SHELL = [
  '/',
  ...build,
  ...files.filter(file => !file.includes('.map') && !file.includes('screenshots'))
];

// Files that should be cached with network-first strategy
const NETWORK_FIRST_ROUTES = [
  '/api/',
  '/_app/immutable/'
];

// Install event - Cache app shell and essential resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install - Version:', version);
  
  event.waitUntil(
    Promise.all([
      // Cache app shell
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(APP_SHELL);
      }),
      // Initialize other caches
      caches.open(RUNTIME_CACHE),
      caches.open(DATA_CACHE),
      caches.open(IMAGE_CACHE)
    ]).then(() => {
      console.log('[ServiceWorker] Skip waiting on install');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[ServiceWorker] Install failed:', error);
    })
  );
});

// Activate event - Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate - Version:', version);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('yipyap-') && !cacheName.includes(version);
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[ServiceWorker] All clients claimed');
    }).catch((error) => {
      console.error('[ServiceWorker] Activation failed:', error);
    })
  );
});

// Fetch event - Implement comprehensive caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Handle SvelteKit app files with cache-first strategy
  if (url.pathname.startsWith('/_app/')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // Handle images with cache-first strategy and longer TTL
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 86400000)); // 24 hours
    return;
  }

  // Handle static assets with cache-first strategy
  if (request.destination === 'script' || request.destination === 'style' || 
      request.destination === 'font' || url.pathname.includes('/static/')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Default: try cache first, then network
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).catch(() => {
        // Return offline page for failed requests
        if (request.destination === 'document') {
          return caches.match('/');
        }
        throw new Error('Network request failed and no cache available');
      });
    })
  );
});

// Navigation handler with offline support
async function handleNavigate(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful navigation responses
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[ServiceWorker] Navigation fetch failed:', error);
  }

  // Fallback to cached version or app shell
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Final fallback to app shell
  return caches.match('/');
}

// Cache First strategy - Best for static assets
async function cacheFirst(request, cacheName, maxAge = 3600000) { // Default 1 hour
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Check if cache is still fresh
      const cacheDate = new Date(cachedResponse.headers.get('date'));
      const now = new Date();
      
      if (now.getTime() - cacheDate.getTime() < maxAge) {
        return cachedResponse;
      }
    }

    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Cache first failed:', error);
    
    // Return cached version if network fails
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network First strategy - Best for API data
async function networkFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses with timestamp
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.append('sw-cache-timestamp', Date.now().toString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });

      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network first failed, trying cache:', error);
    
    // Fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Add offline indicator header
      const headers = new Headers(cachedResponse.headers);
      headers.append('sw-offline-response', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }
    
    throw error;
  }
}

// Stale While Revalidate strategy - Best for frequently updated content
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[ServiceWorker] Network request failed in SWR:', error);
      return cachedResponse;
    });

  return cachedResponse || fetchPromise;
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);

  if (event.tag === 'background-sync-posts') {
    event.waitUntil(syncOfflinePosts());
  }

  if (event.tag === 'background-sync-votes') {
    event.waitUntil(syncOfflineVotes());
  }

  if (event.tag === 'background-sync-comments') {
    event.waitUntil(syncOfflineComments());
  }
});

// Sync offline posts when connection is restored
async function syncOfflinePosts() {
  try {
    const db = await openDB();
    const tx = db.transaction(['offline-posts'], 'readonly');
    const store = tx.objectStore('offline-posts');
    const posts = await getAllFromStore(store);

    console.log(`[ServiceWorker] Syncing ${posts.length} offline posts`);

    for (const post of posts) {
      try {
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(post.data)
        });

        if (response.ok) {
          // Remove from offline storage
          const deleteTx = db.transaction(['offline-posts'], 'readwrite');
          const deleteStore = deleteTx.objectStore('offline-posts');
          await deleteStore.delete(post.id);
          
          console.log(`[ServiceWorker] Successfully synced post ${post.id}`);
          
          // Notify clients of successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                action: 'post',
                id: post.id
              });
            });
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync post:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Background sync failed:', error);
  }
}

// Sync offline votes when connection is restored
async function syncOfflineVotes() {
  try {
    const db = await openDB();
    const tx = db.transaction(['offline-votes'], 'readonly');
    const store = tx.objectStore('offline-votes');
    const votes = await getAllFromStore(store);

    console.log(`[ServiceWorker] Syncing ${votes.length} offline votes`);

    for (const vote of votes) {
      try {
        const response = await fetch(`/api/posts/${vote.postId}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ direction: vote.direction })
        });

        if (response.ok) {
          const deleteTx = db.transaction(['offline-votes'], 'readwrite');
          const deleteStore = deleteTx.objectStore('offline-votes');
          await deleteStore.delete(vote.id);
          
          console.log(`[ServiceWorker] Successfully synced vote ${vote.id}`);
          
          // Notify clients
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                action: 'vote',
                postId: vote.postId,
                direction: vote.direction
              });
            });
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync vote:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Vote sync failed:', error);
  }
}

// Sync offline comments when connection is restored
async function syncOfflineComments() {
  try {
    const db = await openDB();
    const tx = db.transaction(['offline-comments'], 'readonly');
    const store = tx.objectStore('offline-comments');
    const comments = await getAllFromStore(store);

    console.log(`[ServiceWorker] Syncing ${comments.length} offline comments`);

    for (const comment of comments) {
      try {
        const response = await fetch(`/api/posts/${comment.postId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(comment.data)
        });

        if (response.ok) {
          const deleteTx = db.transaction(['offline-comments'], 'readwrite');
          const deleteStore = deleteTx.objectStore('offline-comments');
          await deleteStore.delete(comment.id);
          
          console.log(`[ServiceWorker] Successfully synced comment ${comment.id}`);
          
          // Notify clients
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                action: 'comment',
                postId: comment.postId
              });
            });
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync comment:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Comment sync failed:', error);
  }
}

// Enhanced Push notification handler
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error('[ServiceWorker] Invalid push data:', error);
      data = { title: 'YipYap', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || `yipyap-${Date.now()}`,
    data: {
      url: data.url || '/',
      postId: data.postId,
      notificationId: data.notificationId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
    renotify: data.renotify || false,
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'YipYap', options)
      .then(() => {
        console.log('[ServiceWorker] Notification shown successfully');
        
        // Track notification analytics
        if (data.trackingId) {
          fetch('/api/analytics/notification-shown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingId: data.trackingId })
          }).catch(() => {}); // Fail silently
        }
      })
      .catch(error => {
        console.error('[ServiceWorker] Failed to show notification:', error);
      })
  );
});

// Enhanced Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  const postId = event.notification.data?.postId;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(urlToOpen, self.location.origin);
        
        if (clientUrl.origin === targetUrl.origin) {
          // Navigate existing client to the target URL
          client.postMessage({
            type: 'NAVIGATE',
            url: targetUrl.pathname + targetUrl.search + targetUrl.hash
          });
          return client.focus();
        }
      }

      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }).then(() => {
      // Track notification click analytics
      const trackingId = event.notification.data?.trackingId;
      if (trackingId) {
        fetch('/api/analytics/notification-clicked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            trackingId, 
            action: event.action || 'view',
            postId 
          })
        }).catch(() => {}); // Fail silently
      }
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed');
  
  // Track notification dismissal analytics
  const trackingId = event.notification.data?.trackingId;
  if (trackingId) {
    fetch('/api/analytics/notification-dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId })
    }).catch(() => {}); // Fail silently
  }
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    if (urls && urls.length > 0) {
      precacheUrls(urls);
    }
  }
});

// Precache specific URLs on demand
async function precacheUrls(urls) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.addAll(urls);
    console.log('[ServiceWorker] Precached URLs:', urls);
  } catch (error) {
    console.error('[ServiceWorker] Failed to precache URLs:', error);
  }
}

// IndexedDB helper functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('YipYapDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores for offline functionality
      if (!db.objectStoreNames.contains('offline-posts')) {
        db.createObjectStore('offline-posts', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('offline-votes')) {
        db.createObjectStore('offline-votes', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('offline-comments')) {
        db.createObjectStore('offline-comments', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('cached-posts')) {
        const store = db.createObjectStore('cached-posts', { keyPath: 'id' });
        store.createIndex('timestamp', 'cachedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('cached-comments')) {
        const store = db.createObjectStore('cached-comments', { keyPath: 'id' });
        store.createIndex('postId', 'postId', { unique: false });
        store.createIndex('timestamp', 'cachedAt', { unique: false });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Periodic cleanup of old caches and data
setInterval(async () => {
  try {
    // Clean up old image cache entries (older than 7 days)
    const imageCache = await caches.open(IMAGE_CACHE);
    const requests = await imageCache.keys();
    
    for (const request of requests) {
      const response = await imageCache.match(request);
      if (response) {
        const date = response.headers.get('date');
        if (date && Date.now() - new Date(date).getTime() > 604800000) { // 7 days
          await imageCache.delete(request);
        }
      }
    }
    
    console.log('[ServiceWorker] Cleaned up old image cache entries');
  } catch (error) {
    console.error('[ServiceWorker] Cache cleanup failed:', error);
  }
}, 86400000); // Run daily