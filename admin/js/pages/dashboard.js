import { apiRequest, isAdminRole, logoutUser } from '../api/auth.js';
import { initInicio, loadInicio } from '../views/inicio.js';
import { initUsuarios, loadUsuarios } from '../views/usuarios.js';
import { initObras, loadObras, searchObras } from '../views/obras.js';
import { initAjustes, loadAjustes } from '../views/ajustes.js';
import { initAnuncios, loadAnuncios } from '../views/anuncios.js';
import { initReportes, loadReportes } from '../views/reportes.js';
import { initAuditoria, loadAuditoria } from '../views/auditoria.js';

const LOGIN_URL = '/pages/login.html';

// Cada ruta del hash corresponde a una sección #view-<ruta> del HTML
const ROUTES = {
  inicio: loadInicio,
  usuarios: loadUsuarios,
  obras: loadObras,
  ajustes: loadAjustes,
  anuncios: loadAnuncios,
  reportes: loadReportes,
  auditoria: loadAuditoria
};

function goToLogin(reason) {
  window.location.href = reason ? `${LOGIN_URL}?error=${reason}` : LOGIN_URL;
}

function fillUserHeader(user) {
  document.getElementById('user-display-name').textContent = user.username;
  document.getElementById('user-display-role').textContent = user.platform_role;
  document.getElementById('avatar-btn').title = `${user.username} (${user.platform_role})`;
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('active');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

function initHeader() {
  const dropdown = document.getElementById('dropdown-menu');
  const globalSearch = document.getElementById('global-search');

  document.getElementById('avatar-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('active');
  });
  document.addEventListener('click', () => dropdown?.classList.remove('active'));
  document.getElementById('btn-logout')?.addEventListener('click', logoutUser);

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  document.querySelectorAll('#sidebar .nav-link').forEach((link) => link.addEventListener('click', closeSidebar));

  // El buscador global busca en el catálogo de obras
  globalSearch?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const term = globalSearch.value.trim();
    if (!term) return;
    window.location.hash = '#obras';
    searchObras(term);
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      globalSearch?.focus();
    }
  });
}

async function handleRoute() {
  const hash = window.location.hash.replace('#', '');
  const route = hash in ROUTES ? hash : 'inicio';

  Object.keys(ROUTES).forEach((name) => {
    const section = document.getElementById(`view-${name}`);
    if (section) section.hidden = name !== route;
  });

  document.querySelectorAll('#sidebar .nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  await ROUTES[route]();
}

async function initDashboard() {
  let user;
  try {
    user = await apiRequest('/auth/me');
  } catch {
    goToLogin();
    return;
  }

  if (!isAdminRole(user)) {
    goToLogin('forbidden');
    return;
  }

  fillUserHeader(user);
  initHeader();
  [initInicio, initUsuarios, initObras, initAjustes, initAnuncios, initReportes, initAuditoria]
    .forEach((init) => init());

  window.addEventListener('hashchange', handleRoute);
  await handleRoute();
}

initDashboard();
