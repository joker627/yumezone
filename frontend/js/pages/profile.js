import { authRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { safeUrl } from '../shared/url-utils.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const profileContent = document.getElementById('profile-content');
const profileForm = document.getElementById('profile-form');
const profileMessage = document.getElementById('profile-message');
const profileSubmit = document.getElementById('profile-submit');
const usernameInput = document.getElementById('profile-edit-username');
const avatarInput = document.getElementById('profile-edit-avatar');
const bioInput = document.getElementById('profile-edit-bio');
const privateInput = document.getElementById('profile-edit-private');
const avatarPreview = document.getElementById('profile-avatar-preview');
const avatarFallback = document.getElementById('profile-avatar-fallback');
let currentUser = null;

function goToLogin() {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
}

function setMessage(text, kind = 'error') {
    profileMessage.textContent = text;
    profileMessage.dataset.kind = kind;
}

function updateAvatarPreview(value) {
    const url = safeUrl(value, '');
    avatarPreview.onerror = () => {
        avatarPreview.hidden = true;
        avatarFallback.hidden = false;
    };
    if (url) {
        avatarPreview.src = url;
        avatarPreview.hidden = false;
        avatarFallback.hidden = true;
    } else {
        avatarPreview.removeAttribute('src');
        avatarPreview.hidden = true;
        avatarFallback.hidden = false;
    }
}

function renderUser(user) {
    currentUser = user;
    const username = user.username || 'Lector';
    document.getElementById('profile-title').textContent = username;
    document.getElementById('profile-username').textContent = `@${username}`;
    document.getElementById('profile-email').textContent = user.email || '—';
    document.getElementById('profile-user-id').textContent = user.user_code || '—';
    document.getElementById('profile-role').textContent = user.platform_role || 'USER';
    document.getElementById('profile-status').textContent = user.status || 'ACTIVE';
    document.getElementById('profile-privacy').textContent = user.is_private ? 'Privado' : 'Público';
    document.getElementById('profile-created').textContent = user.created_at
        ? new Date(user.created_at).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'long', day: 'numeric',
        })
        : '—';
    document.getElementById('profile-updated').textContent = user.updated_at
        ? new Date(user.updated_at).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'long', day: 'numeric',
        })
        : '—';
    document.getElementById('profile-bio').textContent = user.bio || 'Aún no agregaste una biografía.';
    usernameInput.value = user.username || '';
    avatarInput.value = user.avatar_url || '';
    bioInput.value = user.bio || '';
    privateInput.checked = Boolean(user.is_private);
    avatarFallback.textContent = Array.from(username.trim())[0]?.toLocaleUpperCase() || 'Y';
    updateAvatarPreview(user.avatar_url);
    profileContent.setAttribute('aria-busy', 'false');
}

async function loadProfile() {
    if (!getAccessToken()) {
        goToLogin();
        return;
    }
    try {
        renderUser(await authRequest('/me'));
    } catch (error) {
        if (error.status === 401 || error.status === 400) {
            clearAccessToken();
            goToLogin();
            return;
        }
        profileContent.setAttribute('aria-busy', 'false');
        setMessage(error.message || 'No se pudo cargar tu perfil.');
    }
}

avatarInput.addEventListener('input', () => updateAvatarPreview(avatarInput.value));

profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) return;

    profileSubmit.disabled = true;
    profileSubmit.textContent = 'Guardando…';
    profileMessage.textContent = '';
    delete profileMessage.dataset.kind;
    try {
        const savedUser = await authRequest('/me', {
            method: 'PATCH',
            body: {
                username: usernameInput.value.trim(),
                avatar_url: avatarInput.value.trim(),
                bio: bioInput.value.trim(),
                is_private: privateInput.checked,
            },
        });
        const updatedUser = await authRequest('/me').catch(() => savedUser);
        renderUser(updatedUser);
        window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: updatedUser }));
        setMessage('Perfil actualizado.', 'success');
    } catch (error) {
        if (error.status === 401) {
            clearAccessToken();
            goToLogin();
            return;
        }
        setMessage(error.message || 'No se pudo guardar el perfil.');
    } finally {
        profileSubmit.disabled = false;
        profileSubmit.textContent = 'Guardar cambios';
    }
});

loadProfile();
