

import { apiRequest, getAccessToken, clearAccessToken } from '../shared/auth.js';
import { safeUrl, IMG_FALLBACK, formatNumber, formatViews, formatChapterNumber, makeReaderUrl, formatTimeAgoCompact, escapeHTML } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import { renderCommentSkeletons, renderWorkDetailSkeleton } from '../components/skeletons.js';
import { openWorkRatingModal } from '../components/rating-modal.js';

const page = document.getElementById('work-detail');
const content = document.getElementById('work-content');
const workSkeleton = document.getElementById('work-skeleton');
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
const synopsis = document.getElementById('work-synopsis');
const startReading = document.getElementById('work-start-reading');
const libraryButton = document.getElementById('work-add-library');
const chapterCount = document.getElementById('work-chapter-count');
const chaptersTable = document.getElementById('work-chapters-table');
const chapterList = document.getElementById('work-chapter-list');
const chaptersToolbar = document.getElementById('work-chapters-toolbar');
const chapterSearch = document.getElementById('work-chapter-search');
const chapterSearchClear = document.getElementById('work-chapter-search-clear');
const markAllBtn = document.getElementById('work-mark-all-btn');
const sortBtn = document.getElementById('work-sort-btn');
const sortLabel = document.getElementById('work-sort-label');
const noChapters = document.getElementById('work-no-chapters');

// variables de comentarios
const commentsCountBadge = document.getElementById('work-comments-count');
const commentSpoilerCheck = document.getElementById('work-comment-spoiler-check');
const commentInput = document.getElementById('work-comment-input');
const commentSubmitBtn = document.getElementById('work-comment-submit-btn');
const commentsList = document.getElementById('work-comments-list');

let allWorkComments = [];
let currentChapterSearchQuery = '';
let currentAuthUser = null;

async function fetchCurrentUser() {
    if (!getAccessToken()) {
        currentAuthUser = null;
        return null;
    }
    if (currentAuthUser) return currentAuthUser;
    try {
        currentAuthUser = await apiRequest('/auth/me');
        return currentAuthUser;
    } catch {
        currentAuthUser = null;
        return null;
    }
}

// variables de obra / capítulos
let allChapters = [];
let readChaptersSet = new Set();
let currentWork = null;
let latestReadChapterId = null;
let isSortAsc = false;

// obtener obra id
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
    const count = allChapters.filter(c => readChaptersSet.has(c.id)).length;

    if (markAllBtn) {
        const allRead = allChapters.length > 0 && count === allChapters.length;
        const span = markAllBtn.querySelector('span');
        if (span) span.textContent = allRead ? 'Desmarcar leídos' : 'Marcar leídos';
    }

    updateUserReadingProgress();
}

function updateUserReadingProgress() {
    const total = allChapters.length;
    const read = allChapters.filter(c => readChaptersSet.has(c.id)).length;
    const pct = total ? Math.round((read / total) * 100) : 0;

    const progressPct = document.getElementById('work-user-progress-pct');
    if (progressPct) {
        progressPct.textContent = `${pct}% completado`;
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

function renderChapterRows() {
    if (!chapterList) return;

    chapterList.replaceChildren();
    let list = [...allChapters];

    // filtrar por búsqueda
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

    // ordenar según preferencia
    list.sort((a, b) => {
        const numA = Number(a.chapter_number) || 0;
        const numB = Number(b.chapter_number) || 0;
        return isSortAsc ? numA - numB : numB - numA;
    });

    latestReadChapterId = findLatestReadChapterId();

    if (!list.length) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'work-detail-empty work-detail-empty--padded';
        emptyItem.textContent = currentChapterSearchQuery
            ? `No se encontraron capítulos que coincidan con "${currentChapterSearchQuery}".`
            : 'No hay capítulos disponibles.';
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
        link.href = makeReaderUrl(currentWork?.slug, chapter);
        link.textContent = label;

        const actions = document.createElement('div');
        actions.className = 'work-chapter-actions';

        const dateSpan = document.createElement('span');
        dateSpan.className = 'work-chapter-date';
        dateSpan.title = fullDate;
        dateSpan.innerHTML = `
            <img src="/assets/icons/svg/navigation/history.svg" width="13" height="13" alt="" aria-hidden="true">
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

}

// marcar todos
async function toggleMarkAllChapters() {
    if (!allChapters.length) return;

    const allAlreadyRead = allChapters.every(c => readChaptersSet.has(c.id));

    if (allAlreadyRead) {
        readChaptersSet.clear();
    } else {
        allChapters.forEach(c => readChaptersSet.add(c.id));
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

// buscar capitulo
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

    const hasReadAny = readChaptersSet.size > 0;
    const nextUnread = sortedAsc.find(c => !readChaptersSet.has(c.id));
    const startReadingText = document.getElementById('work-start-reading-text');

    let label = '';
    let targetChapter = null;

    if (!hasReadAny) {
        // Nunca ha leído ningún capítulo: Empezar desde el primero
        targetChapter = sortedAsc[0];
        label = `Leer capítulo ${formatChapterNumber(targetChapter.chapter_number)}`;
    } else if (nextUnread) {
        // Ya leyó capítulos y le falta el siguiente: Continuar por donde va
        targetChapter = nextUnread;
        label = `Continuar capítulo ${formatChapterNumber(nextUnread.chapter_number)}`;
    } else {
        // Ha leído TODOS los capítulos publicados (está 100% al día)
        targetChapter = sortedAsc[sortedAsc.length - 1] || sortedAsc[0];
        label = 'Al día';
    }

    if (targetChapter) {
        startReading.href = makeReaderUrl(currentWork?.slug, targetChapter);
    }

    if (startReadingText) {
        startReadingText.textContent = label;
    } else {
        startReading.textContent = label;
    }
}

if (sortBtn) {
    sortBtn.addEventListener('click', () => {
        isSortAsc = !isSortAsc;
        const icon = sortBtn.querySelector('.work-sort-icon');
        const label = document.getElementById('work-sort-label');
        if (icon) icon.textContent = isSortAsc ? '🔺' : '🔻';
        if (label) label.textContent = isSortAsc ? 'Primeros' : 'Nuevos';
        sortBtn.title = isSortAsc ? 'Orden: Primeros capítulos primero' : 'Orden: Últimos capítulos primero';
        renderChapterRows();
    });
}

function showError(message, notFound = false) {
    if (workSkeleton) workSkeleton.hidden = true;
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

    // meta description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.name = 'description';
        document.head.appendChild(descMeta);
    }
    descMeta.content = metaDesc;

    // meta keywords
    const genreNames = (work.genres || []).map(g => g.name).join(', ');
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
        keywordsMeta.content = `${work.title}, ${work.alternative_title || ''}, leer ${work.title} español, ${genreNames}, ${work.format_name || 'manga'}, manhwa español, yumezone`.replace(/,\s*,/g, ',');
    }

    // canonical
    const canonical = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = workUrl;

    // open graph
    const ogTitle = document.getElementById('og-title') || document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${work.title} | YumeZone`;

    const ogDesc = document.getElementById('og-desc') || document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = metaDesc;

    const ogUrl = document.getElementById('og-url') || document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = workUrl;

    const ogImage = document.getElementById('og-image') || document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = imageUrl;

    // twitter
    const twTitle = document.getElementById('tw-title') || document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.content = `${work.title} | YumeZone`;

    const twDesc = document.getElementById('tw-desc') || document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.content = metaDesc;

    const twImage = document.getElementById('tw-image') || document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.content = imageUrl;

    // schema.org json-ld structured data
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
                        "ratingCount": Math.max(Number(work.rating_count || work.favorites_count) || 1, 1)
                    } : undefined
                }
            ]
        };

        script.textContent = JSON.stringify(schemaData);
    } catch (e) {
        console.warn('Error al generar Schema JSON-LD para SEO:', e);
    }
}

