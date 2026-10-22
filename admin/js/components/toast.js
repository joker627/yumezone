const ICONS = {
  success: { file: 'check.svg', tone: 'icon-teal' },
  error: { file: 'warning.svg', tone: 'icon-ruby' },
  info: { file: 'info.svg', tone: '' }
};

let container = null;

function getContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.append(container);
  }
  return container;
}

function buildIcon(file, extraClass) {
  const img = document.createElement('img');
  img.src = `/assets/icons/svg/${file}`;
  img.className = `icon icon-xs ${extraClass}`.trim();
  img.alt = '';
  return img;
}

function removeToast(toast) {
  clearTimeout(toast._timer);
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 200);
}

export function showToast(message, type = 'success', duration = 3500) {
  const icon = ICONS[type] || ICONS.info;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'toast-icon';
  iconWrap.append(buildIcon(icon.file, icon.tone));

  const text = document.createElement('div');
  text.className = 'toast-message';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.append(buildIcon('x.svg', ''));
  closeBtn.addEventListener('click', () => removeToast(toast));

  toast.append(iconWrap, text, closeBtn);
  getContainer().append(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  toast._timer = setTimeout(() => removeToast(toast), duration);
}
