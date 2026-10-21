import { renderSiteHeader } from '../components/header.js';
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { API_BASE_URL } from '../api/api-config.js';
import { makeWorkUrl, safeUrl, IMG_FALLBACK } from '../shared/ui-utils.js';

const headerEl = document.getElementById('header');
if (headerEl) renderSiteHeader(headerEl);

const cleanSearch = (window.location.search || '').replace(/&amp;/g, '&');
const params = new URLSearchParams(cleanSearch);

let rawSlug = params.get('obra') || params.get('slug') || params.get('series') || params.get('manga');
let slug = rawSlug && rawSlug !== '[object Object]' ? rawSlug.trim() : null;

let chapterParam = params.get('capitulo') || params.get('cap') || params.get('chapter') || params.get('chapter_id');
let chapterId = Number(params.get('chapter_id') || 0);
let chapterNumberRequested = null;

if (chapterParam) {
  const cleanParam = String(chapterParam).replace(/^cap-?/i, '').trim();
  const parsedNum = parseFloat(cleanParam);
  if (!isNaN(parsedNum)) {
    chapterNumberRequested = parsedNum;
  }
}

let targetPage = Number(params.get('page') || params.get('p') || 0);

// Elementos del DOM - Barras de navegación
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

// Botones de navegación superior
const topPrevBtn = document.getElementById('reader-top-prev-btn');
const topNextBtn = document.getElementById('reader-top-next-btn');

// Elementos de la tarjeta de fin de capítulo
const endCardEl = document.getElementById('reader-end-card');
const endTitleEl = document.getElementById('reader-end-title');
const endPrevBtn = document.getElementById('reader-end-prev-btn');
const endNextBtn = document.getElementById('reader-end-next-btn');
const endWorkLinkEl = document.getElementById('reader-end-work-link');

// Elementos del viewport y páginas
const viewportEl = document.getElementById('reader-viewport');
const pagesContainerEl = document.getElementById('reader-pages');
const loadingEl = document.getElementById('reader-loading');
const errorEl = document.getElementById('reader-error');
const errorMsgEl = document.getElementById('reader-error-msg');
const retryBtn = document.getElementById('reader-retry-btn');

// Ajustes del lector y atajos
const settingsBtn = document.getElementById('reader-settings-btn');
const settingsPanel = document.getElementById('reader-settings-panel');
const settingsCloseBtn = document.getElementById('reader-settings-close');
const fullscreenBtn = document.getElementById('reader-fullscreen-btn');
const shortcutsBtn = document.getElementById('reader-shortcuts-btn');
const shortcutsModal = document.getElementById('reader-shortcuts-modal');
const shortcutsCloseBtn = document.getElementById('reader-shortcuts-close');

// Estado interno
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

// Control antifraude y deduplicación de lecturas
let readingStartTime = Date.now();
let viewLoggedForThisChapter = false;
let isChapterAlreadyRead = false;

