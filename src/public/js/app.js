(() => {
  function updateOnlineUi() {
    const banner = document.getElementById('offline-banner');
    const syncStatus = document.getElementById('sync-status');
    const online = navigator.onLine;

    if (banner) {
      banner.classList.toggle('hidden', online);
    }

    if (syncStatus && window.OfflineQueue) {
      window.OfflineQueue.pendingCount().then((count) => {
        if (!online) {
          syncStatus.textContent = count ? `Offline · ${count} pend.` : 'Sin conexión';
          syncStatus.className = 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800';
        } else if (count > 0) {
          syncStatus.textContent = `${count} pendiente(s)`;
          syncStatus.className = 'rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800';
        } else {
          syncStatus.textContent = 'En línea';
          syncStatus.className = 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800';
        }
      });
    }
  }

  async function trySync() {
    if (!window.OfflineQueue) return;
    try {
      const result = await window.OfflineQueue.sync({ force: true });
      if (result.synced > 0) {
        document.dispatchEvent(new CustomEvent('votes:synced', { detail: result }));
      }
      updateOnlineUi();
    } catch (err) {
      console.warn('Sync pendiente:', err);
      updateOnlineUi();
    }
  }

  function prefetchOfflineShell() {
    if (!navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      urls: [
        '/offline.html',
        '/menu',
        '/report/realtime',
        '/report/total',
        '/css/app.css',
        '/css/app.css?v=14',
        '/js/offline-queue.js',
        '/js/confirm-dialog.js',
        '/js/realtime.js',
        '/js/offline-page.js',
        '/js/app.js',
        '/js/total-form.js',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ],
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        prefetchOfflineShell();
      })
      .catch((err) => {
        console.warn('SW no registrado:', err);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      prefetchOfflineShell();
    });
  }

  registerServiceWorker();

  window.addEventListener('online', () => {
    updateOnlineUi();
    trySync();
  });
  window.addEventListener('offline', updateOnlineUi);
  document.addEventListener('DOMContentLoaded', () => {
    updateOnlineUi();
    trySync();
    prefetchOfflineShell();
  });

  setInterval(() => {
    if (navigator.onLine) trySync();
  }, 30000);

  window.VotacionesApp = { updateOnlineUi, trySync, prefetchOfflineShell };
})();
