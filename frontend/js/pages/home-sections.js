/**
 * home-sections.js
 * Renderiza las secciones secundarias del home conectadas a la API real:
 * Continuar Leyendo, Lanzamientos Recientes, Top Ranking,
 * Populares Esta Semana y Sidebar (Tablón, Misión Diaria, Chat).
 */

import { API_BASE_URL } from '../api/api-config.js';
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { safeUrl } from '../shared/url-utils.js';

/* -------------------------------------------------------
   UTILIDADES
   ------------------------------------------------------- */
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
}

async function apiFetch(path) {
  const res = await fetch(apiUrl(path), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function makeWorkUrl(slug) {
  if (!slug) return '/pages/obras.html';
  return `/pages/obra.html?slug=${encodeURIComponent(slug)}`;
}

/* -------------------------------------------------------
   RENDERIZADORES
   ------------------------------------------------------- */

/** Continuar Leyendo */
function renderContinueCard(item) {
  const work = item.work ?? item;
  const progress = item.progress ?? 0;
  const isFull = progress >= 100;
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, ''));
  const title = esc(work.title ?? 'Sin título');
  const chapter = esc(item.chapter_text ?? item.last_chapter_text ?? item.chapter ?? '');
  const pag = esc(item.page_text ?? item.pag ?? '');
  const time = esc(item.updated_text ?? item.time ?? '');
  const href = item.href ?? makeWorkUrl(work.slug);
  const chapterHref = item.chapter_href ?? href;

  return `
  <a class="continue-card" href="${esc(chapterHref)}">
    <img class="continue-card--cover" src="${coverUrl}" alt="${title}" loading="lazy" width="52" height="68">
    <div class="continue-card--info">
      <div class="continue-card--badge">
        <img src="/assets/icons/svg/history.svg" alt="" aria-hidden="true" width="10" height="10" class="continue-card--badge-icon">
        ${pag ? `<span class="continue-card--pag">${pag}</span>` : ''}
        <span class="continue-card--time">${time}</span>
      </div>
      <p class="continue-card--title">${title}</p>
      <p class="continue-card--chapter">${chapter}</p>
      <div class="continue-card--progress">
        <div class="continue-card--progress-fill" style="width:${progress}%"></div>
      </div>
      <span class="continue-card--cta">${isFull ? '✓ Completado' : '▶ Reanudar'}</span>
    </div>
  </a>`;
}

/** Lanzamientos Recientes */
function renderLaunchItem(item) {
  const work = item.work ?? item;
  const tag = esc(item.tag_type ?? item.tag ?? 'nuevo');
  const tagLabel = esc(item.tag_label ?? item.tagLabel ?? item.format_name ?? tag).toUpperCase();
  const studio = esc(work.author ?? work.studio ?? item.author ?? 'Scan');
  const title = esc(work.title ?? item.title ?? 'Sin título');
  
  // Format chapter so it just has the number if it's "1.00", etc.
  let chapter = esc(item.chapter_text ?? item.chapter ?? '');
  if (!chapter.toLowerCase().startsWith('c')) chapter = 'C. ' + chapter;
  
  const time = esc(item.published_text ?? item.time ?? '');
  const rating = item.rating ?? work.stats?.rating_average ?? item.rating_average ?? '';
  const ratingFmt = rating ? Number(rating).toFixed(2) : '';
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, ''));
  const href = item.href ?? makeWorkUrl(work.slug ?? item.slug);
  const chapterHref = item.chapter_href ?? href;

  return `
  <a class="launch-item" href="${esc(chapterHref)}">
    <div class="launch-item--cover-wrap">
      <img class="launch-item--cover" src="${coverUrl}" alt="${title}" loading="lazy">
      <div class="launch-item--chapter-gradient">
        <span class="launch-item--chapter-text">${chapter}</span>
      </div>
    </div>
    <div class="launch-item--info">
      <div class="launch-item--head">
        <span class="launch-item--tag launch-item--tag--${tag}">${tagLabel}</span>
        <span class="launch-item--studio">${studio}</span>
      </div>
      <p class="launch-item--title">${title}</p>
      <div class="launch-item--meta">
        <span class="launch-item--time"><span class="hs-dot hs-dot--teal"></span> ${time}</span>
        ${ratingFmt ? `<span class="launch-item--rating">&middot; <img src="/assets/icons/svg/star.svg" alt="" width="11" height="11"> ${ratingFmt}</span>` : ''}
      </div>
    </div>
    <div class="launch-item--action">
      <img src="/assets/icons/svg/arrow-right.svg" alt="Ir">
    </div>
  </a>`;
}

