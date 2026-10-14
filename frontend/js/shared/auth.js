import { API_BASE_URL } from '../api/api-config.js';

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
        await authRequest('/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {
        console.error("Error al cerrar sesión", e);
    } finally {
        clearAccessToken();
        window.location.href = '/pages/login.html';
    }
}

export function authRequest(path, options = {}) {
    return apiRequest(`/auth${path}`, options);
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

    const cleanBase = (API_BASE_URL || '').trim();
    const normalizedBase = /^https?:\/\//i.test(cleanBase) ? cleanBase : `https://${cleanBase}`;
    const apiUrl = `${normalizedBase.replace(/\/+$/, '')}/v1${path}`;
    const response = await fetch(apiUrl, {
        ...requestOptions,
        headers,
        body,
        credentials: 'include' // Obligatorio para cookies HttpOnly
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

    // Disparador reactivo global: si se realiza una acción mutante (POST, PUT, PATCH, DELETE) que altera datos
    const method = (requestOptions.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !path.includes('/chat/heartbeat') && !path.includes('/notifications')) {
        try {
            window.dispatchEvent(new CustomEvent('yume:mutation', { detail: { path, method, payload } }));
        } catch {}
    }

    return payload;
}
