(() => {
  const feedback = document.getElementById('vote-feedback');
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const buttons = document.querySelectorAll('[data-gender]');
  const syncStatus = document.getElementById('sync-status');
  const lastLabel = document.getElementById('last-vote-label');
  const lastActions = document.getElementById('last-vote-actions');
  const btnSwitch = document.getElementById('btn-switch-last');
  const btnAnnul = document.getElementById('btn-annul-last');

  let serverFemale = Number(countFemale?.textContent || 0);
  let serverMale = Number(countMale?.textContent || 0);
  let pendingFemale = 0;
  let pendingMale = 0;
  let lastVote = null;
  let busy = false;

  try {
    lastVote = JSON.parse(document.getElementById('initial-last-vote')?.textContent || 'null');
  } catch {
    lastVote = null;
  }

  function genderLabel(gender) {
    return gender === 'female' ? 'Mujer' : 'Hombre';
  }

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

  function renderLastVote() {
    if (!lastVote) {
      lastLabel.textContent = 'Aún no hay votos para corregir.';
      lastActions.classList.add('hidden');
      return;
    }
    const when = formatLocal(lastVote.createdAt);
    const localNote = lastVote.local ? ' (pendiente de sync)' : '';
    lastLabel.textContent = `Último: ${genderLabel(lastVote.gender)}${when ? ` · ${when}` : ''}${localNote}`;
    lastActions.classList.remove('hidden');
    btnSwitch.textContent = `Cambiar a ${lastVote.gender === 'female' ? 'Hombre' : 'Mujer'}`;
  }

  function setLastVote(vote) {
    lastVote = vote
      ? {
          clientId: vote.clientId,
          gender: vote.gender,
          createdAt: vote.createdAt,
          local: Boolean(vote.local),
        }
      : null;
    renderLastVote();
  }

  async function refreshPendingFromQueue() {
    if (!window.OfflineQueue) return;
    const local = await window.OfflineQueue.getLocalRealtimeTotals();
    pendingFemale = local.female;
    pendingMale = local.male;
    renderCounts();
    window.VotacionesApp?.updateOnlineUi();
  }

  async function preferQueuedLastOrServer() {
    const queued = await window.OfflineQueue?.getLastQueuedRealtime?.();
    if (queued) {
      setLastVote({
        clientId: queued.clientId,
        gender: queued.payload?.gender || queued.gender,
        createdAt: queued.createdAt,
        local: true,
      });
      return;
    }
    await syncLastFromServer();
  }

  async function syncLastFromServer() {
    if (!window.OfflineQueue?.fetchWithTimeout) return;
    try {
      const res = await window.OfflineQueue.fetchWithTimeout('/api/votes/realtime/last', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.counts) {
        serverFemale = data.counts.female;
        serverMale = data.counts.male;
        renderCounts();
      }
      const queued = await window.OfflineQueue.getLastQueuedRealtime?.();
      if (queued) {
        setLastVote({
          clientId: queued.clientId,
          gender: queued.payload?.gender || queued.gender,
          createdAt: queued.createdAt,
          local: true,
        });
      } else {
        setLastVote(data.lastVote || null);
      }
    } catch {
      /* ignore */
    }
  }

  async function sendVote(gender) {
    if (busy || !window.OfflineQueue) return;
    busy = true;
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
      setLastVote({
        clientId: result.clientId,
        gender,
        createdAt: result.reportedAt || result.createdAt,
        local: Boolean(result.queued),
      });

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
      busy = false;
      buttons.forEach((b) => {
        b.disabled = false;
      });
    }
  }

  async function correctLast(action) {
    if (!lastVote || busy || !window.OfflineQueue) return;

    const nextGender = lastVote.gender === 'female' ? 'male' : 'female';
    const confirmed = await (window.VotacionesConfirm?.ask({
      title: action === 'annul' ? '¿Anular último voto?' : '¿Cambiar último voto?',
      message:
        action === 'annul'
          ? `Se anulará el último voto (${genderLabel(lastVote.gender)}). Esta acción actualiza el conteo.`
          : `Se cambiará de ${genderLabel(lastVote.gender)} a ${genderLabel(nextGender)}.`,
      confirmLabel: action === 'annul' ? 'Sí, anular' : 'Sí, cambiar',
      cancelLabel: 'Volver',
      danger: action === 'annul',
    }) ?? Promise.resolve(false));
    if (!confirmed) return;

    busy = true;
    btnSwitch.disabled = true;
    btnAnnul.disabled = true;

    try {
      if (action === 'annul') {
        const removed = await window.OfflineQueue.removeByClientId(lastVote.clientId);
        if (removed) {
          await refreshPendingFromQueue();
          await preferQueuedLastOrServer();
          feedback.textContent = 'Último voto anulado.';
          feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
          return;
        }
      }

      if (action === 'switch') {
        const updated = await window.OfflineQueue.updateQueuedRealtimeGender(
          lastVote.clientId,
          nextGender
        );
        if (updated) {
          await refreshPendingFromQueue();
          setLastVote({
            clientId: updated.clientId,
            gender: nextGender,
            createdAt: updated.createdAt,
            local: true,
          });
          feedback.textContent = `Último voto cambiado a ${genderLabel(nextGender)}.`;
          feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
          return;
        }
      }

      const res = await window.OfflineQueue.fetchWithTimeout('/api/votes/realtime/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action,
          clientId: lastVote.clientId,
          gender: action === 'switch' ? nextGender : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo corregir');
      }

      const data = await res.json();
      if (data.counts) {
        serverFemale = data.counts.female;
        serverMale = data.counts.male;
      }
      await refreshPendingFromQueue();

      const queued = await window.OfflineQueue.getLastQueuedRealtime?.();
      if (queued) {
        setLastVote({
          clientId: queued.clientId,
          gender: queued.payload?.gender || queued.gender,
          createdAt: queued.createdAt,
          local: true,
        });
      } else {
        setLastVote(data.lastVote || null);
      }

      feedback.textContent =
        action === 'annul'
          ? 'Último voto anulado.'
          : `Último voto cambiado a ${genderLabel(data.detail?.vote?.gender || nextGender)}.`;
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
    } catch (err) {
      feedback.textContent = err.message || 'No se pudo corregir el voto.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-rose-700';
    } finally {
      busy = false;
      btnSwitch.disabled = false;
      btnAnnul.disabled = false;
      renderLastVote();
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => sendVote(btn.dataset.gender));
  });

  btnSwitch?.addEventListener('click', () => correctLast('switch'));
  btnAnnul?.addEventListener('click', () => correctLast('annul'));

  document.addEventListener('votes:synced', async (event) => {
    if (event.detail?.counts) {
      serverFemale = event.detail.counts.female;
      serverMale = event.detail.counts.male;
    }
    await refreshPendingFromQueue();
    await preferQueuedLastOrServer();
    feedback.textContent = 'Votos pendientes sincronizados.';
    feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
  });

  renderLastVote();
  refreshPendingFromQueue().then(() => preferQueuedLastOrServer());
})();
