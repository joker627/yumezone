import { apiRequest } from '../api/auth.js';
import { setTableMessage, normalizeList } from '../components/table.js';

const COLS = 4;

let search = '';

function buildRow(tmpl, work) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);

  field('id').textContent = `#${work.id}`;
  field('title').textContent = work.title;
  field('slug').textContent = work.slug || '';
  field('scan-group').textContent = work.scan_group || 'Scan General';
  field('chapters').textContent = work.chapters_count || 0;

  return clone;
}

export async function loadObras() {
  const tbody = document.getElementById('works-table-body');
  const tmpl = document.getElementById('tmpl-work-row');
  const badge = document.getElementById('works-total-badge');

  setTableMessage(tbody, COLS, 'Cargando catálogo...');

  try {
    const works = normalizeList(await apiRequest(`/admin/works?search=${encodeURIComponent(search)}`));
    if (badge) badge.textContent = `${works.length} obras`;

    if (!works.length) {
      setTableMessage(tbody, COLS, 'No se encontraron obras registradas.');
      return;
    }
    tbody.replaceChildren(...works.map((w) => buildRow(tmpl, w)));
  } catch (err) {
    setTableMessage(tbody, COLS, `Error cargando catálogo: ${err.message}`);
  }
}

// Lo usa el buscador global de la cabecera
export function searchObras(term) {
  search = term;
  const input = document.getElementById('works-search-input');
  if (input) input.value = term;
  return loadObras();
}

export function initObras() {
  document.getElementById('btn-refresh-works')?.addEventListener('click', loadObras);

  const input = document.getElementById('works-search-input');
  let timer;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      search = input.value.trim();
      loadObras();
    }, 350);
  });
}