async function renderWork(work, chapters, userState = null, libraryStats = null) {
    currentWork = work;
    updateWorkSEO(work);

    title.textContent = work.title || 'Obra sin título';
    if (author) author.textContent = work.author ? `Por ${work.author}` : 'Autor no especificado';
    if (synopsis) synopsis.textContent = work.synopsis || 'Esta obra todavía no tiene una sinopsis.';

    const altWrap = document.getElementById('work-alt-wrap');
    if (altWrap) {
        altWrap.hidden = !work.alternative_title;
        if (alternativeTitle) alternativeTitle.textContent = work.alternative_title || '';
    }

    const copyTitleBtn = document.getElementById('work-copy-title-btn');
    if (copyTitleBtn && work.alternative_title) {
        copyTitleBtn.onclick = () => {
            navigator.clipboard.writeText(work.alternative_title);
            showToast('Título alternativo copiado al portapapeles', 'info');
        };
    }

    const scanEl = document.getElementById('work-scan-group');
    const scanDot = document.getElementById('work-scan-dot');
    if (scanEl && work.scan_group_name) {
        const scanSlug = work.scan_group_slug || work.scan_group_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        scanEl.innerHTML = `<a href="/pages/scans.html?slug=${encodeURIComponent(scanSlug)}" style="color:inherit;text-decoration:underline;text-underline-offset:3px;" title="Ver perfil del Scan ${escapeHtml(work.scan_group_name)}">${escapeHtml(work.scan_group_name)}</a>`;
        scanEl.hidden = false;
        if (scanDot) scanDot.hidden = false;
    } else if (scanEl) {
        scanEl.hidden = true;
        if (scanDot) scanDot.hidden = true;
    }

    const coverFormat = document.getElementById('work-cover-format');
    if (coverFormat) coverFormat.textContent = (work.format_name || 'MANGA').toUpperCase();

    const coverStatus = document.getElementById('work-cover-status');
    if (coverStatus) {
        const isCompleted = (work.status_name || '').toLowerCase().includes('finaliz') || (work.status_name || '').toLowerCase().includes('complet');
        coverStatus.textContent = isCompleted ? 'FINALIZADO' : (work.status_name || 'EN EMISIÓN').toUpperCase();
        coverStatus.classList.toggle('is-completed', isCompleted);
    }

    setImage(cover, work.cover_url);
    setImage(banner, work.banner_url);

    // géneros
    genres.replaceChildren();

    for (const genre of work.genres || []) {
        const badge = document.createElement('span');
        badge.className = 'work-detail-genre';
        badge.textContent = genre.name;
        genres.append(badge);
    }

    genres.hidden = genres.childElementCount === 0;

    renderCommunityStats(libraryStats);

    // capítulos
    allChapters = Array.isArray(chapters) ? chapters : [];
    const chapterCountEl = document.getElementById('work-chapter-count');
    if (chapterCountEl) chapterCountEl.textContent = String(allChapters.length);

    const hasChapters = allChapters.length > 0;
    if (noChapters) noChapters.hidden = hasChapters;
    if (chaptersTable) chaptersTable.hidden = !hasChapters;
    if (chaptersToolbar) chaptersToolbar.hidden = !hasChapters;

    // capítulos leídos
    readChaptersSet = loadLocalReadChapters(work.id);

    if (userState?.read_chapter_ids && Array.isArray(userState.read_chapter_ids)) {
        for (const id of userState.read_chapter_ids) readChaptersSet.add(Number(id));
        saveLocalReadChapters(work.id, readChaptersSet);
    } else if (getAccessToken() && work.id) {
        apiRequest(`/library/works/${work.id}/read-chapters`).then(serverReads => {
            if (Array.isArray(serverReads)) {
                for (const id of serverReads) readChaptersSet.add(Number(id));
                saveLocalReadChapters(work.id, readChaptersSet);
                updateReadCount();
                updateStartReadingBtn();
                renderChapterRows();
            }
        }).catch(() => {});
    }

    renderChapterRows();
    updateReadCount();

    if (hasChapters) {
        startReading.hidden = false;
        updateStartReadingBtn();
    } else {
        startReading.hidden = true;
    }

    if (work.id) {
        setupLibraryDropdown(work, userState);
        setupHeroRating(work, userState);
        loadWorkComments(work.id);
        setupCommentForm(work.id);
        loadRecommendedWorks();
    }

    const shareBtn = document.getElementById('work-share-btn');
    if (shareBtn) {
        shareBtn.onclick = async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: work.title,
                        url: window.location.href
                    });
                } catch {}
            } else {
                navigator.clipboard.writeText(window.location.href);
                showToast('Enlace de la obra copiado al portapapeles', 'info');
            }
        };
    }

    if (workSkeleton) workSkeleton.hidden = true;
    errorPanel.hidden = true;
    content.hidden = false;
    page.setAttribute('aria-busy', 'false');
}

