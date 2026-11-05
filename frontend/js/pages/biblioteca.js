import { apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, makeWorkUrl, makeReaderUrl } from '../shared/ui-utils.js';
import { renderLibrarySkeletons } from '../components/skeletons.js';

const loadingSection = document.getElementById('library-loading');
if (loadingSection && !loadingSection.children.length) {
    loadingSection.innerHTML = renderLibrarySkeletons(6);
    loadingSection.hidden = false;
}

const page = document.getElementById('library-page');
const summary = document.getElementById('library-summary');
const authPrompt = document.getElementById('library-auth-prompt');
const errorPanel = document.getElementById('library-error');
const errorMessage = document.getElementById('library-error-message');
const retryButton = document.getElementById('library-retry');
const content = document.getElementById('library-content');
const filters = document.getElementById('library-filters');
const searchInput = document.getElementById('library-search-input');
const sortSelect = document.getElementById('library-sort');
const feedback = document.getElementById('library-feedback');
const grid = document.getElementById('library-grid');
const emptyPanel = document.getElementById('library-empty');
const emptyTitle = document.getElementById('library-empty-title');
const emptyCopy = document.getElementById('library-empty-copy');

const STATUS_LABELS = {
    READING: 'Leyendo',
    COMPLETED: 'Completado',
    ON_HOLD: 'En espera',
    PLAN_TO_READ: 'Planeado',
    DROPPED: 'Abandonado',
};

const LEGACY_STATUS_MAP = {
    LIKED: 'READING',
    FOLLOWING: 'READING',
    FAVORITE: 'READING',
    READ_LATER: 'PLAN_TO_READ',
    PAUSED: 'ON_HOLD',
};

function normalizeStatus(rawStatus) {
    if (!rawStatus) return null;
    const upper = String(rawStatus).toUpperCase();
    const mapped = LEGACY_STATUS_MAP[upper] || upper;
    return STATUS_LABELS[mapped] ? mapped : null;
}

let libraryItems = [];
let activeFilter = 'ALL';

function setFeedback(text, isError = false) {
    feedback.textContent = text;
    feedback.dataset.kind = isError ? 'error' : 'success';
}

function clearFeedback() {
    feedback.textContent = '';
    delete feedback.dataset.kind;
}

