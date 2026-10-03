// Este componente contiene su HTML y activa el comportamiento móvil del navbar.
export function renderSiteHeader(container) {
  container.innerHTML = `
    <nav id="navigation" class="header" aria-label="Navegación principal">
      <a id="brand" class="header-brand" href="index.html">
        <img id="logo" class="header-logo" src="assets/icons/logo.png" alt="YumeZone">
        <span class="header-brand-name">Yume<span>Zone</span></span>
      </a>

      <button id="menu-toggle" class="header-menu-toggle" type="button"
        aria-label="Abrir menú" aria-expanded="false" aria-controls="navigation-content">
        <img class="header-icon" src="assets/icons/svg/menu.svg" alt="" aria-hidden="true">
      </button>

      <div id="navigation-content" class="header-content">
        <div id="navigation-links" class="header-links">
          <a id="home-link" class="header-link" href="index.html">Inicio</a>
          <a id="library-link" class="header-link" href="biblioteca.html">Biblioteca</a>
          <a id="news-link" class="header-link" href="novedades.html">Novedades</a>
          <a id="ranking-link" class="header-link" href="ranking.html">Ranking</a>
          <a id="community-link" class="header-link" href="comunidad.html">Comunidad</a>
        </div>

        <div id="search-container" class="header-search">
          <input id="search-input" class="header-search-input" type="text"
            placeholder="Buscar obras..." aria-label="Buscar obras">
          <button id="search-button" class="header-search-button" type="button" aria-label="Buscar">
            <img class="header-icon" src="assets/icons/svg/search.svg" alt="" aria-hidden="true">
          </button>
        </div>

        <div id="user-actions" class="header-actions">
          <a id="login-link" class="header-action" href="login.html">Iniciar sesión</a>
          <a id="signup-link" class="header-action header-action-primary" href="registro.html">
            Registrarse
          </a>
        </div>
      </div>
    </nav>
  `;
  container.removeAttribute('aria-busy');

  const menuToggle = container.querySelector('#menu-toggle');
  const navigationContent = container.querySelector('#navigation-content');
  const navigationLinks = container.querySelectorAll('.header-link');

  if (!menuToggle || !navigationContent) {
    throw new Error('Falta la estructura del menú del header.');
  }

  function closeMenu() {
    navigationContent.classList.remove('header-content-open');
    navigationContent.style.visibility = 'hidden';
    navigationContent.style.opacity = '0';
    navigationContent.style.transform = 'translateX(100%)';
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    menuToggle.querySelector('img').src = 'assets/icons/svg/menu.svg';
  }

  function toggleMenu() {
    const isOpen = navigationContent.classList.toggle('header-content-open');
    navigationContent.style.visibility = isOpen ? 'visible' : 'hidden';
    navigationContent.style.opacity = isOpen ? '1' : '0';
    navigationContent.style.transform = isOpen ? 'translateX(0)' : 'translateX(100%)';
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    menuToggle.querySelector('img').src = isOpen
      ? 'assets/icons/svg/x.svg'
      : 'assets/icons/svg/menu.svg';
  }

  function closeMenuOnOutsideClick(event) {
    if (
      navigationContent.classList.contains('header-content-open')
      && !navigationContent.contains(event.target)
      && !menuToggle.contains(event.target)
    ) {
      closeMenu();
    }
  }

  function closeMenuOnEscape(event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  }

  menuToggle.addEventListener('click', toggleMenu);
  navigationLinks.forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('click', closeMenuOnOutsideClick);
  document.addEventListener('keydown', closeMenuOnEscape);

  return () => {
    menuToggle.removeEventListener('click', toggleMenu);
    navigationLinks.forEach((link) => link.removeEventListener('click', closeMenu));
    document.removeEventListener('click', closeMenuOnOutsideClick);
    document.removeEventListener('keydown', closeMenuOnEscape);
  };
}