// comentarios

function setupCommentForm(workId) {
    if (!commentSubmitBtn || !commentInput) return;

    const newSubmit = commentSubmitBtn.cloneNode(true);
    commentSubmitBtn.parentNode.replaceChild(newSubmit, commentSubmitBtn);

    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            newSubmit.click();
        }
    });

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
        commentsList.innerHTML = renderCommentSkeletons(3);

        const [res] = await Promise.all([
            apiRequest(`/comments/?work_id=${workId}&limit=100`),
            fetchCurrentUser().catch(() => null)
        ]);
        const data = res?.data || [];
        allWorkComments = Array.isArray(data) ? data : [];

        if (commentsCountBadge) {
            commentsCountBadge.textContent = String(allWorkComments.length);
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
                <p class="comment-empty-hint">¡Sé el primero en compartir tu opinión o teoría!</p>
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
        // Orden cronológico (más antiguo a más nuevo) para que el hilo de respuestas se lea con sentido natural
        replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        threadCard.innerHTML = renderCommentMainMarkup(rootComment);

        if (replies.length > 0) {
            const repliesWrap = document.createElement('div');
            repliesWrap.className = 'comment-replies-wrap';

            // Máximo 2 respuestas visibles inicialmente (evita alargamiento excesivo)
            const previewReplies = replies.slice(0, 2);
            const remainingReplies = replies.slice(2);

            previewReplies.forEach(reply => {
                const replyEl = document.createElement('div');
                replyEl.className = 'comment-reply-item';
                replyEl.innerHTML = renderCommentReplyMarkup(reply);
                attachCommentItemListeners(replyEl, reply);
                repliesWrap.appendChild(replyEl);
            });

            if (remainingReplies.length > 0) {
                const remainingContainer = document.createElement('div');
                remainingContainer.className = 'comment-replies-list';
                remainingContainer.hidden = true;

                remainingReplies.forEach(reply => {
                    const replyEl = document.createElement('div');
                    replyEl.className = 'comment-reply-item';
                    replyEl.innerHTML = renderCommentReplyMarkup(reply);
                    attachCommentItemListeners(replyEl, reply);
                    remainingContainer.appendChild(replyEl);
                });

                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'comment-toggle-replies-btn';
                toggleBtn.innerHTML = `<span>💬 Ver ${remainingReplies.length} ${
                    remainingReplies.length === 1 ? 'respuesta más' : 'respuestas más'
                } ▾</span>`;

                toggleBtn.addEventListener('click', () => {
                    remainingContainer.hidden = !remainingContainer.hidden;
                    toggleBtn.querySelector('span').textContent = remainingContainer.hidden
                        ? `💬 Ver ${remainingReplies.length} ${
                            remainingReplies.length === 1 ? 'respuesta más' : 'respuestas más'
                        } ▾`
                        : `▲ Ocultar respuestas`;
                });

                repliesWrap.appendChild(remainingContainer);
                repliesWrap.appendChild(toggleBtn);
            }

            threadCard.appendChild(repliesWrap);
        }

        attachCommentItemListeners(threadCard, rootComment);
        commentsList.appendChild(threadCard);
    });
}

