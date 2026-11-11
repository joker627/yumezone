import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc as escapeHtml, resolveIconPath, formatChapterNumber } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import { renderCoinTxSkeletons } from '../components/skeletons.js';

let currentProfileData = null;
let cachedCoinTransactions = [];
let ownerInventory = [];
let currentLibraryTab = 'READING';

const DEFAULT_BANNER_PRESETS = [
  { name: 'Clásico Oscuro (Por defecto)', url: '' }
];

const DEFAULT_FRAME_PRESETS = [
  { name: 'Sin marco', url: '' }
];

const COUNTRY_MAP = {
  CO: { flag: '🇨🇴', name: 'Colombia' },
  MX: { flag: '🇲🇽', name: 'México' },
  AR: { flag: '🇦🇷', name: 'Argentina' },
  ES: { flag: '🇪🇸', name: 'España' },
  CL: { flag: '🇨🇱', name: 'Chile' },
  PE: { flag: '🇵🇪', name: 'Perú' },
  VE: { flag: '🇻🇪', name: 'Venezuela' },
  EC: { flag: '🇪🇨', name: 'Ecuador' },
  UY: { flag: '🇺🇾', name: 'Uruguay' },
  PY: { flag: '🇵🇾', name: 'Paraguay' },
  BO: { flag: '🇧🇴', name: 'Bolivia' },
  CR: { flag: '🇨🇷', name: 'Costa Rica' },
  PA: { flag: '🇵🇦', name: 'Panamá' },
  DO: { flag: '🇩🇴', name: 'Rep. Dominicana' },
  GT: { flag: '🇬🇹', name: 'Guatemala' },
  SV: { flag: '🇸🇻', name: 'El Salvador' },
  HN: { flag: '🇭🇳', name: 'Honduras' },
  NI: { flag: '🇳🇮', name: 'Nicaragua' },
  PR: { flag: '🇵🇷', name: 'Puerto Rico' },
  US: { flag: '🇺🇸', name: 'Estados Unidos' },
  BR: { flag: '🇧🇷', name: 'Brasil' },
  JP: { flag: '🇯🇵', name: 'Japón' },
  KR: { flag: '🇰🇷', name: 'Corea del Sur' }
};

async function resolveIdentifier() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (params.get('u')) return params.get('u');
  if (params.get('id')) return params.get('id');

  if (path.startsWith('/@')) return decodeURIComponent(path.substring(2));
  if (path.startsWith('/u/')) return decodeURIComponent(path.substring(3));

  if (getAccessToken()) {
    try {
      const me = await apiRequest('/auth/me');
      if (me) return me.username || me.user_code || String(me.id);
    } catch (_) {}
  }
  return null;
}

function getFallbackAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=00bfa6&color=fff&size=256`;
}

function formatRoleLabel(role) {
  const map = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    SCAN: 'Líder Scan',
    USER: 'Lector'
  };
  return map[role] || role;
}

function formatScanRole(role) {
  const map = {
    LEADER: 'Líder',
    CO_LEADER: 'Co-Líder',
    UPLOADER: 'Uploader',
    EDITOR: 'Editor',
    TRANSLATOR: 'Traductor'
  };
  return map[role] || role || 'Miembro';
}

function formatCategoryLabel(cat) {
  const map = {
    BANNER: 'Portada',
    FRAME: 'Anillo',
    TITLE: 'Título',
    BADGE: 'Insignia',
    AVATAR: 'Avatar'
  };
  return map[(cat || '').toUpperCase()] || cat || 'Cosmético';
}

function getRelativeTime(dateStr) {
  if (!dateStr) return 'Hace poco';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Hace poco';

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Hace unos segundos';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays} d`;

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadProfile() {
  const identifier = await resolveIdentifier();
  if (!identifier) {
    window.location.href = '/pages/login.html';
    return;
  }

  try {
    const cleanId = identifier.replace(/^@/, '');
    const user = await apiRequest(`/users/${encodeURIComponent(cleanId)}`);
    currentProfileData = user;
    ownerInventory = Array.isArray(user.inventory_items) ? user.inventory_items : [];
    renderProfile(user);
  } catch (err) {
    console.error('Error cargando perfil:', err);
    renderNotFound();
  }
}

async function loadOwnerInventory() {
  try {
    const items = await apiRequest('/shop/inventory');
    if (Array.isArray(items)) {
      ownerInventory = items;
    }
  } catch (_) {}
}

