(() => {
  const modal = document.getElementById('reporter-detail-modal');
  const titleEl = document.getElementById('reporter-detail-title');
  const bodyEl = document.getElementById('reporter-detail-body');
  const closeBtn = document.getElementById('reporter-detail-close');
  if (!modal || !titleEl || !bodyEl) return;

  function formatLocal(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return '—';
    }
  }

  function openModal() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderDetail(detail) {
    titleEl.textContent = detail.reporterName || 'Detalle';
    const current = detail.current || {};
    const history = detail.totalsHistory || [];

    let historyHtml = '';
    if (!history.length) {
      historyHtml = '<p class="text-sm text-slate-500">Sin envíos de totales registrados.</p>';
    } else {
      historyHtml = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-slate-200 text-slate-500">
              <tr>
                <th class="py-2 pr-2 font-medium">Fecha</th>
                <th class="py-2 pr-2 font-medium">Mujeres</th>
                <th class="py-2 pr-2 font-medium">Hombres</th>
                <th class="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              ${history
                .map((row, idx) => {
                  const isLast = idx === history.length - 1;
                  return `
                  <tr class="border-b border-slate-100 ${isLast ? 'bg-emerald-50/80' : ''}">
                    <td class="py-2 pr-2 whitespace-nowrap">
                      ${formatLocal(row.at)}
                      ${isLast ? '<span class="ml-1 text-xs font-bold text-emerald-700">(válido)</span>' : ''}
                    </td>
                    <td class="py-2 pr-2">${row.women}</td>
                    <td class="py-2 pr-2">${row.men}</td>
                    <td class="py-2 font-semibold">${row.total}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    bodyEl.innerHTML = `
      <div class="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-brand-700">Total actual (válido)</p>
        <div class="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="text-xs text-slate-500">Mujeres</p>
            <p class="text-lg font-bold text-brand-900">${current.women || 0}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Hombres</p>
            <p class="text-lg font-bold text-brand-900">${current.men || 0}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Total</p>
            <p class="text-lg font-bold text-accent-500">${current.total || 0}</p>
          </div>
        </div>
        <p class="mt-2 text-center text-xs text-slate-500">Actualizado: ${formatLocal(current.at)}</p>
      </div>
      <div class="mt-4">
        <p class="mb-2 text-sm font-semibold text-brand-900">Historial de totales enviados</p>
        ${historyHtml}
      </div>
    `;
  }

  async function loadDetail(key) {
    titleEl.textContent = 'Cargando…';
    bodyEl.innerHTML = '<p class="text-sm text-slate-500">Obteniendo historial…</p>';
    openModal();
    try {
      const res = await fetch(`/api/admin/reporters/${encodeURIComponent(key)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo cargar');
      }
      renderDetail(data.detail);
    } catch (err) {
      bodyEl.innerHTML = `<p class="text-sm text-rose-700">${err.message || 'Error al cargar el detalle'}</p>`;
    }
  }

  document.querySelectorAll('[data-reporter-key]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const key = el.getAttribute('data-reporter-key');
      if (key) loadDetail(key);
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
})();
