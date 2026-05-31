/**
 * Flow — Service Worker
 */
const CACHE_VERSION = 'flow-v43';          // ← BUMP ON EVERY DEPLOY
const CACHE_NAME    = `flow-${CACHE_VERSION}`;
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png', './sw.js'];
self.addEventListener('install', function(e){e.waitUntil(caches.open(CACHE_NAME).then(function(c){return c.addAll(STATIC_ASSETS);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate', function(e){e.waitUntil(caches.keys().then(function(n){return Promise.all(n.filter(function(k){return k!==CACHE_NAME;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch', function(e){const url=new URL(e.request.url);if(e.request.method!=='GET')return;if(url.protocol!=='http:'&&url.protocol!=='https:')return;if(url.hostname==='api.mfapi.in'){e.respondWith(fetch(e.request).catch(function(){return new Response(JSON.stringify({error:'offline'}),{headers:{'Content-Type':'application/json'}});}));return;}e.respondWith(caches.match(e.request).then(function(cached){if(cached){fetch(e.request).then(function(r){if(r&&r.status===200){var c=r.clone();caches.open(CACHE_NAME).then(function(cache){cache.put(e.request,c);});}}).catch(function(){});return cached;}return fetch(e.request).then(function(r){if(!r||r.status!==200||r.type==='opaque')return r;var c=r.clone();caches.open(CACHE_NAME).then(function(cache){cache.put(e.request,c);});return r;}).catch(function(){if(e.request.destination==='document')return caches.match('./index.html');});}));});
self.addEventListener('message', function(e){if(e.data&&e.data.action==='skipWaiting')self.skipWaiting();});
