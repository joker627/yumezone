/** Secciones dinámicas del home: Continuar Leyendo, Lanzamientos, Ranking, Populares y Sidebar. */
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc, safeUrl, IMG_FALLBACK, makeWorkUrl, applyDataProgress } from '../shared/ui-utils.js';
import { renderLaunchItem, renderRankCard, renderPopularCard } from '../components/cards.js';
import { showToast } from '../shared/toast.js';
import { initChatPicker, getChatPickerTemplate } from '../components/chat-picker.js';

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
          <div class="continue-card--progress-fill" data-progress="${progress}"></div>
        </div>
        <span class="continue-card--pct">${progress}%</span>
      </div>
      <div class="continue-card--footer">
        <span class="continue-card--cta">${isFull ? '✓ Releer' : '▶ Reanudar'}</span>
      </div>
    </div>
  </a>`;
}

function getCategoryInfo(item) {
  const type = (item.type || '').toLowerCase();
  const isResolved = Boolean(item.is_resolved);

  if (type === 'sistema') {
    return {
      catClass: 'cat-system',
      categoryText: isResolved ? 'Sistema • Completado' : 'Sistema • Activo'
    };
  } else if (type === 'evento') {
    return {
      catClass: 'cat-event',
      categoryText: isResolved ? 'Evento • Finalizado' : 'Evento • Activo'
    };
  } else if (type === 'alerta' || type === 'aviso') {
    return {
      catClass: 'cat-alert',
      categoryText: isResolved ? 'Aviso • Resuelto' : 'Aviso Importante'
    };
  } else if (type === 'actualizacion' || type === 'update') {
    return {
      catClass: 'cat-update',
      categoryText: isResolved ? 'Actualización • Aplicada' : 'Actualización'
    };
  } else {
    return {
      catClass: 'cat-system',
      categoryText: isResolved ? `${esc(item.type_label || 'Oficial')} • Completado` : `${esc(item.type_label || 'Oficial')} • Activo`
    };
  }
}

function renderAnuncio(item) {
  const info = getCategoryInfo(item);
  const title = esc(item.title ?? '');
  const desc = esc(item.description ?? item.desc ?? '');
  const time = esc(item.published_text ?? item.time ?? '');
  const isResolved = Boolean(item.is_resolved);

  return `
    <div class="announcement ${isResolved ? 'is-resolved' : ''}">
      <div class="card-top">
        <span class="category ${info.catClass}">${info.categoryText}</span>
        <span class="date">${time}</span>
      </div>
      <div class="card-title">${title}</div>
      <div class="card-desc">${desc}</div>
    </div>
  `;
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
      /* anuncio: texto limpio con divider */
      html += `
      <div class="announcement">
        <div class="card-top">
          <div class="sk-box sk-tag"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
        </div>
        <div class="sk-box sk-line sk-w-80" style="margin-bottom: 6px;"></div>
        <div class="sk-box sk-line sk-line--xs sk-w-90" style="margin-bottom: 4px;"></div>
        <div class="sk-box sk-line sk-line--xs sk-w-70"></div>
      </div>
      <div class="divider"></div>
      <div class="announcement">
        <div class="card-top">
          <div class="sk-box sk-tag"></div>
          <div class="sk-box sk-line sk-line--xs sk-w-tag"></div>
        </div>
        <div class="sk-box sk-line sk-w-80" style="margin-bottom: 6px;"></div>
        <div class="sk-box sk-line sk-line--xs sk-w-90" style="margin-bottom: 4px;"></div>
        <div class="sk-box sk-line sk-line--xs sk-w-70"></div>
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
      applyDataProgress(slot);
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


let anuncioTimer = null;
let currentAnuncioIdx = 1;
let isAnuncioTransitioning = false;
let isAnuncioHovered = false;
const ANUNCIO_SLIDE_DURATION = 6000;

