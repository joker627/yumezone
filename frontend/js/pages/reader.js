import { renderSiteHeader } from '../components/header.js';
import { apiRequest, getAccessToken } from '../shared/auth.js';
import { API_BASE_URL } from '../api/api-config.js';
import { makeWorkUrl, makeReaderUrl, safeUrl, IMG_FALLBACK } from '../shared/ui-utils.js';

// Inicializar cabecera si existe (se oculta en reader.css para máxima inmersión)
const headerEl = document.getElementById('header');
if (headerEl) renderSiteHeader(headerEl);

const params = new URLSearchParams(window.location.search);
let rawSlug = params.get('slug')?.trim();
let slug = rawSlug && rawSlug !== '[object Object]' ? rawSlug : null;
let chapterId = Number(params.get('chapter_id') || params.get('chapter') || 0);
let targetPage = Number(params.get('page') || params.get('p') || 0);

// Elementos del DOM - Barras de navegación
const toolbarEl = document.getElementById('reader-toolbar');
const footerEl = document.getElementById('reader-footer');
const workTitleEl = document.getElementById('reader-work-title');
const chapterTitleEl = document.getElementById('reader-chapter-title');
const pageIndicatorEl = document.getElementById('reader-page-indicator');
const backLinkEl = document.getElementById('reader-back');
const chapterSelectEl = document.getElementById('reader-chapter-select');
const pageJumpSelectEl = document.getElementById('reader-page-jump-select');
const progressBarEl = document.getElementById('reader-progress-bar');
const scrollTopBtn = document.getElementById('reader-scroll-top');

// Botones de navegación superior e inferior
const topPrevBtn = document.getElementById('reader-top-prev-btn');
const topNextBtn = document.getElementById('reader-top-next-btn');
const prevBtn = document.getElementById('reader-prev-btn');
const nextBtn = document.getElementById('reader-next-btn');

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

// Verificar si el capítulo ya fue leído para no duplicar conteos
async function checkChapterReadStatus(workId, chId) {
  readingStartTime = Date.now();
  viewLoggedForThisChapter = false;
  isChapterAlreadyRead = false;

  // 1. Si el usuario está autenticado, validar contra capítulos leídos en el servidor
  if (getAccessToken() && workId) {
    try {
      const readChapters = await apiRequest(`/library/works/${workId}/read-chapters`).catch(() => []);
      if (Array.isArray(readChapters) && readChapters.includes(Number(chId))) {
        isChapterAlreadyRead = true;
        viewLoggedForThisChapter = true; // Ya fue leído previamente: no volver a contar
        return;
      }
    } catch (e) {
      console.warn('Error verificando capítulos leídos:', e);
    }
  }

  // 2. Si no está autenticado (o como respaldo de dispositivo), validar en localStorage
  try {
    const anonReads = JSON.parse(localStorage.getItem('yumezone_anon_read_chapters') || '{}');
    if (anonReads[chId]) {
      isChapterAlreadyRead = true;
      viewLoggedForThisChapter = true; // Ya fue leído en este navegador: no volver a contar
    }
  } catch (e) {}
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
  } catch (e) {}

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
    }).catch(() => {});
  }
}

