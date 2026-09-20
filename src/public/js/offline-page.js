(() => {
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const feedback = document.getElementById('vote-feedback');
  const pendingLabel = document.getElementById('pending-label');
  const statusBadge = document.getElementById('status-badge');
  const buttons = document.querySelectorAll('[data-gender]');
  const btnSync = document.getElementById('btn-sync');

  let serverFemale = window.OfflineQueue?.readBaseline?.()?.female || 0;
  let serverMale = window.OfflineQueue?.readBaseline?.()?.male || 0;
  let pendingFemale = 0;
  let pendingMale = 0;

  function render() {
    const female = serverFemale + pendingFemale;
    const male = serverMale + pendingMale;
    countFemale.textContent = String(female);
    countMale.textContent = String(male);
    countTotal.textContent = String(female + male);
  }

  function applyServerCounts(counts) {
    if (!counts || typeof counts.female !== 'number' || typeof counts.male !== 'number') return;
    serverFemale = counts.female;
    serverMale = counts.male;
    window.OfflineQueue?.writeBaseline?.(counts);
    render();
  }

  async function refreshPending() {
    const pending = await window.OfflineQueue.pendingCount();
    const local = await window.OfflineQueue.getLocalRealtimeTotals();
    pendingFemale = local.female;
    pendingMale = local.male;
    render();
    pendingLabel.textContent = pending
      ? `${pending} voto(s) pendiente(s) de sincronizar`
      : 'No hay pendientes locales';
  }

  function setOnlineUi(online) {
    statusBadge.textContent = online ? 'Conexión detectada' : 'Modo offline';
    statusBadge.style.background = online ? '#ecfdf5' : '#fff7ed';
    statusBadge.style.color = online ? '#065f46' : '#9a3412';
    statusBadge.style.borderColor = online ? '#6ee7b7' : '#fdba74';
  }

  async function addVote(gender) {
    const result = await window.OfflineQueue.sendOrQueueRealtime({ gender });
    if (!result.queued && result.counts) {
      applyServerCounts(result.counts);
    }
    await refreshPending();
    const label = gender === 'female' ? 'Mujer' : 'Hombre';
    if (result.queued) {
      feedback.textContent = `${label} guardado localmente · ${new Date(result.createdAt).toLocaleTimeString('es-CO')}`;
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-amber-700';
    } else {
      feedback.textContent = `${label} registrado en servidor`;
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
    }
  }

  async function syncNow() {
    feedback.textContent = 'Sincronizando…';
    try {
      const result = await window.OfflineQueue.sync({ force: true });
      if (result.counts) applyServerCounts(result.counts);
      await refreshPending();
      feedback.textContent = result.synced
        ? `Sincronizados ${result.synced} voto(s).`
        : result.pending
          ? 'Aún hay pendientes; el servidor no aceptó todo.'
          : 'Todo al día.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
      if (result.synced > 0) {
        document.dispatchEvent(new CustomEvent('votes:synced', { detail: result }));
      }
    } catch (err) {
      feedback.textContent = 'No se pudo sincronizar. Sigue reportando offline.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-rose-700';
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await addVote(btn.dataset.gender);
      } finally {
        btn.disabled = false;
      }
    });
  });

  btnSync.addEventListener('click', syncNow);
  window.addEventListener('online', () => {
    setOnlineUi(true);
    syncNow();
  });
  window.addEventListener('offline', () => setOnlineUi(false));

  setOnlineUi(navigator.onLine);
  render();
  refreshPending().then(() => {
    if (navigator.onLine) syncNow();
  });
})();