async function loadAnuncios() {
  const section = document.getElementById('section-anuncios');
  const slot = document.getElementById('slot-anuncios');
  const controls = document.getElementById('anuncio-nav-controls');
  const counter = document.getElementById('anuncio-counter');
  const progressTrack = document.getElementById('anuncio-progress-track');
  const progressBar = document.getElementById('anuncio-progress-bar');

  if (!slot) return;

  try {
    const data = await apiRequest('/announcements/');
    const all = data.results ?? data ?? [];
    const items = all.filter(item => {
      const t = (item.type || '').toLowerCase();
      return t === 'sistema' || t === 'evento' || !t;
    }).slice(0, 6);

    if (!items.length) {
      slot.innerHTML = emptyState('bell', 'No hay anuncios activos.');
      if (controls) controls.hidden = true;
      if (progressTrack) progressTrack.hidden = true;
      return;
    }

    const pairs = [];
    for (let i = 0; i < items.length; i += 2) {
      pairs.push(items.slice(i, i + 2));
    }

    function renderSlideHtml(group, idx) {
      return `
        <div class="slide" data-slide-index="${idx}">
          ${group.map((item, i) => `
            ${renderAnuncio(item)}
            ${i < group.length - 1 ? '<div class="divider"></div>' : ''}
          `).join('')}
        </div>
      `;
    }

    const totalOriginal = pairs.length;

    if (totalOriginal <= 1) {
      slot.innerHTML = `
        <div class="slider-viewport">
          <div class="slider-track">
            ${renderSlideHtml(pairs[0], 0)}
          </div>
        </div>
      `;
      if (controls) controls.hidden = true;
      if (progressTrack) progressTrack.hidden = true;
      return;
    }

    // Carrusel continuo infinito: [Clon Último] + [Slide 0] + [Slide 1] ... + [Clon Primero]
    // Permite deslizarse en línea de forma continua sin jamás retroceder de golpe
    const clonedLast = renderSlideHtml(pairs[totalOriginal - 1], totalOriginal - 1);
    const clonedFirst = renderSlideHtml(pairs[0], 0);

    slot.innerHTML = `
      <div class="slider-viewport">
        <div class="slider-track" id="slider-track">
          ${clonedLast}
          ${pairs.map((g, idx) => renderSlideHtml(g, idx)).join('')}
          ${clonedFirst}
        </div>
      </div>
    `;

    const track = document.getElementById('slider-track');
    if (controls) controls.hidden = false;
    if (progressTrack) progressTrack.hidden = false;

    currentAnuncioIdx = 1;

    function getViewportWidth() {
      const vp = slot.querySelector('.slider-viewport');
      return vp ? vp.getBoundingClientRect().width : 0;
    }

    function setSlidePosition(animate = true) {
      const w = getViewportWidth();
      if (!w) return;
      track.style.transition = animate ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
      track.style.transform = `translate3d(-${currentAnuncioIdx * w}px, 0, 0)`;
      updateCounter();
    }

    // Inicializar en Slide 1 sin animación
    setSlidePosition(false);

    function updateCounter() {
      if (!counter) return;
      let displayIdx = currentAnuncioIdx;
      if (displayIdx === 0) displayIdx = totalOriginal;
      else if (displayIdx === totalOriginal + 1) displayIdx = 1;
      counter.textContent = `${String(displayIdx).padStart(2, '0')} / ${String(totalOriginal).padStart(2, '0')}`;
    }

    function startTimeline() {
      if (!progressBar) return;
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      void progressBar.offsetWidth;
      if (!isAnuncioHovered) {
        progressBar.style.transition = `width ${ANUNCIO_SLIDE_DURATION}ms linear`;
        progressBar.style.width = '100%';
      }
    }

    function goToSlide(targetIdx) {
      if (isAnuncioTransitioning) return;
      isAnuncioTransitioning = true;
      currentAnuncioIdx = targetIdx;
      setSlidePosition(true);
      startTimeline();
    }

    function nextSlide() {
      goToSlide(currentAnuncioIdx + 1);
    }

    function prevSlide() {
      goToSlide(currentAnuncioIdx - 1);
    }

    track.addEventListener('transitionend', () => {
      isAnuncioTransitioning = false;
      const w = getViewportWidth();
      // Salto invisible instantáneo al alcanzar los extremos clonados
      if (currentAnuncioIdx === totalOriginal + 1) {
        track.style.transition = 'none';
        currentAnuncioIdx = 1;
        track.style.transform = `translate3d(-${w}px, 0, 0)`;
      } else if (currentAnuncioIdx === 0) {
        track.style.transition = 'none';
        currentAnuncioIdx = totalOriginal;
        track.style.transform = `translate3d(-${totalOriginal * w}px, 0, 0)`;
      }
      updateCounter();
    });

    window.addEventListener('resize', () => {
      setSlidePosition(false);
    });

    function startAutoPlay() {
      clearInterval(anuncioTimer);
      anuncioTimer = setInterval(() => {
        nextSlide();
      }, ANUNCIO_SLIDE_DURATION);
    }

    function resetAutoPlay() {
      clearInterval(anuncioTimer);
      startTimeline();
      startAutoPlay();
    }

    // Navegación táctil optimizada y arrastre suave
    const viewport = slot.querySelector('.slider-viewport');
    let isPointerDown = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartTime = 0;
    let gestureDirection = null; // 'horizontal' | 'vertical' | null
    let didDrag = false;
    let pointerCaptureTarget = null;

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isAnuncioTransitioning) return;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerStartTime = Date.now();
      isPointerDown = true;
      gestureDirection = null;
      didDrag = false;
      pointerCaptureTarget = null;
      clearInterval(anuncioTimer);
      if (progressBar) {
        const computedWidth = getComputedStyle(progressBar).width;
        progressBar.style.transition = 'none';
        progressBar.style.width = computedWidth;
      }
    }

    function onPointerMove(e) {
      if (!isPointerDown) return;
      const dx = e.clientX - pointerStartX;
      const dy = e.clientY - pointerStartY;

      // Determinar la intención direccional en los primeros píxeles
      if (!gestureDirection) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 7 && absY < 7) return; // Zona muerta táctil
        if (absY >= absX) {
          // Gesto predominantemente vertical: permitir scroll nativo sin trabas
          gestureDirection = 'vertical';
          isPointerDown = false;
          return;
        }
        // Gesto horizontal confirmado
        gestureDirection = 'horizontal';
        pointerCaptureTarget = viewport;
        try {
          pointerCaptureTarget?.setPointerCapture?.(e.pointerId);
        } catch {}
        viewport?.classList.add('is-dragging');
      }

      if (gestureDirection === 'horizontal') {
        didDrag = true;
        if (e.cancelable) e.preventDefault();
        const w = getViewportWidth();
        track.style.transition = 'none';
        track.style.transform = `translate3d(${-currentAnuncioIdx * w + dx}px, 0, 0)`;
      }
    }

    function onPointerUp(e) {
      if (!isPointerDown && !didDrag) return;
      const wasDragging = didDrag;
      isPointerDown = false;
      didDrag = false;
      gestureDirection = null;

      try {
        pointerCaptureTarget?.releasePointerCapture?.(e.pointerId);
      } catch {}
      pointerCaptureTarget = null;
      viewport?.classList.remove('is-dragging');

      if (wasDragging) {
        const dx = e.clientX - pointerStartX;
        const timeDiff = Math.max(1, Date.now() - pointerStartTime);
        const velocity = Math.abs(dx) / timeDiff; // px/ms
        const isFlick = velocity > 0.25;
        const passedDistance = Math.abs(dx) >= 28;

        if (isFlick || passedDistance) {
          if (dx < 0) nextSlide();
          else prevSlide();
        } else {
          setSlidePosition(true);
        }
        resetAutoPlay();
      }
    }

    function onPointerCancel(e) {
      isPointerDown = false;
      didDrag = false;
      gestureDirection = null;
      try {
        pointerCaptureTarget?.releasePointerCapture?.(e.pointerId);
      } catch {}
      pointerCaptureTarget = null;
      viewport?.classList.remove('is-dragging');
      setSlidePosition(true);
      resetAutoPlay();
    }

    if (viewport) {
      viewport.addEventListener('pointerdown', onPointerDown);
      viewport.addEventListener('pointermove', onPointerMove);
      viewport.addEventListener('pointerup', onPointerUp);
      viewport.addEventListener('pointercancel', onPointerCancel);
    }

    const hasDesktopMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (section && hasDesktopMouse) {
      section.onmouseenter = () => {
        if (!isPointerDown) {
          isAnuncioHovered = true;
          clearInterval(anuncioTimer);
          if (progressBar) {
            const computedWidth = getComputedStyle(progressBar).width;
            progressBar.style.transition = 'none';
            progressBar.style.width = computedWidth;
          }
        }
      };

      section.onmouseleave = () => {
        if (!isPointerDown) {
          isAnuncioHovered = false;
          resetAutoPlay();
        }
      };
    }

    updateCounter();
    startTimeline();
    startAutoPlay();
  } catch {
    slot.innerHTML = emptyState('bell', 'No se pudieron cargar los anuncios.');
    if (controls) controls.hidden = true;
    if (progressTrack) progressTrack.hidden = true;
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

        <!-- Tablón de Anuncios (Mini-Carrusel Cyber-News) -->
        <section class="aside-card aside-card--anuncios" aria-labelledby="aside-anuncios-title" id="section-anuncios">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--teal">
                <img src="/assets/icons/svg/bell.svg" alt="" aria-hidden="true">
              </div>
              <h2 id="aside-anuncios-title" class="aside-card--title">Tablón de Anuncios</h2>
            </div>
            <div class="anuncio-nav-controls" id="anuncio-nav-controls" hidden>
              <span class="anuncio-counter" id="anuncio-counter">01 / 01</span>
            </div>
          </div>
          <div class="aside-card--body anuncio-body">
            <div class="anuncio-progress-track" id="anuncio-progress-track" hidden>
              <div class="anuncio-progress-bar" id="anuncio-progress-bar"></div>
            </div>
            <div id="slot-anuncios">${skeletonCards('anuncio', 1, 1)}</div>
          </div>
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

        <!-- Chat en Vivo de la Comunidad (Nativo con GIFs y Emojis) -->
        <section class="aside-card aside-card--chat" aria-labelledby="aside-chat-title" id="section-chat">
          <div class="aside-card--head">
            <div class="aside-card--head-left">
              <div class="aside-card--icon aside-card--icon--teal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div class="chat-title-group">
                <h2 id="aside-chat-title" class="aside-card--title">Chat en Vivo</h2>
                <div class="chat-online-pill" id="chat-online-badge" title="Lectores en línea">
                  <span class="hs-dot"></span>
                  <span id="chat-online-count">1 en línea</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Feed de mensajes -->
          <div class="chat-messages" id="slot-chat" role="log" aria-live="polite">
            ${skeletonCards('chat', 4, 1)}
          </div>

          <!-- Popover flotante modular para Emojis y GIFs -->
          <div class="chat-picker-popover" id="chat-picker-popover" hidden>
            ${getChatPickerTemplate()}
          </div>

          <!-- Barra de composición -->
          <div class="chat-input-row" id="chat-input-row"></div>
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
  initChatSection(document.getElementById('section-chat'));

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
          <a href="/pages/login.html" class="mision-action-link mision-action-link--spaced">Iniciar sesión →</a>
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
            <img src="/assets/icons/svg/check.svg" width="11" height="11" alt="" aria-hidden="true">
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
                <div class="mision-card--bar-fill" data-progress="${m.progress_pct}"></div>
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
        <div class="mision-chest ${chest.can_claim ? 'is-ready' : ''} ${chest.is_claimed ? 'is-claimed' : ''}">
          <div class="mision-chest--head">
            <div class="mision-chest--title-wrap">
              <div class="mision-chest--icon-box">
                <span class="mision-chest--icon">🎁</span>
              </div>
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
            <div class="mision-chest--bar-fill" data-progress="${chest.progress_pct}"></div>
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
    applyDataProgress(body);
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

        // Crear partícula flotante de XP animada en el viewport
        const rect = claimBtn.getBoundingClientRect();
        const particle = document.createElement('div');
        particle.className = 'mision-floating-reward';
        particle.textContent = `+${res.xp_awarded} XP! ✨`;
        particle.style.position = 'fixed';
        particle.style.left = `${rect.left + rect.width / 2}px`;
        particle.style.top = `${rect.top}px`;
        particle.style.zIndex = '9999';
        particle.style.pointerEvents = 'none';
        document.body.appendChild(particle);
        window.setTimeout(() => particle.remove(), 1200);

        showToast(res.message || `+${res.xp_awarded} XP reclamados con éxito`, 'success');

        // Si subió de nivel (hito especial), mostrar toast destacado
        if (res.leveled_up) {
          showToast(`🎉 ¡SUBISTE DE NIVEL! Ahora eres Nivel ${res.new_level}`, 'success', 5000);
        }

        // Notificar a toda la ventana (el listener se encargará de actualizar el widget y el navbar)
        window.dispatchEvent(new CustomEvent('yume:xp-updated', { detail: res }));
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

    // Re-verificar cuando la ventana recupera el foco o cuando se reclama una misión (ej. desde el Header)
    window.addEventListener('focus', () => {
      fetchAndRenderMissions();
    });

    window.addEventListener('yume:xp-updated', (e) => {
      if (e.detail && e.detail.missions_state) {
        renderMissionsWidget(e.detail.missions_state, body, xpEl, levelBadge);
      } else {
        fetchAndRenderMissions();
      }
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

  window.addEventListener('auth:profile-updated', (e) => {
    if (e.detail?.user) {
      try { localStorage.setItem('user', JSON.stringify(e.detail.user)); } catch { }
    }
  });

  if (getAccessToken()) {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!cachedUser.platform_role) {
      apiRequest('/auth/me').then(u => {
        if (u) {
          try { localStorage.setItem('user', JSON.stringify(u)); } catch { }
        }
      }).catch(() => { });
    }
  }

  /* =========================================================================
     Chat en Vivo Nativo de la Comunidad (GIFs, Emojis, Presencia y Roles)
     ========================================================================= */

  function initChatSection(sectionEl) {
    if (!sectionEl) return;

    const slot = document.getElementById('slot-chat');
    const inputRow = document.getElementById('chat-input-row');
    const onlineCountEl = document.getElementById('chat-online-count');

    const pickerPopover = document.getElementById('chat-picker-popover');

    let chatSignature = '';
    let knownMessageIds = new Set();
    const token = getAccessToken();
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch { }

    function formatRelativeTime(dateInput) {
      if (!dateInput) return '';
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '';
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 45) return 'justo ahora';
      if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
      if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function formatChatContent(rawContent) {
      const trimmed = (rawContent || '').trim();
      if (!trimmed) return '';

      // Detección de GIF/imagen (Giphy, Tenor o URL con extensión de imagen/gif)
      const gifRegex = /(https?:\/\/(?:[^\s]+\.(?:gif|webp|png|jpe?g)(?:\?[^\s]*)?|(?:media\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)[^\s]*))/i;
      const match = trimmed.match(gifRegex);

      if (match) {
        const gifUrl = match[1];
        const textPart = trimmed.replace(gifUrl, '').trim();

        let formattedText = '';
        if (textPart) {
          const escapedText = esc(textPart).replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-inline-link">$1</a>'
          );
          formattedText = `<div class="chat-msg--caption">${escapedText}</div>`;
        }

        const gifHtml = `<div class="chat-msg--gif-wrap">
          <img src="${esc(gifUrl)}" alt="GIF" class="chat-msg--gif" loading="lazy" />
        </div>`;

        return formattedText ? `${formattedText}${gifHtml}` : gifHtml;
      }

      let formatted = esc(trimmed);
      formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-inline-link">$1</a>'
      );
      return formatted;
    }

    const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'];

    function renderReactionsMarkup(msgId, reactions = []) {
      const list = Array.isArray(reactions) ? reactions : [];
      const chips = list.map(r => `
        <button type="button" class="chat-reaction-chip ${r.user_reacted ? 'is-active' : ''}" data-msg-id="${msgId}" data-reaction="${esc(r.reaction)}" title="${r.count} reacción(es)">
          <span class="chat-reaction-chip--emoji">${esc(r.reaction)}</span>
          <span class="chat-reaction-chip--count">${r.count}</span>
        </button>
      `).join('');

      return `
        <div class="chat-msg--reactions" data-msg-id="${msgId}">
          <button type="button" class="chat-msg--react-trigger" data-action="toggle-reaction-bar" data-msg-id="${msgId}" title="Reaccionar" aria-label="Añadir reacción">😊+</button>
          <div class="chat-msg--reaction-list">
            ${chips}
          </div>
        </div>
      `;
    }

    function renderSingleMsg(msg) {
      const msgId = msg.id;
      const authorId = msg.user_id;
      const name = esc(msg.username ?? 'Lector');
      const avatarUrl = (msg.avatar_url ?? '').trim();
      const anilloUrl = (msg.anillo_url ?? '').trim();
      const initial = esc((msg.username ?? 'U').slice(0, 1).toUpperCase());
      const role = (msg.platform_role ?? 'USER').toUpperCase();
      const isMod = ['ADMIN', 'SUPERADMIN'].includes(role);
      const isVip = role === 'VIP';
      const roleLabel = isMod ? 'STAFF' : (isVip ? 'VIP' : '');
      const levelNum = Math.floor((Number(msg.xp) || 0) / 1000) + 1;
      const timeStr = msg.created_at ? formatRelativeTime(msg.created_at) : '';

      const avatarMarkup = avatarUrl
        ? `<img class="chat-msg--avatar-img" src="${esc(avatarUrl)}" alt="${name}" loading="lazy" onerror="this.hidden=true;if(this.nextElementSibling){this.nextElementSibling.hidden=false;}"><span class="chat-msg--initial" hidden aria-hidden="true">${initial}</span>`
        : `<span class="chat-msg--initial">${initial}</span>`;

      const frameMarkup = anilloUrl
        ? `<img class="chat-msg--frame-img" src="${esc(anilloUrl)}" alt="" aria-hidden="true">`
        : '';

      const bodyContent = formatChatContent(msg.content);
      const reactionsMarkup = renderReactionsMarkup(msgId, msg.reactions);

      return `
        <div class="chat-msg ${isMod ? 'chat-msg--mod' : ''}" data-msg-id="${msgId}">
          <div class="chat-msg--avatar">
            <div class="chat-msg--avatar-inner">${avatarMarkup}</div>
            ${frameMarkup}
          </div>
          <div class="chat-msg--body">
            <div class="chat-msg--header">
              <span class="chat-msg--name ${isMod ? 'is-mod' : (isVip ? 'is-vip' : '')}">${name}</span>
              ${roleLabel ? `<span class="chat-msg--role chat-msg--role--${roleLabel.toLowerCase()}">${roleLabel}</span>` : ''}
              <span class="chat-msg--level">Nv. ${levelNum}</span>
              <span class="chat-msg--time">${timeStr}</span>
            </div>
            <div class="chat-msg--text">${bodyContent}</div>
            ${reactionsMarkup}
          </div>
        </div>
      `;
    }

    async function loadChatMessages({ force = false } = {}) {
      if (!slot) return;
      try {
        const data = await apiRequest('/chat/messages?limit=40');
        const items = data?.data || [];
        const chronological = items.slice().reverse();
        const signature = chronological.map(m => {
          const rSig = (m.reactions || []).map(r => `${r.reaction}:${r.count}:${r.user_reacted ? 1 : 0}`).join('|');
          return `${m.id}[${rSig}]`;
        }).join(';');

        if (!force && signature === chatSignature) return;

        const nearBottom = (slot.scrollHeight - slot.scrollTop - slot.clientHeight) < 90;
        const newOnes = chronological.filter(m => !knownMessageIds.has(m.id));
        const canAppend = !force && knownMessageIds.size > 0
          && chronological.every(m => knownMessageIds.has(m.id) || newOnes.includes(m))
          && newOnes.length < chronological.length;

        if (canAppend) {
          const keep = new Set(chronological.map(m => String(m.id)));
          slot.querySelectorAll('.chat-msg[data-msg-id]').forEach(el => {
            if (!keep.has(el.dataset.msgId)) el.remove();
          });
          // Actualizar reacciones de los mensajes existentes que cambiaron
          chronological.forEach(m => {
            const existingEl = slot.querySelector(`.chat-msg[data-msg-id="${m.id}"]`);
            if (existingEl) {
              const currentReactionsEl = existingEl.querySelector('.chat-msg--reactions');
              const newMarkup = renderReactionsMarkup(m.id, m.reactions);
              const temp = document.createElement('div');
              temp.innerHTML = newMarkup;
              if (currentReactionsEl && temp.firstElementChild) {
                currentReactionsEl.replaceWith(temp.firstElementChild);
              }
            }
          });
          if (newOnes.length) {
            slot.insertAdjacentHTML('beforeend', newOnes.map(renderSingleMsg).join(''));
          }
        } else if (chronological.length) {
          slot.innerHTML = chronological.map(renderSingleMsg).join('');
        } else {
          slot.innerHTML = emptyState('chat', 'No hay mensajes aún. ¡Sé el primero en escribir!');
        }

        knownMessageIds = new Set(chronological.map(m => m.id));
        chatSignature = signature;

        if (nearBottom || force) {
          requestAnimationFrame(() => { slot.scrollTop = slot.scrollHeight; });
        }
      } catch (err) {
        console.warn('Error al cargar chat:', err);
        if (!knownMessageIds.size) {
          slot.innerHTML = emptyState('chat', 'Chat no disponible temporalmente.');
        }
      }
    }

    async function loadOnlineStats() {
      try {
        const data = await apiRequest('/chat/online');
        if (onlineCountEl && typeof data?.online_count === 'number') {
          onlineCountEl.textContent = `${Math.max(1, data.online_count)} en línea`;
        }
      } catch (err) {
        console.warn('Error al cargar online stats:', err);
      }
    }

    function renderInputRow() {
      if (!inputRow) return;

      if (!token) {
        inputRow.innerHTML = `
          <div class="chat-guest-notice">
            <span>Inicia sesión para participar en el chat</span>
            <a href="/pages/login.html" class="chat-login-action-btn">Entrar →</a>
          </div>
        `;
        return;
      }

      inputRow.innerHTML = `
        <div class="chat-attached-gif-bar" id="chat-attached-gif-bar" hidden>
          <div class="chat-attached-gif-thumb">
            <img id="chat-attached-gif-img" src="" alt="GIF adjunto" />
          </div>
          <div class="chat-attached-gif-details">
            <span class="chat-attached-gif-title">GIF adjunto</span>
            <span class="chat-attached-gif-sub">Se enviará junto con tu mensaje</span>
          </div>
          <button type="button" class="chat-attached-gif-del" id="chat-attached-gif-del" title="Quitar GIF">&times;</button>
        </div>
        <div class="chat-input-main">
          <div class="chat-input-controls">
            <button type="button" class="chat-addon-btn chat-addon-btn--gif" id="chat-btn-gif" title="Insertar GIFs de Anime" aria-label="Abrir selector de GIFs">GIF</button>
          </div>
          <form class="chat-form" id="chat-form" action="javascript:void(0);">
            <input type="text" class="chat-input" id="chat-input" maxlength="500" placeholder="Escribe un mensaje en la comunidad..." autocomplete="off" />
            <button type="submit" class="chat-send-btn" id="chat-send-btn" title="Enviar mensaje" aria-label="Enviar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      `;

      setupFormEvents();
    }

    function setupFormEvents() {
      const form = document.getElementById('chat-form');
      const input = document.getElementById('chat-input');
      const sendBtn = document.getElementById('chat-send-btn');
      const gifBtn = document.getElementById('chat-btn-gif');
      const attachedBar = document.getElementById('chat-attached-gif-bar');
      const attachedImg = document.getElementById('chat-attached-gif-img');
      const attachedDel = document.getElementById('chat-attached-gif-del');

      let attachedGifUrl = null;

      function clearAttachedGif() {
        attachedGifUrl = null;
        if (attachedBar) attachedBar.hidden = true;
        if (attachedImg) attachedImg.src = '';
      }

      if (attachedDel) {
        attachedDel.addEventListener('click', (e) => {
          e.stopPropagation();
          clearAttachedGif();
          input?.focus();
        });
      }

      initChatPicker({
        popoverEl: pickerPopover,
        triggerGifBtn: gifBtn,
        onSelectGif: (gifUrl) => {
          attachedGifUrl = gifUrl;
          if (attachedBar && attachedImg) {
            attachedImg.src = gifUrl;
            attachedBar.hidden = false;
          }
          if (input) {
            input.focus();
          }
        }
      });

      if (form && input) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text && !attachedGifUrl) return;

          const finalContent = text && attachedGifUrl
            ? `${text} ${attachedGifUrl}`
            : (text || attachedGifUrl);

          const currentGif = attachedGifUrl;
          input.value = '';
          clearAttachedGif();

          input.disabled = true;
          if (sendBtn) sendBtn.disabled = true;

          try {
            await apiRequest('/chat/messages', {
              method: 'POST',
              body: { content: finalContent }
            });
            await loadChatMessages({ force: true });
          } catch (err) {
            console.error('Error enviando mensaje:', err);
            input.value = text;
            if (currentGif) {
              attachedGifUrl = currentGif;
              if (attachedBar && attachedImg) {
                attachedImg.src = currentGif;
                attachedBar.hidden = false;
              }
            }
          } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
          }
        });
      }
    }

    function setupReactionInteractions() {
      if (!slot) return;

      function closeAllReactionBars() {
        slot.querySelectorAll('.chat-reaction-bar').forEach(bar => bar.remove());
      }

      slot.addEventListener('click', async (e) => {
        const triggerBtn = e.target.closest('[data-action="toggle-reaction-bar"]');
        if (triggerBtn) {
          e.stopPropagation();
          const msgEl = triggerBtn.closest('.chat-msg');
          if (!msgEl) return;
          const msgId = triggerBtn.dataset.msgId || msgEl.dataset.msgId;
          const existingBar = msgEl.querySelector('.chat-reaction-bar');

          if (existingBar) {
            existingBar.remove();
            return;
          }

          closeAllReactionBars();

          const bar = document.createElement('div');
          bar.className = 'chat-reaction-bar';
          bar.dataset.msgId = msgId;
          bar.innerHTML = QUICK_REACTIONS.map(emoji => `
            <button type="button" class="chat-reaction-btn" data-reaction="${emoji}" data-msg-id="${msgId}" title="Reaccionar ${emoji}">${emoji}</button>
          `).join('');

          const reactionsContainer = triggerBtn.closest('.chat-msg--reactions') || msgEl;
          reactionsContainer.appendChild(bar);
          return;
        }

        const reactBtn = e.target.closest('.chat-reaction-btn, .chat-reaction-chip');
        if (reactBtn) {
          e.stopPropagation();
          const msgId = reactBtn.dataset.msgId;
          const reaction = reactBtn.dataset.reaction;
          if (!msgId || !reaction) return;

          closeAllReactionBars();

          if (!token) {
            alert('Debes iniciar sesión para reaccionar a los mensajes.');
            window.location.href = '/pages/login.html';
            return;
          }

          try {
            const res = await apiRequest(`/chat/messages/${msgId}/reactions`, {
              method: 'POST',
              body: { reaction }
            });

            if (res?.reactions) {
              const msgEl = slot.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
              if (msgEl) {
                const currentContainer = msgEl.querySelector('.chat-msg--reactions');
                const newMarkup = renderReactionsMarkup(msgId, res.reactions);
                const temp = document.createElement('div');
                temp.innerHTML = newMarkup;
                if (currentContainer && temp.firstElementChild) {
                  currentContainer.replaceWith(temp.firstElementChild);
                }
              }
            }
          } catch (err) {
            console.warn('Error al enviar reacción:', err);
          }
          return;
        }
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-reaction-bar') && !e.target.closest('[data-action="toggle-reaction-bar"]')) {
          closeAllReactionBars();
        }
      });
    }

    renderInputRow();
    setupReactionInteractions();
    loadChatMessages({ force: true });
    loadOnlineStats();

    if (token) {
      apiRequest('/chat/heartbeat', { method: 'POST' }).catch(() => {});
      setInterval(() => {
        apiRequest('/chat/heartbeat', { method: 'POST' }).catch(() => {});
      }, 30000);

      window.addEventListener('beforeunload', () => {
        apiRequest('/chat/heartbeat', { method: 'DELETE' }).catch(() => {});
      });
    }

    // Temporizador inteligente: solo consulta cuando el chat está visible en pantalla y la pestaña activa
    let isChatVisibleOnScreen = false;

    function pollChatIfNeeded() {
      if (document.hidden || !isChatVisibleOnScreen) return;
      loadChatMessages();
      loadOnlineStats();
    }

    if ('IntersectionObserver' in window && sectionEl) {
      const chatObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isChatVisibleOnScreen = entry.isIntersecting;
          if (isChatVisibleOnScreen && !document.hidden) {
            pollChatIfNeeded();
          }
        });
      }, { rootMargin: '120px' });
      chatObserver.observe(sectionEl);
    } else {
      isChatVisibleOnScreen = true;
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isChatVisibleOnScreen) {
        pollChatIfNeeded();
      }
    });

    setInterval(pollChatIfNeeded, 10000);
  }
}