// Guardado inmediato para garantizar persistencia al salir, retroceder o cambiar de capítulo
function flushSaveProgress(immediatePage = null) {
  const pageToSave = Number(immediatePage || currentPageNumber || 1);
  const wId = parseInt(currentWork?.id || currentWorkId || 0, 10);
  const cId = parseInt(chapterId, 10);
  if (!cId || !pageToSave || pageToSave < 1) return;

  // 1. Guardar localmente de inmediato
  try {
    localStorage.setItem(`yumezone_last_page_${cId}`, String(pageToSave));
    if (wId) {
      const historyMap = JSON.parse(localStorage.getItem('yumezone_reading_history') || '{}');
      historyMap[wId] = {
        work_id: wId,
        chapter_id: cId,
        last_page_read: pageToSave,
        updated_at: Date.now()
      };
      localStorage.setItem('yumezone_reading_history', JSON.stringify(historyMap));
    }
  } catch (e) {}

  lastSavedPage = pageToSave;

  // 2. Si está autenticado y tenemos wId, enviar a la API
  const token = getAccessToken();
  if (token && wId) {
    clearTimeout(saveHistoryTimeout);
    
    // Envío regular via apiRequest
    apiRequest('/library/history', {
      method: 'POST',
      body: { work_id: wId, chapter_id: cId, last_page_read: pageToSave }
    }).catch(() => {});

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
      }).catch(() => {});
    } catch (e) {}
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
    // Si no se proporcionó chapterId pero sí el slug, resolver el primer capítulo disponible
    if (!chapterId && slug) {
      try {
        currentWork = await apiRequest(`/works/${encodeURIComponent(slug)}`);
        if (currentWork?.id) {
          allChapters = await apiRequest(`/chapters/work/${currentWork.id}?published_only=true&order=asc`).catch(() => []);
          if (allChapters.length) {
            chapterId = allChapters[0].id;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('chapter_id', String(chapterId));
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
      } catch (e) {
        console.warn('Error resolviendo capítulo inicial por slug:', e);
      }
    }

    if (!chapterId) {
      showError('No se especificó un capítulo válido para leer.');
      return;
    }

    // 1. Cargar metadatos del capítulo
    let chapterMeta = allChapters.find(c => c.id === chapterId);
    if (!chapterMeta) {
      chapterMeta = await apiRequest(`/chapters/${chapterId}`);
    }

    if (!chapterMeta) {
      showError('El capítulo solicitado no existe o fue despublicado.');
      return;
    }

    // 2. Cargar obra y lista completa de capítulos
    const workId = parseInt(chapterMeta.work_id, 10);
    currentWorkId = workId || currentWorkId;
    if (workId && (!currentWork || !allChapters.length)) {
      try {
        if (slug) {
          currentWork = await apiRequest(`/works/${encodeURIComponent(slug)}`).catch(() => null);
        }
        if (!currentWork && workId) {
          currentWork = await apiRequest(`/works/${workId}`).catch(() => null);
          if (currentWork?.slug) {
            slug = currentWork.slug;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('slug', slug);
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
        allChapters = await apiRequest(`/chapters/work/${workId}?published_only=true&order=asc`).catch(() => []);
      } catch (err) {
        console.warn('No se pudo precargar la lista completa de capítulos:', err);
      }
    }

    // 3. Cargar las páginas del capítulo
    const pages = await apiRequest(`/chapters/${chapterId}/pages`).catch(() => []);

    // Resolver página objetivo más reciente:
    // 1) Progreso fresco en este dispositivo (localStorage)
    let localPage = 0;
    try {
      localPage = Number(localStorage.getItem(`yumezone_last_page_${chapterId}`) || 0);
    } catch (e) {}

    // 2) Progreso guardado en servidor para usuario autenticado
    let serverPage = 0;
    if (getAccessToken() && workId) {
      try {
        const libWork = await apiRequest(`/library/${workId}`).catch(() => null);
        const prog = libWork?.item?.reading_progress;
        if (prog && Number(prog.chapter_id) === Number(chapterId) && Number(prog.last_page_read) > 0) {
          serverPage = Number(prog.last_page_read);
        }
      } catch (e) {}
    }

    // El progreso real más reciente prevalece sobre parámetros estáticos de URL viejos
    const freshestSavedPage = localPage > 0 ? localPage : serverPage;
    if (freshestSavedPage > 1) {
      targetPage = freshestSavedPage;
    }

    renderHeaderInfo(chapterMeta);
    renderChapterSelect();
    renderNavigation(chapterMeta);
    renderPages(pages, chapterMeta);

    if (targetPage > 1) {
      scrollToTargetPage(targetPage);
    }

    // 4. Verificar estado de lectura para evitar lecturas en falso o conteos repetidos
    const wId = parseInt(chapterMeta?.work_id || currentWork?.id, 10);
    const cId = parseInt(chapterId, 10);
    if (wId > 0 && cId > 0) {
      await checkChapterReadStatus(wId, cId);
    }

    showLoading(false);
  } catch (err) {
    showError(err.message || 'Error al cargar las páginas del capítulo.');
  }
}

function renderHeaderInfo(chapter) {
  const num = chapter?.chapter_number != null ? `Capítulo ${chapter.chapter_number}` : `Capítulo #${chapterId}`;
  const title = chapter?.title ? `${num}: ${chapter.title}` : num;
  if (chapterTitleEl) chapterTitleEl.textContent = title;
  document.title = `${title} | YumeZone`;

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
    chapterSelectEl.append(opt);
  });
}