function isCommentEdited(c) {
    if (!c || !c.updated_at || !c.created_at) return false;
    const createdTime = new Date(c.created_at).getTime();
    const updatedTime = new Date(c.updated_at).getTime();
    return !isNaN(createdTime) && !isNaN(updatedTime) && (updatedTime - createdTime > 3000);
}

function formatEditedTimeText(dateStr) {
    if (!dateStr) return 'editado';
    const ago = formatTimeAgoCompact(dateStr);
    if (!ago || ago === 'ahora') return 'editado hace un momento';
    return `editado hace ${ago}`;
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
    const isLiked = Number(c.user_liked) === 1;
    const isEdited = isCommentEdited(c);
    const editedText = isEdited ? formatEditedTimeText(c.updated_at) : '';
    const isOwn = Boolean(
        currentAuthUser && (
            (c.user_id && currentAuthUser.id === c.user_id) ||
            (c.username && currentAuthUser.username && c.username.toLowerCase() === currentAuthUser.username.toLowerCase()) ||
            (currentAuthUser.platform_role && ['ADMIN', 'SUPERADMIN'].includes(currentAuthUser.platform_role.toUpperCase()))
        )
    );

    const avatarMarkup = avatar
        ? `<img class="comment-avatar-img" src="${safeUrl(avatar, IMG_FALLBACK)}" alt="${safeUsername}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');"><div class="comment-avatar-fallback hidden">${initial}</div>`
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
                    ${isEdited ? `<span class="comment-edited-tag" title="Editado el ${new Date(c.updated_at).toLocaleString('es-CO')}">(${escapeHTML(editedText)})</span>` : ''}
                    ${isSpoiler ? `<span class="comment-spoiler-tag">⚠️ Spoiler</span>` : ''}
                </div>
                <p class="comment-text ${isSpoiler ? 'is-spoiler-blurred' : ''}" data-text="${safeContent}">
                    ${isSpoiler ? '🙈 Contenido marcado con spoiler. Haz clic aquí para revelarlo.' : safeContent}
                </p>
                <div class="comment-actions-row">
                    <button type="button" class="comment-action-btn like-btn ${isLiked ? 'is-active' : ''}" data-action="like" title="Me gusta">
                        <img src="/assets/icons/svg/actions/thumbs-up.svg" width="13" height="13" alt="" aria-hidden="true">
                        <span class="like-counter">${likes > 0 ? likes : ''}</span>
                    </button>
                    <button type="button" class="comment-action-btn reply-btn" data-action="reply" title="Responder">
                        <img src="/assets/icons/svg/actions/reply.svg" width="13" height="13" alt="" aria-hidden="true">
                        <span>Responder</span>
                    </button>
                    ${isOwn ? `
                    <button type="button" class="comment-action-btn edit-btn" data-action="edit" title="Editar comentario">
                        <img src="/assets/icons/svg/actions/edit.svg" width="12" height="12" alt="" aria-hidden="true">
                        <span>Editar</span>
                    </button>
                    <button type="button" class="comment-action-btn delete-btn" data-action="delete" title="Eliminar comentario">
                        <img src="/assets/icons/svg/actions/trash.svg" width="12" height="12" alt="" aria-hidden="true">
                        <span>Eliminar</span>
                    </button>
                    ` : ''}
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
    const isLiked = Number(r.user_liked) === 1;
    const isEdited = isCommentEdited(r);
    const editedText = isEdited ? formatEditedTimeText(r.updated_at) : '';
    const replyTo = (r.reply_to_username || '').trim();
    const replyToMarkup = replyTo
        ? `<span class="comment-replying-to"><span class="comment-reply-arrow">↳</span> respondiendo a <strong class="comment-replying-tag">@${escapeHTML(replyTo)}</strong></span>`
        : '';
    const isOwn = Boolean(
        currentAuthUser && (
            (r.user_id && currentAuthUser.id === r.user_id) ||
            (r.username && currentAuthUser.username && r.username.toLowerCase() === currentAuthUser.username.toLowerCase()) ||
            (currentAuthUser.platform_role && ['ADMIN', 'SUPERADMIN'].includes(currentAuthUser.platform_role.toUpperCase()))
        )
    );

    const avatarMarkup = avatar
        ? `<img class="comment-reply-avatar" src="${safeUrl(avatar, IMG_FALLBACK)}" alt="${safeUsername}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden');"><div class="comment-reply-avatar-fallback hidden">${initial}</div>`
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
                ${replyToMarkup}
                <span class="comment-time">${timeAgo}</span>
                ${isEdited ? `<span class="comment-edited-tag" title="Editado el ${new Date(r.updated_at).toLocaleString('es-CO')}">(${escapeHTML(editedText)})</span>` : ''}
                ${isSpoiler ? `<span class="comment-spoiler-tag">⚠️ Spoiler</span>` : ''}
            </div>
            <p class="comment-text ${isSpoiler ? 'is-spoiler-blurred' : ''}" data-text="${safeContent}">
                ${isSpoiler ? '🙈 Contenido con spoiler. Clic para ver.' : safeContent}
            </p>
            <div class="comment-actions-row">
                <button type="button" class="comment-action-btn like-btn ${isLiked ? 'is-active' : ''}" data-action="like">
                    <img src="/assets/icons/svg/actions/thumbs-up.svg" width="12" height="12" alt="" aria-hidden="true">
                    <span class="like-counter">${likes > 0 ? likes : ''}</span>
                </button>
                <button type="button" class="comment-action-btn reply-btn" data-action="reply">
                    <span>Responder</span>
                </button>
                ${isOwn ? `
                <button type="button" class="comment-action-btn edit-btn" data-action="edit" title="Editar respuesta">
                    <img src="/assets/icons/svg/actions/edit.svg" width="11" height="11" alt="" aria-hidden="true">
                    <span>Editar</span>
                </button>
                <button type="button" class="comment-action-btn delete-btn" data-action="delete" title="Eliminar respuesta">
                    <img src="/assets/icons/svg/actions/trash.svg" width="11" height="11" alt="" aria-hidden="true">
                    <span>Eliminar</span>
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

function attachCommentItemListeners(containerEl, commentObj) {
    // revelar spoiler
    const spoilerEl = containerEl.querySelector('.comment-text.is-spoiler-blurred');
    if (spoilerEl) {
        spoilerEl.addEventListener('click', () => {
            spoilerEl.classList.remove('is-spoiler-blurred');
            spoilerEl.textContent = spoilerEl.dataset.text;
        });
    }

    // botón me gusta toggle sincronizado
    const likeBtn = containerEl.querySelector('.comment-action-btn.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!getAccessToken()) {
                showToast('Inicia sesión para dar Me Gusta', 'warning');
                return;
            }

            likeBtn.disabled = true;
            try {
                const res = await apiRequest(`/comments/${commentObj.id}/reaction`, {
                    method: 'PUT',
                    body: { reaction: 'LIKE' }
                });
                const counter = likeBtn.querySelector('.like-counter');
                if (res && res.action === 'ADDED') {
                    likeBtn.classList.add('is-active');
                    commentObj.user_liked = 1;
                } else if (res && res.action === 'REMOVED') {
                    likeBtn.classList.remove('is-active');
                    commentObj.user_liked = 0;
                } else {
                    likeBtn.classList.toggle('is-active');
                }
                const newLikes = (res && typeof res.likes === 'number') ? res.likes : (commentObj.likes || 0);
                commentObj.likes = newLikes;
                if (counter) {
                    counter.textContent = newLikes > 0 ? String(newLikes) : '';
                }
            } catch (e) {
                console.error('Error reaccionando:', e);
                showToast('No se pudo registrar tu reacción', 'error');
            } finally {
                likeBtn.disabled = false;
            }
        });
    }

    // botón responder con destinatario reply_to_username
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
                <textarea rows="2" placeholder="Responde a @${escapeHTML(commentObj.username)}... (Ctrl+Enter para enviar)" maxlength="2000"></textarea>
                <div class="comment-inline-reply-footer">
                    <label class="comment-inline-spoiler-toggle" title="Marcar respuesta como spoiler">
                        <input type="checkbox" class="comment-inline-spoiler-check">
                        <span>⚠️ Spoiler</span>
                    </label>
                    <div class="comment-inline-reply-actions">
                        <button type="button" class="comment-inline-reply-cancel">Cancelar</button>
                        <button type="button" class="comment-inline-reply-send">Responder</button>
                    </div>
                </div>
            `;

            const cancelBtn = replyBox.querySelector('.comment-inline-reply-cancel');
            const sendBtn = replyBox.querySelector('.comment-inline-reply-send');
            const textarea = replyBox.querySelector('textarea');
            const spoilerCheck = replyBox.querySelector('.comment-inline-spoiler-check');

            cancelBtn.addEventListener('click', () => replyBox.remove());

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendBtn.click();
                }
            });

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
                            reply_to_username: commentObj.username || null,
                            content: text,
                            contains_spoiler: Boolean(spoilerCheck && spoilerCheck.checked),
                        }
                    });

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

    // botón editar comentario
    const editBtn = containerEl.querySelector('.comment-action-btn.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const bodyCol = containerEl.querySelector('.comment-body-col');
            const textEl = containerEl.querySelector('.comment-text');
            const actionsRow = containerEl.querySelector('.comment-actions-row');
            if (!bodyCol || !textEl) return;

            const existingEdit = bodyCol.querySelector('.comment-inline-edit-box');
            if (existingEdit) {
                existingEdit.remove();
                textEl.hidden = false;
                if (actionsRow) actionsRow.hidden = false;
                return;
            }

            textEl.hidden = true;
            if (actionsRow) actionsRow.hidden = true;

            const editBox = document.createElement('div');
            editBox.className = 'comment-inline-edit-box';
            editBox.innerHTML = `
                <textarea class="comment-edit-textarea" rows="2" maxlength="3000">${escapeHTML(commentObj.content || '')}</textarea>
                <div class="comment-inline-edit-actions">
                    <button type="button" class="comment-edit-cancel-btn">Cancelar</button>
                    <button type="button" class="comment-edit-save-btn">Guardar</button>
                </div>
            `;

            const cancelBtn = editBox.querySelector('.comment-edit-cancel-btn');
            const saveBtn = editBox.querySelector('.comment-edit-save-btn');
            const textarea = editBox.querySelector('.comment-edit-textarea');

            cancelBtn.addEventListener('click', () => {
                editBox.remove();
                textEl.hidden = false;
                if (actionsRow) actionsRow.hidden = false;
            });

            saveBtn.addEventListener('click', async () => {
                const newText = textarea.value.trim();
                if (!newText) {
                    showToast('El comentario no puede estar vacío', 'warning');
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando...';

                try {
                    await apiRequest(`/comments/${commentObj.id}`, {
                        method: 'PATCH',
                        body: {
                            content: newText,
                            contains_spoiler: Boolean(commentObj.contains_spoiler)
                        }
                    });

                    commentObj.content = newText;
                    commentObj.updated_at = new Date().toISOString();
                    textEl.textContent = newText;
                    textEl.dataset.text = newText;
                    editBox.remove();
                    textEl.hidden = false;
                    if (actionsRow) actionsRow.hidden = false;

                    const metaRow = bodyCol.querySelector('.comment-meta-row');
                    if (metaRow) {
                        let editedTag = metaRow.querySelector('.comment-edited-tag');
                        if (!editedTag) {
                            editedTag = document.createElement('span');
                            editedTag.className = 'comment-edited-tag';
                            metaRow.appendChild(editedTag);
                        }
                        editedTag.textContent = '(editado hace un momento)';
                        editedTag.title = `Editado el ${new Date().toLocaleString('es-CO')}`;
                    }
                } catch (err) {
                    showToast(err.message || 'Error al editar comentario', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar';
                }
            });

            bodyCol.insertBefore(editBox, actionsRow);
            textarea.focus();
        });
    }

    // botón eliminar comentario (con confirmación inline sin window.confirm nativo)
    const deleteBtn = containerEl.querySelector('.comment-action-btn.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (deleteBtn.dataset.confirming !== 'true') {
                deleteBtn.dataset.confirming = 'true';
                const originalHtml = deleteBtn.innerHTML;
                deleteBtn.textContent = '¿Confirmar borrar?';
                deleteBtn.style.color = '#fb7185';
                setTimeout(() => {
                    if (deleteBtn.isConnected && deleteBtn.dataset.confirming === 'true') {
                        deleteBtn.dataset.confirming = 'false';
                        deleteBtn.innerHTML = originalHtml;
                        deleteBtn.style.color = '';
                    }
                }, 4000);
                return;
            }

            deleteBtn.disabled = true;
            try {
                await apiRequest(`/comments/${commentObj.id}`, {
                    method: 'DELETE'
                });
                await loadWorkComments(currentWork.id);
            } catch (err) {
                showToast(err.message || 'Error al eliminar comentario', 'error');
                deleteBtn.disabled = false;
                deleteBtn.dataset.confirming = 'false';
            }
        });
    }
}

