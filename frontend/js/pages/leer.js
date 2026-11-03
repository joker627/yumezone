import { apiRequest, getAccessToken } from '../shared/auth.js';
import { API_BASE_URL } from '../api/api-config.js';
import { makeWorkUrl, safeUrl, IMG_FALLBACK, formatChapterNumber } from '../shared/ui-utils.js';
import { renderReaderPagesSkeleton } from '../components/skeletons.js';

const cleanSearch = (window.location.search || '').replace(/&amp;/g, '&');
const params = new URLSearchParams(cleanSearch);

let rawSlug = params.get('obra') || params.get('slug') || params.get('series') || params.get('manga');
let slug = rawSlug && rawSlug !== '[object Object]' ? rawSlug.trim() : null;

let chapterParam = params.get('capitulo') || params.get('cap') || params.get('chapter');
let chapterId = Number(params.get('chapter_id') || 0);
let chapterNumberRequested = null;

if (chapterParam) {
  const cleanParam = String(chapterParam).replace(/^cap-?/i, '').trim();
  const parsedNum = parseFloat(cleanParam.replace(',', '.'));
  if (!isNaN(parsedNum)) {
    chapterNumberRequested = parsedNum;
  }
}

let targetPage = Number(params.get('page') || params.get('p') || 0);

// nodos barra
const toolbarEl = document.getElementById('reader-toolbar');
const homeBtnEl = document.getElementById('reader-home-btn');
if (homeBtnEl) {
  homeBtnEl.onclick = () => flushSaveProgress();
}
const workTitleEl = document.getElementById('reader-work-title');
const chapterTitleEl = document.getElementById('reader-chapter-title');
const chapterPillLabelEl = document.getElementById('reader-chapter-pill-label');
const backLinkEl = document.getElementById('reader-back');
const chapterSelectEl = document.getElementById('reader-chapter-select');
const progressBarEl = document.getElementById('reader-progress-bar');
const scrollTopBtn = document.getElementById('reader-scroll-top');

// botones navegacion
const topPrevBtn = document.getElementById('reader-top-prev-btn');
const topNextBtn = document.getElementById('reader-top-next-btn');

// nodos fin capitulo
const endCardEl = document.getElementById('reader-end-card');
const endTitleEl = document.getElementById('reader-end-title');
const endPrevBtn = document.getElementById('reader-end-prev-btn');
const endNextBtn = document.getElementById('reader-end-next-btn');
const endWorkLinkEl = document.getElementById('reader-end-work-link');

// nodos paginas
const viewportEl = document.getElementById('reader-viewport');
const pagesContainerEl = document.getElementById('reader-pages');
const loadingEl = document.getElementById('reader-loading');
const errorEl = document.getElementById('reader-error');
const errorMsgEl = document.getElementById('reader-error-msg');
const retryBtn = document.getElementById('reader-retry-btn');

// nodos ajustes
const settingsBtn = document.getElementById('reader-settings-btn');
const settingsPanel = document.getElementById('reader-settings-panel');
const settingsCloseBtn = document.getElementById('reader-settings-close');
const fullscreenBtn = document.getElementById('reader-fullscreen-btn');
const shortcutsBtn = document.getElementById('reader-shortcuts-btn');
const shortcutsModal = document.getElementById('reader-shortcuts-modal');
const shortcutsCloseBtn = document.getElementById('reader-shortcuts-close');

// estado interno
let allChapters = [];
let currentWork = null;
let currentWorkId = 0;
let totalPagesCount = 0;
let currentPageNumber = 1;
let lastSavedPage = null;
let saveHistoryTimeout = null;
let scrollListenerAttached = false;
let lastScrollY = window.scrollY;
let isHudHidden = false;

// control lecturas
let readingStartTime = Date.now();
let viewLoggedForThisChapter = false;
let isChapterAlreadyRead = false;

