// frontend/js/pages/work-detail.js

import { renderSiteHeader } from '../components/header.js';
import { apiRequest, getAccessToken, clearAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, formatNumber, makeReaderUrl, formatTimeAgoCompact, escapeHTML } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';

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
const title = document.getElementById('work-title');
const alternativeTitle = document.getElementById('work-alternative-title');
const author = document.getElementById('work-author');
const genres = document.getElementById('work-genres');
const taxonomy = document.getElementById('work-taxonomy');
const stats = document.getElementById('work-stats');
const synopsis = document.getElementById('work-synopsis');
const startReading = document.getElementById('work-start-reading');
const libraryButton = document.getElementById('work-add-library');
const chapterCount = document.getElementById('work-chapter-count');
const readCountEl = document.getElementById('work-read-count');
const chaptersTable = document.getElementById('work-chapters-table');
const chapterList = document.getElementById('work-chapter-list');
const chaptersToolbar = document.getElementById('work-chapters-toolbar');
const chapterSearch = document.getElementById('work-chapter-search');
const chapterSearchClear = document.getElementById('work-chapter-search-clear');
const chapterRanges = document.getElementById('work-chapter-ranges');
const markAllBtn = document.getElementById('work-mark-all-btn');
const sortBtn = document.getElementById('work-sort-btn');
const sortLabel = document.getElementById('work-sort-label');
const noChapters = document.getElementById('work-no-chapters');

// Variables de comentarios
const commentsCountBadge = document.getElementById('work-comments-count');
const commentCurrentUserChip = document.getElementById('work-comment-current-user');
const commentSpoilerCheck = document.getElementById('work-comment-spoiler-check');
const commentInput = document.getElementById('work-comment-input');
const commentSubmitBtn = document.getElementById('work-comment-submit-btn');
const commentsList = document.getElementById('work-comments-list');

let allWorkComments = [];
let currentChapterSearchQuery = '';
let currentChapterRangeIndex = 0;
const CHAPTERS_PER_RANGE = 50;

// Variables de obra / capítulos
let allChapters = [];
let readChaptersSet = new Set();
let currentWork = null;
let latestReadChapterId = null;
let isSortAsc = false;

// Slug o ID de la obra tomado de la URL (/pages/obra.html?slug=... o ?id=...)
const urlParams = new URLSearchParams(window.location.search);
const slug = (urlParams.get('slug') || urlParams.get('id') || '').trim();

function getStorageKey(workId) {
    return `yz_read_chapters_${workId}`;
}

function loadLocalReadChapters(workId) {
    try {
        const raw = localStorage.getItem(getStorageKey(workId));
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return new Set(arr);
        }
    } catch { }
    return new Set();
}

function saveLocalReadChapters(workId, set) {
    try {
        localStorage.setItem(getStorageKey(workId), JSON.stringify(Array.from(set)));
    } catch { }
}

function updateReadCount() {
    if (!readCountEl) return;

    const count = allChapters.filter(c => readChaptersSet.has(c.id)).length;
    readCountEl.textContent = `${count} leídos`;

    if (markAllBtn) {
        const allRead = allChapters.length > 0 && count === allChapters.length;
        const span = markAllBtn.querySelector('span');
        if (span) span.textContent = allRead ? 'Desmarcar todos' : 'Marcar todos';
    }
}

function findLatestReadChapterId() {
    if (!readChaptersSet.size) return null;

    let highest = null;
    let highestNum = -1;

    for (const c of allChapters) {
        if (readChaptersSet.has(c.id)) {
            const num = Number(c.chapter_number) || 0;
            if (num > highestNum) {
                highestNum = num;
                highest = c.id;
            }
        }
    }

    return highest;
}

function setupChapterRanges() {
    if (!chapterRanges || !allChapters.length) return;

    chapterRanges.replaceChildren();
    const total = allChapters.length;

    // Si son menos de 30 capítulos, no hace falta dividir en rangos
    if (total <= 30) {
        chapterRanges.hidden = true;
        return;
    }

    chapterRanges.hidden = false;
    const totalRanges = Math.ceil(total / CHAPTERS_PER_RANGE);

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `work-chapter-range-chip${currentChapterRangeIndex === 0 ? ' is-active' : ''}`;
    allBtn.textContent = `Todos (${total})`;
    allBtn.addEventListener('click', () => {
        currentChapterRangeIndex = 0;
        setupChapterRanges();
        renderChapterRows();
    });
    chapterRanges.appendChild(allBtn);

    for (let i = 1; i <= totalRanges; i++) {
        const start = (i - 1) * CHAPTERS_PER_RANGE + 1;
        const end = Math.min(i * CHAPTERS_PER_RANGE, total);

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `work-chapter-range-chip${currentChapterRangeIndex === i ? ' is-active' : ''}`;
        chip.textContent = `${start}-${end}`;
        chip.addEventListener('click', () => {
            currentChapterRangeIndex = i;
            setupChapterRanges();
            renderChapterRows();
        });

        chapterRanges.appendChild(chip);
    }
}

