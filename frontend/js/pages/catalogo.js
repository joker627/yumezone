// catalogo de obras
import { apiRequest } from '../shared/auth.js';
import { renderCatalogCard } from '../components/cards.js';
import { renderSkeletonCards } from '../components/skeletons.js';

const title = document.getElementById('catalog-title');
const summary = document.getElementById('catalog-summary');
const results = document.getElementById('catalog-results');
const pagination = document.getElementById('catalog-pagination');

// controles barra
const sortSelect = document.getElementById('catalog-sort-select');
const quickFormatsRoot = document.getElementById('catalog-quick-formats');
const quickStatusesRoot = document.getElementById('catalog-quick-statuses');
const activeFiltersBar = document.getElementById('works-active-filters-bar');
const activeFilters = document.getElementById('works-active-filters');
const clearInlineBtn = document.getElementById('catalog-clear-inline');

// controles modal
const filterToggle = document.getElementById('works-filter-toggle');
const filterCount = document.getElementById('works-filter-count');
const filterPanel = document.getElementById('works-filter-panel');
const filterBackdrop = document.getElementById('works-filter-backdrop');
const genresRoot = document.getElementById('works-genres');
const demographicsRoot = document.getElementById('works-demographics');
const resetFiltersButton = document.getElementById('works-reset-filters');
const applyFiltersButton = document.getElementById('works-apply-filters');

if (
  !title || !summary || !results || !pagination ||
  !filterToggle || !filterCount || !filterPanel || !activeFilters ||
  !genresRoot || !demographicsRoot ||
  !resetFiltersButton || !applyFiltersButton
) {
  throw new Error('Catalogo: estructura del DOM incompleta.');
}

const PAGE_LIMIT = 21;
const SORT_LABELS = {
  relevance: 'Relevancia',
  popular: 'Popularidad',
  recent: 'Más recientes',
  title_asc: 'Título A–Z',
};

let filterMeta = {
  genres: [],
  demographics: [],
  formats: [],
  statuses: [],
};
let resultsController = null;
let resultsRequestId = 0;



// estado url
function getParams() {
  return new URLSearchParams(window.location.search);
}

function getQuery() {
  return (getParams().get('q') || '').trim();
}

function getPage() {
  const value = Number.parseInt(getParams().get('page') || '1', 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getSelectedNumbers(paramName) {
  return getParams()
    .getAll(paramName)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getSingleNumber(paramName) {
  const value = Number.parseInt(getParams().get(paramName) || '', 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSort() {
  const sort = getParams().get('sort') || 'relevance';
  return Object.hasOwn(SORT_LABELS, sort) ? sort : 'relevance';
}

function updateUrlAndReload(mutator, { resetPage = true } = {}) {
  const url = new URL('/pages/catalogo.html', window.location.origin);
  url.search = window.location.search;
  mutator(url.searchParams);
  if (resetPage) {
    url.searchParams.delete('page');
  }
  url.searchParams.delete('all');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  syncControls();
  loadResults();
}

// modal filtros
function setFilterPanelOpen(open, { discard = false, restoreFocus = false } = {}) {
  if (!open && discard) {
    syncControls();
  }
  filterPanel.hidden = !open;
  if (filterBackdrop) filterBackdrop.hidden = !open;
  filterToggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    filterPanel.querySelector('input')?.focus();
  } else if (restoreFocus) {
    filterToggle.focus();
  }
}

function createOptionCheckbox({ name, value, label, checked, single = false }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'works-filter-option';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;
  input.value = String(value);
  input.checked = checked;
  if (single) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      filterPanel.querySelectorAll(`input[name="${name}"]`).forEach((item) => {
        if (item !== input) item.checked = false;
      });
    });
  }

  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}

function renderFilterGroup(container, items, name, selectedIds, single = false) {
  const selected = new Set(selectedIds);
  const options = items.map((item) => createOptionCheckbox({
    name,
    value: item.id,
    label: item.name,
    checked: selected.has(item.id),
    single,
  }));
  container.replaceChildren(...options);
}

// filtros rapidos
function renderQuickRails() {
  const activeFormatId = getSingleNumber('format_id');
  const activeStatusId = getSingleNumber('status_id');

  if (quickFormatsRoot) {
    const pills = [
      { id: '', name: 'Todos' },
      ...filterMeta.formats.map((f) => ({ id: String(f.id), name: f.name })),
    ].map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = item.id === '' ? !activeFormatId : String(activeFormatId) === item.id;
      btn.className = `catalog-quick-pill${isSelected ? ' is-active' : ''}`;
      btn.dataset.formatId = item.id;
      btn.textContent = item.name;
      btn.addEventListener('click', () => {
        updateUrlAndReload((params) => {
          if (!item.id || String(activeFormatId) === item.id) {
            params.delete('format_id');
          } else {
            params.set('format_id', item.id);
          }
        });
      });
      return btn;
    });
    quickFormatsRoot.replaceChildren(...pills);
  }

  if (quickStatusesRoot) {
    const pills = [
      { id: '', name: 'Todos' },
      ...filterMeta.statuses.map((s) => ({ id: String(s.id), name: s.name })),
    ].map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = item.id === '' ? !activeStatusId : String(activeStatusId) === item.id;
      btn.className = `catalog-quick-pill${isSelected ? ' is-active' : ''}`;
      btn.dataset.statusId = item.id;
      btn.textContent = item.name;
      btn.addEventListener('click', () => {
        updateUrlAndReload((params) => {
          if (!item.id || String(activeStatusId) === item.id) {
            params.delete('status_id');
          } else {
            params.set('status_id', item.id);
          }
        });
      });
      return btn;
    });
    quickStatusesRoot.replaceChildren(...pills);
  }
}