// estado lectura
function applyChapterReadStatus(userState, chId, workId, currentNum) {
  readingStartTime = Date.now();
  viewLoggedForThisChapter = false;
  isChapterAlreadyRead = false;

  // verificar lectura backend
  if (userState?.is_read || userState?.has_higher_chapter_read) {
    isChapterAlreadyRead = true;
    viewLoggedForThisChapter = true;
    try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
    return;
  }

  // verificar lectura local
  try {
    const anonReads = JSON.parse(localStorage.getItem('yumezone_anon_read_chapters') || '{}');
    if (anonReads[chId]) {
      isChapterAlreadyRead = true;
      viewLoggedForThisChapter = true;
      try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
      return;
    }
  } catch (e) { }

  // verificar historial local
  try {
    const historyMap = JSON.parse(localStorage.getItem('yumezone_reading_history') || '{}');
    const hist = historyMap[workId];
    if (hist && hist.chapter_id && Number(hist.chapter_id) !== Number(chId) && currentNum != null && Array.isArray(allChapters)) {
      const histCh = allChapters.find(c => Number(c.id) === Number(hist.chapter_id));
      if (histCh && Number(histCh.chapter_number) > currentNum) {
        isChapterAlreadyRead = true;
        viewLoggedForThisChapter = true;
        try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
      }
    }
  } catch (e) { }
}

// registrar lectura
function checkAndRecordLegitimateView(pageNumber, chapterMeta) {

  if (viewLoggedForThisChapter || isChapterAlreadyRead) return;
  if (!totalPagesCount || totalPagesCount <= 0) return;

  // validar progreso
  const progressRatio = pageNumber / totalPagesCount;
  const reachedThreshold = progressRatio >= 0.8 || pageNumber >= totalPagesCount;
  if (!reachedThreshold) return;

  // validar tiempo activo

  const secondsReading = (Date.now() - readingStartTime) / 1000;
  if (secondsReading < 8) return;

  viewLoggedForThisChapter = true;

  const wId = parseInt(chapterMeta?.work_id || currentWork?.id || currentWorkId, 10);
  const cId = parseInt(chapterId, 10);
  if (!wId || !cId) return;

  // guardar lectura local
  try {
    const anonReads = JSON.parse(localStorage.getItem('yumezone_anon_read_chapters') || '{}');
    anonReads[cId] = Date.now();
    localStorage.setItem('yumezone_anon_read_chapters', JSON.stringify(anonReads));
  } catch (e) { }

  // enviar vista api
  apiRequest('/metrics/views', {
    method: 'POST',
    body: { work_id: wId, chapter_id: cId }
  }).catch(err => console.warn('Error registrando vista:', err));

  // guardar progreso api
  if (getAccessToken()) {
    apiRequest('/library/history', {
      method: 'POST',
      body: { work_id: wId, chapter_id: cId, last_page_read: pageNumber, completed: true }
    }).catch(() => { });
  }
}

// persistir progreso local de pagina
function flushSaveProgress(immediatePage = null) {
  const pageToSave = Number(immediatePage || currentPageNumber || 1);
  const cId = parseInt(chapterId, 10);
  if (!cId || !pageToSave || pageToSave < 1) return;
  try {
    localStorage.setItem(`yumezone_last_page_${cId}`, String(pageToSave));
  } catch (e) { }
  lastSavedPage = pageToSave;
}

// debounce progreso en localStorage (alivia completamente SQL de escrituras por scroll)
function debouncedSaveProgress(pageNumber, workId, chId) {
  if (!chId || !pageNumber || pageNumber < 1) return;
  if (pageNumber === lastSavedPage) return;
  clearTimeout(saveHistoryTimeout);
  saveHistoryTimeout = setTimeout(() => {
    try {
      localStorage.setItem(`yumezone_last_page_${chId}`, String(pageNumber));
    } catch (e) { }
    lastSavedPage = pageNumber;
  }, 400);
}

// eventos salida
window.addEventListener('beforeunload', () => flushSaveProgress());
window.addEventListener('pagehide', () => flushSaveProgress());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSaveProgress();
});

