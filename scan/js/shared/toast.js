// Sistema de Notificaciones Toast para Scan Studio (Cero Dependencias Externas, Cero SVG Inline)
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = { success: 2500, info: 2500, warning: 3500, error: 4000 };

let toastContainer = null;

function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.setAttribute('role', 'region');
        toastContainer.setAttribute('aria-label', 'Notificaciones de Scan Studio');
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function removeToast(toast) {
    if (!toast || toast.classList.contains('toast-leave')) return;
    toast.classList.add('toast-leave');
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 200);
}

const ICONS_MAP = {
    success: '../assets/icons/svg/check.svg',
    error: '../assets/icons/svg/x.svg',
    warning: '../assets/icons/svg/warning.svg',
    info: '../assets/icons/svg/info.svg'
};

export function showToast(message, type = 'info', duration) {
    if (!message) return;
    const container = ensureToastContainer();
    const text = String(message);
    const ms = duration ?? DEFAULT_DURATION[type] ?? 2500;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const iconSrc = ICONS_MAP[type] || ICONS_MAP.info;

    toast.innerHTML = `
        <img src="${iconSrc}" class="icon-svg icon-md" alt="">
        <span class="toast-text">${escapeHtml(text)}</span>
        <button class="toast-close" type="button" aria-label="Cerrar notificación">
            <img src="../assets/icons/svg/x.svg" class="icon-svg icon-xs" alt="">
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => removeToast(toast));
    }

    container.appendChild(toast);

    const active = [...container.children];
    if (active.length > MAX_VISIBLE) {
        removeToast(active[0]);
    }

    setTimeout(() => removeToast(toast), ms);
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}
