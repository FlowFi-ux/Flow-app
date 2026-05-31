/**
 * Flow — Service Worker
 * ─────────────────────────────────────────────────────────
 * HOW UPDATES WORK:
 * Every time you push a new version of the app to GitHub,
 * bump the CACHE_VERSION string below (e.g. v11 → v12).
 * The browser will detect the changed sw.js, install the new
 * worker, clear the old cache, and prompt the user to reload.
 *
 * If you forget to bump the version, the user gets the cached
 * old version. So — bump it on every deploy.
 * ─────────────────────────────────────────────────────────
 */

const CACHE_VERSION = 'flow-v37';          // ← BUMP ON EVERY DEPLOY
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

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(STATIC_ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames){
        return Promise.all(
          cacheNames
            .filter(function(name){ return name !== CACHE_NAME; })
            .map(function(name){ console.log('[SW] Deleting old cache:', name); return caches.delete(name); })
        );
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET') return;
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if(url.hostname === 'api.mfapi.in'){
    event.respondWith(fetch(event.request).catch(function(){
      return new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});
    }));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(cached){
        if(cached){
          fetch(event.request)
            .then(function(response){
              if(response && response.status === 200){
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, clone); });
              }
            })
            .catch(function(){});
          return cached;
        }
        return fetch(event.request)
          .then(function(response){
            if(!response || response.status !== 200 || response.type === 'opaque') return response;
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, clone); });
            return response;
          })
          .catch(function(){
            if(event.request.destination === 'document') return caches.match('./index.html');
          });
      })
  );
});

self.addEventListener('message', function(event){
  if(event.data && event.data.action === 'skipWaiting') self.skipWaiting();
});
