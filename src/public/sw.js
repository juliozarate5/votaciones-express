const CACHE_NAME = 'votaciones-shell-v10';
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

function isSameOriginHttpGet(request) {
  try {
    if (request.method !== 'GET') return false;
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.origin !== self.location.origin) return false;
    return true;
  } catch {
    return false;
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/css/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json'
  );
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (err) {
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

  // Nunca interceptar POST/login/logout/HTML: el navegador habla directo con el servidor
  if (!isSameOriginHttpGet(request)) return;

  const url = new URL(request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/login' ||
    url.pathname === '/logout' ||
    url.pathname === '/menu' ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/report')
  ) {
    return;
  }

  // Solo assets estáticos (CSS/JS/iconos)
  if (!isStaticAsset(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        await putInCache(request, response);
        return response;
      })
      .catch(() => caches.match(request))
  );
});
