import { authRequest, setAccessToken } from '../shared/auth.js';
import { showToast, flashToast } from '../shared/toast.js';

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
            ? '/assets/icons/svg/actions/eye-off.svg'
            : '/assets/icons/svg/actions/eye.svg';
    });
});

function setMessage(text, kind = 'error') {
    if (message) {
        message.textContent = text;
        message.dataset.kind = kind;
    }
}

// bloquea el formulario mientras se procesa (atenuado, sin mensajes)
function setBusy(busy) {
    form?.classList.toggle('is-busy', busy);
    form?.setAttribute('aria-busy', String(busy));
    form?.querySelectorAll('input, button').forEach((el) => { el.disabled = busy; });
    submit.textContent = busy
        ? (mode === 'register' ? 'Creando cuenta…' : 'Iniciando sesión…')
        : (mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión');
}

function getReturnPath() {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (!requested) return '/';
    try {
        const url = new URL(requested, window.location.origin);
        if (url.origin !== window.location.origin) return '/';
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/';
    }
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    const username = String(values.get('username') || '').trim();

    if (mode === 'register') {
        if (username.length < 3) {
            const msg = 'El nombre de usuario debe tener al menos 3 caracteres.';
            setMessage(msg, 'error');
            showToast(msg, 'warning');
            return;
        }
        if (password !== values.get('password_confirm')) {
            const msg = 'Las contraseñas no coinciden.';
            setMessage(msg, 'error');
            showToast(msg, 'warning');
            return;
        }
    }

    setBusy(true);
    if (message) {
        message.textContent = '';
        delete message.dataset.kind;
    }

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
        // el aviso se muestra en la pagina de destino
        flashToast(mode === 'register' ? '¡Cuenta creada! Bienvenido a YumeZone' : 'Sesión iniciada', 'success');
        // el formulario queda bloqueado hasta que el navegador cambia de página
        window.location.replace(getReturnPath());
    } catch (error) {
        const errText = error.message || 'Correo o contraseña incorrectos.';
        setMessage(errText, 'error');
        showToast(errText, 'error');
        setBusy(false);
    }
});
