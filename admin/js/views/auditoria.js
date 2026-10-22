import { apiRequest } from '../api/auth.js';
import { setTableMessage, normalizeList } from '../components/table.js';

const COLS = 6;

function buildRow(tmpl, log) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);

  field('created-at').textContent = new Date(log.created_at).toLocaleString('es-ES');
  field('operator').textContent = log.operator_username || 'Admin';
  field('action').textContent = log.action;
  field('entity').textContent = log.entity_type;
  field('id').textContent = `#${log.entity_id}`;
  field('details').textContent = log.details || '-';

  return clone;
}

export async function loadAuditoria() {
  const tbody = document.getElementById('audit-table-body');
  const tmpl = document.getElementById('tmpl-audit-row');
  const badge = document.getElementById('audit-count-badge');

  setTableMessage(tbody, COLS, 'Cargando auditoría...');

  try {
    const logs = normalizeList(await apiRequest('/admin/audit-logs'));
    if (badge) badge.textContent = `${logs.length} registros`;

    if (!logs.length) {
      setTableMessage(tbody, COLS, 'Sin registros de auditoría aún.');
      return;
    }
    tbody.replaceChildren(...logs.map((l) => buildRow(tmpl, l)));
  } catch (err) {
    setTableMessage(tbody, COLS, `Error: ${err.message}`);
  }
}

export function initAuditoria() {
  document.getElementById('btn-refresh-audit')?.addEventListener('click', loadAuditoria);
}