function renderNavigation(chapter) {
  if (!allChapters.length) {
    if (topPrevBtn) topPrevBtn.disabled = true;
    if (topNextBtn) topNextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (endCardEl) endCardEl.hidden = true;
    return;
  }

  const currentIndex = allChapters.findIndex(c => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  // Botones superiores e inferiores
  const syncButtons = (pBtn, nBtn) => {
    if (pBtn) {
      pBtn.disabled = !prevChapter;
      pBtn.onclick = () => { if (prevChapter) navigateToChapter(prevChapter.id); };
    }
    if (nBtn) {
      nBtn.disabled = !nextChapter;
      nBtn.onclick = () => { if (nextChapter) navigateToChapter(nextChapter.id); };
    }
  };

  syncButtons(topPrevBtn, topNextBtn);
  syncButtons(prevBtn, nextBtn);

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
  flushSaveProgress();
  const newParams = new URLSearchParams(window.location.search);
  newParams.set('chapter_id', String(newChapterId));
  newParams.delete('page');
  newParams.delete('p');
  if (slug) newParams.set('slug', slug);
  window.location.search = newParams.toString();
}

// Actualiza el progreso visual sin repetir porcentajes numéricos
function updateReadingProgress(currentPage = 1) {
  if (!totalPagesCount || totalPagesCount === 0) {
    if (progressBarEl) progressBarEl.style.width = '0%';
    if (pageIndicatorEl) pageIndicatorEl.textContent = 'Sin páginas';
    if (pageJumpSelectEl) {
      pageJumpSelectEl.replaceChildren();
      const emptyOpt = document.createElement('option');
      emptyOpt.textContent = '0 / 0';
      pageJumpSelectEl.append(emptyOpt);
    }
    return;
  }

  const boundedPage = Math.min(Math.max(1, currentPage), totalPagesCount);
  const percentage = Math.round((boundedPage / totalPagesCount) * 100);

  // Barra de progreso delgada arriba
  if (progressBarEl) progressBarEl.style.width = `${percentage}%`;

  // Indicador sobrio y elegante: solo números de página
  if (pageIndicatorEl) {
    pageIndicatorEl.textContent = `Pág. ${boundedPage} / ${totalPagesCount}`;
  }

  // Sincronizar el selector de salto rápido del dock inferior
  if (pageJumpSelectEl && pageJumpSelectEl.value !== String(boundedPage)) {
    pageJumpSelectEl.value = String(boundedPage);
  }
}

// Configura las opciones del desplegable de salto rápido a página
function buildPageJumpSelect() {
  if (!pageJumpSelectEl) return;
  pageJumpSelectEl.replaceChildren();

  for (let i = 1; i <= totalPagesCount; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Pág. ${i} de ${totalPagesCount}`;
    pageJumpSelectEl.append(opt);
  }
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

  // Auto-ocultar barras HUD al hacer scroll hacia abajo para máxima inmersión
  if (Math.abs(currentY - lastScrollY) > 25) {
    if (currentY > 120 && currentY > lastScrollY) {
      // Ocultar si vamos bajando
      setHudVisibility(false);
    } else if (currentY < lastScrollY) {
      // Mostrar si vamos subiendo
      setHudVisibility(true);
    }
    lastScrollY = currentY;
  }

  // Cálculo de página activa
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

  currentPageNumber = activePageNumber;
  updateReadingProgress(activePageNumber);

  // Guardar en localStorage de inmediato la página actual (adelante o atrás)
  try {
    localStorage.setItem(`yumezone_last_page_${chapterId}`, String(activePageNumber));
  } catch (e) {}

  // Guardar en backend siempre que cambie de página (hacia adelante o atrás)
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

function setHudVisibility(visible) {
  isHudHidden = !visible;
  if (toolbarEl) {
    toolbarEl.classList.toggle('is-hidden', !visible);
  }
  if (footerEl) {
    footerEl.classList.toggle('is-hidden', !visible);
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
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      </div>
      <h3>Capítulo en preparación</h3>
      <p>Este capítulo aún no tiene paneles o páginas subidas por el equipo de scanlation. ¡Vuelve pronto!</p>
    `;
    pagesContainerEl.append(emptyBox);
    updateReadingProgress(0);
    if (endCardEl) endCardEl.hidden = true;
    return;
  }

  buildPageJumpSelect();
  currentPageNumber = 1;
  updateReadingProgress(1);

  pagesArray.forEach((p, idx) => {
    const pageNum = idx + 1;
    const pageItem = document.createElement('div');
    pageItem.className = 'reader-page-item';
    pageItem.id = `reader-page-${pageNum}`;
    pageItem.dataset.pageNumber = String(pageNum);

    // Badge discreto en esquina (sutil al hover)
    const badge = document.createElement('span');
    badge.className = 'reader-page-badge';
    badge.textContent = `${pageNum}`;
    pageItem.append(badge);

    const hasValidImage = Boolean(p.image_url && p.image_url.trim());

    if (hasValidImage) {
      const img = document.createElement('img');
      img.className = 'reader-page-img';
      img.src = safeUrl(p.image_url, IMG_FALLBACK);
      img.alt = `Página ${pageNum}`;
      img.loading = idx < 2 ? 'eager' : 'lazy';

      img.onerror = () => {
        if (!img.dataset.fallbackTried) {
          img.dataset.fallbackTried = 'true';
          img.src = IMG_FALLBACK;
        } else {
          pageItem.classList.add('reader-page-placeholder');
          img.remove();
          renderPagePlaceholder(pageItem, pageNum, chapter, true);
        }
      };

      pageItem.append(img);
    } else {
      pageItem.classList.add('reader-page-placeholder');
      renderPagePlaceholder(pageItem, pageNum, chapter, false);
    }

    pagesContainerEl.append(pageItem);
  });

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
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
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

// Salto directo a una página desde el select del dock
pageJumpSelectEl?.addEventListener('change', e => {
  const targetPage = Number(e.target.value);
  if (targetPage) {
    const targetEl = document.getElementById(`reader-page-${targetPage}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

// Botón para subir al inicio
scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Selector de capítulo superior
chapterSelectEl?.addEventListener('change', e => {
  const selectedId = Number(e.target.value);
  if (selectedId && selectedId !== chapterId) {
    navigateToChapter(selectedId);
  }
});

// Reintentar en caso de fallo
retryBtn?.addEventListener('click', loadChapter);

// ==========================================================================
// Configuración de Ajustes de Lectura y Persistencia
// ==========================================================================
const STORAGE_WIDTH_KEY = 'yumezone_reader_width';
const STORAGE_GAP_KEY = 'yumezone_reader_gap';

function applyReaderSettings() {
  const savedWidth = localStorage.getItem(STORAGE_WIDTH_KEY) || 'standard';
  const savedGap = localStorage.getItem(STORAGE_GAP_KEY) || 'seamless';

  if (viewportEl) {
    viewportEl.classList.remove('reader-width--narrow', 'reader-width--standard', 'reader-width--full');
    viewportEl.classList.add(`reader-width--${savedWidth}`);
  }

  if (pagesContainerEl) {
    pagesContainerEl.classList.toggle('reader-pages--seamless', savedGap === 'seamless');
  }

  // Sincronizar botones de segmentos
  document.querySelectorAll('[data-width]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.width === savedWidth);
  });
  document.querySelectorAll('[data-gap]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.gap === savedGap);
  });
}

// Eventos de cambios en Ajustes
document.querySelectorAll('[data-width]').forEach(btn => {
  btn.addEventListener('click', () => {
    const width = btn.dataset.width;
    localStorage.setItem(STORAGE_WIDTH_KEY, width);
    applyReaderSettings();
  });
});

document.querySelectorAll('[data-gap]').forEach(btn => {
  btn.addEventListener('click', () => {
    const gap = btn.dataset.gap;
    localStorage.setItem(STORAGE_GAP_KEY, gap);
    applyReaderSettings();
  });
});

// Alternar panel de ajustes
settingsBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const isHidden = settingsPanel.hidden;
  settingsPanel.hidden = !isHidden;
  settingsBtn.setAttribute('aria-expanded', String(isHidden));
});

settingsCloseBtn?.addEventListener('click', () => {
  if (settingsPanel) {
    settingsPanel.hidden = true;
    settingsBtn?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('click', e => {
  if (settingsPanel && !settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    settingsPanel.hidden = true;
    settingsBtn?.setAttribute('aria-expanded', 'false');
  }
});

// Pantalla completa
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

fullscreenBtn?.addEventListener('click', toggleFullscreen);

// Modal de atajos de teclado
shortcutsBtn?.addEventListener('click', () => {
  if (shortcutsModal) {
    if (settingsPanel) settingsPanel.hidden = true;
    shortcutsModal.showModal();
  }
});

shortcutsCloseBtn?.addEventListener('click', () => {
  if (shortcutsModal) shortcutsModal.close();
});

shortcutsModal?.addEventListener('click', e => {
  if (e.target === shortcutsModal) shortcutsModal.close();
});

// Atajos de teclado para navegación rápida
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    if (nextBtn && !nextBtn.disabled) nextBtn.click();
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    if (prevBtn && !prevBtn.disabled) prevBtn.click();
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  } else if (e.key === 'h' || e.key === 'H') {
    setHudVisibility(isHudHidden);
  } else if (e.key === '?') {
    if (shortcutsModal) shortcutsModal.showModal();
  } else if (e.key === 'Escape') {
    if (settingsPanel) settingsPanel.hidden = true;
    if (shortcutsModal && shortcutsModal.open) shortcutsModal.close();
  }
});

// Inicializar ajustes y arrancar lector
applyReaderSettings();
loadChapter();
