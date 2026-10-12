/**
 * Sistema Universal de Notificaciones Toast para YumeZone.
 * Permite mostrar notificaciones flotantes premium (éxito, error, info, advertencia)
 * desde cualquier parte de la aplicación.
 */

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
  success: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>`,
};

/**
 * Muestra una notificación flotante.
 * @param {string} message - Texto del mensaje a mostrar.
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Tipo visual de notificación.
 * @param {number} [duration=3800] - Tiempo en ms antes de auto-descartar.
 */
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
    <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
  `;

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
    const bar = toast.querySelector('.toast-progress-bar');
    if (bar) bar.style.animationPlayState = 'paused';
  });

  toast.addEventListener('mouseleave', () => {
    const bar = toast.querySelector('.toast-progress-bar');
    if (bar) bar.style.animationPlayState = 'running';
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
