// renderizado de tarjetas
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
      <img class="novedad-cover" src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
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
      <img class="launch-item--cover" src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
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
      <img src="/assets/icons/svg/navigation/arrow-right.svg" width="16" height="16" alt="" aria-hidden="true">
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
      <img class="ranking-cover" src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
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
      <img class="rank-card--cover" src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
    </div>
    <div class="rank-card--info">
      <div class="rank-card--head">
        <h3 class="rank-card--title">${title}</h3>
        ${format ? `<span class="rank-card--badge ${formatClass}">${format}</span>` : ''}
      </div>
      ${author ? `<p class="rank-card--author">${author}</p>` : ''}
      <div class="rank-card--meta">
        ${ratingFmt ? `<span class="rank-card--rating">★ ${ratingFmt}</span>` : ''}
        ${reads ? `<span class="rank-card--reads">· ${reads.includes('lecturas') ? reads : `${reads} lecturas`}</span>` : ''}
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
  const rawGenres = (work.genres ?? item.tags ?? []);
  const genresText = rawGenres.slice(0, 2).map(g => esc(g.name ?? g)).filter(Boolean).join(' · ');
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, IMG_FALLBACK));
  const href = esc(item.href ?? makeWorkUrl(work.slug ?? item.slug));
  const formatBadge = esc(work.format_name ?? work.format?.name ?? item.format?.name ?? '');

  return `
  <a class="popular-card" href="${href}">
    <div class="popular-card--cover-wrap">
      <img class="popular-card--cover" src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
      ${formatBadge ? `<span class="popular-card--format-badge">${formatBadge}</span>` : ''}
      <div class="popular-card--cover-bottom">
        ${ratingFmt ? `<span class="popular-card--rating">★ ${ratingFmt}${ratingCount ? ` <small class="popular-card--rating-votes">(${ratingCount})</small>` : ''}</span>` : ''}
      </div>
    </div>
    <div class="popular-card--info">
      <h3 class="popular-card--title" title="${title}">${title}</h3>
      ${genresText ? `<p class="popular-card--genres">${genresText}</p>` : ''}
      <div class="popular-card--footer">
        <span class="popular-card--chapter">${chapter || 'Disponible'}</span>
        ${author ? `<span class="popular-card--author" title="${author}">${author}</span>` : ''}
      </div>
    </div>
  </a>`;
}

export function renderCatalogCard(work) {
  const workSlug = work.slug || work.work_slug;
  const workUrl = makeWorkUrl(workSlug || work);
  const coverUrl = esc(safeUrl(work.cover_url, IMG_FALLBACK));
  const title = esc(work.title || 'Obra sin título');

  // formato badge en portada
  const formatName = esc(work.format_name ?? work.format?.name ?? '');
  const formatBadgeHtml = formatName
    ? `<span class="catalog-card-badge catalog-card-badge--${formatName.toLowerCase()}">${formatName}</span>`
    : '';

  // estado y metadatos
  const statusName = esc(work.status_name ?? work.status?.name ?? 'En emisión');
  const rating = work.rating_average && Number(work.rating_average) > 0 ? Number(work.rating_average).toFixed(1) : null;
  const chapters = Number(work.chapters_count || 0);
  const chaptersLabel = chapters > 0
    ? `${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}`
    : (work.total_views ? `${formatViews(work.total_views)} lecturas` : 'Capítulos disponibles');

  return `
    <article class="catalog-card">
      <a class="catalog-card-cover-link" href="${esc(workUrl || '#')}" aria-label="Ver ${title}">
        <img src="${coverUrl}" alt="${title}" loading="lazy" decoding="async">
        ${formatBadgeHtml}
      </a>
      <div class="catalog-card-info">
        <a class="catalog-card-title" href="${esc(workUrl || '#')}" title="${title}">${title}</a>
        <div class="catalog-card-meta">
          <span>${statusName}${formatName ? ` • ${formatName}` : ''}</span>
          ${rating ? `<span class="catalog-card-score">★ ${rating}</span>` : ''}
        </div>
        <div class="catalog-card-chapters">
          ${chaptersLabel}
        </div>
      </div>
    </article>`;
}