function renderChapterRows() {
    if (!chapterList) return;

    chapterList.replaceChildren();
    let list = [...allChapters];

    // 1. Filtrar por búsqueda
    if (currentChapterSearchQuery) {
        const q = currentChapterSearchQuery.toLowerCase();
        list = list.filter(c => {
            const numStr = String(c.chapter_number || '');
            const titleStr = String(c.title || '').toLowerCase();
            return (
                numStr.includes(q) ||
                titleStr.includes(q) ||
                `capitulo ${numStr}`.includes(q) ||
                `cap. ${numStr}`.includes(q)
            );
        });
    }

    // 2. Ordenar según preferencia
    list.sort((a, b) => {
        const numA = Number(a.chapter_number) || 0;
        const numB = Number(b.chapter_number) || 0;
        return isSortAsc ? numA - numB : numB - numA;
    });

    if (sortLabel) {
        sortLabel.textContent = isSortAsc
            ? 'Capítulos (Primeros primero)'
            : 'Capítulos (Recientes primero)';
    }

    // 3. Filtrar por rango seleccionado
    if (!currentChapterSearchQuery && currentChapterRangeIndex > 0) {
        const startIdx = (currentChapterRangeIndex - 1) * CHAPTERS_PER_RANGE;
        const endIdx = startIdx + CHAPTERS_PER_RANGE;
        list = list.slice(startIdx, endIdx);
    }

    latestReadChapterId = findLatestReadChapterId();

    if (!list.length) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'work-detail-empty';
        emptyItem.style.padding = '1.5rem';
        emptyItem.style.textAlign = 'center';
        emptyItem.textContent = currentChapterSearchQuery
            ? `No se encontraron capítulos que coincidan con "${currentChapterSearchQuery}".`
            : 'No hay capítulos disponibles en este rango.';
        chapterList.append(emptyItem);
        return;
    }

    for (const chapter of list) {
        const isRead = readChaptersSet.has(chapter.id);
        const isCurrent = chapter.id === latestReadChapterId;
        const num = formatChapterNumber(chapter.chapter_number);
        const label = chapter.title ? `Cap. ${num}: ${chapter.title}` : `Cap. ${num}`;
        const timeAgo = formatTimeAgoCompact(chapter.published_at) || 'reciente';
        const fullDate = chapter.published_at
            ? new Date(chapter.published_at).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : '';

        const item = document.createElement('li');
        item.className = `work-chapter-row${isRead ? ' is-read' : ''}${isCurrent ? ' is-current' : ''}`;
        item.dataset.chapterId = chapter.id;

        const link = document.createElement('a');
        link.className = 'work-chapter-link';
        link.href = makeReaderUrl(currentWork?.slug, chapter.id);
        link.textContent = label;

        const actions = document.createElement('div');
        actions.className = 'work-chapter-actions';

        const dateSpan = document.createElement('span');
        dateSpan.className = 'work-chapter-date';
        dateSpan.title = fullDate;
        dateSpan.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${timeAgo}</span>
        `;

        const circleBtn = document.createElement('button');
        circleBtn.type = 'button';
        circleBtn.className = `work-chapter-circle-btn${isRead ? ' is-read' : ''}`;
        circleBtn.setAttribute('aria-label', isRead ? 'Marcar como no leído' : 'Marcar como leído');
        circleBtn.title = isRead
            ? 'Capítulo leído (clic para desmarcar)'
            : 'Marcar como leído';
        circleBtn.dataset.chapterId = chapter.id;

        circleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleChapterReadState(chapter.id, item, circleBtn);
        });

        actions.append(dateSpan, circleBtn);
        item.append(link, actions);
        chapterList.append(item);
    }

    updateReadCount();
    updateStartReadingBtn();
}

async function toggleChapterReadState(chapterId, rowEl, btnEl) {
    const isNowRead = !readChaptersSet.has(chapterId);

    if (isNowRead) {
        readChaptersSet.add(chapterId);
        btnEl?.classList.add('is-read');
        btnEl?.setAttribute('aria-label', 'Marcar como no leído');
        if (btnEl) btnEl.title = 'Capítulo leído (clic para desmarcar)';
        rowEl?.classList.add('is-read');
    } else {
        readChaptersSet.delete(chapterId);
        btnEl?.classList.remove('is-read');
        btnEl?.setAttribute('aria-label', 'Marcar como leído');
        if (btnEl) btnEl.title = 'Marcar como leído';
        rowEl?.classList.remove('is-read');
    }

    if (currentWork?.id) {
        saveLocalReadChapters(currentWork.id, readChaptersSet);
    }

    latestReadChapterId = findLatestReadChapterId();

    for (const li of chapterList.children) {
        const cId = Number(li.dataset.chapterId);
        if (cId === latestReadChapterId) {
            li.classList.add('is-current');
        } else {
            li.classList.remove('is-current');
        }
    }

    updateReadCount();
    updateStartReadingBtn();

    if (getAccessToken()) {
        try {
            await apiRequest(`/library/chapters/${chapterId}/read-toggle`, { method: 'POST' });
        } catch (err) {
            console.error('Error sincronizando estado de lectura con servidor:', err);
        }
    }

    showToast(
        isNowRead ? 'Capítulo marcado como leído' : 'Capítulo marcado como no leído',
        'info'
    );
}

// Marcar / Desmarcar todos los capítulos en lote
async function toggleMarkAllChapters() {
    if (!allChapters.length) return;

    const allAlreadyRead = allChapters.every(c => readChaptersSet.has(c.id));

    if (allAlreadyRead) {
        readChaptersSet.clear();
        showToast('Todos los capítulos marcados como no leídos', 'info');
    } else {
        allChapters.forEach(c => readChaptersSet.add(c.id));
        showToast(`¡Los ${allChapters.length} capítulos marcados como leídos!`, 'success');
    }

    if (currentWork?.id) {
        saveLocalReadChapters(currentWork.id, readChaptersSet);
    }

    renderChapterRows();

    if (getAccessToken()) {
        try {
            await apiRequest(`/library/works/${currentWork.id}/mark-all-read`, {
                method: 'POST',
                body: { read: !allAlreadyRead }
            }).catch(() => {});
        } catch { }
    }
}

// Búsqueda en vivo de capítulos
if (chapterSearch) {
    chapterSearch.addEventListener('input', (e) => {
        currentChapterSearchQuery = e.target.value.trim();

        if (chapterSearchClear) {
            chapterSearchClear.hidden = !currentChapterSearchQuery;
        }

        renderChapterRows();
    });
}

if (chapterSearchClear) {
    chapterSearchClear.addEventListener('click', () => {
        chapterSearch.value = '';
        currentChapterSearchQuery = '';
        chapterSearchClear.hidden = true;
        chapterSearch.focus();
        renderChapterRows();
    });
}

if (markAllBtn) {
    markAllBtn.addEventListener('click', toggleMarkAllChapters);
}

function updateStartReadingBtn() {
    if (!startReading || !allChapters.length) return;

    const sortedAsc = [...allChapters].sort(
        (a, b) => (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0)
    );

    const nextUnread = sortedAsc.find(c => !readChaptersSet.has(c.id));

    if (nextUnread) {
        startReading.href = makeReaderUrl(currentWork?.slug, nextUnread.id);
        startReading.textContent = `Leer Cap. ${formatChapterNumber(nextUnread.chapter_number)}`;
    } else {
        const first = sortedAsc[0];
        startReading.href = makeReaderUrl(currentWork?.slug, first.id);
        startReading.textContent = `Releer Cap. ${formatChapterNumber(first.chapter_number)}`;
    }
}

if (sortBtn) {
    sortBtn.addEventListener('click', () => {
        isSortAsc = !isSortAsc;
        const arrow = sortBtn.querySelector('.sort-icon-arrow');
        if (arrow) arrow.classList.toggle('is-asc', isSortAsc);
        renderChapterRows();
    });
}

function showError(message, notFound = false) {
    content.hidden = true;
    errorPanel.hidden = false;
    errorTitle.textContent = notFound ? 'No encontramos esta obra' : 'No pudimos cargar la obra';
    errorCopy.textContent = message;
    retryButton.hidden = notFound;
    page.setAttribute('aria-busy', 'false');
}

function setImage(image, value) {
    image.src = safeUrl(value, IMG_FALLBACK);
    image.hidden = false;
}

function formatChapterNumber(value) {
    return formatNumber(value, 2);
}

function updateWorkSEO(work) {
    if (!work || !work.title) return;

    const pageTitle = `${work.title} - Leer Manga Online Gratis en Español | YumeZone`;
    document.title = pageTitle;

    const cleanSynopsis = (work.synopsis || '').replace(/\s+/g, ' ').trim();
    const metaDesc = cleanSynopsis
        ? (cleanSynopsis.length > 155 ? cleanSynopsis.slice(0, 152) + '...' : cleanSynopsis)
        : `Lee todos los capítulos de ${work.title} online en español gratis y en alta resolución en YumeZone.`;

    const workSlug = work.slug || slug;
    const workUrl = `https://yumezone.page/pages/obra.html?slug=${encodeURIComponent(workSlug)}`;
    const imageUrl = work.cover_url || work.banner_url || 'https://yumezone.page/assets/icons/logo.png';

    // Meta Description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.name = 'description';
        document.head.appendChild(descMeta);
    }
    descMeta.content = metaDesc;

    // Meta Keywords
    const genreNames = (work.genres || []).map(g => g.name).join(', ');
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
        keywordsMeta.content = `${work.title}, ${work.alternative_title || ''}, leer ${work.title} español, ${genreNames}, ${work.format_name || 'manga'}, manhwa español, yumezone`.replace(/,\s*,/g, ',');
    }

    // Canonical
    const canonical = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = workUrl;

    // Open Graph
    const ogTitle = document.getElementById('og-title') || document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${work.title} | YumeZone`;

    const ogDesc = document.getElementById('og-desc') || document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = metaDesc;

    const ogUrl = document.getElementById('og-url') || document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = workUrl;

    const ogImage = document.getElementById('og-image') || document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = imageUrl;

    // Twitter
    const twTitle = document.getElementById('tw-title') || document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.content = `${work.title} | YumeZone`;

    const twDesc = document.getElementById('tw-desc') || document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.content = metaDesc;

    const twImage = document.getElementById('tw-image') || document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.content = imageUrl;

    // Schema.org JSON-LD Structured Data
    try {
        let script = document.getElementById('work-schema-jsonld');
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'work-schema-jsonld';
            document.head.appendChild(script);
        }

        const schemaData = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Inicio",
                            "item": "https://yumezone.page/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Catálogo",
                            "item": "https://yumezone.page/pages/catalogo.html"
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": work.title,
                            "item": workUrl
                        }
                    ]
                },
                {
                    "@type": "ComicSeries",
                    "@id": `${workUrl}#comic`,
                    "name": work.title,
                    "alternateName": work.alternative_title || undefined,
                    "description": cleanSynopsis || undefined,
                    "url": workUrl,
                    "image": imageUrl,
                    "inLanguage": "es",
                    "author": work.author ? {
                        "@type": "Person",
                        "name": work.author
                    } : undefined,
                    "genre": (work.genres || []).map(g => g.name),
                    "publisher": {
                        "@type": "Organization",
                        "name": "YumeZone",
                        "url": "https://yumezone.page/"
                    },
                    "aggregateRating": Number(work.rating_average) > 0 ? {
                        "@type": "AggregateRating",
                        "ratingValue": Number(work.rating_average).toFixed(1),
                        "bestRating": "10",
                        "worstRating": "1",
                        "ratingCount": Math.max(Number(work.followers_count) || 1, 1)
                    } : undefined
                }
            ]
        };

        script.textContent = JSON.stringify(schemaData);
    } catch (e) {
        console.warn('Error al generar Schema JSON-LD para SEO:', e);
    }
}

