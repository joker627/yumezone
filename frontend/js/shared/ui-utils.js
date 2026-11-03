// utilidades ui

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
  // validar url
  return url.replace(/["'<>]/g, '');
}

// fallback imagenes
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

export function formatChapterNumber(value) {
  if (value == null || value === '') return '0.0';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return String(value);
  return num.toFixed(1);
}

export function makeReaderUrl(slugOrWork, chapterOrId, page = null) {
  let slug = slugOrWork;
  let ch = chapterOrId;
  if (typeof slugOrWork === 'object' && slugOrWork !== null) {
    slug = slugOrWork.slug || slugOrWork.work_slug;
    ch = ch ?? slugOrWork.chapter_number ?? slugOrWork.first_chapter_number ?? slugOrWork.chapter_id ?? slugOrWork.first_chapter_id;
  }
  let capVal = ch;
  let chId = null;
  if (typeof ch === 'object' && ch !== null) {
    capVal = ch.chapter_number != null ? ch.chapter_number : ch.id;
    chId = ch.id != null ? ch.id : null;
  }
  if (!slug || slug === '[object Object]' || capVal == null) return null;
  const formattedCap = formatChapterNumber(capVal);
  let url = `/pages/leer.html?obra=${encodeURIComponent(slug)}&capitulo=${encodeURIComponent(formattedCap)}`;
  if (chId != null) {
    url += `&chapter_id=${encodeURIComponent(chId)}`;
  }
  if (page && Number(page) > 1) {
    url += `&page=${encodeURIComponent(page)}`;
  }
  return url;
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
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}mn`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  return `${years}y`;
}

export function applyDataProgress(root = document) {
  root.querySelectorAll('[data-progress]').forEach((el) => {
    el.style.width = `${el.dataset.progress}%`;
  });
}

const SVG_ICON_MAP = {
  // actions
  check: 'actions/check',
  clear: 'actions/clear',
  copy: 'actions/copy',
  'eye-off': 'actions/eye-off',
  eye: 'actions/eye',
  view: 'actions/eye',
  filter: 'actions/filter',
  flag: 'actions/flag',
  heart: 'actions/heart',
  play: 'actions/play',
  reply: 'actions/reply',
  search: 'actions/search',
  send: 'actions/send',
  swap: 'actions/swap',
  'thumbs-up': 'actions/thumbs-up',
  x: 'actions/x',
  // content
  book: 'content/book',
  chapter: 'content/grid',
  comment: 'content/comment',
  chat: 'content/comment',
  grid: 'content/grid',
  info: 'content/info',
  warning: 'content/warning',
  // gamification
  award: 'gamification/award',
  banner: 'gamification/banner',
  bolt: 'gamification/bolt',
  sparkles: 'gamification/bolt',
  coin: 'gamification/coin',
  fire: 'gamification/fire',
  flame: 'gamification/fire',
  frame: 'gamification/frame',
  star: 'gamification/star',
  verified: 'gamification/verified',
  // navigation
  'arrow-left': 'navigation/arrow-left',
  'arrow-right': 'navigation/arrow-right',
  'chevron-down': 'navigation/chevron-down',
  history: 'navigation/history',
  home: 'navigation/home',
  library: 'navigation/library',
  menu: 'navigation/menu',
  'panel-expand': 'navigation/panel-expand',
  shop: 'navigation/shop',
  trending: 'navigation/trending',
  globe: 'navigation/trending',
  // social
  discord: 'social/discord',
  facebook: 'social/facebook',
  mail: 'social/mail',
  telegram: 'social/telegram',
  // user
  bell: 'user/bell',
  lock: 'user/lock',
  login: 'user/login',
  logout: 'user/logout',
  settings: 'user/settings',
  user: 'user/user',
  users: 'user/users',
};

export function resolveIconPath(iconName) {
  const clean = String(iconName || 'info').trim().replace(/\.svg$/i, '');
  const mapped = clean.includes('/') ? clean : (SVG_ICON_MAP[clean] || 'content/info');
  return `/assets/icons/svg/${mapped}.svg`;
}