const WORK_STATUS_CONFIG = {
    READING: { label: 'Leyendo', icon: '📖' },
    PLAN_TO_READ: { label: 'Planeado', icon: '📅' },
    COMPLETED: { label: 'Completado', icon: '✅' },
    ON_HOLD: { label: 'En espera', icon: '⏸' },
    DROPPED: { label: 'Abandonado', icon: '❌' },
};

const LEGACY_STATUS_MAP = {
    LIKED: 'READING',
    FOLLOWING: 'READING',
    FAVORITE: 'READING',
    READ_LATER: 'PLAN_TO_READ',
    PAUSED: 'ON_HOLD',
};

let currentCommunityStats = {
    reading: 0,
    plan_to_read: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
    total: 0
};

function statusToStatKey(status) {
    if (!status) return null;
    const lower = String(status).toLowerCase();
    if (lower === 'reading') return 'reading';
    if (lower === 'plan_to_read') return 'plan_to_read';
    if (lower === 'completed') return 'completed';
    if (lower === 'on_hold') return 'on_hold';
    if (lower === 'dropped') return 'dropped';
    return null;
}

function renderCommunityStats(libraryStats = null) {
    if (libraryStats) {
        currentCommunityStats = {
            reading: Number(libraryStats.reading) || 0,
            plan_to_read: Number(libraryStats.plan_to_read) || 0,
            completed: Number(libraryStats.completed) || 0,
            on_hold: Number(libraryStats.on_hold) || 0,
            dropped: Number(libraryStats.dropped) || 0,
            total: Number(libraryStats.total) || 0
        };
    }

    const readingEl = document.getElementById('work-stat-reading');
    const planEl = document.getElementById('work-stat-plan');
    const completedEl = document.getElementById('work-stat-completed');
    const onholdEl = document.getElementById('work-stat-onhold');
    const droppedEl = document.getElementById('work-stat-dropped');

    if (readingEl) readingEl.textContent = formatNumber(currentCommunityStats.reading);
    if (planEl) planEl.textContent = formatNumber(currentCommunityStats.plan_to_read);
    if (completedEl) completedEl.textContent = formatNumber(currentCommunityStats.completed);
    if (onholdEl) onholdEl.textContent = formatNumber(currentCommunityStats.on_hold);
    if (droppedEl) droppedEl.textContent = formatNumber(currentCommunityStats.dropped);
}

