import { apiRequest, clearAccessToken, getAccessToken } from '../shared/auth.js';
import { safeUrl } from '../shared/url-utils.js';
import { renderSiteHeader } from '../components/header.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const page = document.getElementById('library-page');
const summary = document.getElementById('library-summary');
const authPrompt = document.getElementById('library-auth-prompt');
const signInLink = authPrompt.querySelector('a[href*="login.html"]');
const signUpLink = authPrompt.querySelector('a[href*="registro.html"]');
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
    FOLLOWING: 'Siguiendo',
    READ_LATER: 'Leer después',
    FAVORITE: 'Favorito',
    COMPLETED: 'Completado',
    DROPPED: 'Pausado',
};

let libraryItems = [];
let activeFilter = 'ALL';

function makeWorkUrl(work) {
    if (!work.slug) return null;
    return `/pages/obra.html?slug=${encodeURIComponent(work.slug)}`;
}

function makeReaderUrl(work) {
    if (!work.slug || !work.first_chapter_id) return null;
    return `/pages/leer.html?slug=${encodeURIComponent(work.slug)}&chapter_id=${work.first_chapter_id}`;
}

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
    libraryItems.forEach((item) => { counts[item.library_status] += 1; });
    filters.querySelectorAll('[data-library-count]').forEach((element) => {
        element.textContent = String(counts[element.dataset.libraryCount] || 0);
    });

    if (libraryItems.length === 0) {
        summary.textContent = 'Todavía no has guardado obras.';
    } else {
        summary.textContent = `${libraryItems.length} ${libraryItems.length === 1 ? 'obra guardada' : 'obras guardadas'} para volver cuando quieras.`;
    }
}

function createCard(work) {
    const card = document.createElement('article');
    card.className = 'library-card';

    const cover = document.createElement('div');
    cover.className = 'library-card-cover';
    const coverUrl = safeUrl(work.cover_url, '');
    if (coverUrl) {
        const image = document.createElement('img');
        image.src = coverUrl;
        image.alt = `Portada de ${work.title}`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            cover.replaceChildren();
            cover.classList.add('library-card-cover-placeholder');
            cover.textContent = (work.title || '?').slice(0, 1).toLocaleUpperCase();
        }, { once: true });
        cover.append(image);
    } else {
        cover.classList.add('library-card-cover-placeholder');
        cover.textContent = (work.title || '?').slice(0, 1).toLocaleUpperCase();
        cover.setAttribute('aria-hidden', 'true');
    }
    card.append(cover);

    const body = document.createElement('div');
    body.className = 'library-card-body';

    const topLine = document.createElement('div');
    topLine.className = 'library-card-topline';
    const status = document.createElement('span');
    status.className = `library-status library-status-${work.library_status.toLowerCase()}`;
    status.textContent = STATUS_LABELS[work.library_status] || 'En biblioteca';
    topLine.append(status);

    const remove = document.createElement('button');
    remove.className = 'library-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Quitar ${work.title} de la biblioteca`);
    remove.title = 'Quitar de la biblioteca';
    const removeIcon = document.createElement('img');
    removeIcon.src = '/assets/icons/svg/x.svg';
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

    const cardFooter = document.createElement('div');
    cardFooter.className = 'library-card-footer';

    const statusLabel = document.createElement('label');
    statusLabel.className = 'library-status-label';
    const statusText = document.createElement('span');
    statusText.textContent = 'Estado';
    const statusSelect = document.createElement('select');
    statusSelect.className = 'library-status-select';
    statusSelect.setAttribute('aria-label', `Estado de ${work.title}`);
    Object.entries(STATUS_LABELS).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = value === work.library_status;
        statusSelect.append(option);
    });
    statusSelect.addEventListener('change', () => updateStatus(work, statusSelect));
    statusLabel.append(statusText, statusSelect);
    cardFooter.append(statusLabel);

    const readUrl = makeReaderUrl(work);
    if (readUrl) {
        const readLink = document.createElement('a');
        readLink.className = 'library-read-link';
        readLink.href = readUrl;
        readLink.textContent = 'Leer';
        cardFooter.append(readLink);
    }
    body.append(cardFooter);

    const preferences = document.createElement('label');
    preferences.className = 'library-notification-setting';
    const notify = document.createElement('input');
    notify.type = 'checkbox';
    notify.checked = Boolean(work.notify_new_chapters);
    notify.setAttribute('aria-label', `Avisarme de capítulos nuevos de ${work.title}`);
    notify.addEventListener('change', () => updateNotifications(work, notify));
    const notifyText = document.createElement('span');
    notifyText.textContent = 'Avisarme de capítulos nuevos';
    preferences.append(notify, notifyText);
    body.append(preferences);

    card.append(body);
    return card;
}

function renderLibrary() {
    updateCounts();
    const query = searchInput.value.trim().toLocaleLowerCase();
    const visibleItems = libraryItems
        .filter((item) => activeFilter === 'ALL' || item.library_status === activeFilter)
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
        emptyTitle.textContent = 'No hay obras en esta selección';
        emptyCopy.textContent = query
            ? 'Prueba con otro título, nombre alternativo o autor.'
            : 'Guarda una obra en este estado y aparecerá aquí.';
    }
}

function showSignedOut() {
    summary.textContent = 'Tu biblioteca personal, siempre a mano.';
    const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    signInLink.href = `/pages/login.html?next=${encodeURIComponent(returnPath)}`;
    signUpLink.href = `/pages/registro.html?next=${encodeURIComponent(returnPath)}`;
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
        setFeedback(`${work.title}: ${STATUS_LABELS[work.library_status].toLocaleLowerCase()}.`);
        renderLibrary();
    } catch (error) {
        select.value = previousStatus;
        select.disabled = false;
        setFeedback(error.message || 'No se pudo cambiar el estado.', true);
    }
}

async function updateNotifications(work, checkbox) {
    const previousValue = work.notify_new_chapters;
    checkbox.disabled = true;
    clearFeedback();
    try {
        const result = await apiRequest(`/library/${work.id}/notifications`, {
            method: 'PATCH',
            body: { notify_new_chapters: checkbox.checked },
        });
        work.notify_new_chapters = Boolean(result.notify_new_chapters);
        setFeedback(work.notify_new_chapters
            ? `Te avisaremos de los capítulos nuevos de ${work.title}.`
            : `Desactivaste los avisos de ${work.title}.`);
    } catch (error) {
        checkbox.checked = previousValue;
        setFeedback(error.message || 'No se pudo guardar la preferencia.', true);
    } finally {
        checkbox.disabled = false;
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
                        body: { status: 'FOLLOWING' },
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
                library_status: STATUS_LABELS[item.library_status]
                    ? item.library_status
                    : 'FOLLOWING',
            }))
            : [];
        content.hidden = false;
        renderLibrary();
    } catch (error) {
        if (error.status === 401 || error.status === 400) {
            clearAccessToken();
            showSignedOut();
        } else {
            errorMessage.textContent = error.message || 'Comprueba tu conexión e inténtalo de nuevo.';
            errorPanel.hidden = false;
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
