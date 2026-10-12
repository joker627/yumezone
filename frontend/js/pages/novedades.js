import { apiRequest } from '../shared/auth.js';
import { renderLaunchItem } from '../components/cards.js';
import { renderLoader } from '../components/loader.js';
import { renderSiteHeader } from '../components/header.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

async function loadNovedades() {
  const container = document.getElementById('novedades-results');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderLoader({ text: 'Cargando novedades y estrenos…' });
  try {
    const data = await apiRequest('/home/launches/');
    const items = data.results ?? data ?? [];
    if (!items.length) {
      container.innerHTML = '<p class="novedades-page-message">No hay lanzamientos recientes.</p>';
      return;
    }
    container.innerHTML = items.map(item => renderLaunchItem(item, { isCompact: true })).join('');
  } catch {
    container.innerHTML = '<p class="novedades-page-message">Error al cargar las novedades.</p>';
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

loadNovedades();