async function renderWork(work, chapters) {
    currentWork = work;
    updateWorkSEO(work);

    title.textContent = work.title || 'Obra sin título';
    author.textContent = work.author ? `Por ${work.author}` : 'Autor no especificado';
    synopsis.textContent = work.synopsis || 'Esta obra todavía no tiene una sinopsis.';
    alternativeTitle.textContent = work.alternative_title || '';
    alternativeTitle.hidden = !work.alternative_title;

    setImage(cover, work.cover_url);
    setImage(banner, work.banner_url);

    // Taxonomía
    taxonomy.replaceChildren();

    const taxonomyItems = [
        ['Formato', work.format_name],
        ['Estado', work.status_name],
        ['Demografía', work.demographic_name],
    ];

    for (const [label, val] of taxonomyItems) {
        if (!val) continue;
        const badge = document.createElement('span');
        badge.textContent = `${label}: ${val}`;
        taxonomy.append(badge);
    }

    // Géneros
    genres.replaceChildren();

    for (const genre of work.genres || []) {
        const badge = document.createElement('span');
        badge.className = 'work-detail-genre';
        badge.textContent = genre.name;
        genres.append(badge);
    }

    genres.hidden = genres.childElementCount === 0;

    // Métricas
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

    // Capítulos
    allChapters = Array.isArray(chapters) ? chapters : [];
    chapterCount.textContent = `${allChapters.length} ${allChapters.length === 1 ? 'capítulo' : 'capítulos'}`;

    const hasChapters = allChapters.length > 0;
    if (noChapters) noChapters.hidden = hasChapters;
    if (chaptersTable) chaptersTable.hidden = !hasChapters;
    if (chaptersToolbar) chaptersToolbar.hidden = !hasChapters;

    // Cargar capítulos leídos
    readChaptersSet = loadLocalReadChapters(work.id);

    if (getAccessToken() && work.id) {
        try {
            const serverReads = await apiRequest(`/library/works/${work.id}/read-chapters`);
            if (Array.isArray(serverReads)) {
                for (const id of serverReads) readChaptersSet.add(Number(id));
                saveLocalReadChapters(work.id, readChaptersSet);
            }
        } catch (e) {
            console.warn('No se pudieron obtener capítulos leídos del servidor:', e);
        }
    }

    setupChapterRanges();
    renderChapterRows();

    if (hasChapters) {
        startReading.hidden = false;
        updateStartReadingBtn();
    } else {
        startReading.hidden = true;
    }

    if (work.id) {
        setupLibraryButton(work);
        loadWorkComments(work.id);
        setupCommentForm(work.id);
    }

    errorPanel.hidden = true;
    content.hidden = false;
    page.setAttribute('aria-busy', 'false');
}

