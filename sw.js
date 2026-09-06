// GEOPULSE Service Worker — V2.3 PWA
// Cache-first for static assets, network-first for API data
const CACHE_NAME = 'geopulse-v2.6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/i18n.js',
  '/main.js',
  '/search.js',
  '/widgets.js',
  '/quiz.js',
  '/quiz_bank.js',
  '/config.js',
  '/tours_new.js',
  '/tours_de.js',
  '/fetchWrapper.js',
  '/manifest.json'
];

// Install: pre-cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for external APIs
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls (let them go to network)
  if (event.request.method !== 'GET') return;

  // For same-origin static files: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Return cached version, but also update cache in background
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // Fallback to cache if offline

        return cached || fetchPromise;
      })
    );
    return;
  }

  // External requests (APIs, tiles): network-first, no caching
  // This prevents stale data for USGS, NASA, ISS etc.
});
