import { API_BASE_URL } from '../api/api-config.js';
import { safeUrl, IMG_FALLBACK } from '../shared/ui-utils.js';
import { apiRequest, getAccessToken, clearAccessToken } from '../shared/auth.js';
import { showToast } from '../shared/toast.js';
import { initHomeSections } from './home-sections.js';
import { renderHeroSkeleton } from '../components/skeletons.js';
import { openWorkRatingModal } from '../components/rating-modal.js';

const DEFAULT_CONFIG = {
    apiUrl: `${API_BASE_URL}/v1/hero/`,
    autoRotateMs: 7000,
    transitionMs: 320,
};

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
    slide.dataset.workId = String(work.id);
    slide.setAttribute('aria-hidden', String(index !== 0));

    const background = fragment.querySelector('[data-home-hero-bg-image]');
    background.src = safeUrl(work.banner_url || work.cover_url, IMG_FALLBACK);
    background.loading = index === 0 ? 'eager' : 'lazy';
    background.fetchPriority = index === 0 ? 'high' : 'low';
    fragment.querySelector('[data-home-hero-badge-icon]').src =
        `assets/icons/svg/${badgeIconName(badge.icon)}.svg`;
    fragment.querySelector('[data-home-hero-scan]').hidden = !scan.name;
    if (scan.name) {
        fragment.querySelector('[data-home-hero-scan-logo]').src = safeUrl(scan.logo_url, IMG_FALLBACK);
    }

    setText('[data-home-hero-badge-text]', badge.text);
    setText('[data-home-hero-rating]', stats.rating_average ? Number(stats.rating_average).toFixed(1) : '—');
    setText('[data-home-hero-rating-count]', stats.rating_count_formatted ?? '0');
    const ratingBadge = fragment.querySelector('[data-home-hero-rating-badge]');
    if (ratingBadge) {
        ratingBadge.dataset.workId = String(work.id);
        ratingBadge.dataset.workTitle = title;
        ratingBadge.dataset.currentRating = String(stats.rating_average || 9.5);
        if (work.user_rating != null) {
            ratingBadge.classList.add('has-user-rating');
            ratingBadge.title = `Tu calificación: ${Number(work.user_rating).toFixed(1)} ★ (clic para editar)`;
        }
    }
    setText('[data-home-hero-scan-name]', scan.name);
    setText('[data-home-hero-alternative-title]', work.alternative_title || 'LANZAMIENTO DESTACADO');

    const topPart = titleWords.slice(0, titleSplit).join(' ');
    const accentPart = titleWords.slice(titleSplit).join(' ');
    setText('[data-home-hero-title-top]', accentPart ? `${topPart} ` : topPart);
    setText('[data-home-hero-title-accent]', accentPart);
    setText('[data-home-hero-synopsis]', work.synopsis);

    setText(
        '[data-home-hero-published-text]',
        latest.published_text || (latest.number != null ? `Cap. ${latest.number} disponible` : 'Capítulos disponibles')
    );

    const genres = fragment.querySelector('[data-home-hero-genres]');
    genres.hidden = !(work.genres || []).length;
    (work.genres || []).slice(0, 4).forEach((genre) => {
        const element = document.createElement('span');
        element.className = 'hero-genre';
        element.textContent = genre.name ?? '';
        genres.insertBefore(element, genres.firstElementChild);
    });

    // acción leer
    const readLink = fragment.querySelector('[data-home-hero-read-link]');
    const readUrl = safeUrl(actions.read_first?.url, `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`);
    readLink.href = readUrl;
    setText('[data-home-hero-read-text]', 'Leer');

    // acción detalles
    const detailLink = fragment.querySelector('[data-home-hero-detail-link]');
    detailLink.href = `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
    detailLink.setAttribute('aria-label', `Ver detalles de ${title || 'la obra'}`);

    // próximo capítulo
    const hasScheduled = next && next.number != null;

    setText(
        '[data-home-hero-next-label]',
        hasScheduled ? 'Próximo Capítulo' : 'Último Capítulo'
    );
    setText(
        '[data-home-hero-next-status]',
        hasScheduled ? (next.status_label || 'PRÓXIMAMENTE') : 'AL DÍA'
    );
    setText(
        '[data-home-hero-next-title]',
        hasScheduled
            ? `Capítulo ${next.number}${next.title ? ': ' + next.title : ''}`
            : (latest.number != null ? `Capítulo ${latest.number}${latest.title ? ': ' + latest.title : ''}` : 'Capítulos disponibles')
    );
    setText(
        '[data-home-hero-next-release]',
        hasScheduled
            ? (next.release_text || 'Próximamente • En traducción')
            : 'Agrega la obra a tu biblioteca para recibir avisos'
    );
    setText(
        '[data-home-hero-next-scan]',
        (hasScheduled ? next.scan_group_name : null) || latest.scan_group_name || scan.name || 'YumeZone'
    );

    const nextLink = fragment.querySelector('[data-home-hero-next-link]');
    if (nextLink) {
        nextLink.href = detailLink.href;
    }

    return fragment;
}

function badgeIconName(icon) {
    switch (icon) {
        case 'flame':
            return 'gamification/fire';
        case 'star':
            return 'gamification/star';
        case 'sparkles':
            return 'gamification/bolt';
        default:
            return 'content/info';
    }
}

const HeroComponent = {
    async mount(container, props) {
        const config = { ...DEFAULT_CONFIG, ...props };

        const stage = container.querySelector('[data-home-hero-stage]');
        const skeleton = container.querySelector('[data-home-hero-skeleton]');
        const errorEl = container.querySelector('[data-home-hero-error]');
        const footer = container.querySelector('[data-home-hero-footer]');
        const dotsEl = container.querySelector('[data-home-hero-dots]');
        const retryBtn = container.querySelector('[data-home-hero-retry]');
        const slideTemplate = document.getElementById('hero-slide-template');

        let slides = [];
        let currentWorks = [];
        let currentIndex = 0;
        let autoTimer = null;
        const userRatingCache = new Map();

        async function checkSlideRating(workId) {
            const wid = Number(workId);
            if (!getAccessToken() || !wid || userRatingCache.has(wid)) return;
            userRatingCache.set(wid, null);
            try {
                const data = await apiRequest(`/library/${wid}/rating`);
                if (data && data.user_rating != null) {
                    userRatingCache.set(wid, Number(data.user_rating));
                    const badge = stage.querySelector(`[data-home-hero-rating-badge][data-work-id="${wid}"]`);
                    if (badge) {
                        badge.classList.add('has-user-rating');
                        badge.title = `Tu calificación: ${Number(data.user_rating).toFixed(1)} ★ (clic para editar)`;
                    }
                }
            } catch {}
        }

        async function load() {
            try {
                if (skeleton && !skeleton.children.length) skeleton.innerHTML = renderHeroSkeleton();
                skeleton.hidden = false;
                errorEl.hidden = true;
                footer.hidden = true;

                let data;
                try {
                    data = await apiRequest('/hero/');
                } catch {
                    const res = await fetch(config.apiUrl, {
                        headers: { Accept: 'application/json' },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    data = await res.json();
                }

                const seen = new Set();
                const works = [];
                for (const item of [...(data.top || []), ...(data.popular || []), ...(data.new || [])]) {
                    if (item && item.id && !seen.has(item.id)) {
                        seen.add(item.id);
                        works.push(item);
                    }
                }

                if (!works.length) throw new Error('Sin obras destacadas');

                currentWorks = works;
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

            const activeWork = currentWorks[currentIndex];
            if (activeWork && activeWork.id) {
                checkSlideRating(activeWork.id);
            }

            if (animate && direction) {
                stage.offsetWidth;
                stage.classList.add(direction > 0 ? 'is-transitioning-next' : 'is-transitioning-prev');
                setTimeout(() => {
                    stage.classList.remove('is-transitioning-next', 'is-transitioning-prev');
                }, config.transitionMs);
            }
        }

        function next() { goTo(currentIndex + 1, true, 1); }
        function prev() { goTo(currentIndex - 1, true, -1); }

        function startAuto() {
            stopAuto();
            if (!config.autoRotateMs) return;
            autoTimer = setInterval(next, config.autoRotateMs);
        }

        function stopAuto() {
            if (autoTimer) clearInterval(autoTimer);
            autoTimer = null;
        }

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

        // touch hero
        let pointerStartX = 0;
        let pointerStartY = 0;
        let pointerStartTime = 0;
        let gestureDirection = null;
        let isPointerDown = false;
        let didDrag = false;
        let suppressClickAfterSwipe = false;
        let pointerCaptureTarget = null;

        function onPointerDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            pointerStartTime = Date.now();
            isPointerDown = true;
            gestureDirection = null;
            didDrag = false;
            suppressClickAfterSwipe = false;
            pointerCaptureTarget = null;
            stopAuto();
        }

        function onPointerMove(e) {
            if (!isPointerDown) return;
            const dx = e.clientX - pointerStartX;
            const dy = e.clientY - pointerStartY;

            if (!gestureDirection) {
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);
                if (absX < 8 && absY < 8) return;
                if (absY >= absX) {
                    gestureDirection = 'vertical';
                    isPointerDown = false;
                    return;
                }
                gestureDirection = 'horizontal';
                pointerCaptureTarget = e.target instanceof Element ? e.target : stage;
                try {
                    pointerCaptureTarget.setPointerCapture?.(e.pointerId);
                } catch {}
            }

            if (gestureDirection === 'horizontal') {
                didDrag = true;
                if (e.cancelable) e.preventDefault();
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
                const offset = Math.round(Math.max(-maxOffset, Math.min(maxOffset, dx)));
                stage.style.setProperty('--hero-drag-offset', `${offset}px`);
            }
        }

        function resetDragState(e) {
            isPointerDown = false;
            didDrag = false;
            gestureDirection = null;
            try {
                pointerCaptureTarget?.releasePointerCapture?.(e.pointerId);
            } catch {}
            pointerCaptureTarget = null;
            stage.classList.remove('is-dragging', 'is-drag-next', 'is-drag-prev');
            slides.forEach((slide) => slide.classList.remove('is-drag-target'));
            stage.style.removeProperty('--hero-drag-offset');
        }

        function onPointerUp(e) {
            if (!isPointerDown && !didDrag) return;
            const wasDragging = didDrag;
            resetDragState(e);

            if (wasDragging) {
                const dx = e.clientX - pointerStartX;
                const timeDiff = Math.max(1, Date.now() - pointerStartTime);
                const velocity = Math.abs(dx) / timeDiff;
                if (velocity > 0.25 || Math.abs(dx) >= 30) {
                    suppressClickAfterSwipe = true;
                    window.setTimeout(() => {
                        suppressClickAfterSwipe = false;
                    }, 0);
                    dx > 0 ? prev() : next();
                }
            }
            startAuto();
        }

        function onPointerCancel(e) {
            resetDragState(e);
            startAuto();
        }

        function onRatingBadgeClick(e) {
            const badge = e.target.closest('[data-home-hero-rating-badge]');
            if (!badge || suppressClickAfterSwipe) return;
            e.preventDefault();
            const workId = badge.dataset.workId;
            const workTitle = badge.dataset.workTitle || 'Obra';
            const slide = badge.closest('.hero-slide');

            openWorkRatingModal({
                workId,
                workTitle,
                onRated({ userRating, ratingAverage, ratingCount }) {
                    userRatingCache.set(Number(workId), Number(userRating));
                    if (slide) {
                        const ratingNumEl = slide.querySelector('[data-home-hero-rating]');
                        const ratingCountEl = slide.querySelector('[data-home-hero-rating-count]');
                        if (ratingNumEl && ratingAverage != null) {
                            ratingNumEl.textContent = Number(ratingAverage).toFixed(1);
                        }
                        if (ratingCountEl && ratingCount != null) {
                            ratingCountEl.textContent = String(ratingCount);
                        }
                    }
                    badge.classList.add('has-user-rating');
                    badge.title = `Tu calificación: ${Number(userRating).toFixed(1)} ★ (clic para editar)`;
                },
            });
        }

        function onStageClick(e) {
            if (!suppressClickAfterSwipe) return;
            e.preventDefault();
        }

        retryBtn?.addEventListener('click', onRetry);
        container.addEventListener('keydown', onKey);
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerCancel);
        stage.addEventListener('click', onStageClick);
        stage.addEventListener('click', onRatingBadgeClick);
        dotsEl.addEventListener('click', onDotClick);

        await load();

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
                stage.removeEventListener('click', onRatingBadgeClick);
                dotsEl.removeEventListener('click', onDotClick);
            },
        };
    },
};

function renderSiteHero(container, options = {}) {
    container.removeAttribute('aria-busy');
    return HeroComponent.mount(container, options);
}

const heroEl = document.getElementById('hero');
if (heroEl) renderSiteHero(heroEl);

initHomeSections();
