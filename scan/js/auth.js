const hostname = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
export const API_BASE_URL = `http://${hostname}:8000/api`;
export const FRONTEND_URL = `http://${hostname}:5500`;
export const ADMIN_URL = `http://${hostname}:4000`;
export const SCAN_URL = `http://${hostname}:4400`;

const TOKEN_KEY = 'yumezone.access_token';

export function getAccessToken() {
    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setAccessToken(token) {
    window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
}

export async function logoutUser() {
    try {
        await apiRequest('/chat/heartbeat', { method: 'DELETE' }).catch(() => {});
        await apiRequest('/logout', { method: 'POST' });
    } catch (e) {
        console.error("Error al cerrar sesión", e);
    } finally {
        clearAccessToken();
        window.location.href = '/login.html';
    }
}

export async function apiRequest(path, options = {}) {
    const { token: tokenOverride, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers || {});
    const token = tokenOverride ?? getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let body = requestOptions.body;
    if (body && typeof body !== 'string' && !(body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(body);
    } else if (typeof body === 'string') {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const apiUrl = `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
    const response = await fetch(apiUrl, {
        ...requestOptions,
        headers,
        body,
        credentials: 'include'
    });

    if (response.status === 401) {
        clearAccessToken();
        window.location.href = '/login.html';
        throw new Error('Sesión expirada o no autorizada');
    }

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { detail: response.statusText };
        }
        throw new Error(errorData.detail || errorData.message || 'Error en la petición');
    }

    if (response.status === 204) return null;
    return response.json();
}