function renderRankCard(item, index) {
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
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, ''));
  const href = esc(item.href ?? makeWorkUrl(work.slug ?? item.slug));

  return `
  <a class="rank-card" href="${href}">
    <div class="rank-card--num ${posClass}">${pos}</div>
    <div class="rank-card--cover-wrap">
      <img class="rank-card--cover" src="${coverUrl}" alt="${title}" loading="lazy">
    </div>
    <div class="rank-card--info">
      <p class="rank-card--title">${title}</p>
      ${author ? `<p class="rank-card--author">${author}</p>` : ''}
      <div class="rank-card--meta">
        ${ratingFmt ? `<span class="rank-card--rating"><img src="/assets/icons/svg/star.svg" alt="" aria-hidden="true"> ${ratingFmt}</span>` : ''}
        ${reads ? `<span class="rank-card--reads">${reads}</span>` : ''}
      </div>
    </div>
    ${format ? `<span class="rank-card--badge ${formatClass}">${format}</span>` : ''}
  </a>`;
}

/** Populares Esta Semana */
function renderPopularCard(item) {
  const work = item.work ?? item;
  const title = esc(work.title ?? item.title ?? 'Sin título');
  const author = esc(work.author ?? item.author ?? item.studio ?? '');
  const chapter = esc(item.chapter_text ?? item.chapter ?? '');
  const rating = item.rating ?? item.rating_average ?? work.stats?.rating_average ?? '';
  const ratingFmt = rating ? Number(rating).toFixed(1) : '';
  const hearts = esc(item.favorites_formatted ?? item.hearts ?? '');
  const tags = (work.genres ?? item.tags ?? []).slice(0, 2).map(g =>
    `<span class="popular-card--tag">${esc(g.name ?? g)}</span>`
  ).join('');
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, ''));
  const href = item.href ?? makeWorkUrl(work.slug ?? item.slug);
  const chapterHref = item.chapter_href ?? href;

  const formatBadge = work.format?.name ?? item.format?.name ?? '';

  return `
  <article class="popular-card" onclick="location.href='${esc(href)}'">
    <div class="popular-card--cover-wrap">
      <img class="popular-card--cover" src="${coverUrl}" alt="${title}" loading="lazy">
      ${formatBadge ? `<span class="popular-card--format-badge">${formatBadge}</span>` : ''}
      <button class="popular-card--heart-btn" aria-label="Favorito"><img src="/assets/icons/svg/heart.svg" alt="" width="14" height="14"></button>
      <div class="popular-card--cover-bottom">
        ${ratingFmt ? `<span class="popular-card--rating"><img src="/assets/icons/svg/star.svg" alt="" width="12" height="12"> ${ratingFmt}</span>` : ''}
        ${chapter ? `<span class="popular-card--chapter-badge">${chapter}</span>` : ''}
      </div>
    </div>
    <div class="popular-card--info">
      <p class="popular-card--title">${title}</p>
      ${author ? `<p class="popular-card--studio">${author}</p>` : ''}
      ${tags ? `<div class="popular-card--tags">${tags}</div>` : ''}
      <div class="popular-card--footer">
        ${chapter ? `<a class="popular-card--new-badge" href="${esc(chapterHref)}" onclick="event.stopPropagation()"><span class="hs-dot hs-dot--teal"></span>${chapter} nuevo</a>` : '<span></span>'}
        ${hearts ? `<span class="popular-card--hearts"><img src="/assets/icons/svg/heart.svg" alt="" width="11" height="11"> ${hearts}</span>` : ''}
      </div>
    </div>
  </article>`;
}

