// Lógica de inicio de sesión para Scan Studio
import { API_BASE_URL } from '../api/api-config.js';
import { setAccessToken, clearAccessToken, getDashboardUrl, evaluateUserScanAccess, apiRequest } from '../shared/auth.js';
import { showToast } from '../shared/toast.js';

const FORBIDDEN_MSG = 'No tienes permiso para acceder a YumeScan Studio. Solicita autorización al administrador o pide al líder de tu clan que te agregue al equipo.';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scan-login-form');
    const emailInput = document.getElementById('scan-email');
    const pwdInput = document.getElementById('scan-password');
    const submitBtn = document.getElementById('btn-submit');
    const submitText = submitBtn?.querySelector('.btn-login-text');
    const errorAlert = document.getElementById('error-alert');

    const queryError = new URLSearchParams(window.location.search).get('error');
    if (queryError === 'forbidden' && errorAlert) {
        errorAlert.textContent = FORBIDDEN_MSG;
        errorAlert.classList.remove('hidden');
    }

    // Toggle de visibilidad de contraseña
    form?.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
        const icon = toggle.querySelector('img');
        toggle.addEventListener('click', () => {
            const isPassword = pwdInput.type === 'password';
            pwdInput.type = isPassword ? 'text' : 'password';
            toggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
            toggle.setAttribute('aria-pressed', String(isPassword));
            if (icon) {
                icon.src = isPassword ? '../assets/icons/svg/eye-off.svg' : '../assets/icons/svg/eye.svg';
            }
        });
    });

    function setBusy(busy, customText = null) {
        form?.classList.toggle('is-busy', busy);
        if (submitBtn) submitBtn.disabled = busy;
        if (submitText) {
            submitText.textContent = customText || (busy ? 'Validando permisos de Scan...' : 'Ingresar al Taller de Scan');
        }
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorAlert) {
                errorAlert.textContent = '';
                errorAlert.classList.add('hidden');
            }
            setBusy(true);

            try {
                const res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/v1/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: emailInput.value.trim(),
                        password: pwdInput.value
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Credenciales incorrectas');

                // Validar inmediatamente si el usuario tiene permiso de Scan ANTES de redirigir
                const { hasScanPermission } = await evaluateUserScanAccess(data.access_token);
                if (!hasScanPermission) {
                    clearAccessToken();
                    await apiRequest('/auth/logout', { method: 'POST', token: data.access_token }).catch(() => {});
                    throw new Error(FORBIDDEN_MSG);
                }

                setAccessToken(data.access_token);
                showToast('¡Bienvenido al Taller de Scan!', 'success');

                setTimeout(() => {
                    window.location.href = getDashboardUrl();
                }, 250);

            } catch (err) {
                const msg = err.message || 'Error al autenticar';
                if (errorAlert) {
                    errorAlert.textContent = msg;
                    errorAlert.classList.remove('hidden');
                }
                showToast(msg, 'error');
                setBusy(false);
            }
        });
    }
});