/* ==========================================================
   SISTEMA DE COMENTARIOS PERMANENTES EN HILO
   ========================================================== */

function setupCommentForm(workId) {
    if (!commentSubmitBtn || !commentInput) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (commentCurrentUserChip) {
        commentCurrentUserChip.textContent = user.username
            ? `Comentando como @${user.username}`
            : 'Inicia sesión para comentar';
    }

    const newSubmit = commentSubmitBtn.cloneNode(true);
    commentSubmitBtn.parentNode.replaceChild(newSubmit, commentSubmitBtn);

    newSubmit.addEventListener('click', async () => {
        const text = commentInput.value.trim();

        if (!text) {
            showToast('Escribe un comentario antes de publicar', 'warning');
            return;
        }

        if (!getAccessToken()) {
            showToast('Debes iniciar sesión para dejar un comentario', 'warning');
            return;
        }

        newSubmit.disabled = true;
        const originalText = newSubmit.innerHTML;
        newSubmit.textContent = 'Publicando...';

        try {
            await apiRequest('/comments/', {
                method: 'POST',
                body: {
                    work_id: workId,
                    content: text,
                    contains_spoiler: Boolean(commentSpoilerCheck?.checked),
                }
            });

            commentInput.value = '';
            if (commentSpoilerCheck) commentSpoilerCheck.checked = false;

            showToast('¡Comentario publicado con éxito!', 'success');
            await loadWorkComments(workId);
        } catch (err) {
            showToast(err.message || 'Error al publicar el comentario', 'error');
        } finally {
            newSubmit.disabled = false;
            newSubmit.innerHTML = originalText;
        }
    });
}