// sincronizar filtros
function syncControls() {
  const sort = getSort();
  const selectedGenres = getSelectedNumbers('genre_ids');
  const demographicId = getSingleNumber('demographic_id');

  if (sortSelect) {
    sortSelect.value = sort;
  }

  renderFilterGroup(genresRoot, filterMeta.genres, 'genre_ids', selectedGenres, false);
  renderFilterGroup(demographicsRoot, filterMeta.demographics, 'demographic_id', demographicId ? [demographicId] : [], true);

  renderQuickRails();
  updateActiveFilters();
}

function updateActiveFilters() {
  const chips = [];
  const query = getQuery();
  const sort = getSort();
  const genreIds = getSelectedNumbers('genre_ids');
  const demographicId = getSingleNumber('demographic_id');
  const formatId = getSingleNumber('format_id');
  const statusId = getSingleNumber('status_id');

  if (query) {
    chips.push({
      label: `Búsqueda: "${query}"`,
      onRemove: () => updateUrlAndReload((p) => p.delete('q')),
    });
  }

  if (sort !== 'relevance') {
    chips.push({
      label: `Orden: ${SORT_LABELS[sort]}`,
      onRemove: () => updateUrlAndReload((p) => p.delete('sort')),
    });
  }

  const format = filterMeta.formats.find((item) => item.id === formatId);
  if (format) {
    chips.push({
      label: `Formato: ${format.name}`,
      onRemove: () => updateUrlAndReload((p) => p.delete('format_id')),
    });
  }

  const status = filterMeta.statuses.find((item) => item.id === statusId);
  if (status) {
    chips.push({
      label: `Estado: ${status.name}`,
      onRemove: () => updateUrlAndReload((p) => p.delete('status_id')),
    });
  }

  const demographic = filterMeta.demographics.find((item) => item.id === demographicId);
  if (demographic) {
    chips.push({
      label: `Demografía: ${demographic.name}`,
      onRemove: () => updateUrlAndReload((p) => p.delete('demographic_id')),
    });
  }

  genreIds.forEach((id) => {
    const item = filterMeta.genres.find((g) => g.id === id);
    if (item) {
      chips.push({
        label: item.name,
        onRemove: () => updateUrlAndReload((p) => {
          const remaining = getSelectedNumbers('genre_ids').filter((gId) => gId !== id);
          p.delete('genre_ids');
          remaining.forEach((gId) => p.append('genre_ids', String(gId)));
        }),
      });
    }
  });

  // contador filtros modal
  const modalFilterTotal = genreIds.length + (demographicId ? 1 : 0);
  filterCount.hidden = modalFilterTotal === 0;
  filterCount.textContent = String(modalFilterTotal);

  if (activeFiltersBar) {
    activeFiltersBar.hidden = chips.length === 0;
  }

  activeFilters.replaceChildren(
    ...chips.map((item) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'works-active-filter';
      chip.title = `Quitar filtro ${item.label}`;
      chip.innerHTML = `<span>${item.label}</span><span class="works-active-filter-x" aria-hidden="true">×</span>`;
      chip.addEventListener('click', item.onRemove);
      return chip;
    })
  );
}

