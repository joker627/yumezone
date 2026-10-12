/**
 * Componentes unificados de tarjetas para Obras, Lanzamientos y Rankings.
 */
import { esc, safeUrl, IMG_FALLBACK, makeWorkUrl, makeReaderUrl, formatViews } from '../shared/ui-utils.js';

export function renderLaunchItem(item, { isCompact = false } = {}) {
  const work = item.work ?? item;
  const tag = esc(item.tag_type ?? item.tag ?? 'nuevo');
  const tagLabel = esc(item.tag_label ?? item.tagLabel ?? item.format_name ?? tag).toUpperCase();
  const studio = esc(work.author ?? work.studio ?? item.author ?? 'Scan');
  const title = esc(work.title ?? item.title ?? 'Sin título');
  
  let chapter = esc(item.chapter_text ?? item.chapter ?? '');
  if (chapter && !chapter.toLowerCase().startsWith('c')) chapter = 'C. ' + chapter;
  
  const time = esc(item.published_text ?? item.time ?? '');
  const rating = item.rating ?? work.stats?.rating_average ?? item.rating_average ?? '';
  const ratingFmt = rating ? Number(rating).toFixed(1) : '';
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, IMG_FALLBACK));
  const href = item.href ?? makeWorkUrl(work.slug ?? item.slug);
  const chapterHref = item.chapter_href ?? href;

  if (isCompact) {
    return `
    <a class="novedad-list-item" href="${esc(chapterHref)}">
      <img class="novedad-cover" src="${coverUrl}" alt="${title}" loading="lazy">
      <div class="novedad-info-col">
        <div class="novedad-tag-studio"><span class="novedad-tag-label">${tagLabel}</span> <span>${studio}</span></div>
        <p class="novedad-title">${title}</p>
        <div class="item-meta">
          <span class="novedad-chapter">${chapter}</span>
          <span>${time}</span>
          ${ratingFmt ? `<span class="item-rating">★ ${ratingFmt}</span>` : ''}
        </div>
      </div>
    </a>`;
  }

  return `
  <a class="launch-item" href="${esc(chapterHref)}">
    <div class="launch-item--cover-wrap">
      <img class="launch-item--cover" src="${coverUrl}" alt="${title}" loading="lazy">
      <span class="launch-item--chapter-badge">${chapter}</span>
    </div>
    <div class="launch-item--info">
      <div class="launch-item--head">
        <span class="launch-item--tag launch-item--tag--${tag}">${tagLabel}</span>
        <span class="launch-item--studio">${studio}</span>
      </div>
      <h3 class="launch-item--title">${title}</h3>
      <div class="launch-item--meta">
        <span class="launch-item--time">${time}</span>
        ${ratingFmt ? `<span class="launch-item--rating">★ ${ratingFmt}</span>` : ''}
      </div>
    </div>
    <div class="launch-item--action" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  </a>`;
}

