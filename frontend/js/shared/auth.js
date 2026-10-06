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
    } catch {
        // El header sigue mostrando la sesión como cerrada si el almacenamiento está bloqueado.
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
    }
    headers.set('Accept', 'application/json');

    const apiUrl = `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
    const response = await fetch(apiUrl, {
        ...requestOptions,
        headers,
        body,
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
