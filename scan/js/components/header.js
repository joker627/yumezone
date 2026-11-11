// Componente Reutilizable de Cabecera y Sidebar Lateral para Scan Studio (Cero SVG inline)
import { logoutUser } from '../shared/auth.js';
import { esc, formatNumber } from '../shared/ui-utils.js';

export function renderScanHeader(container, { currentUser, currentScan, activePage = 'dashboard', isLoading = false } = {}) {
    if (!container) return;

    const userInitial = (currentUser?.username || 'YZ').slice(0, 2).toUpperCase();
    const clanName = currentScan?.name || (isLoading ? 'Cargando...' : 'Sin Clan Asignado');
    const clanRole = currentScan?.role || (isLoading ? '...' : 'MIEMBRO');
    const clanLogo = currentScan?.logo_url || '../assets/icons/logo.png';
    const clanLevel = Number(currentScan?.clan_level || 1);
    const vaultTokens = formatNumber(currentScan?.vault_tokens || 0);
    const userAvatar = currentUser?.avatar_url
        ? `<img src="${esc(currentUser.avatar_url)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;">`
        : userInitial;

    container.innerHTML = `
        <!-- Backdrop del Sidebar -->
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

        <!-- Sidebar Lateral Desplegable -->
        <aside class="dash-sidebar" id="dash-sidebar" aria-label="Menú Lateral Studio">
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <img alt="YumeZone Logo" class="sidebar-logo" src="../assets/icons/logo.png">
                    <div>
                        <span class="sidebar-title">YumeScan Studio</span>
                        <span class="sidebar-subtitle">Panel Editorial</span>
                    </div>
                </div>
                <button class="btn-sidebar-close" id="sidebar-close-btn" type="button" aria-label="Cerrar barra lateral">
                    <img src="../assets/icons/svg/x.svg" class="icon-svg icon-md" alt="">
                </button>
            </div>

            <div class="sidebar-clan-card">
                <div class="sidebar-clan-avatar">
                    <img id="sidebar-clan-logo" src="${esc(clanLogo)}" alt="Clan" onerror="this.src='../assets/icons/logo.png'">
                </div>
                <div class="sidebar-clan-info">
                    <h4 id="sidebar-clan-name" class="sidebar-clan-title">${isLoading ? '<span class="is-loading is-loading--sm is-loading--w60"></span>' : esc(clanName)}</h4>
                    <div class="sidebar-clan-badges">
                        <span class="badge-tag-teal" id="sidebar-clan-role">${esc(clanRole)}</span>
                        ${currentScan?.id ? `<span class="badge-tag-gold" id="sidebar-clan-level">Nv. ${clanLevel}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="sidebar-scrollable-content">
                <div class="sidebar-nav-group">
                    <span class="sidebar-group-label">SECCIONES DEL PANEL</span>
                    <nav class="sidebar-nav">
                        <a class="sidebar-nav-link ${activePage === 'dashboard' ? 'active' : ''}" data-path="dashboard" href="dashboard.html">
                            <img src="../assets/icons/svg/home.svg" class="icon-svg icon-md" alt="">
                            <span>Dashboard & Perfil del Clan</span>
                        </a>
                        <a class="sidebar-nav-link ${activePage === 'obras-canvas' ? 'active' : ''}" data-path="obras-canvas" href="obras-canvas.html">
                            <img src="../assets/icons/svg/book.svg" class="icon-svg icon-md" alt="">
                            <span>Catálogo de Obras & Banners</span>
                        </a>
                        <a class="sidebar-nav-link ${activePage === 'subir-capitulos' ? 'active' : ''}" data-path="subir-capitulos" href="subir-capitulos.html">
                            <img src="../assets/icons/svg/arrow-up.svg" class="icon-svg icon-md" alt="">
                            <span>Subir Capítulos (.WEBP)</span>
                            <span class="sidebar-pill-badge">WebP</span>
                        </a>
                        <a class="sidebar-nav-link ${activePage === 'miembros-roles' ? 'active' : ''}" data-path="miembros-roles" href="miembros-roles.html">
                            <img src="../assets/icons/svg/community.svg" class="icon-svg icon-md" alt="">
                            <span>Equipo & Roles del Scan</span>
                        </a>
                        <a class="sidebar-nav-link ${activePage === 'donaciones-monedas' ? 'active' : ''}" data-path="donaciones-monedas" href="donaciones-monedas.html">
                            <img src="../assets/icons/svg/coin.svg" class="icon-svg icon-md" alt="">
                            <span>Bóveda, Metas & Borradores</span>
                        </a>
                    </nav>
                </div>

                <div class="sidebar-nav-group">
                    <span class="sidebar-group-label">ACCESOS RÁPIDOS</span>
                    <div class="sidebar-shortcuts">
                        <a href="obras-canvas.html" class="sidebar-shortcut-btn">
                            <img src="../assets/icons/svg/library.svg" class="icon-svg icon-sm" alt="">
                            <span>Gestionar Obras del Clan</span>
                        </a>
                        <a href="subir-capitulos.html" class="sidebar-shortcut-btn">
                            <img src="../assets/icons/svg/bolt.svg" class="icon-svg icon-sm" alt="">
                            <span>Publicar o Programar Capítulo</span>
                        </a>
                    </div>
                </div>
            </div>

            <div class="sidebar-footer">
                <div class="sidebar-user-block">
                    <div class="sidebar-user-avatar" id="sidebar-user-avatar">${userAvatar}</div>
                    <div class="sidebar-user-details">
                        <p class="sidebar-username" id="sidebar-username">${esc(currentUser?.username || 'Usuario')}</p>
                        <span class="sidebar-user-role" id="sidebar-user-role">${esc(clanRole)}</span>
                    </div>
                </div>
                <button class="sidebar-logout-btn" id="sidebar-logout-btn" type="button" title="Cerrar sesión">
                    <img src="../assets/icons/svg/logout.svg" class="icon-svg icon-sm" alt="Salir">
                </button>
            </div>
        </aside>

        <!-- Barra Superior Fija -->
        <div class="dash-header">
            <div class="dash-header-inner">
                <div class="dash-header-left">
                    <button class="btn-sidebar-toggle" id="sidebar-toggle-btn" type="button" aria-label="Abrir barra lateral" title="Menú Lateral">
                        <img src="../assets/icons/svg/menu.svg" class="icon-svg icon-md" alt="Menú">
                    </button>

                    <a class="dash-brand" href="dashboard.html">
                        <img alt="YumeZone Logo" class="dash-brand-logo" src="../assets/icons/logo.png">
                        <span class="dash-brand-title">Yume Zone Admin</span>
                    </a>
                    
                    <span class="dash-brand-badge">
                        <span class="pulse-dot"></span>
                        <span id="header-clan-status">${esc(clanName)}${currentScan?.id ? ' [Activo]' : ''}</span>
                    </span>
                </div>

                <div class="dash-header-actions">
                    <a href="donaciones-monedas.html" class="header-coins-pill" title="Bóveda del Clan (Cristales de Clan independientes)">
                        <img src="../assets/icons/svg/coin.svg" class="icon-svg icon-sm" alt="">
                        <span id="header-coins-count">${isLoading ? '...' : `${vaultTokens} Cristales`}</span>
                    </a>

                    <div class="dash-user-group">
                        <button class="dash-user-avatar-btn" id="user-menu-btn" type="button" title="Perfil de Usuario">
                            <div id="top-scan-avatar" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; color: #5ce2c0;">
                                ${userAvatar}
                            </div>
                        </button>
                        <div class="dash-dropdown">
                            <div class="dash-dropdown-header">
                                <p class="dash-dropdown-name" id="menu-scan-user">${esc(currentUser?.username || 'Usuario')}</p>
                                <p class="dash-dropdown-role" id="menu-scan-role">${esc(clanName)} • ${esc(clanRole)}</p>
                            </div>
                            <div style="padding-top: 0.35rem;">
                                <button id="btn-logout" class="btn-dropdown-logout" type="button">
                                    <img src="../assets/icons/svg/logout.svg" class="icon-svg icon-sm" alt="">
                                    <span>Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    initHeaderEvents();
}

export function initHeaderEvents() {
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    const openSidebar = () => document.body.classList.add('sidebar-open');
    const closeSidebar = () => document.body.classList.remove('sidebar-open');

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.body.classList.contains('sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userGroup = document.querySelector('.dash-user-group');
    if (userMenuBtn && userGroup) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userGroup.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!userGroup.contains(e.target)) {
                userGroup.classList.remove('open');
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }

    const sideLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sideLogoutBtn) {
        sideLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
}

export const initScanHeader = initHeaderEvents;
export function setActiveNavTab(currentHash) {
    const hash = (currentHash || '').replace('#', '') || 'dashboard';
    document.querySelectorAll('.sidebar-nav-link').forEach(a => {
        const path = a.getAttribute('data-path') || '';
        a.classList.toggle('active', path === hash);
    });
}