// Verificar si el capítulo ya fue leído para no duplicar conteos y colocarlo en página 1
async function checkChapterReadStatus(workId, chId) {
  readingStartTime = Date.now();
  viewLoggedForThisChapter = false;
  isChapterAlreadyRead = false;

  const currentCh = Array.isArray(allChapters) ? allChapters.find(c => Number(c.id) === Number(chId)) : null;
  const currentNum = currentCh?.chapter_number != null ? Number(currentCh.chapter_number) : null;

  // 1. Si el usuario está autenticado, validar contra capítulos leídos en el servidor
  if (getAccessToken() && workId) {
    try {
      const readChapters = await apiRequest(`/library/works/${workId}/read-chapters`).catch(() => []);
      if (Array.isArray(readChapters)) {
        if (readChapters.includes(Number(chId))) {
          isChapterAlreadyRead = true;
          viewLoggedForThisChapter = true;
          try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
          return;
        }

        // Si hay algún capítulo ya leído con número mayor, este capítulo ya fue superado
        if (currentNum != null && Array.isArray(allChapters)) {
          const hasHigherRead = allChapters.some(c => readChapters.includes(Number(c.id)) && Number(c.chapter_number) > currentNum);
          if (hasHigherRead) {
            isChapterAlreadyRead = true;
            viewLoggedForThisChapter = true;
            try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error verificando capítulos leídos:', e);
    }
  }

  // 2. Si no está autenticado, validar en localStorage
  try {
    const anonReads = JSON.parse(localStorage.getItem('yumezone_anon_read_chapters') || '{}');
    if (anonReads[chId]) {
      isChapterAlreadyRead = true;
      viewLoggedForThisChapter = true;
      try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
      return;
    }
  } catch (e) { }

  // 3. Validar contra el historial local guardado en este dispositivo (yumezone_reading_history)
  try {
    const historyMap = JSON.parse(localStorage.getItem('yumezone_reading_history') || '{}');
    const hist = historyMap[workId];
    if (hist && hist.chapter_id && Number(hist.chapter_id) !== Number(chId) && currentNum != null && Array.isArray(allChapters)) {
      const histCh = allChapters.find(c => Number(c.id) === Number(hist.chapter_id));
      if (histCh && Number(histCh.chapter_number) > currentNum) {
        isChapterAlreadyRead = true;
        viewLoggedForThisChapter = true;
        try { localStorage.removeItem(`yumezone_last_page_${chId}`); } catch (e) { }
        return;
      }
    }
  } catch (e) { }
}

// Contabilizar lectura solo si es legítima: progreso real (>=80% o fin) y tiempo activo (>=8s)
function checkAndRecordLegitimateView(pageNumber, chapterMeta) {
  // Si ya fue contabilizado en esta sesión o ya estaba leído anteriormente, no hacer nada
  if (viewLoggedForThisChapter || isChapterAlreadyRead) return;
  if (!totalPagesCount || totalPagesCount <= 0) return;

  // 1. Progreso real alcanzado: al menos el 80% o la última página
  const progressRatio = pageNumber / totalPagesCount;
  const reachedThreshold = progressRatio >= 0.8 || pageNumber >= totalPagesCount;
  if (!reachedThreshold) return;

  // 2. Tiempo activo de lectura: al menos 8 segundos en la página
  // Evita que scrolls rápidos accidentales al 100% o bots inflen estadísticas en falso
  const secondsReading = (Date.now() - readingStartTime) / 1000;
  if (secondsReading < 8) return;

  // Bloquear inmediatamente para evitar múltiples ejecuciones en la misma sesión
  viewLoggedForThisChapter = true;

  const wId = parseInt(chapterMeta?.work_id || currentWork?.id || currentWorkId, 10);
  const cId = parseInt(chapterId, 10);
  if (!wId || !cId) return;

  // Guardar en el dispositivo para usuarios anónimos
  try {
    const anonReads = JSON.parse(localStorage.getItem('yumezone_anon_read_chapters') || '{}');
    anonReads[cId] = Date.now();
    localStorage.setItem('yumezone_anon_read_chapters', JSON.stringify(anonReads));
  } catch (e) { }

  // Enviar métrica de vista legítima a la API
  apiRequest('/metrics/views', {
    method: 'POST',
    body: { work_id: wId, chapter_id: cId }
  }).catch(err => console.warn('Error registrando vista:', err));

  // Si está autenticado, actualizar el progreso final en biblioteca
  if (getAccessToken()) {
    apiRequest('/library/history', {
      method: 'POST',
      body: { work_id: wId, chapter_id: cId, last_page_read: pageNumber }
    }).catch(() => { });
  }
}

// Guardado inmediato para garantizar persistencia al salir, retroceder o cambiar de capítulo
function flushSaveProgress(immediatePage = null) {
  // Si el usuario está releyendo un capítulo que ya completó o superó, NO alterar el historial general de la obra
  if (isChapterAlreadyRead) return;

  const pageToSave = Number(immediatePage || currentPageNumber || 1);
  const wId = parseInt(currentWork?.id || currentWorkId || 0, 10);
  const cId = parseInt(chapterId, 10);
  if (!cId || !pageToSave || pageToSave < 1) return;

  // 1. Guardar localmente de inmediato
  try {
    localStorage.setItem(`yumezone_last_page_${cId}`, String(pageToSave));
    if (wId) {
      const historyMap = JSON.parse(localStorage.getItem('yumezone_reading_history') || '{}');
      const prev = historyMap[wId];

      let shouldUpdateChapter = true;
      if (prev && prev.chapter_id && Number(prev.chapter_id) !== cId && Array.isArray(allChapters) && allChapters.length) {
        const prevCh = allChapters.find(c => Number(c.id) === Number(prev.chapter_id));
        const currCh = allChapters.find(c => Number(c.id) === Number(cId));
        if (prevCh && currCh && Number(currCh.chapter_number) < Number(prevCh.chapter_number)) {
          shouldUpdateChapter = false;
        }
      }

      if (shouldUpdateChapter) {
        historyMap[wId] = {
          work_id: wId,
          chapter_id: cId,
          last_page_read: pageToSave,
          updated_at: Date.now()
        };
        localStorage.setItem('yumezone_reading_history', JSON.stringify(historyMap));
      }
    }
  } catch (e) { }

  lastSavedPage = pageToSave;

  // 2. Si está autenticado y tenemos wId, enviar a la API
  const token = getAccessToken();
  if (token && wId) {
    clearTimeout(saveHistoryTimeout);

    // Envío regular via apiRequest
    apiRequest('/library/history', {
      method: 'POST',
      body: { work_id: wId, chapter_id: cId, last_page_read: pageToSave }
    }).catch(() => { });

    // Envío con keepalive (garantizado si el navegador está cerrando la pestaña)
    try {
      const payload = JSON.stringify({
        work_id: wId,
        chapter_id: cId,
        last_page_read: pageToSave
      });
      const apiUrl = `${API_BASE_URL.replace(/\/+$/, '')}/v1/library/history`;
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: payload,
        credentials: 'include',
        keepalive: true
      }).catch(() => { });
    } catch (e) { }
  }
}

// Debounce para guardar la posición mientras se desplaza (hacia adelante o atrás)
function debouncedSaveProgress(pageNumber, workId, chId) {
  if (!workId || !chId || !pageNumber || pageNumber < 1) return;
  if (pageNumber === lastSavedPage) return;
  clearTimeout(saveHistoryTimeout);
  saveHistoryTimeout = setTimeout(() => {
    flushSaveProgress(pageNumber);
  }, 350);
}

// Disparadores automáticos al salir del lector o cambiar de pestaña
window.addEventListener('beforeunload', () => flushSaveProgress());
window.addEventListener('pagehide', () => flushSaveProgress());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSaveProgress();
});

