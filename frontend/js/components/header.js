import { authRequest, apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, escapeHTML, formatTimeAgo, applyDataProgress } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import { initPresence, disconnectPresence } from '../shared/presence.js';
import { renderSkeletonRows } from './loader.js';
import { getHeaderTemplate } from './header-template.js';

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

/** Header global con menú y búsqueda en vivo del catálogo. */
export function renderSiteHeader(container) {
  if (!container) throw new Error('renderSiteHeader: container requerido.');

  container.innerHTML = getHeaderTemplate();
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

  // Referencias a los marcos del anillo (avatar frames)
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

  async function loadNotifications(silent = false) {
    try {
      const response = await apiRequest('/notifications/?unread_only=true');
      const items = response?.data || [];
      const count = response?.unread_count ?? items.length;

      updateBellBadge(count);

      if (notificationsReadAll) notificationsReadAll.hidden = items.length === 0;
      if (notificationsClearAll) notificationsClearAll.hidden = items.length === 0;

      // Si es actualización en segundo plano y el menú está cerrado, no redibujar el DOM
      if (silent && notificationsMenu.hidden) {
        return;
      }

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
          targetUrl = `/pages/leer.html?capitulo=${encodeURIComponent(payload.chapter_id)}`;
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

        // Al hacer clic en la X de descartar: se elimina directamente
        dismissBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          removeWithAnimation();
        });

        // Al hacer clic en el cuerpo de la notificación: se elimina y navega al contenido
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

    // Ocultar marcos de avatar
    if (profileAvatarFrame) profileAvatarFrame.hidden = true;
    if (profileCardAvatarFrame) profileCardAvatarFrame.hidden = true;

    closeProfileMenu();
    try { localStorage.removeItem('user'); } catch { }
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

    // Stats principales
    const xp = user.xp || 0;
    const coins = user.coins || 0;
    const streak = user.streak_days || 0;
    const currentLevel = Math.floor(xp / 1000) + 1;
    const levelXp = xp % 1000;
    const pct = Math.floor((levelXp / 1000) * 100);

    if (headerStreak) headerStreak.textContent = `${streak}d`;
    if (headerLevel) headerLevel.textContent = `Nv. ${currentLevel}`;
    if (headerStatPill) {
      headerStatPill.title = `Nivel ${currentLevel} · Racha: ${streak}d · Clic para ver estadísticas`;
    }

    // Anillo de progreso del avatar en el header (conic-gradient fluido)
    if (avatarRing) {
      avatarRing.style.setProperty('--avatar-xp-pct', `${pct}%`);
      avatarRing.title = `Nivel ${currentLevel} (${pct}% XP) · ${levelXp}/1000 XP`;
    }

    // Desplegable de progreso del Header
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

    /* Actualizar bottom nav con datos del usuario */
    window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { user } }));
  }

  /* STATS DROPDOWN */
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
    } catch { }

    try {
      const user = await authRequest('/me', { signal: profileController.signal });
      if (!destroyed) {
        try {
          localStorage.setItem('user', JSON.stringify(user));
        } catch { }
        showProfile(user);
        window.dispatchEvent(new CustomEvent('auth:user-synced', { detail: { user } }));
        checkStreakNotification(user);
        // Cargar conteo rápido inicial al autenticar
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
