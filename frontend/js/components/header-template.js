export function getHeaderTemplate() {
  return `
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
              <span class="header-stat-chip header-stat-chip--level" title="Nivel y progreso">
                <span id="header-level">Nv. 1</span>
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
}