/** Anuncios */
function renderAnuncio(item) {
  const tag = esc(item.type ?? item.tag ?? 'sistema');
  const tagLabel = esc(item.type_label ?? item.tagLabel ?? tag);
  const source = esc(item.source ?? '');
  const title = esc(item.title ?? '');
  const desc = esc(item.description ?? item.desc ?? '');
  const time = esc(item.published_text ?? item.time ?? '');
  return `
  <div class="anuncio-item">
    <div class="anuncio-item--head">
      <span class="anuncio-item--tag anuncio-item--tag--${tag}">${tagLabel}${source ? ' · ' + source : ''}</span>
      <span class="anuncio-item--time">${time}</span>
    </div>
    <p class="anuncio-item--title">${title}</p>
    ${desc ? `<p class="anuncio-item--desc">${desc}</p>` : ''}
  </div>`;
}

/** Chat message */
function renderChatMsg(msg) {
  const name = esc(msg.username ?? msg.name ?? 'Usuario');
  const avatar = esc((msg.username ?? msg.name ?? 'U').slice(0, 2).toUpperCase());
  const role = esc(msg.role ?? '');
  const roleLabel = esc(msg.role_label ?? msg.roleLabel ?? role.toUpperCase());
  const level = esc(msg.level ?? '');
  const time = esc(msg.created_text ?? msg.time ?? '');
  const text = esc(msg.content ?? msg.text ?? '');
  const pinned = Boolean(msg.pinned);
  return `
  <div class="chat-msg${pinned ? ' chat-msg--pinned' : ''}">
    <div class="chat-msg--avatar">${avatar}</div>
    <div class="chat-msg--body">
      <div class="chat-msg--header">
        <span class="chat-msg--name">${name}</span>
        ${role ? `<span class="chat-msg--role chat-msg--role--${role}">${roleLabel}</span>` : ''}
        ${level ? `<span class="chat-msg--level">${level}</span>` : ''}
        <span class="chat-msg--time">${time}</span>
      </div>
      <p class="chat-msg--text">${text}</p>
    </div>
  </div>`;
}

/* -------------------------------------------------------
   SKELETON / EMPTY STATE
   ------------------------------------------------------- */
function skeletonCards(type, count, cols) {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'continue') {
      /* continue-card: horizontal flex, cover 52x68 + info column */
      html += `
      <div class="sk-continue">
        <div class="sk-box sk-continue--cover"></div>
        <div class="sk-continue--info">
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
          <div class="sk-box sk-line sk-w-80"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-50"></div>
          <div class="sk-box sk-progress"></div>
        </div>
      </div>`;
    } else if (type === 'launch') {
      /* launch-item: horizontal flex, cover 56x74 + info column + action 32x32 */
      html += `
      <div class="sk-launch">
        <div class="sk-box sk-launch--cover"></div>
        <div class="sk-launch--info">
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
          <div class="sk-box sk-line sk-w-90"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-60"></div>
        </div>
        <div class="sk-box sk-action"></div>
      </div>`;
    } else if (type === 'rank') {
      /* rank-card: number (2.2rem bold) + cover 54x72 + info column */
      html += `
      <div class="sk-rank">
        <div class="sk-box sk-rank--num"></div>
        <div class="sk-box sk-rank--cover"></div>
        <div class="sk-rank--info">
          <div class="sk-box sk-line sk-w-80"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-50"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-60"></div>
        </div>
      </div>`;
    } else if (type === 'popular') {
      /* popular-card: vertical, poster + info below */
      html += `
      <div class="sk-popular">
        <div class="sk-box sk-popular--poster"></div>
        <div class="sk-popular--info">
          <div class="sk-box sk-line sk-w-90"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-60"></div>
          <div class="sk-tags">
            <div class="sk-box sk-tag"></div>
            <div class="sk-box sk-tag"></div>
          </div>
        </div>
      </div>`;
    } else if (type === 'anuncio') {
      /* anuncio-item: meta row + title + desc */
      html += `
      <div class="sk-anuncio">
        <div class="sk-anuncio--head">
          <div class="sk-box sk-tag"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
        </div>
        <div class="sk-box sk-line sk-w-80"></div>
        <div class="sk-box sk-line sk-line--xs sk-w-90"></div>
      </div>`;
    } else if (type === 'chat') {
      /* chat-msg: avatar circle + body column */
      html += `
      <div class="sk-chat">
        <div class="sk-box sk-chat--avatar"></div>
        <div class="sk-chat--body">
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
          <div class="sk-box sk-line sk-w-90"></div>
        </div>
      </div>`;
    } else if (type === 'mision') {
      /* mision: desc text + progress bar + stats */
      html += `
      <div class="sk-mision">
        <div class="sk-box sk-line sk-w-80"></div>
        <div class="sk-box sk-mision--bar"></div>
        <div class="sk-mision--stats">
          <div class="sk-box sk-line sk-line--xs sk-w-50"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-50"></div>
        </div>
      </div>`;
    }
  }
  return `<div class="sk-grid sk-grid--${cols}">${html}</div>`;
}

