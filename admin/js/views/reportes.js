import { apiRequest } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { setTableMessage, normalizeList } from '../components/table.js';
import { formatRelativeTime } from '../utils.js';

const COLS = 7;

let filter = '';

const STATUS_TONE = { OPEN: 'danger', RESOLVED: 'active' };

async function updateReport(report, status, doneMessage, button) {
  button.disabled = true;
  try {
    await apiRequest(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status } });
    showToast(doneMessage, 'success');
    await loadReportes();
  } catch (err) {
    showToast(err.message, 'error');
    button.disabled = false;
  }
}

function buildRow(tmpl, report) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);

  field('id').textContent = `#${report.id}`;
  field('target').textContent = `${report.content_type} #${report.content_id}`;
  field('reason').textContent = report.reason;
  field('details').textContent = report.details || '';
  field('reporter').textContent = report.reporter_username || 'Lector';
  field('created-at').textContent = formatRelativeTime(report.created_at);

  const status = field('status');
  status.textContent = report.status;
  status.classList.add(STATUS_TONE[report.status] || 'neutral');

  const resolveBtn = clone.querySelector('[data-action="resolve"]');
  const dismissBtn = clone.querySelector('[data-action="dismiss"]');
  resolveBtn.hidden = report.status === 'RESOLVED';
  dismissBtn.hidden = report.status === 'DISMISSED';

  resolveBtn.addEventListener('click', () =>
    updateReport(report, 'RESOLVED', `Reporte #${report.id} resuelto.`, resolveBtn));
  dismissBtn.addEventListener('click', () =>
    updateReport(report, 'DISMISSED', `Reporte #${report.id} descartado.`, dismissBtn));

  return clone;
}

export async function loadReportes() {
  const tbody = document.getElementById('reports-table-body');
  const tmpl = document.getElementById('tmpl-report-row');
  const badge = document.getElementById('reports-total-badge');

  setTableMessage(tbody, COLS, 'Cargando reportes...');

  try {
    const reports = normalizeList(await apiRequest(`/admin/reports${filter ? `?status=${filter}` : ''}`));

    if (badge) {
      const open = reports.filter((r) => r.status === 'OPEN').length;
      badge.textContent = `${open} abiertos (${reports.length} total)`;
    }

    if (!reports.length) {
      setTableMessage(tbody, COLS, 'No hay reportes con el filtro actual.');
      return;
    }
    tbody.replaceChildren(...reports.map((r) => buildRow(tmpl, r)));
  } catch (err) {
    setTableMessage(tbody, COLS, `Error: ${err.message}`);
  }
}

export function initReportes() {
  document.getElementById('btn-refresh-reports')?.addEventListener('click', loadReportes);
  document.getElementById('reports-filter-select')?.addEventListener('change', (e) => {
    filter = e.target.value;
    loadReportes();
  });
}
