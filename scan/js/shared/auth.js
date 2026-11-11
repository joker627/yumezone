// Módulo de autenticación compartida y cliente API para Scan Studio
import { API_BASE_URL } from '../api/api-config.js';

const TOKEN_KEY = 'yumezone.access_token';
let cachedAuthPromise = null;

export function getAccessToken() {
    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setAccessToken(token) {
    try {
        window.localStorage.setItem(TOKEN_KEY, token);
        cachedAuthPromise = null;
    } catch {}
}

export function clearAccessToken() {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
        cachedAuthPromise = null;
    } catch {}
}

export function invalidateAuthCache() {
    cachedAuthPromise = null;
}

export function getLoginUrl() {
    if (typeof window === 'undefined') return './pages/login.html';
    const path = window.location.pathname || '';
    const isInsidePages = path.includes('/pages/');
    const hasScanPrefix = path.includes('/scan/') || path.startsWith('/scan');

    if (isInsidePages) return './login.html';
    if (hasScanPrefix) return '/scan/pages/login.html';
    return './pages/login.html';
}

export function getDashboardUrl() {
    if (typeof window === 'undefined') return './pages/dashboard.html';
    const path = window.location.pathname || '';
    const isInsidePages = path.includes('/pages/');
    const hasScanPrefix = path.includes('/scan/') || path.startsWith('/scan');

    if (isInsidePages) return './dashboard.html';
    if (hasScanPrefix) return '/scan/pages/dashboard.html';
    return './pages/dashboard.html';
}

export async function logoutUser() {
    try {
        await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {
        console.error('Error al cerrar sesión', e);
    } finally {
        clearAccessToken();
        window.location.href = getLoginUrl();
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

    const cleanBase = (API_BASE_URL || '').trim();
    const apiUrl = `${cleanBase.replace(/\/+$/, '')}/v1${path}`;
    const response = await fetch(apiUrl, {
        ...requestOptions,
        headers,
        body,
        credentials: 'include'
    });

    if (response.status === 401) {
        clearAccessToken();
        window.location.href = getLoginUrl();
        throw new Error('Sesión expirada o no autorizada');
    }

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { detail: response.statusText };
        }
        const err = new Error(errorData.detail || errorData.message || 'Error en la petición');
        err.detail = errorData.detail;
        err.status = response.status;
        throw err;
    }

    if (response.status === 204) return null;
    return response.json();
}

