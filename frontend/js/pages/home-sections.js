/**
 * Secciones dinámicas del home: Continuar Leyendo, Lanzamientos, Ranking,
 * Populares de la Semana y el Sidebar (Tablón, Misión Diaria, Chat).
 */
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc, safeUrl, IMG_FALLBACK, makeWorkUrl } from '../shared/ui-utils.js';
import { renderLaunchItem, renderRankCard, renderPopularCard } from '../components/cards.js';
import { showToast } from '../shared/toast.js';

function renderContinueCard(item) {
  const work = item.work ?? item;
  const progress = Math.min(100, Math.max(0, item.progress ?? 0));
  const isFull = progress >= 100;
  const coverUrl = esc(safeUrl(work.cover_url ?? work.cover, IMG_FALLBACK));
  const title = esc(work.title ?? 'Sin título');
  const chapter = esc(item.chapter_text ?? item.last_chapter_text ?? item.chapter ?? '');
  const pag = esc(item.page_text ?? item.pag ?? '');
  const time = esc(item.updated_text ?? item.time ?? '');
  const href = item.href ?? makeWorkUrl(work.slug);
  const chapterHref = item.chapter_href ?? href;

  return `
  <a class="continue-card" href="${esc(chapterHref)}">
    <div class="continue-card--cover-wrap">
      <img class="continue-card--cover" src="${coverUrl}" alt="${title}" loading="lazy" width="58" height="78">
      <span class="continue-card--play-overlay">
        <img src="/assets/icons/svg/play.svg" alt="" width="18" height="18">
      </span>
    </div>
    <div class="continue-card--info">
      <div class="continue-card--badge">
        <span class="continue-card--dot"></span>
        <span class="continue-card--chapter">${chapter}</span>
        ${pag ? `<span class="continue-card--pag">(${pag})</span>` : ''}
        <span class="continue-card--time">${time}</span>
      </div>
      <h3 class="continue-card--title" title="${title}">${title}</h3>
      <div class="continue-card--progress-wrap">
        <div class="continue-card--progress-bar">
          <div class="continue-card--progress-fill" style="width:${progress}%"></div>
        </div>
        <span class="continue-card--pct">${progress}%</span>
      </div>
      <div class="continue-card--footer">
        <span class="continue-card--cta">${isFull ? '✓ Releer' : '▶ Reanudar'}</span>
      </div>
    </div>
  </a>`;
}

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

