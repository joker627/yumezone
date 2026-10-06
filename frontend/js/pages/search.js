import { API_BASE_URL } from '../api/api-config.js';
import { renderSiteHeader } from '../components/header.js';
import { safeUrl } from '../shared/url-utils.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const summary = document.getElementById('search-summary');
const results = document.getElementById('search-results');
const pagination = document.getElementById('search-pagination');
const filterToggle = document.getElementById('works-filter-toggle');
const filterToggleCount = document.getElementById('works-filter-count');
const filterPanel = document.getElementById('works-filter-panel');
const applyFiltersButton = document.getElementById('works-apply-filters');
const resetFiltersButton = document.getElementById('works-reset-filters');
const activeFilters = document.getElementById('works-active-filters');
const filterGroups = {
    format_id: { options: document.getElementById('works-format-options'), key: 'formats' },
    status_id: { options: document.getElementById('works-status-options'), key: 'statuses' },
    demographic_id: { options: document.getElementById('works-demographic-options'), key: 'demographics' },
    genre_id: { options: document.getElementById('works-genre-options'), key: 'genres' },
};
const filterKeys = Object.keys(filterGroups);
let resultController = null;
let filterOptions = {};

document.title = 'Obras | YumeZone';

function apiUrl(path) {
    return `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
}

function getState() {
    const params = new URLSearchParams(window.location.search);
    const parsedPage = Number.parseInt(params.get('page') || '1', 10);
    const state = {
        q: (params.get('q') || '').trim(),
        page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
        sort: ['relevance', 'popular', 'recent', 'title'].includes(params.get('sort'))
            ? params.get('sort')
            : 'relevance',
    };
    for (const key of filterKeys) {
        state[key] = [...new Set(params.getAll(key).filter((value) => /^\d+$/.test(value) && Number(value) > 0))];
    }
    return state;
}

function makeWorkUrl(work) {
    if (!work.slug) return null;
    return `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
}

function makeReaderUrl(work) {
    if (!work.slug || !work.first_chapter_id) return null;
    return `/pages/leer.html?slug=${encodeURIComponent(work.slug)}&chapter_id=${work.first_chapter_id}`;
}

function addText(parent, tagName, className, value) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = value ?? '';
    parent.append(element);
    return element;
}

function formatViews(views) {
    if (!views) return '';
    const v = Number(views);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M lecturas`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k lecturas`;
    return `${v} lecturas`;
}

function createWorkCard(work) {
    const card = document.createElement('article');
    card.className = 'search-result-card';
    const workUrl = makeWorkUrl(work);
    const coverUrl = safeUrl(work.cover_url, '');
    const readerUrl = makeReaderUrl(work) || workUrl;

    if (coverUrl) {
        const coverLink = document.createElement(workUrl ? 'a' : 'div');
        coverLink.className = 'search-result-cover-link';
        if (workUrl) coverLink.href = workUrl;
        const cover = document.createElement('img');
        cover.src = coverUrl;
        cover.alt = work.title || '';
        cover.loading = 'lazy';
        coverLink.append(cover);
        card.append(coverLink);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'search-result-cover-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = (work.title || '?').slice(0, 1).toUpperCase();
        card.append(placeholder);
    }

    const copy = document.createElement('div');
    copy.className = 'search-result-copy';

    const title = document.createElement(workUrl ? 'a' : 'h2');
    title.className = 'search-result-title';
    title.textContent = work.title || 'Obra sin título';
    if (workUrl) title.href = workUrl;
    copy.append(title);

    const metaParts = [work.alternative_title, work.author]
        .filter((value, index, values) => value && values.indexOf(value) === index);
    if (metaParts.length) addText(copy, 'p', 'search-result-meta', metaParts.join(' · '));

    // Indicadores estadísticos: Rating + Vistas
    const rating = work.rating_average ? Number(work.rating_average).toFixed(1) : null;
    const views = formatViews(work.total_views);
    if (rating || views) {
        const statsEl = document.createElement('div');
        statsEl.className = 'search-result-stats';
        if (rating) {
            const ratingSpan = document.createElement('span');
            ratingSpan.className = 'search-result-rating';
            const starImg = document.createElement('img');
            starImg.src = '/assets/icons/svg/star.svg';
            starImg.alt = '';
            starImg.width = 11;
            starImg.height = 11;
            ratingSpan.append(starImg, document.createTextNode(` ${rating}`));
            statsEl.append(ratingSpan);
        }
        if (views) {
            const viewsSpan = document.createElement('span');
            viewsSpan.className = 'search-result-views';
            viewsSpan.textContent = views;
            statsEl.append(viewsSpan);
        }
        copy.append(statsEl);
    }

    if (work.synopsis) addText(copy, 'p', 'search-result-synopsis', work.synopsis);

    if (workUrl) {
        const actions = document.createElement('div');
        actions.className = 'search-result-actions';

        if (work.first_chapter_id) {
            const read = document.createElement('a');
            read.className = 'search-result-read';
            read.href = readerUrl;
            const playImg = document.createElement('img');
            playImg.src = '/assets/icons/svg/play.svg';
            playImg.alt = '';
            playImg.width = 10;
            playImg.height = 10;
            read.append(playImg, document.createTextNode(' Leer obra'));
            actions.append(read);
        }

        const detail = document.createElement('a');
        detail.className = 'search-result-detail-btn';
        detail.href = workUrl;
        detail.textContent = 'Detalles';
        actions.append(detail);

        copy.append(actions);
    } else {
        addText(copy, 'span', 'search-result-unavailable', 'Aún no tiene capítulos publicados');
    }

    card.append(copy);
    return card;
}

