// clanes y scans

import { apiRequest } from '../shared/auth.js';
import { esc as escapeHtml } from '../shared/ui-utils.js';
import { renderScanSkeletons, renderClanWorksSkeletons, renderClanMembersSkeletons } from '../components/skeletons.js';

// estado local
let scansList = [];
let dbRoles = [];
let currentFilter = 'all';
let searchQuery = '';

// elementos dom
const scansGrid = document.getElementById('scans-grid');
const scansEmpty = document.getElementById('scans-empty');
const searchInput = document.getElementById('scans-search-input');
const searchClear = document.getElementById('scans-search-clear');
const tabButtons = document.querySelectorAll('.scans-tab');

// stats globales
const statClansCount = document.getElementById('stat-clans-count');
const statWorksCount = document.getElementById('stat-works-count');
const statChaptersCount = document.getElementById('stat-chapters-count');

// sección mi clan
const myClanSection = document.getElementById('my-clan-section');
const myClanCard = document.getElementById('my-clan-card');

// modal de detalle
const clanModal = document.getElementById('clan-modal');
const modalCloseBtn = document.getElementById('clan-modal-close');
const modalBanner = document.getElementById('modal-clan-banner');
const modalLogo = document.getElementById('modal-clan-logo');
const modalTitle = document.getElementById('clan-modal-title');
const modalDesc = document.getElementById('modal-clan-desc');
const modalSocials = document.getElementById('modal-clan-socials');
const modalTabs = document.querySelectorAll('.clan-modal-tab');
const modalTabWorksCount = document.getElementById('modal-tab-works-count');
const modalTabMembersCount = document.getElementById('modal-tab-members-count');
const modalWorksGrid = document.getElementById('modal-works-grid');
const modalMembersList = document.getElementById('modal-members-list');
const modalRecruitingView = document.getElementById('modal-recruiting-view');

// cargar datos iniciales
async function initScansPage() {
  try {
    if (scansGrid) {
      scansGrid.innerHTML = renderScanSkeletons(6);
    }

    // peticiones paralelas al backend
    const [scansData, rolesData, myScanData] = await Promise.allSettled([
      apiRequest('/scan-groups/public'),
      apiRequest('/scan-groups/roles'),
      apiRequest('/scan-groups/my-scan'),
    ]);

    // asignar roles reales obtenidos de la bd
    if (rolesData.status === 'fulfilled' && Array.isArray(rolesData.value)) {
      dbRoles = rolesData.value;
    }

    // asignar scans públicos
    if (scansData.status === 'fulfilled' && Array.isArray(scansData.value)) {
      scansList = scansData.value;
    }

    // actualizar estadísticas globales
    updateGlobalStats(scansList);

    // renderizar sección de mi clan si aplica
    if (myScanData.status === 'fulfilled' && myScanData.value) {
      renderMyClan(myScanData.value);
    } else {
      if (myClanSection) myClanSection.hidden = true;
    }

    // renderizar cuadrícula inicial
    renderScans();
  } catch (err) {
    console.error('Error al inicializar la página de scans:', err);
    if (scansGrid) {
      scansGrid.innerHTML = `
        <div class="scans-empty" style="grid-column: 1 / -1;">
          <h3>No se pudieron cargar los clanes</h3>
          <p>Ocurrió un problema de conexión con el servidor. Por favor, reintenta más tarde.</p>
        </div>
      `;
    }
  }
}

// actualizar contadores
function updateGlobalStats(list) {
  const clansCount = list.length;
  const worksCount = list.reduce((acc, curr) => acc + (Number(curr.works_count) || 0), 0);
  const chaptersCount = list.reduce((acc, curr) => acc + (Number(curr.chapters_count) || 0), 0);

  if (statClansCount) statClansCount.textContent = clansCount.toLocaleString('es-ES');
  if (statWorksCount) statWorksCount.textContent = worksCount.toLocaleString('es-ES');
  if (statChaptersCount) statChaptersCount.textContent = chaptersCount.toLocaleString('es-ES');
}