function parseChatText(rawText) {
  if (!rawText) return '';
  let text = esc(rawText);

  // 1. Soporte de spoilers con #spoiler <texto> o ||texto||
  // Comando #spoiler <resto del texto>
  if (text.startsWith('#spoiler ') || text.startsWith('/spoiler ')) {
    const spoilerContent = text.replace(/^[#/]spoiler\s+/, '');
    return `<span class="chat-spoiler-box" title="Clic para revelar spoiler"><span class="chat-spoiler-tag">⚠️ SPOILER:</span> <span class="chat-spoiler-content">${spoilerContent}</span></span>`;
  }
  // Sintaxis ||spoiler|| en cualquier parte del mensaje
  text = text.replace(/\|\|(.*?)\|\|/g, '<span class="chat-spoiler-box" title="Clic para revelar spoiler"><span class="chat-spoiler-tag">⚠️</span> <span class="chat-spoiler-content">$1</span></span>');

  // 2. Menciones destacadas: @staff, @admin, @mod, @usuario
  text = text.replace(/@([a-zA-Z0-9_-]{2,30})/g, (match, username) => {
    const isStaffMention = ['staff', 'admin', 'mod', 'soporte'].includes(username.toLowerCase());
    const badgeClass = isStaffMention ? 'chat-mention chat-mention--staff' : 'chat-mention';
    return `<span class="${badgeClass}" data-username="${username}" title="Mención a @${username}">@${username}</span>`;
  });

  return text;
}

function renderChatMsg(msg) {
  const msgId = msg.id;
  const isPinned = Boolean(msg.is_pinned);
  const name = esc(msg.username ?? msg.name ?? 'Usuario');
  const avatarUrl = (msg.avatar_url ?? msg.avatar ?? '').trim();
  const anilloUrl = (msg.anillo_url ?? msg.avatar_frame_url ?? '').trim();
  const initial = esc((msg.username ?? msg.name ?? 'U').slice(0, 1).toUpperCase());
  const role = esc(msg.role ?? '');
  const roleLabel = esc(msg.role_label ?? msg.roleLabel ?? role.toUpperCase());
  const level = esc(msg.level ?? '');
  const time = esc(msg.created_text ?? msg.time ?? '');
  const rawText = msg.content ?? msg.text ?? '';
  const parsedContent = parseChatText(rawText);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUsername = (currentUser.username || '').toLowerCase();
  const isCurrentUserStaff = ['ADMIN', 'SUPERADMIN'].includes((currentUser.platform_role || '').toUpperCase());

  // Resaltado de mensaje si te mencionan directamente a ti o al staff si eres admin
  const isMentioned = Boolean(
    (currentUsername && rawText.toLowerCase().includes(`@${currentUsername}`)) ||
    (isCurrentUserStaff && /@(?:staff|admin|mod|soporte)\b/i.test(rawText))
  );

  const avatarMarkup = avatarUrl
    ? `<img class="chat-msg--avatar-img" src="${esc(avatarUrl)}" alt="${name}" loading="lazy" onerror="this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}"><span class="chat-msg--initial" style="display:none;" aria-hidden="true">${initial}</span>`
    : `<span class="chat-msg--initial">${initial}</span>`;

  const frameMarkup = anilloUrl
    ? `<img class="chat-msg--frame-img" src="${esc(anilloUrl)}" alt="" aria-hidden="true">`
    : '';

  const pinBadgeMarkup = isPinned
    ? `<span class="chat-msg--pin-badge" title="Mensaje fijado por la Administración">📌 Fijado</span>`
    : '';

  const pinBtnMarkup = (isCurrentUserStaff && msgId)
    ? `<button type="button" class="chat-msg--pin-action-btn ${isPinned ? 'is-active' : ''}" data-msg-id="${msgId}" title="${isPinned ? 'Desfijar del chat' : 'Fijar mensaje en el chat general'}">${isPinned ? '📌 Fijado' : '📌 Fijar'}</button>`
    : '';

  return `
  <div class="chat-msg ${isPinned ? 'chat-msg--pinned' : ''} ${isMentioned ? 'chat-msg--mention' : ''}" data-author="${name}" data-msg-id="${msgId || ''}">
    <div class="chat-msg--avatar" title="Mencionar a @${name}">
      <div class="chat-msg--avatar-inner">${avatarMarkup}</div>
      ${frameMarkup}
    </div>
    <div class="chat-msg--body">
      <div class="chat-msg--header">
        <span class="chat-msg--name" title="Clic para mencionar">${name}</span>
        ${pinBadgeMarkup}
        ${role ? `<span class="chat-msg--role chat-msg--role--${role}">${roleLabel}</span>` : ''}
        ${level ? `<span class="chat-msg--level">${level}</span>` : ''}
        ${pinBtnMarkup}
        <span class="chat-msg--time">${time}</span>
      </div>
      <div class="chat-msg--text">${parsedContent}</div>
    </div>
  </div>`;
}

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

function setContent(slot, html) {
  if (slot) slot.innerHTML = html;
}

function renderGuestContinue() {
  const loginNext = encodeURIComponent(window.location.pathname || '/');
  return `
  <div class="continue-guest-box">
    <div class="continue-guest-icon">
      <img src="/assets/icons/svg/history.svg" alt="" width="22" height="22">
    </div>
    <div class="continue-guest-content">
      <h3 class="continue-guest-title">Continúa leyendo donde lo dejaste</h3>
      <p class="continue-guest-desc">Inicia sesión para sincronizar automáticamente tus capítulos leídos, páginas y biblioteca en todos tus dispositivos.</p>
    </div>
    <div class="continue-guest-actions">
      <a href="/pages/login.html?next=${loginNext}" class="continue-guest-btn continue-guest-btn--primary">Iniciar sesión</a>
      <a href="/pages/catalogo.html" class="continue-guest-btn continue-guest-btn--ghost">Explorar Catálogo</a>
    </div>
  </div>`;
}

function renderEmptyContinue() {
  return `
  <div class="continue-guest-box">
    <div class="continue-guest-icon">
      <img src="/assets/icons/svg/play.svg" alt="" width="22" height="22">
    </div>
    <div class="continue-guest-content">
      <h3 class="continue-guest-title">Comienza una nueva lectura</h3>
      <p class="continue-guest-desc">Aún no tienes lecturas en curso. Abre cualquier capítulo del catálogo o de los lanzamientos y tu progreso se registrará aquí de inmediato.</p>
    </div>
    <div class="continue-guest-actions">
      <a href="/pages/novedades.html" class="continue-guest-btn continue-guest-btn--primary">Ver Novedades</a>
    </div>
  </div>`;
}

async function loadContinue(slot) {
  if (!getAccessToken()) {
    setContent(slot, renderGuestContinue());
    return;
  }
  try {
    const data = await apiRequest('/home/continue/');
    const items = data.results ?? data ?? [];
    if (items.length) {
      setContent(slot, items.slice(0, 3).map(renderContinueCard).join(''));
    } else {
      setContent(slot, renderEmptyContinue());
    }
  } catch {
    setContent(slot, renderEmptyContinue());
  }
}

async function loadLaunches(slot) {
  try {
    const data = await apiRequest('/home/launches/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderLaunchItem).join('')
      : emptyState('play', 'No hay lanzamientos recientes.'));
    const countEl = document.getElementById('launch-count');
    if (countEl) {
      const total = data.total ?? data.count ?? 52;
      countEl.textContent = `Mostrando ${Math.min(6, items.length)} de ${total} lanzamientos hoy`;
    }
  } catch {
    setContent(slot, emptyState('play', 'No se pudieron cargar los lanzamientos.'));
  }
}

async function loadRanking(slot) {
  try {
    const data = await apiRequest(`/home/ranking/?period=all`);
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderRankCard).join('')
      : emptyState('star', 'No hay datos de ranking disponibles.'));
  } catch {
    setContent(slot, emptyState('star', 'No se pudo cargar el ranking.'));
  }
}

async function loadPopulars(slot, filterFormat = 'all') {
  try {
    const query = filterFormat && filterFormat !== 'all' ? `?format=${encodeURIComponent(filterFormat)}&limit=4` : '?limit=4';
    const data = await apiRequest(`/home/popular/${query}`);
    const items = data.results ?? data ?? [];

    setContent(slot, items.length
      ? items.slice(0, 4).map(renderPopularCard).join('')
      : emptyState('search', `No hay obras de tipo ${filterFormat} esta semana.`));
  } catch {
    setContent(slot, emptyState('search', 'No se pudo cargar las obras populares.'));
  }
}


async function loadAnuncios(slot, type = 'sistema') {
  try {
    const data = await apiRequest(`/home/announcements/?type=${type}`);
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 3).map(renderAnuncio).join('')
      : emptyState('bell', 'No hay anuncios en esta sección.'));
  } catch {
    setContent(slot, emptyState('bell', 'No se pudieron cargar los anuncios.'));
  }
}

let activeChatChannel = 'general';

