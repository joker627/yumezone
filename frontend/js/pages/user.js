import { apiRequest, authRequest, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { escapeHTML, formatTimeAgo } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';

// Inicializar cabecera del sitio
const header = document.getElementById('header');
if (header) renderSiteHeader(header);

const profileView = document.getElementById('user-profile-view');
const errorContainer = document.getElementById('user-error');
const errorTitle = document.getElementById('user-error-title');
const errorDesc = document.getElementById('user-error-desc');
const privateView = document.getElementById('private-profile-view');

// Helper para renderizar iconos SVG reales desde /assets/icons/svg/
function getIconImg(name, size = 18, className = '') {
  return `<img src="/assets/icons/svg/${name}.svg" alt="" width="${size}" height="${size}" class="${className}" aria-hidden="true"/>`;
}

function showError(title, desc) {

  if (errorContainer) {
    if (errorTitle) errorTitle.textContent = title;
    if (errorDesc) errorDesc.textContent = desc;
    errorContainer.hidden = false;
  }
  if (profileView) profileView.hidden = true;
}

function formatMemberDate(dateStr) {
  if (!dateStr) return 'Miembro registrado';
  try {
    const d = new Date(dateStr);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `Miembro desde ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return 'Miembro registrado';
  }
}


function renderUser(user) {
  if (errorContainer) errorContainer.hidden = true;
  if (profileView) profileView.hidden = false;

  const username = user.username || 'Lector';
  document.title = `${username} | Perfil en YumeZone`;

  // Username y @handle
  const usernameEl = document.getElementById('user-username');
  if (usernameEl) usernameEl.textContent = username;

  const handleEl = document.getElementById('user-handle');
  if (handleEl) handleEl.textContent = `@${user.username?.toLowerCase() || 'lector'}`;

  // User Code
  const codeValEl = document.getElementById('user-code-val');
  if (codeValEl) {
    codeValEl.textContent = user.user_code || `ID #${user.id}`;
  }

  // Member Since
  const createdValEl = document.getElementById('user-created-val');
  if (createdValEl) {
    createdValEl.textContent = formatMemberDate(user.created_at);
  }

  // Avatar
  const avatarImg = document.getElementById('user-avatar-img');
  const avatarFallback = document.getElementById('user-avatar-fallback');
  if (user.avatar_url) {
    if (avatarImg) {
      avatarImg.src = user.avatar_url;
      avatarImg.classList.remove('hidden');
    }
    if (avatarFallback) avatarFallback.classList.add('hidden');
  } else {
    if (avatarImg) avatarImg.classList.add('hidden');
    if (avatarFallback) {
      avatarFallback.textContent = (username[0] || 'Y').toUpperCase();
      avatarFallback.classList.remove('hidden');
    }
  }

  // Banner background real personalizado
  const bannerBg = document.getElementById('profile-banner-bg');
  if (bannerBg) {
    if (user.banner_url) {
      bannerBg.style.backgroundImage = `url('${escapeHTML(user.banner_url)}')`;
    } else {
      bannerBg.style.backgroundImage = `url('/assets/images/banner-default.jpg')`;
    }
  }

  // Nivel y XP (provisto directamente por el backend de acuerdo a separación de responsabilidades)
  const xp = user.xp || 0;
  const lvlInfo = user.level_info || {
    level: Math.floor(xp / 1000) + 1,
    current_level_xp: xp % 1000,
    remaining_xp: 1000 - (xp % 1000),
    percentage: Math.min(100, Math.floor(((xp % 1000) / 1000) * 100)),
    current_title: 'Lector Novato',
    next_title: 'Cazador Errante'
  };

  // Rol y Verificación Real
  const role = (user.platform_role || 'USER').toUpperCase();
  const rolePill = document.getElementById('user-role-pill');
  const verifiedIcon = document.getElementById('user-verified-icon');
  const topVerifiedBadge = document.getElementById('badge-verified-top');
  const topVerifiedText = document.getElementById('badge-verified-text');
  const topRoleBadge = document.getElementById('badge-role-top');
  const topRoleText = document.getElementById('badge-role-text');

  let roleDisplay = 'Lector';
  let isVerified = false;

  if (role === 'SUPERADMIN') {
    roleDisplay = 'Super Administrador';
    isVerified = true;
    if (topVerifiedBadge && topVerifiedText) {
      topVerifiedText.textContent = 'Staff Webmaster';
      topVerifiedBadge.style.display = 'inline-flex';
    }
    if (topRoleBadge) topRoleBadge.style.display = 'none';
  } else if (role === 'ADMIN') {
    roleDisplay = 'Staff Administrador';
    isVerified = true;
    if (topVerifiedBadge && topVerifiedText) {
      topVerifiedText.textContent = 'Staff Oficial';
      topVerifiedBadge.style.display = 'inline-flex';
    }
    if (topRoleBadge) topRoleBadge.style.display = 'none';
  } else if (role === 'MODERATOR') {
    roleDisplay = 'Moderador';
    isVerified = true;
    if (topVerifiedBadge && topVerifiedText) {
      topVerifiedText.textContent = 'Moderador Oficial';
      topVerifiedBadge.style.display = 'inline-flex';
    }
    if (topRoleBadge) topRoleBadge.style.display = 'none';
  } else if (user.scan_group) {
    roleDisplay = `${user.scan_group.role || 'Scan'} • ${user.scan_group.name}`;
    isVerified = true;
    if (topVerifiedBadge && topVerifiedText) {
      topVerifiedText.textContent = `Scan • ${user.scan_group.name}`;
      topVerifiedBadge.style.display = 'inline-flex';
    }
    if (topRoleBadge) topRoleBadge.style.display = 'none';
  } else {
    roleDisplay = 'Lector';
    isVerified = false;
    if (topVerifiedBadge) topVerifiedBadge.style.display = 'none';

    if (lvlInfo.level >= 5) {
      if (topRoleBadge && topRoleText) {
        topRoleText.textContent = `${lvlInfo.current_title} (Nv. ${lvlInfo.level})`;
        topRoleBadge.style.display = 'inline-flex';
      }
    } else {
      if (topRoleBadge) topRoleBadge.style.display = 'none';
    }
  }

  if (rolePill) rolePill.textContent = roleDisplay;
  if (verifiedIcon) verifiedIcon.style.display = isVerified ? 'inline-flex' : 'none';

  // Biografía
  const bioEl = document.getElementById('user-bio');
  if (bioEl) {
    bioEl.textContent = user.bio ? user.bio : 'Sin biografía disponible aún.';
  }

  const levelBadge = document.getElementById('user-level-badge');
  if (levelBadge) levelBadge.textContent = `Nv. ${lvlInfo.level}`;

  const xpTitle = document.getElementById('xp-level-title');
  if (xpTitle) xpTitle.textContent = `Nivel ${lvlInfo.level}: ${lvlInfo.current_title}`;

  const xpNext = document.getElementById('xp-next-level');
  if (xpNext) xpNext.textContent = `→ Siguiente: Nv. ${lvlInfo.level + 1} ${lvlInfo.next_title}`;

  const xpNumbers = document.getElementById('xp-numbers-label');
  if (xpNumbers) xpNumbers.textContent = `${(lvlInfo.current_level_xp || 0).toLocaleString()} / 1,000 EXP`;

  const xpPct = document.getElementById('xp-pct-label');
  if (xpPct) xpPct.textContent = `${lvlInfo.percentage || 0}% Completado`;

  const xpRemaining = document.getElementById('xp-remaining-label');
  if (xpRemaining) xpRemaining.textContent = `Faltan ${(lvlInfo.remaining_xp || 0).toLocaleString()} EXP`;

  const xpBar = document.getElementById('xp-progress-bar');
  if (xpBar) xpBar.style.width = `${lvlInfo.percentage || 0}%`;


  // Estadísticas reales
  const stats = user.stats || {};
  const statChapters = document.getElementById('stat-chapters');
  if (statChapters) statChapters.textContent = (stats.total_chapters_read || 0).toLocaleString();

  const statFollowing = document.getElementById('stat-following');
  if (statFollowing) statFollowing.textContent = (stats.following_count || 0).toLocaleString();

  const statStreak = document.getElementById('stat-streak');
  if (statStreak) statStreak.textContent = `${user.streak_days || 0} Días`;

  const statCoins = document.getElementById('stat-coins');
  if (statCoins) statCoins.textContent = (user.coins || 0).toLocaleString();

  const statComments = document.getElementById('stat-comments');
  if (statComments) statComments.textContent = (stats.total_comments || 0).toLocaleString();

  const statCompleted = document.getElementById('stat-completed');
  if (statCompleted) statCompleted.textContent = (stats.completed_works || 0).toLocaleString();

  // Tarjeta de Grupo Scan si aplica
  const scanCard = document.getElementById('user-scan-card');
  if (scanCard) {
    if (user.scan_group) {
      scanCard.hidden = false;
      const scanNameEl = document.getElementById('user-scan-name');
      if (scanNameEl) scanNameEl.textContent = user.scan_group.name || 'Grupo Scan';

      const scanRoleEl = document.getElementById('user-scan-role');
      if (scanRoleEl) scanRoleEl.textContent = `Rol: ${user.scan_group.role || 'Miembro'}`;

      const scanLogoEl = document.getElementById('user-scan-logo');
      if (scanLogoEl && user.scan_group.logo_url) {
        scanLogoEl.src = user.scan_group.logo_url;
      }

      const scanLinkEl = document.getElementById('user-scan-link');
      if (scanLinkEl && user.scan_group.slug) {
        scanLinkEl.href = `/pages/catalogo.html?scan=${encodeURIComponent(user.scan_group.slug)}`;
      }
    } else {
      scanCard.hidden = true;
    }
  }

  // Enlaces directos a Consolas de administración en la barra lateral
  const host = window.location.hostname || '192.168.1.43';
  const hasScanAccess = Boolean(role === 'SUPERADMIN' || role === 'ADMIN' || user.scan_group);
  const hasAdminAccess = Boolean(role === 'SUPERADMIN' || role === 'ADMIN');

  const scanQuickLink = document.getElementById('profile-scan-quicklink');
  if (scanQuickLink) {
    if (hasScanAccess) {
      scanQuickLink.href = `http://${host}:4400/`;
      scanQuickLink.style.display = 'flex';
    } else {
      scanQuickLink.style.display = 'none';
    }
  }

  const adminQuickLink = document.getElementById('profile-admin-quicklink');
  if (adminQuickLink) {
    if (hasAdminAccess) {
      adminQuickLink.href = `http://${host}:4000/`;
      adminQuickLink.style.display = 'flex';
    } else {
      adminQuickLink.style.display = 'none';
    }
  }

  // 1. Obras Reales de Biblioteca / Favoritas
  renderFavoriteWorks(user.favorite_works || []);
  renderLibraryFeed(user.favorite_works || []);

  // 2. Medallas y Logros Reales
  renderBadges(user.badges || []);

  // 3. Actividad Reciente Real
  renderActivityFeed(user.recent_activity || []);
  renderCommentsFeed(user.recent_activity || []);

  // 4. Desglose de Géneros Reales
  renderGenresBreakdown(user.genres_breakdown || [], stats.total_chapters_read || 0);

  // Perfil privado
  if (privateView) {
    if (user.is_private && user.is_hidden) {
      privateView.hidden = false;
    } else {
      privateView.hidden = true;
    }
  }
}

function renderFavoriteWorks(works) {
  const container = document.getElementById('favorite-works-container');
  const countBadge = document.getElementById('fav-count-badge');
  if (countBadge) countBadge.textContent = works.length;

  if (!container) return;

  if (!works.length) {
    container.innerHTML = `
      <div class="profile-empty-card" style="grid-column: 1 / -1;">
        ${getIconImg('book', 24)}
        <h4 class="profile-title" style="font-size: 1rem; margin-bottom: 0.25rem;">Sin obras en biblioteca aún</h4>
        <p class="profile-bio-text" style="margin: 0 auto 1.25rem;">Este lector todavía no ha agregado obras a sus favoritos o seguimiento.</p>
        <a href="/pages/catalogo.html" class="profile-btn profile-btn--primary" style="display: inline-flex;">
          Explorar Catálogo
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = works.map((work, idx) => {
    const ratingVal = work.rating ? parseFloat(work.rating).toFixed(1) : '10.0';
    const chaptersRead = work.chapters_read || 0;
    const totalChapters = work.total_chapters || 0;
    const progressLabel = totalChapters > 0 ? `Leído: ${chaptersRead}/${totalChapters} caps` : `${chaptersRead} caps leídos`;
    const coverUrl = work.cover_url || '/assets/images/placeholder-cover.jpg';

    return `
      <div class="profile-work-card">
        <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}" class="profile-work-thumb">
          <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(work.title)}" onerror="this.src='/assets/images/placeholder-cover.jpg'"/>
          <span class="profile-work-rank-tag">#${idx + 1}</span>
        </a>
        <div class="profile-work-info">
          <div>
            <span class="profile-work-format">${escapeHTML(work.format_name || 'Obra')}</span>
            <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}" class="profile-work-title">
              ${escapeHTML(work.title)}
            </a>
            <div class="profile-work-rating">
              ${getIconImg('star', 12)}
              <span>${ratingVal}</span>
              ${work.author ? `<span style="color: var(--neutral-500); margin-left: 0.35rem;">• ${escapeHTML(work.author)}</span>` : ''}
            </div>
            ${work.genres ? `<div class="profile-work-genres">${escapeHTML(work.genres)}</div>` : ''}
          </div>
          <div class="profile-work-bottom">
            <span>${progressLabel}</span>
            <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}">Ver obra →</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderBadges(badges) {
  const container = document.getElementById('badges-container');
  const ratioBadge = document.getElementById('badges-unlocked-ratio');
  if (!container) return;

  const unlockedCount = badges.filter(b => b.unlocked).length;
  if (ratioBadge) ratioBadge.textContent = `${unlockedCount}/${badges.length}`;

  if (!badges.length) {
    container.innerHTML = `<p class="profile-bio-text" style="text-align: center; padding: 1rem 0;">No hay medallas disponibles.</p>`;
    return;
  }

  container.innerHTML = badges.map(b => {
    const isUnlocked = Boolean(b.unlocked);
    const itemClass = isUnlocked ? 'profile-badge-item profile-badge-item--unlocked' : 'profile-badge-item profile-badge-item--locked';
    const iconBoxClass = isUnlocked ? 'profile-badge-icon profile-badge-icon--unlocked' : 'profile-badge-icon profile-badge-icon--locked';

    // Icono SVG real provisto desde la tabla badges en SQL
    const iconName = b.icon || 'award';
    const iconSvg = getIconImg(iconName, 18);

    return `
      <div class="${itemClass}">
        <div class="${iconBoxClass}">
          ${iconSvg}
        </div>
        <div class="profile-badge-details">
          <div class="profile-badge-name-row">
            <span class="profile-badge-name">${escapeHTML(b.name)}</span>
            <span class="profile-badge-tier">${escapeHTML(b.tier || 'Bronce')}</span>
          </div>
          <p class="profile-badge-desc">${escapeHTML(b.description)}</p>
          <div class="profile-badge-status ${isUnlocked ? 'profile-badge-status--unlocked' : 'profile-badge-status--locked'}">
            ${isUnlocked ? '✓ Desbloqueado' : escapeHTML(b.progress || 'Bloqueado')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderActivityFeed(activities) {
  const container = document.getElementById('activity-feed-container');
  if (!container) return;

  if (!activities.length) {
    container.innerHTML = `
      <div class="profile-empty-card">
        ${getIconImg('book', 24)}
        <h4 class="profile-title" style="font-size: 1rem; margin-bottom: 0.25rem;">Sin actividad reciente</h4>
        <p class="profile-bio-text">El lector aún no ha registrado lecturas o comentarios públicos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activities.map(act => {
    const timeAgo = formatTimeAgo(act.created_at);
    const isRead = act.type === 'READ';

    if (isRead) {
      const chapterLabel = act.chapter_number ? `Capítulo ${parseFloat(act.chapter_number)}` : 'Capítulo';
      const chapterTitle = act.chapter_title ? ` - ${act.chapter_title}` : '';
      return `
        <div class="profile-activity-card">
          <div class="profile-activity-header">
            <div class="profile-activity-user-box">
              <div class="profile-activity-icon profile-activity-icon--read">
                ${getIconImg('book', 18)}
              </div>
              <div>
                <div style="font-size: 0.85rem;">
                  <span style="color: var(--neutral-400);">Leyó</span>
                  <a href="/pages/obra.html?slug=${encodeURIComponent(act.work_slug)}" class="profile-activity-title-link" style="margin-left: 0.25rem;">
                    ${escapeHTML(act.work_title)}
                  </a>
                </div>
                <div class="profile-activity-time">${timeAgo}</div>
              </div>
            </div>
            <span class="profile-activity-type-tag">Lectura</span>
          </div>

          <div class="profile-activity-chapter-box">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
              ${act.work_cover_url ? `<img src="${escapeHTML(act.work_cover_url)}" class="profile-activity-cover" alt="" onerror="this.style.display='none'"/>` : ''}
              <div style="min-width: 0;">
                <div style="font-size: 0.82rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHTML(chapterLabel + chapterTitle)}
                </div>
                <div style="font-size: 0.72rem; color: var(--neutral-400);">${escapeHTML(act.work_title)}</div>
              </div>
            </div>
            <a href="/pages/obra.html?slug=${encodeURIComponent(act.work_slug)}" class="profile-btn profile-btn--secondary" style="padding: 0.35rem 0.85rem; font-size: 0.75rem;">
              Leer
            </a>
          </div>
        </div>
      `;
    } else {
      // Comentario
      return `
        <div class="profile-activity-card">
          <div class="profile-activity-header">
            <div class="profile-activity-user-box">
              <div class="profile-activity-icon profile-activity-icon--comment">
                ${getIconImg('comment', 18)}
              </div>
              <div>
                <div style="font-size: 0.85rem;">
                  <span style="color: var(--neutral-400);">Comentó en</span>
                  <a href="/pages/obra.html?slug=${encodeURIComponent(act.work_slug)}" class="profile-activity-title-link" style="margin-left: 0.25rem;">
                    ${escapeHTML(act.work_title)}
                  </a>
                </div>
                <div class="profile-activity-time">${timeAgo}</div>
              </div>
            </div>
            <span class="profile-activity-type-tag">Comentario</span>
          </div>
          <div class="profile-activity-comment-box">
            "${escapeHTML(act.content || '')}"
          </div>
        </div>
      `;
    }
  }).join('');
}

function renderLibraryFeed(works) {
  const container = document.getElementById('library-feed-container');
  if (!container) return;

  if (!works.length) {
    container.innerHTML = `
      <div class="profile-empty-card" style="grid-column: 1 / -1;">
        ${getIconImg('book', 24)}
        <h4 class="profile-title" style="font-size: 1rem; margin-bottom: 0.25rem;">Biblioteca vacía</h4>
        <p class="profile-bio-text" style="margin: 0 auto 1.25rem;">El lector no tiene obras guardadas en su biblioteca actualmente.</p>
        <a href="/pages/catalogo.html" class="profile-btn profile-btn--primary" style="display: inline-flex;">
          Explorar Catálogo
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = works.map((work, idx) => {
    const ratingVal = work.rating ? parseFloat(work.rating).toFixed(1) : '10.0';
    const chaptersRead = work.chapters_read || 0;
    const totalChapters = work.total_chapters || 0;
    const progressLabel = totalChapters > 0 ? `Leído: ${chaptersRead}/${totalChapters} caps` : `${chaptersRead} caps leídos`;
    const coverUrl = work.cover_url || '/assets/images/placeholder-cover.jpg';

    return `
      <div class="profile-work-card">
        <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}" class="profile-work-thumb">
          <img src="${escapeHTML(coverUrl)}" alt="${escapeHTML(work.title)}" onerror="this.src='/assets/images/placeholder-cover.jpg'"/>
          <span class="profile-work-rank-tag">#${idx + 1}</span>
        </a>
        <div class="profile-work-info">
          <div>
            <span class="profile-work-format">${escapeHTML(work.format_name || 'Obra')}</span>
            <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}" class="profile-work-title">
              ${escapeHTML(work.title)}
            </a>
            <div class="profile-work-rating">
              ${getIconImg('star', 12)}
              <span>${ratingVal}</span>
              ${work.author ? `<span style="color: var(--neutral-500); margin-left: 0.35rem;">• ${escapeHTML(work.author)}</span>` : ''}
            </div>
            ${work.genres ? `<div class="profile-work-genres">${escapeHTML(work.genres)}</div>` : ''}
          </div>
          <div class="profile-work-bottom">
            <span>${progressLabel}</span>
            <a href="/pages/obra.html?slug=${encodeURIComponent(work.slug)}">Ver obra →</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


function renderCommentsFeed(activities) {
  const container = document.getElementById('comments-feed-container');
  if (!container) return;

  const comments = activities.filter(a => a.type === 'COMMENT' && a.content);
  if (!comments.length) {
    container.innerHTML = `
      <div class="profile-empty-card">
        ${getIconImg('comment', 24)}
        <h4 class="profile-title" style="font-size: 1rem; margin-bottom: 0.25rem;">Sin comentarios públicos</h4>
        <p class="profile-bio-text">Este lector aún no ha realizado comentarios en los capítulos u obras.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = comments.map(act => {
    const timeAgo = formatTimeAgo(act.created_at);
    return `
      <div class="profile-activity-card">
        <div class="profile-activity-header">
          <div class="profile-activity-user-box">
            <div class="profile-activity-icon profile-activity-icon--comment">
              ${getIconImg('comment', 18)}
            </div>

            <div>
              <div style="font-size: 0.85rem;">
                <span style="color: var(--neutral-400);">Comentó en</span>
                <a href="/pages/obra.html?slug=${encodeURIComponent(act.work_slug)}" class="profile-activity-title-link" style="margin-left: 0.25rem;">
                  ${escapeHTML(act.work_title || 'Obra')}
                </a>
              </div>
              <div class="profile-activity-time">${timeAgo}</div>
            </div>
          </div>
          <span class="profile-activity-type-tag">Comentario</span>
        </div>
        <div class="profile-activity-comment-box">
          "${escapeHTML(act.content || '')}"
        </div>
      </div>
    `;
  }).join('');
}

function renderGenresBreakdown(genres, totalCaps) {
  const wrap = document.getElementById('genres-content-wrap');
  const capsLabel = document.getElementById('sidebar-total-caps');
  if (capsLabel) capsLabel.textContent = `${totalCaps} Caps`;

  if (!wrap) return;

  if (!genres.length) {
    wrap.innerHTML = `<p class="profile-bio-text" style="text-align: center; padding: 1rem 0;">Sin suficientes lecturas para generar gráfico de géneros.</p>`;
    return;
  }

  // Colores para los 4 segmentos
  const colors = ['#39c6a5', '#f0c75e', '#f43f5e', '#64748b'];

  let offset = 0;
  const svgCircles = genres.map((g, idx) => {
    const color = colors[idx % colors.length];
    const pct = g.percentage || 0;
    const dash = (pct * 0.88).toFixed(1);
    const circle = `<circle cx="18" cy="18" r="14" fill="none" stroke="${color}" stroke-width="4.5" stroke-dasharray="${dash} 100" stroke-dashoffset="-${offset}"></circle>`;
    offset += parseFloat(dash);
    return circle;
  }).join('');

  const legendItems = genres.map((g, idx) => {
    const color = colors[idx % colors.length];
    return `
      <div class="profile-legend-item">
        <span style="display: flex; align-items: center; color: var(--neutral-300);">
          <span class="profile-legend-dot" style="background-color: ${color};"></span>
          ${escapeHTML(g.name)}
        </span>
        <span style="font-weight: 700; color: #fff;">${g.percentage}%</span>
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="profile-donut-layout">
      <div class="profile-donut-svg-wrap">
        <svg class="profile-donut-svg" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4.5"></circle>
          ${svgCircles}
        </svg>
        <div class="profile-donut-center-text">
          <span class="profile-donut-pct">${genres[0]?.percentage || 0}%</span>
          <span class="profile-donut-top-genre">${escapeHTML(genres[0]?.name || '')}</span>
        </div>
      </div>
      <div class="profile-donut-legend">
        ${legendItems}
      </div>
    </div>
  `;
}

function initInteractiveFeatures() {
  // Follow button toggle
  const followBtn = document.getElementById('btn-follow');
  const followText = document.getElementById('follow-text');
  let isFollowing = false;

  if (followBtn) {
    followBtn.addEventListener('click', () => {
      isFollowing = !isFollowing;
      if (isFollowing) {
        followBtn.classList.remove('profile-btn--primary');
        followBtn.classList.add('profile-btn--secondary');
        if (followText) followText.textContent = 'Siguiendo';
        showToast('¡Ahora sigues a este lector!', 'success');
      } else {
        followBtn.classList.add('profile-btn--primary');
        followBtn.classList.remove('profile-btn--secondary');
        if (followText) followText.textContent = 'Seguir';
        showToast('Has dejado de seguir a este lector.', 'info');
      }
    });
  }

  // Dropdown menu toggle
  const dotsBtn = document.getElementById('menu-dots-btn');
  const menuDropdown = document.getElementById('dropdown-profile-menu');
  if (dotsBtn && menuDropdown) {
    dotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.hidden = !menuDropdown.hidden;
    });
    document.addEventListener('click', () => {
      menuDropdown.hidden = true;
    });
  }

  // Share profile button
  const shareBtn = document.getElementById('btn-share');
  const shareLabel = document.getElementById('btn-share-label');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        const originalText = shareLabel ? shareLabel.textContent : 'Compartir';
        if (shareLabel) shareLabel.textContent = '¡Copiado!';
        showToast('Enlace de perfil copiado al portapapeles', 'success');
        setTimeout(() => {
          if (shareLabel) shareLabel.textContent = originalText;
        }, 2000);
      } catch {
        showToast('Enlace: ' + window.location.href, 'info');
      }
    });
  }

  // Pestañas de Navegación
  const profileTabs = document.getElementById('profile-tabs');
  const tabBtns = profileTabs ? profileTabs.querySelectorAll('.profile-tab-btn') : [];
  const panes = {
    activity: document.getElementById('pane-activity'),
    library: document.getElementById('pane-library'),
    comments: document.getElementById('pane-comments')
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab') || 'activity';

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      Object.entries(panes).forEach(([key, pane]) => {
        if (!pane) return;
        pane.hidden = (key !== targetTab);
      });
    });
  });

  const bookmarkBtn = document.getElementById('btn-bookmark-profile');
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', () => {
      showToast('Perfil guardado en tus favoritos', 'success');
      if (menuDropdown) menuDropdown.hidden = true;
    });
  }

  const reportBtn = document.getElementById('btn-report-profile');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      showToast('Reporte enviado a los moderadores.', 'info');
      if (menuDropdown) menuDropdown.hidden = true;
    });
  }

}

// Variable de usuario autenticado
let currentUser = null;


async function loadUser(id) {
  try {
    const cleanId = id.trim().replace(/^@/, '');
    const user = await apiRequest(`/users/${encodeURIComponent(cleanId)}`);
    renderUser(user);
  } catch (error) {
    console.error('Error cargando usuario:', error);
    if (error.status === 404 || error.message?.toLowerCase().includes('no encontrado')) {
      showError(
        'Lector no encontrado',
        `No encontramos a ningún usuario con el identificador "${id}". Verifica el nombre de usuario o código.`
      );
    } else {
      showError(
        'Perfil temporalmente inaccesible',
        'No pudimos conectar con el servidor para obtener los datos de este lector. Por favor intenta más tarde.'
      );
    }
  }
}

async function init() {
  initInteractiveFeatures();

  const token = getAccessToken();
  if (token) {
    try {
      currentUser = await authRequest('/me');
    } catch (e) {
      console.warn('Error resolviendo usuario actual:', e);
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  let identifier = urlParams.get('id');

  // Si no hay ?id=, intentar resolver el usuario autenticado
  if (!identifier) {
    if (currentUser && (currentUser.username || currentUser.user_code)) {
      const myId = currentUser.username || currentUser.user_code;
      window.history.replaceState({}, '', `/pages/usuario.html?id=${encodeURIComponent(myId)}`);
      await loadUser(myId);
    } else {
      window.history.replaceState({}, '', `/pages/usuario.html?id=YumeMaster`);
      await loadUser('YumeMaster');
    }
  } else {
    await loadUser(identifier);
  }
}

// Escuchar actualización de XP en tiempo real
window.addEventListener('yume:xp-updated', (e) => {
  if (e.detail?.new_xp !== undefined || e.detail?.xp !== undefined) {
    const xp = e.detail.new_xp ?? e.detail.xp;
    const lvl = e.detail.level || (Math.floor(xp / 1000) + 1);
    const currXp = e.detail.current_level_xp ?? (xp % 1000);
    const remXp = e.detail.remaining_xp ?? (1000 - currXp);
    const pct = e.detail.percentage ?? Math.min(100, Math.floor((currXp / 1000) * 100));

    const levelBadge = document.getElementById('user-level-badge');
    if (levelBadge) levelBadge.textContent = `Nv. ${lvl}`;

    const xpNumbers = document.getElementById('xp-numbers-label');
    if (xpNumbers) xpNumbers.textContent = `${currXp.toLocaleString()} / 1,000 EXP`;

    const xpPct = document.getElementById('xp-pct-label');
    if (xpPct) xpPct.textContent = `${pct}% Completado`;

    const xpRemaining = document.getElementById('xp-remaining-label');
    if (xpRemaining) xpRemaining.textContent = `Faltan ${remXp.toLocaleString()} EXP`;

    const xpBar = document.getElementById('xp-progress-bar');
    if (xpBar) xpBar.style.width = `${pct}%`;
  }
});

init();

