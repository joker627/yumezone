// cargador de componentes
import { renderSiteHeader } from './header.js';
import { renderNotice } from './notice.js';
import { renderSiteFooter } from './footer.js';
import { initAutoSkeletons } from './skeletons.js';

export function initUniversalComponents() {
  initAutoSkeletons();

  const header = document.getElementById('header');
  if (header && !header.dataset.mounted) {
    renderSiteHeader(header);
  }

  const notice = document.getElementById('notice');
  if (notice && !notice.dataset.mounted) {
    notice.dataset.mounted = 'true';
    renderNotice(notice);
  }

  const footer =
    document.getElementById('site-footer') ||
    document.getElementById('footer') ||
    document.getElementById('footer-root') ||
    document.querySelector('footer.site-footer') ||
    document.querySelector('footer.footer');
  if (footer && !footer.dataset.mounted) {
    renderSiteFooter(footer);
  }
}

// inicializar componentes
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUniversalComponents, { once: true });
  } else {
    initUniversalComponents();
  }
}
