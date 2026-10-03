// Hero: componente que presentará la obra destacada y sus acciones.
import { API_BASE_URL } from '../api/api-config.js';
import { mountComponent } from '../shared/component-loader.js';

// Configuración.
const DEFAULT_CONFIG = {
    apiUrl: `${API_BASE_URL}/v1/hero/`,
    autoRotateMs: 7000,
    transitionMs: 500,
    pauseOnHover: true,
};

// HTML del Hero.
function renderTemplate() {
    return `
    <section class="hero" aria-label="Obras destacadas">
      <div class="hero-stage" data-stage>
        <!-- Slides se insertan aquí dinámicamente -->
      </div>

      <div class="hero-skeleton" data-skeleton aria-hidden="true">
        <div class="hero-skeleton-bg"></div>
        <div class="hero-skeleton-content">
          <div class="hero-skeleton-line hero-skeleton-line-sm"></div>
          <div class="hero-skeleton-line hero-skeleton-line-lg"></div>
          <div class="hero-skeleton-line hero-skeleton-line-md"></div>
          <div class="hero-skeleton-line hero-skeleton-line-sm"></div>
        </div>
      </div>

      <div class="hero-error" data-error hidden>
        <p>No se pudieron cargar las obras destacadas.</p>
        <button type="button" class="hero-retry" data-retry>Reintentar</button>
      </div>

      <!-- Controles inferiores -->
      <div class="hero-footer" data-footer hidden>
        <div class="hero-pagination">
          <button type="button" class="hero-nav" data-prev aria-label="Anterior">
            <img class="hero-icon" width="16" height="16" src="assets/icons/svg/arrow-left.svg" alt="" aria-hidden="true">
          </button>

          <div class="hero-counter">
            <span data-current>01</span>
            <span class="hero-counter-divider">/</span>
            <span data-total>01</span>
          </div>

          <button type="button" class="hero-nav" data-next aria-label="Siguiente">
            <img class="hero-icon" width="16" height="16" src="assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true">
          </button>
        </div>

        <div class="hero-progress" data-progress>
          <div class="hero-progress-bar" data-progress-bar></div>
        </div>
      </div>
    </section>
  `;
}