// cargar capitulo
async function loadChapter() {
  showLoading(true);

  try {
    const readerParams = new URLSearchParams();
    if (chapterId) {
      readerParams.set('chapter_id', String(chapterId));
    }
    if (slug) {
      readerParams.set('work_slug', slug);
    }
    if (chapterNumberRequested != null) {
      readerParams.set('chapter_number', String(chapterNumberRequested));
    }

    if (!chapterId && !slug && chapterParam) {
      const parsed = Number(chapterParam);
      if (parsed) {
        readerParams.set('chapter_id', String(parsed));
      }
    }

    if (![...readerParams.keys()].length) {
      showError('No se especificó una obra o capítulo válido para leer.');
      return;
    }

    // obtener datos capitulo
    const data = await apiRequest(`/chapters/reader?${readerParams.toString()}`);
    if (!data || !data.chapter || !data.work) {
      showError('El capítulo solicitado no existe o fue despublicado.');
      return;
    }

    const chapterMeta = data.chapter;
    chapterId = chapterMeta.id;
    currentWork = data.work;
    currentWorkId = currentWork.id;
    allChapters = data.navigation?.chapters || [];
    const pages = data.pages || [];

    // actualizar url
    try {
      const workSlug = currentWork.slug || slug || '';
      const capNum = chapterMeta.chapter_number != null ? formatChapterNumber(chapterMeta.chapter_number) : chapterMeta.id;
      if (workSlug) {
        const cleanUrl = `/pages/leer.html?obra=${encodeURIComponent(workSlug)}&capitulo=${encodeURIComponent(capNum)}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (e) { }

    // estado inicial lectura
    const currentNum = chapterMeta.chapter_number != null ? Number(chapterMeta.chapter_number) : null;
    applyChapterReadStatus(data.user_state, chapterId, currentWorkId, currentNum);

    // resolver pagina inicial
    if (isChapterAlreadyRead) {
      targetPage = 1;
      try {
        localStorage.removeItem(`yumezone_last_page_${chapterId}`);
      } catch (e) { }
    } else {
      let localPage = 0;
      try {
        localPage = Number(localStorage.getItem(`yumezone_last_page_${chapterId}`) || 0);
      } catch (e) { }

      const serverPage = Number(data.user_state?.last_page_read || 0);
      const freshestSavedPage = localPage > 0 ? localPage : serverPage;
      if (freshestSavedPage > 1) {
        targetPage = freshestSavedPage;
      }
    }

    renderHeaderInfo(chapterMeta);
    renderChapterSelect();
    renderNavigation(chapterMeta, data.navigation);
    renderPages(pages, chapterMeta);

    if (targetPage > 1) {
      scrollToTargetPage(targetPage);
    }

    showLoading(false);

    // registrar capítulo actual en historial de lectura de la cuenta (1 sola vez al abrir el capítulo)
    if (getAccessToken() && currentWorkId && chapterId) {
      apiRequest('/library/history', {
        method: 'POST',
        body: { work_id: currentWorkId, chapter_id: chapterId }
      }).catch(() => { });
    }
  } catch (err) {
    showError(err.message || 'Error al cargar las páginas del capítulo.');
  }
}

function updateReaderSEO(chapter, work) {
  try {
    const numStr = chapter?.chapter_number != null ? formatChapterNumber(chapter.chapter_number) : `#${chapterId}`;
    const num = `Capítulo ${numStr}`;
    const fullChapterTitle = chapter?.title ? `${num}: ${chapter.title}` : num;
    const workTitle = work?.title || 'Manga';
    const pageTitle = `${fullChapterTitle} - ${workTitle} | Leer Online Gratis en YumeZone`;
    document.title = pageTitle;

    const metaDesc = `Lee ${fullChapterTitle} de ${workTitle} online en español gratis y en alta resolución en YumeZone. Disfruta de la mejor experiencia de lectura vertical y webtoon.`;
    const cleanSlug = work?.slug || slug || '';
    const readerUrl = cleanSlug
      ? `https://yumezone.page/pages/leer.html?slug=${encodeURIComponent(cleanSlug)}&chapter_id=${chapter?.id || chapterId}`
      : window.location.href;
    const imageUrl = work?.cover_url || 'https://yumezone.page/assets/icons/logo.png';

    let descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.content = metaDesc;

    const canonical = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = readerUrl;

    const ogTitle = document.getElementById('og-title') || document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = pageTitle;

    const ogDesc = document.getElementById('og-desc') || document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = metaDesc;

    const ogUrl = document.getElementById('og-url') || document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = readerUrl;

    const ogImage = document.getElementById('og-image') || document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = imageUrl;

    const twTitle = document.getElementById('tw-title') || document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.content = pageTitle;

    const twDesc = document.getElementById('tw-desc') || document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.content = metaDesc;

    const twImage = document.getElementById('tw-image') || document.querySelector('meta[name="twitter:image"]');
    if (twImage) twImage.content = imageUrl;

    let script = document.getElementById('reader-schema-jsonld');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'reader-schema-jsonld';
      document.head.appendChild(script);
    }

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://yumezone.page/" },
            { "@type": "ListItem", "position": 2, "name": workTitle, "item": cleanSlug ? `https://yumezone.page/pages/obra.html?slug=${encodeURIComponent(cleanSlug)}` : "https://yumezone.page/pages/catalogo.html" },
            { "@type": "ListItem", "position": 3, "name": fullChapterTitle, "item": readerUrl }
          ]
        },
        {
          "@type": "ComicIssue",
          "name": fullChapterTitle,
          "issueNumber": chapter?.chapter_number != null ? String(chapter.chapter_number) : undefined,
          "partOfSeries": {
            "@type": "ComicSeries",
            "name": workTitle
          },
          "url": readerUrl,
          "image": imageUrl,
          "inLanguage": "es"
        }
      ]
    };
    script.textContent = JSON.stringify(schemaData);
  } catch (e) {
    console.warn('Error al actualizar SEO en el lector:', e);
  }
}