function setupLibraryDropdown(work, userState = null) {
    const wrap = document.getElementById('work-library-wrap');
    const libBtn = document.getElementById('work-add-library');
    const libIcon = document.getElementById('work-library-icon');
    const libText = document.getElementById('work-library-text');
    const menu = document.getElementById('work-library-menu');
    const divider = document.getElementById('work-library-menu-divider');
    const removeBtn = document.getElementById('work-library-remove-btn');
    if (!libBtn || !menu) return;

    libBtn.hidden = false;

    let rawStatus = userState?.status || userState?.library_status || null;
    if (rawStatus) rawStatus = LEGACY_STATUS_MAP[rawStatus] || rawStatus;
    let inLibrary = Boolean(userState?.in_library || rawStatus);
    let currentStatus = inLibrary && rawStatus && WORK_STATUS_CONFIG[rawStatus] ? rawStatus : (inLibrary ? 'READING' : null);
    let isProcessing = false;

    function updateUI() {
        if (inLibrary && currentStatus && WORK_STATUS_CONFIG[currentStatus]) {
            libBtn.classList.add('is-added');
            if (libIcon) libIcon.textContent = WORK_STATUS_CONFIG[currentStatus].icon;
            if (libText) libText.textContent = WORK_STATUS_CONFIG[currentStatus].label;
            if (divider) divider.hidden = false;
            if (removeBtn) removeBtn.hidden = false;
        } else {
            libBtn.classList.remove('is-added');
            if (libIcon) libIcon.textContent = '➕';
            if (libText) libText.textContent = 'Añadir a biblioteca';
            if (divider) divider.hidden = true;
            if (removeBtn) removeBtn.hidden = true;
        }

        menu.querySelectorAll('.work-library-option[data-status]').forEach(btn => {
            btn.classList.toggle('is-current', btn.dataset.status === currentStatus);
        });
    }

    updateUI();

    if (userState === null && getAccessToken() && work.id) {
        apiRequest(`/library/${work.id}`).then(res => {
            if (res?.in_library && res?.status) {
                const norm = LEGACY_STATUS_MAP[res.status] || res.status;
                if (WORK_STATUS_CONFIG[norm]) {
                    inLibrary = true;
                    currentStatus = norm;
                    updateUI();
                }
            }
        }).catch(() => {});
    }

    function toggleMenu(show = null) {
        const isOpen = show !== null ? show : menu.hidden;
        menu.hidden = !isOpen;
        if (wrap) wrap.classList.toggle('is-open', isOpen);
        libBtn.setAttribute('aria-expanded', String(isOpen));
    }

    libBtn.onclick = (e) => {
        e.stopPropagation();
        if (!getAccessToken()) {
            const returnUrl = `/pages/obra.html?slug=${encodeURIComponent(work.slug || slug)}`;
            window.location.assign(`/pages/login.html?next=${encodeURIComponent(returnUrl)}`);
            return;
        }
        toggleMenu();
    };

    document.addEventListener('click', (e) => {
        if (!wrap?.contains(e.target)) {
            toggleMenu(false);
        }
    });

    menu.querySelectorAll('.work-library-option[data-status]').forEach(option => {
        option.onclick = async (e) => {
            e.stopPropagation();
            if (isProcessing) return;
            const targetStatus = option.dataset.status;
            if (!WORK_STATUS_CONFIG[targetStatus]) return;

            toggleMenu(false);
            isProcessing = true;
            const prevStatus = currentStatus;
            const prevInLib = inLibrary;

            currentStatus = targetStatus;
            inLibrary = true;
            updateUI();

            const prevKey = prevInLib ? statusToStatKey(prevStatus) : null;
            const nextKey = statusToStatKey(targetStatus);
            if (prevKey && currentCommunityStats[prevKey] > 0) {
                currentCommunityStats[prevKey] = Math.max(0, currentCommunityStats[prevKey] - 1);
            }
            if (nextKey) {
                currentCommunityStats[nextKey] = (currentCommunityStats[nextKey] || 0) + 1;
            }
            renderCommunityStats();

            try {
                await apiRequest(`/library/${work.id}`, {
                    method: 'POST',
                    body: { status: targetStatus },
                });
                window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { action: 'library' } }));
            } catch (err) {
                if (nextKey && currentCommunityStats[nextKey] > 0) {
                    currentCommunityStats[nextKey] = Math.max(0, currentCommunityStats[nextKey] - 1);
                }
                if (prevKey) {
                    currentCommunityStats[prevKey] = (currentCommunityStats[prevKey] || 0) + 1;
                }
                renderCommunityStats();
                currentStatus = prevStatus;
                inLibrary = prevInLib;
                updateUI();
                showToast(err.message || 'No se pudo guardar el estado en biblioteca.', 'error');
            } finally {
                isProcessing = false;
            }
        };
    });

    if (removeBtn) {
        removeBtn.onclick = async (e) => {
            e.stopPropagation();
            if (isProcessing) return;

            toggleMenu(false);
            isProcessing = true;
            const prevStatus = currentStatus;
            const prevInLib = inLibrary;

            currentStatus = null;
            inLibrary = false;
            updateUI();

            const prevKey = prevInLib ? statusToStatKey(prevStatus) : null;
            if (prevKey && currentCommunityStats[prevKey] > 0) {
                currentCommunityStats[prevKey] = Math.max(0, currentCommunityStats[prevKey] - 1);
            }
            renderCommunityStats();

            try {
                await apiRequest(`/library/${work.id}`, { method: 'DELETE' });
                window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: { action: 'library' } }));
            } catch (err) {
                if (prevKey) {
                    currentCommunityStats[prevKey] = (currentCommunityStats[prevKey] || 0) + 1;
                }
                renderCommunityStats();
                currentStatus = prevStatus;
                inLibrary = prevInLib;
                updateUI();
                showToast(err.message || 'No se pudo quitar la obra.', 'error');
            } finally {
                isProcessing = false;
            }
        };
    }
}

