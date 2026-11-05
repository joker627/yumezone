// footer

export function getFooterTemplate() {
  const currentYear = new Date().getFullYear();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isScans = currentPath.includes('/scans.html');

  return `
    <div class="site-footer--glow" aria-hidden="true"></div>
    <div class="footer-container">
      <div class="footer-main-grid">
        <!-- Columna de Marca -->
        <div class="footer-brand-col">
          <a class="footer-logo-row" href="/index.html">
            <img class="footer-logo-img" src="/assets/icons/logo.png" alt="YumeZone" width="36" height="36">
            <span class="footer-brand-name">Yume<span>Zone</span></span>
          </a>
          <p class="footer-brand-desc">
            Tu plataforma definitiva para descubrir y leer mangas, manhwas y manhuas online en español con capítulos actualizados a diario, visor optimizado y una comunidad activa.
          </p>
          <div class="footer-social-row" aria-label="Redes sociales oficiales">
            <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" class="footer-social-pill footer-social-pill--discord" title="Discord Oficial" aria-label="Discord">
              <img src="/assets/icons/svg/social/discord.svg" alt="" width="18" height="18">
            </a>
            <a href="https://t.me/" target="_blank" rel="noopener noreferrer" class="footer-social-pill footer-social-pill--telegram" title="Canal de Telegram" aria-label="Telegram">
              <img src="/assets/icons/svg/social/telegram.svg" alt="" width="18" height="18">
            </a>
            <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" class="footer-social-pill footer-social-pill--facebook" title="Página de Facebook" aria-label="Facebook">
              <img src="/assets/icons/svg/social/facebook.svg" alt="" width="18" height="18">
            </a>
          </div>
        </div>

        <!-- Columna 1: Explorar -->
        <div class="footer-col">
          <h3 class="footer-col-title">Explorar</h3>
          <ul class="footer-nav-list">
            <li><a href="/">Inicio</a></li>
            <li><a href="/pages/catalogo.html">Catálogo Completo</a></li>
            <li><a href="/pages/novedades.html">Últimos Estrenos</a></li>
            <li><a href="/pages/ranking.html">Top Ranking</a></li>
            <li><a href="/pages/scans.html" class="${isScans ? 'active' : ''}">Clanes & Scans</a></li>
            <li><a href="/pages/eventos.html">Eventos de Temporada</a></li>
            <li><a href="/pages/sistema.html">Sistema & Actualizaciones</a></li>
          </ul>
        </div>

        <!-- Columna 2: Tu Espacio -->
        <div class="footer-col">
          <h3 class="footer-col-title">Tu Espacio</h3>
          <ul class="footer-nav-list">
            <li><a href="/pages/biblioteca.html">Mi Biblioteca</a></li>
            <li><a href="/pages/tienda.html">Tienda & Marcos</a></li>
            <li><a href="/pages/login.html">Iniciar Sesión</a></li>
            <li><a href="/pages/registro.html">Crear Cuenta</a></li>
          </ul>
        </div>

        <!-- Columna 3: Legal & Ayuda -->
        <div class="footer-col">
          <h3 class="footer-col-title">Legal & Soporte</h3>
          <ul class="footer-nav-list">
            <li><a href="/pages/terminos.html">Términos de Servicio</a></li>
            <li><a href="/pages/privacidad.html">Política de Privacidad</a></li>
            <li><a href="/pages/dmca.html">Aviso Legal & DMCA</a></li>
            <li><a href="https://discord.gg/" target="_blank" rel="noopener noreferrer">Centro de Soporte</a></li>
            <li><a href="https://discord.gg/" target="_blank" rel="noopener noreferrer">Reportar un Error</a></li>
          </ul>
        </div>
      </div>

      <!-- Recuadro de descargo legal / DMCA -->
      <div class="footer-legal-box">
        <img src="/assets/icons/svg/content/info.svg" alt="" class="footer-legal-icon" aria-hidden="true" width="20" height="20">
        <p class="footer-legal-text">
          <strong>Aviso legal:</strong> YumeZone no aloja ningún archivo con derechos de autor ni contenido multimedia en sus propios servidores. Todo el material es enlazado o aportado por grupos de traducción externos e indexado con fines recreativos. Los derechos de propiedad intelectual pertenecen exclusivamente a sus respectivos autores, ilustradores y casas editoriales. Si eres propietario de alguna obra y deseas su retirada, puedes consultar nuestra sección <a href="/pages/dmca.html" style="color: var(--teal-400); text-decoration: underline;">DMCA y Retiro</a>.
        </p>
      </div>

      <!-- Barra inferior -->
      <div class="footer-bottom-bar">
        <p class="footer-copy">
          &copy; <span class="footer-year">${currentYear}</span> <a href="/">YumeZone</a>. Todos los derechos reservados.
        </p>
      </div>
    </div>
  `;
}

export function renderSiteFooter(container) {
  if (!container) return;

  // evitar duplicados
  if (container.dataset.mounted === 'true') {
    return;
  }
  container.dataset.mounted = 'true';

  // inyectar template
  if (!container.dataset.rendered || !container.querySelector('.footer-container') || !container.querySelector('a[href*="scans.html"]')) {
    container.innerHTML = getFooterTemplate();
    container.classList.add('site-footer');
    container.dataset.rendered = 'true';
  } else {
    // actualizar ano
    const yearEl = container.querySelector('.footer-year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }
}