// renderizar mi clan
function renderMyClan(myScan) {
  if (!myClanSection || !myClanCard) return;

  const logoUrl = myScan.logo_url || '/assets/icons/logo.png';
  const roleCode = (myScan.role_code || 'UPLOADER').toLowerCase();
  const roleName = escapeHtml(myScan.role_name || myScan.role_code || 'Miembro');

  myClanCard.innerHTML = `
    <div class="my-clan-left">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(myScan.name)}" class="my-clan-logo" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
      <div>
        <span class="my-clan-info-tag">Tu Clan / Gremio</span>
        <h2 class="my-clan-name">${escapeHtml(myScan.name)}</h2>
        <span class="my-clan-role-badge role-${roleCode}">
          <img src="/assets/icons/svg/gamification/verified.svg" alt="" width="12" height="12">
          ${roleName}
        </span>
      </div>
    </div>
    <div class="my-clan-actions">
      <button type="button" class="scan-btn-view" data-action="view-modal" data-slug="${escapeHtml(myScan.slug)}">
        <img src="/assets/icons/svg/actions/eye.svg" alt="" width="14" height="14">
        <span>Ver Perfil Público</span>
      </button>
    </div>
  `;

  myClanSection.hidden = false;
}

// filtrar scans
function getFilteredScans() {
  let list = [...scansList];

  // filtro de texto
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((scan) => {
      const name = (scan.name || '').toLowerCase();
      const desc = (scan.description || '').toLowerCase();
      const owner = (scan.owner_username || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || owner.includes(q);
    });
  }

  // filtro por tab
  switch (currentFilter) {
    case 'active':
      // más activos
      list.sort((a, b) => (b.chapters_count || 0) - (a.chapters_count || 0));
      break;
    case 'works':
      // top obras
      list.sort((a, b) => (b.works_count || 0) - (a.works_count || 0));
      break;
    case 'recruiting':
      // scans con discord o reclutamiento abierto
      list = list.filter((scan) => {
        const links = scan.social_links || {};
        return Boolean(links.discord || links.web);
      });
      break;
    case 'all':
    default:
      // mantener orden natural o por obras
      break;
  }

  return list;
}

// renderizar grid scans
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
      const desc = escapeHtml(scan.description || 'Sin descripción disponible.');
      const owner = escapeHtml(scan.owner_username || 'Líder');
      const works = Number(scan.works_count || 0).toLocaleString('es-ES');
      const chapters = Number(scan.chapters_count || 0).toLocaleString('es-ES');
      const members = Number(scan.members_count || 1).toLocaleString('es-ES');
      const discord = scan.social_links?.discord;

      return `
        <article class="scan-card" data-slug="${escapeHtml(scan.slug)}">
          <div class="scan-card-banner-wrap">
            ${banner ? `<img src="${escapeHtml(banner)}" alt="" class="scan-card-banner" loading="lazy">` : ''}
            <div class="scan-card-banner-scrim"></div>
          </div>

          <div class="scan-card-logo-wrap">
            <img src="${escapeHtml(logo)}" alt="${name}" class="scan-card-logo" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
          </div>

          <div class="scan-card-content">
            <div class="scan-card-header-row">
              <div class="scan-card-title-group">
                <h3 class="scan-card-title">${name}</h3>
                <span class="scan-card-badge-verified" title="Clan Verificado">
                  <img src="/assets/icons/svg/gamification/verified.svg" alt="" width="14" height="14">
                </span>
              </div>
            </div>

            <p class="scan-card-desc">${desc}</p>

            <div class="scan-card-owner">
              <span class="scan-card-owner-label">Liderado por:</span>
              <span class="scan-card-owner-name">${owner}</span>
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
              <button type="button" class="scan-btn-view" data-action="view-modal" data-slug="${escapeHtml(scan.slug)}">
                <img src="/assets/icons/svg/actions/eye.svg" alt="" width="14" height="14">
                <span>Ver Obras & Miembros</span>
              </button>

              ${
                discord
                  ? `<a href="${escapeHtml(discord)}" target="_blank" rel="noopener noreferrer" class="scan-btn-discord" title="Discord del Clan" aria-label="Discord de ${name}">
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