// HTML de cada slide.
function slideTemplate(work, index, total) {
    const badge = work.hero_badge || {};
    const badgeColor = badge.color || 'red';
    const scan = work.scan_group || {};
    const stats = work.stats || {};
    const latest = work.latest_chapter || {};
    const next = work.next_chapter || {};
    const actions = work.actions || {};

    const genresHtml = (work.genres || [])
        .slice(0, 4)
        .map((g) => `<span class="hero-genre">${g.name}</span>`)
        .join('');

    const titleWords = String(work.title || '').trim().split(/\s+/);
    const titleSplit = Math.max(1, Math.ceil(titleWords.length / 2));
    const titleTop = titleWords.slice(0, titleSplit).join(' ');
    const titleAccent = titleWords.slice(titleSplit).join(' ');

    return `
    <article
      class="hero-slide hero-slide-${badgeColor}"
      data-index="${index}"
      aria-hidden="${index === 0 ? 'false' : 'true'}"
      data-slug="${work.slug}"
    >
      <!-- Fondo -->
      <div class="hero-bg">
        <img
          class="hero-bg-image"
          src="${work.banner_url}"
          alt=""
          loading="${index === 0 ? 'eager' : 'lazy'}"
          data-bg-img
        >
        <div class="hero-bg-gradient"></div>
      </div>

      <!-- Contenido -->
      <div class="hero-content">
        <div class="hero-main">
          <!-- Badges superiores -->
          <div class="hero-badges">
            <span class="hero-badge hero-badge-${badgeColor}">
              <img class="hero-icon" width="12" height="12" src="assets/icons/svg/${badgeIconName(badge.icon)}.svg" alt="" aria-hidden="true">
              <span>${badge.text || ''}</span>
            </span>

            <span class="hero-rating" title="Puntuación">
              <img class="hero-icon" width="12" height="12" src="assets/icons/svg/star.svg" alt="" aria-hidden="true">
              <span>${stats.rating_average ?? '—'}</span>
              <span class="hero-rating-count">(${stats.rating_count_formatted ?? '0'})</span>
            </span>

            ${scan.name ? `
              <span class="hero-scan">
                <img src="${scan.logo_url}" alt="" class="hero-scan-logo" loading="lazy">
                <span>${scan.name}</span>
              </span>
            ` : ''}
          </div>

          <div class="hero-eyebrow">
            <img class="hero-icon" width="14" height="14" src="assets/icons/svg/info.svg" alt="" aria-hidden="true">
            <span>${work.alternative_title || 'LANZAMIENTO DESTACADO'}</span>
          </div>

          <!-- Título -->
          <h1 class="hero-title">
            ${titleTop}${titleAccent ? `<br><span>${titleAccent}</span>` : ''}
          </h1>

          <!-- Sinopsis -->
          <p class="hero-synopsis">${work.synopsis}</p>

          <!-- Géneros -->
          ${genresHtml ? `
            <div class="hero-genres">
              ${genresHtml}
              <span class="hero-update">
                <img class="hero-icon" width="14" height="14" src="assets/icons/svg/history.svg" alt="" aria-hidden="true">
                ${latest.published_text || 'Sin capítulos publicados'}
              </span>
            </div>
          ` : ''}

          <!-- Acciones -->
          <div class="hero-actions">
            <a href="${actions.read_first?.url || '#'}" class="hero-cta hero-cta-primary">
              <img class="hero-icon" width="18" height="18" src="assets/icons/svg/play.svg" alt="" aria-hidden="true">
              <span>${actions.read_first?.text || 'Empezar a leer'}</span>
            </a>

            <button
              type="button"
              class="hero-cta hero-cta-secondary"
              data-library-btn
              data-work-id="${work.id}"
              aria-pressed="${actions.library?.is_added ? 'true' : 'false'}"
            >
              <img class="hero-icon" width="16" height="16" src="assets/icons/svg/heart.svg" alt="" aria-hidden="true">
              <span>${actions.library?.text || 'Añadir a Biblioteca'}</span>
              <span class="hero-cta-count">${actions.library?.count_formatted || '0'}</span>
            </button>

            <button
              type="button"
              class="hero-icon-btn"
              data-subscribe-btn
              data-work-id="${work.id}"
              aria-pressed="${actions.subscribe?.is_subscribed ? 'true' : 'false'}"
              aria-label="Recordar próximo capítulo"
              title="Recordar próximo capítulo"
            >
              <img class="hero-icon" width="18" height="18" src="assets/icons/svg/bell.svg" alt="" aria-hidden="true">
            </button>
          </div>
        </div>

        <!-- Tarjeta lateral: próximo capítulo -->
        <aside class="hero-next" aria-label="Próximo capítulo">
          <header class="hero-next-header">
              <img class="hero-icon" width="14" height="14" src="assets/icons/svg/history.svg" alt="" aria-hidden="true">
              <span>Próximo Capítulo</span>
              <span class="hero-next-status">${next.status_label || 'PRÓXIMAMENTE'}</span>
          </header>

          <h3 class="hero-next-title">
              ${next.number != null
                ? `Capítulo ${next.number}: ${next.title || ''}`
                : 'No hay capítulo programado'}
          </h3>

          <p class="hero-next-meta">
              ${next.release_text || 'Sin fecha de lanzamiento'}
          </p>

          <footer class="hero-next-footer">
              <span class="hero-next-scan">
                Subido por ${latest.scan_group_name || scan.name || 'Scan no disponible'}
              </span>
              <button type="button" class="hero-next-cta" data-subscribe-btn data-work-id="${work.id}">
                <img class="hero-icon" width="14" height="14" src="assets/icons/svg/bell.svg" alt="" aria-hidden="true">
                <span>Recordar</span>
              </button>
          </footer>
        </aside>
      </div>
    </article>
  `;
}

function badgeIconName(icon) {
    switch (icon) {
        case 'flame':
            return 'fire';
        case 'star':
            return 'star';
        case 'sparkles':
            return 'sparkles';
        default:
            return 'info';
    }
}