function setupHeroRating(work, userState = null) {
    const avgEl = document.getElementById('work-hero-rating-avg');
    const countEl = document.getElementById('work-hero-rating-count');
    const rateBtn = document.getElementById('work-hero-rate-btn');
    const rateText = document.getElementById('work-hero-rate-btn-text');
    const viewsEl = document.getElementById('work-hero-views-text');

    if (viewsEl && work.total_views != null) {
        viewsEl.textContent = `${formatViews(work.total_views)} lecturas`;
    }

    let userRating = userState?.user_rating ?? null;

    const updateUI = () => {
        const avg = Number(work.rating_average) || 0;
        const count = Number(work.rating_count) || 0;
        if (avgEl) avgEl.textContent = avg > 0 ? avg.toFixed(1) : '0.0';
        if (countEl) countEl.textContent = `(${formatNumber(count)})`;

        if (rateBtn && rateText) {
            if (userRating != null && Number(userRating) > 0) {
                rateBtn.classList.add('has-voted');
                rateText.textContent = `Tu nota: ${Number(userRating).toFixed(1)}`;
                rateBtn.title = `Tu calificación actual es ${Number(userRating).toFixed(1)}/10. Clic para modificar`;
            } else {
                rateBtn.classList.remove('has-voted');
                rateText.textContent = 'Calificar';
                rateBtn.title = 'Calificar esta obra (desliza de 1.0 a 10.0)';
            }
        }
    };

    updateUI();

    if (rateBtn) {
        rateBtn.onclick = () => {
            if (!getAccessToken()) {
                const returnUrl = `/pages/obra.html?slug=${encodeURIComponent(work.slug || slug)}`;
                window.location.assign(`/pages/login.html?next=${encodeURIComponent(returnUrl)}`);
                return;
            }

            openWorkRatingModal({
                workId: work.id,
                workTitle: work.title,
                initialScore: userRating != null ? Number(userRating) : 8.0,
                onRated({ ratingAverage, userRating: newScore }) {
                    if (newScore != null) {
                        userRating = newScore;
                    }
                    if (ratingAverage != null) {
                        work.rating_average = ratingAverage;
                        work.rating_count = (Number(work.rating_count) || 0) + 1;
                    }
                    updateUI();
                }
            });
        };
    }
}

