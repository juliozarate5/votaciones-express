(() => {
  function updateOnlineUi() {
    const banner = document.getElementById('offline-banner');
    const syncStatus = document.getElementById('sync-status');
    const online = navigator.onLine;

    if (banner) {
      banner.classList.toggle('hidden', online);
    }

    if (syncStatus) {
      if (!online) {
        syncStatus.textContent = 'Sin conexión';
        syncStatus.className = 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800';
      } else {
        window.OfflineQueue?.pendingCount().then((count) => {
          if (count > 0) {
            syncStatus.textContent = `${count} pendiente(s)`;
            syncStatus.className = 'rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800';
          } else {
            syncStatus.textContent = 'En línea';
            syncStatus.className = 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800';
          }
        });
      }
    }
  }

  async function trySync() {
    if (!window.OfflineQueue || !navigator.onLine) return;
    try {
      const result = await window.OfflineQueue.sync();
      if (result.synced > 0) {
        document.dispatchEvent(new CustomEvent('votes:synced', { detail: result }));
      }
      updateOnlineUi();
    } catch (err) {
      console.warn('Sync pendiente:', err);
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
        .catch((err) => {
          console.warn('SW no registrado:', err);
        });
    });
  }

  window.addEventListener('online', () => {
    updateOnlineUi();
    trySync();
  });
  window.addEventListener('offline', updateOnlineUi);
  document.addEventListener('DOMContentLoaded', () => {
    updateOnlineUi();
    trySync();
  });

  window.VotacionesApp = { updateOnlineUi, trySync };
})();
