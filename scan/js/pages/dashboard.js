// Controlador Principal del Dashboard General de Scan (100% Datos Reales + Modales Nativos)
import { checkScanAuth, apiRequest, invalidateAuthCache } from '../shared/auth.js';
import { renderSeriesCatalogRow } from '../components/cards.js';
import { renderWorksCatalogSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';
import { formatNumber, esc } from '../shared/ui-utils.js';

let currentScan = null;
let currentUser = null;

async function initDashboard() {
    const recentContainer = document.getElementById('dashboard-recent-works');
    if (recentContainer) {
        recentContainer.innerHTML = renderWorksCatalogSkeletons(3);
    }

    initClanModals();

    const authData = await checkScanAuth();
    if (!authData) return;

    currentUser = authData.currentUser;
    currentScan = authData.currentScan;

    if (!currentScan?.id) {
        renderNoClanState();
        return;
    }

    populateClanHero(currentScan);

    try {
        const [worksRes, membersRes, announcementsRes] = await Promise.allSettled([
            apiRequest(`/scan-groups/${currentScan.id}/works`),
            apiRequest(`/scan-groups/${currentScan.id}/members`),
            apiRequest(`/scan-groups/${currentScan.id}/announcements`)
        ]);

        const works = (worksRes.status === 'fulfilled' && Array.isArray(worksRes.value)) ? worksRes.value : [];
        const members = (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) ? membersRes.value : [];
        const announcements = (announcementsRes.status === 'fulfilled' && Array.isArray(announcementsRes.value)) ? announcementsRes.value : [];

        const worksCount = works.length;
        const totalCaps = works.reduce((acc, w) => acc + (Number(w.chapters_count) || 0), 0);
        const scheduledCaps = works.reduce((acc, w) => acc + (Number(w.scheduled_count) || 0), 0);
        const totalViews = works.reduce((acc, w) => acc + (Number(w.total_views) || 0), 0);
        const views24h = works.reduce((acc, w) => acc + (Number(w.views_last_24h) || 0), 0);
        const totalFavorites = works.reduce((acc, w) => acc + (Number(w.favorites_count) || 0), 0);
        const membersCount = members.length || currentScan.members_count || 1;

        updateKpiValues({
            worksCount,
            totalCaps,
            scheduledCaps,
            totalViews,
            views24h,
            totalFavorites,
            membersCount,
            vaultTokens: Number(currentScan.vault_tokens || 0),
            clanLevel: Number(currentScan.clan_level || 1),
            roleName: currentScan.role || 'MIEMBRO DE SCAN',
            isAdmin: currentScan.is_leader || currentScan.can_manage
        });

        renderClanAnnouncements(announcements);
        renderRecentWorks(works);
    } catch (e) {
        console.error('Error al actualizar métricas del dashboard:', e);
    }
}

function populateClanHero(scan) {
    if (!scan) return;

    const nameEl = document.getElementById('clan-name-text');
    if (nameEl) nameEl.textContent = scan.name || 'Clan de Scan';

    const descEl = document.getElementById('clan-desc-text');
    if (descEl) {
        descEl.textContent = scan.description || 'Grupo de traducción activo en YumeZone.';
    }

    const logoImg = document.getElementById('clan-logo-img');
    if (logoImg && scan.logo_url) logoImg.src = scan.logo_url;

    const bannerBg = document.getElementById('clan-banner-bg');
    if (bannerBg && scan.banner_url) {
        bannerBg.style.backgroundImage = `url('${scan.banner_url}')`;
    }

    const verifiedCode = document.getElementById('clan-verified-code');
    if (verifiedCode) {
        verifiedCode.textContent = scan.slug ? `/${scan.slug}` : 'Verificado';
    }

    const editBtn = document.getElementById('btn-open-edit-clan');
    const annBtn = document.getElementById('btn-open-announcement-modal');
    if (scan.is_leader || scan.can_manage) {
        if (editBtn) editBtn.style.display = 'inline-flex';
        if (annBtn) annBtn.style.display = 'inline-flex';
    }
    const tierName = document.getElementById('clan-tier-name');
    if (tierName) tierName.textContent = `Nivel ${Number(scan.clan_level || 1)}`;

    const discordUrl = scan.social_links?.discord || scan.social_links?.discord_url;
    const discordBadge = document.getElementById('hero-discord-badge');
    const discordLink = document.getElementById('hero-discord-link');
    if (discordBadge && discordLink && discordUrl) {
        discordLink.href = discordUrl;
        discordBadge.style.display = 'inline-flex';
    }
}

function updateKpiValues({ worksCount, totalCaps, scheduledCaps, totalViews, views24h, totalFavorites, membersCount, vaultTokens = 0, clanLevel = 1, roleName, isAdmin }) {
    const kpiWorks = document.getElementById('kpi-works-count');
    if (kpiWorks) kpiWorks.textContent = formatNumber(worksCount);

    const kpiChapters = document.getElementById('kpi-chapters-count');
    if (kpiChapters) kpiChapters.textContent = formatNumber(totalCaps);

    const kpiScheduledTag = document.getElementById('kpi-scheduled-tag');
    if (kpiScheduledTag) {
        kpiScheduledTag.textContent = scheduledCaps > 0 ? `${scheduledCaps} Próximamente` : 'Al Día';
    }

    const kpiViews = document.getElementById('kpi-views-count');
    if (kpiViews) kpiViews.textContent = formatNumber(totalViews);

    const heroViews = document.getElementById('hero-views-count');
    if (heroViews) heroViews.textContent = formatNumber(totalViews);

    const kpiViews24h = document.getElementById('kpi-views-24h');
    if (kpiViews24h) kpiViews24h.textContent = `+${formatNumber(views24h)} (24h)`;

    const kpiFavFoot = document.getElementById('kpi-favorites-foot');
    if (kpiFavFoot) kpiFavFoot.textContent = `${formatNumber(totalFavorites)} lectores guardaron tus obras →`;

    const heroMembers = document.getElementById('hero-members-count');
    if (heroMembers) heroMembers.textContent = String(membersCount);

    const kpiVault = document.getElementById('kpi-vault-tokens');
    if (kpiVault) kpiVault.textContent = `${formatNumber(vaultTokens)} Cristales`;

    const kpiLevelBadge = document.getElementById('kpi-clan-level-badge');
    if (kpiLevelBadge) kpiLevelBadge.textContent = `Nv. ${clanLevel}`;

    const kpiRolePermission = document.getElementById('kpi-role-permission');
    if (kpiRolePermission) {
        kpiRolePermission.textContent = `${roleName} • ${membersCount} miembro(s) →`;
    }
}

function renderClanAnnouncements(announcements) {
    const container = document.getElementById('dashboard-clan-announcements');
    if (!container) return;

    if (!announcements || announcements.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 1.25rem; color: #8c90a0; font-size: 0.85rem;">
                Tu clan no tiene avisos activos publicados actualmente.
            </div>
        `;
        return;
    }

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    container.innerHTML = announcements.map(a => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1rem; border-radius: 0.75rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 0.6rem;">
            <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <span class="badge-tag-teal">${esc(a.type_label || 'Scans')}</span>
                    <strong style="color: #eef1fa; font-size: 0.92rem;">${esc(a.title)}</strong>
                </div>
                <p style="margin: 0; font-size: 0.82rem; color: #9ea4b8;">${esc(a.description || '')}</p>
            </div>
            ${canManage ? `
                <button type="button" class="btn-hero-dark btn-delete-announcement" data-id="${a.id}" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: #ffb4ab;">
                    Eliminar
                </button>
            ` : ''}
        </div>
    `).join('');

    container.querySelectorAll('.btn-delete-announcement').forEach(btn => {
        btn.addEventListener('click', async () => {
            const annId = btn.getAttribute('data-id');
            if (!annId || !currentScan?.id) return;
            btn.disabled = true;
            try {
                await apiRequest(`/scan-groups/${currentScan.id}/announcements/${annId}`, { method: 'DELETE' });
                showToast('Aviso eliminado.', 'info');
                const updated = await apiRequest(`/scan-groups/${currentScan.id}/announcements`);
                renderClanAnnouncements(updated);
            } catch (err) {
                showToast(err.detail || 'No se pudo eliminar el aviso.', 'error');
                btn.disabled = false;
            }
        });
    });
}

function renderRecentWorks(works) {
    const container = document.getElementById('dashboard-recent-works');
    if (!container) return;

    if (!works || works.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2rem 1rem;">
                <div class="empty-state-icon">
                    <img src="../assets/icons/svg/book.svg" class="icon-svg icon-lg" alt="">
                </div>
                <h3 class="empty-state-title">Aún no hay obras registradas en tu clan</h3>
                <p class="empty-state-desc">Registra tu primera serie desde el Catálogo de Obras para publicar o programar capítulos.</p>
                <a href="obras-canvas.html" class="btn-hero-primary">+ Ir al Catálogo de Obras</a>
            </div>
        `;
        return;
    }

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    container.innerHTML = works.slice(0, 5).map((w, idx) => renderSeriesCatalogRow(w, idx + 1, false)).join('');

    // En el resumen del dashboard redirigimos acciones de edición/capítulos a obras-canvas.html
    container.querySelectorAll('.btn-manage-chapters, .btn-edit-work').forEach(btn => {
        btn.addEventListener('click', () => {
            const workId = btn.getAttribute('data-workid');
            window.location.href = `obras-canvas.html?work=${workId}`;
        });
    });
}

function renderNoClanState() {
    const heroSection = document.getElementById('clan-header-section');
    if (heroSection) {
        heroSection.innerHTML = `
            <div class="empty-state" style="margin: 0; background: transparent; border: none;">
                <div class="empty-state-icon">
                    <img src="../assets/icons/svg/community.svg" class="icon-svg icon-xl" alt="">
                </div>
                <h2 class="empty-state-title">Aún no tienes un Clan de Scan asociado</h2>
                <p class="empty-state-desc">Puedes fundar tu propio Clan de Scan oficial ahora mismo o pedir al líder de un grupo existente que te incorpore con tu @usuario.</p>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
                    <button type="button" class="btn-hero-primary" id="btn-open-create-clan">+ Fundar Nuevo Clan de Scan</button>
                </div>
            </div>
        `;
        const createBtn = document.getElementById('btn-open-create-clan');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const modal = document.getElementById('create-clan-modal');
                if (modal) {
                    modal.classList.add('open');
                    modal.setAttribute('aria-hidden', 'false');
                }
            });
        }
    }

    ['kpi-works-count', 'kpi-chapters-count', 'kpi-views-count'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    const kpiRole = document.getElementById('kpi-role-title');
    if (kpiRole) kpiRole.textContent = 'Sin Clan';
    const recentContainer = document.getElementById('dashboard-recent-works');
    if (recentContainer) {
        recentContainer.innerHTML = `<div class="empty-state"><p class="empty-state-desc">Crea o únete a un clan para visualizar tus obras.</p></div>`;
    }
}

function initClanModals() {
    // Modal Editar Clan
    const editModal = document.getElementById('edit-clan-modal');
    const btnOpenEdit = document.getElementById('btn-open-edit-clan');
    const btnCloseEdit = document.getElementById('btn-close-edit-clan');
    const btnCancelEdit = document.getElementById('btn-cancel-edit-clan');
    const editForm = document.getElementById('edit-clan-form');

    const closeEdit = () => {
        if (editModal) {
            editModal.classList.remove('open');
            editModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnOpenEdit) {
        btnOpenEdit.addEventListener('click', () => {
            if (!currentScan) return;
            document.getElementById('clan-form-name').value = currentScan.name || '';
            document.getElementById('clan-form-desc').value = currentScan.description || '';
            document.getElementById('clan-form-logo').value = currentScan.logo_url && !currentScan.logo_url.includes('../assets') ? currentScan.logo_url : '';
            document.getElementById('clan-form-banner').value = currentScan.banner_url || '';
            document.getElementById('clan-form-discord').value = currentScan.social_links?.discord || '';
            document.getElementById('clan-form-website').value = currentScan.social_links?.website || '';
            if (editModal) {
                editModal.classList.add('open');
                editModal.setAttribute('aria-hidden', 'false');
            }
        });
    }

    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEdit);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEdit();
        });
    }

    // Subida de archivos para Logo y Banner del Clan (/uploads/images)
    bindSingleImageUpload('btn-upload-clan-logo', 'clan-logo-file', 'clan-form-logo');
    bindSingleImageUpload('btn-upload-clan-banner', 'clan-banner-file', 'clan-form-banner');

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentScan?.id) return;

            const saveBtn = document.getElementById('btn-save-clan-submit');
            const name = document.getElementById('clan-form-name')?.value.trim();
            const description = document.getElementById('clan-form-desc')?.value.trim();
            const logo_url = document.getElementById('clan-form-logo')?.value.trim() || null;
            const banner_url = document.getElementById('clan-form-banner')?.value.trim() || null;
            const discord = document.getElementById('clan-form-discord')?.value.trim();
            const website = document.getElementById('clan-form-website')?.value.trim();

            if (!name) {
                showToast('El nombre del clan es obligatorio.', 'warning');
                return;
            }

            if (saveBtn) saveBtn.disabled = true;
            try {
                const social_links = { ...(currentScan.social_links || {}) };
                if (discord) social_links.discord = discord;
                else delete social_links.discord;
                if (website) social_links.website = website;
                else delete social_links.website;

                await apiRequest(`/scan-groups/${currentScan.id}`, {
                    method: 'PUT',
                    body: {
                        name,
                        description: description || null,
                        logo_url,
                        banner_url,
                        social_links
                    }
                });

                invalidateAuthCache();
                const refreshed = await checkScanAuth(true);
                if (refreshed?.currentScan) {
                    currentScan = refreshed.currentScan;
                    populateClanHero(currentScan);
                }
                closeEdit();
                showToast('Perfil del clan actualizado correctamente.', 'success');
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo actualizar el clan.', 'error');
            } finally {
                if (saveBtn) saveBtn.disabled = false;
            }
        });
    }

    // Modal Crear Clan (POST /scan-groups/)
    const createModal = document.getElementById('create-clan-modal');
    const btnCloseCreate = document.getElementById('btn-close-create-clan');
    const btnCancelCreate = document.getElementById('btn-cancel-create-clan');
    const createForm = document.getElementById('create-clan-form');

    const closeCreate = () => {
        if (createModal) {
            createModal.classList.remove('open');
            createModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreate);
    if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreate);
    if (createModal) {
        createModal.addEventListener('click', (e) => {
            if (e.target === createModal) closeCreate();
        });
    }

    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-create-clan');
            const name = document.getElementById('new-clan-name')?.value.trim();
            const description = document.getElementById('new-clan-desc')?.value.trim() || null;
            const logo_url = document.getElementById('new-clan-logo')?.value.trim() || null;
            const banner_url = document.getElementById('new-clan-banner')?.value.trim() || null;

            if (!name) return;
            if (submitBtn) submitBtn.disabled = true;

            try {
                await apiRequest('/scan-groups/', {
                    method: 'POST',
                    body: { name, description, logo_url, banner_url }
                });
                invalidateAuthCache();
                showToast(`¡Clan "${name}" creado con éxito!`, 'success');
                closeCreate();
                window.location.reload();
            } catch (err) {
                showToast(err.detail || err.message || 'Error al crear el clan.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Modal Publicar Aviso del Clan (POST /scan-groups/{id}/announcements)
    const annModal = document.getElementById('create-announcement-modal');
    const btnOpenAnn = document.getElementById('btn-open-announcement-modal');
    const btnCloseAnn = document.getElementById('btn-close-announcement-modal');
    const btnCancelAnn = document.getElementById('btn-cancel-announcement-modal');
    const annForm = document.getElementById('create-announcement-form');

    const closeAnn = () => {
        if (annModal) {
            annModal.classList.remove('open');
            annModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnOpenAnn) {
        btnOpenAnn.addEventListener('click', () => {
            if (annForm) annForm.reset();
            if (annModal) {
                annModal.classList.add('open');
                annModal.setAttribute('aria-hidden', 'false');
            }
        });
    }
    if (btnCloseAnn) btnCloseAnn.addEventListener('click', closeAnn);
    if (btnCancelAnn) btnCancelAnn.addEventListener('click', closeAnn);
    if (annModal) {
        annModal.addEventListener('click', (e) => {
            if (e.target === annModal) closeAnn();
        });
    }

    if (annForm) {
        annForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentScan?.id) return;
            const submitBtn = document.getElementById('btn-submit-announcement');
            const title = document.getElementById('ann-form-title')?.value.trim();
            const description = document.getElementById('ann-form-desc')?.value.trim();
            const type_label = document.getElementById('ann-form-label')?.value || 'Scans';
            const use_vault = Boolean(document.getElementById('ann-form-use-vault')?.checked);

            if (!title || !description) return;
            if (submitBtn) submitBtn.disabled = true;
            try {
                await apiRequest(`/scan-groups/${currentScan.id}/announcements`, {
                    method: 'POST',
                    body: { title, description, type_label, use_vault }
                });
                closeAnn();
                showToast('Aviso del clan publicado correctamente.', 'success');
                invalidateAuthCache();
                const refreshed = await checkScanAuth(true);
                if (refreshed?.currentScan) {
                    currentScan = refreshed.currentScan;
                    const kpiVault = document.getElementById('kpi-vault-tokens');
                    if (kpiVault) kpiVault.textContent = `${formatNumber(currentScan.vault_tokens || 0)} Cristales`;
                }
                const updated = await apiRequest(`/scan-groups/${currentScan.id}/announcements`);
                renderClanAnnouncements(updated);
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo publicar el aviso.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
}

function bindSingleImageUpload(btnId, fileInputId, targetInputId) {
    const btn = document.getElementById(btnId);
    const fileInput = document.getElementById(fileInputId);
    const targetInput = document.getElementById(targetInputId);
    if (!btn || !fileInput || !targetInput) return;

    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        btn.disabled = true;
        try {
            const fd = new FormData();
            fd.append('files', file);
            const res = await apiRequest('/uploads/images', { method: 'POST', body: fd });
            if (res?.urls?.[0]) {
                targetInput.value = res.urls[0];
                showToast('Imagen subida correctamente.', 'success');
            }
        } catch (err) {
            showToast(err.detail || err.message || 'Error al subir la imagen.', 'error');
        } finally {
            btn.disabled = false;
            fileInput.value = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', initDashboard);