async function loadWorkComments(workId) {
    if (!commentsList) return;

    try {
        commentsList.setAttribute('aria-busy', 'true');

        const res = await apiRequest(`/comments/?work_id=${workId}&limit=100`);
        const data = res?.data || [];
        allWorkComments = Array.isArray(data) ? data : [];

        if (commentsCountBadge) {
            commentsCountBadge.textContent = `${allWorkComments.length} ${
                allWorkComments.length === 1 ? 'comentario' : 'comentarios'
            }`;
        }

        renderCommentThreads(allWorkComments);
    } catch (err) {
        console.error('Error cargando comentarios:', err);
        commentsList.innerHTML = `<p class="comment-empty-state">No se pudieron cargar los comentarios.</p>`;
    } finally {
        commentsList.setAttribute('aria-busy', 'false');
    }
}

function renderCommentThreads(comments) {
    if (!commentsList) return;

    commentsList.replaceChildren();

    if (!comments.length) {
        commentsList.innerHTML = `
            <div class="comment-empty-state">
                <p>Aún no hay comentarios sobre esta obra.</p>
                <p style="font-size:0.75rem;margin-top:0.25rem;">¡Sé el primero en compartir tu opinión o teoría!</p>
            </div>`;
        return;
    }

    const roots = comments.filter(c => !c.parent_id);
    const repliesMap = new Map();

    comments.forEach(c => {
        if (c.parent_id) {
            if (!repliesMap.has(c.parent_id)) repliesMap.set(c.parent_id, []);
            repliesMap.get(c.parent_id).push(c);
        }
    });

    roots.forEach(rootComment => {
        const threadCard = document.createElement('article');
        threadCard.className = 'comment-thread';
        threadCard.dataset.commentId = rootComment.id;

        const replies = repliesMap.get(rootComment.id) || [];
        threadCard.innerHTML = renderCommentMainMarkup(rootComment);

        if (replies.length > 0) {
            const repliesWrap = document.createElement('div');
            repliesWrap.className = 'comment-replies-wrap';

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'comment-toggle-replies-btn';
            toggleBtn.innerHTML = `<span>💬 Ver ${replies.length} ${
                replies.length === 1 ? 'respuesta' : 'respuestas'
            }</span>`;

            const repliesListEl = document.createElement('div');
            repliesListEl.className = 'comment-replies-list';
            repliesListEl.hidden = false;

            replies.forEach(reply => {
                const replyEl = document.createElement('div');
                replyEl.className = 'comment-reply-item';
                replyEl.innerHTML = renderCommentReplyMarkup(reply);
                attachCommentItemListeners(replyEl, reply);
                repliesListEl.appendChild(replyEl);
            });

            toggleBtn.addEventListener('click', () => {
                repliesListEl.hidden = !repliesListEl.hidden;
                toggleBtn.querySelector('span').textContent = repliesListEl.hidden
                    ? `💬 Ver ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}`
                    : `▲ Ocultar respuestas`;
            });

            repliesWrap.appendChild(toggleBtn);
            repliesWrap.appendChild(repliesListEl);
            threadCard.appendChild(repliesWrap);
        }

        attachCommentItemListeners(threadCard, rootComment);
        commentsList.appendChild(threadCard);
    });
}

