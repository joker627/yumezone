/**
 * Utilidades compartidas para formateo, URLs, escape de HTML y fallbacks de imágenes.
 */

export function sanitizeHtmlAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const SAFE_URL_PATTERN = /^(?:https?:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*|#[^\s"'<>]*|\.[^\s"'<>]*)$/i;

export const IMG_FALLBACK = '/assets/up-image.webp';

export function safeUrl(value, fallback = '#') {
  const url = String(value ?? '').trim();
  if (!url || !SAFE_URL_PATTERN.test(url)) {
    return fallback;
  }
  // Evitar romper URLs con & convirtiéndolas en &amp; para contextos JS DOM
  return url.replace(/["'<>]/g, '');
}

// Fallback global automático para imágenes rotas
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.target?.tagName === 'IMG' && !e.target.src.includes(IMG_FALLBACK)) {
      e.target.src = IMG_FALLBACK;
    }
  }, true);
}

export function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export const esc = escapeHTML;


export function makeWorkUrl(slugOrWork) {
  let slug = slugOrWork;
  if (typeof slugOrWork === 'object' && slugOrWork !== null) {
    slug = slugOrWork.slug || slugOrWork.work_slug;
  }
  if (!slug || slug === '[object Object]') return '/pages/catalogo.html';
  return `/pages/obra.html?slug=${encodeURIComponent(slug)}`;
}

export function makeReaderUrl(slugOrWork, chapterOrId, page = null) {
  let slug = slugOrWork;
  let ch = chapterOrId;
  if (typeof slugOrWork === 'object' && slugOrWork !== null) {
    slug = slugOrWork.slug || slugOrWork.work_slug;
    ch = ch ?? slugOrWork.chapter_number ?? slugOrWork.first_chapter_number ?? slugOrWork.chapter_id ?? slugOrWork.first_chapter_id;
  }
  let capVal = ch;
  if (typeof ch === 'object' && ch !== null) {
    capVal = ch.chapter_number ?? ch.id;
  }
  if (!slug || slug === '[object Object]' || capVal == null) return null;
  return `/pages/leer.html?obra=${encodeURIComponent(slug)}&capitulo=${encodeURIComponent(capVal)}`;
}

export function formatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: maxDigits }).format(Number(value) || 0);
}

export function formatViews(views) {
  if (!views) return '';
  const v = Number(views);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M lecturas`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k lecturas`;
  return `${v} lecturas`;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Hace un momento';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Hace un momento';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Hace un momento';
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
  return `Hace ${Math.floor(diffSec / 86400)} d`;
}

export function formatTimeAgoCompact(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'ahora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  return `${years}y`;
}

export function applyDataProgress(root = document) {
  root.querySelectorAll('[data-progress]').forEach((el) => {
    el.style.width = `${el.dataset.progress}%`;
  });
}