function renderHeaderInfo(chapter) {
  const numStr = chapter?.chapter_number != null ? formatChapterNumber(chapter.chapter_number) : `#${chapterId}`;
  const num = `Capítulo ${numStr}`;
  const title = chapter?.title ? `${num}: ${chapter.title}` : num;
  if (chapterTitleEl) chapterTitleEl.textContent = title;
  if (chapterPillLabelEl) chapterPillLabelEl.textContent = num;
  updateReaderSEO(chapter, currentWork);

  const workUrl = currentWork ? makeWorkUrl(currentWork.slug || currentWork) : (slug ? makeWorkUrl(slug) : '/pages/catalogo.html');

  if (backLinkEl) {
    backLinkEl.href = workUrl;
    backLinkEl.onclick = () => flushSaveProgress();
    if (workTitleEl) workTitleEl.textContent = currentWork?.title || 'Volver a la obra';
  }

  if (endWorkLinkEl) {
    endWorkLinkEl.href = workUrl;
    endWorkLinkEl.onclick = () => flushSaveProgress();
  }
}

function renderChapterSelect() {
  if (!chapterSelectEl) return;
  chapterSelectEl.replaceChildren();

  if (!allChapters.length) {
    chapterSelectEl.hidden = true;
    return;
  }
  chapterSelectEl.hidden = false;

  allChapters.forEach(c => {
    const opt = document.createElement('option');
    opt.value = String(c.id);
    const numStr = formatChapterNumber(c.chapter_number);
    opt.textContent = `Cap. ${numStr}${c.title ? ' - ' + c.title : ''}`;
    opt.selected = c.id === chapterId;
    if (opt.selected && chapterPillLabelEl) {
      chapterPillLabelEl.textContent = `Capítulo ${numStr}`;
    }
    chapterSelectEl.append(opt);
  });
}

