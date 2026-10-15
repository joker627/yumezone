import { apiRequest } from '../shared/auth.js';
import { renderRankCard } from '../components/cards.js';
import { renderRankingSkeletons } from '../components/loader.js';
import { renderSiteHeader } from '../components/header.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

async function loadRanking(period = 'all') {
  const container = document.getElementById('ranking-results');
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderRankingSkeletons(8);
  try {
    const data = await apiRequest(`/home/ranking/?period=${encodeURIComponent(period)}`);
    const items = data.results ?? data ?? [];
    if (!items.length) {
      container.innerHTML = '<p class="ranking-page-message">No hay datos de ranking disponibles.</p>';
      return;
    }
    container.innerHTML = items.map((item, idx) => renderRankCard(item, idx, { isList: true })).join('');
  } catch {
    container.innerHTML = '<p class="ranking-page-message">Error al cargar el ranking.</p>';
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

document.querySelectorAll('.ranking-tabs button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.ranking-tabs button').forEach(b => b.classList.remove('is-active'));
    e.target.classList.add('is-active');
    loadRanking(e.target.dataset.period);
  });
});

loadRanking('all');