function emptyState(icon, msg) {
  return `<div class="hs-empty">
    <img src="/assets/icons/svg/${icon}.svg" alt="" width="28" height="28" class="hs-empty--icon">
    <span>${esc(msg)}</span>
  </div>`;
}

/* -------------------------------------------------------
   SECCIÓN WRAPPER
   ------------------------------------------------------- */
function setContent(slot, html) {
  if (slot) slot.innerHTML = html;
}

/* -------------------------------------------------------
   CARGA DE DATOS Y MONTAJE
   ------------------------------------------------------- */
async function loadContinue(slot) {
  if (!getAccessToken()) {
    setContent(slot, emptyState('heart', 'Inicia sesión para ver tu progreso de lectura.'));
    return;
  }
  try {
    const data = await apiRequest('/home/continue/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 3).map(renderContinueCard).join('')
      : emptyState('history', 'No tienes lecturas en curso.'));
  } catch {
    setContent(slot, emptyState('history', 'No se pudo cargar el progreso de lectura.'));
  }
}

async function loadLaunches(slot) {
  try {
    const data = await apiFetch('/home/launches/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderLaunchItem).join('')
      : emptyState('play', 'No hay lanzamientos recientes.'));
    const countEl = document.getElementById('launch-count');
    if (countEl) {
      const total = data.total ?? data.count ?? 52; // Fallback to 52 for visual parity if not supplied
      countEl.textContent = `Mostrando ${Math.min(6, items.length)} de ${total} lanzamientos hoy`;
    }
  } catch {
    setContent(slot, emptyState('play', 'No se pudieron cargar los lanzamientos.'));
  }
}

async function loadRanking(slot) {
  try {
    const data = await apiFetch(`/home/ranking/?period=all`);
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderRankCard).join('')
      : emptyState('star', 'No hay datos de ranking disponibles.'));
  } catch {
    setContent(slot, emptyState('star', 'No se pudo cargar el ranking.'));
  }
}

async function loadPopulars(slot) {
  try {
    const data = await apiFetch('/home/popular/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 4).map(renderPopularCard).join('')
      : emptyState('search', 'No hay obras populares esta semana.'));
  } catch {
    setContent(slot, emptyState('search', 'No se pudo cargar las obras populares.'));
  }
}

async function loadAnuncios(slot) {
  try {
    const data = await apiFetch('/home/announcements/?type=sistema');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 3).map(renderAnuncio).join('')
      : emptyState('bell', 'No hay anuncios recientes.'));
  } catch {
    setContent(slot, emptyState('bell', 'No se pudieron cargar los anuncios.'));
  }
}

async function loadChat(slot) {
  try {
    const data = await apiFetch('/home/chat/recent/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 5).map(renderChatMsg).join('')
      : emptyState('bell', 'No hay mensajes recientes.'));
  } catch {
    setContent(slot, emptyState('bell', 'Chat no disponible en este momento.'));
  }
}

/* -------------------------------------------------------
   RENDER PRINCIPAL
   ------------------------------------------------------- */