// Componente.
const HeroComponent = {
    render() {
        return renderTemplate();
    },

    async mount(container, props) {
        const config = { ...DEFAULT_CONFIG, ...props };

        const stage = container.querySelector('[data-stage]');
        const skeleton = container.querySelector('[data-skeleton]');
        const errorEl = container.querySelector('[data-error]');
        const footer = container.querySelector('[data-footer]');
        const currentEl = container.querySelector('[data-current]');
        const totalEl = container.querySelector('[data-total]');
        const prevBtn = container.querySelector('[data-prev]');
        const nextBtn = container.querySelector('[data-next]');
        const progressBar = container.querySelector('[data-progress-bar]');
        const retryBtn = container.querySelector('[data-retry]');

        let slides = [];
        let currentIndex = 0;
        let autoTimer = null;
        let progressTimer = null;
        let isPaused = false;

        // Carga de datos.
        async function load() {
            try {
                skeleton.hidden = false;
                errorEl.hidden = true;
                footer.hidden = true;

                const res = await fetch(config.apiUrl, {
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();

                // Conservamos el orden de grupos enviado por el backend.
                const works = [
                    ...(data.top || []),
                    ...(data.popular || []),
                    ...(data.new || []),
                ];

                if (!works.length) throw new Error('Sin obras destacadas');

                const totalItems = works[0]?.carousel_info?.total_items || works.length;
                renderSlides(works, totalItems);
                skeleton.hidden = true;
                footer.hidden = false;
                goTo(0, false);
                startAuto();
            } catch (err) {
                console.error('[hero] Error cargando datos:', err);
                skeleton.hidden = true;
                errorEl.hidden = false;
            }
        }

        // Render de slides.
        function renderSlides(works, totalItems) {
            stage.innerHTML = works
                .map((w, i) => slideTemplate(w, i, works.length))
                .join('');

            slides = Array.from(stage.querySelectorAll('.hero-slide'));

            totalEl.textContent = String(totalItems).padStart(2, '0');
        }

        // Navegación.
        function goTo(index, animate = true) {
            if (!slides.length) return;
            const total = slides.length;
            currentIndex = ((index % total) + total) % total;

            slides.forEach((slide, i) => {
                slide.classList.toggle('is-active', i === currentIndex);
                slide.setAttribute('aria-hidden', i === currentIndex ? 'false' : 'true');
            });

            currentEl.textContent = String(currentIndex + 1).padStart(2, '0');
            restartProgress();

            if (animate) {
                stage.classList.add('is-transitioning');
                setTimeout(() => stage.classList.remove('is-transitioning'), config.transitionMs);
            }
        }

        function next() { goTo(currentIndex + 1); }
        function prev() { goTo(currentIndex - 1); }

        // Autorotación.
        function startAuto() {
            stopAuto();
            if (!config.autoRotateMs) return;

            autoTimer = setInterval(() => {
                if (!isPaused) next();
            }, config.autoRotateMs);
        }

        function stopAuto() {
            if (autoTimer) clearInterval(autoTimer);
            autoTimer = null;
            if (progressTimer) cancelAnimationFrame(progressTimer);
            progressTimer = null;
        }

        function restartProgress() {
            if (!progressBar) return;
            if (progressTimer) cancelAnimationFrame(progressTimer);

            const duration = config.autoRotateMs;
            const start = performance.now();

            function tick(now) {
                const elapsed = now - start;
                const pct = Math.min((elapsed / duration) * 100, 100);
                progressBar.style.width = pct + '%';
                if (pct < 100 && !isPaused && autoTimer) {
                    progressTimer = requestAnimationFrame(tick);
                }
            }
            progressTimer = requestAnimationFrame(tick);
        }

        // Eventos.
        function onPrev() { prev(); }
        function onNext() { next(); }
        function onRetry() { load(); }

        function onKey(e) {
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        }

        function onMouseEnter() { if (config.pauseOnHover) isPaused = true; }
        function onMouseLeave() { if (config.pauseOnHover) { isPaused = false; restartProgress(); } }

        // Swipe táctil
        let touchStartX = 0;
        function onTouchStart(e) { touchStartX = e.touches[0].clientX; }
        function onTouchEnd(e) {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) < 50) return;
            dx > 0 ? prev() : next();
        }

        // Delegación para botones internos (biblioteca / suscribir)
        function onStageClick(e) {
            const libBtn = e.target.closest('[data-library-btn]');
            if (libBtn) {
                const isPressed = libBtn.getAttribute('aria-pressed') === 'true';
                libBtn.setAttribute('aria-pressed', String(!isPressed));
                // TODO: llamar API POST /user/library
                return;
            }

            const subBtn = e.target.closest('[data-subscribe-btn]');
            if (subBtn) {
                const isPressed = subBtn.getAttribute('aria-pressed') === 'true';
                subBtn.setAttribute('aria-pressed', String(!isPressed));
                // TODO: llamar API POST /user/novels/:id/subscribe
                return;
            }
        }

        // Eventos del componente.
        prevBtn?.addEventListener('click', onPrev);
        nextBtn?.addEventListener('click', onNext);
        retryBtn?.addEventListener('click', onRetry);
        container.addEventListener('keydown', onKey);
        container.addEventListener('mouseenter', onMouseEnter);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
        stage.addEventListener('click', onStageClick);

        // Inicialización.
        await load();

        // Limpieza.
        return {
            destroy() {
                stopAuto();
                prevBtn?.removeEventListener('click', onPrev);
                nextBtn?.removeEventListener('click', onNext);
                retryBtn?.removeEventListener('click', onRetry);
                container.removeEventListener('keydown', onKey);
                container.removeEventListener('mouseenter', onMouseEnter);
                container.removeEventListener('mouseleave', onMouseLeave);
                container.removeEventListener('touchstart', onTouchStart);
                container.removeEventListener('touchend', onTouchEnd);
                stage.removeEventListener('click', onStageClick);
            },
        };
    },
};

// API pública.
export function renderSiteHero(container, options = {}) {
    container.removeAttribute('aria-busy');
    return mountComponent(container, HeroComponent, options);
}

export { HeroComponent };