function clearPendingAdd(params) {
    params.delete('add');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function updateCounts() {
    const counts = { ALL: libraryItems.length };
    Object.keys(STATUS_LABELS).forEach((status) => { counts[status] = 0; });
    libraryItems.forEach((item) => {
        if (item.library_status && counts[item.library_status] !== undefined) {
            counts[item.library_status] += 1;
        }
    });
    filters.querySelectorAll('[data-library-count]').forEach((element) => {
        element.textContent = String(counts[element.dataset.libraryCount] || 0);
    });

    if (libraryItems.length === 0) {
        summary.textContent = 'Todavía no has guardado obras.';
    } else {
        summary.textContent = `${libraryItems.length} ${libraryItems.length === 1 ? 'obra guardada' : 'obras guardadas'} en tu colección personal.`;
    }
}

function createCard(work) {
    const card = document.createElement('article');
    card.className = 'library-card';

    const cover = document.createElement('div');
    cover.className = 'library-card-cover';
    const image = document.createElement('img');
    image.src = safeUrl(work.cover_url, IMG_FALLBACK);
    image.alt = `Portada de ${work.title}`;
    image.loading = 'lazy';
    cover.append(image);
    card.append(cover);

    const body = document.createElement('div');
    body.className = 'library-card-body';

    const topLine = document.createElement('div');
    topLine.className = 'library-card-topline';

    const status = document.createElement('span');
    const validStatus = normalizeStatus(work.library_status) || 'READING';
    status.className = `library-status library-status-${validStatus.toLowerCase()}`;
    status.textContent = STATUS_LABELS[validStatus] || 'Leyendo';
    topLine.append(status);

    const remove = document.createElement('button');
    remove.className = 'library-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Quitar ${work.title} de la biblioteca`);
    remove.title = 'Quitar de la biblioteca';
    const removeIcon = document.createElement('img');
    removeIcon.src = '/assets/icons/svg/actions/x.svg';
    removeIcon.alt = '';
    removeIcon.setAttribute('aria-hidden', 'true');
    remove.append(removeIcon);
    remove.addEventListener('click', () => removeWork(work, remove));
    topLine.append(remove);
    body.append(topLine);

    const title = document.createElement('h2');
    const workUrl = makeWorkUrl(work);
    if (workUrl) {
        const link = document.createElement('a');
        link.href = workUrl;
        link.textContent = work.title;
        title.append(link);
    } else {
        title.textContent = work.title;
    }
    title.className = 'library-card-title';
    body.append(title);

    const details = [work.alternative_title, work.author]
        .filter((value, index, values) => value && values.indexOf(value) === index);
    if (details.length) {
        const meta = document.createElement('p');
        meta.className = 'library-card-meta';
        meta.textContent = details.join(' · ');
        body.append(meta);
    }

    if (work.reading_progress) {
        const prog = work.reading_progress;
        const progWrap = document.createElement('div');
        progWrap.className = 'library-progress-wrap';

        const progHeader = document.createElement('div');
        progHeader.className = 'library-progress-header';

        const chapSpan = document.createElement('span');
        chapSpan.className = 'library-progress-chapter';
        chapSpan.textContent = prog.chapter_text;

        const pagSpan = document.createElement('span');
        pagSpan.className = 'library-progress-pag';
        pagSpan.textContent = prog.page_text || (prog.total_chapters ? `${prog.read_chapters || 0}/${prog.total_chapters} leídos` : '');

        const pctSpan = document.createElement('span');
        pctSpan.className = 'library-progress-pct';
        pctSpan.textContent = `${prog.progress_pct || 0}%`;

        progHeader.append(chapSpan, pagSpan, pctSpan);

        const progBar = document.createElement('div');
        progBar.className = 'library-progress-bar';
        const progFill = document.createElement('div');
        progFill.className = 'library-progress-fill';
        progFill.style.width = `${Math.min(100, Math.max(0, prog.progress_pct))}%`;
        progBar.append(progFill);

        progWrap.append(progHeader, progBar);
        body.append(progWrap);
    }

    const cardFooter = document.createElement('div');
    cardFooter.className = 'library-card-footer';

    const statusLabel = document.createElement('label');
    statusLabel.className = 'library-status-label';
    const statusSelect = document.createElement('select');
    statusSelect.className = 'library-status-select';
    statusSelect.setAttribute('aria-label', `Estado de ${work.title}`);
    const currentStatus = normalizeStatus(work.library_status) || 'READING';
    Object.entries(STATUS_LABELS).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = value === currentStatus;
        statusSelect.append(option);
    });
    statusSelect.addEventListener('change', () => updateStatus(work, statusSelect));
    statusLabel.append(statusSelect);
    cardFooter.append(statusLabel);

    const readUrl = work.reading_progress?.reader_url || makeReaderUrl(work);
    if (readUrl) {
        const readLink = document.createElement('a');
        readLink.className = 'library-read-link' + (work.reading_progress ? ' library-read-link--resume' : '');
        readLink.href = readUrl;
        readLink.textContent = work.reading_progress ? 'Reanudar' : 'Leer';
        cardFooter.append(readLink);
    }
    body.append(cardFooter);

    card.append(body);
    return card;
}

function renderLibrary() {
    updateCounts();
    const query = searchInput.value.trim().toLocaleLowerCase();
    const visibleItems = libraryItems
        .filter((item) => {
            if (activeFilter === 'ALL') return true;
            return item.library_status === activeFilter;
        })
        .filter((item) => !query || [
            item.title,
            item.alternative_title,
            item.author,
            item.synopsis,
        ].some((value) => String(value || '').toLocaleLowerCase().includes(query)))
        .sort((a, b) => sortSelect.value === 'title'
            ? a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
            : new Date(b.added_at || 0) - new Date(a.added_at || 0));

    grid.replaceChildren(...visibleItems.map(createCard));
    grid.hidden = visibleItems.length === 0;
    emptyPanel.hidden = visibleItems.length > 0;

    if (libraryItems.length === 0) {
        emptyTitle.textContent = 'Tu biblioteca empieza aquí';
        emptyCopy.textContent = 'Explora el catálogo y guarda las obras que quieras seguir.';
    } else if (query || activeFilter !== 'ALL') {
        emptyTitle.textContent = 'No hay obras en esta sección';
        emptyCopy.textContent = query
            ? 'Prueba con otro título, nombre alternativo o autor.'
            : 'Cambia el estado de una obra o explora el catálogo para agregar más.';
    }
}