function createChip(label, ariaLabel, onRemove) {
    const chip = document.createElement('button');
    chip.className = 'works-filter-chip';
    chip.type = 'button';
    chip.setAttribute('aria-label', ariaLabel);
    const text = document.createElement('span');
    text.textContent = label;
    const icon = document.createElement('img');
    icon.src = '/assets/icons/svg/x.svg';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    chip.append(text, icon);
    chip.addEventListener('click', onRemove);
    activeFilters.append(chip);
}

function getActiveCount(state) {
    const selectedCount = filterKeys.reduce((count, key) => count + state[key].length, 0);
    return selectedCount + (state.q ? 1 : 0) + (state.sort !== 'relevance' ? 1 : 0);
}

function syncDraftControls(state) {
    for (const key of filterKeys) {
        filterGroups[key].options.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.checked = state[key].includes(input.value);
        });
    }
    filterPanel.querySelectorAll('input[name="works-sort"]').forEach((input) => {
        input.checked = input.value === state.sort;
    });
}

function syncControls(state = getState()) {
    syncDraftControls(state);
    const searchInput = header?.querySelector('#search-input');
    const searchClear = header?.querySelector('#search-clear');
    if (searchInput) searchInput.value = state.q;
    if (searchClear) searchClear.hidden = !state.q;

    activeFilters.replaceChildren();
    if (state.q) {
        createChip(`Búsqueda: ${state.q}`, `Quitar búsqueda: ${state.q}`, removeSearchFilter);
    }

    for (const key of filterKeys) {
        const group = filterGroups[key];
        for (const selectedId of state[key]) {
            const option = (filterOptions[group.key] || []).find((item) => String(item.id) === selectedId);
            const label = option?.name || selectedId;
            createChip(label, `Quitar filtro: ${label}`, () => removeFilterValue(key, selectedId));
        }
    }

    if (state.sort !== 'relevance') {
        const sortNames = { popular: 'Popularidad', recent: 'Más recientes', title: 'Título A–Z' };
        createChip(`Orden: ${sortNames[state.sort] || state.sort}`, 'Restablecer orden', removeSortFilter);
    }

    activeFilters.hidden = activeFilters.childElementCount === 0;
    const activeCount = getActiveCount(state);
    filterToggleCount.textContent = String(activeCount);
    filterToggleCount.hidden = activeCount === 0;
}

function createFilterOption(field, option) {
    const label = document.createElement('label');
    label.className = 'works-filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = field;
    checkbox.value = String(option.id);
    const text = document.createElement('span');
    text.textContent = option.name;
    label.append(checkbox, text);
    return label;
}

