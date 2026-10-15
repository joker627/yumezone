import { renderSiteHeader } from '../components/header.js';
import { apiRequest } from '../shared/auth.js';
import { renderCatalogCard } from '../components/cards.js';
import { renderSkeletonCards } from '../components/loader.js';
import { esc } from '../shared/ui-utils.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const summary = document.getElementById('catalog-summary');
const results = document.getElementById('catalog-results');
const pagination = document.getElementById('catalog-pagination');
const filterToggle = document.getElementById('works-filter-toggle');
const filterToggleCount = document.getElementById('works-filter-count');
const filterPanel = document.getElementById('works-filter-panel');
const filterBackdrop = document.getElementById('works-filter-backdrop');
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

document.title = 'Catálogo | YumeZone';

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

function createWorkCard(work) {
    const template = document.createElement('template');
    template.innerHTML = renderCatalogCard(work).trim();
    return template.content.firstElementChild;
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
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
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
    filterOptions = await apiRequest('/works/filters');
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

function buildResultsQuery(state) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    for (const key of filterKeys) {
        for (const value of state[key]) params.append(key, value);
    }
    params.set('sort', state.sort);
    params.set('page', String(state.page));
    return params.toString();
}

async function loadResults() {
    const state = getState();
    resultController?.abort();
    const controller = new AbortController();
    resultController = controller;
    results.setAttribute('aria-busy', 'true');
    results.innerHTML = renderSkeletonCards(6);
    pagination.hidden = true;

    if (state.q.length === 1) {
        summary.textContent = 'Escribe un carácter más para buscar en las obras.';
        results.replaceChildren();
        results.setAttribute('aria-busy', 'false');
        return;
    }

    summary.innerHTML = state.q
        ? `Buscando “${esc(state.q)}”…`
        : '<span class="is-loading is-loading--md"></span>';

    try {
        const result = await apiRequest(`/works/?${buildResultsQuery(state)}`, {
            signal: controller.signal,
        });
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
            empty.className = 'catalog-page-message';
            empty.textContent = state.q
                ? 'Prueba otro título, autor, género o ajusta los filtros.'
                : 'Cambia o limpia los filtros para ver más obras.';
            results.replaceChildren(empty);
            return;
        }

        summary.textContent = state.q
            ? `${total} ${total === 1 ? 'obra coincide' : 'obras coinciden'} con “${state.q}”.`
            : `${total} ${total === 1 ? 'obra disponible' : 'obras disponibles'} en el catálogo.`;
        results.replaceChildren(...works.map(createWorkCard));
        renderPagination(result.pagination);
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('[works] No se pudieron cargar las obras:', error);
        summary.textContent = 'No se pudieron cargar las obras.';
        const message = document.createElement('p');
        message.className = 'catalog-page-message';
        message.append(document.createTextNode('Revisa la conexión con el servidor y '));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'catalog-page-retry';
        retry.textContent = 'vuelve a intentarlo';
        retry.addEventListener('click', loadResults, { once: true });
        message.append(retry, document.createTextNode('.'));
        results.replaceChildren(message);
    } finally {
        if (!controller.signal.aborted) results.setAttribute('aria-busy', 'false');
    }
}

function setFilterPanelOpen(isOpen, { discard = false, restoreFocus = false } = {}) {
    if (!isOpen && discard) syncDraftControls(getState());
    filterPanel.hidden = !isOpen;
    if (filterBackdrop) filterBackdrop.hidden = !isOpen;
    document.body.classList.toggle('no-scroll', isOpen);
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
filterBackdrop?.addEventListener('click', () => {
    setFilterPanelOpen(false, { discard: true, restoreFocus: true });
});
document.getElementById('works-filter-panel-close')?.addEventListener('click', () => {
    setFilterPanelOpen(false, { discard: true, restoreFocus: true });
});
applyFiltersButton.addEventListener('click', applyFilters);
resetFiltersButton.addEventListener('click', clearAllFilters);
filterPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        setFilterPanelOpen(false, { discard: true, restoreFocus: true });
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