function renderProfile(user) {
  document.title = `${user.username} (@${user.user_code}) | YumeZone`;

  // banner de portada
  const bannerEl = document.getElementById('profile-banner-bg');
  if (bannerEl) {
    if (user.banner_url) {
      bannerEl.style.backgroundImage = `url('${user.banner_url}')`;
      bannerEl.classList.add('has-custom-banner');
    } else {
      bannerEl.style.backgroundImage = '';
      bannerEl.classList.remove('has-custom-banner');
    }
  }

  // avatar y marco cosmético
  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    avatarEl.classList.remove('yz-skeleton');
    avatarEl.alt = user.username || '';
    avatarEl.src = user.avatar_url || getFallbackAvatar(user.username);
    avatarEl.onerror = () => {
      avatarEl.src = getFallbackAvatar(user.username);
    };
  }

  const frameUrl = user.anillo_url || user.avatar_frame_url || '';
  const frameEl = document.getElementById('user-avatar-frame');
  const avatarBox = document.getElementById('profile-avatar-box');
  if (frameEl && avatarBox) {
    if (frameUrl) {
      frameEl.src = frameUrl;
      frameEl.style.display = 'block';
      avatarBox.classList.add('has-frame');
    } else {
      frameEl.src = '';
      frameEl.style.display = 'none';
      avatarBox.classList.remove('has-frame');
    }
  }

  // nombre, handle, rol y título activo
  const displayNameEl = document.getElementById('user-display-name');
  if (displayNameEl) displayNameEl.textContent = user.username;

  const handleEl = document.getElementById('user-handle');
  if (handleEl) handleEl.textContent = `@${user.user_code}`;

  const role = (user.platform_role || 'USER').toUpperCase();
  const verifiedBadge = document.getElementById('verified-badge');
  if (verifiedBadge) {
    verifiedBadge.style.display = (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'SCAN' || user.scan_group)
      ? 'inline-flex'
      : 'none';
  }

  const rolePill = document.getElementById('user-role-pill');
  if (rolePill) {
    if (role !== 'USER') {
      rolePill.style.display = 'inline-flex';
      rolePill.textContent = formatRoleLabel(role);
      rolePill.className = `profile-role-badge role-${role.toLowerCase()}`;
    } else {
      rolePill.style.display = 'none';
    }
  }

  // nivel y rango xp
  const lvl = user.level_info || {
    level: Math.floor((user.xp || 0) / 1000) + 1,
    current_level_xp: (user.xp || 0) % 1000,
    remaining_xp: 1000 - ((user.xp || 0) % 1000),
    percentage: Math.round((((user.xp || 0) % 1000) / 1000) * 100),
    current_title: 'Iniciado del Cultivo',
    next_title: 'Lector Novato'
  };

  const levelBadge = document.getElementById('user-level-badge');
  if (levelBadge) levelBadge.textContent = `Nv. ${lvl.level}`;

  const activeTitleEl = document.getElementById('user-active-title');
  if (activeTitleEl) {
    const titleToShow = lvl.current_title;
    if (titleToShow) {
      activeTitleEl.textContent = titleToShow;
      activeTitleEl.style.display = 'inline-flex';
    } else {
      activeTitleEl.style.display = 'none';
    }
  }

  const rankNameEl = document.getElementById('user-rank-name');
  if (rankNameEl) rankNameEl.textContent = lvl.current_title;

  const xpNumbersEl = document.getElementById('user-xp-numbers');
  if (xpNumbersEl) xpNumbersEl.textContent = `${lvl.current_level_xp.toLocaleString()} / 1,000 XP`;

  const xpFillEl = document.getElementById('user-xp-fill');
  if (xpFillEl) xpFillEl.style.width = `${Math.min(100, Math.max(0, lvl.percentage))}%`;

  const nextRankHint = document.getElementById('user-next-rank-hint');
  if (nextRankHint) {
    nextRankHint.textContent = `Faltan ${lvl.remaining_xp.toLocaleString()} XP para Nv. ${lvl.level + 1} · ${lvl.next_title}`;
  }

  // país, fecha de ingreso y scan
  const countryCode = (user.country || 'CO').toUpperCase();
  const countryData = COUNTRY_MAP[countryCode] || { flag: '🌎', name: countryCode };
  const flagEl = document.getElementById('user-country-flag');
  const countryNameEl = document.getElementById('user-country-name');
  if (flagEl) flagEl.textContent = countryData.flag;
  if (countryNameEl) countryNameEl.textContent = countryData.name;

  const joinedEl = document.getElementById('user-joined');
  if (joinedEl && user.created_at) {
    const date = new Date(user.created_at);
    const formatted = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    joinedEl.innerHTML = `<img src="/assets/icons/svg/navigation/history.svg" class="icon-svg icon-xs" alt="" /> <span>Desde ${formatted}</span>`;
  } else if (joinedEl) {
    joinedEl.replaceChildren();
  }

  // mostrar scan
  const scanCard = document.getElementById('user-scan-card');
  const scanSidebarWidget = document.getElementById('scan-sidebar-widget');
  if (user.scan_group && user.scan_group.name) {
    const scanUrl = `/pages/scans.html?slug=${encodeURIComponent(user.scan_group.slug)}`;
    const scanLogoUrl = user.scan_group.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.scan_group.name)}&background=6c5ce7&color=fff`;
    const scanRoleLabel = formatScanRole(user.scan_group.role);

    if (scanCard) {
      scanCard.style.display = 'inline-flex';
      scanCard.href = scanUrl;
      const scanLogo = document.getElementById('user-scan-logo');
      if (scanLogo) scanLogo.src = scanLogoUrl;
      const scanName = document.getElementById('user-scan-name');
      if (scanName) scanName.textContent = user.scan_group.name;
      const scanRole = document.getElementById('user-scan-role');
      if (scanRole) scanRole.textContent = scanRoleLabel;
    }

    if (scanSidebarWidget) {
      scanSidebarWidget.style.display = 'block';
      const sbRole = document.getElementById('sidebar-scan-role');
      if (sbRole) sbRole.textContent = scanRoleLabel;
      const sbLogo = document.getElementById('sidebar-scan-logo');
      if (sbLogo) sbLogo.src = scanLogoUrl;
      const sbName = document.getElementById('sidebar-scan-name');
      if (sbName) sbName.textContent = user.scan_group.name;
      const sbWorks = document.getElementById('sidebar-scan-works');
      if (sbWorks) sbWorks.textContent = `${Number(user.scan_group.works_count || 0)} obras publicadas`;
      const sbLink = document.getElementById('sidebar-scan-link');
      if (sbLink) sbLink.href = scanUrl;
    }
  } else {
    if (scanCard) scanCard.style.display = 'none';
    if (scanSidebarWidget) scanSidebarWidget.style.display = 'none';
  }

  // biografía
  const bioEl = document.getElementById('user-bio');
  if (bioEl) {
    if (user.bio && user.bio.trim()) {
      bioEl.textContent = user.bio;
      bioEl.classList.remove('is-empty');
    } else {
      bioEl.textContent = user.is_owner
        ? 'Aún no has escrito una biografía. Haz clic en "Editar perfil" para personalizar tu presentación.'
        : 'Este lector prefiere mantener el misterio y aún no ha escrito una biografía.';
      bioEl.classList.add('is-empty');
    }
  }

  // controles de dueño vs visitante
  const editBtn = document.getElementById('edit-profile-btn');
  const quickAvatarEditBtn = document.getElementById('quick-avatar-edit-btn');
  const visitorMoreMenu = document.getElementById('visitor-more-menu');
  const ownerCoinActions = document.getElementById('owner-coin-actions');
  const ownerLibraryLink = document.getElementById('owner-library-link');

  if (user.is_owner) {
    if (editBtn) editBtn.style.display = 'inline-flex';
    if (quickAvatarEditBtn) quickAvatarEditBtn.style.display = 'inline-flex';
    if (visitorMoreMenu) visitorMoreMenu.style.display = 'none';
    if (ownerCoinActions) ownerCoinActions.style.display = 'inline-flex';
    if (ownerLibraryLink) ownerLibraryLink.style.display = 'inline-flex';
  } else {
    if (editBtn) editBtn.style.display = 'none';
    if (quickAvatarEditBtn) quickAvatarEditBtn.style.display = 'none';
    if (visitorMoreMenu) visitorMoreMenu.style.display = 'block';
    if (ownerCoinActions) ownerCoinActions.style.display = 'none';
    if (ownerLibraryLink) ownerLibraryLink.style.display = 'none';
  }

  // privacidad
  const privateNotice = document.getElementById('private-notice');
  const publicContent = document.getElementById('profile-public-content');
  const statsStrip = document.getElementById('stats-strip-section');

  if (user.is_hidden) {
    if (privateNotice) privateNotice.style.display = 'flex';
    if (publicContent) publicContent.style.display = 'none';
    if (statsStrip) statsStrip.style.display = 'none';
    return;
  } else {
    if (privateNotice) privateNotice.style.display = 'none';
    if (publicContent) publicContent.style.display = 'grid';
    if (statsStrip) statsStrip.style.display = 'grid';
  }

  // 5 estadísticas clave
  const stats = user.stats || {};
  const setStat = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(val || 0).toLocaleString();
  };
  setStat('stat-chapters', stats.total_chapters_read);
  setStat('stat-following', stats.favorites_count);
  setStat('stat-completed', stats.completed_works);
  setStat('stat-streak', user.streak_days);
  setStat('stat-coins', user.coins);

  // vitrina por pestañas de biblioteca
  const allWorks = user.favorite_works || [];
  const readingCount = allWorks.filter((w) => w.status === 'READING' || w.status === 'LIKED' || w.status === 'FAVORITE').length;
  const completedCount = allWorks.filter((w) => w.status === 'COMPLETED').length;
  const pendingCount = allWorks.filter((w) => w.status === 'PLAN_TO_READ' || w.status === 'READ_LATER').length;

  setStat('tab-count-reading', readingCount);
  setStat('tab-count-completed', stats.completed_works ?? completedCount);
  setStat('tab-count-pending', stats.pending_works ?? pendingCount);

  renderLibraryShowcaseTab(currentLibraryTab);

  // sidebar: colección cosmética
  renderInventoryShowcase(user.inventory_items || [], user.is_owner);
}

function renderLibraryShowcaseTab(statusFilter) {
  currentLibraryTab = statusFilter;
  const container = document.getElementById('library-showcase-container');
  if (!container || !currentProfileData) return;

  const allWorks = currentProfileData.favorite_works || [];
  const isOwner = Boolean(currentProfileData.is_owner);

  const filtered = allWorks
    .filter((w) => {
      if (statusFilter === 'READING') return w.status === 'READING' || w.status === 'LIKED' || w.status === 'FAVORITE';
      if (statusFilter === 'PLAN_TO_READ') return w.status === 'PLAN_TO_READ' || w.status === 'READ_LATER';
      return w.status === statusFilter;
    })
    .slice(0, 6);

  const emptyMessages = {
    READING: {
      title: 'Sin obras en lectura',
      desc: isOwner
        ? 'Agrega tus mangas y manhwas a la biblioteca con estado "Leyendo" para verlos en tu vitrina.'
        : 'Este usuario aún no tiene obras marcadas como "Leyendo".'
    },
    COMPLETED: {
      title: 'Sin obras completadas',
      desc: isOwner
        ? 'Cuando termines una obra y la marques como "Completado" en tu biblioteca, aparecerá aquí.'
        : 'Este lector aún no tiene obras marcadas como completadas.'
    },
    PLAN_TO_READ: {
      title: 'Sin obras planeadas',
      desc: isOwner
        ? 'Guarda obras como "Planeado" para organizar tus próximas lecturas.'
        : 'Este lector no tiene obras en su lista de pendientes.'
    }
  };

  if (filtered.length === 0) {
    const msg = emptyMessages[statusFilter] || emptyMessages.READING;
    container.innerHTML = `
      <div class="profile-empty-state" style="grid-column: 1 / -1;">
        <img src="/assets/icons/svg/content/book.svg" class="icon-svg icon-lg" alt="" />
        <h4>${msg.title}</h4>
        <p>${msg.desc}</p>
        ${isOwner ? '<a href="/pages/catalogo.html" class="btn btn-primary btn-sm">Explorar Catálogo</a>' : ''}
      </div>
    `;
    return;
  }

  const statusMeta = {
    READING: { label: 'Leyendo', cls: 'status-reading' },
    LIKED: { label: 'Leyendo', cls: 'status-reading' },
    FAVORITE: { label: 'Leyendo', cls: 'status-reading' },
    COMPLETED: { label: 'Completado', cls: 'status-completed' },
    PLAN_TO_READ: { label: 'Planeado', cls: 'status-plan' },
    READ_LATER: { label: 'Planeado', cls: 'status-plan' },
    ON_HOLD: { label: 'En espera', cls: 'status-onhold' },
    DROPPED: { label: 'Abandonado', cls: 'status-dropped' }
  };

  container.innerHTML = filtered.map((w) => {
    const cover = w.cover_url || `https://placehold.co/240x340/16151d/00bfa6?text=${encodeURIComponent(w.title || 'Obra')}`;
    const st = statusMeta[w.status] || { label: 'Guardada', cls: 'status-liked' };
    const readCount = Number(w.chapters_read || 0);
    const totalCount = Number(w.total_chapters || 0);
    const pct = totalCount > 0 ? Math.min(100, Math.round((readCount / totalCount) * 100)) : 0;
    const workUrl = `/pages/obra.html?slug=${encodeURIComponent(w.slug)}`;
    const hasResume = isOwner && w.last_chapter_id;
    const resumeNum = w.last_chapter_number != null ? parseFloat(w.last_chapter_number) : null;
    const resumeCapStr = resumeNum != null ? formatChapterNumber(resumeNum) : '';
    const resumeUrl = hasResume
      ? `/pages/leer.html?obra=${encodeURIComponent(w.slug)}${resumeCapStr ? '&capitulo=' + encodeURIComponent(resumeCapStr) : ''}&chapter_id=${encodeURIComponent(w.last_chapter_id)}`
      : workUrl;

    return `
      <article class="showcase-work-card">
        <a href="${workUrl}" class="showcase-work-card__cover">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(w.title)}" loading="lazy" />
          <span class="showcase-work-card__status ${st.cls}">${st.label}</span>
          ${w.rating ? `<span class="showcase-work-card__rating">★ ${Number(w.rating).toFixed(1)}</span>` : ''}
        </a>
        <div class="showcase-work-card__body">
          <div>
            <span class="showcase-work-card__format">${escapeHtml(w.format_name || 'Manga')}</span>
            <h4 class="showcase-work-card__title" title="${escapeHtml(w.title)}">
              <a href="${workUrl}">${escapeHtml(w.title)}</a>
            </h4>
          </div>
          <div class="showcase-work-card__progress">
            <div class="showcase-work-card__progress-meta">
              <span>Progreso</span>
              <strong>${readCount}${totalCount > 0 ? ` / ${totalCount}` : ''} caps</strong>
            </div>
            <div class="showcase-work-card__bar">
              <div class="showcase-work-card__bar-fill" style="width: ${pct}%;"></div>
            </div>
            ${hasResume ? `
              <a href="${resumeUrl}" class="showcase-work-card__resume">
                <img src="/assets/icons/svg/actions/play.svg" class="icon-svg icon-xs" alt="" />
                <span>Reanudar${resumeNum !== null ? ` Cap. ${resumeNum}` : ''}</span>
              </a>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderInventoryShowcase(items, isOwner = false) {
  const container = document.getElementById('inventory-showcase-container');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="inventory-empty">
        <p class="profile-muted-note">
          ${isOwner
            ? 'Aún no has adquirido anillos, portadas ni títulos en la Tienda.'
            : 'Este usuario aún no tiene cosméticos en su colección.'}
        </p>
        ${isOwner ? '<a href="/pages/tienda.html" class="btn btn-secondary btn-sm">Ir a la Tienda</a>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = items.slice(0, 6).map((item) => {
    const cat = (item.category || '').toUpperCase();
    const isEquipped = Boolean(item.is_equipped);
    const rarity = (item.rarity || 'RARE').toLowerCase();

    let previewHtml = '';
    if (cat === 'BANNER' && item.preview_url) {
      previewHtml = `<span class="inv-item__thumb inv-item__thumb--banner" style="background-image: url('${escapeHtml(item.preview_url)}');"></span>`;
    } else if (cat === 'FRAME' && item.preview_url) {
      previewHtml = `<span class="inv-item__thumb inv-item__thumb--frame"><img src="${escapeHtml(item.preview_url)}" alt="${escapeHtml(item.name)}" /></span>`;
    } else {
      previewHtml = `<span class="inv-item__thumb inv-item__thumb--title"><img src="/assets/icons/svg/gamification/award.svg" class="icon-svg icon-sm" alt="" /></span>`;
    }

    return `
      <div class="inv-item-row ${isEquipped ? 'is-equipped' : ''}">
        ${previewHtml}
        <div class="inv-item__info">
          <div class="inv-item__title-line">
            <strong class="inv-item__name">${escapeHtml(item.name)}</strong>
            <span class="inv-item__rarity rarity-${rarity}">${escapeHtml(formatCategoryLabel(cat))}</span>
          </div>
          <span class="inv-item__status">${isEquipped ? 'Equipado actualmente' : 'En colección'}</span>
        </div>
        ${isOwner ? `
          <button
            type="button"
            class="btn btn-sm ${isEquipped ? 'btn-secondary' : 'btn-primary'} inv-equip-btn"
            data-item-id="${item.item_id}"
            data-category="${escapeHtml(cat)}"
            data-equipped="${isEquipped ? '1' : '0'}"
          >
            ${isEquipped ? 'Quitar' : 'Equipar'}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  if (isOwner) {
    container.querySelectorAll('.inv-equip-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const itemId = Number(btn.dataset.itemId);
        const category = btn.dataset.category || 'BANNER';
        const isEquipped = btn.dataset.equipped === '1';

        btn.disabled = true;
        try {
          if (isEquipped) {
            await apiRequest(`/shop/unequip?category=${encodeURIComponent(category)}`, { method: 'POST' });
            showToast('Cosmético desequipado');
          } else {
            await apiRequest(`/shop/equip/${itemId}`, { method: 'POST' });
            showToast('¡Cosmético equipado en tu perfil!');
          }
          await loadProfile();
        } catch (err) {
          showToast(err.message || 'No se pudo actualizar el cosmético');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }
}

function renderNotFound() {
  const main = document.querySelector('.profile-container');
  if (!main) return;
  main.innerHTML = `
    <div class="profile-private-card" style="display: flex; margin-top: 2rem;">
      <div class="profile-private-card__icon">
        <img src="/assets/icons/svg/user/user.svg" class="icon-svg icon-lg" alt="" />
      </div>
      <h3 class="profile-private-card__title">Usuario no encontrado</h3>
      <p class="profile-private-card__desc">El perfil que buscas no existe o ha cambiado su identificador.</p>
      <a href="/" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;">Volver al Inicio</a>
    </div>
  `;
}

// modal editar perfil

function buildCosmeticPresets() {
  const bannerGrid = document.getElementById('banner-presets-grid');
  const frameGrid = document.getElementById('frame-presets-grid');
  const bannerInput = document.getElementById('edit-banner');
  const frameInput = document.getElementById('edit-anillo');

  // selector banners
  const invBanners = ownerInventory
    .filter((i) => i.category === 'BANNER' && i.preview_url)
    .map((i) => ({ name: i.name, url: i.preview_url }));

  const allBanners = [...DEFAULT_BANNER_PRESETS];
  invBanners.forEach((b) => {
    if (!allBanners.some((existing) => existing.url === b.url)) {
      allBanners.push(b);
    }
  });

  if (bannerGrid && bannerInput) {
    const currentBanner = bannerInput.value.trim();
    bannerGrid.innerHTML = allBanners.map((b) => {
      const isSelected = currentBanner === b.url;
      return `
        <button type="button" class="cosmetic-preset-btn ${isSelected ? 'active' : ''}" data-banner-url="${escapeHtml(b.url)}">
          <span class="cosmetic-preset-btn__thumb" style="${b.url ? `background-image: url('${escapeHtml(b.url)}');` : ''}"></span>
          <span class="cosmetic-preset-btn__label">${escapeHtml(b.name)}</span>
        </button>
      `;
    }).join('');

    bannerGrid.querySelectorAll('.cosmetic-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        bannerInput.value = btn.dataset.bannerUrl || '';
        bannerGrid.querySelectorAll('.cosmetic-preset-btn').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
        updateLivePreview();
      });
    });
  }

  // selector marcos
  const invFrames = ownerInventory
    .filter((i) => i.category === 'FRAME' && i.preview_url)
    .map((i) => ({ name: i.name, url: i.preview_url }));

  const allFrames = [...DEFAULT_FRAME_PRESETS];
  invFrames.forEach((f) => {
    if (!allFrames.some((existing) => existing.url === f.url)) {
      allFrames.push(f);
    }
  });

  if (frameGrid && frameInput) {
    const currentFrame = frameInput.value.trim();
    frameGrid.innerHTML = allFrames.map((f) => {
      const isSelected = currentFrame === f.url;
      return `
        <button type="button" class="cosmetic-preset-btn cosmetic-preset-btn--frame ${isSelected ? 'active' : ''}" data-frame-url="${escapeHtml(f.url)}">
          <span class="cosmetic-preset-btn__frame-preview">
            ${f.url ? `<img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.name)}" />` : `<span class="no-frame-dot">✕</span>`}
          </span>
          <span class="cosmetic-preset-btn__label">${escapeHtml(f.name)}</span>
        </button>
      `;
    }).join('');

    frameGrid.querySelectorAll('.cosmetic-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        frameInput.value = btn.dataset.frameUrl || '';
        frameGrid.querySelectorAll('.cosmetic-preset-btn').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
        updateLivePreview();
      });
    });
  }
}

function updateLivePreview() {
  const username = document.getElementById('edit-username')?.value.trim() || currentProfileData?.username || 'Usuario';
  const bio = document.getElementById('edit-bio')?.value.trim() || 'Sin biografía configurada.';
  const avatarUrl = document.getElementById('edit-avatar')?.value.trim() || getFallbackAvatar(username);
  const bannerUrl = document.getElementById('edit-banner')?.value.trim() || '';
  const frameUrl = document.getElementById('edit-anillo')?.value.trim() || '';
  const activeTitle = currentProfileData?.level_info?.current_title || '';

  const previewBanner = document.getElementById('preview-banner-box');
  if (previewBanner) {
    previewBanner.style.backgroundImage = bannerUrl ? `url('${bannerUrl}')` : '';
  }

  const previewAvatar = document.getElementById('preview-avatar-img');
  if (previewAvatar) {
    previewAvatar.classList.remove('yz-skeleton');
    previewAvatar.alt = username || '';
    previewAvatar.src = avatarUrl;
    previewAvatar.onerror = () => {
      previewAvatar.src = getFallbackAvatar(username);
    };
  }

  const previewFrame = document.getElementById('preview-frame-img');
  if (previewFrame) {
    if (frameUrl) {
      previewFrame.src = frameUrl;
      previewFrame.style.display = 'block';
    } else {
      previewFrame.style.display = 'none';
    }
  }

  const previewName = document.getElementById('preview-username-text');
  if (previewName) previewName.textContent = username;

  const previewTitle = document.getElementById('preview-title-pill');
  if (previewTitle) {
    if (activeTitle) {
      previewTitle.textContent = activeTitle;
      previewTitle.style.display = 'inline-flex';
    } else {
      previewTitle.style.display = 'none';
    }
  }

  const previewBio = document.getElementById('preview-bio-text');
  if (previewBio) previewBio.textContent = bio;
}

async function openEditModal(initialTab = 'identity') {
  if (!currentProfileData) return;

  await loadOwnerInventory();

  const modal = document.getElementById('edit-profile-modal');
  const usernameInput = document.getElementById('edit-username');
  const countrySelect = document.getElementById('edit-country');
  const bioInput = document.getElementById('edit-bio');
  const bioCounter = document.getElementById('bio-char-counter');
  const avatarInput = document.getElementById('edit-avatar');
  const bannerInput = document.getElementById('edit-banner');
  const anilloInput = document.getElementById('edit-anillo');
  const privateInput = document.getElementById('edit-private');
  const errorBox = document.getElementById('edit-error');

  if (usernameInput) usernameInput.value = currentProfileData.username || '';
  if (countrySelect) countrySelect.value = (currentProfileData.country || 'CO').toUpperCase();
  if (bioInput) {
    bioInput.value = currentProfileData.bio || '';
    if (bioCounter) bioCounter.textContent = `${bioInput.value.length} / 250`;
  }
  if (avatarInput) avatarInput.value = currentProfileData.avatar_url || '';
  if (bannerInput) bannerInput.value = currentProfileData.banner_url || '';
  if (anilloInput) anilloInput.value = currentProfileData.anillo_url || currentProfileData.avatar_frame_url || '';
  if (privateInput) privateInput.checked = Boolean(currentProfileData.is_private);
  if (errorBox) errorBox.style.display = 'none';

  buildCosmeticPresets();
  updateLivePreview();
  switchEditModalTab(initialTab);

  if (modal) modal.classList.add('active');
}

function switchEditModalTab(tabName) {
  document.querySelectorAll('.edit-modal-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.editTab === tabName);
  });
  document.getElementById('edit-pane-identity')?.classList.toggle('active', tabName === 'identity');
  document.getElementById('edit-pane-appearance')?.classList.toggle('active', tabName === 'appearance');
}

function setupModalEvents() {
  const modal = document.getElementById('edit-profile-modal');
  const openBtn = document.getElementById('edit-profile-btn');
  const quickAvatarBtn = document.getElementById('quick-avatar-edit-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const form = document.getElementById('edit-profile-form');
  const errorBox = document.getElementById('edit-error');

  if (openBtn) openBtn.addEventListener('click', () => openEditModal('identity'));
  if (quickAvatarBtn) quickAvatarBtn.addEventListener('click', () => openEditModal('appearance'));

  const closeModal = () => modal?.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.querySelectorAll('.edit-modal-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchEditModalTab(btn.dataset.editTab));
  });

  const bioInput = document.getElementById('edit-bio');
  const bioCounter = document.getElementById('bio-char-counter');
  if (bioInput && bioCounter) {
    bioInput.addEventListener('input', () => {
      bioCounter.textContent = `${bioInput.value.length} / 250`;
      updateLivePreview();
    });
  }

  ['edit-username', 'edit-avatar'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateLivePreview);
    document.getElementById(id)?.addEventListener('change', updateLivePreview);
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      const saveBtn = document.getElementById('save-profile-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      const payload = {
        username: document.getElementById('edit-username')?.value.trim(),
        country: document.getElementById('edit-country')?.value || 'CO',
        bio: document.getElementById('edit-bio')?.value.trim() || '',
        avatar_url: document.getElementById('edit-avatar')?.value.trim() || null,
        banner_url: document.getElementById('edit-banner')?.value.trim() || null,
        avatar_frame_url: document.getElementById('edit-anillo')?.value.trim() || null,
        anillo_url: document.getElementById('edit-anillo')?.value.trim() || null,
        is_private: Boolean(document.getElementById('edit-private')?.checked)
      };

      try {
        const updated = await apiRequest('/users/me', {
          method: 'PUT',
          body: payload
        });

        currentProfileData = updated;
        ownerInventory = Array.isArray(updated.inventory_items) ? updated.inventory_items : ownerInventory;
        renderProfile(updated);

        closeModal();
        showToast('Perfil actualizado correctamente');
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'No se pudo actualizar el perfil.';
          errorBox.style.display = 'block';
        }
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar Cambios';
        }
      }
    });
  }
}

function setupTabsAndMenus() {
  const tabBtns = document.querySelectorAll('.profile-tab[data-lib-tab]');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.libTab || 'READING';
      tabBtns.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderLibraryShowcaseTab(status);
    });
  });

  const shareBtn = document.getElementById('share-profile-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareUrl = currentProfileData?.user_code
        ? `${window.location.origin}/pages/usuario.html?id=${encodeURIComponent(currentProfileData.user_code)}`
        : window.location.href;
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Enlace del perfil copiado al portapapeles');
      } catch (_) {
        showToast('Enlace: ' + shareUrl);
      }
    });
  }

  const moreBtn = document.getElementById('more-options-btn');
  const dropdown = document.getElementById('profile-dropdown-menu');
  if (moreBtn && dropdown) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    document.addEventListener('click', () => dropdown.classList.remove('active'));
  }

  const reportBtn = document.getElementById('report-profile-btn');
  const reportModal = document.getElementById('report-profile-modal');
  const closeReportBtn = document.getElementById('close-report-modal-btn');
  const cancelReportBtn = document.getElementById('cancel-report-btn');
  const reportForm = document.getElementById('report-profile-form');

  if (reportBtn && reportModal) {
    reportBtn.addEventListener('click', () => {
      dropdown?.classList.remove('active');
      reportModal.classList.add('active');
    });
  }
  const closeReport = () => reportModal?.classList.remove('active');
  if (closeReportBtn) closeReportBtn.addEventListener('click', closeReport);
  if (cancelReportBtn) cancelReportBtn.addEventListener('click', closeReport);

  if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeReport();
      reportForm.reset();
      showToast('Reporte enviado al equipo de moderación');
    });
  }
}

function setupCoinsModals() {
  const buyBtn = document.getElementById('buy-coins-btn');
  const buyModal = document.getElementById('buy-coins-modal');
  const closeBuyBtn = document.getElementById('close-coins-modal-btn');

  if (buyBtn && buyModal) {
    buyBtn.addEventListener('click', () => buyModal.classList.add('active'));
  }
  if (closeBuyBtn && buyModal) {
    closeBuyBtn.addEventListener('click', () => buyModal.classList.remove('active'));
  }

  document.querySelectorAll('.buy-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      buyModal?.classList.remove('active');
      showToast('Pasarela de pago próximamente disponible');
    });
  });

  const historyBtn = document.getElementById('history-coins-btn');
  const historyModal = document.getElementById('coin-history-modal');
  const closeHistoryBtn = document.getElementById('close-coin-history-btn');
  const searchInput = document.getElementById('coin-search-input');
  const typeFilter = document.getElementById('coin-type-filter');

  if (historyBtn && historyModal) {
    historyBtn.addEventListener('click', async () => {
      historyModal.classList.add('active');
      await loadCoinHistory();
    });
  }
  if (closeHistoryBtn && historyModal) {
    closeHistoryBtn.addEventListener('click', () => historyModal.classList.remove('active'));
  }

  const filterHistory = () => {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const t = typeFilter?.value || 'ALL';
    const filtered = cachedCoinTransactions.filter((tx) => {
      const matchesText = !q || (tx.description || '').toLowerCase().includes(q);
      const matchesType = t === 'ALL' || (t === 'EARN' ? tx.amount > 0 : tx.amount < 0);
      return matchesText && matchesType;
    });
    renderCoinHistoryList(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', filterHistory);
  if (typeFilter) typeFilter.addEventListener('change', filterHistory);
}

async function loadCoinHistory() {
  const container = document.getElementById('coin-transactions-container');
  if (!container) return;
  container.innerHTML = renderCoinTxSkeletons(5);

  try {
    const list = await apiRequest('/users/me/transactions?limit=30');
    cachedCoinTransactions = Array.isArray(list) ? list : [];
    renderCoinHistoryList(cachedCoinTransactions);
  } catch (_) {
    container.innerHTML = `<p class="profile-muted-note">No se pudo cargar el historial de monedas.</p>`;
  }
}

function renderCoinHistoryList(list) {
  const container = document.getElementById('coin-transactions-container');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<p class="profile-muted-note">No se encontraron movimientos de monedas.</p>`;
    return;
  }

  container.innerHTML = list.map((tx) => {
    const isPositive = tx.amount >= 0;
    return `
      <div class="coin-tx-row">
        <div class="coin-tx-row__info">
          <strong>${escapeHtml(tx.description || tx.type)}</strong>
          <span>${getRelativeTime(tx.created_at)}</span>
        </div>
        <div class="coin-tx-row__amount ${isPositive ? 'is-pos' : 'is-neg'}">
          ${isPositive ? '+' : ''}${tx.amount} YC
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabsAndMenus();
  setupModalEvents();
  setupCoinsModals();
  loadProfile();
});