// cargar catalogo y paginacion
function buildApiQuery() {
  const params = new URLSearchParams();
  const query = getQuery();
  const sort = getSort();
  const page = getPage();
  const demographicId = getSingleNumber('demographic_id');
  const formatId = getSingleNumber('format_id');
  const statusId = getSingleNumber('status_id');

  if (query) params.set('q', query);
  getSelectedNumbers('genre_ids').forEach((id) => params.append('genre_ids', String(id)));
  if (demographicId) params.set('demographic_id', String(demographicId));
  if (formatId) params.set('format_id', String(formatId));
  if (statusId) params.set('status_id', String(statusId));
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('limit', String(PAGE_LIMIT));
  return params;
}

function renderMessage(message, { retry = false, clearFilters = false } = {}) {
  const box = document.createElement('div');
  box.className = 'catalog-empty-state';

  const text = document.createElement('p');
  text.className = 'catalog-empty-title';
  text.textContent = message;
  box.append(text);

  const actions = document.createElement('div');
  actions.className = 'catalog-empty-actions';

  if (clearFilters) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'catalog-empty-btn';
    clearBtn.textContent = 'Limpiar filtros activos';
    clearBtn.addEventListener('click', clearAllFilters);
    actions.append(clearBtn);
  }

  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-empty-btn';
    button.textContent = 'Reintentar';
    button.addEventListener('click', () => loadResults());
    actions.append(button);
  }

  if (actions.childNodes.length) {
    box.append(actions);
  }
  results.replaceChildren(box);
}

