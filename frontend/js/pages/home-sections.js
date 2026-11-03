// secciones dinámicas del home
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc, safeUrl, IMG_FALLBACK, makeWorkUrl, applyDataProgress, formatTimeAgo, resolveIconPath } from '../shared/ui-utils.js';
import { renderLaunchItem, renderRankCard, renderPopularCard } from '../components/cards.js';
import { renderHomeSkeletons, initAutoSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';
import { initChatPicker } from '../components/chat-picker.js';

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

function emptyState(icon, msg) {
  return `<div class="hs-empty">
    <img src="${resolveIconPath(icon)}" alt="" width="28" height="28" class="hs-empty--icon">
    <span>${esc(msg)}</span>
  </div>`;
}

function setContent(slot, html) {
  if (slot) slot.innerHTML = html;
}

async function loadLaunches(slot, prefetched = null) {
  try {
    const data = prefetched || await apiRequest('/home/launches/');
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderLaunchItem).join('')
      : emptyState('play', 'No hay lanzamientos recientes.'));
    const countEl = document.getElementById('launch-count');
    if (countEl) {
      const total = data.total ?? data.count ?? items.length ?? 52;
      countEl.textContent = `Mostrando ${Math.min(6, items.length)} de ${total} lanzamientos hoy`;
    }
  } catch {
    setContent(slot, emptyState('play', 'No se pudieron cargar los lanzamientos.'));
  }
}

async function loadRanking(slot, prefetched = null) {
  try {
    const data = prefetched || await apiRequest(`/home/ranking/?period=all`);
    const items = data.results ?? data ?? [];
    setContent(slot, items.length
      ? items.slice(0, 6).map(renderRankCard).join('')
      : emptyState('star', 'No hay datos de ranking disponibles.'));
  } catch {
    setContent(slot, emptyState('star', 'No se pudo cargar el ranking.'));
  }
}

async function loadPopulars(slot, filterFormat = 'all', prefetched = null) {
  try {
    const query = filterFormat && filterFormat !== 'all' ? `?format=${encodeURIComponent(filterFormat)}&limit=4` : '?limit=4';
    const data = prefetched || await apiRequest(`/home/popular/${query}`);
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

async function loadAnuncios(prefetched = null) {
  const section = document.getElementById('section-anuncios');
  const slot = document.getElementById('slot-anuncios');
  const controls = document.getElementById('anuncio-nav-controls');
  const counter = document.getElementById('anuncio-counter');
  const progressTrack = document.getElementById('anuncio-progress-track');
  const progressBar = document.getElementById('anuncio-progress-bar');

  if (!slot) return;

  try {
    const data = prefetched || await apiRequest('/announcements/');
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

    // carrusel continuo infinito

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

    // slide inicial
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
      // loop infinito
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

    // eventos touch y drag
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

      // detectar direccion
      if (!gestureDirection) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 7 && absY < 7) return; // zona muerta táctil
        if (absY >= absX) {
          // scroll vertical
          gestureDirection = 'vertical';
          isPointerDown = false;
          return;
        }
        // arrastre horizontal
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

export function initHomeSections() {
  initAutoSkeletons();
  // slots home
  const slotLaunch = document.getElementById('slot-launch');
  const slotRank = document.getElementById('slot-rank');
  const slotPopular = document.getElementById('slot-popular');
  const slotAnuncios = document.getElementById('slot-anuncios');
  const sectionChat = document.getElementById('section-chat');

  if (sectionChat) initChatSection(sectionChat);

  // misiones diarias
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
          <img src="/assets/icons/svg/gamification/star.svg" alt="" width="28" height="28" class="hs-empty--icon">
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
            <img src="/assets/icons/svg/actions/check.svg" width="11" height="11" alt="" aria-hidden="true">
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

    // reclamar mision
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

        // animacion xp
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

        // emitir evento xp
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

    // sincronizar misiones
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

  // cargar feed home
  apiRequest('/home/feed/').then(feed => {
    if (slotLaunch) loadLaunches(slotLaunch, feed.launches);
    if (slotRank) loadRanking(slotRank, feed.ranking);
    if (slotPopular) loadPopulars(slotPopular, 'all', feed.popular);
    if (slotAnuncios) loadAnuncios(feed.announcements);

    const xpEl = document.getElementById('mision-xp');
    const levelBadge = document.getElementById('mision-level-badge');
    const body = document.getElementById('slot-mision');
    if (body && feed.missions) {
      renderMissionsWidget(feed.missions, body, xpEl, levelBadge);
    }
  }).catch(() => {
    // fallback red
    if (slotLaunch) loadLaunches(slotLaunch);
    if (slotRank) loadRanking(slotRank);
    if (slotPopular) loadPopulars(slotPopular);
    if (slotAnuncios) loadAnuncios();
  });

  const rankingTabs = document.getElementById('ranking-tabs');
  if (rankingTabs) {
    rankingTabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset.period) return;

      rankingTabs.querySelectorAll('button').forEach(t => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      const slot = document.getElementById('slot-rank');
      if (slot) slot.innerHTML = renderHomeSkeletons('rank', 6, 3);
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
        slot.innerHTML = renderHomeSkeletons('popular', 4, 4);
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

  // chat en vivo

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

    function formatChatContent(rawContent) {
      const trimmed = (rawContent || '').trim();
      if (!trimmed) return '';

      // detectar gif
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

    const QUICK_REACTIONS = ['❤️', '👍', '👎', '😂', '🔥', '😮', '😢', '😭', '😡', '🎉', '💀', '👏'];
    const REACTION_TITLES = {
      '❤️': 'Amor',
      '👍': 'Bien / Me gusta',
      '👎': 'Mal / No me gusta',
      '😂': 'Risa',
      '🔥': 'Fuego / Hype',
      '😮': 'Sorpresa',
      '😢': 'Tristeza',
      '😭': 'Llorando',
      '😡': 'Enojado',
      '🎉': 'Celebración',
      '💀': 'Muerto de risa',
      '👏': 'Aplauso'
    };

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
      const timeStr = msg.created_at ? formatTimeAgo(msg.created_at) : '';

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
          // actualizar reacciones
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
            <button type="button" class="chat-reaction-btn" data-reaction="${emoji}" data-msg-id="${msgId}" title="${REACTION_TITLES[emoji] || 'Reaccionar ' + emoji}" aria-label="${REACTION_TITLES[emoji] || emoji}">${emoji}</button>
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
            showToast('Debes iniciar sesión para reaccionar a los mensajes.', 'info');
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

    // polling chat
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

export const renderHomeSections = initHomeSections;