async function loadFilterOptions() {
    const response = await fetch(apiUrl('/works/filters'), {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    filterOptions = await response.json();
    for (const [field, group] of Object.entries(filterGroups)) {
        const options = filterOptions[group.key] || [];
        group.options.replaceChildren(...options.map((option) => createFilterOption(field, option)));
    }
    syncControls();
}

function makePageUrl(targetPage) {
    const url = new URL(window.location.href);
    if (targetPage > 1) url.searchParams.set('page', String(targetPage));
    else url.searchParams.delete('page');
    return `${url.pathname}${url.search}`;
}

function renderPagination(info) {
    pagination.replaceChildren();
    if (!info?.has_previous_page && !info?.has_next_page) {
        pagination.hidden = true;
        return;
    }

    const makePageLink = (targetPage, label, ariaLabel) => {
        const link = document.createElement('a');
        link.href = makePageUrl(targetPage);
        link.textContent = label;
        link.setAttribute('aria-label', ariaLabel);
        return link;
    };

    if (info.has_previous_page && info.previous_page !== null) {
        pagination.append(makePageLink(info.previous_page, 'Anterior', 'Página anterior'));
    }
    const pageLabel = document.createElement('span');
    pageLabel.textContent = `Página ${info.current_page} de ${info.last_visible_page}`;
    pagination.append(pageLabel);
    if (info.has_next_page && info.next_page !== null) {
        pagination.append(makePageLink(info.next_page, 'Siguiente', 'Página siguiente'));
    }
    pagination.hidden = false;
}

function syncPageFromResponse(page) {
    const url = new URL(window.location.href);
    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function buildResultsUrl(state) {
    const url = new URL(apiUrl('/works/'));
    if (state.q) url.searchParams.set('q', state.q);
    for (const key of filterKeys) {
        for (const value of state[key]) url.searchParams.append(key, value);
    }
    url.searchParams.set('sort', state.sort);
    url.searchParams.set('page', String(state.page));
    return url;
}

async function loadResults() {
    const state = getState();
    resultController?.abort();
    const controller = new AbortController();
    resultController = controller;
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren();
    pagination.hidden = true;

    if (state.q.length === 1) {
        summary.textContent = 'Escribe un carácter más para buscar en las obras.';
        results.setAttribute('aria-busy', 'false');
        return;
    }

    summary.textContent = state.q ? `Buscando “${state.q}”…` : 'Cargando obras…';

    try {
        const response = await fetch(buildResultsUrl(state), {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (Number.isInteger(result.pagination?.current_page)) {
            syncPageFromResponse(result.pagination.current_page);
        }
        const works = Array.isArray(result.data) ? result.data : [];
        const total = Number(result.pagination?.items?.total || 0);

        if (!works.length) {
            summary.textContent = state.q
                ? `No encontramos obras para “${state.q}”.`
                : 'No hay obras que coincidan con estos filtros.';
            const empty = document.createElement('p');
            empty.className = 'search-page-message';
            empty.textContent = state.q
                ? 'Prueba otro título, autor, género o ajusta los filtros.'
                : 'Cambia o limpia los filtros para ver más obras.';
            results.append(empty);
            return;
        }

        summary.textContent = state.q
            ? `${total} ${total === 1 ? 'obra coincide' : 'obras coinciden'} con “${state.q}”.`
            : `${total} ${total === 1 ? 'obra disponible' : 'obras disponibles'} en el catálogo.`;
        results.append(...works.map(createWorkCard));
        renderPagination(result.pagination);
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('[works] No se pudieron cargar las obras:', error);
        summary.textContent = 'No se pudieron cargar las obras.';
        const message = document.createElement('p');
        message.className = 'search-page-message';
        message.append(document.createTextNode('Revisa la conexión con el servidor y '));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'search-page-retry';
        retry.textContent = 'vuelve a intentarlo';
        retry.addEventListener('click', loadResults, { once: true });
        message.append(retry, document.createTextNode('.'));
        results.append(message);
    } finally {
        if (!controller.signal.aborted) results.setAttribute('aria-busy', 'false');
    }
}

function setFilterPanelOpen(isOpen, { discard = false, restoreFocus = false } = {}) {
    if (!isOpen && discard) syncDraftControls(getState());
    filterPanel.hidden = !isOpen;
    filterToggle.setAttribute('aria-expanded', String(isOpen));
    if (restoreFocus) filterToggle.focus();
}

function readDraftState() {
    const state = getState();
    state.page = 1;
    for (const key of filterKeys) {
        state[key] = [...filterPanel.querySelectorAll(`input[name="${key}"]:checked`)]
            .map((input) => input.value);
    }
    state.sort = filterPanel.querySelector('input[name="works-sort"]:checked')?.value || 'relevance';
    return state;
}

function writeStateToUrl(state, { clearSearch = false } = {}) {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    url.searchParams.delete('all');
    if (clearSearch) url.searchParams.delete('q');
    for (const key of filterKeys) {
        url.searchParams.delete(key);
        for (const value of state[key]) url.searchParams.append(key, value);
    }
    if (state.sort === 'relevance') url.searchParams.delete('sort');
    else url.searchParams.set('sort', state.sort);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
}

function applyFilters() {
    const state = readDraftState();
    writeStateToUrl(state);
    setFilterPanelOpen(false);
    syncControls(state);
    loadResults();
}

function clearAllFilters() {
    const state = { q: '', sort: 'relevance', ...Object.fromEntries(filterKeys.map((key) => [key, []])) };
    writeStateToUrl(state, { clearSearch: true });
    setFilterPanelOpen(false);
    syncControls(state);
    loadResults();
}

function removeSearchFilter() {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    url.searchParams.delete('page');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    syncControls();
    loadResults();
}

function removeFilterValue(key, value) {
    const url = new URL(window.location.href);
    const remaining = url.searchParams.getAll(key).filter((item) => item !== value);
    url.searchParams.delete(key);
    for (const item of remaining) url.searchParams.append(key, item);
    url.searchParams.delete('page');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    syncControls();
    loadResults();
}

function removeSortFilter() {
    const url = new URL(window.location.href);
    url.searchParams.delete('sort');
    url.searchParams.delete('page');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    syncControls();
    loadResults();
}

filterToggle.addEventListener('click', () => {
    setFilterPanelOpen(filterPanel.hidden, { discard: filterPanel.hidden });
});
applyFiltersButton.addEventListener('click', applyFilters);
resetFiltersButton.addEventListener('click', clearAllFilters);
filterPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        setFilterPanelOpen(false, { discard: true, restoreFocus: true });
    }
});
document.addEventListener('click', (event) => {
    if (!filterPanel.hidden && !event.target.closest('.works-filter-bar')) {
        setFilterPanelOpen(false, { discard: true });
    }
});
window.addEventListener('popstate', () => {
    setFilterPanelOpen(false, { discard: true });
    syncControls();
    loadResults();
});

syncControls();
loadFilterOptions().catch((error) => {
    console.error('[works] No se pudieron cargar los filtros:', error);
    summary.textContent = 'No se pudieron cargar las opciones de filtros.';
});
loadResults();