async function loadRecommendedWorks() {
    const recGrid = document.getElementById('work-recommended-grid');
    if (!recGrid) return;

    try {
        const res = await apiRequest('/works/?per_page=6&sort=popular');
        const works = Array.isArray(res) ? res : (res?.items || []);
        const filtered = works.filter(w => w.id !== currentWork?.id).slice(0, 5);

        if (!filtered.length) {
            const sec = document.querySelector('.work-recommended-section');
            if (sec) sec.hidden = true;
            return;
        }

        recGrid.replaceChildren();
        filtered.forEach((w, idx) => {
            const card = document.createElement('a');
            card.className = 'work-rec-card';
            card.href = `/pages/obra.html?slug=${encodeURIComponent(w.slug || w.id)}`;
            card.innerHTML = `
                <div class="work-rec-cover-wrap">
                    <span class="work-rec-rank-pill">#${idx + 1}</span>
                    <img class="work-rec-cover" src="${safeUrl(w.cover_url, IMG_FALLBACK)}" alt="${escapeHTML(w.title || '')}" loading="lazy">
                </div>
                <div class="work-rec-info">
                    <h4 class="work-rec-card-title">${escapeHTML(w.title || 'Obra')}</h4>
                    <span class="work-rec-card-format">${escapeHTML(w.format_name || 'MANGA')}</span>
                </div>
            `;
            recGrid.appendChild(card);
        });
    } catch {
        const sec = document.querySelector('.work-recommended-section');
        if (sec) sec.hidden = true;
    }
}

async function loadWork() {
    if (!slug) {
        showError('El enlace no incluye una obra. Vuelve al catálogo para elegir una.', true);
        return;
    }

    page.setAttribute('aria-busy', 'true');
    if (workSkeleton) {
        if (!workSkeleton.children.length) workSkeleton.innerHTML = renderWorkDetailSkeleton(4);
        workSkeleton.hidden = false;
    }
    errorPanel.hidden = true;
    content.hidden = true;

    try {
        const detail = await apiRequest(`/works/${encodeURIComponent(slug)}/detail`);
        renderWork(detail.work, detail.chapters, detail.user_state, detail.library_stats);

        if (detail.work && detail.work.id) {
            apiRequest('/metrics/views', {
                method: 'POST',
                body: { work_id: detail.work.id }
            }).catch(() => {});
        }
    } catch (error) {
        // fallback carga obra
        try {
            const [work, chapters] = await Promise.all([
                apiRequest(`/works/${encodeURIComponent(slug)}`),
                apiRequest(`/chapters/work/${encodeURIComponent(slug)}?published_only=true&order=desc`).catch(() => [])
            ]);
            renderWork(work, chapters);
        } catch (fallbackError) {
            showError(
                fallbackError.status === 404
                    ? 'La obra pudo haber sido retirada del catálogo.'
                    : 'Revisa tu conexión e inténtalo de nuevo.',
                fallbackError.status === 404
            );
        }
    }
}

retryButton?.addEventListener('click', loadWork);
loadWork();