// Cargar metadatos y páginas del capítulo
async function loadChapter() {
  showLoading(true);

  try {
    // 1. Si tenemos slug u obra, cargar la obra y sus capítulos para resolver
    if (slug) {
      try {
        currentWork = await apiRequest(`/works/${encodeURIComponent(slug)}`).catch(() => null);
        if (currentWork?.id) {
          currentWorkId = currentWork.id;
          allChapters = await apiRequest(`/chapters/work/${currentWork.id}?published_only=true&order=asc`).catch(() => []);

          // Si el usuario solicitó un número de capítulo (e.g. capitulo=119 o 3)
          if (chapterNumberRequested != null && allChapters.length) {
            const foundByNum = allChapters.find(c => Number(c.chapter_number) === Number(chapterNumberRequested));
            if (foundByNum) {
              chapterId = foundByNum.id;
            }
          }

          // Si aún no hay chapterId y hay capítulos disponibles, tomar el primero
          if (!chapterId && allChapters.length) {
            chapterId = allChapters[0].id;
          }
        }
      } catch (e) {
        console.warn('Error resolviendo obra y capítulos:', e);
      }
    }

    if (!chapterId && chapterParam) {
      chapterId = Number(chapterParam) || 0;
    }

    if (!chapterId) {
      showError('No se especificó un capítulo válido para leer.');
      return;
    }

    // 2. Cargar metadatos del capítulo
    let chapterMeta = allChapters.find(c => c.id === chapterId);
    if (!chapterMeta) {
      chapterMeta = await apiRequest(`/chapters/${chapterId}`);
    }

    if (!chapterMeta) {
      showError('El capítulo solicitado no existe o fue despublicado.');
      return;
    }

    // Cargar obra y lista si aún no estaban disponibles
    const workId = parseInt(chapterMeta.work_id, 10);
    currentWorkId = workId || currentWorkId;
    if (workId && (!currentWork || !allChapters.length)) {
      try {
        if (!currentWork) {
          currentWork = await apiRequest(`/works/${workId}`).catch(() => null);
          if (currentWork?.slug) slug = currentWork.slug;
        }
        if (!allChapters.length) {
          allChapters = await apiRequest(`/chapters/work/${workId}?published_only=true&order=asc`).catch(() => []);
        }
      } catch (err) {
        console.warn('No se pudo precargar la obra o capítulos:', err);
      }
    }

    // 3. Limpiar y presentar la URL limpia en la barra de direcciones (sin IDs ni query corruptos)
    try {
      const workSlug = currentWork?.slug || slug || '';
      const capNum = chapterMeta.chapter_number != null ? chapterMeta.chapter_number : chapterMeta.id;
      if (workSlug) {
        const cleanUrl = `/pages/leer.html?obra=${encodeURIComponent(workSlug)}&capitulo=${encodeURIComponent(capNum)}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (e) { }

    // 4. Cargar las páginas del capítulo
    const pages = await apiRequest(`/chapters/${chapterId}/pages`).catch(() => []);

    // 4. Verificar estado de lectura para evitar lecturas en falso y resetear a página 1 si ya está leído
    const wId = parseInt(chapterMeta?.work_id || currentWork?.id, 10);
    const cId = parseInt(chapterId, 10);
    if (wId > 0 && cId > 0) {
      await checkChapterReadStatus(wId, cId);
    }

    // Resolver página objetivo más reciente:
    if (isChapterAlreadyRead) {
      // Si el capítulo ya fue leído y superado, siempre arrancar en la página 1 limpia
      targetPage = 1;
      try {
        localStorage.removeItem(`yumezone_last_page_${chapterId}`);
      } catch (e) { }
    } else {
      // 1) Progreso fresco en este dispositivo (localStorage)
      let localPage = 0;
      try {
        localPage = Number(localStorage.getItem(`yumezone_last_page_${chapterId}`) || 0);
      } catch (e) { }

      // 2) Progreso guardado en servidor para usuario autenticado
      let serverPage = 0;
      if (getAccessToken() && workId) {
        try {
          const libWork = await apiRequest(`/library/${workId}`).catch(() => null);
          const prog = libWork?.item?.reading_progress;
          if (prog && Number(prog.chapter_id) === Number(chapterId) && Number(prog.last_page_read) > 0) {
            serverPage = Number(prog.last_page_read);
          }
        } catch (e) { }
      }

      // El progreso real más reciente prevalece sobre parámetros estáticos de URL viejos
      const freshestSavedPage = localPage > 0 ? localPage : serverPage;
      if (freshestSavedPage > 1) {
        targetPage = freshestSavedPage;
      }
    }

    renderHeaderInfo(chapterMeta);
    renderChapterSelect();
    renderNavigation(chapterMeta);
    renderPages(pages, chapterMeta);

    if (targetPage > 1) {
      scrollToTargetPage(targetPage);
    }

    showLoading(false);
  } catch (err) {
    showError(err.message || 'Error al cargar las páginas del capítulo.');
  }
}

function updateReaderSEO(chapter, work) {
  try {
    const num = chapter?.chapter_number != null ? `Capítulo ${chapter.chapter_number}` : `Capítulo #${chapterId}`;
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
  const num = chapter?.chapter_number != null ? `Capítulo ${chapter.chapter_number}` : `Capítulo #${chapterId}`;
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
    opt.textContent = `Cap. ${c.chapter_number}${c.title ? ' - ' + c.title : ''}`;
    opt.selected = c.id === chapterId;
    if (opt.selected && chapterPillLabelEl) {
      chapterPillLabelEl.textContent = `Capítulo ${c.chapter_number}`;
    }
    chapterSelectEl.append(opt);
  });
}

function renderNavigation(chapter) {
  if (!allChapters.length) {
    if (topPrevBtn) topPrevBtn.disabled = true;
    if (topNextBtn) topNextBtn.disabled = true;
    if (endCardEl) endCardEl.hidden = true;
    return;
  }

  const currentIndex = allChapters.findIndex(c => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  if (topPrevBtn) {
    topPrevBtn.disabled = !prevChapter;
    topPrevBtn.onclick = () => { if (prevChapter) navigateToChapter(prevChapter.id); };
  }
  if (topNextBtn) {
    topNextBtn.disabled = !nextChapter;
    topNextBtn.onclick = () => { if (nextChapter) navigateToChapter(nextChapter.id); };
  }

  // Tarjeta de fin de capítulo
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
        endNextBtn.innerHTML = `<span>Continuar con ${nextNum}</span> <img src="/assets/icons/svg/arrow-right.svg" alt="" aria-hidden="true" width="16" height="16">`;
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
  const capNum = nextCh?.chapter_number != null ? nextCh.chapter_number : newChapterId;
  const workSlug = currentWork?.slug || slug || '';
  if (workSlug) {
    window.location.href = `/pages/leer.html?obra=${encodeURIComponent(workSlug)}&capitulo=${encodeURIComponent(capNum)}`;
  } else {
    window.location.href = `/pages/leer.html?chapter_id=${newChapterId}`;
  }
}

// Actualiza la barra de progreso delgada superior
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

  // Botón flotante para subir arriba
  if (scrollTopBtn) {
    if (currentY > 450) {
      scrollTopBtn.hidden = false;
    } else {
      scrollTopBtn.hidden = true;
    }
  }

  // Auto-ocultar barras HUD al hacer scroll hacia abajo y mostrar inmediatamente al devolverse hacia arriba
  if (currentY <= 30) {
    // Cerca de la parte superior, siempre visible
    setHudVisibility(true);
    lastScrollY = currentY;
  } else if (Math.abs(currentY - lastScrollY) > 12) {
    if (currentY > lastScrollY) {
      // Seguir bajando (leyendo): ocultar barra para inmersión completa
      setHudVisibility(false);
    } else {
      // Devolverse (scroll hacia arriba): hacer aparecer la barra de inmediato
      setHudVisibility(true);
    }
    lastScrollY = currentY;
  }

  // Si IntersectionObserver no está soportado en este navegador, fallback seguro
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

  // Si este capítulo ya está leído y superado, es una relectura: no guardar ni registrar progreso regresivo
  if (isChapterAlreadyRead) return;

  // Guardar en localStorage de inmediato la página actual
  try {
    localStorage.setItem(`yumezone_last_page_${chapterId}`, String(activePageNumber));
  } catch (e) { }

  // Guardar en backend siempre que cambie de página
  if (activePageNumber !== lastSavedPage) {
    const wId = chapterMeta?.work_id || currentWork?.id;
    debouncedSaveProgress(activePageNumber, wId, chapterId);
  }

  // Verificar si se alcanzó una lectura legítima (>=80% o fin, y >=8s en página) sin repetir conteo
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

  // Reintentos escalonados para adaptarse a la resolución y renderizado
  performScroll();
  requestAnimationFrame(performScroll);
  setTimeout(performScroll, 50);
  setTimeout(performScroll, 160);
  setTimeout(performScroll, 380);
  setTimeout(performScroll, 750);

  // Escuchar cuando las imágenes anteriores terminen de cargarse para evitar que el layout shift empuje hacia arriba
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

// Precarga en memoria de páginas adyacentes para que no haya latencia al avanzar
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
        <img src="/assets/icons/svg/book.svg" width="28" height="28" alt="" aria-hidden="true">
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

    // Skeleton de carga dedicado por página (indica carga limpia e instantánea)
    const skeleton = document.createElement('div');
    skeleton.className = 'reader-page-skeleton';
    skeleton.innerHTML = `
      <div class="reader-page-spinner" aria-hidden="true"></div>
      <span class="reader-page-skeleton-text">Página ${pageNum}</span>
    `;
    pageItem.append(skeleton);

    // Badge discreto en esquina (sutil al hover)
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

        // Precargar siguientes 2 páginas para lectura ultra fluida
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

  // Seguimiento de página activa sin layout thrashing mediante IntersectionObserver (120 FPS)
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
      <img src="/assets/icons/svg/frame.svg" width="24" height="24" alt="" aria-hidden="true">
    </div>
    <span class="reader-placeholder-title">Página ${pageNum}</span>
    <span class="reader-placeholder-sub">
      ${isError ? 'No se pudo cargar la imagen de esta página.' : `Capítulo ${chapter?.chapter_number || chapterId} · Imagen pendiente`}
    </span>
  `;
  container.append(content);
}

function showLoading(isLoading) {
  if (loadingEl) loadingEl.hidden = !isLoading;
  if (errorEl) errorEl.hidden = true;
  if (isLoading && pagesContainerEl) pagesContainerEl.replaceChildren();
}

function showError(msg) {
  if (loadingEl) loadingEl.hidden = true;
  if (errorEl) errorEl.hidden = false;
  if (errorMsgEl) errorMsgEl.textContent = msg;
}

/* Scroll top */
scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* Chapter select */
chapterSelectEl?.addEventListener('change', e => {
  const selectedId = Number(e.target.value);
  if (selectedId && selectedId !== chapterId) {
    navigateToChapter(selectedId);
  }
});

retryBtn?.addEventListener('click', loadChapter);

/* Settings & Storage */
const STORAGE_WIDTH_KEY = 'yumezone_reader_width';
const STORAGE_BRIGHTNESS_KEY = 'yumezone_reader_brightness';
const STORAGE_AUTOHIDE_KEY = 'yumezone_reader_autohide';

let readerAutoHideEnabled = localStorage.getItem(STORAGE_AUTOHIDE_KEY) !== 'false';

/* HUD */
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

  // 2. Brillo / Atenuación visual nocturna
  const savedBrightness = localStorage.getItem(STORAGE_BRIGHTNESS_KEY) || '100';
  if (pagesContainerEl) {
    const numBright = Number(savedBrightness);
    pagesContainerEl.style.filter = (numBright < 100) ? `brightness(${numBright}%)` : '';
  }
  document.querySelectorAll('[data-brightness]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.brightness === savedBrightness);
  });

  // 3. Comportamiento de barra superior (Auto-ocultar vs Fija)
  readerAutoHideEnabled = localStorage.getItem(STORAGE_AUTOHIDE_KEY) !== 'false';
  document.querySelectorAll('[data-autohide]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.autohide === String(readerAutoHideEnabled));
  });
  if (!readerAutoHideEnabled) {
    setHudVisibility(true);
  }

  updateReadingProgress(currentPageNumber);
}

// Eventos de cambios en Ajustes
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

// Toque en el lienzo del lector para alternar la barra superior (HUD)
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

// Alternar panel de ajustes
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

// Auto-cierre si el cursor sale del panel o si no se interactúa
settingsPanel?.addEventListener('mouseenter', () => clearTimeout(settingsAutoCloseTimer));
settingsPanel?.addEventListener('mousemove', () => resetSettingsAutoClose(4000));
settingsPanel?.addEventListener('mouseleave', () => resetSettingsAutoClose(1200));

// Al hacer scroll o hacer clic fuera del panel, cerrarlo inmediatamente para no estorbar
window.addEventListener('scroll', closeSettingsPanel, { passive: true });
document.addEventListener('click', e => {
  if (settingsPanel && !settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    closeSettingsPanel();
  }
});

// Pantalla completa
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

fullscreenBtn?.addEventListener('click', toggleFullscreen);

// Modal de atajos de teclado
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

// Atajos de teclado para navegación fluida
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

// Inicializar ajustes y arrancar lector
applyReaderSettings();
loadChapter();