// abrir modal scan
async function openClanModal(slug) {
  if (!clanModal) return;

  // limpiar vista previa y mostrar esqueletos
  modalTitle.innerHTML = '<span class="is-loading is-loading--lg"></span>';
  modalDesc.innerHTML = '<span class="is-loading is-loading--block"></span><span class="is-loading is-loading--block is-loading--w60"></span>';
  modalBanner.src = '';
  modalLogo.removeAttribute('src');
  modalLogo.classList.add('yz-skeleton');
  modalSocials.innerHTML = '';
  modalWorksGrid.innerHTML = renderClanWorksSkeletons(6);
  modalMembersList.innerHTML = renderClanMembersSkeletons(4);
  modalRecruitingView.innerHTML = '';
  modalTabWorksCount.innerHTML = '<span class="is-loading is-loading--xs"></span>';
  modalTabMembersCount.innerHTML = '<span class="is-loading is-loading--xs"></span>';

  // activar pestaña inicial de obras
  switchModalTab('works');

  // abrir modal nativo
  if (typeof clanModal.showModal === 'function') {
    clanModal.showModal();
  } else {
    clanModal.setAttribute('open', '');
  }

  try {
    const data = await apiRequest(`/scan-groups/public/${encodeURIComponent(slug)}`);
    if (!data) throw new Error('No se encontró el clan especificado.');

    // cabecera del modal
    modalTitle.textContent = data.name || 'Clan';
    modalDesc.textContent = data.description || 'Sin descripción disponible.';

    if (data.banner_url) {
      modalBanner.src = data.banner_url;
      modalBanner.hidden = false;
    } else {
      modalBanner.src = '';
      modalBanner.hidden = true;
    }

    modalLogo.classList.remove('yz-skeleton');
    modalLogo.src = data.logo_url || '/assets/icons/logo.png';
    modalLogo.alt = data.name || 'Clan';

    // redes sociales en cabecera
    const socials = data.social_links || {};
    let socialsHtml = '';
    if (socials.discord) {
      socialsHtml += `
        <a href="${escapeHtml(socials.discord)}" target="_blank" rel="noopener noreferrer" class="clan-social-btn clan-social-btn--discord">
          <img src="/assets/icons/svg/social/discord.svg" alt="" width="14" height="14">
          <span>Servidor de Discord</span>
        </a>
      `;
    }
    if (socials.web) {
      socialsHtml += `
        <a href="${escapeHtml(socials.web)}" target="_blank" rel="noopener noreferrer" class="clan-social-btn clan-social-btn--web">
          <img src="/assets/icons/svg/navigation/trending.svg" alt="" width="14" height="14">
          <span>Sitio Web</span>
        </a>
      `;
    }
    modalSocials.innerHTML = socialsHtml;

    // pestaña obras
    const works = Array.isArray(data.works) ? data.works : [];
    modalTabWorksCount.textContent = works.length;
    renderModalWorks(works);

    // pestaña miembros
    const members = Array.isArray(data.members) ? data.members : [];
    modalTabMembersCount.textContent = members.length;
    renderModalMembers(members);

    // pestaña reclutamiento
    renderModalRecruiting(data);
  } catch (err) {
    console.error('Error al cargar detalle del clan:', err);
    modalTitle.textContent = 'Error al cargar';
    modalDesc.textContent = 'No se pudo obtener la información completa de este clan.';
    modalLogo.classList.remove('yz-skeleton');
    modalLogo.src = '/assets/icons/logo.png';
    modalWorksGrid.innerHTML = '';
    modalMembersList.innerHTML = '';
    modalTabWorksCount.textContent = '0';
    modalTabMembersCount.textContent = '0';
  }
}

