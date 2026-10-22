import { API_BASE_URL } from './api-config.js';

// La sesión la maneja el backend con una cookie HttpOnly: el admin no guarda ni lee tokens.
export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  let body = options.body;
  if (body && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`, {
    ...options,
    headers,
    body,
    credentials: 'include'
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(' ')
      : detail;
    const error = new Error(message || `No se pudo completar la solicitud (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function isAdminRole(user) {
  return ['ADMIN', 'SUPERADMIN'].includes((user?.platform_role || '').toUpperCase());
}

export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/pages/login.html';
  }
}
