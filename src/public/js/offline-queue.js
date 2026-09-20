(() => {
  const DB_NAME = 'votaciones-offline';
  const STORE = 'queue';
  const DB_VERSION = 1;
  const FETCH_TIMEOUT_MS = 12000;
  const BASELINE_KEY = 'votaciones:serverCounts';

  let syncInFlight = null;

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

  function readBaseline() {
    try {
      const raw = sessionStorage.getItem(BASELINE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.female !== 'number' || typeof parsed?.male !== 'number') return null;
      return { female: parsed.female, male: parsed.male, total: parsed.female + parsed.male };
    } catch {
      return null;
    }
  }

  function writeBaseline(counts) {
    if (!counts || typeof counts.female !== 'number' || typeof counts.male !== 'number') return;
    try {
      sessionStorage.setItem(
        BASELINE_KEY,
        JSON.stringify({ female: counts.female, male: counts.male })
      );
    } catch {
      /* ignore */
    }
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
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  }

  async function fetchServerCounts() {
    const res = await fetchWithTimeout('/api/votes/counts', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error('No se pudieron leer conteos');
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (data.counts) writeBaseline(data.counts);
    return data.counts || null;
  }

  async function syncOnce(options = {}) {
    if (!options.force && !navigator.onLine) {
      return { synced: 0, pending: await pendingCount(), counts: readBaseline() };
    }

    const items = await getAll();
    if (!items.length) {
      let counts = null;
      try {
        counts = await fetchServerCounts();
      } catch {
        counts = readBaseline();
      }
      return { synced: 0, pending: 0, counts };
    }

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
    const counts = data.counts || null;
    if (counts) writeBaseline(counts);
    return { synced: okIds.length, pending, counts, results: data.results };
  }

  /** Una sola sync a la vez (online + interval + página no duplican envíos). */
  function sync(options = {}) {
    if (syncInFlight) return syncInFlight;
    syncInFlight = syncOnce(options).finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  /**
   * Outbox: siempre se encola primero con un clientId estable.
   * Si el POST ok, se saca de la cola. Si falla/timeout, queda para sync.
   * Así un timeout tras éxito en servidor NO crea otro voto (mismo clientId).
   */
  async function sendOrQueueRealtime({ gender, clientId, createdAt }) {
    if (!['female', 'male'].includes(gender)) {
      throw new Error('Género inválido');
    }

    const item = {
      type: 'realtime',
      clientId: clientId || uuid(),
      payload: { gender },
      createdAt: createdAt || new Date().toISOString(),
    };

    await enqueue(item);

    if (!navigator.onLine) {
      return { queued: true, offline: true, clientId: item.clientId, createdAt: item.createdAt };
    }

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
        return { queued: true, offline: res.status >= 500, clientId: item.clientId, createdAt: item.createdAt };
      }

      const data = await res.json();
      await removeByClientId(item.clientId);
      if (data.counts) writeBaseline(data.counts);
      return {
        queued: false,
        offline: false,
        clientId: item.clientId,
        createdAt: item.createdAt,
        counts: data.counts,
        reportedAt: data.reportedAt,
      };
    } catch (err) {
      // Se mantiene en cola; sync lo enviará con el mismo clientId (idempotente)
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
    fetchServerCounts,
    readBaseline,
    writeBaseline,
  };
})();