function renderCommentMainMarkup(c) {
    const username = c.username || 'Lector';
    const safeUsername = escapeHTML(username);
    const safeContent = escapeHTML(c.content || '');
    const initial = (username[0] || 'U').toUpperCase();
    const avatar = (c.avatar_url || '').trim();
    const anilloUrl = (c.anillo_url || c.avatar_frame_url || '').trim();
    const timeAgo = formatTimeAgoCompact(c.created_at) || 'reciente';
    const isSpoiler = Boolean(c.contains_spoiler);
    const likes = Number(c.likes || 0);

    const avatarMarkup = avatar
        ? `<img class="comment-avatar-img" src="${safeUrl(avatar, IMG_FALLBACK)}" alt="${safeUsername}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="comment-avatar-fallback" style="display:none;">${initial}</div>`
        : `<div class="comment-avatar-fallback">${initial}</div>`;

    const frameMarkup = anilloUrl
        ? `<img class="comment-avatar-frame" src="${safeUrl(anilloUrl, '')}" alt="" aria-hidden="true">`
        : '';

    return `
        <div class="comment-main">
            <div class="comment-avatar-col">
                <div class="comment-avatar-wrap">
                    <div class="comment-avatar-inner">${avatarMarkup}</div>
                    ${frameMarkup}
                </div>
            </div>
            <div class="comment-body-col">
                <div class="comment-meta-row">
                    <span class="comment-author-name">@${safeUsername}</span>
                    <span class="comment-time">${timeAgo}</span>
                    ${isSpoiler ? `<span class="comment-spoiler-tag">⚠️ Spoiler</span>` : ''}
                </div>
                <p class="comment-text ${isSpoiler ? 'is-spoiler-blurred' : ''}" data-text="${safeContent}">
                    ${isSpoiler ? '🙈 Contenido marcado con spoiler. Haz clic aquí para revelarlo.' : safeContent}
                </p>
                <div class="comment-actions-row">
                    <button type="button" class="comment-action-btn like-btn" data-action="like" title="Me gusta">
                        <img src="/assets/icons/svg/thumbs-up.svg" width="13" height="13" alt="" aria-hidden="true">
                        <span class="like-counter">${likes > 0 ? likes : 'Útil'}</span>
                    </button>
                    <button type="button" class="comment-action-btn reply-btn" data-action="reply" title="Responder">
                        <img src="/assets/icons/svg/reply.svg" width="13" height="13" alt="" aria-hidden="true">
                        <span>Responder</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCommentReplyMarkup(r) {
    const username = r.username || 'Lector';
    const safeUsername = escapeHTML(username);
    const safeContent = escapeHTML(r.content || '');
    const initial = (username[0] || 'U').toUpperCase();
    const avatar = (r.avatar_url || '').trim();
    const anilloUrl = (r.anillo_url || r.avatar_frame_url || '').trim();
    const timeAgo = formatTimeAgoCompact(r.created_at) || 'reciente';
    const isSpoiler = Boolean(r.contains_spoiler);
    const likes = Number(r.likes || 0);

    const avatarMarkup = avatar
        ? `<img class="comment-reply-avatar" src="${safeUrl(avatar, IMG_FALLBACK)}" alt="${safeUsername}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="comment-reply-avatar-fallback" style="display:none;">${initial}</div>`
        : `<div class="comment-reply-avatar-fallback">${initial}</div>`;

    const frameMarkup = anilloUrl
        ? `<img class="comment-reply-avatar-frame" src="${safeUrl(anilloUrl, '')}" alt="" aria-hidden="true">`
        : '';

    return `
        <div class="comment-reply-avatar-wrap">
            <div class="comment-reply-avatar-inner">${avatarMarkup}</div>
            ${frameMarkup}
        </div>
        <div class="comment-body-col">
            <div class="comment-meta-row">
                <span class="comment-author-name">@${safeUsername}</span>
                <span class="comment-time">${timeAgo}</span>
                ${isSpoiler ? `<span class="comment-spoiler-tag">⚠️ Spoiler</span>` : ''}
            </div>
            <p class="comment-text ${isSpoiler ? 'is-spoiler-blurred' : ''}" data-text="${safeContent}">
                ${isSpoiler ? '🙈 Contenido con spoiler. Clic para ver.' : safeContent}
            </p>
            <div class="comment-actions-row">
                <button type="button" class="comment-action-btn like-btn" data-action="like">
                    <img src="/assets/icons/svg/thumbs-up.svg" width="12" height="12" alt="" aria-hidden="true">
                    <span class="like-counter">${likes > 0 ? likes : ''}</span>
                </button>
                <button type="button" class="comment-action-btn reply-btn" data-action="reply">
                    <span>Responder</span>
                </button>
            </div>
        </div>
    `;
}

