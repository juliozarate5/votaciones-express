(() => {
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const feedback = document.getElementById('vote-feedback');
  const pendingLabel = document.getElementById('pending-label');
  const statusBadge = document.getElementById('status-badge');
  const buttons = document.querySelectorAll('[data-gender]');
  const btnSync = document.getElementById('btn-sync');

  function render(female, male) {
    countFemale.textContent = String(female);
    countMale.textContent = String(male);
    countTotal.textContent = String(female + male);
  }

  async function refreshPending() {
    const pending = await window.OfflineQueue.pendingCount();
    const local = await window.OfflineQueue.getLocalRealtimeTotals();
    render(local.female, local.male);
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
      feedback.textContent = result.synced
        ? `Sincronizados ${result.synced} voto(s).`
        : 'Nada pendiente o el servidor aún no responde.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
      await refreshPending();
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
  if (navigator.onLine) syncNow();
})();
