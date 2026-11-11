import { apiRequest, getAccessToken } from '../shared/auth.js';
import { esc as escapeHtml } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import {
  renderScanSkeletons,
  renderClanWorksSkeletons,
  renderClanMembersSkeletons,
} from '../components/skeletons.js';

let scansList = [];
let dbRoles = [];
let myScan = null;
let currentFilter = 'all';
let searchQuery = '';
let activeScanDetail = null;
let profileWorksQuery = '';
let profileWorksSort = 'recent';

const directoryView = document.getElementById('scans-directory-view');
const profileView = document.getElementById('scan-profile-view');
const scansGrid = document.getElementById('scans-grid');
const scansEmpty = document.getElementById('scans-empty');
const searchInput = document.getElementById('scans-search-input');
const searchClear = document.getElementById('scans-search-clear');
const tabButtons = document.querySelectorAll('.scans-tab');
const statScansCount = document.getElementById('stat-scans-count');
const statWorksCount = document.getElementById('stat-works-count');
const statChaptersCount = document.getElementById('stat-chapters-count');
const myScanSection = document.getElementById('my-scan-section');
const myScanCard = document.getElementById('my-scan-card');

const spBackBtn = document.getElementById('sp-back-btn');
const spShareBtn = document.getElementById('sp-share-btn');
const spBannerImg = document.getElementById('sp-banner-img');
const spLogo = document.getElementById('sp-logo');
const spLevelChip = document.getElementById('sp-level-chip');
const spName = document.getElementById('sp-name');
const spRankPill = document.getElementById('sp-rank-pill');
const spStatusPill = document.getElementById('sp-status-pill');
const spOwnerName = document.getElementById('sp-owner-name');
const spCreatedMeta = document.getElementById('sp-created-meta');
const spSlugMeta = document.getElementById('sp-slug-meta');
const spDesc = document.getElementById('sp-desc');
const spActionBar = document.getElementById('sp-action-bar');

const spPrestigeTitle = document.getElementById('sp-prestige-title');
const spPrestigeXp = document.getElementById('sp-prestige-xp');
const spPrestigeFill = document.getElementById('sp-prestige-fill');
const spPrestigeHint = document.getElementById('sp-prestige-hint');
const spStatWorks = document.getElementById('sp-stat-works');
const spStatChapters = document.getElementById('sp-stat-chapters');
const spStatMembers = document.getElementById('sp-stat-members');
const spStatRating = document.getElementById('sp-stat-rating');
const spStatViews = document.getElementById('sp-stat-views');

const spTabs = document.querySelectorAll('.sp-tab');
const spTabJoinBtn = document.querySelector('.sp-tab[data-sp-tab="join"]');
const spTabWorksCount = document.getElementById('sp-tab-works-count');
const spTabMembersCount = document.getElementById('sp-tab-members-count');
const spWorksFilterInput = document.getElementById('sp-works-filter-input');
const spWorksSortSelect = document.getElementById('sp-works-sort-select');
const spWorksGrid = document.getElementById('sp-works-grid');
const spMembersGrid = document.getElementById('sp-members-grid');
const spPatronageContent = document.getElementById('sp-patronage-content');
const spJoinContent = document.getElementById('sp-join-content');
const spUserStatusCard = document.getElementById('sp-user-status-card');
const spUserStatusBody = document.getElementById('sp-user-status-body');
const spRolesBreakdown = document.getElementById('sp-roles-breakdown');
const spSideSocials = document.getElementById('sp-side-socials');

