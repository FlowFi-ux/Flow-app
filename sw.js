/* ══════════════════════════════════════════════════════════
   Flow PWA — Service Worker
   Strategy: Cache-first for app shell; network-first for CDN
   ══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'flow-v1.0';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const CDN_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── INSTALL — pre-cache app shell ──────────────────────────
self.addEventListener('install', event => {
  console.log('[Flow SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache app shell (must succeed)
      return cache.addAll(APP_SHELL).then(() => {
        // Cache CDN resources (best effort — don't block install)
        return Promise.allSettled(
          CDN_RESOURCES.map(url =>
            fetch(url, { mode: 'cors' })
              .then(res => res.ok ? cache.put(url, res) : null)
              .catch(() => null)
          )
        );
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE — clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  console.log('[Flow SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[Flow SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH — serve from cache, update in background ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http
  if (!url.protocol.startsWith('http')) return;

  // For the main HTML — network-first with cache fallback
  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For everything else — cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(err => {
          console.warn('[Flow SW] Fetch failed:', err);
          // Return offline page or cached content
          return caches.match('./index.html');
        });
    })
  );
});

// ── BACKGROUND SYNC — push data when back online ───────────
self.addEventListener('sync', event => {
  if (event.tag === 'flow-sync') {
    console.log('[Flow SW] Background sync triggered');
  }
});
