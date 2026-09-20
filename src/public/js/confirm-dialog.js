(() => {
  const modal = document.getElementById('app-confirm-modal');
  if (!modal) {
    window.VotacionesConfirm = {
      ask() {
        return Promise.resolve(false);
      },
    };
    return;
  }

  const titleEl = document.getElementById('app-confirm-title');
  const messageEl = document.getElementById('app-confirm-message');
  const headerEl = document.getElementById('app-confirm-header');
  const okBtn = document.getElementById('app-confirm-ok');
  const cancelBtn = document.getElementById('app-confirm-cancel');

  let resolver = null;

  function close(result) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (resolver) {
      const resolve = resolver;
      resolver = null;
      resolve(result);
    }
  }

  function open() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    okBtn.focus();
  }

  function ask(options = {}) {
    if (resolver) close(false);

    const {
      title = 'Confirmar',
      message = '¿Deseas continuar?',
      confirmLabel = 'Confirmar',
      cancelLabel = 'Cancelar',
      danger = false,
    } = options;

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;

    if (danger) {
      headerEl.className = 'border-b border-rose-100 bg-rose-50 px-5 py-4';
      titleEl.className = 'text-lg font-bold text-rose-900';
      messageEl.className = 'mt-1 text-sm leading-relaxed text-rose-800';
      okBtn.className =
        'w-full rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white hover:bg-rose-800 sm:w-auto sm:min-w-[9rem]';
    } else {
      headerEl.className = 'border-b border-slate-100 bg-slate-50 px-5 py-4';
      titleEl.className = 'text-lg font-bold text-brand-900';
      messageEl.className = 'mt-1 text-sm leading-relaxed text-slate-600';
      okBtn.className =
        'w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-900 sm:w-auto sm:min-w-[9rem]';
    }

    open();

    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  okBtn.addEventListener('click', () => close(true));
  cancelBtn.addEventListener('click', () => close(false));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      close(false);
    }
  });

  window.VotacionesConfirm = { ask };
})();
