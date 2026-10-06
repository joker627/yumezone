import { API_BASE_URL } from '../api/api-config.js';
import { authRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl } from '../shared/url-utils.js';

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
          <form id="search-form" class="header-search-form" role="search">
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
        <div class="header-drawer-brand" aria-hidden="true">
          <img class="header-drawer-logo" src="/assets/icons/logo.png" alt="">
          <span class="header-drawer-name">Yume<span class="header-drawer-name--accent">Zone</span></span>
        </div>
        <div id="navigation-links" class="header-links">
          <a id="home-link" class="header-link" href="/index.html">Inicio</a>
          <a id="explore-link" class="header-link" href="/pages/obras.html">Obras</a>
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
          <div class="header-stat-pill">
            <img src="/assets/icons/svg/fire.svg" class="header-stat-icon" alt="Racha">
            <span id="header-streak">0d</span>
            <span class="header-stat-sep">|</span>
            <span id="header-level">Nv. 1</span>
            <div class="header-stat-progress">
              <div class="header-stat-progress-fill" id="header-xp-bar" style="width: 0%"></div>
            </div>
            <span id="header-xp-pct" class="header-stat-pct">0%</span>
          </div>
          <button class="header-bell" aria-label="Notificaciones">
            <img src="/assets/icons/svg/bell.svg" alt="">
            <span class="header-bell-dot"></span>
          </button>
        </div>

        <div id="header-profile" class="header-profile" hidden>
          <button id="profile-toggle" class="header-profile-toggle" type="button"
            aria-label="Abrir menú de perfil" aria-expanded="false" aria-controls="profile-menu">
            <div class="header-avatar-ring">
              <span id="profile-initials" class="header-profile-initials" aria-hidden="true">Y</span>
              <img id="profile-avatar" class="header-profile-avatar" alt="" hidden>
              <span class="header-avatar-status"></span>
            </div>
          </button>
          <div id="profile-menu" class="header-profile-menu" role="menu"
            aria-label="Menú de perfil" hidden>
            <div class="header-profile-summary">
              <strong id="profile-menu-name"></strong>
              <span id="profile-menu-email"></span>
              <span id="profile-menu-role" class="header-profile-role"></span>
            </div>
            <div class="header-profile-id-row">
              <span id="profile-menu-id"></span>
              <button id="copy-profile-id" type="button" aria-label="Copiar ID de usuario"
                title="Copiar ID de usuario">
                <img src="/assets/icons/svg/copy.svg" alt="" aria-hidden="true">
              </button>
            </div>
            <a href="/pages/biblioteca.html" role="menuitem">Mi biblioteca</a>
            <a href="/pages/perfil.html" role="menuitem">Mi perfil</a>
            <a href="/pages/perfil.html#profile-settings" role="menuitem">Editar perfil</a>
            <button id="logout-button" class="header-profile-logout" type="button" role="menuitem">
              <img src="/assets/icons/svg/logout.svg" alt="" aria-hidden="true">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
  container.removeAttribute('aria-busy');

  /* ----------------------------------------------------------
     Referencias DOM
     ---------------------------------------------------------- */
  const menuToggle = container.querySelector('#menu-toggle');
  const navigationContent = container.querySelector('#navigation-content');
  const menuBackdrop = container.querySelector('[data-menu-backdrop]');
  const navigationLinks = container.querySelectorAll('.header-link');
  const searchToggle = container.querySelector('#search-toggle');
  const searchPanel = container.querySelector('#search-panel');
  const searchInput = container.querySelector('#search-input');
  const searchForm = container.querySelector('#search-form');
  const searchSuggestions = container.querySelector('#search-suggestions');
  const searchButton = container.querySelector('#search-button');
  const searchClear = container.querySelector('#search-clear');
  const loginLink = container.querySelector('#login-link');
  const signupLink = container.querySelector('#signup-link');
  const guestActions = container.querySelector('#guest-actions');
  const userActions = container.querySelector('#user-actions');
  const headerUserStats = container.querySelector('#header-user-stats');
  const headerStreak = container.querySelector('#header-streak');
  const headerLevel = container.querySelector('#header-level');
  const headerXpBar = container.querySelector('#header-xp-bar');
  const headerXpPct = container.querySelector('#header-xp-pct');
  const profileRoot = container.querySelector('#header-profile');
  const profileToggle = container.querySelector('#profile-toggle');
  const profileMenu = container.querySelector('#profile-menu');
  const profileInitials = container.querySelector('#profile-initials');
  const profileAvatar = container.querySelector('#profile-avatar');
  const profileName = container.querySelector('#profile-menu-name');
  const profileEmail = container.querySelector('#profile-menu-email');
  const profileRole = container.querySelector('#profile-menu-role');
  const profileUserId = container.querySelector('#profile-menu-id');
  const copyProfileId = container.querySelector('#copy-profile-id');
  const logoutButton = container.querySelector('#logout-button');

  if (!menuToggle || !navigationContent || !menuBackdrop ||
    !searchToggle || !searchPanel || !searchInput || !searchForm ||
    !searchSuggestions || !searchButton || !searchClear || !loginLink || !signupLink ||
    !guestActions || !userActions || !headerUserStats ||
    !profileRoot || !profileToggle || !profileMenu || !profileInitials ||
    !profileAvatar || !profileName || !profileEmail || !profileRole ||
    !profileUserId || !copyProfileId || !logoutButton) {
    throw new Error('Header: estructura del DOM incompleta.');
  }

  /* ----------------------------------------------------------
     Estado
     ---------------------------------------------------------- */
  let menuOpenScrollY = 0;
  let searchDebounceTimer = null;
  let searchController = null;
  let searchRequestId = 0;
  let profileUser = null;
  let destroyed = false;
  const profileController = new AbortController();

  const ICONS = {
    menu: '/assets/icons/svg/menu.svg',
    close: '/assets/icons/svg/x.svg',
  };

  /* ----------------------------------------------------------
     MENÚ MÓVIL
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     BUSCADOR
     ---------------------------------------------------------- */
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

  function buildSearchUrl(query) {
    const url = new URL('/pages/obras.html', window.location.origin);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === url.pathname) {
      url.search = currentUrl.search;
    }
    url.searchParams.set('q', query);
    url.searchParams.delete('all');
    url.searchParams.set('page', '1');
    return url;
  }

  function submitSearch(event) {
    event?.preventDefault();
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchInput.focus();
      return;
    }
    window.location.assign(buildSearchUrl(query).href);
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

  function createSuggestion(work, index) {
    const link = document.createElement('a');
    link.className = 'header-search-suggestion';
    link.href = getWorkUrl(work);
    link.id = `search-suggestion-${index}`;
    link.setAttribute('role', 'option');
    link.setAttribute('aria-selected', 'false');

    const coverUrl = safeUrl(work.cover_url, '');
    if (coverUrl) {
      const cover = document.createElement('img');
      cover.className = 'header-search-suggestion-cover';
      cover.src = coverUrl;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.addEventListener('error', () => cover.remove(), { once: true });
      link.append(cover);
    }

    const copy = document.createElement('span');
    copy.className = 'header-search-suggestion-copy';
    const title = document.createElement('span');
    title.className = 'header-search-suggestion-title';
    title.textContent = work.title || 'Obra sin título';
    copy.append(title);

    const details = [work.alternative_title, work.author]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .slice(0, 2);
    if (details.length) {
      const subtitle = document.createElement('span');
      subtitle.className = 'header-search-suggestion-meta';
      subtitle.textContent = details.join(' · ');
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

    const requestId = ++searchRequestId;
    setSuggestionStatus('Buscando en todo el catálogo…');
    searchDebounceTimer = window.setTimeout(async () => {
      const controller = new AbortController();
      searchController = controller;
      const url = new URL(`${API_BASE_URL.replace(/\/+$/, '')}/v1/works/`);
      url.searchParams.set('q', query);
      url.searchParams.set('per_page', '7');

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (requestId !== searchRequestId || query !== searchInput.value.trim()) return;

        const works = Array.isArray(result.data) ? result.data : [];
        if (!works.length) {
          setSuggestionStatus('No encontramos obras con esa búsqueda.');
          return;
        }

        const options = works.map((work, index) => createSuggestion(work, index));
        const footer = document.createElement('a');
        footer.className = 'header-search-all';
        footer.href = buildSearchUrl(query).href;
        const total = Number(result.pagination?.items?.total ?? works.length);
        footer.textContent = `Ver ${total} ${total === 1 ? 'obra' : 'obras'}`;
        footer.setAttribute('role', 'option');
        footer.setAttribute('aria-selected', 'false');
        searchSuggestions.replaceChildren(...options, footer);
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
    closeProfileMenu();
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

    const name = user.username || user.email || 'Lector';
    profileName.textContent = name;
    profileEmail.textContent = user.email || '';
    profileRole.textContent = user.platform_role || 'USER';
    profileUserId.textContent = user.user_code ? `ID de usuario: ${user.user_code}` : 'ID no disponible';
    profileToggle.setAttribute('aria-label', `Perfil de ${name}. Abrir menú`);
    profileInitials.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase() || 'Y';

    // Stats
    const xp = user.xp || 0;
    const streak = user.streak_days || 0;
    const currentLevel = Math.floor(xp / 1000) + 1;
    const levelXp = xp % 1000;
    const pct = Math.floor((levelXp / 1000) * 100);

    if (headerStreak) headerStreak.textContent = `${streak}d`;
    if (headerLevel) headerLevel.textContent = `Nv. ${currentLevel}`;
    if (headerXpBar) headerXpBar.style.width = `${pct}%`;
    if (headerXpPct) headerXpPct.textContent = `${pct}%`;

    const avatarRing = profileRoot.querySelector('.header-avatar-ring');
    if (avatarRing) {
      avatarRing.style.background = `conic-gradient(from 0deg, var(--teal-500) 0%, var(--teal-500) ${pct}%, var(--neutral-800) ${pct}%, var(--neutral-800) 100%)`;
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
    } else {
      profileAvatar.removeAttribute('src');
      profileAvatar.hidden = true;
      profileInitials.hidden = false;
    }
    /* Actualizar bottom nav con datos del usuario */
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user } }));
  }

  async function loadProfile() {
    if (!getAccessToken()) {
      showGuestActions();
      return;
    }
    try {
      const user = await authRequest('/me', { signal: profileController.signal });
      if (!destroyed) showProfile(user);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.status === 401 || error.status === 400) clearAccessToken();
      if (!destroyed) showGuestActions();
      if (error.status !== 401 && error.status !== 400) {
        console.warn('[header] No se pudo cargar el perfil:', error);
      }
    }
  }

  /* ----------------------------------------------------------
     HANDLERS
     ---------------------------------------------------------- */
  function onMenuToggleClick() {
    if (!isMenuOpen()) {
      closeSearch();
      closeProfileMenu();
    }
    toggleMenu();
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
    toggleSearch();
  }

  function onSearchFormSubmit(event) { submitSearch(event); }

  function onSearchInput() {
    searchClear.hidden = !searchInput.value;
    queueSuggestions();
  }

  function onSearchClearClick() {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === '/pages/obras.html' && currentUrl.searchParams.has('q')) {
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
    const userId = profileUser?.user_code;
    if (!userId || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(userId).then(() => {
      copyProfileId.setAttribute('aria-label', 'ID copiado');
      const originalIdLabel = profileUserId.textContent;
      profileUserId.textContent = 'ID copiado';
      window.setTimeout(() => {
        copyProfileId.setAttribute('aria-label', 'Copiar ID de usuario');
        profileUserId.textContent = originalIdLabel;
      }, 1400);
    }).catch(() => {
      copyProfileId.setAttribute('aria-label', 'No se pudo copiar el ID');
    });
  }

  function onLogoutClick() {
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
  }

  function onEscape(e) {
    if (e.key !== 'Escape') return;
    // Prioridad: buscador → menú
    if (isSearchOpen()) {
      closeSearch({ returnFocus: true });
      return;
    }
    if (!profileMenu.hidden) {
      closeProfileMenu({ returnFocus: true });
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

  /* ----------------------------------------------------------
     BIND
     ---------------------------------------------------------- */
  menuToggle.addEventListener('click', onMenuToggleClick);
  navigationLinks.forEach((link) => link.addEventListener('click', onLinkClick));
  menuBackdrop.addEventListener('click', onBackdropClick);
  searchToggle.addEventListener('click', onSearchToggleClick);
  searchForm.addEventListener('submit', onSearchFormSubmit);
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);
  searchClear.addEventListener('click', onSearchClearClick);
  profileToggle.addEventListener('click', onProfileToggleClick);
  copyProfileId.addEventListener('click', onCopyProfileId);
  logoutButton.addEventListener('click', onLogoutClick);
  document.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onEscape);
  window.addEventListener('scroll', onScroll, { passive: true });
  loadProfile();



  return () => {
    menuToggle.removeEventListener('click', onMenuToggleClick);
    navigationLinks.forEach((link) => link.removeEventListener('click', onLinkClick));
    menuBackdrop.removeEventListener('click', onBackdropClick);
    searchToggle.removeEventListener('click', onSearchToggleClick);
    searchForm.removeEventListener('submit', onSearchFormSubmit);
    searchInput.removeEventListener('input', onSearchInput);
    searchInput.removeEventListener('keydown', onSearchKeydown);
    searchClear.removeEventListener('click', onSearchClearClick);
    profileToggle.removeEventListener('click', onProfileToggleClick);
    copyProfileId.removeEventListener('click', onCopyProfileId);
    logoutButton.removeEventListener('click', onLogoutClick);
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onEscape);
    window.removeEventListener('scroll', onScroll);
    clearSearchRequest();
    destroyed = true;
    profileController.abort();
    document.body.classList.remove('menu-open');
  };
}