function renderNavigation(chapter, navInfo = null) {
  if (!allChapters.length) {
    if (topPrevBtn) topPrevBtn.disabled = true;
    if (topNextBtn) topNextBtn.disabled = true;
    if (endCardEl) endCardEl.hidden = true;
    return;
  }

  let prevChapter = null;
  let nextChapter = null;

  if (navInfo && (navInfo.prev_chapter_id !== undefined || navInfo.next_chapter_id !== undefined)) {
    prevChapter = navInfo.prev_chapter_id != null ? allChapters.find(c => c.id === navInfo.prev_chapter_id) : null;
    nextChapter = navInfo.next_chapter_id != null ? allChapters.find(c => c.id === navInfo.next_chapter_id) : null;
  } else {
    const currentIndex = allChapters.findIndex(c => c.id === chapterId);
    prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
    nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;
  }

  if (topPrevBtn) {
    topPrevBtn.disabled = !prevChapter;
    topPrevBtn.onclick = () => { if (prevChapter) navigateToChapter(prevChapter.id); };
  }
  if (topNextBtn) {
    topNextBtn.disabled = !nextChapter;
    topNextBtn.onclick = () => { if (nextChapter) navigateToChapter(nextChapter.id); };
  }

  // tarjeta de fin de capítulo
  if (endCardEl) {
    endCardEl.hidden = false;
    if (endTitleEl) {
      const num = chapter?.chapter_number != null ? `Capítulo ${chapter.chapter_number}` : '';
      endTitleEl.textContent = num ? `Fin del ${num}` : 'Fin del capítulo';
    }

    if (endNextBtn) {
      if (nextChapter) {
        endNextBtn.hidden = false;
        const nextNum = nextChapter.chapter_number != null ? `Cap. ${nextChapter.chapter_number}` : 'Siguiente';
        endNextBtn.innerHTML = `<span>Continuar con ${nextNum}</span> <img src="/assets/icons/svg/navigation/arrow-right.svg" alt="" aria-hidden="true" width="16" height="16">`;
        endNextBtn.onclick = () => navigateToChapter(nextChapter.id);
      } else {
        endNextBtn.hidden = true;
      }
    }

    if (endPrevBtn) {
      if (prevChapter) {
        endPrevBtn.hidden = false;
        endPrevBtn.onclick = () => navigateToChapter(prevChapter.id);
      } else {
        endPrevBtn.hidden = true;
      }
    }
  }
}

function navigateToChapter(newChapterId) {
  try {
    localStorage.removeItem(`yumezone_last_page_${chapterId}`);
  } catch (e) { }
  flushSaveProgress();
  const nextCh = allChapters.find(c => c.id === newChapterId);
  const capNum = nextCh?.chapter_number != null ? formatChapterNumber(nextCh.chapter_number) : newChapterId;
  const workSlug = currentWork?.slug || slug || '';
  if (workSlug) {
    window.location.href = `/pages/leer.html?obra=${encodeURIComponent(workSlug)}&capitulo=${encodeURIComponent(capNum)}&chapter_id=${newChapterId}`;
  } else {
    window.location.href = `/pages/leer.html?chapter_id=${newChapterId}`;
  }
}

// actualizar barra progreso
function updateReadingProgress(currentPage = 1) {
  if (!totalPagesCount || totalPagesCount === 0) {
    if (progressBarEl) progressBarEl.style.width = '0%';
    return;
  }

  const boundedPage = Math.min(Math.max(1, currentPage), totalPagesCount);
  const percentage = Math.round((boundedPage / totalPagesCount) * 100);
  if (progressBarEl) progressBarEl.style.width = `${percentage}%`;
}

function handleScrollProgress(chapterMeta) {
  const currentY = window.scrollY || window.pageYOffset;

  // mostrar boton subir
  if (scrollTopBtn) {
    if (currentY > 450) {
      scrollTopBtn.hidden = false;
    } else {
      scrollTopBtn.hidden = true;
    }
  }

  // auto-ocultar hud
  if (currentY <= 30) {

    setHudVisibility(true);
    lastScrollY = currentY;
  } else if (Math.abs(currentY - lastScrollY) > 12) {
    if (currentY > lastScrollY) {
      // ocultar hud
      setHudVisibility(false);
    } else {
      // mostrar hud
      setHudVisibility(true);
    }
    lastScrollY = currentY;
  }

  // fallback scroll
  if (!window.IntersectionObserver) {
    const pageItems = pagesContainerEl.querySelectorAll('.reader-page-item');
    if (!pageItems.length) return;
    const viewportHeight = window.innerHeight;
    const triggerPoint = currentY + (viewportHeight * 0.35);
    let activePageNumber = 1;
    pageItems.forEach((item, index) => {
      if (item.offsetTop <= triggerPoint) {
        activePageNumber = index + 1;
      }
    });
    onPageChanged(activePageNumber, chapterMeta);
  }
}

function onPageChanged(activePageNumber, chapterMeta) {
  if (!activePageNumber || activePageNumber === currentPageNumber) return;
  currentPageNumber = activePageNumber;
  updateReadingProgress(activePageNumber);

  if (isChapterAlreadyRead) return;

  // guardar pagina actual
  try {
    localStorage.setItem(`yumezone_last_page_${chapterId}`, String(activePageNumber));
  } catch (e) { }

  // sincronizar pagina
  if (activePageNumber !== lastSavedPage) {
    const wId = chapterMeta?.work_id || currentWork?.id;
    debouncedSaveProgress(activePageNumber, wId, chapterId);
  }

  // verificar si se alcanzó una lectura legítima sin
  checkAndRecordLegitimateView(activePageNumber, chapterMeta);
}

