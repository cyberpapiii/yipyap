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
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
      caches.open(RUNTIME_CACHE),
      caches.open(DATA_CACHE),
      caches.open(IMAGE_CACHE)
    ]).then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('yipyap-') && !cacheName.includes(version))
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - Implement comprehensive caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (url.pathname.startsWith('/_app/')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 86400000));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).catch(() => {
        if (request.destination === 'document') {
          return caches.match('/');
        }
        throw new Error('Network request failed and no cache available');
      });
    })
  );
});

async function handleNavigate(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {}

  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  return caches.match('/');
}

async function cacheFirst(request, cacheName, maxAge = 3600000) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      const cacheDate = new Date(cachedResponse.headers.get('date'));
      const now = new Date();
      if (cacheDate && now.getTime() - cacheDate.getTime() < maxAge) {
        return cachedResponse;
      }
    }
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

async function networkFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
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
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
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

self.addEventListener('message', (event) => {
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

async function precacheUrls(urls) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.addAll(urls);
  } catch (error) {}
}