function showSignedOut() {
    summary.textContent = 'Tu biblioteca personal, siempre a mano.';
    if (loadingSection) loadingSection.hidden = true;
    authPrompt.hidden = false;
    errorPanel.hidden = true;
    content.hidden = true;
    page.setAttribute('aria-busy', 'false');
}

async function updateStatus(work, select) {
    const previousStatus = work.library_status;
    select.disabled = true;
    clearFeedback();
    try {
        await apiRequest(`/library/${work.id}`, {
            method: 'PATCH',
            body: { status: select.value },
        });
        work.library_status = select.value;
        work.notify_new_chapters = select.value !== 'DROPPED';
        setFeedback(`${work.title}: ${STATUS_LABELS[work.library_status]}.`);
        renderLibrary();
    } catch (error) {
        select.value = previousStatus;
        select.disabled = false;
        setFeedback(error.message || 'No se pudo cambiar el estado.', true);
    }
}

async function removeWork(work, button) {
    button.disabled = true;
    clearFeedback();
    try {
        await apiRequest(`/library/${work.id}`, { method: 'DELETE' });
        libraryItems = libraryItems.filter((item) => item.id !== work.id);
        setFeedback(`${work.title} se quitó de tu biblioteca.`);
        renderLibrary();
    } catch (error) {
        button.disabled = false;
        setFeedback(error.message || 'No se pudo quitar la obra.', true);
    }
}

async function loadLibrary() {
    page.setAttribute('aria-busy', 'true');
    authPrompt.hidden = true;
    errorPanel.hidden = true;
    content.hidden = true;
    if (loadingSection) loadingSection.hidden = false;
    clearFeedback();

    if (!getAccessToken()) {
        showSignedOut();
        return;
    }

    try {
        const params = new URLSearchParams(window.location.search);
        const pendingWorkId = params.get('add');
        if (pendingWorkId) {
            if (!/^\d+$/.test(pendingWorkId)) {
                clearPendingAdd(params);
            } else {
                try {
                    const addedWork = await apiRequest(`/library/${pendingWorkId}`, {
                        method: 'POST',
                        body: { status: 'READING' },
                    });
                    clearPendingAdd(params);
                    setFeedback(`${addedWork.title} ya está en tu biblioteca.`);
                } catch (error) {
                    if (error.status === 401 || error.status === 400) throw error;
                    clearPendingAdd(params);
                    setFeedback(error.message || 'No se pudo añadir la obra.', true);
                }
            }
        }

        const result = await apiRequest('/library/', { cache: 'no-store' });
        libraryItems = Array.isArray(result)
            ? result.map((item) => ({
                ...item,
                library_status: normalizeStatus(item.library_status),
            }))
            : [];

        const filterParam = (params.get('filter') || '').toUpperCase();
        const normalizedFilter = LEGACY_STATUS_MAP[filterParam] || filterParam;
        if (STATUS_LABELS[normalizedFilter]) {
            activeFilter = normalizedFilter;
        } else {
            activeFilter = 'ALL';
        }

        if (activeFilter !== 'ALL') {
            filters.querySelectorAll('[data-library-filter]').forEach((filter) => {
                const isActive = filter.dataset.libraryFilter === activeFilter;
                filter.classList.toggle('is-active', isActive);
                filter.setAttribute('aria-pressed', String(isActive));
            });
        }

        content.hidden = false;
        if (loadingSection) loadingSection.hidden = true;
        renderLibrary();
    } catch (error) {
        if (error.status === 401 || error.status === 400) {
            clearAccessToken();
            showSignedOut();
        } else {
            errorMessage.textContent = error.message || 'Comprueba tu conexión e inténtalo de nuevo.';
            errorPanel.hidden = false;
            if (loadingSection) loadingSection.hidden = true;
            summary.textContent = 'No se pudo actualizar tu biblioteca.';
        }
    } finally {
        page.setAttribute('aria-busy', 'false');
    }
}

filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-library-filter]');
    if (!button) return;
    activeFilter = button.dataset.libraryFilter;
    filters.querySelectorAll('[data-library-filter]').forEach((filter) => {
        const isActive = filter === button;
        filter.classList.toggle('is-active', isActive);
        filter.setAttribute('aria-pressed', String(isActive));
    });
    renderLibrary();
});

searchInput.addEventListener('input', renderLibrary);
sortSelect.addEventListener('change', renderLibrary);
retryButton.addEventListener('click', loadLibrary);

loadLibrary();

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        loadLibrary();
    }
});
