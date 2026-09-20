const CACHE_NAME = 'votaciones-shell-v8';
const SHELL = [
  '/css/app.css',
  '/js/app.js',
  '/js/offline-queue.js',
  '/js/realtime.js',
  '/js/total-form.js',
  '/js/admin-charts.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Nunca cachear HTML/páginas: siempre red (evita tablas/vistas viejas)
  const isDocument =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/login');
        return cached || Response.error();
      })
    );
    return;
  }

  // CSS/JS: prefer network
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || Response.error();
      })
  );
});
