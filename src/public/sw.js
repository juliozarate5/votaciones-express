const CACHE_NAME = 'votaciones-shell-v16';

const SHELL = [
  '/offline.html',
  '/css/app.css',
  '/js/app.js',
  '/js/offline-queue.js',
  '/js/confirm-dialog.js',
  '/js/offline-page.js',
  '/js/realtime.js',
  '/js/total-form.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const PAGE_CACHE = ['/offline.html', '/menu', '/report/realtime', '/report/total', '/login'];

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
    pathname === '/manifest.json' ||
    pathname === '/offline.html' ||
    pathname === '/sw.js'
  );
}

async function cacheUrl(cache, url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
    if (res.ok) await cache.put(url, res.clone());
  } catch {
    /* best-effort */
  }
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

async function matchCache(request) {
  const url = new URL(request.url);
  return (
    (await caches.match(request, { ignoreSearch: true })) ||
    (await caches.match(url.pathname)) ||
    (await caches.match(url.pathname + url.search))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Best-effort: un asset faltante NO debe tumbar la instalación del SW
      await Promise.all([...SHELL, ...PAGE_CACHE].map((url) => cacheUrl(cache, url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const url of urls) {
          await cacheUrl(cache, url);
        }
      })
    );
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
  if (!isSameOriginHttpGet(request)) return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) return;

  const isDocument =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cacheablePaths = ['/menu', '/report/realtime', '/report/total', '/offline.html', '/login'];
            if (cacheablePaths.includes(url.pathname)) {
              await putInCache(request, fresh);
              // También por pathname (sin query) para matches offline
              const cache = await caches.open(CACHE_NAME);
              await cache.put(url.pathname, fresh.clone());
            }
          }
          return fresh;
        } catch {
          // Misma pantalla de conteo si está en caché; offline.html solo como último recurso
          const cached =
            (await matchCache(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match('/report/realtime')) ||
            (await caches.match('/menu')) ||
            (await caches.match('/offline.html'));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  if (!isStaticAsset(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cached = await matchCache(request);
      try {
        const fresh = await fetch(request);
        await putInCache(request, fresh);
        // Cachear también sin query (?v=11)
        if (fresh.ok && url.search) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(url.pathname, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