export function renderAccessDeniedScreen(user = null) {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('sidebar-open');
    const header = document.getElementById('header') || document.getElementById('dash-header-mount');
    const footer = document.getElementById('site-footer') || document.getElementById('dash-footer-mount');
    if (header) header.innerHTML = '';
    if (footer) footer.innerHTML = '';

    const main = document.querySelector('main') || document.body;
    const usernameText = user?.username ? `@${user.username}` : 'Tu cuenta actual';
    main.innerHTML = `
        <div style="min-height: 85vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
            <div style="max-width: 460px; width: 100%; background: rgba(16, 20, 29, 0.95); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 1.25rem; padding: 2.25rem 1.75rem; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);">
                <div style="width: 3.5rem; height: 3.5rem; border-radius: 9999px; background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                    <img src="../assets/icons/svg/lock.svg" class="icon-svg icon-lg" alt="Sin permiso">
                </div>
                <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: rgba(244, 63, 94, 0.15); color: #fda4af; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem;">
                    Acceso Restringido
                </span>
                <h1 style="font-size: 1.35rem; font-weight: 900; color: #ffffff; margin: 0 0 0.65rem;">
                    No tienes permiso para acceder a YumeScan Studio
                </h1>
                <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem;">
                    <strong>${usernameText}</strong> es una cuenta de lector estándar y no pertenece a ningún clan de traducción activo ni posee permisos administrativos.<br><br>
                    Si eres traductor, editor o líder de un grupo, solicita autorización al <strong>Administrador de la plataforma</strong> o pide al <strong>Líder de tu Clan</strong> que te agregue al equipo.
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                    <button type="button" id="btn-denied-switch-account" style="width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; background: linear-gradient(135deg, #ff5451, #e11d48); color: #ffffff; font-weight: 800; font-size: 0.82rem; border: none; cursor: pointer;">
                        Iniciar sesión con otra cuenta autorizada
                    </button>
                    <a href="../../frontend/index.html" style="display: inline-block; width: 100%; padding: 0.7rem 1rem; border-radius: 0.75rem; background: rgba(255, 255, 255, 0.05); color: #cbd5e1; font-weight: 700; font-size: 0.8rem; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.08);">
                        ← Volver al Portal de Lectura
                    </a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-denied-switch-account')?.addEventListener('click', () => {
        logoutUser();
    });
    main.style.visibility = 'visible';
}

export async function evaluateUserScanAccess(tokenOverride = null) {
    const reqOpts = tokenOverride ? { token: tokenOverride } : {};
    const currentUser = await apiRequest('/auth/me', reqOpts);
    const role = (currentUser.platform_role || '').toUpperCase();
    const isPlatformAdmin = ['ADMIN', 'SUPERADMIN'].includes(role);
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    const canCreateScan = isPlatformAdmin || perms.includes('scan:create') || perms.includes('scan:panel_access');

    let myScan = null;
    try {
        myScan = await apiRequest('/scan-groups/my-scan', reqOpts);
    } catch (err) {
        console.debug('Sin scan en /scan-groups/my-scan:', err?.message);
    }

    if (!myScan || !myScan.id) {
        try {
            const res = await apiRequest('/admin/my-scan-groups', reqOpts);
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            if (list.length > 0) myScan = list[0];
        } catch {}
    }

    const isScanMember = Boolean(myScan && myScan.id);
    const hasScanPermission = isPlatformAdmin || canCreateScan || isScanMember;

    return {
        currentUser,
        myScan,
        isPlatformAdmin,
        canCreateScan,
        isScanMember,
        hasScanPermission
    };
}

export async function checkScanAuth(forceRefresh = false) {
    if (!forceRefresh && cachedAuthPromise) {
        return cachedAuthPromise;
    }

    const mainEl = typeof document !== 'undefined' ? document.querySelector('main') : null;
    if (mainEl && !forceRefresh) {
        mainEl.style.visibility = 'hidden';
    }

    cachedAuthPromise = (async () => {
        const token = getAccessToken();
        if (!token) {
            window.location.href = getLoginUrl();
            return null;
        }

        try {
            const {
                currentUser,
                myScan,
                isPlatformAdmin,
                isScanMember,
                hasScanPermission
            } = await evaluateUserScanAccess(token);

            const role = (currentUser.platform_role || '').toUpperCase();

            if (!hasScanPermission) {
                renderAccessDeniedScreen(currentUser);
                return null;
            }

            if (mainEl) {
                mainEl.style.visibility = 'visible';
            }

            const currentScan = isScanMember ? {
                id: Number(myScan.id),
                name: myScan.name || 'Clan de Scan',
                slug: myScan.slug || '',
                role: (myScan.role_name || myScan.role_code || (isPlatformAdmin ? role : 'MIEMBRO DE SCAN')).toUpperCase(),
                role_code: (myScan.role_code || (isPlatformAdmin ? 'LEADER' : 'UPLOADER')).toUpperCase(),
                works_count: Number(myScan.works_count) || 0,
                chapters_count: Number(myScan.chapters_count) || 0,
                members_count: Number(myScan.members_count) || 1,
                vault_tokens: Number(myScan.vault_tokens) || 0,
                total_contributed_tokens: Number(myScan.total_contributed_tokens) || 0,
                clan_level: Number(myScan.clan_level) || 1,
                logo_url: myScan.logo_url || '../assets/icons/logo.png',
                banner_url: myScan.banner_url || '',
                description: myScan.description || '',
                social_links: myScan.social_links || {},
                report_methods: myScan.report_methods || {},
                status: myScan.status || 'ACTIVE',
                is_leader: Boolean(myScan.is_leader || isPlatformAdmin),
                can_manage: Boolean(myScan.can_manage || isPlatformAdmin),
                can_upload: Boolean(myScan.can_upload || isPlatformAdmin)
            } : {
                id: null,
                name: 'Sin Clan Asignado',
                slug: '',
                role: isPlatformAdmin ? role : 'AUTORIZADO',
                role_code: isPlatformAdmin ? 'LEADER' : 'NONE',
                works_count: 0,
                chapters_count: 0,
                members_count: 0,
                vault_tokens: 0,
                total_contributed_tokens: 0,
                clan_level: 1,
                logo_url: '../assets/icons/logo.png',
                banner_url: '',
                description: '',
                social_links: {},
                report_methods: {},
                status: 'INACTIVE',
                is_leader: isPlatformAdmin,
                can_manage: isPlatformAdmin,
                can_upload: isPlatformAdmin
            };

            return { currentUser, currentScan };
        } catch (err) {
            console.error('Error de verificación en Scan Studio:', err);
            window.location.href = getLoginUrl();
            return null;
        }
    })();

    return cachedAuthPromise;
}