let isInitialScrollRestored = false;

function scrollToTargetPage(pageNumber) {
  if (!pageNumber || pageNumber <= 1) return;
  isInitialScrollRestored = false;

  const targetId = `reader-page-${pageNumber}`;

  const performScroll = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const currentScroll = window.scrollY || window.pageYOffset;
    const targetY = currentScroll + rect.top;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'auto'
    });
    updateReadingProgress(pageNumber);
  };

  // reintentos escalonados para adaptarse a la resolución
  performScroll();
  requestAnimationFrame(performScroll);
  setTimeout(performScroll, 50);
  setTimeout(performScroll, 160);
  setTimeout(performScroll, 380);
  setTimeout(performScroll, 750);

  // ajustar scroll carga
  const allPrevImages = pagesContainerEl?.querySelectorAll('img') || [];
  allPrevImages.forEach((img, idx) => {
    if (idx + 1 <= pageNumber && !img.complete) {
      img.addEventListener('load', () => {
        if (!isInitialScrollRestored) performScroll();
      }, { once: true });
    }
  });

  setTimeout(() => {
    isInitialScrollRestored = true;
  }, 1600);
}

// precargar paginas
function preloadAdjacentPages(currentNum, pagesArray) {
  if (!pagesArray || !pagesArray.length) return;
  for (let i = currentNum; i <= Math.min(currentNum + 2, pagesArray.length); i++) {
    const page = pagesArray[i - 1];
    if (page && page.image_url) {
      const link = new Image();
      link.src = safeUrl(page.image_url, IMG_FALLBACK);
    }
  }
}

function renderPages(pages, chapter) {
  pagesContainerEl.replaceChildren();

  const pagesArray = Array.isArray(pages) ? pages : [];
  totalPagesCount = pagesArray.length;

  if (totalPagesCount === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'reader-empty-chapter-box';
    emptyBox.innerHTML = `
      <div class="reader-placeholder-icon">
        <img src="/assets/icons/svg/content/book.svg" width="28" height="28" alt="" aria-hidden="true">
      </div>
      <h3>Capítulo en preparación</h3>
      <p>Este capítulo aún no tiene paneles o páginas subidas por el equipo de scanlation. ¡Vuelve pronto!</p>
    `;
    pagesContainerEl.append(emptyBox);
    updateReadingProgress(0);
    if (endCardEl) endCardEl.hidden = true;
    return;
  }

  currentPageNumber = 1;
  updateReadingProgress(1);

  pagesArray.forEach((p, idx) => {
    const pageNum = idx + 1;
    const pageItem = document.createElement('div');
    pageItem.className = 'reader-page-item';
    pageItem.id = `reader-page-${pageNum}`;
    pageItem.dataset.pageNumber = String(pageNum);

    // loader pagina
    const skeleton = document.createElement('div');
    skeleton.className = 'reader-page-skeleton';
    skeleton.innerHTML = `
      <div class="reader-page-spinner" aria-hidden="true"></div>
      <span class="reader-page-skeleton-text">Página ${pageNum}</span>
    `;
    pageItem.append(skeleton);

    // badge discreto en esquina (sutil al hover)
    const badge = document.createElement('span');
    badge.className = 'reader-page-badge';
    badge.textContent = `${pageNum}`;
    pageItem.append(badge);

    const hasValidImage = Boolean(p.image_url && p.image_url.trim());

    if (hasValidImage) {
      const img = document.createElement('img');
      img.className = 'reader-page-img';
      img.alt = `Página ${pageNum}`;
      img.loading = idx < 3 ? 'eager' : 'lazy';
      img.decoding = 'async';

      const revealImage = () => {
        img.classList.add('is-loaded');
        pageItem.classList.add('is-loaded');
        skeleton.classList.add('is-hidden');
        setTimeout(() => skeleton.remove(), 260);

        // precarga adyacente
        preloadAdjacentPages(pageNum, pagesArray);
      };

      img.onload = () => {
        if ('decode' in img) {
          img.decode().then(revealImage).catch(revealImage);
        } else {
          revealImage();
        }
      };

      img.onerror = () => {
        skeleton.remove();
        if (!img.dataset.fallbackTried) {
          img.dataset.fallbackTried = 'true';
          img.src = IMG_FALLBACK;
        } else {
          pageItem.classList.add('reader-page-placeholder');
          img.remove();
          renderPagePlaceholder(pageItem, pageNum, chapter, true);
        }
      };

      img.src = safeUrl(p.image_url, IMG_FALLBACK);
      pageItem.append(img);
    } else {
      skeleton.remove();
      pageItem.classList.add('reader-page-placeholder');
      renderPagePlaceholder(pageItem, pageNum, chapter, false);
    }

    pagesContainerEl.append(pageItem);
  });

  // observer paginas
  if (window.IntersectionObserver) {
    if (window._readerPageObserver) {
      window._readerPageObserver.disconnect();
    }
    window._readerPageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = Number(entry.target.dataset.pageNumber);
          if (pageNum) {
            onPageChanged(pageNum, chapter);
          }
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    });

    pagesContainerEl.querySelectorAll('.reader-page-item').forEach(item => {
      window._readerPageObserver.observe(item);
    });
  }

  if (!scrollListenerAttached) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScrollProgress(chapter);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
    scrollListenerAttached = true;
  }

  handleScrollProgress(chapter);
}