export function renderHomeSections(container) {
  if (!container) return;

  container.innerHTML = `
  <div class="home-body">
    <div class="home-container">

      <!-- ====== COLUMNA PRINCIPAL ====== -->
      <div class="home-main">

        <!-- Continuar Leyendo -->
        <section class="hs" aria-labelledby="hs-continue-title" id="section-continue">
          <div class="hs-head">
            <div class="hs-head-left">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--teal-500);box-shadow:0 0 8px var(--teal-500);flex-shrink:0"></div>
              <h2 id="hs-continue-title" class="hs-title">Continuar Leyendo</h2>

            </div>
            <a class="hs-link" href="/pages/biblioteca.html">
              Ver historial <img src="/assets/icons/svg/play.svg" alt="" aria-hidden="true">
            </a>
          </div>
          <div class="continue-grid" id="slot-continue">${skeletonCards('continue', 3, 3)}</div>
        </section>

        <!-- Lanzamientos Recientes -->
        <section class="hs" aria-labelledby="hs-launch-title" id="section-launch">
          <div class="hs-head">
            <div class="hs-head-left">
              <div class="hs-icon hs-icon--teal">
                <img src="/assets/icons/svg/play.svg" alt="" aria-hidden="true">
              </div>
              <div class="hs-title-group">
                <div class="hs-title-row">
                  <h2 id="hs-launch-title" class="hs-title">Lanzamientos Recientes</h2>
                  <span class="hs-badge hs-badge--live"><span class="hs-dot"></span> EN VIVO</span>
                </div>
                <p class="hs-subtitle">Capítulos sincronizados en tiempo real por los grupos oficiales</p>
              </div>
            </div>
          </div>
          <div class="launch-grid" id="slot-launch">${skeletonCards('launch', 6, 2)}</div>
          <div class="hs-foot">
            <span id="launch-count" class="hs-foot-count"></span>
            <a class="hs-link" href="/pages/novedades.html">Ver todos los estrenos del día <img src="/assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true"></a>
          </div>
        </section>

        <!-- Top Ranking -->
        <section class="hs" aria-labelledby="hs-rank-title" id="section-rank">
          <div class="hs-head">
            <div class="hs-head-left">
              <div class="hs-icon hs-icon--gold">
                <img src="/assets/icons/svg/star.svg" alt="" aria-hidden="true">
              </div>
              <div class="hs-title-group">
                <div class="hs-title-row">
                  <h2 id="hs-rank-title" class="hs-title">Top Ranking</h2>
                  <span class="hs-badge hs-badge--updated">Actualizado Hoy</span>
                </div>
                <p class="hs-subtitle">Las series más aclamadas según votos y lecturas en tiempo real</p>
              </div>
            </div>
            <div class="hs-head-right">
              <div class="hs-tabs" role="tablist" id="ranking-tabs">
                <button class="hs-tab is-active" type="button" role="tab" data-period="all">Total</button>
                <button class="hs-tab" type="button" role="tab" data-period="monthly">Mensual</button>
                <button class="hs-tab" type="button" role="tab" data-period="weekly">Semanal</button>
              </div>
              <a class="hs-link hs-link--ml" href="/pages/ranking.html">Ver Top 100 <img src="/assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true"></a>
            </div>
          </div>
          <div class="rank-grid" id="slot-rank">${skeletonCards('rank', 6, 3)}</div>
        </section>

        <!-- Populares Esta Semana -->
        <section class="hs" aria-labelledby="hs-popular-title" id="section-popular">
          <div class="hs-head">
            <div>
              <h2 id="hs-popular-title" class="hs-title">Populares Esta Semana</h2>
              <p class="hs-subtitle">Los títulos más leídos con actualizaciones diarias de alta definición</p>
            </div>
          </div>
          <div class="popular-grid" id="slot-popular">${skeletonCards('popular', 4, 4)}</div>
        </section>

      </div><!-- /home-main -->

      <!-- ====== SIDEBAR ====== -->
      <aside class="home-aside" aria-label="Panel lateral">

        <!-- Tablón de Anuncios -->
        <section class="aside-card" aria-labelledby="aside-anuncios-title" id="section-anuncios">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--teal">
                <img src="/assets/icons/svg/bell.svg" alt="" aria-hidden="true">
              </div>
              <h2 id="aside-anuncios-title" class="aside-card--title">Tablón de Anuncios</h2>
            </div>
            <span class="aside-card--badge aside-card--badge--oficial">Oficial</span>
          </div>
          <div class="aside-card--body">
            <div id="slot-anuncios">${skeletonCards('anuncio', 2, 1)}</div>
          </div>
          <a class="aside-link" href="/pages/comunidad.html">Ver todos los anuncios →</a>
        </section>

        <!-- Misión Diaria -->
        <section class="aside-card" aria-labelledby="aside-mision-title">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--gold">
                <img src="/assets/icons/svg/star.svg" alt="" aria-hidden="true">
              </div>
              <h2 id="aside-mision-title" class="aside-card--title">Misión Diaria</h2>
            </div>
            <span class="mision-xp" id="mision-xp">+XP</span>
          </div>
          <div class="aside-card--body" id="slot-mision">
            ${skeletonCards('mision', 1, 1)}
          </div>
        </section>

        <!-- Chat en Vivo -->
        <section class="aside-card" aria-labelledby="aside-chat-title" id="section-chat">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--blue">
                <img src="/assets/icons/svg/chat.svg" alt="" aria-hidden="true">
              </div>
              <h2 id="aside-chat-title" class="aside-card--title">Chat en Vivo</h2>
              <span class="chat-live-badge"><span class="hs-dot"></span> EN DIRECTO</span>
            </div>
            <button class="chat-live-filter-btn" type="button">Filtros</button>
          </div>
          <div class="chat-tags">
            <span class="chat-tag">#general</span>
            <span class="chat-tag">#scans</span>
            <span class="chat-tag">#spoilers</span>
          </div>
          <div class="chat-messages" role="log" aria-live="polite" id="slot-chat">
            ${skeletonCards('chat', 3, 1)}
          </div>
          <div class="chat-input-row">
            <input id="chat-input" name="chat_message" class="chat-input" type="text" placeholder="Escribe en #general…" aria-label="Mensaje de chat">
            <button class="chat-send-btn" type="button" aria-label="Enviar mensaje">
              <img src="/assets/icons/svg/play.svg" alt="" aria-hidden="true">
            </button>
          </div>
        </section>

      </aside>

    </div>
  </div>
  `;

  /* Cargar todo en paralelo usando IDs estrictos */
  loadContinue(document.getElementById('slot-continue'));
  loadLaunches(document.getElementById('slot-launch'));
  loadRanking(document.getElementById('slot-rank'));
  loadPopulars(document.getElementById('slot-popular'));
  loadAnuncios(document.getElementById('slot-anuncios'));
  loadChat(document.getElementById('slot-chat'));

  /* Misión diaria */
  (async () => {
    try {
      const data = await apiRequest('/home/mission/');
      const xpEl = document.getElementById('mision-xp');
      const body = document.getElementById('slot-mision');
      if (xpEl && data.xp) xpEl.textContent = `+${data.xp} XP`;
      if (body) {
        const pct = data.progress_pct ?? 0;
        body.innerHTML = `
          <p class="mision-desc">${esc(data.description ?? 'Completa tu misión diaria.')}</p>
          <div class="mision-progress-label">
            <span>${esc(data.progress_label ?? `Progreso (${data.current ?? 0}/${data.total ?? 3})`)}</span>
            <span>${pct}%</span>
          </div>
          <div class="mision-bar"><div class="mision-bar-fill" style="width:${pct}%"></div></div>
          <div class="mision-stats">
            <div class="mision-stat">
              <span class="mision-stat--label">Racha activa</span>
              <span class="mision-stat--value">${esc(data.streak_days ?? 0)} días</span>
            </div>
            <div class="mision-stat">
              <span class="mision-stat--label">Ghost Monedas</span>
              <span class="mision-stat--value">${esc(data.coins ?? 0)} G</span>
            </div>
          </div>`;
      }
    } catch (err) {
      const body = document.getElementById('slot-mision');
      if (!body) return;
      const isAuth = err?.status === 401 || err?.status === 403;
      body.innerHTML = emptyState('star',
        isAuth ? 'Inicia sesión para ver tu misión diaria.' : 'No se pudo cargar la misión.'
      );
    }
  })();

  const rankingTabs = document.getElementById('ranking-tabs');
  if (rankingTabs) {
    rankingTabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset.period) return;
      
      rankingTabs.querySelectorAll('button').forEach(t => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      const slot = document.getElementById('slot-rank');
      if (slot) slot.innerHTML = skeletonCards('rank', 6, 3);
      (async () => {
        try {
          const data = await apiFetch(`/home/ranking/?period=${btn.dataset.period}`);
          const items = data.results ?? data ?? [];
          if (slot) slot.innerHTML = items.length
            ? items.slice(0, 6).map(renderRankCard).join('')
            : emptyState('star', 'No hay datos de ranking.');
        } catch {
          if (slot) slot.innerHTML = emptyState('star', 'No se pudo cargar el ranking.');
        }
      })();
    });
  }
}
