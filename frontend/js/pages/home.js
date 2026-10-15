
import { API_BASE_URL } from '../api/api-config.js';
import { safeUrl, IMG_FALLBACK } from '../shared/url-utils.js';
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { renderNotice } from '../components/notice.js';

const DEFAULT_CONFIG = {
    apiUrl: `${API_BASE_URL}/v1/hero/`,
    autoRotateMs: 7000,
    transitionMs: 500,
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
    }
    setText('[data-home-hero-scan-name]', scan.name);
    setText('[data-home-hero-alternative-title]', work.alternative_title || 'LANZAMIENTO DESTACADO');
    setText('[data-home-hero-title-top]', titleWords.slice(0, titleSplit).join(' '));
    setText('[data-home-hero-title-accent]', titleWords.slice(titleSplit).join(' '));
    const titleBreak = fragment.querySelector('[data-home-hero-title-break]');
    if (titleBreak) titleBreak.hidden = !titleWords.slice(titleSplit).length;
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

    // Acción Leer
    const readLink = fragment.querySelector('[data-home-hero-read-link]');
    const readUrl = safeUrl(actions.read_first?.url, `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`);
    readLink.href = readUrl;
    setText('[data-home-hero-read-text]', 'Leer');

    // Acción Detalles
    const detailLink = fragment.querySelector('[data-home-hero-detail-link]');
    detailLink.href = `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
    detailLink.setAttribute('aria-label', `Ver detalles de ${title || 'la obra'}`);

    // Acción Biblioteca
    const libraryButton = fragment.querySelector('[data-home-hero-library-btn]');
    const isInLibrary = Boolean(actions.library?.is_added);
    libraryButton.dataset.workId = String(work.id);
    libraryButton.setAttribute('aria-pressed', String(isInLibrary));
    libraryButton.classList.toggle('is-in-library', isInLibrary);
    setText(
        '[data-home-hero-library-text]',
        isInLibrary ? 'En Biblioteca' : 'Añadir a Biblioteca',
    );

    // Próximo capítulo
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
            : 'Añádela a tu biblioteca para recibir avisos'
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
            return 'fire';
        case 'star':
            return 'star';
        case 'sparkles':
            return 'bolt';
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
        const slideTemplate = document.getElementById('hero-slide-template');

        let slides = [];
        let currentIndex = 0;
        let autoTimer = null;

        // Carga de datos.
        async function load() {
            try {
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

                // Conservamos el orden de grupos enviado por el backend evitando duplicados.
                const seen = new Set();
                const works = [];
                for (const item of [...(data.top || []), ...(data.popular || []), ...(data.new || [])]) {
                    if (item && item.id && !seen.has(item.id)) {
                        seen.add(item.id);
                        works.push(item);
                    }
                }

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

            // Si el usuario está autenticado, encender las insignias de las obras ya calificadas
            if (getAccessToken()) {
                works.forEach(async (work) => {
                    try {
                        const data = await apiRequest(`/library/${work.id}/rating`);
                        if (data && data.user_rating != null) {
                            const badge = stage.querySelector(`[data-home-hero-rating-badge][data-work-id="${work.id}"]`);
                            if (badge) {
                                badge.classList.add('has-user-rating');
                                badge.title = `¡Ya calificaste esta obra con ${Number(data.user_rating).toFixed(1)} ★! Clic para editar`;
                            }
                        }
                    } catch {}
                });
            }
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
                    showToast('Obra eliminada de tu biblioteca.', 'info');
                } else {
                    await apiRequest(`/library/${workId}`, {
                        method: 'POST',
                        body: { status: 'FOLLOWING' },
                    });
                    showToast('¡Obra añadida a tu biblioteca!', 'success');
                }

                const added = !isAdded;
                button.setAttribute('aria-pressed', String(added));
                button.classList.toggle('is-in-library', added);
                if (text) {
                    text.textContent = added ? 'En Biblioteca' : 'Añadir a Biblioteca';
                }
            } catch (error) {
                if (error.status === 401 || error.status === 400) {
                    clearAccessToken();
                    showToast('Tu sesión ha expirado. Inicia sesión nuevamente.', 'error');
                    const next = `/pages/biblioteca.html?add=${encodeURIComponent(workId)}`;
                    window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
                    return;
                }
                showToast(error.message || 'No se pudo actualizar la biblioteca.', 'error');
            } finally {
                if (text) text.textContent = originalText;
                button.disabled = false;
            }
        }

        // Gestor del modal de calificación interactiva.
        const ratingModal = document.getElementById('hero-rating-modal');
        const ratingModalWorkTitle = document.getElementById('rating-modal-work-title');
        const ratingStatusPill = document.getElementById('rating-status-pill');
        const ratingStatusText = document.getElementById('rating-status-text');
        const ratingScoreNum = document.getElementById('rating-score-num');
        const ratingScoreLabel = document.getElementById('rating-score-label');
        const ratingRangeSlider = document.getElementById('rating-range-slider');
        const ratingStarsPreview = document.getElementById('rating-stars-preview');
        const ratingMinusBtn = document.getElementById('rating-minus-btn');
        const ratingPlusBtn = document.getElementById('rating-plus-btn');
        const ratingSubmitBtn = document.getElementById('rating-submit-btn');
        const ratingPresets = document.getElementById('rating-presets');

        let currentRatingWorkId = null;
        let currentRatingSlide = null;
        let userHasRated = false;
        let selectedScore = null;

        function getRatingDescriptor(score) {
            if (score == null) return 'Toca una estrella o mueve el selector';
            if (score >= 9.5) return '★ Obra Maestra (Excepcional)';
            if (score >= 8.5) return '★ Excelente (Muy Recomendada)';
            if (score >= 7.0) return '★ Buena (Recomendada)';
            if (score >= 5.5) return '★ Aceptable (Entretenida)';
            if (score >= 4.0) return '★ Regular';
            return '★ Mala';
        }

        function renderStarsPreview(score) {
            if (!ratingStarsPreview) return;
            ratingStarsPreview.replaceChildren();
            const effective = Number(score) || 0;
            for (let i = 1; i <= 10; i++) {
                const img = document.createElement('img');
                img.src = 'assets/icons/svg/star.svg';
                img.className = 'rating-star-icon';
                img.alt = `Calificar con ${i}`;
                img.width = 20;
                img.height = 20;
                img.dataset.score = String(i);
                const fillRatio = Math.max(0, Math.min(1, effective - (i - 1)));
                if (fillRatio >= 0.75) {
                    img.classList.add('is-full');
                } else if (fillRatio >= 0.25) {
                    img.classList.add('is-half');
                } else {
                    img.classList.add('is-empty');
                }
                ratingStarsPreview.append(img);
            }
        }

        function updateModalScore(score) {
            const rounded = Math.round(score * 10) / 10;
            const val = Math.max(1.0, Math.min(10.0, rounded));
            selectedScore = val;
            if (ratingScoreNum) ratingScoreNum.textContent = val.toFixed(1);
            if (ratingRangeSlider) ratingRangeSlider.value = String(val);
            if (ratingScoreLabel) ratingScoreLabel.textContent = getRatingDescriptor(val);
            renderStarsPreview(val);
            ratingPresets?.querySelectorAll('.rating-preset-chip').forEach(chip => {
                chip.classList.toggle('is-active', Math.abs(Number(chip.dataset.val) - val) < 0.05);
            });
        }

        async function openRatingModal(workId, workTitle, defaultScore, slide) {
            currentRatingWorkId = workId;
            currentRatingSlide = slide;
            selectedScore = null;
            userHasRated = false;

            if (ratingModalWorkTitle) ratingModalWorkTitle.textContent = workTitle;

            // Estado visual inicial limpio (sin asumir que el usuario ya calificó)
            if (ratingStatusPill) {
                ratingStatusPill.className = 'rating-status-pill is-unrated';
            }
            if (ratingStatusText) {
                ratingStatusText.innerHTML = '<span class="is-loading is-loading--md"></span>';
            }
            if (ratingScoreNum) ratingScoreNum.textContent = '—';
            if (ratingScoreLabel) ratingScoreLabel.innerHTML = '<span class="is-loading is-loading--md"></span>';
            if (ratingSubmitBtn) {
                ratingSubmitBtn.textContent = 'Guardar calificación';
                ratingSubmitBtn.disabled = false;
            }
            renderStarsPreview(0);
            ratingPresets?.querySelectorAll('.rating-preset-chip').forEach(c => c.classList.remove('is-active'));

            if (typeof ratingModal?.showModal === 'function') {
                ratingModal.showModal();
            } else {
                ratingModal?.setAttribute('open', '');
            }

            const token = getAccessToken();
            if (!token) {
                if (ratingStatusPill) ratingStatusPill.className = 'rating-status-pill is-unrated';
                if (ratingStatusText) ratingStatusText.textContent = 'Sin sesión activa';
                if (ratingScoreLabel) ratingScoreLabel.textContent = 'Inicia sesión para registrar tu calificación';
                if (ratingSubmitBtn) ratingSubmitBtn.textContent = 'Iniciar sesión para calificar';
                return;
            }

            try {
                const data = await apiRequest(`/library/${workId}/rating`);
                if (data && data.user_rating != null) {
                    userHasRated = true;
                    const userRating = Number(data.user_rating);
                    if (ratingStatusPill) ratingStatusPill.className = 'rating-status-pill is-rated';
                    if (ratingStatusText) ratingStatusText.textContent = `Tu calificación guardada: ${userRating.toFixed(1)} ★`;
                    if (ratingSubmitBtn) ratingSubmitBtn.textContent = 'Actualizar calificación';
                    updateModalScore(userRating);
                } else {
                    userHasRated = false;
                    if (ratingStatusPill) ratingStatusPill.className = 'rating-status-pill is-unrated';
                    if (ratingStatusText) ratingStatusText.textContent = 'Sin calificar aún';
                    if (ratingScoreNum) ratingScoreNum.textContent = '—';
                    if (ratingScoreLabel) ratingScoreLabel.textContent = 'Toca una estrella o mueve el selector para calificar';
                    if (ratingSubmitBtn) ratingSubmitBtn.textContent = 'Guardar calificación';
                    renderStarsPreview(0);
                }
            } catch (err) {
                userHasRated = false;
                if (ratingStatusPill) ratingStatusPill.className = 'rating-status-pill is-unrated';
                if (ratingStatusText) ratingStatusText.textContent = 'Sin calificar aún';
                if (ratingScoreNum) ratingScoreNum.textContent = '—';
                if (ratingScoreLabel) ratingScoreLabel.textContent = 'Toca una estrella o mueve el selector para calificar';
                renderStarsPreview(0);
            }
        }

        function closeRatingModal() {
            if (typeof ratingModal?.close === 'function') {
                ratingModal.close();
            } else {
                ratingModal?.removeAttribute('open');
            }
        }

        function onRatingBadgeClick(e) {
            const badge = e.target.closest('[data-home-hero-rating-badge]');
            if (!badge || suppressClickAfterSwipe) return;
            e.preventDefault();
            const workId = badge.dataset.workId;
            const workTitle = badge.dataset.workTitle || 'Obra';
            const currentScore = badge.dataset.currentRating || '9.5';
            const slide = badge.closest('.hero-slide');
            openRatingModal(workId, workTitle, currentScore, slide);
        }

        async function onRatingSubmit(e) {
            e.preventDefault();
            if (!currentRatingWorkId) return;

            if (!getAccessToken()) {
                closeRatingModal();
                showToast('Debes iniciar sesión para calificar.', 'info');
                const next = window.location.pathname + window.location.search;
                window.location.assign(`/pages/login.html?next=${encodeURIComponent(next)}`);
                return;
            }

            if (selectedScore == null) {
                showToast('Por favor selecciona una calificación antes de guardar.', 'warning');
                return;
            }

            if (ratingSubmitBtn) {
                ratingSubmitBtn.disabled = true;
                ratingSubmitBtn.textContent = 'Guardando…';
            }

            try {
                const res = await apiRequest(`/library/${currentRatingWorkId}/rating`, {
                    method: 'POST',
                    body: { rating: selectedScore },
                });

                if (currentRatingSlide) {
                    const ratingNumEl = currentRatingSlide.querySelector('[data-home-hero-rating]');
                    const ratingCountEl = currentRatingSlide.querySelector('[data-home-hero-rating-count]');
                    const badge = currentRatingSlide.querySelector('[data-home-hero-rating-badge]');
                    if (ratingNumEl && res.rating_average != null) {
                        ratingNumEl.textContent = Number(res.rating_average).toFixed(1);
                    }
                    if (ratingCountEl && res.rating_count != null) {
                        ratingCountEl.textContent = String(res.rating_count);
                    }
                    if (badge) {
                        badge.classList.add('has-user-rating');
                        badge.title = `Tu calificación: ${selectedScore.toFixed(1)} ★ • Promedio: ${res.rating_average != null ? Number(res.rating_average).toFixed(1) : ''}`;
                    }
                }

                closeRatingModal();
                showToast(userHasRated ? '¡Calificación actualizada con éxito!' : '¡Calificación guardada con éxito!', 'success');
            } catch (err) {
                if (err.status === 401 || err.status === 400) {
                    clearAccessToken();
                    showToast('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'error');
                    setTimeout(() => {
                        window.location.assign(`/pages/login.html?next=${encodeURIComponent(window.location.pathname)}`);
                    }, 800);
                    return;
                }
                showToast(err.message || 'No se pudo guardar la calificación.', 'error');
            } finally {
                if (ratingSubmitBtn) {
                    ratingSubmitBtn.disabled = false;
                    ratingSubmitBtn.textContent = userHasRated ? 'Actualizar calificación' : 'Guardar calificación';
                }
            }
        }

        function onRatingSliderInput(e) {
            updateModalScore(Number(e.target.value));
        }

        function onRatingMinusClick() {
            const current = selectedScore != null ? selectedScore : 8.0;
            updateModalScore(current - 0.5);
        }

        function onRatingPlusClick() {
            const current = selectedScore != null ? selectedScore : 8.0;
            updateModalScore(current + 0.5);
        }

        function onRatingPresetClick(e) {
            const chip = e.target.closest('.rating-preset-chip');
            if (chip && chip.dataset.val) {
                updateModalScore(Number(chip.dataset.val));
            }
        }

        function onRatingStarsClick(e) {
            const star = e.target.closest('[data-score]');
            if (!star) return;
            const score = Number(star.dataset.score);
            if (!isNaN(score)) {
                updateModalScore(score);
            }
        }

        function onRatingModalCloseClick(e) {
            if (e.target.closest('[data-rating-modal-close]')) {
                closeRatingModal();
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
        stage.addEventListener('click', onRatingBadgeClick);
        dotsEl.addEventListener('click', onDotClick);

        // Eventos del modal de calificación.
        ratingRangeSlider?.addEventListener('input', onRatingSliderInput);
        ratingMinusBtn?.addEventListener('click', onRatingMinusClick);
        ratingPlusBtn?.addEventListener('click', onRatingPlusClick);
        ratingPresets?.addEventListener('click', onRatingPresetClick);
        ratingStarsPreview?.addEventListener('click', onRatingStarsClick);
        ratingSubmitBtn?.addEventListener('click', onRatingSubmit);
        ratingModal?.addEventListener('click', onRatingModalCloseClick);

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
                stage.removeEventListener('click', onRatingBadgeClick);
                dotsEl.removeEventListener('click', onDotClick);
                ratingRangeSlider?.removeEventListener('input', onRatingSliderInput);
                ratingMinusBtn?.removeEventListener('click', onRatingMinusClick);
                ratingPlusBtn?.removeEventListener('click', onRatingPlusClick);
                ratingPresets?.removeEventListener('click', onRatingPresetClick);
                ratingStarsPreview?.removeEventListener('click', onRatingStarsClick);
                ratingSubmitBtn?.removeEventListener('click', onRatingSubmit);
                ratingModal?.removeEventListener('click', onRatingModalCloseClick);
            },
        };
    },
};

function renderSiteHero(container, options = {}) {
    container.removeAttribute('aria-busy');
    return HeroComponent.mount(container, options);
}

const headerEl = document.getElementById('header');
if (headerEl) renderSiteHeader(headerEl);

const noticeEl = document.getElementById('notice');
if (noticeEl) renderNotice(noticeEl);

const heroEl = document.getElementById('hero');
if (heroEl) renderSiteHero(heroEl);