// renderizar obras scan
function renderModalWorks(works) {
  if (!modalWorksGrid) return;

  if (works.length === 0) {
    modalWorksGrid.innerHTML = `
      <div class="scans-empty" style="grid-column: 1 / -1;">
        <p>Este clan aún no tiene obras públicas registradas.</p>
      </div>
    `;
    return;
  }

  modalWorksGrid.innerHTML = works
    .map((w) => {
      const cover = w.cover_url || '/assets/icons/logo.png';
      const title = escapeHtml(w.title || 'Obra');
      const status = escapeHtml(w.status || 'En emisión');
      const format = escapeHtml(w.format || 'Manga');
      const score = Number(w.score || 0).toFixed(1);
      const chapters = Number(w.chapters_count || 0);

      return `
        <a href="/pages/obra.html?slug=${encodeURIComponent(w.slug)}" class="clan-work-card">
          <div class="clan-work-cover-wrap">
            <img src="${escapeHtml(cover)}" alt="${title}" class="clan-work-cover" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
          </div>
          <div class="clan-work-info">
            <h4 class="clan-work-title" title="${title}">${title}</h4>
            <div class="clan-work-meta">
              <span>${status} • ${format}</span>
              <span class="clan-work-score">★ ${score}</span>
            </div>
            <div style="font-size: 0.7rem; color: var(--teal-300, #5eead4); margin-top: 0.3rem;">
              ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}
            </div>
          </div>
        </a>
      `;
    })
    .join('');
}

