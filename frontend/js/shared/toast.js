// sistema toast

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = { success: 2200, info: 2200, warning: 3200, error: 3600 };

let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', 'Avisos');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('toast-leaving')) return;
  toast.classList.add('toast-leaving');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 250); // fallback si animationend no dispara
}

// mostrar toast (aviso breve; los eventos importantes van al panel de notificaciones)
export function showToast(message, type = 'info', duration) {
  if (!message) return;
  const container = ensureToastContainer();
  const validTypes = ['success', 'error', 'warning', 'info'];
  const normType = validTypes.includes(type) ? type : 'info';
  const text = String(message);
  const ms = duration ?? DEFAULT_DURATION[normType];

  // evita duplicados: si ya hay uno igual visible, no se repite
  const duplicated = [...container.children].some(
    (el) => !el.classList.contains('toast-leaving') && el.textContent === text
  );
  if (duplicated) return;

  // limita la cantidad visible
  const active = [...container.children].filter((el) => !el.classList.contains('toast-leaving'));
  active.slice(0, Math.max(0, active.length - MAX_VISIBLE + 1)).forEach(removeToast);

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${normType}`;
  toast.setAttribute('role', normType === 'error' ? 'alert' : 'status');
  toast.textContent = text;
  toast.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  let timer = ms > 0 ? setTimeout(() => removeToast(toast), ms) : null;
  toast.addEventListener('mouseenter', () => timer && clearTimeout(timer));
  toast.addEventListener('mouseleave', () => {
    if (ms > 0) timer = setTimeout(() => removeToast(toast), 1200);
  });

  return { dismiss: () => removeToast(toast) };
}

// aviso que sobrevive a una redireccion: se guarda y se muestra en la pagina siguiente
const FLASH_KEY = 'yume_flash_toast';

export function flashToast(message, type = 'success') {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
  } catch {
    /* sessionStorage no disponible */
  }
}

function showPendingFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    const { message, type } = JSON.parse(raw);
    if (message) showToast(message, type);
  } catch {
    /* dato invalido */
  }
}

// evento global toast
if (typeof window !== 'undefined') {
  window.addEventListener('app:toast', (e) => {
    const { message, type, duration } = e.detail || {};
    if (message) showToast(message, type, duration);
  });
  window.showToast = showToast;
  window.flashToast = flashToast;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showPendingFlash, { once: true });
  } else {
    showPendingFlash();
  }
}
