import { apiRequest, isAdminRole } from '../api/auth.js';

// Con sesión de ADMIN / SUPERADMIN el acceso del header pasa de "Iniciar sesión" a "Ir al Panel"
async function showPanelAccess() {
  try {
    const user = await apiRequest('/auth/me');
    if (!isAdminRole(user)) return;
    document.getElementById('header-dashboard-btn').hidden = false;
    document.getElementById('header-login-btn').hidden = true;
  } catch {
    // Sin sesión: se mantiene el botón de login
  }
}

showPanelAccess();
