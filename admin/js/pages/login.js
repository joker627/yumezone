import { apiRequest, isAdminRole } from '../api/auth.js';

const form = document.getElementById('admin-login-form');
const emailInput = document.getElementById('admin-email');
const pwdInput = document.getElementById('admin-password');
const submitBtn = document.getElementById('btn-submit');
const submitLabel = document.getElementById('btn-submit-label');
const errorAlert = document.getElementById('error-alert');

const LABEL_IDLE = submitLabel.textContent;

const QUERY_ERRORS = {
  forbidden: 'Acceso restringido: esta cuenta no posee permisos de Administrador (ADMIN / SUPERADMIN).'
};

function showError(message) {
  errorAlert.textContent = message;
  errorAlert.hidden = false;
}

function setBusy(busy, label) {
  submitBtn.disabled = busy;
  submitLabel.textContent = label || LABEL_IDLE;
}

document.getElementById('toggle-pwd')?.addEventListener('click', () => {
  pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
});

const queryError = new URLSearchParams(window.location.search).get('error');
if (QUERY_ERRORS[queryError]) showError(QUERY_ERRORS[queryError]);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorAlert.hidden = true;
  setBusy(true, 'Verificando credenciales...');

  try {
    await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: emailInput.value.trim(), password: pwdInput.value }
    });

    const me = await apiRequest('/auth/me');
    if (!isAdminRole(me)) {
      // Descarta la cookie que el backend acaba de fijar a una cuenta sin permisos
      await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
      throw new Error(QUERY_ERRORS.forbidden);
    }

    setBusy(true, '✓ Acceso concedido');
    window.location.href = '/pages/dashboard.html';
  } catch (err) {
    showError(err.message);
    setBusy(false);
  }
});
