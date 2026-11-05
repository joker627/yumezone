// secciones dinámicas del home
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc, safeUrl, IMG_FALLBACK, makeWorkUrl, applyDataProgress, formatTimeAgo, resolveIconPath } from '../shared/ui-utils.js';
import { renderLaunchItem, renderRankCard, renderPopularCard } from '../components/cards.js';
import { renderHomeSkeletons, initAutoSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';

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

}

export const renderHomeSections = initHomeSections;
