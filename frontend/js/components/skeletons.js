// esqueletos de carga

// hero principal del home
export function renderHeroSkeleton() {
  return `
    <div class="hero-content is-skeleton" aria-hidden="true">
      <div class="hero-main">
        <div class="hero-badges">
          <span class="hero-badge is-skeleton"><span class="is-loading is-loading--md"></span></span>
          <span class="hero-rating is-skeleton"><span class="is-loading is-loading--sm"></span></span>
        </div>
        <div class="hero-eyebrow is-skeleton">
          <span class="is-loading is-loading--sm"></span>
        </div>
        <h1 class="hero-title">
          <span class="is-loading is-loading--block is-loading--w60" style="height: 2.5rem; margin-bottom: 0.6rem; border-radius: 6px;"></span>
          <span class="is-loading is-loading--block is-loading--w40" style="height: 2.5rem; border-radius: 6px;"></span>
        </h1>
        <p class="hero-synopsis">
          <span class="is-loading is-loading--block"></span>
          <span class="is-loading is-loading--block"></span>
          <span class="is-loading is-loading--block is-loading--w80"></span>
        </p>
        <div class="hero-genres">
          <span class="is-loading is-loading--pill" style="width: 75px; height: 26px;"></span>
          <span class="is-loading is-loading--pill" style="width: 75px; height: 26px;"></span>
          <span class="is-loading is-loading--pill" style="width: 85px; height: 26px;"></span>
        </div>
        <div class="hero-actions">
          <span class="is-loading" style="width: 110px; height: 42px; border-radius: 8px;"></span>
          <span class="is-loading" style="width: 110px; height: 42px; border-radius: 8px;"></span>
          <span class="is-loading" style="width: 100px; height: 42px; border-radius: 8px;"></span>
        </div>
      </div>
      <aside class="hero-next is-skeleton" aria-label="Próximo capítulo">
        <header class="hero-next-header">
          <span class="is-loading is-loading--md"></span>
        </header>
        <h3 class="hero-next-title"><span class="is-loading is-loading--block is-loading--w90"></span></h3>
        <p class="hero-next-meta"><span class="is-loading is-loading--sm"></span></p>
        <footer class="hero-next-footer">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--xs"></span>
        </footer>
      </aside>
    </div>
  `;
}

