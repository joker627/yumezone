/** Notificaciones toast (éxito, error, info, advertencia) reutilizables en toda la app. */

let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', 'Notificaciones del sistema');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const TOAST_ICONS = {
  success: `<img src="/assets/icons/svg/check.svg" width="20" height="20" alt="" aria-hidden="true">`,
  error: `<img src="/assets/icons/svg/x.svg" width="20" height="20" alt="" aria-hidden="true">`,
  warning: `<img src="/assets/icons/svg/warning.svg" width="20" height="20" alt="" aria-hidden="true">`,
  info: `<img src="/assets/icons/svg/info.svg" width="20" height="20" alt="" aria-hidden="true">`,
};

/** Muestra una notificación: showToast(message, type = 'info', duration = 3800). */
export function showToast(message, type = 'info', duration = 3800) {
  if (!message) return;
  const container = ensureToastContainer();
  const validTypes = ['success', 'error', 'warning', 'info'];
  const normType = validTypes.includes(type) ? type : 'info';

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${normType}`;
  toast.setAttribute('role', normType === 'error' ? 'alert' : 'status');

  const iconHtml = TOAST_ICONS[normType] || TOAST_ICONS.info;

  toast.innerHTML = `
    <div class="toast-icon-wrap" aria-hidden="true">${iconHtml}</div>
    <div class="toast-content">
      <p class="toast-message">${String(message)}</p>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">&times;</button>
    <div class="toast-progress-bar"></div>
  `;

  toast.querySelector('.toast-progress-bar').style.animationDuration = `${duration}ms`;

  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.add('toast-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 250); // Fallback si animationend no dispara
  };

  toast.querySelector('.toast-close-btn')?.addEventListener('click', dismiss);

  container.appendChild(toast);

  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
  }

  // Pausar auto-descarte si el usuario pasa el cursor sobre el toast
  toast.addEventListener('mouseenter', () => {
    if (timer) clearTimeout(timer);
    toast.querySelector('.toast-progress-bar')?.classList.add('is-paused');
  });

  toast.addEventListener('mouseleave', () => {
    toast.querySelector('.toast-progress-bar')?.classList.remove('is-paused');
    if (duration > 0) {
      timer = setTimeout(dismiss, 1800);
    }
  });

  return { dismiss };
}

// Escuchar eventos globales por si se dispara desde scripts sin acceso directo al módulo
if (typeof window !== 'undefined') {
  window.addEventListener('app:toast', (e) => {
    const { message, type, duration } = e.detail || {};
    if (message) showToast(message, type, duration);
  });
  window.showToast = showToast;
}
