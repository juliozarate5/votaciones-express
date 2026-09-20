(() => {
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const feedback = document.getElementById('vote-feedback');
  const pendingLabel = document.getElementById('pending-label');
  const statusBadge = document.getElementById('status-badge');
  const buttons = document.querySelectorAll('[data-gender]');
  const btnSync = document.getElementById('btn-sync');

  let localFemale = 0;
  let localMale = 0;

  function render() {
    countFemale.textContent = String(localFemale);
    countMale.textContent = String(localMale);
    countTotal.textContent = String(localFemale + localMale);
  }

  async function refreshPending() {
    const pending = await window.OfflineQueue.pendingCount();
    const local = await window.OfflineQueue.getLocalRealtimeTotals();
    localFemale = local.female;
    localMale = local.male;
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
    const clientId = window.OfflineQueue.uuid();
    const createdAt = new Date().toISOString();
    await window.OfflineQueue.enqueue({
      type: 'realtime',
      clientId,
      payload: { gender },
      createdAt,
    });
    if (gender === 'female') localFemale += 1;
    else localMale += 1;
    render();
    feedback.textContent = `${gender === 'female' ? 'Mujer' : 'Hombre'} guardado localmente · ${new Date(createdAt).toLocaleTimeString('es-CO')}`;
    feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-amber-700';
    await refreshPending();
  }

  async function syncNow() {
    feedback.textContent = 'Sincronizando…';
    try {
      const result = await window.OfflineQueue.sync({ force: true });
      feedback.textContent = result.synced
        ? `Sincronizados ${result.synced} voto(s).`
        : 'Nada pendiente o el servidor aún no responde.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
      await refreshPending();
      if (result.synced > 0 && navigator.onLine) {
        setTimeout(() => {
          window.location.href = '/report/realtime';
        }, 800);
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
  refreshPending();
})();
