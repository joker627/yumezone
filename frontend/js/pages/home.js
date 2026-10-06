// Página de inicio: hero destacado y componentes compartidos.
import { API_BASE_URL } from '../api/api-config.js';
import { loadComponents } from '../shared/component-loader.js';
import { safeUrl } from '../shared/url-utils.js';
import { apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { renderNotice } from '../components/notice.js';

// Configuración.
const DEFAULT_CONFIG = {
    apiUrl: `${API_BASE_URL}/v1/hero/`,
    autoRotateMs: 7000,
    transitionMs: 500,
};

// Crea un slide a partir de la plantilla HTML estática.
function createSlide(work, index, template) {
    const badge = work.hero_badge || {};
    const badgeColor = ['red', 'blue', 'green'].includes(badge.color) ? badge.color : 'red';
    const scan = work.scan_group || {};
    const stats = work.stats || {};
    const latest = work.latest_chapter || {};
    const next = work.next_chapter || {};
    const actions = work.actions || {};
    const title = String(work.title || '').trim();
    const titleWords = title.split(/\s+/);
    const titleSplit = Math.max(1, Math.ceil(titleWords.length / 2));
    const fragment = template.content.cloneNode(true);
    const slide = fragment.querySelector('.hero-slide');
    const setText = (selector, value) => {
        const element = fragment.querySelector(selector);
        if (element) element.textContent = value ?? '';
    };

    slide.classList.add(`hero-slide-${badgeColor}`);
    slide.dataset.index = String(index);
    slide.dataset.slug = String(work.slug ?? '');
    slide.setAttribute('aria-hidden', String(index !== 0));

    const background = fragment.querySelector('[data-home-hero-bg-image]');
    background.src = safeUrl(work.banner_url, '');
    background.loading = index === 0 ? 'eager' : 'lazy';
    background.fetchPriority = index === 0 ? 'high' : 'low';
    fragment.querySelector('[data-home-hero-badge-icon]').src =
        `assets/icons/svg/${badgeIconName(badge.icon)}.svg`;
    fragment.querySelector('[data-home-hero-scan]').hidden = !scan.name;
    if (scan.name) {
        fragment.querySelector('[data-home-hero-scan-logo]').src = safeUrl(scan.logo_url, '');
    }

    setText('[data-home-hero-badge-text]', badge.text);
    setText('[data-home-hero-rating]', stats.rating_average ?? '—');
    setText('[data-home-hero-rating-count]', stats.rating_count_formatted ?? '0');
    setText('[data-home-hero-scan-name]', scan.name);
    setText('[data-home-hero-alternative-title]', work.alternative_title || 'LANZAMIENTO DESTACADO');
    setText('[data-home-hero-title-top]', titleWords.slice(0, titleSplit).join(' '));
    setText('[data-home-hero-title-accent]', titleWords.slice(titleSplit).join(' '));
    fragment.querySelector('[data-home-hero-title-break]').hidden = !titleWords.slice(titleSplit).length;
    setText('[data-home-hero-synopsis]', work.synopsis);
    setText('[data-home-hero-published-text]', latest.published_text || 'Sin capítulos publicados');

    const genres = fragment.querySelector('[data-home-hero-genres]');
    genres.hidden = !(work.genres || []).length;
    (work.genres || []).slice(0, 4).forEach((genre) => {
        const element = document.createElement('span');
        element.className = 'hero-genre';
        element.textContent = genre.name ?? '';
        genres.insertBefore(element, genres.firstElementChild);
    });

    const readLink = fragment.querySelector('[data-home-hero-read-link]');
    const readUrl = safeUrl(actions.read_first?.url, '');
    readLink.hidden = !readUrl;
    if (readUrl) readLink.href = readUrl;
    setText('[data-home-hero-read-text]', 'Leer');
    const detailLink = fragment.querySelector('[data-home-hero-detail-link]');
    detailLink.href = `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
    detailLink.setAttribute('aria-label', `Ver detalles de ${title || 'la obra'}`);
    const libraryButton = fragment.querySelector('[data-home-hero-library-btn]');
    const isInLibrary = Boolean(actions.library?.is_added);
    libraryButton.dataset.workId = String(work.id);
    libraryButton.setAttribute('aria-pressed', String(isInLibrary));
    setText(
        '[data-home-hero-library-text]',
        isInLibrary ? 'Quitar de Biblioteca' : 'Añadir a Biblioteca',
    );
    fragment.querySelectorAll('[data-home-hero-subscribe-btn]').forEach((button) => {
        button.dataset.workId = String(work.id);
        button.setAttribute('aria-pressed', String(Boolean(actions.subscribe?.is_subscribed)));
    });
    setText('[data-home-hero-next-status]', next.status_label || 'PRÓXIMAMENTE');
    setText(
        '[data-home-hero-next-title]',
        next.number != null
            ? `Capítulo ${next.number}: ${next.title || ''}`
            : 'No hay capítulo programado',
    );
    setText('[data-home-hero-next-release]', next.release_text || 'Sin fecha de lanzamiento');
    setText('[data-home-hero-next-scan]', latest.scan_group_name || scan.name || 'Scan no disponible');

    return fragment;
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
    async mount(container, props) {
        const config = { ...DEFAULT_CONFIG, ...props };

        const stage = container.querySelector('[data-home-hero-stage]');
        const skeleton = container.querySelector('[data-home-hero-skeleton]');
        const errorEl = container.querySelector('[data-home-hero-error]');
        const footer = container.querySelector('[data-home-hero-footer]');
        const dotsEl = container.querySelector('[data-home-hero-dots]');
        const retryBtn = container.querySelector('[data-home-hero-retry]');
        const slideTemplate = document.querySelector('#hero-slide-template');

        let slides = [];
        let currentIndex = 0;
        let autoTimer = null;

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

                renderSlides(works);
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
        function renderSlides(works) {
            stage.replaceChildren();
            works.forEach((work, index) => {
                stage.append(createSlide(work, index, slideTemplate));
            });

            slides = Array.from(stage.querySelectorAll('.hero-slide'));
            dotsEl.replaceChildren();
            works.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'hero-dot';
                dot.dataset.dotIndex = String(index);
                dot.setAttribute('aria-label', `Mostrar obra ${index + 1}`);
                dot.setAttribute('aria-current', String(index === 0));
                dotsEl.append(dot);
            });
        }

        // Navegación.
        function goTo(index, animate = true, direction = 0) {
            if (!slides.length) return;
            const total = slides.length;
            currentIndex = ((index % total) + total) % total;

            stage.classList.remove('is-transitioning-next', 'is-transitioning-prev');
            slides.forEach((slide, i) => {
                slide.classList.toggle('is-active', i === currentIndex);
                slide.setAttribute('aria-hidden', i === currentIndex ? 'false' : 'true');
            });

            dotsEl.querySelectorAll('.hero-dot').forEach((dot, i) => {
                const isActive = i === currentIndex;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-current', String(isActive));
            });

            if (animate) {
                if (direction) {
                    stage.offsetWidth;
                    stage.classList.add(direction > 0 ? 'is-transitioning-next' : 'is-transitioning-prev');
                    setTimeout(() => {
                        stage.classList.remove('is-transitioning-next', 'is-transitioning-prev');
                    }, config.transitionMs);
                }
            }
        }

        function next() { goTo(currentIndex + 1, true, 1); }
        function prev() { goTo(currentIndex - 1, true, -1); }

        // Autorotación.
        function startAuto() {
            stopAuto();
            if (!config.autoRotateMs) return;

            autoTimer = setInterval(() => {
                next();
            }, config.autoRotateMs);
        }

        function stopAuto() {
            if (autoTimer) clearInterval(autoTimer);
            autoTimer = null;
        }

        // Eventos.
        function onRetry() { load(); }

        function onDotClick(e) {
            const dot = e.target.closest('[data-dot-index]');
            if (dot) {
                const targetIndex = Number(dot.dataset.dotIndex);
                goTo(targetIndex, true, targetIndex >= currentIndex ? 1 : -1);
            }
        }

        function onKey(e) {
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        }

        // Navegación por arrastre con mouse o táctil.
        let pointerStartX = 0;
        let isPointerDown = false;
        let didDrag = false;
        let suppressClickAfterSwipe = false;
        let pointerCaptureTarget = null;

        function onPointerDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pointerStartX = e.clientX;
            isPointerDown = true;
            didDrag = false;
            suppressClickAfterSwipe = false;
            stopAuto();
            pointerCaptureTarget = e.target instanceof Element ? e.target : stage;
            pointerCaptureTarget.setPointerCapture?.(e.pointerId);
        }

        function onPointerMove(e) {
            if (!isPointerDown) return;
            const dx = e.clientX - pointerStartX;
            didDrag = Math.abs(dx) >= 10;
            if (didDrag) {
                e.preventDefault();
                const targetIndex = dx < 0
                    ? (currentIndex + 1) % slides.length
                    : (currentIndex - 1 + slides.length) % slides.length;
                slides.forEach((slide, i) => {
                    slide.classList.toggle('is-drag-target', i === targetIndex);
                });
                stage.classList.toggle('is-drag-next', dx < 0);
                stage.classList.toggle('is-drag-prev', dx > 0);
                stage.classList.add('is-dragging');
                const maxOffset = stage.clientWidth || window.innerWidth;
                const offset = Math.max(-maxOffset, Math.min(maxOffset, dx));
                stage.style.setProperty('--hero-drag-offset', `${offset}px`);
            }
        }

        function onPointerUp(e) {
            if (!isPointerDown) return;
            const dx = e.clientX - pointerStartX;
            isPointerDown = false;
            pointerCaptureTarget?.releasePointerCapture?.(e.pointerId);
            pointerCaptureTarget = null;
            stage.classList.remove('is-dragging');
            stage.classList.remove('is-drag-next', 'is-drag-prev');
            slides.forEach((slide) => slide.classList.remove('is-drag-target'));
            stage.style.removeProperty('--hero-drag-offset');
            if (Math.abs(dx) >= 50) {
                suppressClickAfterSwipe = true;
                window.setTimeout(() => {
                    suppressClickAfterSwipe = false;
                }, 0);
                dx > 0 ? prev() : next();
            }
            didDrag = false;
            startAuto();
        }

        function onPointerCancel(e) {
            isPointerDown = false;
            didDrag = false;
            pointerCaptureTarget?.releasePointerCapture?.(e.pointerId);
            pointerCaptureTarget = null;
            stage.classList.remove('is-dragging');
            stage.classList.remove('is-drag-next', 'is-drag-prev');
            slides.forEach((slide) => slide.classList.remove('is-drag-target'));
            stage.style.removeProperty('--hero-drag-offset');
            startAuto();
        }

        async function onLibraryActionClick(e) {
            const button = e.target.closest('[data-home-hero-library-btn]');
            if (!button || suppressClickAfterSwipe || button.disabled) return;
            e.preventDefault();
            const workId = button.dataset.workId;
            if (!workId) return;

            if (!getAccessToken()) {
                const next = `/pages/biblioteca.html?add=${encodeURIComponent(workId)}`;
                window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
                return;
            }

            const isAdded = button.getAttribute('aria-pressed') === 'true';
            const text = button.querySelector('[data-home-hero-library-text]');
            const originalText = text?.textContent || '';
            button.disabled = true;
            if (text) text.textContent = 'Guardando…';

            try {
                if (isAdded) {
                    await apiRequest(`/library/${workId}`, { method: 'DELETE' });
                } else {
                    await apiRequest(`/library/${workId}`, {
                        method: 'POST',
                        body: { status: 'FOLLOWING' },
                    });
                }

                const added = !isAdded;
                button.setAttribute('aria-pressed', String(added));
                if (text) {
                    text.textContent = added ? 'Quitar de Biblioteca' : 'Añadir a Biblioteca';
                }
            } catch (error) {
                if (error.status === 401 || error.status === 400) {
                    clearAccessToken();
                    const next = `/pages/biblioteca.html?add=${encodeURIComponent(workId)}`;
                    window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
                    return;
                }
                if (text) text.textContent = 'Intenta de nuevo';
                button.title = error.message || 'No se pudo actualizar la biblioteca.';
                window.setTimeout(() => {
                    if (text) text.textContent = originalText;
                    button.removeAttribute('title');
                }, 2400);
            } finally {
                button.disabled = false;
            }
        }

        function onStageClick(e) {
            if (!suppressClickAfterSwipe) return;
            e.preventDefault();
        }

        // Eventos del componente.
        retryBtn?.addEventListener('click', onRetry);
        container.addEventListener('keydown', onKey);
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerCancel);
        stage.addEventListener('click', onStageClick);
        stage.addEventListener('click', onLibraryActionClick);
        dotsEl.addEventListener('click', onDotClick);

        // Inicialización.
        await load();

        // Limpieza.
        return {
            destroy() {
                stopAuto();
                retryBtn?.removeEventListener('click', onRetry);
                container.removeEventListener('keydown', onKey);
                stage.removeEventListener('pointerdown', onPointerDown);
                stage.removeEventListener('pointermove', onPointerMove);
                stage.removeEventListener('pointerup', onPointerUp);
                stage.removeEventListener('pointercancel', onPointerCancel);
                stage.removeEventListener('click', onStageClick);
                stage.removeEventListener('click', onLibraryActionClick);
                dotsEl.removeEventListener('click', onDotClick);
            },
        };
    },
};

// API pública.
export function renderSiteHero(container, options = {}) {
    container.removeAttribute('aria-busy');
    return HeroComponent.mount(container, options);
}

export { HeroComponent };

loadComponents([
    { id: 'header', render: renderSiteHeader },
    { id: 'notice', render: renderNotice, optional: true },
    { id: 'hero', render: renderSiteHero },
]);
