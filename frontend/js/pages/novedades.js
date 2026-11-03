import { apiRequest } from '../shared/auth.js';
import { renderLaunchItem } from '../components/cards.js';
import { renderNovedadesSkeletons } from '../components/skeletons.js';

async function loadNovedades() {
  const container = document.getElementById('novedades-results');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderNovedadesSkeletons(8);
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