export function renderRankCard(item, index, { isList = false } = {}) {
  const work = item.work ?? item;
  const pos = item.position ?? item.pos ?? (index + 1);
  const posClass = pos <= 3 ? `rank-card--num--${pos}` : '';
  const title = esc(work.title ?? item.title ?? 'Sin título');
  const author = esc(work.author ?? item.author ?? '');
  const rating = item.rating ?? item.rating_average ?? work.stats?.rating_average ?? '';
  const ratingFmt = rating ? Number(rating).toFixed(1) : '';
  const reads = esc(item.reads_formatted ?? item.reads ?? '');
  const format = esc(work.format_name ?? item.format_name ?? item.badge ?? work.format?.name ?? '');
  const formatClass = format ? `rank-card--badge--${format.toLowerCase()}` : '';
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, IMG_FALLBACK));
  const href = esc(item.href ?? makeWorkUrl(work.slug ?? item.slug));

  if (isList) {
    return `
    <a class="ranking-list-item" href="${href}">
      <div class="ranking-num ${pos <= 3 ? 'ranking-num-top' : ''}">${pos}</div>
      <img class="ranking-cover" src="${coverUrl}" alt="${title}" loading="lazy">
      <div class="item-info-col">
        <p class="item-title">${title}</p>
        ${author ? `<p class="item-author">${author}</p>` : ''}
        <div class="item-meta">
          ${ratingFmt ? `<span class="item-rating">★ ${ratingFmt}</span>` : ''}
          ${reads ? `<span>👁 ${reads}</span>` : ''}
        </div>
      </div>
      ${format ? `<span class="ranking-format-badge">${format}</span>` : ''}
    </a>`;
  }

  return `
  <a class="rank-card" href="${href}">
    <div class="rank-card--num ${posClass}">${pos}</div>
    <div class="rank-card--cover-wrap">
      <img class="rank-card--cover" src="${coverUrl}" alt="${title}" loading="lazy">
    </div>
    <div class="rank-card--info">
      <div class="rank-card--head">
        <h3 class="rank-card--title">${title}</h3>
        ${format ? `<span class="rank-card--badge ${formatClass}">${format}</span>` : ''}
      </div>
      ${author ? `<p class="rank-card--author">${author}</p>` : ''}
      <div class="rank-card--meta">
        ${ratingFmt ? `<span class="rank-card--rating">★ ${ratingFmt}</span>` : ''}
        ${reads ? `<span class="rank-card--reads">· ${reads} lecturas</span>` : ''}
      </div>
    </div>
  </a>`;
}

export function renderPopularCard(item) {
  const work = item.work ?? item;
  const title = esc(work.title ?? item.title ?? 'Sin título');
  const author = esc(work.author ?? item.author ?? item.studio ?? '');
  let chapter = esc(item.chapter_text ?? item.chapter ?? '');
  if (chapter && !chapter.toLowerCase().startsWith('c') && !isNaN(chapter)) {
    chapter = 'Cap. ' + chapter;
  }
  const rating = item.rating ?? item.rating_average ?? work.stats?.rating_average ?? '';
  const ratingFmt = rating ? Number(rating).toFixed(1) : '';
  const ratingCount = item.rating_count ?? work.stats?.rating_count ?? '';
  const favCount = item.favorites_count ?? work.stats?.favorites_count ?? item.favorites ?? '';
  const hearts = item.favorites_formatted ?? (favCount !== '' ? `${favCount}` : '');
  const tags = (work.genres ?? item.tags ?? []).slice(0, 2).map(g =>
    `<span class="popular-card--tag">${esc(g.name ?? g)}</span>`
  ).join('');
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, IMG_FALLBACK));
  const href = esc(item.href ?? makeWorkUrl(work.slug ?? item.slug));
  const formatBadge = esc(work.format_name ?? work.format?.name ?? item.format?.name ?? '');

  return `
  <a class="popular-card" href="${href}">
    <div class="popular-card--cover-wrap">
      <img class="popular-card--cover" src="${coverUrl}" alt="${title}" loading="lazy">
      ${formatBadge ? `<span class="popular-card--format-badge">${formatBadge}</span>` : ''}
      <div class="popular-card--cover-bottom">
        ${ratingFmt ? `<span class="popular-card--rating">★ ${ratingFmt}${ratingCount ? ` <small class="popular-card--rating-votes">(${ratingCount})</small>` : ''}</span>` : ''}
      </div>
    </div>
    <div class="popular-card--info">
      <h3 class="popular-card--title" title="${title}">${title}</h3>
      ${author ? `<p class="popular-card--studio">${author}</p>` : ''}
      ${tags ? `<div class="popular-card--tags">${tags}</div>` : ''}
      <div class="popular-card--footer">
        <span class="popular-card--chapter-info">${chapter || 'Actualizado'}</span>
        ${hearts !== '' ? `<span class="popular-card--hearts">♥ ${esc(hearts)}</span>` : ''}
      </div>
    </div>
  </a>`;
}

