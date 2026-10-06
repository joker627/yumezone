/**
 * reader.js
 * Controlador del lector inmersivo de capítulos de YumeZone.
 */

import { API_BASE_URL } from '../api/api-config.js';
import { renderSiteHeader } from '../components/header.js';
import { safeUrl } from '../shared/url-utils.js';

const headerEl = document.getElementById('header');
if (headerEl) renderSiteHeader(headerEl);

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug')?.trim();
let chapterId = Number(params.get('chapter_id') || params.get('chapter') || 0);

const workTitleEl = document.getElementById('reader-work-title');
const chapterTitleEl = document.getElementById('reader-chapter-title');
const backLinkEl = document.getElementById('reader-back');
const chapterSelectEl = document.getElementById('reader-chapter-select');
const pagesContainerEl = document.getElementById('reader-pages');
const loadingEl = document.getElementById('reader-loading');
const errorEl = document.getElementById('reader-error');
const errorMsgEl = document.getElementById('reader-error-msg');
const retryBtn = document.getElementById('reader-retry-btn');
const prevBtn = document.getElementById('reader-prev-btn');
const nextBtn = document.getElementById('reader-next-btn');
const counterEl = document.getElementById('reader-page-counter');

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/+$/, '')}/v1${path}`;
}

async function apiFetch(path) {
  const res = await fetch(apiUrl(path), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

let allChapters = [];
let currentWork = null;

async function loadChapter() {
  if (!chapterId) {
    showError('No se especificó un capítulo válido.');
    return;
  }

  showLoading(true);

  try {
    // 1. Si tenemos slug pero no work, cargar obra y sus capítulos
    if (slug && (!currentWork || !allChapters.length)) {
      currentWork = await apiFetch(`/works/${encodeURIComponent(slug)}`);
      if (currentWork?.id) {
        allChapters = await apiFetch(`/chapters/work/${currentWork.id}`).catch(() => []);
        allChapters = allChapters
          .filter(c => c.status === 'PUBLISHED')
          .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
      }
    }

    // 2. Si no tenemos lista de capítulos pero tenemos chapterId, buscar el capítulo para obtener work_id
    let chapterMeta = allChapters.find(c => c.id === chapterId);
    if (!chapterMeta) {
      chapterMeta = await apiFetch(`/chapters/${chapterId}`);
      if (chapterMeta && !allChapters.length && chapterMeta.work_id) {
        allChapters = await apiFetch(`/chapters/work/${chapterMeta.work_id}`).catch(() => []);
        allChapters = allChapters
          .filter(c => c.status === 'PUBLISHED')
          .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
      }
    }

    // 3. Obtener páginas
    const pages = await apiFetch(`/chapters/${chapterId}/pages`);

    // 4. Renderizar UI
    renderHeaderInfo(chapterMeta);
    renderChapterSelect();
    renderNavigation(chapterMeta);
    renderPages(pages);

    showLoading(false);
  } catch (err) {
    showError(err.message || 'Error al cargar las páginas del capítulo.');
  }
}

function renderHeaderInfo(chapter) {
  const num = chapter?.chapter_number != null ? `Capítulo ${chapter.chapter_number}` : `Capítulo #${chapterId}`;
  const title = chapter?.title ? `${num}: ${chapter.title}` : num;
  chapterTitleEl.textContent = title;
  document.title = `${title} | YumeZone`;

  if (currentWork) {
    workTitleEl.textContent = currentWork.title || 'Volver a la obra';
    backLinkEl.href = `/pages/obra.html?slug=${encodeURIComponent(currentWork.slug)}`;
  } else if (slug) {
    backLinkEl.href = `/pages/obra.html?slug=${encodeURIComponent(slug)}`;
  }
}

function renderChapterSelect() {
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
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const currentIndex = allChapters.findIndex(c => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  prevBtn.disabled = !prevChapter;
  nextBtn.disabled = !nextChapter;

  prevBtn.onclick = () => {
    if (prevChapter) navigateToChapter(prevChapter.id);
  };
  nextBtn.onclick = () => {
    if (nextChapter) navigateToChapter(nextChapter.id);
  };
}

function navigateToChapter(newChapterId) {
  const newParams = new URLSearchParams(window.location.search);
  newParams.set('chapter_id', String(newChapterId));
  if (slug) newParams.set('slug', slug);
  window.location.search = newParams.toString();
}

function renderPages(pages) {
  pagesContainerEl.replaceChildren();

  if (!pages || !pages.length) {
    pagesContainerEl.innerHTML = `
      <div class="reader-status">
        <p>Este capítulo aún no tiene páginas disponibles.</p>
      </div>`;
    counterEl.textContent = '0 páginas';
    return;
  }

  counterEl.textContent = `${pages.length} páginas`;

  pages.forEach((p, idx) => {
    const img = document.createElement('img');
    img.className = 'reader-page-img';
    img.src = safeUrl(p.image_url, '');
    img.alt = `Página ${idx + 1}`;
    img.loading = idx < 2 ? 'eager' : 'lazy';
    pagesContainerEl.append(img);
  });
}

function showLoading(isLoading) {
  loadingEl.hidden = !isLoading;
  errorEl.hidden = true;
  if (isLoading) pagesContainerEl.replaceChildren();
}

function showError(msg) {
  loadingEl.hidden = true;
  errorEl.hidden = false;
  errorMsgEl.textContent = msg;
}

chapterSelectEl.addEventListener('change', e => {
  const selectedId = Number(e.target.value);
  if (selectedId && selectedId !== chapterId) {
    navigateToChapter(selectedId);
  }
});

retryBtn?.addEventListener('click', loadChapter);

loadChapter();
