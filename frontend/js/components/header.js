import { authRequest, apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, escapeHTML, formatTimeAgo, applyDataProgress } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import { initPresence, disconnectPresence } from '../shared/presence.js';
import { renderSkeletonRows } from './loader.js';

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback si la API moderna es bloqueada o rechazada
    }
  }

  
  const textArea = document.createElement('textarea');
  textArea.className = 'header-clipboard-helper';
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  document.body.appendChild(textArea);
  textArea.select();
  textArea.setSelectionRange(0, 99999);

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!successful) {
      throw new Error('No se pudo copiar el texto');
    }
  } catch (err) {
    document.body.removeChild(textArea);
    throw err;
  }
}

/** Header global con menú y búsqueda en vivo del catálogo. */
export function renderSiteHeader(container) {
  if (!container) throw new Error('renderSiteHeader: container requerido.');

  container.innerHTML = `
    <nav id="navigation" class="header" aria-label="Navegación principal">
      <a id="brand" class="header-brand" href="/index.html">
        <img id="logo" class="header-logo" src="/assets/icons/logo.png" alt="YumeZone">
        <span class="header-brand-name">Yume<span>Zone</span></span>
      </a>

      <div id="search-container" class="header-search">
        <button id="search-toggle" class="header-search-toggle" type="button"
          aria-label="Abrir buscador" aria-expanded="false" aria-controls="search-panel">
          <img class="header-icon" src="/assets/icons/svg/search.svg" alt="" aria-hidden="true">
        </button>
        <div id="search-panel" class="header-search-panel" role="dialog"
          aria-label="Buscar obras" aria-hidden="true">
          <form id="search-form" class="header-search-form" action="/pages/catalogo.html" method="get" role="search">
            <input id="search-input" name="q" class="header-search-input" type="text"
              placeholder="Buscar obras o autores..." aria-label="Buscar obras o autores"
              aria-controls="search-suggestions" aria-expanded="false"
              aria-autocomplete="list" role="combobox"
              autocomplete="off" spellcheck="false">
            <button id="search-button" class="header-search-button" type="submit" aria-label="Ver obras">
              <img class="header-icon" src="/assets/icons/svg/search.svg" alt="" aria-hidden="true">
            </button>
            <button id="search-clear" class="header-search-clear" type="button"
              aria-label="Limpiar búsqueda" title="Limpiar búsqueda" hidden>
              <img src="/assets/icons/svg/clear.svg" alt="" aria-hidden="true">
            </button>
          </form>
          <div id="search-suggestions" class="header-search-suggestions"
            role="listbox" aria-label="Sugerencias de obras" hidden></div>
        </div>
      </div>

      <button id="menu-toggle" class="header-menu-toggle" type="button"
        aria-label="Abrir menú" aria-expanded="false" aria-controls="navigation-content">
        <img class="header-icon" src="/assets/icons/svg/menu.svg" alt="" aria-hidden="true">
      </button>

      <div class="header-menu-backdrop" data-menu-backdrop aria-hidden="true"></div>
      <div id="navigation-content" class="header-content">
        <!-- Panel de usuario y stats móviles (reemplaza logo redundante) -->
        <div id="drawer-user-section" class="header-drawer-user-section header-drawer-only">
          <div id="drawer-user-card" class="header-drawer-user-card" hidden>
            <div class="header-drawer-user-top">
              <div class="header-drawer-avatar-wrap">
                <span id="drawer-avatar-initials" class="header-drawer-initials">Y</span>
                <img id="drawer-avatar-img" class="header-drawer-avatar" alt="" hidden>
                <img id="drawer-avatar-frame" class="header-avatar-frame" alt="" hidden>
              </div>
              <div class="header-drawer-user-info">
                <div class="header-drawer-name-row">
                  <strong id="drawer-user-name" class="header-drawer-name-text">Usuario</strong>
                  <span id="drawer-user-role" class="header-drawer-role-badge">USER</span>
                </div>
                <span id="drawer-user-handle" class="header-drawer-handle">@usuario</span>
              </div>
            </div>

            <!-- Stats reales del usuario (Racha, Monedas, Nivel) visibles en móvil -->
            <div class="header-drawer-stats-row">
              <div class="header-drawer-stat-chip header-drawer-stat-chip--streak" title="Racha activa">
                <img src="/assets/icons/svg/fire.svg" alt="" width="14" height="14">
                <span id="drawer-streak-val">0d</span>
              </div>
              <div class="header-drawer-stat-chip header-drawer-stat-chip--coins" title="Ghost Monedas">
                <img src="/assets/icons/svg/coin.svg" alt="" width="14" height="14">
                <span id="drawer-coins-val">0 G</span>
              </div>
              <div class="header-drawer-stat-chip header-drawer-stat-chip--level" title="Nivel">
                <img src="/assets/icons/svg/star.svg" alt="" width="14" height="14">
                <span id="drawer-level-val">Nv. 1</span>
              </div>
            </div>

            <div class="header-drawer-xp-wrap">
              <div class="header-drawer-xp-bar">
                <div id="drawer-xp-fill" class="header-drawer-xp-fill"></div>
              </div>
              <span id="drawer-xp-label" class="header-drawer-xp-text">0 / 1000 XP</span>
            </div>
          </div>

          <div id="drawer-guest-box" class="header-drawer-guest-box" hidden>
            <p class="header-drawer-guest-title">Únete a YumeZone</p>
            <p class="header-drawer-guest-desc">Sincroniza tus lecturas y racha diaria.</p>
            <div class="header-drawer-guest-btns">
              <a href="/pages/login.html" class="header-drawer-btn header-drawer-btn--primary">Iniciar sesión</a>
              <a href="/pages/registro.html" class="header-drawer-btn header-drawer-btn--ghost">Registro</a>
            </div>
          </div>
        </div>

        <div id="navigation-links" class="header-links">
          <a id="home-link" class="header-link" href="/index.html">Inicio</a>
          <a id="explore-link" class="header-link" href="/pages/catalogo.html">Catálogo</a>
          <a id="novedades-link" class="header-link" href="/pages/novedades.html">Novedades</a>
          <a id="ranking-link" class="header-link" href="/pages/ranking.html">Ranking</a>
          <a id="comunidad-link" class="header-link" href="/pages/comunidad.html">Comunidad</a>
        </div>
      </div>

      <div id="guest-actions" class="header-guest-actions" data-auth-state="pending" hidden>
        <a id="login-link" class="header-action" href="/pages/login.html">Entrar</a>
        <a id="signup-link" class="header-action header-action-primary" href="/pages/registro.html">
          Registro
        </a>
      </div>

      <div id="user-actions" class="header-actions" data-auth-state="pending" hidden>
        <div class="header-user-stats" id="header-user-stats" hidden>
          <div class="header-stat-wrapper" id="header-stat-wrapper">
            <button type="button" class="header-stat-pill" id="header-stat-pill" aria-label="Abrir panel de progreso y misiones" aria-expanded="false" aria-controls="stats-dropdown-menu">
              <span class="header-stat-chip header-stat-chip--streak" title="Racha activa">
                <img src="/assets/icons/svg/fire.svg" class="header-stat-icon" alt="">
                <span id="header-streak">0d</span>
              </span>
              <span class="header-stat-sep">|</span>
              <span class="header-stat-chip header-stat-chip--coins" title="Ghost Monedas">
                <img src="/assets/icons/svg/coin.svg" class="header-stat-icon" alt="" width="14" height="14">
                <span id="header-coins">0 G</span>
              </span>
              <span class="header-stat-sep">|</span>
              <span class="header-stat-chip header-stat-chip--level" title="Nivel y progreso">
                <span id="header-level">Nv. 1</span>
                <span id="header-xp-pct" class="header-stat-pct">0%</span>
              </span>
              <img class="header-stat-chevron" width="10" height="10" src="/assets/icons/svg/chevron-down.svg" alt="" aria-hidden="true">
            </button>

            <!-- Dropdown flotante de gamificación y misiones -->
            <div id="stats-dropdown-menu" class="header-stats-dropdown" role="menu" aria-label="Panel de Progreso y Misiones" hidden>
              <!-- Cabecera de Nivel -->
              <div class="header-stats-dd-head">
                <div class="header-stats-dd-level-badge" id="stats-dd-level-badge">Nv. 1</div>
                <div class="header-stats-dd-level-info">
                  <div class="header-stats-dd-level-title" id="stats-dd-level-title">Lector Novato</div>
                  <div class="header-stats-dd-xp-label" id="stats-dd-xp-label">0 / 1000 XP</div>
                </div>
              </div>
              
              <div class="header-stats-dd-bar-wrap">
                <div class="header-stats-dd-bar">
                  <div class="header-stats-dd-bar-fill" id="stats-dd-bar-fill"></div>
                </div>
                <div class="header-stats-dd-bar-sub" id="stats-dd-xp-remaining">Faltan 1000 XP para el Nivel 2</div>
              </div>

              <!-- Cuadrícula Racha & Monedas -->
              <div class="header-stats-dd-grid">
                <div class="header-stats-dd-card">
                  <div class="header-stats-dd-card-top">
                    <img src="/assets/icons/svg/fire.svg" alt="" width="14" height="14">
                    <span class="header-stats-dd-card-label">Racha Activa</span>
                  </div>
                  <div class="header-stats-dd-card-val" id="stats-dd-streak-val">0 días</div>
                  <div class="header-stats-dd-card-hint" id="stats-dd-streak-hint">Lee diario para mantenerla</div>
                </div>

                <div class="header-stats-dd-card">
                  <div class="header-stats-dd-card-top">
                    <img src="/assets/icons/svg/coin.svg" alt="" width="14" height="14">
                    <span class="header-stats-dd-card-label">Ghost Monedas</span>
                  </div>
                  <div class="header-stats-dd-card-val" id="stats-dd-coins-val">0 G</div>
                  <div class="header-stats-dd-card-hint">Gana completando misiones</div>
                </div>
              </div>

              <!-- Sección Misiones Diarias del Dropdown -->
              <div class="header-stats-dd-missions-wrap">
                <div class="header-stats-dd-missions-header">
                  <div class="header-stats-dd-missions-title">
                    <img src="/assets/icons/svg/star.svg" alt="" width="14" height="14">
                    <span>Misiones Diarias</span>
                  </div>
                  <span class="header-stats-dd-badge" id="stats-dd-missions-summary"><span class="is-loading is-loading--xs"></span></span>
                </div>
                <div class="header-stats-dd-missions-list" id="stats-dd-missions-list">
                  ${renderSkeletonRows(3)}
                </div>
              </div>

              <!-- Footer con accesos -->
              <div class="header-stats-dd-footer">
                <a href="/pages/catalogo.html" class="header-stats-dd-footer-link">
                  <img src="/assets/icons/svg/book.svg" alt="" width="14" height="14">
                  <span>Explorar Catálogo</span>
                </a>
                <a href="/#aside-mision-title" class="header-stats-dd-footer-link header-stats-dd-footer-link--accent" id="stats-dd-go-missions">Ver Misiones Diarias →</a>
              </div>
            </div>
          </div>
          <div class="header-bell-wrapper">
            <button id="header-bell" class="header-bell" aria-label="Notificaciones" aria-expanded="false" aria-controls="notifications-menu">
              <img src="/assets/icons/svg/bell.svg" alt="" aria-hidden="true">
              <span id="bell-dot" class="header-bell-badge" hidden>0</span>
            </button>
            <div id="notifications-menu" class="header-notifications-menu" role="menu" aria-label="Notificaciones" hidden>
              <div class="header-notifications-header">
                <h3>Notificaciones</h3>
                <div class="header-notifications-actions">
                  <button type="button" id="notifications-read-all" class="header-notifications-readall" hidden>Marcar todo leído</button>
                  <button type="button" id="notifications-clear-all" class="header-notifications-clearall" hidden>Limpiar</button>
                </div>
              </div>
              <div id="notifications-list" class="header-notifications-list">
                <div class="header-notifications-empty">No hay notificaciones</div>
              </div>
            </div>
          </div>
        </div>

        <div id="header-profile" class="header-profile" hidden>
          <button id="profile-toggle" class="header-profile-toggle" type="button"
            aria-label="Abrir menú de perfil" aria-expanded="false" aria-controls="profile-menu">
            <div class="header-avatar-ring">
              <span id="profile-initials" class="header-profile-initials" aria-hidden="true">Y</span>
              <img id="profile-avatar" class="header-profile-avatar" alt="" hidden>
              <img id="profile-avatar-frame" class="header-avatar-frame" alt="" hidden>
              <span class="header-avatar-status"></span>
            </div>
          </button>
          <div id="profile-menu" class="header-profile-menu" role="menu"
            aria-label="Menú de perfil" hidden>
            <div class="header-profile-card">
              <div class="header-profile-card-top">
                <div class="header-profile-avatar-thumb">
                  <span id="profile-card-initials" class="header-profile-card-initials">Y</span>
                  <img id="profile-card-avatar" class="header-profile-card-avatar" alt="" hidden>
                  <img id="profile-card-avatar-frame" class="header-avatar-frame" alt="" hidden>
                </div>
                <div class="header-profile-user-texts">
                  <div class="header-profile-name-row">
                    <strong id="profile-menu-name" class="header-profile-name"></strong>
                    <span id="profile-menu-role" class="header-profile-badge">USER</span>
                  </div>
                  <span id="profile-menu-email" class="header-profile-email"></span>
                </div>
              </div>

              <!-- Selector interactivo de Identificador: Alterna entre @Usuario e ID + botón de Copiar -->
              <div class="header-profile-id-box">
                <button id="toggle-ident-mode" class="header-profile-ident-pill" type="button"
                  title="Clic para alternar entre @Usuario e ID de usuario" aria-label="Modo actual: @Usuario. Clic para cambiar a ID">
                  <span id="ident-badge" class="header-profile-ident-tag">@USER</span>
                  <span id="profile-menu-id" class="header-profile-id-val">@usuario</span>
                  <span class="header-profile-swap-icon" aria-hidden="true" title="Alternar">
                    <img src="/assets/icons/svg/swap.svg" class="header-profile-swap-icon-img" alt="" aria-hidden="true">
                  </span>
                </button>
                <button id="copy-profile-id" class="header-profile-copy-btn" type="button"
                  aria-label="Copiar identificador al portapapeles" title="Copiar al portapapeles">
                  <span class="header-profile-copy-icon-wrap" aria-hidden="true">
                    <img src="/assets/icons/svg/copy.svg" class="header-copy-icon-default" alt="" aria-hidden="true">
                    <img src="/assets/icons/svg/check.svg" class="header-copy-icon-check" alt="" aria-hidden="true">
                  </span>
                  <span id="copy-btn-text" class="header-profile-copy-text">Copiar</span>
                </button>
              </div>
            </div>

            <div class="header-profile-links">
              <a href="/pages/usuario.html" id="header-public-profile-link" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/user.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Mi perfil público</span>
              </a>
              <a href="/pages/tienda.html" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/shop.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Tienda</span>
              </a>
              <a href="/pages/biblioteca.html" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/library.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Mi biblioteca</span>
              </a>
              <a href="/pages/usuario.html?edit=1" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/settings.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Ajustes de cuenta</span>
              </a>
            </div>

            <button id="logout-button" class="header-profile-logout" type="button" role="menuitem">
              <img src="/assets/icons/svg/logout.svg" alt="" aria-hidden="true">
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
  container.removeAttribute('aria-busy');

  /* Referencias DOM */
  const menuToggle = document.getElementById('menu-toggle');
  const navigationContent = document.getElementById('navigation-content');
  const menuBackdrop = container.querySelector('[data-menu-backdrop]');
  const navigationLinks = container.querySelectorAll('.header-link');
  const searchToggle = document.getElementById('search-toggle');
  const searchPanel = document.getElementById('search-panel');
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const searchSuggestions = document.getElementById('search-suggestions');
  const searchButton = document.getElementById('search-button');
  const searchClear = document.getElementById('search-clear');
  const loginLink = document.getElementById('login-link');
  const signupLink = document.getElementById('signup-link');
  const guestActions = document.getElementById('guest-actions');
  const userActions = document.getElementById('user-actions');
  const headerUserStats = document.getElementById('header-user-stats');
  const headerStreak = document.getElementById('header-streak');
  const headerCoins = document.getElementById('header-coins');
  const headerLevel = document.getElementById('header-level');
  const headerXpBar = document.getElementById('header-xp-bar');
  const headerXpPct = document.getElementById('header-xp-pct');
  const headerStatWrapper = document.getElementById('header-stat-wrapper');
  const headerStatPill = document.getElementById('header-stat-pill');
  const statsDropdownMenu = document.getElementById('stats-dropdown-menu');
  const statsDdLevelBadge = document.getElementById('stats-dd-level-badge');
  const statsDdLevelTitle = document.getElementById('stats-dd-level-title');
  const statsDdXpLabel = document.getElementById('stats-dd-xp-label');
  const statsDdBarFill = document.getElementById('stats-dd-bar-fill');
  const statsDdXpRemaining = document.getElementById('stats-dd-xp-remaining');
  const statsDdStreakVal = document.getElementById('stats-dd-streak-val');
  const statsDdCoinsVal = document.getElementById('stats-dd-coins-val');
  const statsDdMissionsSummary = document.getElementById('stats-dd-missions-summary');
  const statsDdMissionsList = document.getElementById('stats-dd-missions-list');
  const profileRoot = document.getElementById('header-profile');
  const profileToggle = document.getElementById('profile-toggle');
  const avatarRing = container.querySelector('.header-avatar-ring');
  const profileMenu = document.getElementById('profile-menu');
  const profileInitials = document.getElementById('profile-initials');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-menu-name');
  const profileHandle = document.getElementById('profile-menu-handle');
  const profileEmail = document.getElementById('profile-menu-email');
  const profileRole = document.getElementById('profile-menu-role');
  const profileUserId = document.getElementById('profile-menu-id');
  const toggleIdentMode = document.getElementById('toggle-ident-mode');
  const identBadge = document.getElementById('ident-badge');
  const profileCardAvatar = document.getElementById('profile-card-avatar');
  const profileCardInitials = document.getElementById('profile-card-initials');
  const copyProfileId = document.getElementById('copy-profile-id');
  const copyBtnText = document.getElementById('copy-btn-text');
  const publicProfileLink = document.getElementById('header-public-profile-link');
  const logoutButton = document.getElementById('logout-button');
  const bellToggle = document.getElementById('header-bell');
  const bellDot = document.getElementById('bell-dot');
  const notificationsMenu = document.getElementById('notifications-menu');
  const notificationsList = document.getElementById('notifications-list');
  const notificationsReadAll = document.getElementById('notifications-read-all');
  const notificationsClearAll = document.getElementById('notifications-clear-all');
  const bellWrapper = container.querySelector('.header-bell-wrapper');

  // Drawer referencias DOM (móvil)
  const drawerUserCard = document.getElementById('drawer-user-card');
  const drawerGuestBox = document.getElementById('drawer-guest-box');
  const drawerAvatarImg = document.getElementById('drawer-avatar-img');
  const drawerAvatarInitials = document.getElementById('drawer-avatar-initials');
  const drawerUserName = document.getElementById('drawer-user-name');
  const drawerUserHandle = document.getElementById('drawer-user-handle');
  const drawerUserRole = document.getElementById('drawer-user-role');
  const drawerStreakVal = document.getElementById('drawer-streak-val');
  const drawerCoinsVal = document.getElementById('drawer-coins-val');
  const drawerLevelVal = document.getElementById('drawer-level-val');
  const drawerXpFill = document.getElementById('drawer-xp-fill');
  const drawerXpLabel = document.getElementById('drawer-xp-label');

  // Referencias a los marcos del anillo (avatar frames)
  const profileAvatarFrame = document.getElementById('profile-avatar-frame');
  const profileCardAvatarFrame = document.getElementById('profile-card-avatar-frame');
  const drawerAvatarFrame = document.getElementById('drawer-avatar-frame');

  if (!menuToggle || !navigationContent || !menuBackdrop ||
    !searchToggle || !searchPanel || !searchInput || !searchForm ||
    !searchSuggestions || !searchButton || !searchClear || !loginLink || !signupLink ||
    !guestActions || !userActions || !headerUserStats ||
    !profileRoot || !profileToggle || !profileMenu || !profileInitials ||
    !profileAvatar || !profileName || !profileEmail || !profileRole ||
    !profileUserId || !copyProfileId || !logoutButton || !bellToggle) {
    throw new Error('Header: estructura del DOM incompleta.');
  }

  /* Estado */
  let menuOpenScrollY = 0;
  let searchDebounceTimer = null;
  let searchController = null;
  let searchRequestId = 0;
  let profileUser = null;
  let destroyed = false;
  let notificationsLoaded = false;
  let activeIdentMode = 'username'; // 'username' | 'id'
  const profileController = new AbortController();

  const ICONS = {
    menu: '/assets/icons/svg/menu.svg',
    close: '/assets/icons/svg/x.svg',
    notification: '/assets/icons/svg/bell.svg',
    system: '/assets/icons/svg/info.svg',
    success: '/assets/icons/svg/check.svg',
  };

  /* MENÚ MÓVIL */
  function isMenuOpen() {
    return navigationContent.classList.contains('header-content-open');
  }

  function openMenu() {
    menuOpenScrollY = window.scrollY;
    navigationContent.classList.add('header-content-open');
    menuBackdrop.classList.add('header-menu-backdrop-visible');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Cerrar menú');
    const img = menuToggle.querySelector('img');
    if (img) img.src = ICONS.close;
    document.body.classList.add('menu-open');
  }

  function closeMenu({ returnFocus = false } = {}) {
    if (!isMenuOpen()) return;
    navigationContent.classList.remove('header-content-open');
    menuBackdrop.classList.remove('header-menu-backdrop-visible');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    const img = menuToggle.querySelector('img');
    if (img) img.src = ICONS.menu;
    document.body.classList.remove('menu-open');
    if (returnFocus) menuToggle.focus();
  }

  function toggleMenu() {
    isMenuOpen() ? closeMenu() : openMenu();
  }

  /* BUSCADOR */
  function isSearchOpen() {
    return searchPanel.classList.contains('header-search-panel-open');
  }

  function openSearch() {
    searchPanel.classList.add('header-search-panel-open');
    searchPanel.setAttribute('aria-hidden', 'false');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchToggle.setAttribute('aria-label', 'Cerrar buscador');
    searchClear.hidden = !searchInput.value;
    // Esperamos al frame para que la animación no corte el focus
    requestAnimationFrame(() => searchInput.focus());
    if (searchInput.value.trim()) queueSuggestions();
  }

  function closeSearch({ returnFocus = false } = {}) {
    if (!isSearchOpen()) return;
    clearSearchRequest();
    hideSuggestions();
    searchPanel.classList.remove('header-search-panel-open');
    searchPanel.setAttribute('aria-hidden', 'true');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.setAttribute('aria-label', 'Abrir buscador');
    if (returnFocus) searchToggle.focus();
  }

  function toggleSearch() {
    isSearchOpen() ? closeSearch({ returnFocus: true }) : openSearch();
  }

  function buildSearchUrl(query = '') {
    const url = new URL('/pages/catalogo.html', window.location.origin);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === url.pathname) {
      url.search = currentUrl.search;
    }
    const cleanQuery = (query || '').trim();
    if (cleanQuery) {
      url.searchParams.set('q', cleanQuery);
    } else {
      url.searchParams.delete('q');
    }
    url.searchParams.delete('all');
    url.searchParams.set('page', '1');
    return url;
  }

  function submitSearch(event) {
    event?.preventDefault();
    const query = searchInput.value.trim();
    const targetUrl = buildSearchUrl(query);

    // Si ya estamos en catalogo.html, actualizamos sin recarga y disparamos popstate instantáneo
    if (window.location.pathname.endsWith('/catalogo.html') || window.location.pathname.endsWith('/catalogo')) {
      window.history.pushState({}, '', `${targetUrl.pathname}${targetUrl.search}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      closeSearch();
      return;
    }

    window.location.assign(targetUrl.href);
  }

  function clearSearchRequest() {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    searchRequestId += 1;
    searchController?.abort();
    searchController = null;
  }

  function hideSuggestions() {
    searchSuggestions.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  }

  function showSuggestions() {
    searchSuggestions.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  }

  function setSuggestionStatus(message, isError = false) {
    const status = document.createElement('p');
    status.className = `header-search-status${isError ? ' header-search-status-error' : ''}`;
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.textContent = message;
    searchSuggestions.replaceChildren(status);
    showSuggestions();
  }

  function getWorkUrl(work) {
    if (work.slug) return `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
    return buildSearchUrl(work.title || '').href;
  }

  function getUserUrl(user) {
    return `/pages/usuario.html?id=${encodeURIComponent(user.username || user.user_code)}`;
  }

  function createSuggestion(item, index, isUser = false) {
    const link = document.createElement('a');
    link.className = 'header-search-suggestion';
    link.href = isUser ? getUserUrl(item) : getWorkUrl(item);
    link.id = `search-suggestion-${index}`;
    link.setAttribute('role', 'option');
    link.setAttribute('aria-selected', 'false');

    if (isUser && !item.avatar_url) {
       const initial = document.createElement('span');
       initial.className = 'header-search-suggestion-initials';
       initial.textContent = (item.username || 'U').substring(0, 2).toUpperCase();
       link.append(initial);
    } else {
       const cover = document.createElement('img');
       cover.className = isUser ? 'header-search-suggestion-avatar' : 'header-search-suggestion-cover';
       cover.src = safeUrl(isUser ? item.avatar_url : item.cover_url, IMG_FALLBACK);
       cover.alt = '';
       cover.loading = 'lazy';
       link.append(cover);
    }

    const copy = document.createElement('span');
    copy.className = 'header-search-suggestion-copy';
    const title = document.createElement('span');
    title.className = 'header-search-suggestion-title';
    title.textContent = isUser ? (item.username || 'Usuario') : (item.title || 'Obra sin título');
    copy.append(title);

    const details = isUser 
       ? [(item.user_code ? `ID: ${item.user_code}` : null)] 
       : [item.alternative_title, item.author];
       
    const filteredDetails = details.filter((value, idx, values) => value && values.indexOf(value) === idx).slice(0, 2);
    if (filteredDetails.length) {
      const subtitle = document.createElement('span');
      subtitle.className = 'header-search-suggestion-meta';
      subtitle.textContent = filteredDetails.join(' · ');
      copy.append(subtitle);
    }

    link.append(copy);
    return link;
  }

  function queueSuggestions() {
    window.clearTimeout(searchDebounceTimer);
    searchController?.abort();
    const query = searchInput.value.trim();
    if (!query) {
      searchSuggestions.replaceChildren();
      hideSuggestions();
      return;
    }
    if (query.length < 2) {
      setSuggestionStatus('Escribe un carácter más para buscar.');
      return;
    }

    const isUserSearch = query.startsWith('@');
    const actualQuery = isUserSearch ? query.substring(1).trim() : query;
    if (isUserSearch && actualQuery.length < 1) {
       setSuggestionStatus('Escribe el nombre del usuario después de @.');
       return;
    }

    const requestId = ++searchRequestId;
    setSuggestionStatus(isUserSearch ? 'Buscando usuarios…' : 'Buscando en todo el catálogo…');
    searchDebounceTimer = window.setTimeout(async () => {
      const controller = new AbortController();
      searchController = controller;
      
      const endpoint = isUserSearch 
        ? `/users/search?q=${encodeURIComponent(actualQuery)}` 
        : `/works/?q=${encodeURIComponent(actualQuery)}&per_page=7`;

      try {
        const result = await apiRequest(endpoint, {
          signal: controller.signal,
        });
        if (requestId !== searchRequestId || query !== searchInput.value.trim()) return;

        const items = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        if (!items.length) {
          setSuggestionStatus(isUserSearch ? 'No se encontraron usuarios.' : 'No encontramos obras con esa búsqueda.');
          return;
        }

        const options = items.map((item, index) => createSuggestion(item, index, isUserSearch));
        
        let footer = null;
        if (!isUserSearch) {
            footer = document.createElement('a');
            footer.className = 'header-search-all';
            footer.href = buildSearchUrl(actualQuery).href;
            const total = Number(result.pagination?.items?.total ?? items.length);
            footer.textContent = `Ver ${total} ${total === 1 ? 'obra' : 'obras'}`;
            footer.setAttribute('role', 'option');
            footer.setAttribute('aria-selected', 'false');
        }
        
        if (footer) {
           searchSuggestions.replaceChildren(...options, footer);
        } else {
           searchSuggestions.replaceChildren(...options);
        }
        showSuggestions();
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== searchRequestId) return;
        console.error('[search] No se pudieron cargar las sugerencias:', error);
        setSuggestionStatus('No se pudo conectar con el buscador.', true);
      }
    }, 220);
  }

  function closeProfileMenu({ returnFocus = false } = {}) {
    profileMenu.hidden = true;
    profileToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) profileToggle.focus();
  }

  function toggleProfileMenu() {
    const isOpen = !profileMenu.hidden;
    profileMenu.hidden = isOpen;
    profileToggle.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) closeNotificationsMenu();
  }

  function updateIdentDisplay() {
    if (!profileUser) return;
    const isUserMode = activeIdentMode === 'username';
    const userVal = profileUser.username ? `@${profileUser.username}` : (profileUser.user_code ? `@${profileUser.user_code}` : '@usuario');
    const idVal = profileUser.user_code || '---';

    if (identBadge) {
      identBadge.textContent = isUserMode ? '@USER' : 'ID';
      identBadge.classList.toggle('mode-id', !isUserMode);
    }
    if (profileUserId) {
      profileUserId.textContent = isUserMode ? userVal : idVal;
      profileUserId.title = isUserMode ? userVal : idVal;
    }
    if (toggleIdentMode) {
      toggleIdentMode.setAttribute(
        'aria-label',
        isUserMode ? 'Modo actual: @Usuario. Clic para cambiar a ID' : 'Modo actual: ID. Clic para cambiar a @Usuario'
      );
      toggleIdentMode.title = isUserMode ? 'Clic para mostrar ID de usuario' : 'Clic para mostrar @Usuario';
    }
  }

  function onToggleIdentMode() {
    activeIdentMode = activeIdentMode === 'username' ? 'id' : 'username';
    updateIdentDisplay();
  }

  /* NOTIFICACIONES */
  let currentUnreadCount = 0;

  function updateBellBadge(count) {
    currentUnreadCount = Math.max(0, count);
    if (!bellDot) return;
    if (currentUnreadCount > 0) {
      bellDot.textContent = currentUnreadCount > 99 ? '99+' : String(currentUnreadCount);
      bellDot.hidden = false;
      bellDot.classList.remove('pop-in');
      void bellDot.offsetWidth;
      bellDot.classList.add('pop-in');
    } else {
      bellDot.hidden = true;
      bellDot.textContent = '0';
    }
  }

  function getNotificationIconHtml(type) {
    const normType = (type || 'system').toLowerCase();
    if (normType === 'chapter' || normType === 'manga' || normType === 'obra') {
      return `
        <div class="header-notification-icon type-chapter" aria-hidden="true">
          <img src="/assets/icons/svg/book.svg" width="16" height="16" alt="">
        </div>
      `;
    }
    if (normType === 'reward') {
      return `
        <div class="header-notification-icon type-reward" aria-hidden="true">
          <img src="/assets/icons/svg/award.svg" width="16" height="16" alt="">
        </div>
      `;
    }
    if (normType === 'level') {
      return `
        <div class="header-notification-icon type-level" aria-hidden="true">
          <img src="/assets/icons/svg/star.svg" width="16" height="16" alt="">
        </div>
      `;
    }
    if (normType === 'streak') {
      return `
        <div class="header-notification-icon type-streak" aria-hidden="true">
          <img src="/assets/icons/svg/fire.svg" width="16" height="16" alt="">
        </div>
      `;
    }
    if (normType === 'comment' || normType === 'reply' || normType === 'chat' || normType.includes('chat_') || normType.includes('mention')) {
      return `
        <div class="header-notification-icon type-comment" aria-hidden="true">
          <img src="/assets/icons/svg/comment.svg" width="16" height="16" alt="">
        </div>
      `;
    }
    // Default system / announcement
    return `
      <div class="header-notification-icon type-system" aria-hidden="true">
        <img src="/assets/icons/svg/info.svg" width="16" height="16" alt="">
      </div>
    `;
  }

  function getEmptyNotificationsHtml() {
    return `
      <div class="header-notifications-empty">
        <div class="header-notifications-empty-icon" aria-hidden="true">
          <img src="/assets/icons/svg/bell.svg" width="22" height="22" alt="">
        </div>
        <p class="header-notifications-empty-title">¡Estás al día!</p>
        <p class="header-notifications-empty-desc">No tienes notificaciones pendientes.</p>
      </div>
    `;
  }

  function closeNotificationsMenu() {
    notificationsMenu.hidden = true;
    bellToggle.setAttribute('aria-expanded', 'false');
  }

  async function loadNotifications() {
    try {
      const response = await apiRequest('/notifications/?unread_only=true');
      const items = response?.data || [];
      const count = response?.unread_count ?? items.length;
      
      updateBellBadge(count);

      if (notificationsReadAll) notificationsReadAll.hidden = items.length === 0;
      if (notificationsClearAll) notificationsClearAll.hidden = items.length === 0;

      if (items.length === 0) {
        notificationsList.innerHTML = getEmptyNotificationsHtml();
        return;
      }

      notificationsList.innerHTML = '';
      items.forEach(item => {
        let payload = item.payload;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = { title: payload };
          }
        }
        payload = payload || {};

        const title = payload.title || payload.message || payload.text || 'Notificación';
        const desc = payload.body || payload.description || (payload.title && payload.message && payload.title !== payload.message ? payload.message : '');
        const timeAgo = formatTimeAgo(item.created_at);

        // Resolver posible URL destino para mejorar el flujo de navegación
        let targetUrl = payload.url || payload.link || null;
        if (!targetUrl && payload.work_slug) {
          targetUrl = `/pages/obra.html?slug=${encodeURIComponent(payload.work_slug)}`;
        } else if (!targetUrl && payload.chapter_id) {
          targetUrl = `/pages/lector.html?id=${encodeURIComponent(payload.chapter_id)}`;
        }

        const itemEl = document.createElement('div');
        itemEl.className = `header-notification-item unread${targetUrl ? ' has-link' : ''}`;
        itemEl.setAttribute('role', 'menuitem');
        if (targetUrl) {
          itemEl.setAttribute('title', 'Clic para ver el contenido');
        }

        const iconHtml = getNotificationIconHtml(item.type);

        itemEl.innerHTML = `
          ${iconHtml}
          <div class="header-notification-content">
            <span class="header-notification-title">${escapeHTML(title)}</span>
            ${desc ? `<span class="header-notification-desc">${escapeHTML(desc)}</span>` : ''}
            <span class="header-notification-time">
              <span>${escapeHTML(timeAgo)}</span>
              ${targetUrl ? `<span class="header-notification-link-tag">· Ver →</span>` : ''}
            </span>
          </div>
          <button type="button" class="header-notification-dismiss" title="Descartar notificación" aria-label="Descartar notificación">
            <img src="/assets/icons/svg/x.svg" width="14" height="14" alt="" aria-hidden="true">
          </button>
        `;

        const dismissBtn = itemEl.querySelector('.header-notification-dismiss');
        const removeWithAnimation = () => {
          itemEl.classList.add('removing');
          updateBellBadge(currentUnreadCount - 1);
          window.setTimeout(() => {
            itemEl.remove();
            const remaining = notificationsList.querySelectorAll('.header-notification-item');
            if (remaining.length === 0) {
              updateBellBadge(0);
              if (notificationsReadAll) notificationsReadAll.hidden = true;
              if (notificationsClearAll) notificationsClearAll.hidden = true;
              notificationsList.innerHTML = getEmptyNotificationsHtml();
            }
          }, 200);
        };

        // Al hacer clic en la X de descartar: se elimina directamente
        dismissBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          removeWithAnimation();
          try {
            await apiRequest(`/notifications/${item.id}`, { method: 'DELETE' });
          } catch {
            await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => {});
          }
        });

        // Al hacer clic en el cuerpo de la notificación: se elimina y navega al contenido
        itemEl.addEventListener('click', async (e) => {
          if (e.target.closest('.header-notification-dismiss')) return;

          removeWithAnimation();
          try {
            await apiRequest(`/notifications/${item.id}`, { method: 'DELETE' });
          } catch {
            await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => {});
          }

          if (targetUrl) {
            closeNotificationsMenu();
            window.location.assign(targetUrl);
          }
        });

        notificationsList.appendChild(itemEl);
      });
      notificationsLoaded = true;
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      notificationsList.innerHTML = '<div class="header-notifications-empty">Error al cargar notificaciones</div>';
    }
  }

  function toggleNotificationsMenu() {
    const isOpen = !notificationsMenu.hidden;
    if (isOpen) {
      closeNotificationsMenu();
    } else {
      notificationsMenu.hidden = false;
      bellToggle.setAttribute('aria-expanded', 'true');
      closeProfileMenu();
      if (!notificationsLoaded) {
        notificationsList.innerHTML = renderSkeletonRows(4);
      }
      loadNotifications();
    }
  }

  async function markAllNotificationsRead() {
    const items = notificationsList.querySelectorAll('.header-notification-item');
    items.forEach(el => el.classList.add('removing'));
    updateBellBadge(0);
    if (notificationsReadAll) notificationsReadAll.hidden = true;
    if (notificationsClearAll) notificationsClearAll.hidden = true;
    window.setTimeout(() => {
      notificationsList.innerHTML = getEmptyNotificationsHtml();
    }, 200);

    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
    } catch (error) {
      console.warn('Error al marcar todas las notificaciones como leídas:', error);
    }
  }

  async function clearAllNotifications() {
    const items = notificationsList.querySelectorAll('.header-notification-item');
    items.forEach(el => el.classList.add('removing'));
    updateBellBadge(0);
    if (notificationsReadAll) notificationsReadAll.hidden = true;
    if (notificationsClearAll) notificationsClearAll.hidden = true;
    window.setTimeout(() => {
      notificationsList.innerHTML = getEmptyNotificationsHtml();
    }, 200);

    try {
      await apiRequest('/notifications/', { method: 'DELETE' });
    } catch {
      await apiRequest('/notifications/read-all', { method: 'PATCH' }).catch(() => {});
    }
  }

  function showGuestActions() {
    loginLink.hidden = false;
    signupLink.hidden = false;
    profileRoot.hidden = true;
    headerUserStats.hidden = true;
    guestActions.hidden = false;
    guestActions.dataset.authState = 'ready';
    userActions.dataset.authState = 'guest';
    userActions.hidden = true;

    // Actualizar Drawer móvil para invitado
    if (drawerUserCard) drawerUserCard.hidden = true;
    if (drawerGuestBox) drawerGuestBox.hidden = false;

    // Ocultar marcos de avatar
    if (profileAvatarFrame) profileAvatarFrame.hidden = true;
    if (profileCardAvatarFrame) profileCardAvatarFrame.hidden = true;
    if (drawerAvatarFrame) drawerAvatarFrame.hidden = true;

    closeProfileMenu();
    try { localStorage.removeItem('user'); } catch {}
    /* Actualizar bottom nav */
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user: null } }));
  }

  function showProfile(user) {
    profileUser = user;
    guestActions.hidden = true;
    profileRoot.hidden = false;
    headerUserStats.hidden = false;
    userActions.hidden = false;
    userActions.dataset.authState = 'ready';

    // Actualizar Drawer móvil para usuario logueado
    if (drawerGuestBox) drawerGuestBox.hidden = true;
    if (drawerUserCard) drawerUserCard.hidden = false;

    const name = user.username || user.email || 'Lector';
    profileName.textContent = name;
    if (profileHandle) {
      profileHandle.textContent = user.username ? `@${user.username}` : (user.user_code ? `@${user.user_code}` : '');
    }
    profileEmail.textContent = user.email || '';
    profileRole.textContent = user.platform_role || 'USER';
    profileToggle.setAttribute('aria-label', `Perfil de ${name}. Abrir menú`);
    profileInitials.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase() || 'Y';
    if (profileCardInitials) {
      profileCardInitials.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase() || 'Y';
    }

    updateIdentDisplay();

    if (publicProfileLink) {
      const publicId = user.username || user.user_code;
      publicProfileLink.href = publicId ? `/pages/usuario.html?id=${encodeURIComponent(publicId)}` : '/pages/usuario.html';
    }

    // Stats
    const xp = user.xp || 0;
    const coins = user.coins || 0;
    const streak = user.streak_days || 0;
    const currentLevel = Math.floor(xp / 1000) + 1;
    const levelXp = xp % 1000;
    const pct = Math.floor((levelXp / 1000) * 100);

    if (headerStreak) headerStreak.textContent = `${streak}d`;
    if (headerCoins) headerCoins.textContent = `${coins.toLocaleString()} G`;
    if (headerLevel) headerLevel.textContent = `Nv. ${currentLevel}`;
    if (headerXpBar) headerXpBar.style.width = `${pct}%`;
    if (headerXpPct) headerXpPct.textContent = `${pct}%`;

    // Sincronizar stats en el Drawer móvil
    if (drawerUserName) drawerUserName.textContent = name;
    if (drawerUserHandle) {
      drawerUserHandle.textContent = user.username ? `@${user.username}` : (user.user_code ? `@${user.user_code}` : '');
    }
    if (drawerUserRole) drawerUserRole.textContent = user.platform_role || 'USER';
    if (drawerStreakVal) drawerStreakVal.textContent = `${streak}d`;
    if (drawerCoinsVal) drawerCoinsVal.textContent = `${coins.toLocaleString()} G`;
    if (drawerLevelVal) drawerLevelVal.textContent = `Nv. ${currentLevel}`;
    if (drawerXpFill) drawerXpFill.style.width = `${pct}%`;
    if (drawerXpLabel) drawerXpLabel.textContent = `${levelXp} / 1000 XP`;
    if (drawerAvatarInitials) {
      drawerAvatarInitials.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase() || 'Y';
    }

    // Anillo de progreso del avatar en el header (conic-gradient fluido)
    if (avatarRing) {
      avatarRing.style.setProperty('--avatar-xp-pct', `${pct}%`);
      avatarRing.title = `Nivel ${currentLevel} (${pct}% XP) · ${levelXp}/1000 XP`;
    }

    // Dropdown Header & Stats sync
    if (statsDdLevelBadge) statsDdLevelBadge.textContent = `Nv. ${currentLevel}`;
    if (statsDdLevelTitle) {
      const titles = [
        [5, 'Lector Principiante'],
        [15, 'Lector Frecuente'],
        [30, 'Lector Avanzado'],
        [50, 'Maestro Lector'],
        [100, 'Lector Legendario'],
      ];
      const found = titles.find(([maxLvl]) => currentLevel < maxLvl);
      statsDdLevelTitle.textContent = found ? found[1] : 'Soberano de las Historias';
    }
    if (statsDdXpLabel) statsDdXpLabel.textContent = `${levelXp} / 1000 XP`;
    if (statsDdBarFill) statsDdBarFill.style.width = `${pct}%`;
    if (statsDdXpRemaining) {
      statsDdXpRemaining.textContent = `Faltan ${1000 - levelXp} XP para Nivel ${currentLevel + 1}`;
    }
    if (statsDdStreakVal) {
      statsDdStreakVal.textContent = `${streak} ${streak === 1 ? 'día' : 'días'}`;
    }
    if (statsDdCoinsVal) {
      statsDdCoinsVal.textContent = `${coins.toLocaleString()} G`;
    }

    const avatarUrl = safeUrl(user.avatar_url, '');
    profileAvatar.onerror = () => {
      profileAvatar.hidden = true;
      profileInitials.hidden = false;
    };
    if (avatarUrl) {
      profileAvatar.src = avatarUrl;
      profileAvatar.hidden = false;
      profileInitials.hidden = true;
      if (profileCardAvatar) {
        profileCardAvatar.src = avatarUrl;
        profileCardAvatar.hidden = false;
        if (profileCardInitials) profileCardInitials.hidden = true;
        profileCardAvatar.onerror = () => {
          profileCardAvatar.hidden = true;
          if (profileCardInitials) profileCardInitials.hidden = false;
        };
      }
      if (drawerAvatarImg) {
        drawerAvatarImg.src = avatarUrl;
        drawerAvatarImg.hidden = false;
        if (drawerAvatarInitials) drawerAvatarInitials.hidden = true;
        drawerAvatarImg.onerror = () => {
          drawerAvatarImg.hidden = true;
          if (drawerAvatarInitials) drawerAvatarInitials.hidden = false;
        };
      }
    } else {
      profileAvatar.removeAttribute('src');
      profileAvatar.hidden = true;
      profileInitials.hidden = false;
      if (profileCardAvatar) {
        profileCardAvatar.removeAttribute('src');
        profileCardAvatar.hidden = true;
        if (profileCardInitials) profileCardInitials.hidden = false;
      }
      if (drawerAvatarImg) {
        drawerAvatarImg.removeAttribute('src');
        drawerAvatarImg.hidden = true;
        if (drawerAvatarInitials) drawerAvatarInitials.hidden = false;
      }
    }

    // Marco del anillo del avatar (avatar frame)
    const frameUrl = safeUrl(user.anillo_url || user.avatar_frame_url, '');
    if (frameUrl) {
      if (profileAvatarFrame) {
        profileAvatarFrame.src = frameUrl;
        profileAvatarFrame.hidden = false;
        profileAvatarFrame.onerror = () => { profileAvatarFrame.hidden = true; };
      }
      if (profileCardAvatarFrame) {
        profileCardAvatarFrame.src = frameUrl;
        profileCardAvatarFrame.hidden = false;
        profileCardAvatarFrame.onerror = () => { profileCardAvatarFrame.hidden = true; };
      }
      if (drawerAvatarFrame) {
        drawerAvatarFrame.src = frameUrl;
        drawerAvatarFrame.hidden = false;
        drawerAvatarFrame.onerror = () => { drawerAvatarFrame.hidden = true; };
      }
    } else {
      if (profileAvatarFrame) {
        profileAvatarFrame.removeAttribute('src');
        profileAvatarFrame.hidden = true;
      }
      if (profileCardAvatarFrame) {
        profileCardAvatarFrame.removeAttribute('src');
        profileCardAvatarFrame.hidden = true;
      }
      if (drawerAvatarFrame) {
        drawerAvatarFrame.removeAttribute('src');
        drawerAvatarFrame.hidden = true;
      }
    }

    if (headerStatPill) {
      headerStatPill.title = `Nivel ${currentLevel} (${pct}%) · ${coins.toLocaleString()} G · Racha: ${streak}d. Clic para ver misiones`;
    }

    /* Actualizar bottom nav con datos del usuario */
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user } }));
  }

  /* STATS DROPDOWN Y MISIONES RÁPIDAS */
  let dropdownMissionsLoading = false;
  let cachedMissionsData = null;

  function isStatsDropdownOpen() {
    return statsDropdownMenu && !statsDropdownMenu.hidden;
  }

  function closeStatsDropdown() {
    if (!statsDropdownMenu || statsDropdownMenu.hidden) return;
    statsDropdownMenu.hidden = true;
    headerStatPill?.setAttribute('aria-expanded', 'false');
  }

  function openStatsDropdown() {
    if (!statsDropdownMenu) return;
    closeSearch();
    closeProfileMenu();
    closeNotificationsMenu();
    if (isMenuOpen()) closeMenu();

    statsDropdownMenu.hidden = false;
    headerStatPill?.setAttribute('aria-expanded', 'true');
    loadDropdownMissions();
  }

  function toggleStatsDropdown() {
    isStatsDropdownOpen() ? closeStatsDropdown() : openStatsDropdown();
  }

  async function loadDropdownMissions(forceReload = false) {
    if (!statsDdMissionsList) return;
    if (dropdownMissionsLoading) return;
    if (cachedMissionsData && !forceReload) {
      renderDropdownMissionsList(cachedMissionsData);
      return;
    }

    dropdownMissionsLoading = true;
    try {
      const data = await apiRequest('/home/mission/');
      cachedMissionsData = data;
      renderDropdownMissionsList(data);
    } catch {
      statsDdMissionsList.innerHTML = `
        <div class="header-stats-dd-empty">No se pudieron cargar las misiones</div>
      `;
      if (statsDdMissionsSummary) statsDdMissionsSummary.textContent = 'Error';
    } finally {
      dropdownMissionsLoading = false;
    }
  }

  function renderDropdownMissionsList(data) {
    if (!statsDdMissionsList) return;
    if (data.auth_required) {
      statsDdMissionsList.innerHTML = `
        <div class="header-stats-dd-empty">Inicia sesión para ver misiones</div>
      `;
      if (statsDdMissionsSummary) statsDdMissionsSummary.textContent = 'Sin sesión';
      return;
    }

    const missions = data.missions || [];
    let readyCount = 0;
    missions.forEach(m => { if (m.can_claim) readyCount += 1; });
    if (data.chest?.can_claim) readyCount += 1;

    if (statsDdMissionsSummary) {
      statsDdMissionsSummary.textContent = readyCount > 0
        ? `¡${readyCount} por reclamar!`
        : `${data.total_claimed || 0}/${data.total_missions || missions.length} Reclamadas`;
      statsDdMissionsSummary.classList.toggle('is-ready', readyCount > 0);
    }

    const iconMap = {
      'book-open': '📖',
      'flame': '🔥',
      'message-circle': '💬',
      'bookmark': '🔖',
      'gift': '🎁',
    };

    const itemsHtml = missions.map(m => {
      const icon = iconMap[m.icon] || '⭐';
      let actionHtml = '';

      if (m.is_claimed) {
        actionHtml = `<span class="header-stats-dd-claimed">✓ Reclamada</span>`;
      } else if (m.can_claim) {
        actionHtml = `
          <button type="button" class="header-stats-dd-claim-btn" data-key="${m.key}">
            Reclamar +${m.reward_xp} XP
          </button>`;
      } else {
        actionHtml = `
          <a href="${m.action_url || '/pages/catalogo.html'}" class="header-stats-dd-action-btn">
            ${m.action_text || 'Ir'} →
          </a>`;
      }

      return `
        <div class="header-stats-dd-item ${m.can_claim ? 'is-ready' : ''} ${m.is_claimed ? 'is-claimed' : ''}">
          <div class="header-stats-dd-item-left">
            <span class="header-stats-dd-item-icon">${icon}</span>
            <div class="header-stats-dd-item-info">
              <div class="header-stats-dd-item-title">${m.title}</div>
              <div class="header-stats-dd-item-bar-row">
                <div class="header-stats-dd-item-bar">
                  <div class="header-stats-dd-item-bar-fill" data-progress="${m.progress_pct}"></div>
                </div>
                <span class="header-stats-dd-item-progress">${m.progress_label}</span>
              </div>
            </div>
          </div>
          <div class="header-stats-dd-item-right">
            ${actionHtml}
          </div>
        </div>
      `;
    }).join('');

    statsDdMissionsList.innerHTML = itemsHtml || '<div class="header-stats-dd-empty">No hay misiones disponibles</div>';
    applyDataProgress(statsDdMissionsList);
  }

  function checkStreakNotification(user) {
    if (!user) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `yume_streak_notified_${user.id || 'me'}_${todayKey}`;

    if (sessionStorage.getItem(storageKey)) return;

    const event = user.streak_event;
    if (!event) return;

    if (event === 'increased') {
      const days = user.streak_days || 1;
      const msg = user.streak_message || `¡Racha aumentada! Llevas ${days} días consecutivos leyendo 🔥`;
      showToast(msg, 'success', 5000);
      sessionStorage.setItem(storageKey, '1');
    } else if (event === 'lost') {
      const prev = user.previous_streak || 0;
      const msg = user.streak_message || (prev > 1
        ? `¡Has perdido tu racha de ${prev} días! Tu racha se ha reiniciado a 1 día 💔`
        : '¡Tu racha se ha reiniciado a 1 día! 💔');
      showToast(msg, 'warning', 6500);
      sessionStorage.setItem(storageKey, '1');
    } else if (event === 'started') {
      const msg = user.streak_message || '¡Comenzaste tu racha diaria! Día 1 completado 🔥';
      showToast(msg, 'success', 4500);
      sessionStorage.setItem(storageKey, '1');
    }
  }

  async function loadProfile() {
    if (!getAccessToken()) {
      showGuestActions();
      return;
    }

    // Renderizado inmediato optimista si ya existe sesión en caché local
    try {
      const cached = JSON.parse(localStorage.getItem('user') || 'null');
      if (cached && (cached.id || cached.username)) {
        showProfile(cached);
      }
    } catch {}

    try {
      const user = await authRequest('/me', { signal: profileController.signal });
      if (!destroyed) {
        try {
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
        showProfile(user);
        window.dispatchEvent(new CustomEvent('auth:user-synced', { detail: { user } }));
        checkStreakNotification(user);
        // Cargar conteo rápido inicial al autenticar
        apiRequest('/notifications/?unread_only=true').then(res => {
           const count = res?.unread_count ?? (res?.data ? res.data.length : 0);
           updateBellBadge(count);
        }).catch(() => {});
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.status === 401 || error.status === 400) clearAccessToken();
      if (!destroyed) showGuestActions();
      if (error.status !== 401 && error.status !== 400) {
        console.warn('[header] No se pudo cargar el perfil:', error);
      }
    }
  }

  /* HANDLERS */
  function onMenuToggleClick() {
    if (!isMenuOpen()) {
      closeSearch();
      closeProfileMenu();
      closeNotificationsMenu();
    }
    toggleMenu();
  }

  function handleGlobalDrawerClick(e) {
    const trigger = e.target.closest('[data-drawer-toggle="menu"], [data-drawer-open="menu"]');
    if (trigger) {
      e.preventDefault();
      if (!isMenuOpen()) {
        closeSearch();
        closeProfileMenu();
        closeNotificationsMenu();
        openMenu();
      } else if (trigger.hasAttribute('data-drawer-toggle')) {
        closeMenu();
      }
      return;
    }

    const closeTrigger = e.target.closest('[data-drawer-close="menu"]');
    if (closeTrigger) {
      e.preventDefault();
      closeMenu();
      return;
    }
  }

  function onGlobalDrawerEvent(e) {
    const action = e.detail?.action || 'toggle';
    if (action === 'open') {
      if (!isMenuOpen()) {
        closeSearch();
        closeProfileMenu();
        closeNotificationsMenu();
        openMenu();
      }
    } else if (action === 'close') {
      closeMenu();
    } else {
      onMenuToggleClick();
    }
  }


  function onLinkClick() {
    // Al navegar, cerramos todo por limpieza visual
    closeMenu();
    closeSearch();
  }

  function onBackdropClick() { closeMenu(); }

  function onSearchToggleClick() {
    if (isMenuOpen()) closeMenu();
    closeProfileMenu();
    closeNotificationsMenu();
    toggleSearch();
  }

  function onSearchFormSubmit(event) { submitSearch(event); }

  function onSearchInput() {
    searchClear.hidden = !searchInput.value;
    queueSuggestions();
  }

  function onSearchClearClick() {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === '/pages/catalogo.html' && currentUrl.searchParams.has('q')) {
      currentUrl.searchParams.delete('q');
      currentUrl.searchParams.delete('page');
      window.location.assign(`${currentUrl.pathname}${currentUrl.search}`);
      return;
    }
    searchInput.value = '';
    onSearchInput();
    searchInput.focus();
  }

  function onSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch(e);
      return;
    }
    if (e.key === 'ArrowDown' && !searchSuggestions.hidden) {
      e.preventDefault();
      searchSuggestions.querySelector('a[role="option"]')?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!searchSuggestions.hidden) {
        hideSuggestions();
      } else {
        closeSearch({ returnFocus: true });
      }
    }
  }

  function onProfileToggleClick() {
    if (isMenuOpen()) closeMenu();
    closeSearch();
    toggleProfileMenu();
  }

  function onCopyProfileId() {
    if (!profileUser) return;
    const isUserMode = activeIdentMode === 'username';
    const textToCopy = isUserMode
      ? (profileUser.username ? `@${profileUser.username}` : (profileUser.user_code ? `@${profileUser.user_code}` : ''))
      : (profileUser.user_code || '');

    if (!textToCopy) return;

    copyToClipboard(textToCopy).then(() => {
      copyProfileId.setAttribute('aria-label', `${isUserMode ? 'Usuario' : 'ID'} copiado`);
      copyProfileId.classList.add('copied');
      if (copyBtnText) copyBtnText.textContent = '¡Copiado!';
      window.setTimeout(() => {
        copyProfileId.setAttribute('aria-label', 'Copiar al portapapeles');
        copyProfileId.classList.remove('copied');
        if (copyBtnText) copyBtnText.textContent = 'Copiar';
      }, 1800);
    }).catch((err) => {
      console.warn('Error al copiar:', err);
      if (copyBtnText) copyBtnText.textContent = 'Error';
      window.setTimeout(() => {
        if (copyBtnText) copyBtnText.textContent = 'Copiar';
      }, 1500);
    });
  }

  function onLogoutClick() {
    disconnectPresence();
    clearAccessToken();
    profileUser = null;
    showGuestActions();
    window.location.assign('/index.html');
  }

  function onOutsideClick(e) {
    // Cerrar menú si el click fue fuera
    if (
      isMenuOpen() &&
      !navigationContent.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      closeMenu();
    }
    // Cerrar buscador si el click fue fuera
    if (
      isSearchOpen() &&
      !searchPanel.contains(e.target) &&
      !searchToggle.contains(e.target)
    ) {
      closeSearch();
    }
    if (!profileMenu.hidden && !profileRoot.contains(e.target)) {
      closeProfileMenu();
    }
    if (!notificationsMenu.hidden && !bellWrapper.contains(e.target)) {
      closeNotificationsMenu();
    }
    if (statsDropdownMenu && !statsDropdownMenu.hidden && !headerStatWrapper.contains(e.target)) {
      closeStatsDropdown();
    }
  }

  function onEscape(e) {
    if (e.key !== 'Escape') return;
    // Prioridad: buscador → menú
    if (isSearchOpen()) {
      closeSearch({ returnFocus: true });
      return;
    }
    if (statsDropdownMenu && !statsDropdownMenu.hidden) {
      closeStatsDropdown();
      return;
    }
    if (!profileMenu.hidden) {
      closeProfileMenu({ returnFocus: true });
      return;
    }
    if (!notificationsMenu.hidden) {
      closeNotificationsMenu();
      return;
    }
    if (isMenuOpen()) {
      closeMenu({ returnFocus: true });
    }
  }

  function onScroll() {
    if (!isMenuOpen()) return;
    // Solo cerramos si el usuario hizo un scroll significativo (>20px)
    if (Math.abs(window.scrollY - menuOpenScrollY) > 20) {
      closeMenu();
    }
  }

  /* BIND */
  menuToggle.addEventListener('click', onMenuToggleClick);
  navigationLinks.forEach((link) => link.addEventListener('click', onLinkClick));
  menuBackdrop.addEventListener('click', onBackdropClick);
  searchToggle.addEventListener('click', () => {
    closeStatsDropdown();
    onSearchToggleClick();
  });
  searchForm.addEventListener('submit', onSearchFormSubmit);
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);
  searchClear.addEventListener('click', onSearchClearClick);
  profileToggle.addEventListener('click', () => {
    closeStatsDropdown();
    onProfileToggleClick();
  });
  if (toggleIdentMode) {
    toggleIdentMode.addEventListener('click', onToggleIdentMode);
  }
  copyProfileId.addEventListener('click', onCopyProfileId);
  logoutButton.addEventListener('click', onLogoutClick);
  if (bellToggle) {
    bellToggle.addEventListener('click', () => {
      closeStatsDropdown();
      toggleNotificationsMenu();
    });
    if (notificationsReadAll) notificationsReadAll.addEventListener('click', markAllNotificationsRead);
    if (notificationsClearAll) notificationsClearAll.addEventListener('click', clearAllNotifications);
  }

  if (headerStatPill) {
    headerStatPill.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStatsDropdown();
    });
  }

  if (statsDropdownMenu) {
    statsDropdownMenu.addEventListener('click', async (e) => {
      const claimBtn = e.target.closest('.header-stats-dd-claim-btn');
      if (!claimBtn || claimBtn.disabled) return;

      const missionKey = claimBtn.dataset.key;
      if (!missionKey) return;

      claimBtn.disabled = true;
      claimBtn.textContent = '...';

      try {
        const res = await apiRequest('/home/mission/claim/', {
          method: 'POST',
          body: { mission_key: missionKey },
        });

        if (res.leveled_up) {
          showToast(`🎉 ¡SUBISTE DE NIVEL! Ahora eres Nivel ${res.new_level}`, 'success', 5000);
        }

        if (profileUser) {
          profileUser.xp = res.new_xp;
          profileUser.coins = res.new_coins;
          profileUser.streak_days = res.streak_days;
          showProfile(profileUser);
        }

        window.dispatchEvent(new CustomEvent('yume:xp-updated', { detail: res }));
        cachedMissionsData = res.missions_state;
        renderDropdownMissionsList(res.missions_state);
      } catch (err) {
        showToast(err.message || 'Error al reclamar la misión', 'error');
        claimBtn.disabled = false;
        claimBtn.textContent = 'Reclamar';
      }
    });
  }

  window.addEventListener('yume:xp-updated', (e) => {
    if (e.detail && profileUser) {
      if (e.detail.new_xp !== undefined) profileUser.xp = e.detail.new_xp;
      if (e.detail.new_coins !== undefined) profileUser.coins = e.detail.new_coins;
      if (e.detail.streak_days !== undefined) profileUser.streak_days = e.detail.streak_days;
      showProfile(profileUser);
      if (e.detail.missions_state) {
        cachedMissionsData = e.detail.missions_state;
        renderDropdownMissionsList(e.detail.missions_state);
      }
      // Actualizar campana de notificaciones de inmediato en tiempo real
      loadNotifications(true);
    }
  });

  document.addEventListener('click', handleGlobalDrawerClick);
  window.addEventListener('yume:drawer', onGlobalDrawerEvent);
  document.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onEscape);
  window.addEventListener('scroll', onScroll, { passive: true });

  function highlightActiveRoute() {
    const currentPath = window.location.pathname.toLowerCase();
    navigationLinks.forEach((link) => {
      const href = link.getAttribute('href')?.toLowerCase() || '';
      const cleanHref = href.split('?')[0];
      const isHome = (cleanHref === '/index.html' || cleanHref === '/' || cleanHref === '') && (currentPath === '/' || currentPath === '/index.html' || currentPath === '');
      const isCurrent = isHome || (cleanHref !== '/index.html' && cleanHref !== '/' && cleanHref !== '' && currentPath.endsWith(cleanHref));

      if (isCurrent) {
        link.classList.add('header-link-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('header-link-active');
        link.removeAttribute('aria-current');
      }
    });
  }

  // Sistema de Notificaciones Reactivo por Disparador (Event-Driven)
  // Se actualiza en vivo al realizar acciones, al abrir el menú o volver a la pestaña,
  // eliminando consultas continuas por segundos.
  function onNotificationTrigger() {
    if (!getAccessToken() || destroyed) return;
    loadNotifications(true);
  }

  function onCosmeticsUpdated(e) {
    if (profileUser) {
      if (e?.detail?.anillo_url !== undefined) {
        profileUser.anillo_url = e.detail.anillo_url;
        profileUser.avatar_frame_url = e.detail.anillo_url;
      } else if (e?.detail?.avatar_frame_url !== undefined) {
        profileUser.avatar_frame_url = e.detail.avatar_frame_url;
        profileUser.anillo_url = e.detail.avatar_frame_url;
      }
      if (e?.detail?.banner_url !== undefined) {
        profileUser.banner_url = e.detail.banner_url;
      }
      showProfile(profileUser);
    } else {
      loadProfile();
    }
  }

  window.addEventListener('yume:mutation', onNotificationTrigger);
  window.addEventListener('yume:notification-refresh', onNotificationTrigger);
  window.addEventListener('yume:cosmetics-updated', onCosmeticsUpdated);
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && getAccessToken()) {
      onNotificationTrigger();
    }
  });
  window.addEventListener('focus', () => {
    if (getAccessToken()) {
      onNotificationTrigger();
    }
  });

  highlightActiveRoute();
  loadProfile();
  initPresence();

  return () => {
    window.removeEventListener('yume:mutation', onNotificationTrigger);
    window.removeEventListener('yume:notification-refresh', onNotificationTrigger);
    window.removeEventListener('yume:cosmetics-updated', onCosmeticsUpdated);
    menuToggle.removeEventListener('click', onMenuToggleClick);
    navigationLinks.forEach((link) => link.removeEventListener('click', onLinkClick));
    menuBackdrop.removeEventListener('click', onBackdropClick);
    searchToggle.removeEventListener('click', onSearchToggleClick);
    searchForm.removeEventListener('submit', onSearchFormSubmit);
    searchInput.removeEventListener('input', onSearchInput);
    searchInput.removeEventListener('keydown', onSearchKeydown);
    searchClear.removeEventListener('click', onSearchClearClick);
    profileToggle.removeEventListener('click', onProfileToggleClick);
    if (toggleIdentMode) {
      toggleIdentMode.removeEventListener('click', onToggleIdentMode);
    }
    copyProfileId.removeEventListener('click', onCopyProfileId);
    logoutButton.removeEventListener('click', onLogoutClick);
    if (bellToggle) {
      bellToggle.removeEventListener('click', toggleNotificationsMenu);
      if (notificationsReadAll) notificationsReadAll.removeEventListener('click', markAllNotificationsRead);
      if (notificationsClearAll) notificationsClearAll.removeEventListener('click', clearAllNotifications);
    }
    document.removeEventListener('click', handleGlobalDrawerClick);
    window.removeEventListener('yume:drawer', onGlobalDrawerEvent);
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onEscape);
    window.removeEventListener('scroll', onScroll);

    clearSearchRequest();
    destroyed = true;
    profileController.abort();
    document.body.classList.remove('menu-open');
  };
}