function renderPagePlaceholder(container, pageNum, chapter, isError = false) {
  const content = document.createElement('div');
  content.className = 'reader-placeholder-content';
  content.innerHTML = `
    <div class="reader-placeholder-icon">
      <img src="/assets/icons/svg/gamification/frame.svg" width="24" height="24" alt="" aria-hidden="true">
    </div>
    <span class="reader-placeholder-title">Página ${pageNum}</span>
    <span class="reader-placeholder-sub">
      ${isError ? 'No se pudo cargar la imagen de esta página.' : `Capítulo ${chapter?.chapter_number || chapterId} · Imagen pendiente`}
    </span>
  `;
  container.append(content);
}

function showLoading(isLoading) {
  if (loadingEl) {
    if (isLoading && !loadingEl.children.length) loadingEl.innerHTML = renderReaderPagesSkeleton();
    loadingEl.hidden = !isLoading;
  }
  if (errorEl) errorEl.hidden = true;
  if (isLoading && pagesContainerEl) pagesContainerEl.replaceChildren();
}

function showError(msg) {
  if (loadingEl) loadingEl.hidden = true;
  if (errorEl) errorEl.hidden = false;
  if (errorMsgEl) errorMsgEl.textContent = msg;
}

// scroll top
scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// chapter select
chapterSelectEl?.addEventListener('change', e => {
  const selectedId = Number(e.target.value);
  if (selectedId && selectedId !== chapterId) {
    navigateToChapter(selectedId);
  }
});

retryBtn?.addEventListener('click', loadChapter);

// settings & storage
const STORAGE_WIDTH_KEY = 'yumezone_reader_width';
const STORAGE_BRIGHTNESS_KEY = 'yumezone_reader_brightness';
const STORAGE_AUTOHIDE_KEY = 'yumezone_reader_autohide';

let readerAutoHideEnabled = localStorage.getItem(STORAGE_AUTOHIDE_KEY) === 'true';

// hud
function setHudVisibility(visible) {
  if (!readerAutoHideEnabled) visible = true;
  isHudHidden = !visible;
  if (toolbarEl) toolbarEl.classList.toggle('is-hidden', !visible);
}

