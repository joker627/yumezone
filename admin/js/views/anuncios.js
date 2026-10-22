import { apiRequest } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { setTableMessage, normalizeList } from '../components/table.js';
import { formatRelativeTime } from '../utils.js';

const COLS = 7;

async function deleteAnnouncement(ann) {
  if (!confirm(`¿Eliminar anuncio #${ann.id}?`)) return;
  try {
    await apiRequest(`/admin/announcements/${ann.id}`, { method: 'DELETE' });
    showToast('Anuncio eliminado.', 'success');
    await loadAnuncios();
  } catch (err) {
    showToast(err.message || 'Error al eliminar', 'error');
  }
}

function buildRow(tmpl, ann) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);

  field('id').textContent = `#${ann.id}`;
  field('title').textContent = ann.title;
  field('desc').textContent = ann.description || '';

  const type = field('type');
  type.textContent = ann.type || 'sistema';
  type.classList.add(ann.type === 'sistema' ? 'active' : 'neutral');

  field('type-label').textContent = ann.type_label || '-';
  field('source').textContent = ann.source || 'Administración';
  field('created-at').textContent = formatRelativeTime(ann.created_at);

  clone.querySelector('[data-action="delete"]').addEventListener('click', () => deleteAnnouncement(ann));

  return clone;
}

export async function loadAnuncios() {
  const tbody = document.getElementById('ann-table-body');
  const tmpl = document.getElementById('tmpl-ann-row');
  const badge = document.getElementById('ann-count-badge');

  setTableMessage(tbody, COLS, 'Cargando anuncios...');

  try {
    const items = normalizeList(await apiRequest('/admin/announcements'));
    if (badge) badge.textContent = `${items.length} activos`;

    if (!items.length) {
      setTableMessage(tbody, COLS, 'No hay anuncios registrados actualmente.');
      return;
    }
    tbody.replaceChildren(...items.map((a) => buildRow(tmpl, a)));
  } catch (err) {
    setTableMessage(tbody, COLS, `Error: ${err.message}`);
  }
}

function initAnnouncementForm() {
  const form = document.getElementById('announcement-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-ann');
    const read = (id) => document.getElementById(id)?.value.trim();

    const title = read('ann-title');
    if (!title) return;

    btn.disabled = true;
    try {
      await apiRequest('/admin/announcements', {
        method: 'POST',
        body: {
          title,
          type: document.getElementById('ann-type')?.value,
          type_label: read('ann-type-label'),
          source: read('ann-source') || 'Administración',
          description: read('ann-desc')
        }
      });
      showToast('Anuncio publicado correctamente en la web.', 'success');
      form.reset();
      await loadAnuncios();
    } catch (err) {
      showToast(err.message || 'Error al publicar anuncio', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

export function initAnuncios() {
  document.getElementById('btn-refresh-ann')?.addEventListener('click', loadAnuncios);
  initAnnouncementForm();
}
