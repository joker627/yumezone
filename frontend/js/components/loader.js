/** Esqueletos de carga (skeletons-only): cada generador replica el layout real que sustituye. */

/** Tarjetas del catálogo (.catalog-card). */
export function renderSkeletonCards(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-card" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-cover"></div>
      <div class="yz-skeleton-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--sub"></div>
        <div class="yz-skeleton-pills">
          <div class="yz-skeleton yz-skeleton-pill"></div>
          <div class="yz-skeleton yz-skeleton-pill"></div>
        </div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton-actions-row">
          <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--w50"></div>
          <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--tag"></div>
        </div>
      </div>
    </div>
  `).join('');
}

/** Obras del perfil (.profile-work-card). */
export function renderProfileWorkSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-profile-work" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-profile-thumb"></div>
      <div class="yz-skeleton-profile-work-info">
        <div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w60"></div>
        </div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full yz-skeleton-line--auto"></div>
      </div>
    </div>
  `).join('');
}

/** Medallas y logros del perfil (.profile-badge-item). */
export function renderBadgeSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-badge" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-badge-icon"></div>
      <div class="yz-skeleton-badge-body">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w60"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
      </div>
    </div>
  `).join('');
}

/** Desglose de géneros más leídos del perfil. */
export function renderGenresSkeleton() {
  const bars = Array.from({ length: 4 }, () => `
    <div class="yz-skeleton-genre-bar" aria-hidden="true">
      <div class="yz-skeleton-genre-bar-head">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
      </div>
      <div class="yz-skeleton yz-skeleton-genre-track"></div>
    </div>
  `).join('');

  return `<div class="yz-skeleton-genres-wrap" role="status" aria-label="Cargando estadísticas de géneros">${bars}</div>`;
}

/** Lista del Ranking Global (.ranking-list-item). */
export function renderRankingSkeletons(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-ranking" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-ranking-num"></div>
      <div class="yz-skeleton yz-skeleton-ranking-cover"></div>
      <div class="yz-skeleton-ranking-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--sub"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short"></div>
      </div>
      <div class="yz-skeleton yz-skeleton-ranking-badge"></div>
    </div>
  `).join('');
}

/** Listas de Novedades y Estrenos (.novedad-list-item). */
export function renderNovedadesSkeletons(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-novedad" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-novedad-cover"></div>
      <div class="yz-skeleton-novedad-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w60"></div>
      </div>
    </div>
  `).join('');
}

/** Tarjetas de biblioteca (portada + cuerpo + progreso). */
export function renderLibrarySkeletons(count = 6) {
  const cards = Array.from({ length: count }, () => `
    <div class="yz-skeleton-library-card" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-cover"></div>
      <div class="yz-skeleton-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short"></div>
        <div class="yz-skeleton yz-skeleton-progress"></div>
        <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--full yz-skeleton-line--auto"></div>
      </div>
    </div>
  `).join('');

  return `<div class="yz-skeleton-grid yz-skeleton-grid--library" role="status" aria-label="Cargando biblioteca">${cards}</div>`;
}

/** Tarjetas de la tienda de cosméticos (.shop-card). */
export function renderShopSkeletons(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-shop-card" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-shop-preview"></div>
      <div class="yz-skeleton-shop-info">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--short"></div>
        <div class="yz-skeleton yz-skeleton-shop-btn"></div>
      </div>
    </div>
  `).join('');
}

/** Comentarios de obra (.comment-main). */
export function renderCommentSkeletons(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-comment" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-comment-avatar"></div>
      <div class="yz-skeleton-comment-body">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--sub"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w70"></div>
        <div class="yz-skeleton-actions-row">
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        </div>
      </div>
    </div>
  `).join('');
}

/** Filas tipo feed/actividad (avatar circular + líneas). */
export function renderSkeletonRows(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-row" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-avatar"></div>
      <div class="yz-skeleton-row-lines">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w60"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
      </div>
    </div>
  `).join('');
}
