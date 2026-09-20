const CACHE_NAME = 'votaciones-shell-v9';
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

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.origin !== self.location.origin) return false;
    if (request.method !== 'GET') return false;
    return true;
  } catch {
    return false;
  }
}

async function putInCache(request, response) {
  if (!isCacheableRequest(request) || !response || !response.ok) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (err) {
    // Ignorar esquemas no soportados (chrome-extension, etc.)
    console.warn('Cache put omitido:', err.message);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install cache:', err))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // No interceptar extensiones del navegador ni otros esquemas
  if (!isCacheableRequest(request)) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

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

  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          await putInCache(request, response);
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Solo iconos/manifest del mismo origen; no cachear CDN externos
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          await putInCache(request, response);
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
