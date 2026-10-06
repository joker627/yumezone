import { authRequest, setAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const form = document.getElementById('auth-form');
const message = document.getElementById('auth-message');
const submit = document.getElementById('auth-submit');
const mode = form?.dataset.authMode;

form?.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    const password = toggle.closest('.account-password-field')?.querySelector('input');
    const icon = toggle.querySelector('img');
    if (!password || !icon) return;

    toggle.addEventListener('click', () => {
        const showPassword = password.type === 'password';
        password.type = showPassword ? 'text' : 'password';
        toggle.setAttribute('aria-label', showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
        toggle.setAttribute('aria-pressed', String(showPassword));
        icon.src = showPassword
            ? '/assets/icons/svg/eye-off.svg'
            : '/assets/icons/svg/eye.svg';
    });
});

function setMessage(text, kind = 'error') {
    message.textContent = text;
    message.dataset.kind = kind;
}

function getReturnPath() {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (!requested) return '/index.html';
    try {
        const url = new URL(requested, window.location.origin);
        if (url.origin !== window.location.origin) return '/index.html';
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/index.html';
    }
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    const username = String(values.get('username') || '').trim();

    if (mode === 'register' && password !== values.get('password_confirm')) {
        setMessage('Las contraseñas no coinciden.');
        return;
    }

    submit.disabled = true;
    submit.textContent = mode === 'register' ? 'Creando cuenta…' : 'Iniciando sesión…';
    message.textContent = '';
    delete message.dataset.kind;

    try {
        if (mode === 'register') {
            await authRequest('/register', {
                method: 'POST',
                token: '',
                body: { username, email, password },
            });
        }

        const token = await authRequest('/login', {
            method: 'POST',
            token: '',
            body: { email, password },
        });
        setAccessToken(token.access_token);
        setMessage('Sesión iniciada. Abriendo tu cuenta…', 'success');
        window.location.assign(getReturnPath());
    } catch (error) {
        setMessage(error.message || 'No se pudo completar la solicitud. Inténtalo de nuevo.');
        submit.disabled = false;
        submit.textContent = mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
    }
});
