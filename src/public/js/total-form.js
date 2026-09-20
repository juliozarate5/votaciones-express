(() => {
  const form = document.getElementById('total-form');
  if (!form) return;

  const totalInput = form.total;
  const womenInput = form.women;
  const menInput = form.men;
  const errorEl = document.getElementById('total-error');
  const feedback = document.getElementById('total-feedback');
  const hintEl = document.getElementById('total-hint');

  let lastEdited = null;

  function toInt(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  function updateHint(total, women, men) {
    if (!hintEl) return;

    if (total === null) {
      hintEl.textContent = 'Tip: escribe el total y un género; el otro se completa solo.';
      hintEl.className = 'rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700';
      return;
    }

    if (women !== null && men !== null) {
      if (women + men === total) {
        hintEl.textContent = `Cuadra: ${women} mujeres + ${men} hombres = ${total}.`;
        hintEl.className = 'rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800';
      } else {
        hintEl.textContent = `No cuadra: ${women} + ${men} = ${women + men}, pero el total es ${total}.`;
        hintEl.className = 'rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700';
      }
      return;
    }

    if (women !== null) {
      const suggestedMen = total - women;
      if (suggestedMen < 0) {
        hintEl.textContent = `Las mujeres (${women}) no pueden superar el total (${total}).`;
        hintEl.className = 'rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700';
      } else {
        hintEl.textContent = `Sugerido: ${suggestedMen} hombres (total ${total} − ${women} mujeres).`;
        hintEl.className = 'rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800';
      }
      return;
    }

    if (men !== null) {
      const suggestedWomen = total - men;
      if (suggestedWomen < 0) {
        hintEl.textContent = `Los hombres (${men}) no pueden superar el total (${total}).`;
        hintEl.className = 'rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700';
      } else {
        hintEl.textContent = `Sugerido: ${suggestedWomen} mujeres (total ${total} − ${men} hombres).`;
        hintEl.className = 'rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800';
      }
      return;
    }

    hintEl.textContent = `Total ${total}. Ingresa mujeres o hombres y el otro se calculará.`;
    hintEl.className = 'rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700';
  }

  function suggestComplement() {
    const total = toInt(totalInput.value);
    let women = toInt(womenInput.value);
    let men = toInt(menInput.value);

    if (total === null) {
      updateHint(total, women, men);
      return;
    }

    if (lastEdited === 'women' && women !== null) {
      const suggested = total - women;
      if (suggested >= 0) {
        menInput.value = String(suggested);
        men = suggested;
      }
    } else if (lastEdited === 'men' && men !== null) {
      const suggested = total - men;
      if (suggested >= 0) {
        womenInput.value = String(suggested);
        women = suggested;
      }
    } else if (lastEdited === 'total') {
      if (women !== null && men === null) {
        const suggested = total - women;
        if (suggested >= 0) {
          menInput.value = String(suggested);
          men = suggested;
        }
      } else if (men !== null && women === null) {
        const suggested = total - men;
        if (suggested >= 0) {
          womenInput.value = String(suggested);
          women = suggested;
        }
      } else if (women !== null && men !== null) {
        // Prefer keeping the last gender fields if both filled; recompute men from women when total changes
        const suggested = total - women;
        if (suggested >= 0) {
          menInput.value = String(suggested);
          men = suggested;
        }
      }
    }

    updateHint(total, toInt(womenInput.value), toInt(menInput.value));
  }

  totalInput.addEventListener('input', () => {
    lastEdited = 'total';
    suggestComplement();
  });
  womenInput.addEventListener('input', () => {
    lastEdited = 'women';
    suggestComplement();
  });
  menInput.addEventListener('input', () => {
    lastEdited = 'men';
    suggestComplement();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const total = Number(form.total.value);
    const women = Number(form.women.value);
    const men = Number(form.men.value);

    if (women + men !== total) {
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const clientId = window.OfflineQueue?.uuid?.() || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload = {
      type: 'total',
      clientId,
      payload: { women, men, total },
      createdAt,
    };

    const when = new Date(createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });

    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await fetch('/api/votes/total', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ women, men, total, clientId, createdAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar');
      }
      const data = await res.json().catch(() => ({}));
      const reported = data.reportedAt
        ? new Date(data.reportedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' })
        : when;
      feedback.textContent = `Total guardado · ${reported}`;
      feedback.className = 'min-h-[1.25rem] text-sm text-emerald-700';
      form.reset();
      setTimeout(() => {
        window.location.href = '/dashboard/mine';
      }, 900);
    } catch (err) {
      if (window.OfflineQueue) {
        await window.OfflineQueue.enqueue(payload);
        feedback.textContent = `Sin conexión: guardado local · ${when}. Se sincronizará luego.`;
        feedback.className = 'min-h-[1.25rem] text-sm text-amber-700';
        form.reset();
      } else {
        feedback.textContent = err.message || 'No se pudo guardar';
        feedback.className = 'min-h-[1.25rem] text-sm text-rose-700';
      }
    }
  });
})();