function attachCommentItemListeners(containerEl, commentObj) {
    // Revelar spoiler
    const spoilerEl = containerEl.querySelector('.comment-text.is-spoiler-blurred');
    if (spoilerEl) {
        spoilerEl.addEventListener('click', () => {
            spoilerEl.classList.remove('is-spoiler-blurred');
            spoilerEl.textContent = spoilerEl.dataset.text;
        });
    }

    // Botón Me Gusta
    const likeBtn = containerEl.querySelector('.comment-action-btn.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!getAccessToken()) {
                showToast('Inicia sesión para dar Me Gusta', 'warning');
                return;
            }

            likeBtn.classList.toggle('is-active');
            const counter = likeBtn.querySelector('.like-counter');
            let val = parseInt(counter.textContent) || 0;

            if (likeBtn.classList.contains('is-active')) {
                counter.textContent = String(val + 1);
            } else {
                counter.textContent = val > 1 ? String(val - 1) : '';
            }

            try {
                await apiRequest(`/comments/${commentObj.id}/reaction`, {
                    method: 'PUT',
                    body: { reaction: 'LIKE' }
                });
            } catch (e) {
                console.error('Error reaccionando:', e);
            }
        });
    }

    // Botón Responder
    const replyBtn = containerEl.querySelector('.comment-action-btn.reply-btn');
    if (replyBtn) {
        replyBtn.addEventListener('click', () => {
            if (!getAccessToken()) {
                showToast('Inicia sesión para responder a este comentario', 'warning');
                return;
            }

            const existingBox = containerEl.querySelector('.comment-inline-reply-box');
            if (existingBox) {
                existingBox.remove();
                return;
            }

            document.querySelectorAll('.comment-inline-reply-box').forEach(b => b.remove());

            const replyBox = document.createElement('div');
            replyBox.className = 'comment-inline-reply-box';
            replyBox.innerHTML = `
                <textarea rows="2" placeholder="Responde a @${commentObj.username}..." maxlength="2000"></textarea>
                <div class="comment-inline-reply-actions">
                    <button type="button" class="comment-inline-reply-cancel">Cancelar</button>
                    <button type="button" class="comment-inline-reply-send">Responder</button>
                </div>
            `;

            const cancelBtn = replyBox.querySelector('.comment-inline-reply-cancel');
            const sendBtn = replyBox.querySelector('.comment-inline-reply-send');
            const textarea = replyBox.querySelector('textarea');

            cancelBtn.addEventListener('click', () => replyBox.remove());

            sendBtn.addEventListener('click', async () => {
                const text = textarea.value.trim();
                if (!text) return;

                sendBtn.disabled = true;
                sendBtn.textContent = 'Enviando...';

                try {
                    await apiRequest('/comments/', {
                        method: 'POST',
                        body: {
                            work_id: currentWork.id,
                            parent_id: commentObj.parent_id || commentObj.id,
                            content: text,
                            contains_spoiler: false,
                        }
                    });

                    showToast('Respuesta enviada', 'success');
                    replyBox.remove();
                    await loadWorkComments(currentWork.id);
                } catch (err) {
                    showToast(err.message || 'Error al responder', 'error');
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Responder';
                }
            });

            containerEl.appendChild(replyBox);
            textarea.focus();
        });
    }
}

