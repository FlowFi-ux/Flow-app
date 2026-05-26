/**
 * Flow — Service Worker
 * ─────────────────────────────────────────────────────────
 * HOW UPDATES WORK:
 * Every time you push a new version of the app to GitHub,
 * bump the CACHE_VERSION string below (e.g. v8 → v9).
 * The browser detects the changed sw.js, installs the new
 * worker, clears the old cache, and prompts the user to reload.
 * ─────────────────────────────────────────────────────────
 */

const CACHE_VERSION = 'flow-v8';          // ← BUMP ON EVERY DEPLOY
const CACHE_NAME    = `flow-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './sw.js',
];

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(STATIC_ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

// ── ACTIVATE — delete old caches ─────────────────────────
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames){
        return Promise.all(
          cacheNames
            .filter(function(name){ return name !== CACHE_NAME; })
            .map(function(name){ return caches.delete(name); })
        );
      })
      .then(function(){ return self.clients.claim(); })
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', function(event){
  const url = new URL(event.request.url);

  if(event.request.method !== 'GET') return;
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // NAV API — always network, never cache
  if(url.hostname === 'api.mfapi.in'){
    event.respondWith(
      fetch(event.request).catch(function(){
        return new Response(JSON.stringify({error:'offline'}),
          {headers:{'Content-Type':'application/json'}});
      })
    );
    return;
  }

  // Everything else: cache-first, update in background
  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached){
        fetch(event.request).then(function(response){
          if(response && response.status === 200){
            caches.open(CACHE_NAME)
              .then(function(cache){ cache.put(event.request, response); });
          }
        }).catch(function(){});
        return cached;
      }
      return fetch(event.request).then(function(response){
        if(!response || response.status !== 200 || response.type === 'opaque'){
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME)
          .then(function(cache){ cache.put(event.request, clone); });
        return response;
      }).catch(function(){
        if(event.request.destination === 'document'){
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MESSAGE — skipWaiting from page ──────────────────────
self.addEventListener('message', function(event){
  if(event.data && event.data.action === 'skipWaiting'){
    self.skipWaiting();
  }
});
