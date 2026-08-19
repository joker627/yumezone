const getSidebarHTML = (theme) => `
    <aside class="sidebar">
        <div class="sidebar-logo" onclick="toggleSidebar()" title="Expandir/Contraer">
            <img src="/assets/icons/${theme}/panel-expand.svg" alt="Toggle Sidebar" width="28" height="28" class="toggle-icon">
        </div>
        <nav class="sidebar-nav">
            <a href="/" class="nav-item active" title="Inicio">
                <img src="/assets/icons/${theme}/home.svg" alt="Inicio" width="24" height="24">
            </a>
            <a href="#" class="nav-item" title="Biblioteca">
                <img src="/assets/icons/${theme}/library.svg" alt="Biblioteca" width="24" height="24">
            </a>
            <a href="#" class="nav-item" title="Historial">
                <img src="/assets/icons/${theme}/history.svg" alt="Historial" width="24" height="24">
            </a>
            <div class="nav-divider"></div>
            <a href="#" class="nav-item" title="Comunidad">
                <img src="/assets/icons/${theme}/community.svg" alt="Comunidad" width="24" height="24">
            </a>
            <a href="#" class="nav-item" title="Tienda">
                <img src="/assets/icons/${theme}/shop.svg" alt="Tienda" width="24" height="24">
            </a>
        </nav>
    </aside>
`;

const getTopbarHTML = (theme) => `
    <header class="topbar">
        <div style="display: flex; align-items: center; gap: 1.5rem;">
            <button class="icon-btn mobile-menu-btn" onclick="toggleSidebar()">
                <img src="/assets/icons/${theme}/menu.svg" alt="Menú" width="32" height="32">
            </button>
            <a href="/" class="topbar-logo" style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main); text-decoration: none; display: flex; align-items: center; letter-spacing: -0.5px;">
                Yume<span style="color: var(--primary);">Zone</span>
            </a>
            <div class="topbar-search">
                <img src="/assets/icons/${theme}/search.svg" alt="Buscar" width="24" height="24" class="search-icon">
                <input type="text" placeholder="Buscar..." class="search-input">
            </div>
        </div>
        
        <div class="topbar-actions">
            <button class="icon-btn" title="Alternar Tema" onclick="toggleTheme()">
                <img src="/assets/icons/${theme}/${theme === 'light' ? 'moon.svg' : 'sun.svg'}" alt="Tema" width="28" height="28" id="theme-icon">
            </button>
            <button class="icon-btn" title="Notificaciones" id="notification-btn" style="display: none;">
                <img src="/assets/icons/${theme}/bell.svg" alt="Notificaciones" width="28" height="28">
            </button>
            <div id="auth-section" class="user-profile">
                <!-- User Profile or Login btn will be injected here -->
            </div>
        </div>
    </header>
`;

function injectLayout() {
    const theme = localStorage.getItem('yumezone_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const sidebarRoot = document.getElementById('sidebar-root');
    const topbarRoot = document.getElementById('topbar-root');

    if (sidebarRoot) {
        sidebarRoot.innerHTML = getSidebarHTML(theme) + '<div class="sidebar-overlay" onclick="toggleSidebar()"></div>';
    }
    if (topbarRoot) {
        topbarRoot.style.position = 'sticky';
        topbarRoot.style.top = '0';
        topbarRoot.style.zIndex = '90';

        topbarRoot.innerHTML = getTopbarHTML(theme) + `
        <div style="background-color: rgba(170, 131, 14, 0.1); border-bottom: 1px solid #e39f08ff; color: #ffd208ff; text-align: center; padding: 8px; font-size: 0.85rem; display: flex; justify-content: center; align-items: center; gap: 8px; backdrop-filter: blur(10px);">
            <img src="/assets/icons/${theme}/warning.svg" alt="Aviso" width="16" height="16">
            <strong>Aviso:</strong> Estamos realizando cambios en la plataforma. Es posible que experimentes algunos problemas temporales.
        </div>`;
    }

    checkAuthStatus();
}

window.toggleTheme = function () {
    const currentTheme = localStorage.getItem('yumezone_theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('yumezone_theme', newTheme);
    window.location.reload();
}

window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.main-workspace');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (workspace) {
        workspace.classList.toggle('expanded');
    }
}

async function checkAuthStatus() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    const token = localStorage.getItem('yumezone_token');

    if (token) {
        authSection.innerHTML = `
            <div class="user-avatar" onclick="document.getElementById('user-dropdown').classList.toggle('show')">
                <img id="nav-user-avatar" src="https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff" alt="Perfil">
            </div>
            <div id="user-dropdown" class="user-dropdown">
                <div class="dropdown-header">
                    <span id="nav-user-name" class="dropdown-name">Cargando...</span>
                </div>
                <div class="dropdown-divider"></div>
                <a href="#" class="dropdown-item">Mi Perfil</a>
                <a href="#" class="dropdown-item">Ajustes</a>
                <div class="dropdown-divider"></div>
                <a href="#" class="dropdown-item" onclick="logout()" style="color: #ef4444;">Cerrar Sesión</a>
            </div>
        `;
        const notiBtn = document.getElementById('notification-btn');
        if (notiBtn) notiBtn.style.display = 'flex';

        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                const avatarEl = document.getElementById('nav-user-avatar');
                if (avatarEl) {
                    if (user.avatar_url) {
                        avatarEl.src = user.avatar_url;
                    } else if (user.username) {
                        const initials = (user.username.charAt(0) + user.username.charAt(user.username.length - 1)).toUpperCase();
                        avatarEl.src = `https://ui-avatars.com/api/?name=${initials}&background=7c3aed&color=fff`;
                    }
                }
                const nameEl = document.getElementById('nav-user-name');
                if (nameEl) nameEl.textContent = user.username;
            } else if (res.status === 401) {
                logout();
            }
        } catch (e) {
            console.error("Error cargando perfil", e);
        }
    } else {
        const theme = localStorage.getItem('yumezone_theme') || 'dark';
        authSection.innerHTML = `
            <div class="auth-buttons">
                <a href="/login.html" class="btn btn-sm auth-btn-login">
                    <img src="/assets/icons/${theme}/login.svg" alt="Login" width="24" height="24" class="auth-icon">
                    <span class="auth-btn-text">Entrar</span>
                </a>
                <a href="/register.html" class="btn btn-primary btn-sm auth-btn-register">
                    <img src="/assets/icons/${theme}/user-plus.svg" alt="Registrarse" width="24" height="24" class="auth-icon">
                    <span class="auth-btn-text">Registro</span>
                </a>
            </div>
        `;
        const notiBtn = document.getElementById('notification-btn');
        if (notiBtn) notiBtn.style.display = 'none';
    }
}

function logout() {
    localStorage.removeItem('yumezone_token');
    window.location.reload();
}

document.addEventListener('DOMContentLoaded', injectLayout);