function goToPage(targetPage) {
  updateUrlAndReload((params) => {
    params.set('page', String(targetPage));
  }, { resetPage: false });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPagination(meta) {
  if (!meta || meta.total_pages <= 1) {
    pagination.hidden = true;
    pagination.replaceChildren();
    return;
  }

  const current = meta.page;
  const total = meta.total_pages;
  const nodes = [];

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'catalog-page-btn catalog-page-btn--nav';
  prevBtn.disabled = current <= 1;
  prevBtn.innerHTML = '← Anterior';
  prevBtn.addEventListener('click', () => {
    if (current > 1) goToPage(current - 1);
  });
  nodes.push(prevBtn);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sortedPages = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  let prevRendered = 0;
  for (const p of sortedPages) {
    if (prevRendered && p - prevRendered > 1) {
      const dots = document.createElement('span');
      dots.className = 'catalog-page-dots';
      dots.textContent = '…';
      nodes.push(dots);
    }
    const pageBtn = document.createElement('button');
    pageBtn.type = 'button';
    pageBtn.className = `catalog-page-btn${p === current ? ' is-current' : ''}`;
    pageBtn.textContent = String(p);
    if (p === current) {
      pageBtn.setAttribute('aria-current', 'page');
    } else {
      pageBtn.addEventListener('click', () => goToPage(p));
    }
    nodes.push(pageBtn);
    prevRendered = p;
  }

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'catalog-page-btn catalog-page-btn--nav';
  nextBtn.disabled = current >= total;
  nextBtn.innerHTML = 'Siguiente →';
  nextBtn.addEventListener('click', () => {
    if (current < total) goToPage(current + 1);
  });
  nodes.push(nextBtn);

  pagination.replaceChildren(...nodes);
  pagination.hidden = false;
}

async function loadFilterOptions() {
  const payload = await apiRequest('/works/filters');
  filterMeta = {
    genres: Array.isArray(payload?.genres) ? payload.genres : [],
    demographics: Array.isArray(payload?.demographics) ? payload.demographics : [],
    formats: Array.isArray(payload?.formats) ? payload.formats : [],
    statuses: Array.isArray(payload?.statuses) ? payload.statuses : [],
  };
  syncControls();
}

async function loadResults() {
  const query = getQuery();
  const requestId = ++resultsRequestId;
  resultsController?.abort();
  const controller = new AbortController();
  resultsController = controller;

  title.textContent = query ? `Resultados para "${query}"` : 'Catálogo';
  summary.innerHTML = '<span class="is-loading is-loading--md"></span>';
  results.setAttribute('aria-busy', 'true');
  pagination.hidden = true;
  results.innerHTML = renderSkeletonCards(14);

  try {
    const response = await apiRequest(`/works?${buildApiQuery().toString()}`, {
      signal: controller.signal,
    });
    if (requestId !== resultsRequestId) return;

    const works = Array.isArray(response?.data) ? response.data : [];
    const meta = response?.meta;

    if (!works.length) {
      summary.textContent = '0 obras';
      const hasAnyFilter = Boolean(
        query ||
        getSelectedNumbers('genre_ids').length ||
        getSingleNumber('demographic_id') ||
        getSingleNumber('format_id') ||
        getSingleNumber('status_id')
      );
      renderMessage(
        hasAnyFilter
          ? 'No encontramos obras que coincidan con los filtros seleccionados.'
          : 'No hay obras publicadas en este momento.',
        { clearFilters: hasAnyFilter }
      );
      return;
    }

    const total = meta?.total ?? works.length;
    summary.textContent = `${total} ${total === 1 ? 'obra' : 'obras'}`;
    results.innerHTML = works.map(renderCatalogCard).join('');
    renderPagination(meta);
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== resultsRequestId) return;
    summary.textContent = 'Error de conexión';
    renderMessage('No pudimos cargar el catálogo en este momento.', { retry: true });
  } finally {
    if (requestId === resultsRequestId) {
      results.setAttribute('aria-busy', 'false');
    }
  }
}

function applyFilters() {
  const demographic = filterPanel.querySelector('input[name="demographic_id"]:checked')?.value;
  const genreValues = Array.from(filterPanel.querySelectorAll('input[name="genre_ids"]:checked')).map((i) => i.value);

  setFilterPanelOpen(false, { restoreFocus: true });

  updateUrlAndReload((params) => {
    params.delete('genre_ids');
    params.delete('demographic_id');

    genreValues.forEach((v) => params.append('genre_ids', v));
    if (demographic) params.set('demographic_id', demographic);
  });
}

function clearModalFilters() {
  setFilterPanelOpen(false, { restoreFocus: true });
  updateUrlAndReload((params) => {
    params.delete('genre_ids');
    params.delete('demographic_id');
  });
}

function clearAllFilters() {
  setFilterPanelOpen(false, { restoreFocus: false });
  updateUrlAndReload((params) => {
    params.delete('q');
    params.delete('genre_ids');
    params.delete('demographic_id');
    params.delete('format_id');
    params.delete('status_id');
    params.delete('sort');
  });
}

// eventos catalogo
sortSelect?.addEventListener('change', () => {
  const nextSort = sortSelect.value || 'relevance';
  updateUrlAndReload((params) => {
    if (nextSort === 'relevance') params.delete('sort');
    else params.set('sort', nextSort);
  });
});

clearInlineBtn?.addEventListener('click', clearAllFilters);

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
resetFiltersButton.addEventListener('click', clearModalFilters);
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
});
loadResults();
