import { authRequest, apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, escapeHTML, formatTimeAgo, applyDataProgress } from '../shared/ui-utils.js';
import { flashToast } from '../shared/toast.js';
import { initPresence, disconnectPresence } from '../shared/presence.js';
import { renderSkeletonRows } from './skeletons.js';

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {

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

// template header
export function getHeaderTemplate() {
  return `
    <nav id="navigation" class="header" aria-label="Navegación principal">
      <a id="brand" class="header-brand" href="/index.html">
        <img id="logo" class="header-logo" src="/assets/icons/logo.png" alt="YumeZone" width="32" height="32">
        <span class="header-brand-name">Yume<span>Zone</span></span>
      </a>

      <div id="navigation-content" class="header-content">
        <div id="navigation-links" class="header-links">
          <a id="home-link" class="header-link" href="/index.html">
            <img class="header-link-icon" src="/assets/icons/svg/navigation/home.svg" alt="" aria-hidden="true">
            <span>Inicio</span>
          </a>
          <a id="explore-link" class="header-link" href="/pages/catalogo.html">
            <img class="header-link-icon" src="/assets/icons/svg/content/grid.svg" alt="" aria-hidden="true">
            <span>Catálogo</span>
          </a>
          <a id="novedades-link" class="header-link" href="/pages/novedades.html">
            <img class="header-link-icon" src="/assets/icons/svg/navigation/launches.svg" alt="" aria-hidden="true">
            <span>Lanzamientos</span>
          </a>
          <a id="eventos-link" class="header-link" href="/pages/eventos.html">
            <img class="header-link-icon" src="/assets/icons/svg/navigation/calendar.svg" alt="" aria-hidden="true">
            <span>Eventos</span>
          </a>
          <a id="ranking-link" class="header-link" href="/pages/ranking.html">
            <img class="header-link-icon" src="/assets/icons/svg/navigation/ranking.svg" alt="" aria-hidden="true">
            <span>Ranking</span>
          </a>
          <a id="scans-link" class="header-link" href="/pages/scans.html">
            <img class="header-link-icon" src="/assets/icons/svg/user/users.svg" alt="" aria-hidden="true">
            <span>Scans</span>
          </a>
          <a id="sistema-link" class="header-link" href="/pages/sistema.html">
            <img class="header-link-icon" src="/assets/icons/svg/navigation/system.svg" alt="" aria-hidden="true">
            <span>Sistema</span>
          </a>
        </div>
      </div>

      <div id="search-container" class="header-search">
        <button id="search-toggle" class="header-search-toggle" type="button"
          aria-label="Abrir buscador" aria-expanded="false" aria-controls="search-panel">
          <img class="header-icon" src="/assets/icons/svg/actions/search.svg" alt="" aria-hidden="true">
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
              <img class="header-icon" src="/assets/icons/svg/actions/search.svg" alt="" aria-hidden="true">
            </button>
            <button id="search-clear" class="header-search-clear" type="button"
              aria-label="Limpiar búsqueda" title="Limpiar búsqueda" hidden>
              <img src="/assets/icons/svg/actions/clear.svg" alt="" aria-hidden="true">
            </button>
          </form>
          <div id="search-suggestions" class="header-search-suggestions"
            role="listbox" aria-label="Sugerencias de obras" hidden></div>
        </div>
      </div>

      <button id="menu-toggle" class="header-menu-toggle" type="button"
        aria-label="Abrir menú" aria-expanded="false" aria-controls="navigation-content">
        <img class="header-icon" src="/assets/icons/svg/navigation/menu.svg" alt="" aria-hidden="true">
      </button>

      <div class="header-menu-backdrop" data-menu-backdrop aria-hidden="true"></div>

      <div id="guest-actions" class="header-guest-actions" data-auth-state="pending" hidden>
        <a id="login-link" class="header-action" href="/pages/login.html">Entrar</a>
        <a id="signup-link" class="header-action header-action-primary" href="/pages/registro.html">
          Registro
        </a>
      </div>

      <div id="user-actions" class="header-actions" data-auth-state="pending" hidden>
        <div class="header-user-stats" id="header-user-stats" hidden>
          <div class="header-bell-wrapper">
            <button id="header-bell" class="header-bell" aria-label="Notificaciones" aria-expanded="false" aria-controls="notifications-menu">
              <img src="/assets/icons/svg/user/bell.svg" alt="" aria-hidden="true">
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

              <!-- Selector interactivo de Identificador -->
              <div class="header-profile-id-box">
                <button id="toggle-ident-mode" class="header-profile-ident-pill" type="button"
                  title="Clic para alternar entre @Usuario e ID de usuario" aria-label="Modo actual: @Usuario. Clic para cambiar a ID">
                  <span id="ident-badge" class="header-profile-ident-tag">@USER</span>
                  <span id="profile-menu-id" class="header-profile-id-val">@usuario</span>
                  <span class="header-profile-swap-icon" aria-hidden="true" title="Alternar">
                    <img src="/assets/icons/svg/actions/swap.svg" class="header-profile-swap-icon-img" alt="" aria-hidden="true">
                  </span>
                </button>
                <button id="copy-profile-id" class="header-profile-copy-btn" type="button"
                  aria-label="Copiar identificador al portapapeles" title="Copiar al portapapeles">
                  <span class="header-profile-copy-icon-wrap" aria-hidden="true">
                    <img src="/assets/icons/svg/actions/copy.svg" class="header-copy-icon-default" alt="" aria-hidden="true">
                    <img src="/assets/icons/svg/actions/check.svg" class="header-copy-icon-check" alt="" aria-hidden="true">
                  </span>
                  <span id="copy-btn-text" class="header-profile-copy-text">Copiar</span>
                </button>
              </div>
            </div>

            <!-- Progreso y Gamificación -->
            <div class="header-profile-gamification">
              <div class="header-stats-dd-head">
                <div class="header-stats-dd-level-badge" id="stats-dd-level-badge"><span class="is-loading is-loading--sm"></span></div>
                <div class="header-stats-dd-level-info">
                  <div class="header-stats-dd-level-title" id="stats-dd-level-title"><span class="is-loading is-loading--lg"></span></div>
                  <div class="header-stats-dd-xp-label" id="stats-dd-xp-label"><span class="is-loading is-loading--md"></span></div>
                </div>
              </div>

              <div class="header-stats-dd-bar-wrap">
                <div class="header-stats-dd-bar">
                  <div class="header-stats-dd-bar-fill" id="stats-dd-bar-fill"></div>
                </div>
                <div class="header-stats-dd-bar-sub" id="stats-dd-xp-remaining"><span class="is-loading is-loading--lg"></span></div>
              </div>

              <div class="header-stats-dd-grid">
                <div class="header-stats-dd-card">
                  <div class="header-stats-dd-card-top">
                    <img src="/assets/icons/svg/gamification/fire.svg" alt="" width="14" height="14">
                    <span class="header-stats-dd-card-label">Racha Activa</span>
                  </div>
                  <div class="header-stats-dd-card-val" id="stats-dd-streak-val"><span class="is-loading is-loading--sm"></span></div>
                  <div class="header-stats-dd-card-hint" id="stats-dd-streak-hint">Lee diario para mantenerla</div>
                </div>

                <div class="header-stats-dd-card">
                  <div class="header-stats-dd-card-top">
                    <img src="/assets/icons/svg/gamification/coin.svg" alt="" width="14" height="14">
                    <span class="header-stats-dd-card-label">Yume Coins</span>
                  </div>
                  <div class="header-stats-dd-card-val" id="stats-dd-coins-val"><span class="is-loading is-loading--sm"></span></div>
                  <div class="header-stats-dd-card-hint">Canjeables en la tienda</div>
                </div>
              </div>
            </div>

            <div class="header-profile-links">
              <a href="/pages/usuario.html" id="header-public-profile-link" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/user/user.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Mi perfil público</span>
              </a>
              <a href="/pages/scans.html" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/user/users.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Clanes & Scans</span>
              </a>
              <a href="/pages/tienda.html" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/navigation/shop.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Tienda</span>
              </a>
              <a href="/pages/biblioteca.html" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/navigation/library.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Mi biblioteca</span>
              </a>
              <a href="/pages/usuario.html?edit=1" class="header-profile-link" role="menuitem">
                <img src="/assets/icons/svg/user/settings.svg" class="header-profile-link-icon" alt="" aria-hidden="true">
                <span>Ajustes de cuenta</span>
              </a>
            </div>

            <button id="logout-button" class="header-profile-logout" type="button" role="menuitem">
              <img src="/assets/icons/svg/user/logout.svg" alt="" aria-hidden="true">
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

// inicializar header
export function renderSiteHeader(container) {
  if (!container) throw new Error('renderSiteHeader: container requerido.');

  // evitar duplicados
  if (container.dataset.mounted === 'true') {
    return () => {};
  }
  container.dataset.mounted = 'true';

  // inyectar header
  if (!container.dataset.rendered || !container.querySelector('#scans-link')) {
    container.innerHTML = getHeaderTemplate();
    container.dataset.rendered = 'true';
  }

  container.removeAttribute('aria-busy');

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
  const headerLevel = document.getElementById('header-level');
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

  // marcos avatar
  const profileAvatarFrame = document.getElementById('profile-avatar-frame');
  const profileCardAvatarFrame = document.getElementById('profile-card-avatar-frame');

  if (!menuToggle || !navigationContent || !menuBackdrop ||
    !searchToggle || !searchPanel || !searchInput || !searchForm ||
    !searchSuggestions || !searchButton || !searchClear || !loginLink || !signupLink ||
    !guestActions || !userActions || !headerUserStats ||
    !profileRoot || !profileToggle || !profileMenu || !profileInitials ||
    !profileAvatar || !profileName || !profileEmail || !profileRole ||
    !profileUserId || !copyProfileId || !logoutButton || !bellToggle) {
    throw new Error('Header: estructura del DOM incompleta.');
  }

  // estado
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
    menu: '/assets/icons/svg/navigation/menu.svg',
    close: '/assets/icons/svg/actions/x.svg',
    notification: '/assets/icons/svg/user/bell.svg',
    system: '/assets/icons/svg/content/info.svg',
    success: '/assets/icons/svg/actions/check.svg',
  };

  // menú móvil
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

  // buscador
  function isSearchOpen() {
    return searchPanel.classList.contains('header-search-panel-open');
  }

  function openSearch() {
    searchPanel.classList.add('header-search-panel-open');
    searchPanel.setAttribute('aria-hidden', 'false');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchToggle.setAttribute('aria-label', 'Cerrar buscador');
    searchClear.hidden = !searchInput.value;
    // foco buscador
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

    // actualizar url catalogo
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

  function createSuggestion(item, index) {
    const link = document.createElement('a');
    link.className = 'header-search-suggestion';
    link.href = item.url;
    link.id = `search-suggestion-${index}`;
    link.setAttribute('role', 'option');
    link.setAttribute('aria-selected', 'false');

    if (item.type === 'user' && !item.image_url) {
      const initial = document.createElement('span');
      initial.className = 'header-search-suggestion-initials';
      initial.textContent = (item.title || 'U').substring(0, 2).toUpperCase();
      link.append(initial);
    } else {
      const cover = document.createElement('img');
      cover.className = item.type === 'user' ? 'header-search-suggestion-avatar' : 'header-search-suggestion-cover';
      cover.src = safeUrl(item.image_url, IMG_FALLBACK);
      cover.alt = '';
      cover.loading = 'lazy';
      link.append(cover);
    }

    const copy = document.createElement('span');
    copy.className = 'header-search-suggestion-copy';
    const title = document.createElement('span');
    title.className = 'header-search-suggestion-title';
    title.textContent = item.title;
    copy.append(title);

    if (item.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'header-search-suggestion-meta';
      subtitle.textContent = item.subtitle;
      copy.append(subtitle);
    }

    link.append(copy);
    return link;
  }

  // esqueletos de sugerencias (.header-search-suggestion)
  function showSuggestionSkeletons(isUser = false) {
    const thumbClass = isUser ? 'header-search-suggestion-avatar' : 'header-search-suggestion-cover';
    const row = `
      <div class="header-search-suggestion is-skeleton" aria-hidden="true">
        <span class="${thumbClass} yz-skeleton"></span>
        <span class="header-search-suggestion-copy">
          <span class="header-search-suggestion-title"><span class="is-loading is-loading--block is-loading--w80"></span></span>
          <span class="header-search-suggestion-meta"><span class="is-loading is-loading--md"></span></span>
        </span>
      </div>`;
    searchSuggestions.innerHTML = row.repeat(4);
    showSuggestions();
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
    if (query.length < 2 && !query.startsWith('@')) {
      setSuggestionStatus('Escribe un carácter más para buscar.');
      return;
    }

    const requestId = ++searchRequestId;
    showSuggestionSkeletons(query.startsWith('@'));
    searchDebounceTimer = window.setTimeout(async () => {
      const controller = new AbortController();
      searchController = controller;

      try {
        const items = await apiRequest(`/works/search/suggest?q=${encodeURIComponent(query)}&limit=7`, {
          signal: controller.signal,
        });
        if (requestId !== searchRequestId || query !== searchInput.value.trim()) return;

        if (!Array.isArray(items) || !items.length) {
          setSuggestionStatus(query.startsWith('@') ? 'No se encontraron usuarios.' : 'No encontramos resultados con esa búsqueda.');
          return;
        }

        const options = items.map((item, index) => createSuggestion(item, index));

        if (!query.startsWith('@')) {
          const footer = document.createElement('a');
          footer.className = 'header-search-all';
          footer.href = buildSearchUrl(query).href;
          footer.textContent = `Ver todas las obras para "${query}"`;
          footer.setAttribute('role', 'option');
          footer.setAttribute('aria-selected', 'false');
          searchSuggestions.replaceChildren(...options, footer);
        } else {
          searchSuggestions.replaceChildren(...options);
        }
        showSuggestions();
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== searchRequestId) return;
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
    if (!isOpen) {
      closeNotificationsMenu();
      closeStatsDropdown();
    }
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

  // notificaciones
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

  function getNotificationIconHtml(iconType = 'system') {
    const icons = {
      chapter: '/assets/icons/svg/content/book.svg',
      reward: '/assets/icons/svg/gamification/award.svg',
      level: '/assets/icons/svg/gamification/star.svg',
      streak: '/assets/icons/svg/gamification/fire.svg',
      comment: '/assets/icons/svg/content/comment.svg',
      system: '/assets/icons/svg/content/info.svg',
    };
    const src = icons[iconType] || icons.system;
    return `
      <div class="header-notification-icon type-${escapeHTML(iconType)}" aria-hidden="true">
        <img src="${src}" width="16" height="16" alt="">
      </div>
    `;
  }

  function getEmptyNotificationsHtml() {
    return `
      <div class="header-notifications-empty">
        <div class="header-notifications-empty-icon" aria-hidden="true">
          <img src="/assets/icons/svg/user/bell.svg" width="22" height="22" alt="">
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

  async function loadNotifications(silent = false) {
    try {
      const response = await apiRequest('/notifications/?unread_only=true');
      const items = response?.data || [];
      const count = response?.unread_count ?? items.length;

      updateBellBadge(count);

      if (notificationsReadAll) notificationsReadAll.hidden = items.length === 0;
      if (notificationsClearAll) notificationsClearAll.hidden = items.length === 0;

      if (silent && notificationsMenu.hidden) {
        return;
      }

      if (items.length === 0) {
        notificationsList.innerHTML = getEmptyNotificationsHtml();
        return;
      }

      notificationsList.innerHTML = '';
      items.forEach(item => {
        const title = item.title || 'Notificación';
        const desc = item.description || '';
        const timeAgo = item.time_ago || formatTimeAgo(item.created_at);
        const targetUrl = item.target_url || null;

        const itemEl = document.createElement('div');
        itemEl.className = `header-notification-item unread${targetUrl ? ' has-link' : ''}`;
        itemEl.setAttribute('role', 'menuitem');
        if (targetUrl) {
          itemEl.setAttribute('title', 'Clic para ver el contenido');
        }

        const iconHtml = getNotificationIconHtml(item.icon_type);

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
            <img src="/assets/icons/svg/actions/x.svg" width="14" height="14" alt="" aria-hidden="true">
          </button>
        `;

        const dismissBtn = itemEl.querySelector('.header-notification-dismiss');
        const removeWithAnimation = async () => {
          itemEl.classList.add('removing');
          updateBellBadge(Math.max(0, currentUnreadCount - 1));

          try {
            await apiRequest(`/notifications/${item.id}`, { method: 'DELETE' });
          } catch {
            await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => { });
          }

          window.setTimeout(() => {
            itemEl.remove();
            const remaining = notificationsList.querySelectorAll('.header-notification-item');
            if (remaining.length === 0) {
              updateBellBadge(0);
              if (notificationsReadAll) notificationsReadAll.hidden = true;
              if (notificationsClearAll) notificationsClearAll.hidden = true;
              notificationsList.innerHTML = getEmptyNotificationsHtml();
            }
          }, 180);
        };

        // descartar notificacion
        dismissBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          removeWithAnimation();
        });

        // abrir notificacion
        itemEl.addEventListener('click', (e) => {
          if (e.target.closest('.header-notification-dismiss')) return;

          removeWithAnimation();

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
      await apiRequest('/notifications/read-all', { method: 'PATCH' }).catch(() => { });
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

    // ocultar marcos de avatar
    if (profileAvatarFrame) profileAvatarFrame.hidden = true;
    if (profileCardAvatarFrame) profileCardAvatarFrame.hidden = true;

    closeProfileMenu();
    try { localStorage.removeItem('user'); } catch { }
    // actualizar bottom nav
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user: null } }));
  }

  function showProfile(user) {
    profileUser = user;
    guestActions.hidden = true;
    profileRoot.hidden = false;
    headerUserStats.hidden = false;
    userActions.hidden = false;
    userActions.dataset.authState = 'ready';

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

    // calcular nivel y xp
    const lvl = user.level_info || {
      level: user.level || Math.floor((user.xp || 0) / 1000) + 1,
      current_level_xp: (user.xp || 0) % 1000,
      percentage: Math.floor((((user.xp || 0) % 1000) / 1000) * 100),
      remaining_xp: 1000 - ((user.xp || 0) % 1000),
      current_title: user.level_title || 'Iniciado del Cultivo'
    };
    const streak = user.streak_days || 0;
    const coins = user.coins || 0;

    if (headerStreak) headerStreak.textContent = `${streak}d`;
    if (headerLevel) headerLevel.textContent = `Nv. ${lvl.level}`;
    if (headerStatPill) {
      headerStatPill.title = `Nivel ${lvl.level} · Racha: ${streak}d · Clic para ver estadísticas`;
    }

    // anillo xp
    if (avatarRing) {
      avatarRing.style.setProperty('--avatar-xp-pct', `${lvl.percentage}%`);
      avatarRing.title = `Nivel ${lvl.level} (${lvl.percentage}% XP) · ${lvl.current_level_xp}/1000 XP`;
    }

    // dropdown progreso
    if (statsDdLevelBadge) statsDdLevelBadge.textContent = `Nv. ${lvl.level}`;
    if (statsDdLevelTitle) statsDdLevelTitle.textContent = lvl.current_title;
    if (statsDdXpLabel) statsDdXpLabel.textContent = `${lvl.current_level_xp} / 1000 XP`;
    if (statsDdBarFill) statsDdBarFill.style.width = `${lvl.percentage}%`;
    if (statsDdXpRemaining) {
      statsDdXpRemaining.textContent = `Faltan ${lvl.remaining_xp} XP para Nivel ${lvl.level + 1}`;
    }
    if (statsDdStreakVal) {
      statsDdStreakVal.textContent = `${streak} ${streak === 1 ? 'día' : 'días'}`;
    }
    if (statsDdCoinsVal) {
      statsDdCoinsVal.textContent = `${coins.toLocaleString()} YC`;
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
    } else {
      profileAvatar.removeAttribute('src');
      profileAvatar.hidden = true;
      profileInitials.hidden = false;
      if (profileCardAvatar) {
        profileCardAvatar.removeAttribute('src');
        profileCardAvatar.hidden = true;
        if (profileCardInitials) profileCardInitials.hidden = false;
      }
    }

    // marco cosmetico
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
    } else {
      if (profileAvatarFrame) {
        profileAvatarFrame.removeAttribute('src');
        profileAvatarFrame.hidden = true;
      }
      if (profileCardAvatarFrame) {
        profileCardAvatarFrame.removeAttribute('src');
        profileCardAvatarFrame.hidden = true;
      }
    }

    // sincronizar usuario
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user } }));
  }

  // stats dropdown
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
  }

  function toggleStatsDropdown() {
    isStatsDropdownOpen() ? closeStatsDropdown() : openStatsDropdown();
  }

  async function loadProfile() {
    if (!getAccessToken()) {
      showGuestActions();
      return;
    }

    // cache usuario
    try {
      const cached = JSON.parse(localStorage.getItem('user') || 'null');
      if (cached && (cached.id || cached.username)) {
        showProfile(cached);
      }
    } catch { }

    try {
      const user = await authRequest('/me', { signal: profileController.signal });
      if (!destroyed) {
        try {
          localStorage.setItem('user', JSON.stringify(user));
        } catch { }
        showProfile(user);
        window.dispatchEvent(new CustomEvent('auth:user-synced', { detail: { user } }));
        // conteo notificaciones
        apiRequest('/notifications/?unread_only=true').then(res => {
          const count = res?.unread_count ?? (res?.data ? res.data.length : 0);
          updateBellBadge(count);
        }).catch(() => { });
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

  // handlers
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
    flashToast('Sesión cerrada', 'info');
    window.location.assign('/index.html');
  }

  function onOutsideClick(e) {
    // cerrar menu externo
    if (
      isMenuOpen() &&
      !navigationContent.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      closeMenu();
    }
    // cerrar buscador externo
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
    if (statsDropdownMenu && !statsDropdownMenu.hidden && (!headerStatWrapper || !headerStatWrapper.contains(e.target))) {
      closeStatsDropdown();
    }
  }

  function onGlobalKeyDown(e) {
    const tag = e.target?.tagName?.toLowerCase() || '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
    if (!isTyping && ((e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault();
      if (!isSearchOpen()) {
        closeStatsDropdown();
        closeProfileMenu();
        closeNotificationsMenu();
        openSearch();
      } else {
        searchInput.focus();
      }
      return;
    }

    if (e.key !== 'Escape') return;
    // cerrar con escape
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
    // cerrar al hacer scroll
    if (Math.abs(window.scrollY - menuOpenScrollY) > 20) {
      closeMenu();
    }
  }

  // bind
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
  profileToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    closeStatsDropdown();
    onProfileToggleClick();
  });
  if (toggleIdentMode) {
    toggleIdentMode.addEventListener('click', onToggleIdentMode);
  }
  copyProfileId.addEventListener('click', onCopyProfileId);
  logoutButton.addEventListener('click', onLogoutClick);
  if (bellToggle) {
    bellToggle.addEventListener('click', (e) => {
      e.stopPropagation();
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
    statsDropdownMenu.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) {
        closeStatsDropdown();
      }
    });
  }

  window.addEventListener('yume:xp-updated', (e) => {
    if (e.detail && profileUser) {
      if (e.detail.new_xp !== undefined) profileUser.xp = e.detail.new_xp;
      if (e.detail.new_coins !== undefined) profileUser.coins = e.detail.new_coins;
      if (e.detail.streak_days !== undefined) profileUser.streak_days = e.detail.streak_days;
      showProfile(profileUser);
      loadNotifications(true);
    }
  });

  document.addEventListener('click', handleGlobalDrawerClick);
  window.addEventListener('yume:drawer', onGlobalDrawerEvent);
  document.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onGlobalKeyDown);
  window.addEventListener('scroll', onScroll, { passive: true });

  // eventos notificaciones

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
    document.removeEventListener('keydown', onGlobalKeyDown);
    window.removeEventListener('scroll', onScroll);

    clearSearchRequest();
    destroyed = true;
    profileController.abort();
    document.body.classList.remove('menu-open');
  };
}