// renderizar miembros scan
function renderModalMembers(members) {
  if (!modalMembersList) return;

  if (members.length === 0) {
    modalMembersList.innerHTML = `
      <div class="scans-empty" style="grid-column: 1 / -1;">
        <p>No se encontraron miembros activos en este clan.</p>
      </div>
    `;
    return;
  }

  modalMembersList.innerHTML = members
    .map((m) => {
      const avatar = m.avatar_url || '/assets/icons/logo.png';
      const username = escapeHtml(m.username || 'Usuario');
      const code = escapeHtml(m.user_code ? `#${m.user_code}` : '');
      const roleCode = (m.role_code || 'uploader').toLowerCase();
      // obtener rol miembro
      const roleName = escapeHtml(m.role_name || m.role_code || 'Miembro');

      return `
        <div class="clan-member-card">
          <img src="${escapeHtml(avatar)}" alt="${username}" class="clan-member-avatar" loading="lazy" onerror="this.src='/assets/icons/logo.png'">
          <div class="clan-member-details">
            <div class="clan-member-name">${username} <span style="font-size: 0.72rem; color: var(--neutral-400);">${code}</span></div>
            <span class="clan-member-role role-${roleCode}">${roleName}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

// renderizar reclutamiento
function renderModalRecruiting(clan) {
  if (!modalRecruitingView) return;

  const discordUrl = clan.social_links?.discord;
  // filtrar roles disponibles para postulación
  const availableRoles = dbRoles.filter((r) => r.code !== 'LEADER');

  // mapeo informativo por código de rol
  const roleHelp = {
    CO_LEADER: 'Apoyo en la gestión del equipo, coordinación de proyectos y moderación interna.',
    TRANSLATOR: 'Traducción de textos desde el idioma original (Coreano, Chino o Japonés) al español neutro.',
    EDITOR: 'Limpieza de viñetas (Cleaner) y maquetación tipográfica de diálogos y efectos sonoros (Typesetter).',
    UPLOADER: 'Revisión final de calidad, compilación de páginas y publicación de capítulos en la plataforma.',
  };

  modalRecruitingView.innerHTML = `
    <div class="clan-recruiting-banner">
      <h3>¿Quieres formar parte de ${escapeHtml(clan.name)}?</h3>
      <p>
        Los equipos de traducción siempre están abiertos a recibir personas comprometidas con ganas de aprender y ayudar a traer más capítulos en español.
      </p>
    </div>

    <div>
      <h4 style="font-size: 0.95rem; font-weight: 800; color: #ffffff; margin-bottom: 0.75rem;">
        Vacantes y Funciones en el Clan:
      </h4>
      <div class="clan-roles-grid">
        ${availableRoles
          .map((r) => {
            const code = r.code;
            const name = escapeHtml(r.name);
            const desc = escapeHtml(roleHelp[code] || 'Función clave en el proceso de adaptación de la obra.');
            const roleClass = `role-${code.toLowerCase()}`;

            return `
              <div class="clan-role-item">
                <span class="clan-member-role ${roleClass}" style="flex-shrink: 0;">${name}</span>
                <span style="font-size: 0.76rem; color: var(--neutral-300); line-height: 1.4;">${desc}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>

    <div style="margin-top: 1rem; text-align: center;">
      ${
        discordUrl
          ? `
            <a href="${escapeHtml(discordUrl)}" target="_blank" rel="noopener noreferrer" class="my-clan-btn-dash" style="display: inline-flex;">
              <img src="/assets/icons/svg/social/discord.svg" alt="" width="16" height="16">
              <span>Postular vía Discord Oficial</span>
            </a>
          `
          : `
            <div style="padding: 0.85rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--neutral-400);">
              Este clan no ha especificado un enlace de contacto directo en este momento.
            </div>
          `
      }
    </div>
  `;
}

// cambiar de pestaña activa dentro del modal
function switchModalTab(targetTab) {
  modalTabs.forEach((tab) => {
    const isTarget = tab.dataset.tab === targetTab;
    tab.classList.toggle('active', isTarget);
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  const panes = {
    works: document.getElementById('pane-works'),
    members: document.getElementById('pane-members'),
    recruiting: document.getElementById('pane-recruiting'),
  };

  Object.entries(panes).forEach(([tabKey, paneEl]) => {
    if (paneEl) {
      paneEl.classList.toggle('active', tabKey === targetTab);
    }
  });
}

// cerrar modal
function closeClanModal() {
  if (!clanModal) return;
  if (typeof clanModal.close === 'function') {
    clanModal.close();
  } else {
    clanModal.removeAttribute('open');
  }
}

// event listeners

// pestañas de filtrado principal
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

// búsqueda en vivo
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchClear) {
      searchClear.hidden = !searchQuery;
    }
    renderScans();
  });
}

// botón limpiar búsqueda
if (searchClear) {
  searchClear.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    searchQuery = '';
    searchClear.hidden = true;
    renderScans();
  });
}

// click tarjeta scan
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-action="view-modal"]');
  if (trigger) {
    const slug = trigger.dataset.slug;
    if (slug) {
      openClanModal(slug);
    }
    return;
  }

  const card = e.target.closest('.scan-card');
  if (card && !e.target.closest('a') && !e.target.closest('button')) {
    const slug = card.dataset.slug;
    if (slug) {
      openClanModal(slug);
    }
  }
});

// pestañas del modal
modalTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const tabKey = tab.dataset.tab;
    if (tabKey) switchModalTab(tabKey);
  });
});

// cerrar modal con botón
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeClanModal);
}

// cerrar modal al hacer clic en el backdrop
if (clanModal) {
  clanModal.addEventListener('click', (e) => {
    const dialogBox = clanModal.querySelector('.clan-modal-dialog');
    if (dialogBox && !dialogBox.contains(e.target)) {
      closeClanModal();
    }
  });

  // cerrar con escape
  clanModal.addEventListener('cancel', () => {
    closeClanModal();
  });
}

// iniciar aplicación
initScansPage();
