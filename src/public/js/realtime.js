(() => {
  const feedback = document.getElementById('vote-feedback');
  const countFemale = document.getElementById('count-female');
  const countMale = document.getElementById('count-male');
  const countTotal = document.getElementById('count-total');
  const buttons = document.querySelectorAll('[data-gender]');

  let localFemale = Number(countFemale?.textContent || 0);
  let localMale = Number(countMale?.textContent || 0);

  function renderCounts(counts) {
    if (counts) {
      localFemale = counts.female;
      localMale = counts.male;
    }
    if (countFemale) countFemale.textContent = String(localFemale);
    if (countMale) countMale.textContent = String(localMale);
    if (countTotal) countTotal.textContent = String(localFemale + localMale);
  }

  function bumpLocal(gender) {
    if (gender === 'female') localFemale += 1;
    if (gender === 'male') localMale += 1;
    renderCounts();
  }

  function formatLocal(iso) {
    try {
      return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return '';
    }
  }

  async function sendVote(gender) {
    const clientId = window.OfflineQueue.uuid();
    const createdAt = new Date().toISOString();
    const item = {
      type: 'realtime',
      clientId,
      payload: { gender },
      createdAt,
    };

    bumpLocal(gender);
    const label = gender === 'female' ? 'Voto mujer' : 'Voto hombre';
    feedback.textContent = `${label} · ${formatLocal(createdAt)}`;
    feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';

    try {
      if (!navigator.onLine) throw new Error('offline');

      const res = await fetch('/api/votes/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ gender, clientId, createdAt }),
      });

      if (!res.ok) {
        // 503 = Mongo/Render despertando → encolar como offline
        throw new Error(res.status === 503 ? 'offline' : 'server');
      }
      const data = await res.json();
      if (data.counts) renderCounts(data.counts);
      const when = formatLocal(data.reportedAt || createdAt);
      feedback.textContent = `${label} registrado · ${when}`;
      window.VotacionesApp?.updateOnlineUi();
    } catch (err) {
      await window.OfflineQueue.enqueue(item);
      feedback.textContent = `Guardado localmente · ${formatLocal(createdAt)}. Se sincronizará cuando el servidor/Mongo respondan.`;
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-amber-700';
      window.VotacionesApp?.updateOnlineUi();
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      buttons.forEach((b) => { b.disabled = true; });
      try {
        await sendVote(btn.dataset.gender);
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    });
  });

  document.addEventListener('votes:synced', (event) => {
    if (event.detail?.counts) {
      renderCounts(event.detail.counts);
      feedback.textContent = 'Votos pendientes sincronizados.';
      feedback.className = 'mt-4 min-h-[1.25rem] text-center text-sm text-emerald-700';
    }
  });
})();
