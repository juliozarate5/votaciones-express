(() => {
  const DB_NAME = 'votaciones-offline';
  const STORE = 'queue';
  const DB_VERSION = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'clientId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function enqueue(item) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function removeMany(clientIds) {
    if (!clientIds.length) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      clientIds.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function pendingCount() {
    const items = await getAll();
    return items.length;
  }

  async function sync() {
    if (!navigator.onLine) return { synced: 0, pending: await pendingCount() };

    const items = await getAll();
    if (!items.length) return { synced: 0, pending: 0 };

    const res = await fetch('/api/votes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      throw new Error('Sync failed');
    }

    const data = await res.json();
    const okIds = (data.results || [])
      .filter((r) => r.ok)
      .map((r) => r.clientId);

    await removeMany(okIds);
    const pending = await pendingCount();
    return { synced: okIds.length, pending, counts: data.counts };
  }

  window.OfflineQueue = {
    uuid,
    enqueue,
    getAll,
    pendingCount,
    sync,
  };
})();
