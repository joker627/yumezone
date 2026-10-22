import { apiRequest } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { setTableMessage } from '../components/table.js';
import { formatRelativeTime } from '../utils.js';

const COLS = 7;
const PAGE_SIZE = 20;

let page = 1;
let search = '';

async function saveUser(user, roleSelect, statusSelect, button) {
  const nextRole = roleSelect.value;
  const nextStatus = statusSelect.value;
  const currentRole = (user.platform_role || 'USER').toUpperCase();
  const currentStatus = (user.status || 'ACTIVE').toUpperCase();

  button.disabled = true;
  button.textContent = '...';
  try {
    // Solo se llama a lo que cambió: el rol exige SUPERADMIN y fallaría para un ADMIN aunque no se tocara.
    if (nextRole !== currentRole) {
      await apiRequest(`/admin/users/${user.id}/role`, { method: 'PATCH', body: { platform_role: nextRole } });
      user.platform_role = nextRole;
    }
    if (nextStatus !== currentStatus) {
      await apiRequest(`/admin/users/${user.id}/status`, { method: 'PATCH', body: { status: nextStatus } });
      user.status = nextStatus;
    }
    showToast(`Usuario #${user.id} actualizado.`, 'success');
  } catch (err) {
    showToast(err.message || 'Error al actualizar', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar';
  }
}

function buildRow(tmpl, user) {
  const clone = tmpl.content.cloneNode(true);
  const field = (name) => clone.querySelector(`[data-field="${name}"]`);

  field('id').textContent = `#${user.id}`;
  field('username').textContent = user.username;
  field('verified').hidden = !user.is_verified;
  field('email').textContent = user.email;
  field('created-at').textContent = formatRelativeTime(user.created_at);

  const roleSelect = field('role-select');
  const statusSelect = field('status-select');
  roleSelect.value = (user.platform_role || 'USER').toUpperCase();
  statusSelect.value = (user.status || 'ACTIVE').toUpperCase();

  const saveBtn = clone.querySelector('[data-action="save"]');
  saveBtn.addEventListener('click', () => saveUser(user, roleSelect, statusSelect, saveBtn));

  return clone;
}

export async function loadUsuarios() {
  const tbody = document.getElementById('users-table-body');
  const tmpl = document.getElementById('tmpl-user-row');
  const badge = document.getElementById('users-total-badge');
  const pagInfo = document.getElementById('users-pagination-info');
  const btnPrev = document.getElementById('btn-users-prev');
  const btnNext = document.getElementById('btn-users-next');

  setTableMessage(tbody, COLS, 'Cargando usuarios...');

  try {
    const res = await apiRequest(`/admin/users?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`);
    const users = res.items || [];
    const total = res.total || 0;

    if (badge) badge.textContent = `${total} registros`;
    if (pagInfo) pagInfo.textContent = `Página ${page} (${users.length} mostrados de ${total})`;
    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page * PAGE_SIZE >= total;

    if (!users.length) {
      setTableMessage(tbody, COLS, 'No se encontraron usuarios.');
      return;
    }
    tbody.replaceChildren(...users.map((u) => buildRow(tmpl, u)));
  } catch (err) {
    setTableMessage(tbody, COLS, `Error cargando usuarios: ${err.message}`);
  }
}

export function initUsuarios() {
  document.getElementById('btn-refresh-users')?.addEventListener('click', loadUsuarios);

  const input = document.getElementById('users-search-input');
  let timer;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      search = input.value.trim();
      page = 1;
      loadUsuarios();
    }, 350);
  });

  document.getElementById('btn-users-prev')?.addEventListener('click', () => {
    if (page > 1) {
      page--;
      loadUsuarios();
    }
  });

  document.getElementById('btn-users-next')?.addEventListener('click', () => {
    page++;
    loadUsuarios();
  });
}