// esqueletos del home (nuevos lanzamientos, ranking, populares, anuncios, chat, misiones)
export function renderHomeSkeletons(type, count = 4) {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'launch') {
      html += `
      <article class="launch-item is-skeleton" aria-hidden="true">
        <div class="launch-item--cover-wrap yz-skeleton"></div>
        <div class="launch-item--info">
          <div class="launch-item--head">
            <span class="is-loading is-loading--sm"></span>
            <span class="is-loading is-loading--md"></span>
          </div>
          <h3 class="launch-item--title">
            <span class="is-loading is-loading--block is-loading--w90"></span>
          </h3>
          <div class="launch-item--meta">
            <span class="is-loading is-loading--sm"></span>
            <span class="is-loading is-loading--xs"></span>
          </div>
        </div>
        <div class="launch-item--action" aria-hidden="true">
          <span class="is-loading" style="width: 16px; height: 16px; border-radius: 50%;"></span>
        </div>
      </article>`;
    } else if (type === 'rank') {
      html += `
      <article class="rank-card is-skeleton" aria-hidden="true">
        <div class="rank-card--num"><span class="is-loading is-loading--xs"></span></div>
        <div class="rank-card--cover-wrap yz-skeleton"></div>
        <div class="rank-card--info">
          <div class="rank-card--head">
            <h3 class="rank-card--title"><span class="is-loading is-loading--block is-loading--w80"></span></h3>
            <span class="is-loading is-loading--sm"></span>
          </div>
          <p class="rank-card--author"><span class="is-loading is-loading--md"></span></p>
          <div class="rank-card--meta">
            <span class="is-loading is-loading--sm"></span>
            <span class="is-loading is-loading--sm"></span>
          </div>
        </div>
      </article>`;
    } else if (type === 'popular') {
      html += `
      <article class="popular-card is-skeleton" aria-hidden="true">
        <div class="popular-card--cover-wrap yz-skeleton"></div>
        <div class="popular-card--info">
          <h3 class="popular-card--title"><span class="is-loading is-loading--block is-loading--w90"></span></h3>
          <p class="popular-card--studio"><span class="is-loading is-loading--sm"></span></p>
          <div class="popular-card--tags">
            <span class="is-loading is-loading--sm"></span>
            <span class="is-loading is-loading--xs"></span>
          </div>
          <div class="popular-card--footer">
            <span class="popular-card--chapter-info"><span class="is-loading is-loading--sm"></span></span>
            <span class="popular-card--hearts"><span class="is-loading is-loading--xs"></span></span>
          </div>
        </div>
      </article>`;
    } else if (type === 'anuncio') {
      html += `
      <div class="announcement is-skeleton" aria-hidden="true">
        <div class="card-top">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--xs"></span>
        </div>
        <div class="card-title" style="margin-bottom: 6px;"><span class="is-loading is-loading--block is-loading--w80"></span></div>
        <div class="card-preview">
          <span class="is-loading is-loading--block"></span>
          <span class="is-loading is-loading--block is-loading--w60"></span>
        </div>
      </div>`;
    } else if (type === 'chat') {
      html += `
      <div class="chat-msg is-skeleton" aria-hidden="true">
        <div class="chat-msg--avatar">
          <div class="chat-msg--avatar-inner yz-skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
        </div>
        <div class="chat-msg--body">
          <div class="chat-msg--header">
            <span class="chat-msg--name"><span class="is-loading is-loading--sm"></span></span>
            <span class="chat-msg--level"><span class="is-loading is-loading--xs"></span></span>
            <span class="chat-msg--time"><span class="is-loading is-loading--xs"></span></span>
          </div>
          <div class="chat-msg--text">
            <span class="is-loading is-loading--block is-loading--w90"></span>
          </div>
        </div>
      </div>`;
    } else if (type === 'mision') {
      html += `
      <div class="mision-card is-skeleton" aria-hidden="true">
        <div class="mision-card--top">
          <div class="mision-card--title-wrap">
            <span class="mision-icon-badge yz-skeleton" style="width: 28px; height: 28px; border-radius: 6px; display: inline-block;"></span>
            <div class="mision-card--meta">
              <h4 class="mision-card--title"><span class="is-loading is-loading--md"></span></h4>
              <div class="mision-card--sub"><span class="is-loading is-loading--lg"></span></div>
            </div>
          </div>
          <div class="mision-rewards-group">
            <span class="is-loading is-loading--xs"></span>
          </div>
        </div>
        <div class="mision-card--bottom">
          <div class="mision-card--progress-group">
            <div class="mision-card--bar"></div>
            <span class="mision-card--prog-text"><span class="is-loading is-loading--xs"></span></span>
          </div>
          <span class="is-loading is-loading--sm" style="border-radius: 6px; height: 24px;"></span>
        </div>
      </div>`;
    }
  }
  return html;
}

// tarjetas del catálogo (.catalog-card)
export function renderSkeletonCards(count = 6) {
  return Array.from({ length: count }, () => `
    <article class="catalog-card is-skeleton" aria-hidden="true">
      <span class="catalog-card-cover-link yz-skeleton"></span>
      <div class="catalog-card-info">
        <span class="catalog-card-title">
          <span class="is-loading is-loading--block is-loading--w90"></span>
        </span>
        <div class="catalog-card-meta">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--xs"></span>
        </div>
        <div class="catalog-card-chapters">
          <span class="is-loading is-loading--xs"></span>
        </div>
      </div>
    </article>
  `).join('');
}

// obras del perfil (.showcase-work-card)
export function renderProfileWorkSkeletons(count = 6) {
  return Array.from({ length: count }, () => `
    <article class="showcase-work-card is-skeleton" aria-hidden="true">
      <span class="showcase-work-card__cover yz-skeleton"></span>
      <div class="showcase-work-card__body">
        <div>
          <span class="showcase-work-card__format"><span class="is-loading is-loading--sm"></span></span>
          <h4 class="showcase-work-card__title">
            <span class="is-loading is-loading--block"></span>
            <span class="is-loading is-loading--block is-loading--w60"></span>
          </h4>
        </div>
        <div class="showcase-work-card__progress">
          <div class="showcase-work-card__progress-meta">
            <span class="is-loading is-loading--sm"></span>
            <span class="is-loading is-loading--xs"></span>
          </div>
          <div class="showcase-work-card__bar"></div>
          <span class="showcase-work-card__resume"><span class="is-loading is-loading--md"></span></span>
        </div>
      </div>
    </article>
  `).join('');
}