async function loadChatOnlineStats() {
  const onlineCountEl = document.getElementById('chat-online-count');
  const onlineListEl = document.getElementById('chat-online-list');
  try {
    const data = await apiRequest('/chat/online');
    if (onlineCountEl && typeof data?.online_count === 'number') {
      onlineCountEl.textContent = `${data.online_count} en línea`;
    }
    if (onlineListEl && Array.isArray(data?.active_users)) {
      if (!data.active_users.length) {
        onlineListEl.innerHTML = '<p class="chat-online-empty">No hay lectores conectados en este momento.</p>';
        return;
      }
      onlineListEl.innerHTML = data.active_users.map(u => {
        const uName = esc(u.username ?? 'Lector');
        const uAvatar = (u.avatar_url ?? '').trim();
        const uAnillo = (u.anillo_url ?? u.avatar_frame_url ?? '').trim();
        const uInitial = esc((u.username ?? 'U').slice(0, 1).toUpperCase());
        const uRole = esc(u.platform_role ?? 'USER');
        const isMod = ['ADMIN', 'SUPERADMIN'].includes(uRole.toUpperCase());
        const avatarEl = uAvatar
          ? `<img class="chat-online-user-avatar" src="${esc(uAvatar)}" alt="${uName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="chat-online-user-initial" style="display:none;">${uInitial}</span>`
          : `<span class="chat-online-user-initial">${uInitial}</span>`;
        const frameEl = uAnillo
          ? `<img class="chat-online-user-frame" src="${esc(uAnillo)}" alt="" aria-hidden="true">`
          : '';
        return `
          <div class="chat-online-user-item">
            <div class="chat-online-user-avatar-wrap">
              <div class="chat-online-user-avatar-inner">${avatarEl}</div>
              ${frameEl}
              <span class="chat-online-status-dot"></span>
            </div>
            <div class="chat-online-user-info">
              <span class="chat-online-user-name">${uName}</span>
              ${isMod ? '<span class="chat-online-user-badge">STAFF</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.debug('Error cargando online stats:', err);
  }
}

// Estado del chat para renderizado incremental (evita recargar todo el DOM)
const chatState = {
  channel: null,
  ids: new Set(),
  pinnedKey: '',
  signature: '',
};

function renderPinnedBar(pinnedInput) {
  const bar = document.getElementById('chat-pinned-bar');
  if (!bar) return;
  const pinnedList = Array.isArray(pinnedInput)
    ? pinnedInput
    : (pinnedInput ? [pinnedInput] : []);

  const key = pinnedList.map(m => `${m.id}:${m.content}`).join('|');
  if (key === chatState.pinnedKey) return;
  chatState.pinnedKey = key;

  if (!pinnedList.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = ['ADMIN', 'SUPERADMIN'].includes((currentUser.platform_role || '').toUpperCase());

  bar.innerHTML = pinnedList.map(pinned => `
    <div class="chat-pinned-item" data-msg-id="${pinned.id}">
      <span class="chat-pinned-bar--icon" aria-hidden="true">📌</span>
      <div class="chat-pinned-bar--body">
        <div class="chat-pinned-bar--header">
          <span class="chat-pinned-bar--author">${esc(pinned.username ?? 'Staff')}</span>
          <span class="chat-pinned-bar--badge">Fijado</span>
        </div>
        <div class="chat-pinned-bar--text">${parseChatText(pinned.content ?? '')}</div>
      </div>
      ${isStaff ? `<button type="button" class="chat-msg--pin-action-btn is-active" data-msg-id="${pinned.id}" title="Desfijar">✕</button>` : ''}
    </div>
  `).join('');
  bar.hidden = false;
}

async function loadChat(slot, channel = activeChatChannel, { force = false } = {}) {
  if (!slot) return;
  try {
    const data = await apiRequest(`/home/chat/recent/?channel=${encodeURIComponent(channel)}&limit=30`);
    const items = data.results ?? data ?? [];

    // Mensajes fijados visibles arriba de forma limpia
    const pinnedList = items.filter(m => m.is_pinned);
    renderPinnedBar(pinnedList);

    const normal = items.filter(m => !m.is_pinned).slice(0, 25).reverse(); // orden cronológico
    const channelChanged = chatState.channel !== channel;
    const signature = normal.map(m => m.id).join(',');

    // Sin cambios: no tocar el DOM
    if (!force && !channelChanged && signature === chatState.signature) return;

    const nearBottom = slot.scrollHeight - slot.scrollTop - slot.clientHeight < 80;
    const newOnes = normal.filter(m => !chatState.ids.has(m.id));
    const canAppend = !force && !channelChanged && chatState.ids.size > 0
      && normal.every(m => chatState.ids.has(m.id) || newOnes.includes(m))
      && newOnes.length < normal.length;

    if (canAppend) {
      // Quitar mensajes que ya no vienen (borrados/fijados) y añadir solo los nuevos
      const keep = new Set(normal.map(m => String(m.id)));
      slot.querySelectorAll('.chat-msg[data-msg-id]').forEach(el => {
        if (!keep.has(el.dataset.msgId)) el.remove();
      });
      if (newOnes.length) slot.insertAdjacentHTML('beforeend', newOnes.map(renderChatMsg).join(''));
    } else if (normal.length) {
      setContent(slot, normal.map(renderChatMsg).join(''));
    } else {
      setContent(slot, emptyState('chat', `No hay mensajes en #${channel}. ¡Sé el primero en escribir!`));
    }

    chatState.channel = channel;
    chatState.ids = new Set(normal.map(m => m.id));
    chatState.signature = signature;

    if (nearBottom || channelChanged || force) {
      requestAnimationFrame(() => { slot.scrollTop = slot.scrollHeight; });
    }
  } catch (err) {
    console.warn('Error al cargar chat:', err);
    if (!chatState.ids.size) setContent(slot, emptyState('chat', 'Chat no disponible en este momento.'));
  }
}

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
              <div class="hs-icon hs-icon--teal">
                <img src="/assets/icons/svg/history.svg" alt="" aria-hidden="true">
              </div>
              <div class="hs-title-group">
                <div class="hs-title-row">
                  <h2 id="hs-continue-title" class="hs-title">Continuar Leyendo</h2>
                  <span class="hs-badge hs-badge--live"><span class="hs-dot"></span> EN CURSO</span>
                </div>
                <p class="hs-subtitle">Retoma tus lecturas exactamente donde las dejaste</p>
              </div>
            </div>
            <a class="hs-link" href="/pages/biblioteca.html?filter=reading">
              Ver historial <img src="/assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true">
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
            <div class="hs-head-left">
              <div class="hs-icon hs-icon--teal">
                <img src="/assets/icons/svg/star.svg" alt="" aria-hidden="true">
              </div>
              <div class="hs-title-group">
                <div class="hs-title-row">
                  <h2 id="hs-popular-title" class="hs-title">Populares Esta Semana</h2>
                  <span class="hs-badge hs-badge--live"><span class="hs-dot"></span> TOP DESTACADO</span>
                </div>
                <p class="hs-subtitle">Los títulos más leídos con actualizaciones diarias de alta definición</p>
              </div>
            </div>
            <div class="hs-head-right">
              <div class="hs-tabs" role="tablist" id="popular-format-tabs">
                <button class="hs-tab is-active" type="button" role="tab" data-format="all">Todos</button>
                <button class="hs-tab" type="button" role="tab" data-format="Manhwa">Manhwa</button>
                <button class="hs-tab" type="button" role="tab" data-format="Manga">Manga</button>
                <button class="hs-tab" type="button" role="tab" data-format="Manhua">Manhua</button>
              </div>
              <a class="hs-link hs-link--ml" href="/pages/catalogo.html?order=popular">Ver Catálogo <img src="/assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true"></a>
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
          <div class="anuncio-tabs" role="tablist" id="anuncio-tabs">
            <button class="anuncio-tab is-active" type="button" role="tab" data-type="sistema">Sistema</button>
            <button class="anuncio-tab" type="button" role="tab" data-type="evento">Eventos</button>
            <button class="anuncio-tab" type="button" role="tab" data-type="scan">Scans</button>
          </div>
          <div class="aside-card--body">
            <div id="slot-anuncios">${skeletonCards('anuncio', 2, 1)}</div>
          </div>
          <a class="aside-link" href="/pages/comunidad.html">Ver todos los anuncios →</a>
        </section>

        <!-- Misión Diaria -->
        <section class="aside-card aside-card--missions" aria-labelledby="aside-mision-title">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--gold">
                <img src="/assets/icons/svg/star.svg" alt="" aria-hidden="true">
              </div>
              <h2 id="aside-mision-title" class="aside-card--title">Misiones Diarias</h2>
            </div>
            <div class="mision-head--badges">
              <span class="mision-level-badge" id="mision-level-badge">Nv. 1</span>
              <span class="mision-xp-pill" id="mision-xp">+XP</span>
            </div>
          </div>
          <div class="aside-card--body" id="slot-mision">
            ${skeletonCards('mision', 1, 1)}
          </div>
        </section>

        <!-- Chat en Vivo Modernizado y Funcional -->
        <section class="aside-card aside-card--chat" aria-labelledby="aside-chat-title" id="section-chat">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--blue">
                <img src="/assets/icons/svg/chat.svg" alt="" aria-hidden="true">
              </div>
              <div>
                <div class="chat-title-row">
                  <h2 id="aside-chat-title" class="aside-card--title">Chat en Vivo</h2>
                  <span class="chat-current-channel-badge" id="chat-current-channel-badge" title="Canal activo">#general</span>
                </div>
                <div class="chat-online-indicator" id="chat-online-indicator" title="Ver lectores en línea">
                  <span class="hs-dot"></span>
                  <span id="chat-online-count">En línea</span>
                </div>
              </div>
            </div>
            <div class="chat-head-actions">
              <button class="chat-live-filter-btn" id="chat-filter-toggle" type="button" aria-expanded="false" title="Canales de Chat">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                <span id="chat-channel-btn-label">Canales</span>
              </button>
            </div>
          </div>

          <!-- Popover Guía de Comandos del Chat (#ayuda) -->
          <div class="chat-help-popover" id="chat-help-popover" hidden>
            <div class="chat-help-popover-head">
              <span>💡 Comandos del Chat</span>
              <button id="chat-help-popover-close" type="button" aria-label="Cerrar">&times;</button>
            </div>
            <div class="chat-help-list">
              <div class="chat-help-item" data-cmd="#ayuda">
                <div class="chat-help-item-title"><code>#ayuda</code></div>
                <div class="chat-help-item-desc">Muestra esta guía de comandos rápidos.</div>
              </div>
              <div class="chat-help-item" data-cmd="#spoiler ">
                <div class="chat-help-item-title"><code>#spoiler &lt;texto&gt;</code> o <code>||texto||</code></div>
                <div class="chat-help-item-desc">Oculta spoilers bajo un filtro difuminado interactivo.</div>
              </div>
              <div class="chat-help-item" data-cmd="@staff ">
                <div class="chat-help-item-title"><code>@staff</code> o <code>@admin</code></div>
                <div class="chat-help-item-desc">Notifica al Staff directamente para dudas o reportes.</div>
              </div>
            </div>
            <div class="chat-help-popover-foot">
              <span>Clic en cualquier comando para insertarlo</span>
            </div>
          </div>

          <!-- Dropdown Popup de Canales del Chat -->
          <div class="chat-filter-dropdown" id="chat-filter-dropdown" hidden>
            <div class="chat-filter-dropdown-head">
              <span>Canales de Chat</span>
              <button id="chat-filter-dropdown-close" type="button" aria-label="Cerrar">&times;</button>
            </div>

            <div class="chat-channel-options">
              <label class="chat-filter-option">
                <input type="radio" name="chat-channel-choice" value="general" checked>
                <span class="chat-channel-choice-item">
                  <strong>#general</strong>
                  <small>Público para todos</small>
                </span>
              </label>
              <label class="chat-filter-option">
                <input type="radio" name="chat-channel-choice" value="scans">
                <span class="chat-channel-choice-item">
                  <strong>#scans</strong>
                  <small>Solo Staff y Scans</small>
                </span>
              </label>
              <label class="chat-filter-option">
                <input type="radio" name="chat-channel-choice" value="staff">
                <span class="chat-channel-choice-item">
                  <strong>#staff</strong>
                  <small>🔒 Exclusivo Staff/Admin</small>
                </span>
              </label>
            </div>
          </div>

          <!-- Cajón / Lista de Usuarios en Línea (Colapsable) -->
          <div class="chat-online-drawer" id="chat-online-drawer" hidden>
            <div class="chat-online-drawer-head">
              <span>Lectores conectados</span>
              <button id="chat-online-drawer-close" type="button" aria-label="Cerrar">&times;</button>
            </div>
            <div class="chat-online-list" id="chat-online-list">
              <!-- Renderizado dinámicamente -->
            </div>
          </div>

          <!-- Mensaje fijado por el Staff (siempre visible arriba) -->
          <div class="chat-pinned-bar" id="chat-pinned-bar" hidden></div>

          <div class="chat-messages" role="log" aria-live="polite" id="slot-chat">
            ${skeletonCards('chat', 3, 1)}
          </div>

          <div class="chat-input-row">
            <button class="chat-help-pill-btn" id="chat-help-btn" type="button" aria-expanded="false" title="Comandos del chat (#ayuda)">💡</button>
            <input id="chat-input" name="chat_message" class="chat-input" type="text" placeholder="Escribe en #general… (usa @staff para dudas)" aria-label="Mensaje de chat" maxlength="500" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <button class="chat-send-btn" id="chat-send-btn" type="button" aria-label="Enviar mensaje" title="Enviar mensaje">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
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

  /* Misiones diarias y gamificación XP real */
  function renderMissionsWidget(data, body, xpEl, levelBadge) {
    if (!body) return;

    if (data.auth_required) {
      if (xpEl) {
        xpEl.textContent = '+XP';
        xpEl.classList.remove('is-ready');
      }
      if (levelBadge) levelBadge.textContent = 'Nv. 1';
      body.innerHTML = `
        <div class="hs-empty">
          <img src="/assets/icons/svg/star.svg" alt="" width="28" height="28" class="hs-empty--icon">
          <span>Inicia sesión para ganar XP y completar tus misiones diarias.</span>
          <a href="/pages/login.html" class="mision-action-link" style="margin-top:6px;">Iniciar sesión →</a>
        </div>`;
      return;
    }

    const missions = data.missions || [];
    const chest = data.chest;
    const level = data.level || (Math.floor((data.xp || 0) / 1000) + 1);
    const streak = data.streak_days || 0;
    const coins = data.coins || 0;
    const xp = data.xp || 0;
    const levelPct = data.level_progress_pct ?? Math.floor(((xp % 1000) / 1000) * 100);

    let readyXP = 0;
    missions.forEach(m => {
      if (m.can_claim) readyXP += (m.reward_xp || 0);
    });
    if (chest?.can_claim) readyXP += (chest.reward_xp || 0);

    if (levelBadge) {
      levelBadge.textContent = `Nv. ${level}`;
    }
    if (xpEl) {
      if (readyXP > 0) {
        xpEl.textContent = `+${readyXP} XP listo`;
        xpEl.classList.add('is-ready');
      } else {
        xpEl.textContent = `${data.total_claimed || 0}/${data.total_missions || missions.length} Reclamadas`;
        xpEl.classList.remove('is-ready');
      }
    }

    const iconMap = {
      'book-open': '📖',
      'flame': '🔥',
      'message-circle': '💬',
      'bookmark': '🔖',
      'gift': '🎁',
    };

    const missionsHtml = missions.map(m => {
      const icon = iconMap[m.icon] || '⭐';
      let actionBtnHtml = '';

      if (m.is_claimed) {
        actionBtnHtml = `
          <span class="mision-claimed-status">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Reclamada
          </span>`;
      } else if (m.can_claim) {
        actionBtnHtml = `
          <button type="button" class="mision-claim-btn" data-key="${esc(m.key)}">
            Reclamar +${m.reward_xp} XP
          </button>`;
      } else {
        actionBtnHtml = `
          <a href="${esc(m.action_url || '/pages/catalogo.html')}" class="mision-action-link">
            ${esc(m.action_text || 'Ir')} →
          </a>`;
      }

      return `
        <div class="mision-card ${m.is_claimed ? 'is-claimed' : (m.can_claim ? 'is-ready' : '')}">
          <div class="mision-card--top">
            <div class="mision-card--title-wrap">
              <span class="mision-icon-badge">${icon}</span>
              <div class="mision-card--meta">
                <h4 class="mision-card--title">${esc(m.title)}</h4>
                <div class="mision-card--sub">${esc(m.description)}</div>
              </div>
            </div>
            <div class="mision-rewards-group">
              <span class="mision-reward-chip mision-reward-chip--xp">+${m.reward_xp} XP</span>
              <span class="mision-reward-chip mision-reward-chip--coins">+${m.reward_coins} G</span>
            </div>
          </div>
          <div class="mision-card--bottom">
            <div class="mision-card--progress-group">
              <div class="mision-card--bar">
                <div class="mision-card--bar-fill" style="width: ${m.progress_pct}%"></div>
              </div>
              <span class="mision-card--prog-text">${esc(m.progress_label)}</span>
            </div>
            ${actionBtnHtml}
          </div>
        </div>
      `;
    }).join('');

    let chestHtml = '';
    if (chest) {
      let chestActionHtml = '';
      if (chest.is_claimed) {
        chestActionHtml = `<span class="mision-claimed-status">✓ Reclamado hoy</span>`;
      } else if (chest.can_claim) {
        chestActionHtml = `
          <button type="button" class="mision-chest-btn" data-key="${esc(chest.key)}">
            🎁 Reclamar Cofre (+${chest.reward_xp} XP)
          </button>`;
      } else {
        chestActionHtml = `<span class="mision-chest--locked-label">🔒 ${esc(chest.progress_label)}</span>`;
      }

      chestHtml = `
        <div class="mision-chest ${chest.can_claim ? 'is-ready' : ''}">
          <div class="mision-chest--head">
            <div class="mision-chest--title-wrap">
              <span class="mision-chest--icon">🎁</span>
              <div>
                <h4 class="mision-chest--title">${esc(chest.title)}</h4>
                <span class="mision-chest--sub">Todas las misiones del día (4/4)</span>
              </div>
            </div>
            <div class="mision-rewards-group">
              <span class="mision-reward-chip mision-reward-chip--xp">+${chest.reward_xp} XP</span>
              <span class="mision-reward-chip mision-reward-chip--coins">+${chest.reward_coins} G</span>
            </div>
          </div>
          <div class="mision-chest--bar">
            <div class="mision-chest--bar-fill" style="width: ${chest.progress_pct}%"></div>
          </div>
          <div class="mision-chest--footer">
            <span class="mision-chest--reward-badge">✨ Bonus ${chest.progress_pct}%</span>
            ${chestActionHtml}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="mision-list">
        ${missionsHtml}
      </div>
      ${chestHtml}
    `;
  }

  (async () => {
    const xpEl = document.getElementById('mision-xp');
    const levelBadge = document.getElementById('mision-level-badge');
    const body = document.getElementById('slot-mision');
    if (!body) return;

    // Delegación de eventos de reclamo
    body.addEventListener('click', async (e) => {
      const claimBtn = e.target.closest('.mision-claim-btn, .mision-chest-btn');
      if (!claimBtn || claimBtn.disabled) return;

      const missionKey = claimBtn.dataset.key;
      if (!missionKey) return;

      claimBtn.disabled = true;
      const originalText = claimBtn.innerHTML;
      claimBtn.textContent = 'Reclamando...';

      try {
        const res = await apiRequest('/home/mission/claim/', {
          method: 'POST',
          body: { mission_key: missionKey },
        });

        // Crear partícula flotante de XP animada
        const rect = claimBtn.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const particle = document.createElement('div');
        particle.className = 'mision-floating-reward';
        particle.textContent = `+${res.xp_awarded} XP! ✨`;
        particle.style.left = `${rect.left - bodyRect.left + rect.width / 2}px`;
        particle.style.top = `${rect.top - bodyRect.top}px`;
        body.appendChild(particle);
        // Si subió de nivel (hito especial), mostrar toast destacado
        if (res.leveled_up) {
          showToast(`🎉 ¡SUBISTE DE NIVEL! Ahora eres Nivel ${res.new_level}`, 'success', 5000);
        }

        // Notificar a toda la ventana para actualizar barras de XP en navbar/perfil
        window.dispatchEvent(new CustomEvent('yume:xp-updated', { detail: res }));

        if (res.missions_state) {
          renderMissionsWidget(res.missions_state, body, xpEl, levelBadge);
        }
      } catch (err) {
        showToast(err.message || 'No se pudo reclamar la misión', 'error');
        claimBtn.disabled = false;
        claimBtn.innerHTML = originalText;
      }
    });

    async function fetchAndRenderMissions() {
      try {
        const data = await apiRequest('/home/mission/');
        renderMissionsWidget(data, body, xpEl, levelBadge);
      } catch (err) {
        const isAuth = err?.status === 401 || err?.status === 403;
        body.innerHTML = emptyState(
          'star',
          isAuth ? 'Inicia sesión para ver tus misiones diarias.' : 'No se pudo cargar las misiones.'
        );
      }
    }

    await fetchAndRenderMissions();

    // Re-verificar cuando la ventana recupera el foco (por ejemplo después de leer un capítulo en otra pestaña)
    window.addEventListener('focus', () => {
      fetchAndRenderMissions();
    });
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
          const data = await apiRequest(`/home/ranking/?period=${btn.dataset.period}`);
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

  const anuncioTabs = document.getElementById('anuncio-tabs');
  if (anuncioTabs) {
    anuncioTabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset.type) return;

      anuncioTabs.querySelectorAll('button').forEach(t => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      const slot = document.getElementById('slot-anuncios');
      if (slot) slot.innerHTML = skeletonCards('anuncio', 2, 1);
      loadAnuncios(slot, btn.dataset.type);
    });
  }

  const popularFormatTabs = document.getElementById('popular-format-tabs');
  if (popularFormatTabs) {
    popularFormatTabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset.format) return;

      popularFormatTabs.querySelectorAll('button').forEach(t => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      const slot = document.getElementById('slot-popular');
      if (slot) {
        slot.innerHTML = skeletonCards('popular', 4, 4);
        loadPopulars(slot, btn.dataset.format);
      }
    });
  }

  // Canales, Filtros y Enviar mensajes en el Chat en Vivo
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatSlot = document.getElementById('slot-chat');
  const chatFilterToggle = document.getElementById('chat-filter-toggle');
  const chatFilterDropdown = document.getElementById('chat-filter-dropdown');
  const chatFilterDropdownClose = document.getElementById('chat-filter-dropdown-close');
  const chatOnlineIndicator = document.getElementById('chat-online-indicator');
  const chatOnlineDrawer = document.getElementById('chat-online-drawer');
  const chatOnlineDrawerClose = document.getElementById('chat-online-drawer-close');

  // Inicializar carga de stats en línea
  loadChatOnlineStats();

  // Permisos dinámicos y estado del canal activo
  function applyChatChannelPermissions(channel) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (currentUser.platform_role || '').toUpperCase();
    const isStaff = ['ADMIN', 'SUPERADMIN'].includes(role);
    const isScan = Boolean(currentUser.is_scan_member || isStaff);

    const badgeEl = document.getElementById('chat-current-channel-badge');
    if (badgeEl) badgeEl.textContent = `#${channel}`;

    if (!chatInput) return;

    if (channel === 'staff' && !isStaff) {
      chatInput.disabled = true;
      chatInput.value = '';
      chatInput.placeholder = '🔒 Solo el Staff puede escribir en #staff';
      chatInput.classList.add('is-restricted');
      if (chatSendBtn) chatSendBtn.disabled = true;
    } else if (channel === 'scans' && !isScan) {
      chatInput.disabled = true;
      chatInput.value = '';
      chatInput.placeholder = '🔒 Solo Staff y Scans pueden publicar aquí';
      chatInput.classList.add('is-restricted');
      if (chatSendBtn) chatSendBtn.disabled = true;
    } else {
      chatInput.disabled = false;
      chatInput.classList.remove('is-restricted');
      chatInput.placeholder = channel === 'general'
        ? 'Escribe en #general… (usa @staff para dudas)'
        : `Escribe en #${channel}…`;
      if (chatSendBtn) chatSendBtn.disabled = false;
    }
  }

  // Inicializar permisos del canal general
  applyChatChannelPermissions(activeChatChannel);

  // Escuchar cuando el usuario se sincroniza desde el header o login
  window.addEventListener('auth:user-synced', () => {
    applyChatChannelPermissions(activeChatChannel);
  });
  window.addEventListener('auth:profile-updated', (e) => {
    if (e.detail?.user) {
      try { localStorage.setItem('user', JSON.stringify(e.detail.user)); } catch { }
    }
    applyChatChannelPermissions(activeChatChannel);
  });

  // Si hay token pero el objeto de usuario aún no está en memoria local, sincronizar al instante
  if (getAccessToken()) {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!cachedUser.platform_role) {
      apiRequest('/auth/me').then(u => {
        if (u) {
          try { localStorage.setItem('user', JSON.stringify(u)); } catch { }
          applyChatChannelPermissions(activeChatChannel);
        }
      }).catch(() => { });
    }
  }

  // Cambio de Canal desde el Menú Desplegable
  if (chatFilterDropdown) {
    chatFilterDropdown.querySelectorAll('input[name="chat-channel-choice"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const nextChannel = e.target.value;
        if (!nextChannel || nextChannel === activeChatChannel) return;
        activeChatChannel = nextChannel;
        applyChatChannelPermissions(activeChatChannel);

        if (chatSlot) {
          chatSlot.innerHTML = skeletonCards('chat', 3, 1);
          loadChat(chatSlot, activeChatChannel);
        }
        // Cerrar menú tras elegir canal para fluidez
        chatFilterDropdown.hidden = true;
        chatFilterToggle?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Toggle del Selector de Canales del Chat
  if (chatFilterToggle && chatFilterDropdown) {
    chatFilterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = chatFilterDropdown.hidden;
      chatFilterDropdown.hidden = !isHidden;
      chatFilterToggle.setAttribute('aria-expanded', String(isHidden));
      if (chatOnlineDrawer) chatOnlineDrawer.hidden = true;
    });

    chatFilterDropdownClose?.addEventListener('click', () => {
      chatFilterDropdown.hidden = true;
      chatFilterToggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Acción de fijar / desfijar para el Staff
  async function handleTogglePin(pinBtn) {
    const msgId = pinBtn.dataset.msgId;
    if (!msgId) return;
    pinBtn.disabled = true;
    try {
      const res = await apiRequest(`/chat/messages/${msgId}/pin`, { method: 'PATCH' });
      if (res?.is_pinned) {
        showToast('📌 Mensaje fijado en el chat general', 'success');
      } else {
        showToast('Mensaje desfijado del chat', 'info');
      }
      await loadChat(chatSlot, activeChatChannel);
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado fijado', 'error');
    } finally {
      pinBtn.disabled = false;
    }
  }

  const chatPinnedBarEl = document.getElementById('chat-pinned-bar');
  if (chatPinnedBarEl) {
    chatPinnedBarEl.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('.chat-msg--pin-action-btn');
      if (pinBtn) {
        e.stopPropagation();
        handleTogglePin(pinBtn);
      }
    });
  }

  // Delegación de Clics en el Chat: Spoilers, Pin/Desfijar de Staff y Mención rápida
  if (chatSlot) {
    chatSlot.addEventListener('click', async (e) => {
      // 1. Botón de fijar / desfijar para el Staff
      const pinBtn = e.target.closest('.chat-msg--pin-action-btn');
      if (pinBtn) {
        e.stopPropagation();
        await handleTogglePin(pinBtn);
        return;
      }

      // 2. Spoilers interactivos
      const spoilerBox = e.target.closest('.chat-spoiler-box');
      if (spoilerBox) {
        spoilerBox.classList.toggle('is-revealed');
        return;
      }

      // 3. Mención rápida al hacer clic en el nombre, avatar o chip @mención
      const targetUserEl = e.target.closest('.chat-mention, .chat-msg--name, .chat-msg--avatar');
      if (targetUserEl && chatInput && !chatInput.disabled) {
        let username = targetUserEl.dataset.username;
        if (!username) {
          const msgBox = targetUserEl.closest('.chat-msg');
          username = msgBox?.dataset.author || targetUserEl.textContent?.replace(/^@/, '').trim();
        }
        if (username) {
          username = username.trim();
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const myUsername = (currentUser.username || '').toLowerCase();
          // Impedir mencionarse a sí mismo
          if (username.toLowerCase() === myUsername) {
            showToast('No puedes mencionarte a ti mismo', 'info', 2500);
            return;
          }
          const mentionTag = `@${username} `;
          const currentVal = chatInput.value;
          if (!currentVal.includes(mentionTag)) {
            chatInput.value = currentVal ? `${currentVal.trim()} ${mentionTag}` : mentionTag;
          }
          chatInput.focus();
        }
      }
    });
  }

  // Guía de Comandos (#ayuda)
  const chatHelpBtn = document.getElementById('chat-help-btn');
  const chatHelpPopover = document.getElementById('chat-help-popover');
  const chatHelpPopoverClose = document.getElementById('chat-help-popover-close');

  function toggleHelpPopover() {
    if (!chatHelpPopover) return;
    const isHidden = chatHelpPopover.hidden;
    chatHelpPopover.hidden = !isHidden;
    chatHelpBtn?.setAttribute('aria-expanded', String(isHidden));
    if (chatFilterDropdown) chatFilterDropdown.hidden = true;
    if (chatOnlineDrawer) chatOnlineDrawer.hidden = true;
  }

  if (chatHelpBtn) {
    chatHelpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHelpPopover();
    });
  }

  if (chatHelpPopoverClose) {
    chatHelpPopoverClose.addEventListener('click', () => {
      if (chatHelpPopover) chatHelpPopover.hidden = true;
      chatHelpBtn?.setAttribute('aria-expanded', 'false');
    });
  }

  if (chatHelpPopover) {
    chatHelpPopover.addEventListener('click', (e) => {
      const item = e.target.closest('.chat-help-item');
      if (item && chatInput && !chatInput.disabled) {
        const cmd = item.dataset.cmd;
        if (cmd) {
          if (cmd === '#ayuda') {
            showToast('💡 Escribe #spoiler <texto> o ||texto|| para spoilers, o @staff para dudas', 'info', 6000);
          } else {
            const val = chatInput.value;
            chatInput.value = val ? `${val} ${cmd}` : cmd;
            chatInput.focus();
          }
          chatHelpPopover.hidden = true;
          chatHelpBtn?.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  // Toggle de Usuarios en Línea
  if (chatOnlineIndicator && chatOnlineDrawer) {
    chatOnlineIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = chatOnlineDrawer.hidden;
      chatOnlineDrawer.hidden = !isHidden;
      if (chatFilterDropdown) chatFilterDropdown.hidden = true;
      if (chatHelpPopover) chatHelpPopover.hidden = true;
      if (isHidden) loadChatOnlineStats();
    });

    chatOnlineDrawerClose?.addEventListener('click', () => {
      chatOnlineDrawer.hidden = true;
    });
  }

  // Cerrar popups de chat al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (chatFilterDropdown && !chatFilterDropdown.hidden && !e.target.closest('#chat-filter-dropdown') && !e.target.closest('#chat-filter-toggle')) {
      chatFilterDropdown.hidden = true;
      chatFilterToggle?.setAttribute('aria-expanded', 'false');
    }
    if (chatHelpPopover && !chatHelpPopover.hidden && !e.target.closest('#chat-help-popover') && !e.target.closest('#chat-help-btn') && !e.target.closest('#chat-hint-help')) {
      chatHelpPopover.hidden = true;
      chatHelpBtn?.setAttribute('aria-expanded', 'false');
    }
    if (chatOnlineDrawer && !chatOnlineDrawer.hidden && !e.target.closest('#chat-online-drawer') && !e.target.closest('#chat-online-indicator')) {
      chatOnlineDrawer.hidden = true;
    }
  });

  async function handleSendChatMessage() {
    if (!chatInput || chatInput.disabled) return;
    let content = chatInput.value.trim();
    if (!content) return;

    if (!getAccessToken()) {
      showToast('Debes iniciar sesión para participar en el chat en vivo', 'warning');
      return;
    }

    // Evitar que el usuario se mencione a sí mismo
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myUsername = (currentUser.username || '').toLowerCase();
    if (myUsername && new RegExp(`@${myUsername}\\b`, 'i').test(content)) {
      content = content.replace(new RegExp(`@${myUsername}\\b`, 'gi'), myUsername).trim();
    }

    // Comandos especiales de chat
    if (/^[#/]ayuda$/i.test(content) || /^[#/]help$/i.test(content)) {
      chatInput.value = '';
      if (chatHelpPopover) {
        chatHelpPopover.hidden = false;
        chatHelpBtn?.setAttribute('aria-expanded', 'true');
      } else {
        showToast('💡 Comandos: @staff (preguntar al Staff), #spoiler <texto> o ||texto|| (ocultar spoiler)', 'info', 6000);
      }
      return;
    }

    if (chatSendBtn) chatSendBtn.disabled = true;
    chatInput.disabled = true;

    try {
      await apiRequest('/chat/messages', {
        method: 'POST',
        body: { content, channel: activeChatChannel },
      });
      chatInput.value = '';
      await loadChat(chatSlot, activeChatChannel);
      loadChatOnlineStats();
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el mensaje', 'error');
    } finally {
      applyChatChannelPermissions(activeChatChannel);
      chatInput.focus();
    }
  }

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', handleSendChatMessage);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChatMessage();
      }
    });
  }

  // Refresco suave cada 20 segundos para el Chat en Vivo
  const chatInterval = setInterval(() => {
    if (document.hidden) return;
    const currentChatSlot = document.getElementById('slot-chat');
    if (currentChatSlot) {
      loadChat(currentChatSlot, activeChatChannel);
      loadChatOnlineStats();
    } else {
      clearInterval(chatInterval);
    }
  }, 20000);
}
