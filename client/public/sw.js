/* ── AI Pathshala Service Worker ───────────────────────────────────
   Strategy:
     • Navigation (HTML): network-first → fallback to cached shell
     • Static assets (JS/CSS/images): cache-first, fill cache on miss
     • /api/* calls: network-only (never cache API responses)
     • /uploads/* photos: network-first, cache on success
─────────────────────────────────────────────────────────────────── */
const CACHE = 'ai-pathshala-v2';

self.addEventListener('install', (e) => {
  // Pre-cache the app shell immediately
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/offline.html']).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests → network-first, fallback to shell
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return resp;
        })
        .catch(() => caches.match('/') || caches.match('/offline.html'))
    );
    return;
  }

  // Static assets → cache-first
  if (
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        });
      })
    );
    return;
  }

  // OSM tile images (for geo-stamp) → cache-first with long TTL
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Nominatim reverse geocode → network-first, short cache
  if (url.hostname === 'nominatim.openstreetmap.org') {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }
});