function formatScanDate(dateStr) {
  if (!dateStr) return 'Fundado recientemente';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Fundado recientemente';
  return `Fundado en ${d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;
}

async function initScansPage() {
  try {
    if (scansGrid) scansGrid.innerHTML = renderScanSkeletons(6);
    await reloadGlobalState();

    const initialSlug = new URLSearchParams(window.location.search).get('slug');
    if (initialSlug) {
      await openScanProfile(initialSlug, { pushHistory: false });
    } else {
      showDirectoryView({ pushHistory: false });
    }
  } catch (err) {
    console.error('Error al inicializar scans:', err);
    if (scansGrid) {
      scansGrid.innerHTML = `
        <div class="scans-empty" style="grid-column: 1 / -1;">
          <h3>No se pudieron cargar los scans</h3>
          <p>Ocurrió un problema de conexión con el servidor.</p>
        </div>
      `;
    }
  }
}

async function reloadGlobalState() {
  const [scansData, rolesData, myScanData] = await Promise.allSettled([
    apiRequest('/scan-groups/public'),
    apiRequest('/scan-groups/roles'),
    apiRequest('/scan-groups/my-scan'),
  ]);

  if (rolesData.status === 'fulfilled' && Array.isArray(rolesData.value)) {
    dbRoles = rolesData.value;
  } else if (!dbRoles.length) {
    dbRoles = [
      { code: 'TRANSLATOR', name: 'Traductor' },
      { code: 'EDITOR', name: 'Editor / Typesetter' },
      { code: 'UPLOADER', name: 'Uploader' },
    ];
  }

  if (scansData.status === 'fulfilled' && Array.isArray(scansData.value)) {
    scansList = scansData.value;
  }

  if (myScanData.status === 'fulfilled' && myScanData.value?.id) {
    myScan = myScanData.value;
    renderMyScanBanner(myScan);
  } else {
    myScan = null;
    if (myScanSection) myScanSection.hidden = true;
  }

  updateGlobalStats(scansList);
  renderScans();
}

function updateGlobalStats(list) {
  const worksCount = list.reduce((acc, c) => acc + (Number(c.works_count) || 0), 0);
  const chaptersCount = list.reduce((acc, c) => acc + (Number(c.chapters_count) || 0), 0);

  if (statScansCount) statScansCount.textContent = list.length.toLocaleString('es-ES');
  if (statWorksCount) statWorksCount.textContent = worksCount.toLocaleString('es-ES');
  if (statChaptersCount) statChaptersCount.textContent = chaptersCount.toLocaleString('es-ES');
}

function renderMyScanBanner(userScan) {
  if (!myScanSection || !myScanCard) return;

  const logoUrl = userScan.logo_url || '/assets/icons/logo.png';
  const roleCode = (userScan.role_code || 'UPLOADER').toLowerCase();
  const roleName = escapeHtml(userScan.role_name || userScan.role_code || 'Miembro');
  const rankCode = userScan.rank_code || 'RANGO C';
  const level = userScan.clan_level || 1;

  myScanCard.innerHTML = `
    <div class="my-clan-left">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(userScan.name)}" class="my-clan-logo" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
      <div>
        <span class="my-clan-info-tag">Tu Scan Actual • ${escapeHtml(rankCode)} (NV. ${level})</span>
        <h2 class="my-clan-name">${escapeHtml(userScan.name)}</h2>
        <span class="my-clan-role-badge role-${roleCode}">
          <img src="/assets/icons/svg/gamification/verified.svg" alt="" width="12" height="12">
          ${roleName}
        </span>
      </div>
    </div>
    <div class="my-clan-actions">
      <button type="button" class="sp-btn sp-btn--primary" data-action="open-profile" data-slug="${escapeHtml(userScan.slug)}">
        <img src="/assets/icons/svg/actions/eye.svg" alt="" width="14" height="14">
        <span>Ver Perfil Público del Scan</span>
      </button>
    </div>
  `;

  myScanSection.hidden = false;
}

function getFilteredScans() {
  let list = [...scansList];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.owner_username || '').toLowerCase().includes(q)
    );
  }

  if (currentFilter === 'active') {
    list.sort((a, b) => (b.chapters_count || 0) - (a.chapters_count || 0));
  } else if (currentFilter === 'works') {
    list.sort((a, b) => (b.works_count || 0) - (a.works_count || 0));
  } else if (currentFilter === 'recruiting') {
    list = list.filter((s) => Boolean(s.social_links?.discord || s.social_links?.web || (s.members_count || 1) < 30));
  }

  return list;
}

function renderScans() {
  if (!scansGrid) return;
  const items = getFilteredScans();

  if (items.length === 0) {
    scansGrid.innerHTML = '';
    if (scansEmpty) scansEmpty.hidden = false;
    return;
  }

  if (scansEmpty) scansEmpty.hidden = true;

  scansGrid.innerHTML = items
    .map((scan) => {
      const banner = scan.banner_url || '';
      const logo = scan.logo_url || '/assets/icons/logo.png';
      const name = escapeHtml(scan.name);
      const desc = escapeHtml(scan.description || 'Equipo de traducción oficial en YumeZone.');
      const owner = escapeHtml(scan.owner_username || 'Líder');
      const works = Number(scan.works_count || 0).toLocaleString('es-ES');
      const chapters = Number(scan.chapters_count || 0).toLocaleString('es-ES');
      const members = Number(scan.members_count || 1).toLocaleString('es-ES');
      const discord = scan.social_links?.discord;
      const rankCode = escapeHtml(scan.rank_code || 'RANGO C');
      const level = Number(scan.clan_level || 1);
      const isMine = myScan && Number(myScan.id) === Number(scan.id);

      return `
        <article class="scan-card" data-slug="${escapeHtml(scan.slug)}">
          <div class="scan-card-banner-wrap">
            ${banner ? `<img src="${escapeHtml(banner)}" alt="" class="scan-card-banner" loading="lazy">` : ''}
            <div class="scan-card-banner-scrim"></div>
            <span class="scan-card-rank-tag">${rankCode} • NV. ${level}</span>
          </div>

          <div class="scan-card-logo-wrap">
            <img src="${escapeHtml(logo)}" alt="${name}" class="scan-card-logo" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
          </div>

          <div class="scan-card-content">
            <div class="scan-card-header-row">
              <div class="scan-card-title-group">
                <h3 class="scan-card-title">${name}</h3>
                <span class="scan-card-badge-verified" title="Scan Verificado">
                  <img src="/assets/icons/svg/gamification/verified.svg" alt="" width="14" height="14">
                </span>
              </div>
              ${isMine ? `<span class="sp-status-pill" style="font-size:0.62rem;padding:0.15rem 0.5rem;">TU SCAN</span>` : ''}
            </div>

            <p class="scan-card-desc">${desc}</p>

            <div class="scan-card-owner">
              <span class="scan-card-owner-label">Líder del Scan:</span>
              <span class="scan-card-owner-name">@${owner}</span>
            </div>

            <div class="scan-card-metrics">
              <div class="scan-metric-item">
                <span class="scan-metric-val">
                  <img src="/assets/icons/svg/content/book.svg" alt="" width="13" height="13">
                  ${works}
                </span>
                <span class="scan-metric-lbl">Obras</span>
              </div>
              <div class="scan-metric-item">
                <span class="scan-metric-val">
                  <img src="/assets/icons/svg/content/grid.svg" alt="" width="13" height="13">
                  ${chapters}
                </span>
                <span class="scan-metric-lbl">Capítulos</span>
              </div>
              <div class="scan-metric-item">
                <span class="scan-metric-val">
                  <img src="/assets/icons/svg/user/user.svg" alt="" width="13" height="13">
                  ${members}
                </span>
                <span class="scan-metric-lbl">Miembros</span>
              </div>
            </div>

            <div class="scan-card-footer">
              <button type="button" class="scan-btn-view" data-action="open-profile" data-slug="${escapeHtml(scan.slug)}">
                <img src="/assets/icons/svg/actions/eye.svg" alt="" width="14" height="14">
                <span>Ver Perfil del Scan</span>
              </button>
              ${
                discord
                  ? `<a href="${escapeHtml(discord)}" target="_blank" rel="noopener noreferrer" class="scan-btn-discord" title="Discord del Scan" aria-label="Discord de ${name}">
                      <img src="/assets/icons/svg/social/discord.svg" alt="" width="16" height="16">
                    </a>`
                  : ''
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function showDirectoryView({ pushHistory = true } = {}) {
  activeScanDetail = null;
  if (profileView) profileView.hidden = true;
  if (directoryView) directoryView.hidden = false;
  document.title = 'Scans de Traducción | YumeZone';

  if (pushHistory) {
    const url = new URL(window.location.href);
    url.searchParams.delete('slug');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
  }
}

async function openScanProfile(slug, { pushHistory = true, keepTab = false } = {}) {
  if (!slug || !profileView || !directoryView) return;

  directoryView.hidden = true;
  profileView.hidden = false;

  if (pushHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set('slug', slug);
    window.history.pushState({ slug }, '', `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (spName) spName.textContent = 'Cargando perfil del Scan…';
  if (spDesc) spDesc.textContent = 'Obteniendo catálogo de obras, integrantes y estadísticas…';
  if (spWorksGrid) spWorksGrid.innerHTML = renderClanWorksSkeletons(6);
  if (spMembersGrid) spMembersGrid.innerHTML = renderClanMembersSkeletons(4);

  if (!keepTab) {
    profileWorksQuery = '';
    if (spWorksFilterInput) spWorksFilterInput.value = '';
    switchProfileTab('works');
  }

  try {
    const data = await apiRequest(`/scan-groups/public/${encodeURIComponent(slug)}`);
    if (!data) throw new Error('Scan no encontrado.');
    activeScanDetail = data;

    document.title = `${data.name} — Perfil de Scan | YumeZone`;
    renderScanProfileView(data);
  } catch (err) {
    showToast(err.detail || err.message || 'No se pudo cargar el perfil del scan.', 'error');
    showDirectoryView({ pushHistory: true });
  }
}

function renderScanProfileView(scan) {
  const works = Array.isArray(scan.works) ? scan.works : [];
  const members = Array.isArray(scan.members) ? scan.members : [];
  const level = Number(scan.clan_level || 1);
  const rankCode = scan.rank_code || 'RANGO C';
  const rankTitle = scan.rank_title || 'Scan Emergente';
  const totalTokens = Number(scan.total_contributed_tokens || 0);
  const vaultTokens = Number(scan.vault_tokens || 0);
  const nextUpgradeCost = Number(scan.next_upgrade_cost || level * 40);
  const progressPct = Number(scan.progress_pct || 0);
  const remainingTokens = Number(scan.remaining_tokens ?? Math.max(0, nextUpgradeCost - vaultTokens));

  if (spBannerImg) {
    if (scan.banner_url) {
      spBannerImg.src = scan.banner_url;
      spBannerImg.hidden = false;
    } else {
      spBannerImg.removeAttribute('src');
      spBannerImg.hidden = true;
    }
  }

  if (spLogo) {
    spLogo.src = scan.logo_url || '/assets/icons/logo.png';
    spLogo.alt = scan.name || 'Scan';
  }
  if (spLevelChip) spLevelChip.textContent = `NV. ${level}`;
  if (spName) spName.textContent = scan.name || 'Scan';
  if (spRankPill) spRankPill.textContent = `${rankCode} • ${rankTitle.toUpperCase()}`;
  if (spStatusPill) {
    spStatusPill.textContent = members.length < 30 ? 'RECLUTAMIENTO ABIERTO' : 'PLANTILLA COMPLETA';
  }

  const leaderMember = members.find((m) => String(m.role_code).toUpperCase() === 'LEADER');
  if (spOwnerName) spOwnerName.textContent = `@${scan.owner_username || leaderMember?.username || 'Líder'}`;
  if (spCreatedMeta) spCreatedMeta.textContent = formatScanDate(scan.created_at);
  if (spSlugMeta) spSlugMeta.textContent = `#${scan.slug}`;
  if (spDesc) {
    spDesc.textContent =
      scan.description ||
      'Equipo de traducción dedicado a adaptar y maquetar obras al español con calidad editorial.';
  }

  if (spPrestigeTitle) spPrestigeTitle.textContent = `${rankTitle} (Nv. ${level})`;
  if (spPrestigeXp) spPrestigeXp.textContent = `${totalTokens.toLocaleString('es-ES')} Cristales`;
  if (spPrestigeFill) spPrestigeFill.style.width = `${progressPct}%`;
  if (spPrestigeHint) {
    spPrestigeHint.textContent =
      remainingTokens > 0
        ? `Bóveda: ${vaultTokens}/${nextUpgradeCost} Cristales para subir al Nv. ${level + 1}`
        : `¡Bóveda lista (${vaultTokens} Cristales) para ascender al Nv. ${level + 1}!`;
  }

  if (spStatWorks) spStatWorks.textContent = Number(scan.works_count ?? works.length).toLocaleString('es-ES');
  if (spStatChapters) spStatChapters.textContent = Number(scan.chapters_count ?? 0).toLocaleString('es-ES');
  if (spStatMembers) spStatMembers.textContent = Number(scan.members_count ?? members.length).toLocaleString('es-ES');
  if (spStatRating) spStatRating.textContent = `★ ${scan.avg_rating || '0.0'}`;
  if (spStatViews) spStatViews.textContent = Number(scan.total_views || 0).toLocaleString('es-ES');

  if (spTabWorksCount) spTabWorksCount.textContent = String(works.length);
  if (spTabMembersCount) spTabMembersCount.textContent = String(members.length);

  renderProfileActionBarAndSidebar(scan, members);
  renderProfileWorks(works);
  renderProfileMembers(members);
  renderProfilePatronageTab(scan);
  renderProfileJoinTab(scan);
  renderRolesBreakdown(scan.role_breakdown || []);
  renderProfileSocials(scan);
}

function getUserScanRelationship(scan) {
  const isLoggedIn = Boolean(getAccessToken());
  const isMemberOfThisScan = Boolean(myScan && Number(myScan.id) === Number(scan.id));
  const isLeaderOfThisScan = Boolean(isMemberOfThisScan && myScan.is_leader);
  return { isLoggedIn, isMemberOfThisScan, isLeaderOfThisScan };
}

function renderProfileActionBarAndSidebar(scan, members) {
  const rel = getUserScanRelationship(scan);
  const socials = scan.social_links || {};

  if (spTabJoinBtn) {
    spTabJoinBtn.hidden = rel.isMemberOfThisScan;
    if (rel.isMemberOfThisScan && spTabJoinBtn.classList.contains('active')) {
      switchProfileTab('works');
    }
  }

  let actionsHtml = `
    <button type="button" class="sp-btn sp-btn--gold" data-action="go-patronage-tab">
      <img src="/assets/icons/svg/gamification/coin.svg" width="15" height="15" alt="">
      <span>Apoyar con Cristales</span>
    </button>
  `;

  if (rel.isMemberOfThisScan) {
    const roleLabel = escapeHtml(myScan.role_name || myScan.role_code || 'Miembro');
    actionsHtml += `
      <span class="my-clan-role-badge role-${escapeHtml((myScan.role_code || 'uploader').toLowerCase())}" style="padding:0.45rem 0.85rem;">
        <img src="/assets/icons/svg/gamification/verified.svg" width="13" height="13" alt="">
        <span>${roleLabel}</span>
      </span>
    `;
    if (!rel.isLeaderOfThisScan || members.length <= 1) {
      actionsHtml += `
        <button type="button" class="sp-btn sp-btn--danger" data-action="prompt-leave-scan">
          <span>Salir del Scan</span>
        </button>
      `;
    }
  } else {
    actionsHtml += `
      <button type="button" class="sp-btn sp-btn--secondary" data-action="go-join-tab">
        <img src="/assets/icons/svg/gamification/bolt.svg" width="15" height="15" alt="">
        <span>Postular al Scan</span>
      </button>
    `;
  }

  if (socials.discord) {
    actionsHtml += `
      <a href="${escapeHtml(socials.discord)}" target="_blank" rel="noopener noreferrer" class="sp-btn sp-btn--discord">
        <img src="/assets/icons/svg/social/discord.svg" width="15" height="15" alt="">
        <span>Discord Oficial</span>
      </a>
    `;
  }

  if (spActionBar) {
    spActionBar.innerHTML = `
      ${actionsHtml}
      <div id="sp-hero-confirm-box" style="width:100%;" hidden></div>
    `;
  }

  if (spUserStatusCard && spUserStatusBody) {
    if (rel.isMemberOfThisScan) {
      spUserStatusCard.hidden = true;
    } else {
      spUserStatusCard.hidden = false;
      spUserStatusBody.innerHTML = !rel.isLoggedIn
        ? `
          <p style="margin:0;line-height:1.5;">
            Inicia sesión con tu cuenta de YumeZone para apoyar a <strong>${escapeHtml(scan.name)}</strong> con Cristales de Clan.
          </p>
          <a href="/pages/login.html" class="sp-btn sp-btn--primary" style="width:100%;">
            <span>Iniciar Sesión</span>
          </a>
        `
        : `
          <p style="margin:0;line-height:1.5;">
            Apoya a <strong>${escapeHtml(scan.name)}</strong> con Cristales para financiar capítulos patrocinados y subir el nivel del Scan.
          </p>
          <button type="button" class="sp-btn sp-btn--gold" data-action="go-patronage-tab" style="width:100%;">
            <span>Donar Cristales</span>
          </button>
          <button type="button" class="sp-btn sp-btn--secondary" data-action="go-join-tab" style="width:100%;">
            <span>Ver Reclutamiento</span>
          </button>
        `;
    }
  }
}

function renderProfileWorks(works) {
  if (!spWorksGrid) return;

  let filtered = Array.isArray(works) ? [...works] : [];
  if (profileWorksQuery.trim()) {
    const q = profileWorksQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (w) =>
        (w.title || '').toLowerCase().includes(q) ||
        (w.format || w.format_name || '').toLowerCase().includes(q) ||
        (w.status || w.status_name || '').toLowerCase().includes(q)
    );
  }

  if (profileWorksSort === 'chapters') {
    filtered.sort((a, b) => (Number(b.chapters_count) || 0) - (Number(a.chapters_count) || 0));
  } else if (profileWorksSort === 'score') {
    filtered.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  } else if (profileWorksSort === 'views') {
    filtered.sort((a, b) => (Number(b.total_views) || 0) - (Number(a.total_views) || 0));
  }

  if (filtered.length === 0) {
    spWorksGrid.innerHTML = `
      <div class="scans-empty" style="grid-column: 1 / -1;">
        <h3>Sin obras para mostrar</h3>
        <p>${works.length === 0 ? 'Este scan aún no tiene obras públicas registradas.' : 'Ninguna obra coincide con tu filtro.'}</p>
      </div>
    `;
    return;
  }

  spWorksGrid.innerHTML = filtered
    .map((w) => {
      const cover = w.cover_url || '/assets/icons/logo.png';
      const title = escapeHtml(w.title || 'Obra');
      const status = escapeHtml(w.status || w.status_name || 'En emisión');
      const format = escapeHtml(w.format || w.format_name || 'Manga');
      const score = Number(w.score || 0).toFixed(1);
      const chapters = Number(w.chapters_count || 0);
      const views = Number(w.total_views || 0).toLocaleString('es-ES');

      return `
        <a href="/pages/obra.html?slug=${encodeURIComponent(w.slug)}" class="clan-work-card">
          <div class="clan-work-cover-wrap">
            <img src="${escapeHtml(cover)}" alt="${title}" class="clan-work-cover" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
            <span class="clan-work-badge-format">${format}</span>
          </div>
          <div class="clan-work-info">
            <h4 class="clan-work-title" title="${title}">${title}</h4>
            <div class="clan-work-meta">
              <span>${status}</span>
              <span class="clan-work-score">★ ${score}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.72rem;color:var(--teal-300,#5eead4);margin-top:0.25rem;font-weight:700;">
              <span>${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}</span>
              <span style="color:var(--neutral-400);font-weight:600;">${views} lecturas</span>
            </div>
          </div>
        </a>
      `;
    })
    .join('');
}

function renderProfileMembers(members) {
  if (!spMembersGrid) return;

  if (members.length === 0) {
    spMembersGrid.innerHTML = `
      <div class="scans-empty" style="grid-column: 1 / -1;">
        <p>No se encontraron miembros activos en este scan.</p>
      </div>
    `;
    return;
  }

  spMembersGrid.innerHTML = members
    .map((m) => {
      const avatar = m.avatar_url || '/assets/icons/logo.png';
      const frame = m.avatar_frame_url || '';
      const username = escapeHtml(m.username || 'Usuario');
      const code = escapeHtml(m.user_code ? `#${m.user_code}` : '');
      const roleCode = (m.role_code || 'uploader').toLowerCase();
      const roleName = escapeHtml(m.role_name || m.role_code || 'Miembro');

      return `
        <div class="clan-member-card">
          <a href="/pages/usuario.html?u=${encodeURIComponent(m.username)}" class="clan-member-card__left" title="Ver perfil de @${username}">
            <div class="clan-member-avatar-wrap">
              <img src="${escapeHtml(avatar)}" alt="${username}" class="clan-member-avatar" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
              ${frame ? `<img src="${escapeHtml(frame)}" alt="" class="clan-member-frame" loading="lazy">` : ''}
            </div>
            <div class="clan-member-details">
              <div class="clan-member-name">@${username} <span style="font-size: 0.72rem; color: var(--neutral-400); font-weight: 600;">${code}</span></div>
              <span class="clan-member-role role-${roleCode}">${roleName}</span>
            </div>
          </a>
        </div>
      `;
    })
    .join('');
}

function renderProfilePatronageTab(scan) {
  if (!spPatronageContent) return;

  const rel = getUserScanRelationship(scan);
  const goals = Array.isArray(scan.goals) ? scan.goals : [];
  const activeGoals = goals.filter((g) => String(g.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const supporters = Array.isArray(scan.top_supporters) ? scan.top_supporters : [];
  const vaultTokens = Number(scan.vault_tokens || 0);
  const totalContributed = Number(scan.total_contributed_tokens || 0);
  const clanLevel = Number(scan.clan_level || 1);

  const goalOptionsHtml = activeGoals
    .map(
      (g) =>
        `<option value="${g.id}">Meta: ${escapeHtml(g.title)} (${Number(g.current_tokens || 0)}/${Number(g.target_tokens || 1)} Cristales)</option>`
    )
    .join('');

  const goalsListHtml =
    goals.length === 0
      ? `
        <div class="scans-empty" style="padding:1.5rem;">
          <p style="margin:0;">Este scan aún no ha publicado metas específicas. Tus aportes irán a su Bóveda General.</p>
        </div>
      `
      : goals
          .map((g) => {
            const current = Number(g.current_tokens || 0);
            const target = Math.max(1, Number(g.target_tokens || 1));
            const pct = Math.min(100, Math.round((current / target) * 100));
            const isDone = String(g.status).toUpperCase() === 'COMPLETED' || current >= target;

            return `
              <div class="sp-role-join-card" style="gap:0.65rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;">
                  <div>
                    <strong style="color:#f8fafc;font-size:0.95rem;">${escapeHtml(g.title)}</strong>
                    ${g.work_title ? `<div style="font-size:0.75rem;color:#38bdf8;font-weight:700;margin-top:0.15rem;">Obra: ${escapeHtml(g.work_title)}</div>` : ''}
                    ${g.description ? `<p style="margin:0.35rem 0 0;font-size:0.8rem;color:var(--neutral-400);">${escapeHtml(g.description)}</p>` : ''}
                  </div>
                  <span class="sp-status-pill" style="font-size:0.68rem;">
                    ${isDone ? '¡META CUMPLIDA!' : `${current}/${target} CRISTALES`}
                  </span>
                </div>
                <div class="sp-prestige-bar" style="height:8px;">
                  <div class="sp-prestige-bar__fill" style="width:${pct}%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--neutral-400);">
                  <span>Progreso: ${pct}%</span>
                  ${
                    !isDone && rel.isLoggedIn
                      ? `<button type="button" class="sp-btn sp-btn--gold" style="padding:0.35rem 0.75rem;font-size:0.74rem;" data-action="select-goal-donate" data-goal-id="${g.id}">
                          <span>Aportar a esta Meta</span>
                        </button>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('');

  const supportersHtml =
    supporters.length === 0
      ? `<p style="margin:0;font-size:0.82rem;color:var(--neutral-400);">Sé el primer mecenas en apoyar a ${escapeHtml(scan.name)} con Cristales.</p>`
      : supporters
          .map(
            (s, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0.75rem;background:rgba(15,23,42,0.55);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
              <div style="display:flex;align-items:center;gap:0.6rem;">
                <span style="font-weight:800;color:#fbbf24;font-size:0.82rem;">#${idx + 1}</span>
                <img src="${escapeHtml(s.avatar_url || '/assets/icons/logo.png')}" alt="" width="26" height="26" style="border-radius:50%;object-fit:cover;" onerror="this.src='/assets/icons/logo.png'">
                <a href="/pages/usuario.html?u=${encodeURIComponent(s.username)}" style="color:#f8fafc;font-weight:700;font-size:0.84rem;text-decoration:none;">@${escapeHtml(s.username)}</a>
              </div>
              <span style="color:#5eead4;font-weight:800;font-size:0.8rem;">
                ${Number(s.total_tokens || 0).toLocaleString('es-ES')} Cristales
              </span>
            </div>
          `
          )
          .join('');

  spPatronageContent.innerHTML = `
    <div class="sp-join-banner">
      <h3>Mecenazgo de Cristales para ${escapeHtml(scan.name)} (Nivel ${clanLevel})</h3>
      <p>
        Impulsa a tu Scan favorito donando los <strong>Cristales de Clan</strong> disponibles en tu cartera.
        Bóveda actual del Scan: <strong>${vaultTokens.toLocaleString('es-ES')} Cristales</strong> (${totalContributed.toLocaleString('es-ES')} históricos).
      </p>
    </div>

    ${
      rel.isLoggedIn
        ? `
          <form id="sp-reader-donate-form" class="sp-manager-box" style="margin-bottom:1.5rem;display:grid;gap:0.9rem;">
            <div class="sp-manager-box__head">
              <strong>Donar Cristales a ${escapeHtml(scan.name)}</strong>
              <span>Elige la cantidad de Cristales de tu cartera y a qué meta deseas enviar tu aporte.</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
              <div>
                <label style="display:block;font-size:0.75rem;color:var(--neutral-400);margin-bottom:0.3rem;">Cantidad de Cristales a donar</label>
                <input type="number" id="sp-donate-tokens-input" class="sp-input" min="1" step="1" value="1" required style="width:100%;">
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;color:var(--neutral-400);margin-bottom:0.3rem;">Destino del Aporte</label>
                <select id="sp-donate-goal-select" class="sp-select" style="width:100%;">
                  <option value="">Bóveda General del Scan</option>
                  ${goalOptionsHtml}
                </select>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
              <span id="sp-donate-preview-label" style="font-size:0.82rem;color:#5eead4;font-weight:700;">
                Total a enviar al Scan: 1 Cristal de Clan 💎
              </span>
              <button type="submit" id="sp-donate-submit-btn" class="sp-btn sp-btn--gold">
                <img src="/assets/icons/svg/gamification/star.svg" width="15" height="15" alt="">
                <span>Enviar Cristales al Scan</span>
              </button>
            </div>
          </form>
        `
        : `
          <div class="sp-confirm-inline" style="margin-bottom:1.5rem;">
            <p>Inicia sesión con tu cuenta de YumeZone para donar Cristales y apoyar las metas de <strong>${escapeHtml(scan.name)}</strong>.</p>
            <div class="sp-confirm-inline__actions">
              <a href="/pages/login.html" class="sp-btn sp-btn--primary"><span>Iniciar Sesión</span></a>
            </div>
          </div>
        `
    }

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem;">
      <div>
        <h4 style="margin:0 0 0.75rem;color:#f8fafc;font-size:0.95rem;">Metas de Capítulos Patrocinados</h4>
        <div style="display:grid;gap:0.75rem;">
          ${goalsListHtml}
        </div>
      </div>
      <div>
        <h4 style="margin:0 0 0.75rem;color:#f8fafc;font-size:0.95rem;">Top Mecenas del Scan</h4>
        <div style="display:grid;gap:0.55rem;">
          ${supportersHtml}
        </div>
      </div>
    </div>
  `;

  const tokensInput = document.getElementById('sp-donate-tokens-input');
  const previewLbl = document.getElementById('sp-donate-preview-label');
  const donateForm = document.getElementById('sp-reader-donate-form');

  tokensInput?.addEventListener('input', () => {
    if (!previewLbl) return;
    const direct = Math.max(1, Number(tokensInput.value || 1));
    previewLbl.textContent = `Total a enviar al Scan: ${direct} ${direct === 1 ? 'Cristal de Clan 💎' : 'Cristales de Clan 💎'}`;
  });

  donateForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeScanDetail?.id) return;
    const direct_tokens = Math.max(0, Number(tokensInput?.value || 0));
    const goalVal = document.getElementById('sp-donate-goal-select')?.value;
    const goal_id = goalVal ? Number(goalVal) : null;

    if (direct_tokens < 1) {
      showToast('Ingresa al menos 1 Cristal de tu cartera para donar.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('sp-donate-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await apiRequest(`/scan-groups/${activeScanDetail.id}/convert-and-donate`, {
        method: 'POST',
        body: { coins_to_convert: 0, direct_tokens, goal_id },
      });
      const updatedCoins = res?.user_balance?.coins ?? res?.remaining_coins;
      const updatedTokens = res?.user_balance?.clan_tokens ?? res?.remaining_tokens;
      if (updatedCoins !== undefined || updatedTokens !== undefined) {
        window.dispatchEvent(
          new CustomEvent('yume:wallet-updated', {
            detail: { coins: updatedCoins, clan_tokens: updatedTokens },
          })
        );
      }
      showToast(res?.message || `¡Enviaste ${direct_tokens} ${direct_tokens === 1 ? 'Cristal' : 'Cristales'} al Scan!`, 'success');
      await reloadGlobalState();
      await openScanProfile(activeScanDetail.slug, { pushHistory: false, keepTab: true });
    } catch (err) {
      showToast(err.detail || err.message || 'No se pudo procesar la donación.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function renderProfileJoinTab(scan) {
  if (!spJoinContent) return;

  const rel = getUserScanRelationship(scan);
  if (rel.isMemberOfThisScan) {
    spJoinContent.innerHTML = '';
    return;
  }

  const socials = scan.social_links || {};
  const roleDescriptions = {
    TRANSLATOR: 'Traducción y adaptación de diálogos desde el idioma original al español neutro.',
    EDITOR: 'Limpieza de viñetas (Cleaner / Redraw) y maquetación tipográfica (Typesetter).',
    UPLOADER: 'Control de calidad, empaquetado en formato .WEBP y programación de capítulos.',
  };

  const joinableRoles = dbRoles.filter((r) =>
    ['TRANSLATOR', 'EDITOR', 'UPLOADER'].includes(String(r.code).toUpperCase())
  );

  spJoinContent.innerHTML = `
    <div class="sp-join-banner">
      <h3>Reclutamiento Oficial de ${escapeHtml(scan.name)}</h3>
      <p>
        El ingreso a la plantilla del Scan requiere aprobación directa del <strong>Líder o Colíder</strong>. Contacta al equipo en su Discord oficial indicando tu <strong style="color:#5eead4;">@usuario</strong> o código de YumeZone y el rol al que postulas.
      </p>
    </div>

    <div class="sp-roles-cards-grid">
      ${joinableRoles
        .map((r) => {
          const code = String(r.code).toUpperCase();
          const name = escapeHtml(r.name || code);
          const desc = escapeHtml(roleDescriptions[code] || 'Integrante activo del equipo editorial.');
          const roleClass = `role-${code.toLowerCase()}`;

          return `
            <div class="sp-role-join-card">
              <div>
                <span class="clan-member-role ${roleClass}">${name}</span>
                <p class="sp-role-join-card__desc">${desc}</p>
              </div>
              ${
                socials.discord
                  ? `
                    <a href="${escapeHtml(socials.discord)}" target="_blank" rel="noopener noreferrer" class="sp-btn sp-btn--discord" style="width:100%;">
                      <img src="/assets/icons/svg/social/discord.svg" width="15" height="15" alt="">
                      <span>Postular como ${name} en Discord</span>
                    </a>
                  `
                  : `
                    <span style="font-size:0.78rem;color:var(--neutral-400);">
                      Contacta a @${escapeHtml(scan.owner_username || 'Líder')} para solicitar ingreso como ${name}.
                    </span>
                  `
              }
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderRolesBreakdown(breakdown) {
  if (!spRolesBreakdown) return;
  spRolesBreakdown.innerHTML = breakdown
    .map(
      (g) => `
        <div class="sp-role-stat-row">
          <div class="sp-role-stat-row__top">
            <span style="color:#e2e8f0;font-weight:700;">${escapeHtml(g.label)}</span>
            <span style="color:var(--neutral-400);font-weight:800;">${Number(g.count || 0)}</span>
          </div>
          <div class="sp-role-stat-row__bar">
            <div class="sp-role-stat-row__fill" style="width:${Number(g.pct || 0)}%;background:${escapeHtml(g.color)};"></div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderProfileSocials(scan) {
  if (!spSideSocials) return;
  const socials = scan.social_links || {};
  let html = '';

  if (socials.discord) {
    html += `
      <a href="${escapeHtml(socials.discord)}" target="_blank" rel="noopener noreferrer" class="sp-btn sp-btn--discord" style="width:100%;justify-content:flex-start;">
        <img src="/assets/icons/svg/social/discord.svg" width="16" height="16" alt="">
        <span>Servidor Oficial de Discord</span>
      </a>
    `;
  }

  if (socials.web) {
    html += `
      <a href="${escapeHtml(socials.web)}" target="_blank" rel="noopener noreferrer" class="sp-btn sp-btn--secondary" style="width:100%;justify-content:flex-start;">
        <img src="/assets/icons/svg/navigation/trending.svg" width="16" height="16" alt="">
        <span>Sitio Web del Scan</span>
      </a>
    `;
  }

  spSideSocials.innerHTML =
    html ||
    `<p style="margin:0;font-size:0.8rem;color:var(--neutral-400);">Este scan gestiona su comunidad directamente desde su perfil en YumeZone.</p>`;
}

function switchProfileTab(targetKey) {
  spTabs.forEach((tab) => {
    const isTarget = tab.dataset.spTab === targetKey;
    tab.classList.toggle('active', isTarget);
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  const panes = {
    works: document.getElementById('sp-pane-works'),
    members: document.getElementById('sp-pane-members'),
    patronage: document.getElementById('sp-pane-patronage'),
    join: document.getElementById('sp-pane-join'),
  };

  Object.entries(panes).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', key === targetKey);
  });
}

function showLeaveConfirmation() {
  if (!activeScanDetail) return;
  const heroBox = document.getElementById('sp-hero-confirm-box');
  if (!heroBox) return;

  heroBox.innerHTML = `
    <div class="sp-confirm-inline">
      <p>
        ¿Confirmas que deseas salir del scan <strong>${escapeHtml(activeScanDetail.name)}</strong>? Dejarás de figurar en su plantilla pública.
      </p>
      <div class="sp-confirm-inline__actions">
        <button type="button" class="sp-btn sp-btn--danger" data-action="confirm-leave-scan">
          <span>Sí, salir del Scan</span>
        </button>
        <button type="button" class="sp-btn sp-btn--secondary" data-action="cancel-leave-scan">
          <span>Cancelar</span>
        </button>
      </div>
    </div>
  `;
  heroBox.hidden = false;
}

function hideLeaveConfirmation() {
  const heroBox = document.getElementById('sp-hero-confirm-box');
  if (heroBox) {
    heroBox.innerHTML = '';
    heroBox.hidden = true;
  }
}

async function executeLeaveScan() {
  if (!activeScanDetail?.id) return;
  try {
    const res = await apiRequest(`/scan-groups/${activeScanDetail.id}/leave`, {
      method: 'POST',
    });
    showToast(res?.message || `Has salido de ${activeScanDetail.name}.`, 'info');
    hideLeaveConfirmation();
    await reloadGlobalState();
    await openScanProfile(activeScanDetail.slug, { pushHistory: false, keepTab: false });
  } catch (err) {
    showToast(err.detail || err.message || 'No se pudo salir del scan.', 'error');
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentFilter = btn.dataset.filter || 'all';
    renderScans();
  });
});

searchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  if (searchClear) searchClear.hidden = !searchQuery;
  renderScans();
});

searchClear?.addEventListener('click', () => {
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  searchQuery = '';
  searchClear.hidden = true;
  renderScans();
});

spWorksFilterInput?.addEventListener('input', (e) => {
  profileWorksQuery = e.target.value;
  if (activeScanDetail) renderProfileWorks(activeScanDetail.works || []);
});

spWorksSortSelect?.addEventListener('change', (e) => {
  profileWorksSort = e.target.value;
  if (activeScanDetail) renderProfileWorks(activeScanDetail.works || []);
});

spTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.spTab;
    if (key) switchProfileTab(key);
  });
});

spBackBtn?.addEventListener('click', () => {
  showDirectoryView({ pushHistory: true });
});

spShareBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Enlace del perfil del Scan copiado al portapapeles.', 'success');
  } catch {
    showToast('No se pudo copiar el enlace.', 'warning');
  }
});

document.addEventListener('click', async (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    const action = actionBtn.dataset.action;

    if (action === 'open-profile') {
      const slug = actionBtn.dataset.slug;
      if (slug) openScanProfile(slug, { pushHistory: true });
      return;
    }

    if (action === 'go-patronage-tab') {
      switchProfileTab('patronage');
      document.getElementById('sp-pane-patronage')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (action === 'select-goal-donate') {
      const goalId = actionBtn.dataset.goalId;
      switchProfileTab('patronage');
      const goalSelect = document.getElementById('sp-donate-goal-select');
      if (goalSelect && goalId) goalSelect.value = String(goalId);
      document.getElementById('sp-reader-donate-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (action === 'go-join-tab') {
      switchProfileTab('join');
      document.getElementById('sp-pane-join')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (action === 'prompt-leave-scan') {
      showLeaveConfirmation();
      return;
    }

    if (action === 'cancel-leave-scan') {
      hideLeaveConfirmation();
      return;
    }

    if (action === 'confirm-leave-scan') {
      actionBtn.disabled = true;
      await executeLeaveScan();
      actionBtn.disabled = false;
      return;
    }
  }

  const card = e.target.closest('.scan-card');
  if (card && !e.target.closest('a') && !e.target.closest('button')) {
    const slug = card.dataset.slug;
    if (slug) openScanProfile(slug, { pushHistory: true });
  }
});

window.addEventListener('popstate', () => {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) {
    openScanProfile(slug, { pushHistory: false });
  } else {
    showDirectoryView({ pushHistory: false });
  }
});

initScansPage();
