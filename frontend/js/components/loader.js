/**
 * YUMEZONE - Componente de Carga Universal (Loader & Skeletons)
 */

/**
 * Genera el marcado HTML para el loader universal con diseño de marca YumeZone.
 * @param {Object} options
 * @param {string} [options.text='Cargando obras…'] Texto que acompaña al loader
 * @param {'sm'|'md'|'lg'} [options.size='md'] Tamaño del loader
 * @param {string} [options.className=''] Clases CSS adicionales
 * @returns {string} HTML string
 */
export function renderLoader({ text = 'Cargando obras…', size = 'md', className = '' } = {}) {
  const sizeClass = size !== 'md' ? `yz-loader--${size}` : '';
  return `
    <div class="yz-loader ${sizeClass} ${className}" role="status" aria-live="polite">
      <div class="yz-spinner" aria-hidden="true">
        <div class="yz-spinner-ring"></div>
        <div class="yz-spinner-core"></div>
        <div class="yz-spinner-dot"></div>
      </div>
      ${text ? `<p class="yz-loader-text">${text}</p>` : ''}
    </div>
  `.trim();
}

/**
 * Inserta el loader en un elemento contenedor y activa el atributo aria-busy.
 * @param {HTMLElement} container
 * @param {Object} options
 */
export function showLoader(container, options = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderLoader(options);
}

/**
 * Restablece el atributo aria-busy y limpia el loader.
 * @param {HTMLElement} container
 */
export function hideLoader(container) {
  if (!container) return;
  container.setAttribute('aria-busy', 'false');
}

/**
 * Genera un grid de esqueletos de tarjetas para transiciones fluidas de contenido.
 * @param {number} [count=6]
 * @returns {string} HTML string
 */
export function renderCardSkeletons(count = 6) {
  const cards = Array.from({ length: count }, () => `
    <div class="yz-skeleton-card" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-cover"></div>
      <div class="yz-skeleton-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short" style="margin-top: auto;"></div>
      </div>
    </div>
  `).join('');

  return `<div class="yz-skeleton-grid" role="status" aria-label="Cargando contenido">${cards}</div>`;
}