function applyReaderSettings() {
  const savedWidth = localStorage.getItem(STORAGE_WIDTH_KEY) || 'narrow';
  if (viewportEl) {
    viewportEl.classList.remove('reader-width--narrow', 'reader-width--standard', 'reader-width--full');
    viewportEl.classList.add(`reader-width--${savedWidth}`);
  }
  document.querySelectorAll('[data-width]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.width === savedWidth);
  });

  // ajuste brillo
  const savedBrightness = localStorage.getItem(STORAGE_BRIGHTNESS_KEY) || '100';
  if (pagesContainerEl) {
    const numBright = Number(savedBrightness);
    pagesContainerEl.style.filter = (numBright < 100) ? `brightness(${numBright}%)` : '';
  }
  document.querySelectorAll('[data-brightness]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.brightness === savedBrightness);
  });

  // modo barra superior (por defecto Fija)
  readerAutoHideEnabled = localStorage.getItem(STORAGE_AUTOHIDE_KEY) === 'true';
  document.querySelectorAll('[data-autohide]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.autohide === String(readerAutoHideEnabled));
  });
  if (!readerAutoHideEnabled) {
    setHudVisibility(true);
  }

  updateReadingProgress(currentPageNumber);
}

// eventos ajustes
document.querySelectorAll('[data-width]').forEach(btn => {
  btn.addEventListener('click', () => {
    const width = btn.dataset.width;
    localStorage.setItem(STORAGE_WIDTH_KEY, width);
    applyReaderSettings();
  });
});

document.querySelectorAll('[data-brightness]').forEach(btn => {
  btn.addEventListener('click', () => {
    const brightness = btn.dataset.brightness;
    localStorage.setItem(STORAGE_BRIGHTNESS_KEY, brightness);
    applyReaderSettings();
  });
});

document.querySelectorAll('[data-autohide]').forEach(btn => {
  btn.addEventListener('click', () => {
    const autohide = btn.dataset.autohide === 'true';
    readerAutoHideEnabled = autohide;
    localStorage.setItem(STORAGE_AUTOHIDE_KEY, String(autohide));
    applyReaderSettings();
  });
});

// toggle hud click
pagesContainerEl?.addEventListener('click', e => {
  if (e.target.closest('button, a, input, select, dialog')) return;
  setHudVisibility(isHudHidden);
});

let settingsAutoCloseTimer = null;

function closeSettingsPanel() {
  if (settingsPanel && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    settingsBtn?.setAttribute('aria-expanded', 'false');
    clearTimeout(settingsAutoCloseTimer);
  }
}

function resetSettingsAutoClose(delay = 4000) {
  clearTimeout(settingsAutoCloseTimer);
  settingsAutoCloseTimer = setTimeout(() => {
    closeSettingsPanel();
  }, delay);
}

// toggle ajustes
settingsBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const willOpen = settingsPanel.hidden;
  settingsPanel.hidden = !willOpen;
  settingsBtn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    resetSettingsAutoClose(4500);
  } else {
    clearTimeout(settingsAutoCloseTimer);
  }
});

settingsCloseBtn?.addEventListener('click', () => {
  closeSettingsPanel();
});

// auto-cerrar ajustes
settingsPanel?.addEventListener('mouseenter', () => clearTimeout(settingsAutoCloseTimer));
settingsPanel?.addEventListener('mousemove', () => resetSettingsAutoClose(4000));
settingsPanel?.addEventListener('mouseleave', () => resetSettingsAutoClose(1200));

// cerrar ajustes
window.addEventListener('scroll', closeSettingsPanel, { passive: true });
document.addEventListener('click', e => {
  if (settingsPanel && !settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    closeSettingsPanel();
  }
});

// pantalla completa
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

fullscreenBtn?.addEventListener('click', toggleFullscreen);

// modal atajos
shortcutsBtn?.addEventListener('click', () => {
  if (shortcutsModal) {
    closeSettingsPanel();
    shortcutsModal.showModal();
  }
});

shortcutsCloseBtn?.addEventListener('click', () => {
  if (shortcutsModal) shortcutsModal.close();
});

shortcutsModal?.addEventListener('click', e => {
  if (e.target === shortcutsModal) shortcutsModal.close();
});

// atajos teclado
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    if (topNextBtn && !topNextBtn.disabled) topNextBtn.click();
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    if (topPrevBtn && !topPrevBtn.disabled) topPrevBtn.click();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  } else if (e.key === 'h' || e.key === 'H') {
    setHudVisibility(isHudHidden);
  } else if (e.key === '?') {
    if (shortcutsModal) shortcutsModal.showModal();
  } else if (e.key === 'Escape') {
    closeSettingsPanel();
    if (shortcutsModal && shortcutsModal.open) shortcutsModal.close();
  }
});

// iniciar lector
applyReaderSettings();
loadChapter();