async function setupLibraryButton(work) {
    if (!libraryButton) return;

    libraryButton.hidden = false;
    let isAdded = false;
    let isProcessing = false;

    const updateButtonUI = () => {
        if (isAdded) {
            libraryButton.classList.add('is-added');
            libraryButton.textContent = 'En biblioteca';
        } else {
            libraryButton.classList.remove('is-added');
            libraryButton.textContent = 'Añadir a biblioteca';
        }
    };

    if (getAccessToken()) {
        try {
            const res = await apiRequest(`/library/${work.id}`);
            isAdded = Boolean(res?.in_library);
            updateButtonUI();
        } catch (e) {
            console.error('Error al verificar biblioteca:', e);
        }
    }

    const newBtn = libraryButton.cloneNode(true);
    libraryButton.parentNode.replaceChild(newBtn, libraryButton);

    newBtn.addEventListener('click', async () => {
        if (isProcessing) return;

        if (!getAccessToken()) {
            const returnUrl = `/pages/biblioteca.html?add=${encodeURIComponent(work.id)}`;
            window.location.assign(`/pages/login.html?next=${encodeURIComponent(returnUrl)}`);
            return;
        }

        isProcessing = true;
        newBtn.textContent = 'Guardando…';

        try {
            if (isAdded) {
                await apiRequest(`/library/${work.id}`, { method: 'DELETE' });
                isAdded = false;
                showToast('Obra retirada de tu biblioteca', 'info');
            } else {
                await apiRequest(`/library/${work.id}`, {
                    method: 'POST',
                    body: { status: 'FOLLOWING' }
                });
                isAdded = true;
                showToast('Obra añadida a tu biblioteca', 'success');
            }

            window.dispatchEvent(new CustomEvent('auth:profile-updated', {
                detail: { action: 'library' }
            }));
        } catch (e) {
            if (e.status === 401 || e.status === 400) {
                clearAccessToken();
                const returnUrl = `/pages/biblioteca.html?add=${encodeURIComponent(work.id)}`;
                window.location.assign(`/pages/login.html?next=${encodeURIComponent(returnUrl)}`);
                return;
            }

            showToast(e.message || 'No se pudo actualizar la biblioteca.', 'error');
        } finally {
            isProcessing = false;

            if (isAdded) {
                newBtn.classList.add('is-added');
                newBtn.textContent = 'En biblioteca';
            } else {
                newBtn.classList.remove('is-added');
                newBtn.textContent = 'Añadir a biblioteca';
            }
        }
    });
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
        const work = await apiRequest(`/works/${encodeURIComponent(slug)}`);
        const chapters = work.id
            ? await apiRequest(`/chapters/work/${work.id}?published_only=true&order=desc`).catch(() => [])
            : [];

        renderWork(work, chapters);

        if (work.id) {
            apiRequest('/metrics/views', {
                method: 'POST',
                body: { work_id: work.id }
            }).catch(err => console.error('Error registrando vista:', err));
        }
    } catch (error) {
        showError(
            error.status === 404
                ? 'La obra pudo haber sido retirada del catálogo.'
                : 'Revisa tu conexión e inténtalo de nuevo.',
            error.status === 404
        );
    }
}

retryButton?.addEventListener('click', loadWork);
loadWork();