import { API_BASE_URL } from '../api/api-config.js';
import { apiRequest, getAccessToken } from './auth.js';

let presenceInterval = null;
let lastPingTime = 0;
let isPresenceInitialized = false;

function sendOfflineBeacon() {
  const token = getAccessToken();
  if (!token) return;

  const url = `${API_BASE_URL.replace(/\/+$/, '')}/v1/chat/heartbeat`;
  try {
    fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

async function sendHeartbeat() {
  const token = getAccessToken();
  if (!token) return;

  try {
    lastPingTime = Date.now();
    await apiRequest('/chat/heartbeat', { method: 'POST' });
  } catch {
    // Silencioso para no interferir con la navegación del usuario
  }
}

/**
 * Inicializa el sistema de presencia en tiempo real en la página.
 */
export function initPresence() {
  if (isPresenceInitialized) {
    if (getAccessToken()) sendHeartbeat();
    return;
  }
  isPresenceInitialized = true;

  if (getAccessToken()) {
    sendHeartbeat();
  }

  // Renovar heartbeat cada 25 segundos mientras esté activo
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(() => {
    if (document.hidden || !getAccessToken()) return;
    sendHeartbeat();
  }, 25000);

  // Al regresar a la pestaña o ventana
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && getAccessToken()) {
      if (Date.now() - lastPingTime > 15000) {
        sendHeartbeat();
      }
    }
  });

  window.addEventListener('focus', () => {
    if (getAccessToken() && Date.now() - lastPingTime > 15000) {
      sendHeartbeat();
    }
  });

  // Al cerrar la pestaña o salir del sitio, eliminar presencia de inmediato
  window.addEventListener('beforeunload', () => {
    sendOfflineBeacon();
  });

  window.addEventListener('pagehide', () => {
    sendOfflineBeacon();
  });
}

/**
 * Desconecta la presencia activa explícitamente (ej. al cerrar sesión).
 */
export function disconnectPresence() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  sendOfflineBeacon();
}
