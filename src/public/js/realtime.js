(() => {
  const feedback = document.getElementById('vote-feedback');
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const buttons = document.querySelectorAll('[data-gender]');
  const syncStatus = document.getElementById('sync-status');

  let serverFemale = Number(countFemale?.textContent || 0);
  let serverMale = Number(countMale?.textContent || 0);
  let pendingFemale = 0;
  let pendingMale = 0;

  function formatLocal(iso) {
    try {
      return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return '';
    }
  }

  function renderCounts() {
    const female = serverFemale + pendingFemale;
    const male = serverMale + pendingMale;
    if (countFemale) countFemale.textContent = String(female);
    if (countMale) countMale.textContent = String(male);
    if (countTotal) countTotal.textContent = String(female + male);
  }

  async function refreshPendingFromQueue() {
    if (!window.OfflineQueue) return;
    const local = await window.OfflineQueue.getLocalRealtimeTotals();
    pendingFemale = local.female;
    pendingMale = local.male;
    renderCounts();
    window.VotacionesApp?.updateOnlineUi();
  }

  async function sendVote(gender) {
    const label = gender === 'female' ? 'Voto mujer' : 'Voto hombre';
    buttons.forEach((b) => {
      b.disabled = true;
    });

    try {
      const result = await window.OfflineQueue.sendOrQueueRealtime({ gender });

      if (!result.queued && result.counts) {
        serverFemale = result.counts.female;
        serverMale = result.counts.male;
      }

      await refreshPendingFromQueue();

      if (result.queued) {
        feedback.textContent = `${label} guardado localmente · ${formatLocal(result.createdAt)}. Se sincronizará al volver la conexión.`;
        feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-amber-700';
        if (syncStatus) {
          syncStatus.textContent = 'Pendiente sync';
          syncStatus.className = 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800';
        }
      } else {
        feedback.textContent = `${label} registrado · ${formatLocal(result.reportedAt || result.createdAt)}`;
        feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
      }
    } catch (err) {
      feedback.textContent = 'No se pudo guardar el voto. Intenta de nuevo.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-rose-700';
    } finally {
      buttons.forEach((b) => {
        b.disabled = false;
      });
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => sendVote(btn.dataset.gender));
  });

  document.addEventListener('votes:synced', async (event) => {
    if (event.detail?.counts) {
      serverFemale = event.detail.counts.female;
      serverMale = event.detail.counts.male;
    }
    await refreshPendingFromQueue();
    feedback.textContent = 'Votos pendientes sincronizados.';
    feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
  });

  refreshPendingFromQueue();
})();