// inventario del perfil (.inv-item-row)
export function renderProfileInventorySkeletons(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="inv-item-row is-skeleton" aria-hidden="true">
      <span class="inv-item__thumb yz-skeleton"></span>
      <div class="inv-item__info">
        <div class="inv-item__title-line">
          <strong class="inv-item__name"><span class="is-loading is-loading--md"></span></strong>
          <span class="is-loading is-loading--sm"></span>
        </div>
        <span class="inv-item__status"><span class="is-loading is-loading--lg"></span></span>
      </div>
    </div>
  `).join('');
}

// medallas del perfil (.badge-tile)
export function renderBadgeSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="badge-tile is-skeleton" aria-hidden="true">
      <div class="badge-tile__icon yz-skeleton"></div>
      <div class="badge-tile__info">
        <strong class="badge-tile__name"><span class="is-loading is-loading--md"></span></strong>
        <span class="badge-tile__progress"><span class="is-loading is-loading--sm"></span></span>
      </div>
    </div>
  `).join('');
}

// historial de monedas (.coin-tx-row)
export function renderCoinTxSkeletons(count = 5) {
  return Array.from({ length: count }, () => `
    <div class="coin-tx-row is-skeleton" aria-hidden="true">
      <div class="coin-tx-row__info">
        <strong><span class="is-loading is-loading--lg"></span></strong>
        <span><span class="is-loading is-loading--md"></span></span>
      </div>
      <div class="coin-tx-row__amount"><span class="is-loading is-loading--sm"></span></div>
    </div>
  `).join('');
}

// grilla de gifs del chat (.chat-gif-item)
export function renderGifSkeletons(count = 12) {
  return Array.from({ length: count }, () => `
    <div class="chat-gif-item is-skeleton yz-skeleton" aria-hidden="true"></div>
  `).join('');
}

// obras del modal de clan (.clan-work-card)
export function renderClanWorksSkeletons(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="clan-work-card is-skeleton" aria-hidden="true">
      <div class="clan-work-cover-wrap yz-skeleton"></div>
      <div class="clan-work-info">
        <h4 class="clan-work-title"><span class="is-loading is-loading--block is-loading--w80"></span></h4>
        <div class="clan-work-meta">
          <span class="is-loading is-loading--md"></span>
          <span class="is-loading is-loading--xs"></span>
        </div>
        <div class="clan-work-meta"><span class="is-loading is-loading--sm"></span></div>
      </div>
    </div>
  `).join('');
}

// miembros del modal de clan (.clan-member-card)
export function renderClanMembersSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="clan-member-card is-skeleton" aria-hidden="true">
      <span class="clan-member-avatar yz-skeleton"></span>
      <div class="clan-member-details">
        <div class="clan-member-name"><span class="is-loading is-loading--md"></span></div>
        <span class="is-loading is-loading--pill"></span>
      </div>
    </div>
  `).join('');
}

// ranking global (.ranking-list-item)
export function renderRankingSkeletons(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="ranking-list-item is-skeleton" aria-hidden="true">
      <div class="ranking-num"><span class="is-loading is-loading--xs"></span></div>
      <div class="ranking-cover yz-skeleton"></div>
      <div class="item-info-col">
        <p class="item-title"><span class="is-loading is-loading--block is-loading--w80"></span></p>
        <p class="item-author"><span class="is-loading is-loading--md"></span></p>
        <div class="item-meta">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--md"></span>
        </div>
      </div>
      <span class="is-loading is-loading--pill"></span>
    </div>
  `).join('');
}

// listas de novedades y estrenos (.novedad-list-item)
export function renderNovedadesSkeletons(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="novedad-list-item is-skeleton" aria-hidden="true">
      <div class="novedad-cover yz-skeleton"></div>
      <div class="novedad-info-col">
        <div class="novedad-tag-studio">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--md"></span>
        </div>
        <p class="novedad-title"><span class="is-loading is-loading--block is-loading--w80"></span></p>
        <div class="item-meta">
          <span class="is-loading is-loading--sm"></span>
          <span class="is-loading is-loading--xs"></span>
        </div>
      </div>
    </div>
  `).join('');
}

// tarjetas de biblioteca
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

// tarjetas de la tienda de cosméticos (.shop-card)
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

// comentarios de obra (.comment-main)
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

// filas tipo feed/actividad
export function renderSkeletonRows(count = 4) {
  const rows = Array.from({ length: count }, () => `
    <div class="yz-skeleton-row" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-avatar"></div>
      <div class="yz-skeleton-row-lines">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w60"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
      </div>
    </div>
  `).join('');

  return `<div class="yz-skeleton-rows">${rows}</div>`;
}

