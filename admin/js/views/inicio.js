import { apiRequest } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { setListMessage } from '../components/table.js';
import { formatNumber, formatRelativeTime } from '../utils.js';

const STATS = {
  'stat-total-users': (d) => formatNumber(d.total_users),
  'stat-active-users': (d) => `${formatNumber(d.active_users)} activos`,
  'stat-total-works': (d) => formatNumber(d.works),
  'stat-published-chapters': (d) => formatNumber(d.published_chapters),
  'stat-views-24h': (d) => formatNumber(d.views_last_24h),
  'stat-total-views': (d) => formatNumber(d.total_views),
  'stat-total-comments': (d) => formatNumber(d.total_comments),
  'stat-open-reports': (d) => formatNumber(d.open_reports)
};

function renderSummaryList(containerId, items, emptyText, fillItem) {
  const container = document.getElementById(containerId);
  const tmpl = document.getElementById('tmpl-summary-item');
  if (!container || !tmpl) return;

  if (!items.length) {
    setListMessage(container, emptyText);
    return;
  }

  container.replaceChildren(...items.slice(0, 5).map((item) => {
    const clone = tmpl.content.cloneNode(true);
    fillItem(clone, item);
    return clone;
  }));
}

function field(clone, name) {
  return clone.querySelector(`[data-field="${name}"]`);
}

export async function loadInicio() {
  try {
    const data = await apiRequest('/admin/dashboard');

    Object.entries(STATS).forEach(([id, format]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = format(data);
    });

    renderSummaryList('recent-works-list', data.recent_works || [], 'No hay obras registradas aún.', (clone, w) => {
      field(clone, 'title').textContent = w.title;
      field(clone, 'subtitle').textContent = w.scan_group || 'Scan General';
      field(clone, 'badge').textContent = `${w.chapters_count || 0} caps`;
    });

    renderSummaryList('recent-reports-list', data.recent_reports || [], 'Sin reportes pendientes.', (clone, r) => {
      field(clone, 'title').textContent = r.reason || 'Sin motivo';
      field(clone, 'subtitle').textContent = `${r.content_type} • por ${r.reporter_username || 'Lector'}`;
      const badge = field(clone, 'badge');
      badge.textContent = r.status;
      badge.classList.add(r.status === 'OPEN' ? 'danger' : 'neutral');
    });

    renderSummaryList('recent-audit-list', data.recent_audit || [], 'Sin registros de auditoría recientes.', (clone, l) => {
      const title = field(clone, 'title');
      title.textContent = l.action;
      title.classList.add('trend-up');
      field(clone, 'subtitle').textContent = `${l.operator_username || 'Admin'} • ${l.entity_type} #${l.entity_id}`;
      const badge = field(clone, 'badge');
      badge.className = 'summary-item-subtitle';
      badge.textContent = formatRelativeTime(l.created_at);
    });

    syncSettingsSwitches();
  } catch (err) {
    showToast(`Error cargando datos de inicio: ${err.message}`, 'error');
  }
}

function paintMaintenanceBadge(checked) {
  const badge = document.getElementById('maint-badge');
  if (!badge) return;
  badge.className = checked ? 'badge danger' : 'badge active';
  badge.textContent = checked ? 'Mantenimiento' : 'Online';
}

function bindSettingSwitch(input, key, description, messages, onChange) {
  input.onchange = async () => {
    try {
      await apiRequest(`/admin/settings/${key}`, {
        method: 'PUT',
        body: { value: input.checked ? 'true' : 'false', description }
      });
      showToast(input.checked ? messages.on : messages.off, 'success');
      onChange?.(input.checked);
    } catch (err) {
      showToast(err.message, 'error');
      input.checked = !input.checked;
    }
  };
}

// Sincroniza los switches del hero (mantenimiento / registros) con platform_settings.
export async function syncSettingsSwitches() {
  try {
    const settings = await apiRequest('/admin/settings');
    const valueOf = (key) => settings.find((s) => s.setting_key === key)?.setting_value;

    const switchMaint = document.getElementById('switch-maint');
    const switchReg = document.getElementById('switch-reg');

    if (switchMaint && valueOf('maintenance_mode') !== undefined) {
      switchMaint.checked = valueOf('maintenance_mode') === 'true';
      paintMaintenanceBadge(switchMaint.checked);
      bindSettingSwitch(switchMaint, 'maintenance_mode', 'Modo mantenimiento de la web', {
        on: 'Modo mantenimiento ACTIVADO.',
        off: 'Modo mantenimiento DESACTIVADO.'
      }, paintMaintenanceBadge);
    }

    if (switchReg && valueOf('allow_registrations') !== undefined) {
      switchReg.checked = valueOf('allow_registrations') === 'true';
      bindSettingSwitch(switchReg, 'allow_registrations', 'Permitir registro de nuevos lectores', {
        on: 'Registro de usuarios HABILITADO.',
        off: 'Registro de usuarios SUSPENDIDO.'
      });
    }
  } catch (err) {
    console.warn('Error sincronizando switches:', err);
  }
}

export function initInicio() {
  document.getElementById('btn-refresh-inicio')?.addEventListener('click', loadInicio);
}
