// Service Worker for NADC Helpdesk PWA
// Version is set at build time - change this to bust cache on deploy
const CACHE_VERSION = '__BUILD_TIME__';
const CACHE_NAME = `nadc-helpdesk-${CACHE_VERSION}`;

// Files to cache for offline support (minimal set)
const OFFLINE_CACHE = [
  '/offline.html'
];

// Install event - cache minimal offline assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event, version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching offline assets');
        return cache.addAll(OFFLINE_CACHE).catch(() => {
          // Ignore if offline.html doesn't exist
          console.log('[SW] No offline.html found, continuing');
        });
      })
      .then(() => {
        // Skip waiting to activate immediately
        console.log('[SW] Skip waiting, activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and notify clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event, version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('nadc-helpdesk-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Claim all clients immediately
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients about the update
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: CACHE_VERSION
            });
          });
        });
      })
  );
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - always go to network, no caching
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Skip WebSocket and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // For navigation requests (HTML), use network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache, then offline page
          return caches.match(event.request)
            .then((cached) => cached || caches.match('/offline.html'))
            .then((response) => response || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // For JS, CSS, and other assets - network first with cache fallback
  // This ensures fresh content on deploy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache non-successful responses
        if (!response.ok) {
          return response;
        }

        // Clone and cache successful responses
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed - try to serve from cache
        return caches.match(event.request);
      })
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received skip waiting message');
    self.skipWaiting();
  }
});
