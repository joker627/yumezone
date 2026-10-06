import { API_BASE_URL } from '../api/api-config.js';
import { renderSiteHeader } from '../components/header.js';
import { safeUrl } from '../shared/url-utils.js';

const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const page = document.getElementById('work-detail');
const content = document.getElementById('work-content');
const errorPanel = document.getElementById('work-error');
const errorTitle = document.getElementById('work-error-title');
const errorCopy = document.getElementById('work-error-copy');
const retryButton = document.getElementById('work-retry');
const banner = document.getElementById('work-banner');
const cover = document.getElementById('work-cover');
const coverFallback = document.getElementById('work-cover-fallback');
const title = document.getElementById('work-title');
const alternativeTitle = document.getElementById('work-alternative-title');
const author = document.getElementById('work-author');
const genres = document.getElementById('work-genres');
const taxonomy = document.getElementById('work-taxonomy');
const stats = document.getElementById('work-stats');
const synopsis = document.getElementById('work-synopsis');
const startReading = document.getElementById('work-start-reading');
const chapterCount = document.getElementById('work-chapter-count');
const chapterList = document.getElementById('work-chapter-list');
const noChapters = document.getElementById('work-no-chapters');
const slug = new URLSearchParams(window.location.search).get('slug')?.trim();

function apiUrl(path) {
    return `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
}

async function fetchJson(path) {
    const response = await fetch(apiUrl(path), { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

function showError(message, notFound = false) {
    content.hidden = true;
    errorPanel.hidden = false;
    errorTitle.textContent = notFound ? 'No encontramos esta obra' : 'No pudimos cargar la obra';
    errorCopy.textContent = message;
    retryButton.hidden = notFound;
    page.setAttribute('aria-busy', 'false');
}

function setImage(image, value, fallback = null) {
    const url = safeUrl(value, '');
    image.onerror = () => {
        image.hidden = true;
        if (fallback) fallback.hidden = false;
    };
    if (!url) {
        image.removeAttribute('src');
        image.hidden = true;
        if (fallback) fallback.hidden = false;
        return;
    }
    image.src = url;
    image.hidden = false;
    if (fallback) fallback.hidden = true;
}

function formatNumber(value) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function formatChapterNumber(value) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function makeChapterUrl(work, chapter) {
    return `/pages/leer.html?slug=${encodeURIComponent(work.slug)}&chapter_id=${chapter.id}`;
}

function renderWork(work, filters, chapters) {
    document.title = `${work.title} | YumeZone`;
    title.textContent = work.title || 'Obra sin título';
    author.textContent = work.author ? `Por ${work.author}` : 'Autor no especificado';
    synopsis.textContent = work.synopsis || 'Esta obra todavía no tiene una sinopsis.';
    alternativeTitle.textContent = work.alternative_title || '';
    alternativeTitle.hidden = !work.alternative_title;
    coverFallback.textContent = Array.from((work.title || 'Y').trim())[0]?.toLocaleUpperCase() || 'Y';
    setImage(cover, work.cover_url, coverFallback);
    setImage(banner, work.banner_url);

    const labels = [
        ['format_id', filters.formats, 'Formato'],
        ['status_id', filters.statuses, 'Estado'],
        ['demographic_id', filters.demographics, 'Demografía'],
    ];
    taxonomy.replaceChildren();
    for (const [field, options, label] of labels) {
        const match = (options || []).find((option) => Number(option.id) === Number(work[field]));
        if (!match) continue;
        const badge = document.createElement('span');
        badge.textContent = `${label}: ${match.name}`;
        taxonomy.append(badge);
    }

    genres.replaceChildren();
    for (const genre of work.genres || []) {
        const badge = document.createElement('span');
        badge.className = 'work-detail-genre';
        badge.textContent = genre.name;
        genres.append(badge);
    }
    genres.hidden = genres.childElementCount === 0;

    stats.replaceChildren();
    const statValues = [
        ['Lecturas', formatNumber(work.total_views)],
        ['Valoración', Number(work.rating_average) > 0 ? formatNumber(work.rating_average) : 'Sin valorar'],
        ['Seguidores', formatNumber(work.followers_count)],
    ];
    for (const [label, value] of statValues) {
        const stat = document.createElement('span');
        stat.className = 'work-detail-stat';
        stat.textContent = `${label}: ${value}`;
        stats.append(stat);
    }

    const publishedChapters = (Array.isArray(chapters) ? chapters : [])
        .filter((chapter) => chapter.status === 'PUBLISHED')
        .sort((a, b) => Number(b.chapter_number) - Number(a.chapter_number));
    chapterCount.textContent = `${publishedChapters.length} ${publishedChapters.length === 1 ? 'capítulo' : 'capítulos'}`;
    chapterList.replaceChildren();
    noChapters.hidden = publishedChapters.length > 0;
    for (const chapter of publishedChapters) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'work-chapter-link';
        link.href = makeChapterUrl(work, chapter);
        const chapterTitle = document.createElement('strong');
        const label = `Capítulo ${formatChapterNumber(chapter.chapter_number)}`;
        chapterTitle.textContent = chapter.title ? `${label}: ${chapter.title}` : label;
        const publishedAt = document.createElement('span');
        publishedAt.textContent = chapter.published_at
            ? new Date(chapter.published_at).toLocaleDateString('es-CO')
            : 'Publicado';
        link.append(chapterTitle, publishedAt);
        item.append(link);
        chapterList.append(item);
    }

    if (publishedChapters.length) {
        const firstChapter = publishedChapters[publishedChapters.length - 1];
        startReading.href = makeChapterUrl(work, firstChapter);
        startReading.textContent = `Leer desde el capítulo ${formatChapterNumber(firstChapter.chapter_number)}`;
        startReading.hidden = false;
    } else {
        startReading.hidden = true;
    }

    errorPanel.hidden = true;
    content.hidden = false;
    page.setAttribute('aria-busy', 'false');
}

async function loadWork() {
    if (!slug) {
        showError('El enlace no incluye una obra. Vuelve al catálogo para elegir una.', true);
        return;
    }
    page.setAttribute('aria-busy', 'true');
    errorPanel.hidden = true;
    content.hidden = true;
    try {
        const work = await fetchJson(`/works/${encodeURIComponent(slug)}`);
        const [filters, chapters] = await Promise.all([
            fetchJson('/works/filters').catch(() => ({ formats: [], statuses: [], demographics: [] })),
            work.id ? fetchJson(`/chapters/work/${work.id}`).catch(() => []) : Promise.resolve([]),
        ]);
        renderWork(work, filters, chapters);
    } catch (error) {
        showError(
            error.status === 404
                ? 'La obra pudo haber sido retirada del catálogo.'
                : 'Revisa tu conexión e inténtalo de nuevo.',
            error.status === 404,
        );
    }
}

retryButton.addEventListener('click', loadWork);
loadWork();
