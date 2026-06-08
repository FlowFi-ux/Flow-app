/* ─────────────────────────────────────────────────────────────
   Flow PWA — Service Worker
   Optimised for Netlify hosting
   ───────────────────────────────────────────────────────────── */

const CACHE_VERSION = 'flow-v81';           // bump this on every deploy
const CACHE_NAME    = `flow-${CACHE_VERSION}`;

/* Assets that must be available offline immediately after install.
   Paths are relative to the site root — works on any Netlify domain
   (custom domain, *.netlify.app, deploy preview, branch deploy).      */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/sw.js',
];

/* ── INSTALL — pre-cache static shell ───────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())   // activate immediately, no waiting tab
  );
});

/* ── ACTIVATE — delete stale caches ─────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())  // take control of existing tabs
  );
});

/* ── FETCH — Network-first for API, Cache-first for shell ───── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Only handle GET requests */
  if (request.method !== 'GET') return;

  /* Only handle http / https (skip chrome-extension, etc.) */
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* ── 1. Netlify Functions / API routes — Network only ───────
     Netlify serves Functions under /.netlify/functions/
     Never cache these; always hit the network.                  */
  if (url.pathname.startsWith('/.netlify/')) {
    event.respondWith(fetch(request));
    return;
  }

  /* ── 2. External API (mutual-fund prices) — Network with offline fallback */
  if (url.hostname === 'api.mfapi.in') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  /* ── 3. Google Fonts / CDN assets — Stale-while-revalidate ──
     Cache them on first fetch; serve from cache while updating
     in the background on subsequent visits.                     */
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'    ||
    url.hostname === 'cdn.jsdelivr.net'     ||
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* ── 4. Same-origin assets — Cache-first, revalidate in background ──
     This covers index.html, icons, manifest, and all other local files.
     On Netlify, the origin is your live URL so relative paths resolve
     correctly whether on the main domain or a deploy preview.          */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithRevalidate(request));
    return;
  }

  /* ── 5. Everything else — plain network ─────────────────────── */
  event.respondWith(fetch(request));
});

/* ─────────────────────────────────────────────────────────────
   Strategy helpers
   ───────────────────────────────────────────────────────────── */

/** Cache-first: serve cached copy instantly, refresh cache in background.
    Falls back to network when not cached; falls back to /index.html
    for navigation requests when fully offline.                          */
async function cacheFirstWithRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Kick off a background revalidation (fire-and-forget)
  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  if (cached) return cached;

  // Not in cache — wait for the network
  const networkResponse = await networkFetch;
  if (networkResponse) return networkResponse;

  // Fully offline + no cache — serve app shell for navigation requests
  if (request.destination === 'document') {
    return cache.match('/index.html');
  }
  return new Response('Offline', { status: 503 });
}

/** Stale-while-revalidate: serve cache instantly, update in background. */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Always try to refresh in the background
  fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
  }).catch(() => {});

  return cached || fetch(request);
}

/* ── MESSAGE — allow the page to trigger skipWaiting manually ─ */
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