// tarjetas de clanes y scans de traducción (.scan-card)
export function renderScanSkeletons(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="yz-skeleton-scan-card" aria-hidden="true">
      <div class="yz-skeleton yz-skeleton-scan-banner"></div>
      <div class="yz-skeleton-scan-body">
        <div class="yz-skeleton yz-skeleton-scan-avatar"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--sub"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
        <div class="yz-skeleton-actions-row">
          <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--full"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// detalle completo de obra
export function renderWorkDetailSkeleton(chaptersCount = 4) {
  const chapters = Array.from({ length: chaptersCount }, () => `
    <div class="yz-skeleton-chapter">
      <div class="yz-skeleton yz-skeleton-chapter-title"></div>
      <div class="yz-skeleton yz-skeleton-chapter-date"></div>
      <div class="yz-skeleton yz-skeleton-chapter-circle"></div>
    </div>
  `).join('');

  return `
    <section class="work-detail-hero">
      <div class="work-detail-hero-shade"></div>
      <div class="work-detail-main">
        <div class="work-detail-cover-wrap yz-skeleton"></div>
        <div class="work-detail-copy">
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--hero-title"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--sub"></div>
          <div class="work-detail-genres">
            <div class="yz-skeleton yz-skeleton-pill"></div>
            <div class="yz-skeleton yz-skeleton-pill"></div>
            <div class="yz-skeleton yz-skeleton-pill"></div>
          </div>
          <div class="work-detail-taxonomy">
            <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w50"></div>
          </div>
          <div class="work-detail-actions">
            <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--w50"></div>
            <div class="yz-skeleton yz-skeleton-btn yz-skeleton-line--w50"></div>
          </div>
        </div>
      </div>
    </section>

    <div class="work-detail-columns">
      <section class="work-detail-panel">
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
        <div class="work-skeleton-lines">
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--full"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--w80"></div>
        </div>
      </section>
      <section class="work-detail-panel">
        <div class="work-detail-chapters-heading">
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--title"></div>
          <div class="yz-skeleton yz-skeleton-line yz-skeleton-line--tag"></div>
        </div>
        <div class="yz-skeleton-rows">
          ${chapters}
        </div>
      </section>
    </div>
  `;
}

// páginas cascada del lector vertical (#reader-loading)
export function renderReaderPagesSkeleton() {
  return `
    <div class="yz-skeleton-pages" role="status" aria-label="Cargando páginas del capítulo">
      <div class="yz-skeleton yz-skeleton-page yz-skeleton-page--lg" aria-hidden="true"></div>
      <div class="yz-skeleton yz-skeleton-page yz-skeleton-page--md" aria-hidden="true"></div>
      <div class="yz-skeleton yz-skeleton-page yz-skeleton-page--sm" aria-hidden="true"></div>
    </div>
  `;
}

// mapa de esqueletos
const SKELETON_RENDERERS = {
  hero: () => renderHeroSkeleton(),
  'home-launch': (count, cols) => renderHomeSkeletons('launch', count || 6, cols || 2),
  'home-rank': (count, cols) => renderHomeSkeletons('rank', count || 6, cols || 3),
  'home-popular': (count, cols) => renderHomeSkeletons('popular', count || 4, cols || 4),
  'home-anuncio': (count, cols) => renderHomeSkeletons('anuncio', count || 1, cols || 1),
  'home-mision': (count, cols) => renderHomeSkeletons('mision', count || 1, cols || 1),
  'home-chat': (count, cols) => renderHomeSkeletons('chat', count || 4, cols || 1),
  cards: (count) => renderSkeletonCards(count || 6),
  'profile-works': (count) => renderProfileWorkSkeletons(count || 6),
  'profile-inventory': (count) => renderProfileInventorySkeletons(count || 3),
  badges: (count) => renderBadgeSkeletons(count || 4),
  'coin-tx': (count) => renderCoinTxSkeletons(count || 5),
  gifs: (count) => renderGifSkeletons(count || 12),
  ranking: (count) => renderRankingSkeletons(count || 8),
  novedades: (count) => renderNovedadesSkeletons(count || 8),
  library: (count) => renderLibrarySkeletons(count || 6),
  shop: (count) => renderShopSkeletons(count || 8),
  comments: (count) => renderCommentSkeletons(count || 3),
  rows: (count) => renderSkeletonRows(count || 4),
  scans: (count) => renderScanSkeletons(count || 6),
  'work-detail': (count) => renderWorkDetailSkeleton(count || 4),
  'reader-pages': () => renderReaderPagesSkeleton(),
};

// hidratar esqueletos
export function initAutoSkeletons(root = document) {
  const containers = root.querySelectorAll('[data-skeleton]');
  containers.forEach((el) => {
    if (el.children.length > 0) return;
    const type = el.dataset.skeleton;
    const renderer = SKELETON_RENDERERS[type];
    if (typeof renderer === 'function') {
      const count = Number.parseInt(el.dataset.skeletonCount || '0', 10) || undefined;
      const cols = Number.parseInt(el.dataset.skeletonCols || '0', 10) || undefined;
      el.innerHTML = renderer(count, cols);
    }
  });
}
