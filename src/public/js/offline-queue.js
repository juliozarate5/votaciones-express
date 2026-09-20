(() => {
  const DB_NAME = 'votaciones-offline';
  const STORE = 'queue';
  const DB_VERSION = 1;
  const FETCH_TIMEOUT_MS = 8000;

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

  async function removeByClientId(clientId) {
    if (!clientId) return false;
    const before = await getAll();
    const exists = before.some((item) => item.clientId === clientId);
    if (!exists) return false;
    await removeMany([clientId]);
    return true;
  }

  async function updateQueuedRealtimeGender(clientId, gender) {
    if (!clientId || !['female', 'male'].includes(gender)) return null;
    const items = await getAll();
    const item = items.find((row) => row.clientId === clientId && row.type === 'realtime');
    if (!item) return null;
    item.payload = { ...(item.payload || {}), gender };
    await enqueue(item);
    return item;
  }

  async function getLastQueuedRealtime() {
    const items = await getAll();
    const realtime = items.filter((item) => item.type === 'realtime');
    if (!realtime.length) return null;
    realtime.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return realtime[0];
  }

  async function pendingCount() {
    const items = await getAll();
    return items.length;
  }

  async function getLocalRealtimeTotals() {
    const items = await getAll();
    let female = 0;
    let male = 0;
    items.forEach((item) => {
      if (item.type !== 'realtime') return;
      const gender = item.payload?.gender || item.gender;
      if (gender === 'female') female += 1;
      if (gender === 'male') male += 1;
    });
    return { female, male, total: female + male };
  }

  function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      ...options,
      credentials: 'same-origin',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  }

  async function sync(options = {}) {
    if (!options.force && !navigator.onLine) {
      return { synced: 0, pending: await pendingCount() };
    }

    const items = await getAll();
    if (!items.length) return { synced: 0, pending: 0 };

    const res = await fetchWithTimeout('/api/votes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const err = new Error('Sync failed');
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const okIds = (data.results || []).filter((r) => r.ok).map((r) => r.clientId);
    await removeMany(okIds);
    const pending = await pendingCount();
    return { synced: okIds.length, pending, counts: data.counts };
  }

  /** Intenta enviar un voto; si falla/timeout/503, lo encola. */
  async function sendOrQueueRealtime({ gender, clientId, createdAt }) {
    const item = {
      type: 'realtime',
      clientId: clientId || uuid(),
      payload: { gender },
      createdAt: createdAt || new Date().toISOString(),
    };

    try {
      const res = await fetchWithTimeout('/api/votes/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          gender: item.payload.gender,
          clientId: item.clientId,
          createdAt: item.createdAt,
        }),
      });

      if (!res.ok) {
        await enqueue(item);
        return { queued: true, offline: res.status >= 500, clientId: item.clientId, createdAt: item.createdAt };
      }

      const data = await res.json();
      return {
        queued: false,
        offline: false,
        clientId: item.clientId,
        createdAt: item.createdAt,
        counts: data.counts,
        reportedAt: data.reportedAt,
      };
    } catch (err) {
      await enqueue(item);
      return { queued: true, offline: true, clientId: item.clientId, createdAt: item.createdAt, error: err.message };
    }
  }

  window.OfflineQueue = {
    uuid,
    enqueue,
    getAll,
    pendingCount,
    getLocalRealtimeTotals,
    getLastQueuedRealtime,
    removeByClientId,
    updateQueuedRealtimeGender,
    sync,
    sendOrQueueRealtime,
    fetchWithTimeout,
  };
})();