export function renderCatalogCard(work) {
  const workSlug = work.slug || work.work_slug;
  const workUrl = makeWorkUrl(workSlug || work);
  const readerUrl = (work.first_chapter_id && makeReaderUrl(workSlug || work, work.first_chapter_id)) || workUrl;
  const coverUrl = esc(safeUrl(work.cover_url, IMG_FALLBACK));
  const title = esc(work.title || 'Obra sin título');

  // Formato badge en portada
  const formatName = esc(work.format_name ?? work.format?.name ?? '');
  const formatBadgeHtml = formatName
    ? `<span class="catalog-card-badge catalog-card-badge--${formatName.toLowerCase()}">${formatName}</span>`
    : '';

  // Estado (En emisión / Finalizado)
  const statusName = esc(work.status_name ?? work.status?.name ?? '');
  const isOngoing = statusName.toLowerCase().includes('emisi');
  const statusHtml = statusName
    ? `<span class="catalog-card-status ${isOngoing ? 'is-ongoing' : 'is-completed'}">
        <span class="catalog-card-status-dot"></span>${statusName}
       </span>`
    : '';

  // Meta (autor / artista / título alternativo)
  const metaParts = [work.alternative_title, work.author]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .map(esc);
  const metaHtml = metaParts.length ? `<p class="catalog-card-meta">${metaParts.join(' · ')}</p>` : '';

  // Indicadores estadísticos: Rating + Vistas + Estado
  const rating = work.rating_average ? Number(work.rating_average).toFixed(1) : null;
  const views = formatViews(work.total_views);
  let statsHtml = '';
  if (rating || views || statusHtml) {
    statsHtml = `
      <div class="catalog-card-stats">
        ${rating ? `<span class="catalog-card-rating"><img src="/assets/icons/svg/star.svg" alt="" width="11" height="11"> ${rating}</span>` : ''}
        ${views ? `<span class="catalog-card-views"><img src="/assets/icons/svg/eye.svg" alt="" width="11" height="11"> ${esc(views)}</span>` : ''}
        ${statusHtml}
      </div>`;
  }

  // Tags de géneros (hasta 3)
  const rawGenres = work.genres ?? work.tags ?? [];
  const genreTags = Array.isArray(rawGenres) ? rawGenres.slice(0, 3).map((g) => {
    const gName = esc(g.name ?? g);
    return `<span class="catalog-card-genre-pill">${gName}</span>`;
  }).join('') : '';
  const genresHtml = genreTags ? `<div class="catalog-card-genres">${genreTags}</div>` : '';

  // Sinopsis
  const synopsisHtml = work.synopsis ? `<p class="catalog-card-synopsis">${esc(work.synopsis)}</p>` : '';

  // Acciones
  let actionsHtml = '';
  if (workUrl) {
    actionsHtml = `
      <div class="catalog-card-actions">
        ${work.first_chapter_id ? `
          <a class="catalog-card-read" href="${esc(readerUrl)}">
            <img src="/assets/icons/svg/play.svg" alt="" width="11" height="11"> Leer
          </a>` : ''}
        <a class="catalog-card-detail-btn" href="${esc(workUrl)}">Detalles</a>
      </div>`;
  } else {
    actionsHtml = `<span class="catalog-card-unavailable">Próximamente</span>`;
  }

  return `
    <article class="catalog-card">
      <a class="catalog-card-cover-link" href="${esc(workUrl || '#')}">
        <img src="${coverUrl}" alt="${title}" loading="lazy">
        ${formatBadgeHtml}
      </a>
      <div class="catalog-card-copy">
        <a class="catalog-card-title" href="${esc(workUrl || '#')}" title="${title}">${title}</a>
        ${metaHtml}
        ${statsHtml}
        ${genresHtml}
        ${synopsisHtml}
        ${actionsHtml}
      </div>
    </article>`;
}

