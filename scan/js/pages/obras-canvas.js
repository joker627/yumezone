// Controlador de Página: Catálogo de Obras, Portadas & Flujo de Capítulos (Cero SVG inline, Cero confirm())
import { checkScanAuth, apiRequest } from '../shared/auth.js';
import { renderSeriesCatalogRow } from '../components/cards.js';
import { renderWorksCatalogSkeletons, renderChaptersListSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';
import { esc } from '../shared/ui-utils.js';

let currentScan = null;
let currentUser = null;
let cachedWorks = [];
let pendingDeleteAction = null;

async function initObrasCanvasPage() {
    const rowsContainer = document.getElementById('series-catalog-rows');
    if (rowsContainer) {
        rowsContainer.innerHTML = renderWorksCatalogSkeletons(4);
    }

    initCatalogControls();
    initModals();

    const authData = await checkScanAuth();
    if (!authData) return;

    currentUser = authData.currentUser;
    currentScan = authData.currentScan;

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    const btnOpenCreate = document.getElementById('btn-open-create-work');
    if (btnOpenCreate && !canManage) {
        btnOpenCreate.style.display = 'none';
    }

    if (!currentScan?.id) {
        if (rowsContainer) {
            rowsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <img src="../assets/icons/svg/community.svg" class="icon-svg icon-lg" alt="">
                    </div>
                    <h3 class="empty-state-title">No perteneces a un Clan de Scan activo</h3>
                    <p class="empty-state-desc">Para registrar obras y administrar capítulos debes fundar un clan desde el Dashboard o ser incorporado por un líder.</p>
                    <a href="dashboard.html" class="btn-hero-primary">Ir al Dashboard</a>
                </div>
            `;
        }
        return;
    }

    await Promise.allSettled([
        loadGroupWorks(),
        loadWorkFilters()
    ]);

    // Si viene ?work=ID desde el Dashboard, abrir sus capítulos automáticamente
    const preWorkId = new URLSearchParams(window.location.search).get('work');
    if (preWorkId) {
        const target = cachedWorks.find(w => String(w.id) === String(preWorkId));
        if (target) openChaptersModal(target.id, target.title);
    }
}

async function loadGroupWorks() {
    const rowsContainer = document.getElementById('series-catalog-rows');
    const countAll = document.getElementById('count-filter-all');
    const countUpcoming = document.getElementById('count-filter-upcoming');

    try {
        const works = await apiRequest(`/scan-groups/${currentScan.id}/works`);
        cachedWorks = Array.isArray(works) ? works : [];

        if (countAll) countAll.textContent = String(cachedWorks.length);
        if (countUpcoming) {
            const upcomingTotal = cachedWorks.filter(w =>
                (Number(w.scheduled_count) || 0) > 0 ||
                (w.status_name || w.status || '').toLowerCase().includes('próximamente')
            ).length;
            countUpcoming.textContent = String(upcomingTotal);
        }

        if (!rowsContainer) return;

        if (cachedWorks.length === 0) {
            const canManage = Boolean(currentScan.is_leader || currentScan.can_manage);
            rowsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <img src="../assets/icons/svg/book.svg" class="icon-svg icon-lg" alt="">
                    </div>
                    <h3 class="empty-state-title">No hay obras registradas en este clan</h3>
                    <p class="empty-state-desc">El Líder o Colíder del Clan debe registrar la primera serie para empezar a publicar o programar capítulos.</p>
                    ${canManage ? `<button type="button" class="btn-hero-primary" id="btn-empty-create-work">+ Registrar Primera Obra</button>` : ''}
                </div>
            `;
            const emptyBtn = document.getElementById('btn-empty-create-work');
            if (emptyBtn) emptyBtn.addEventListener('click', () => openWorkModal());
            return;
        }

        const canManage = Boolean(currentScan.is_leader || currentScan.can_manage);
        rowsContainer.innerHTML = cachedWorks.map((w, idx) => renderSeriesCatalogRow(w, idx + 1, canManage)).join('');
        bindCatalogRowEvents(rowsContainer);
    } catch (err) {
        console.error('Error al cargar obras del clan:', err);
        if (rowsContainer) {
            rowsContainer.innerHTML = `
                <div class="empty-state">
                    <h3 class="empty-state-title">Error al cargar obras</h3>
                    <p class="empty-state-desc">${esc(err.message || 'No se pudo conectar con el servidor')}</p>
                    <button type="button" class="btn-hero-dark" id="btn-retry-works">Reintentar</button>
                </div>
            `;
            document.getElementById('btn-retry-works')?.addEventListener('click', loadGroupWorks);
        }
    }
}

async function loadWorkFilters() {
    try {
        const filters = await apiRequest('/works/filters');
        if (!filters) return;

        const formatSelect = document.getElementById('work-form-format');
        const statusSelect = document.getElementById('work-form-status');
        const demoSelect = document.getElementById('work-form-demographic');
        const genresContainer = document.getElementById('work-form-genres-container');

        if (formatSelect && Array.isArray(filters.formats) && filters.formats.length > 0) {
            formatSelect.innerHTML = filters.formats.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
        }
        if (statusSelect && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
            statusSelect.innerHTML = filters.statuses.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
        }
        if (demoSelect && Array.isArray(filters.demographics) && filters.demographics.length > 0) {
            demoSelect.innerHTML = filters.demographics.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
        }
        if (genresContainer && Array.isArray(filters.genres) && filters.genres.length > 0) {
            genresContainer.innerHTML = filters.genres.map(g => `
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.55rem; border-radius: 999px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 0.74rem; color: #dde2f2; cursor: pointer;">
                    <input type="checkbox" class="work-genre-checkbox" value="${g.id}">
                    <span>${esc(g.name)}</span>
                </label>
            `).join('');
        }
    } catch (e) {
        console.debug('Filtros por defecto:', e);
    }
}

function initCatalogControls() {
    const filterTabs = document.querySelectorAll('.filter-pill-btn');
    const searchInput = document.getElementById('catalog-filter-input');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.getAttribute('data-filter') || 'all';
            applyFilter(filter, searchInput ? searchInput.value : '');
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeTab = document.querySelector('.filter-pill-btn.active');
            const filter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            applyFilter(filter, e.target.value);
        });
    }
}

function applyFilter(typeFilter, searchText) {
    const rows = document.querySelectorAll('.series-catalog-row');
    const query = (searchText || '').toLowerCase().trim();

    rows.forEach(row => {
        const format = (row.getAttribute('data-format') || '').toLowerCase();
        const status = (row.getAttribute('data-status') || '').toLowerCase();
        const text = (row.textContent || '').toLowerCase();
        const matchesType =
            typeFilter === 'all' ||
            (typeFilter === 'proximamente' ? status === 'proximamente' : format.includes(typeFilter));
        const matchesSearch = !query || text.includes(query);
        row.style.display = (matchesType && matchesSearch) ? 'flex' : 'none';
    });
}

function bindCatalogRowEvents(container) {
    container.querySelectorAll('.btn-manage-chapters').forEach(btn => {
        btn.addEventListener('click', () => {
            const workId = btn.getAttribute('data-workid');
            const workTitle = btn.getAttribute('data-worktitle');
            openChaptersModal(workId, workTitle);
        });
    });

    container.querySelectorAll('.btn-edit-work').forEach(btn => {
        btn.addEventListener('click', () => {
            const workId = Number(btn.getAttribute('data-workid'));
            const work = cachedWorks.find(w => Number(w.id) === workId);
            if (work) openWorkModal(work);
        });
    });

    container.querySelectorAll('.btn-delete-work').forEach(btn => {
        btn.addEventListener('click', () => {
            const workId = Number(btn.getAttribute('data-workid'));
            const workTitle = btn.getAttribute('data-worktitle') || 'esta obra';
            openConfirmDeleteModal({
                title: 'Eliminar Obra del Catálogo',
                message: `¿Confirmas que deseas eliminar permanentemente la obra "${workTitle}" y todos sus capítulos asociados?`,
                onConfirm: async () => {
                    await apiRequest(`/works/${workId}`, { method: 'DELETE' });
                    showToast(`Obra "${workTitle}" eliminada correctamente.`, 'info');
                    await loadGroupWorks();
                }
            });
        });
    });
}

function initModals() {
    const btnOpenCreate = document.getElementById('btn-open-create-work');
    const workModal = document.getElementById('work-modal');
    const btnCloseWork = document.getElementById('btn-close-work-modal');
    const btnCancelWork = document.getElementById('btn-cancel-work-modal');
    const workForm = document.getElementById('work-form');

    if (btnOpenCreate) btnOpenCreate.addEventListener('click', () => openWorkModal());
    if (btnCloseWork) btnCloseWork.addEventListener('click', closeWorkModal);
    if (btnCancelWork) btnCancelWork.addEventListener('click', closeWorkModal);
    if (workModal) {
        workModal.addEventListener('click', (e) => {
            if (e.target === workModal) closeWorkModal();
        });
    }
    if (workForm) workForm.addEventListener('submit', handleSaveWork);

    // Subida directa de Portada y Banner a /uploads/images con previsualización en vivo
    bindUploadButton('btn-upload-work-cover', 'work-cover-file', 'work-form-cover', 'work-cover-preview-wrap', 'work-cover-preview-img');
    bindUploadButton('btn-upload-work-banner', 'work-banner-file', 'work-form-banner', 'work-banner-preview-wrap', 'work-banner-preview-img');

    // Modal Capítulos
    const chaptersModal = document.getElementById('chapters-modal');
    const btnCloseChapters = document.getElementById('btn-close-chapters-modal');
    const btnCloseChaptersFoot = document.getElementById('btn-close-chapters-modal-foot');

    if (btnCloseChapters) btnCloseChapters.addEventListener('click', closeChaptersModal);
    if (btnCloseChaptersFoot) btnCloseChaptersFoot.addEventListener('click', closeChaptersModal);
    if (chaptersModal) {
        chaptersModal.addEventListener('click', (e) => {
            if (e.target === chaptersModal) closeChaptersModal();
        });
    }

    // Modal Confirmación Eliminar
    const confirmModal = document.getElementById('confirm-delete-modal');
    const btnCloseConfirm = document.getElementById('btn-close-confirm-delete');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm-delete');
    const btnExecuteConfirm = document.getElementById('btn-execute-confirm-delete');

    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirmDeleteModal);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirmDeleteModal);
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirmDeleteModal();
        });
    }
    if (btnExecuteConfirm) {
        btnExecuteConfirm.addEventListener('click', async () => {
            if (!pendingDeleteAction) return;
            btnExecuteConfirm.disabled = true;
            try {
                await pendingDeleteAction();
                closeConfirmDeleteModal();
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo completar la eliminación.', 'error');
            } finally {
                btnExecuteConfirm.disabled = false;
            }
        });
    }
}

function updateImagePreview(url, wrapId, imgId) {
    const wrap = document.getElementById(wrapId);
    const img = document.getElementById(imgId);
    if (!wrap || !img) return;
    const clean = (url || '').trim();
    if (clean) {
        img.src = clean;
        wrap.style.display = 'flex';
    } else {
        img.src = '';
        wrap.style.display = 'none';
    }
}

function bindUploadButton(btnId, fileInputId, targetInputId, previewWrapId, previewImgId) {
    const btn = document.getElementById(btnId);
    const fileInput = document.getElementById(fileInputId);
    const targetInput = document.getElementById(targetInputId);
    if (!btn || !fileInput || !targetInput) return;

    targetInput.addEventListener('input', () => {
        if (previewWrapId && previewImgId) {
            updateImagePreview(targetInput.value, previewWrapId, previewImgId);
        }
    });

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
                if (previewWrapId && previewImgId) {
                    updateImagePreview(res.urls[0], previewWrapId, previewImgId);
                }
                showToast('Imagen subida con éxito.', 'success');
            }
        } catch (err) {
            showToast(err.detail || err.message || 'Error al subir la imagen.', 'error');
        } finally {
            btn.disabled = false;
            fileInput.value = '';
        }
    });
}

function openConfirmDeleteModal({ title, message, onConfirm }) {
    const modal = document.getElementById('confirm-delete-modal');
    const titleEl = document.getElementById('confirm-delete-title');
    const msgEl = document.getElementById('confirm-delete-message');
    pendingDeleteAction = onConfirm;
    if (titleEl) titleEl.textContent = title || 'Confirmar Eliminación';
    if (msgEl) msgEl.textContent = message || '¿Confirmas esta acción?';
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirm-delete-modal');
    pendingDeleteAction = null;
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function openWorkModal(work = null) {
    const modal = document.getElementById('work-modal');
    const titleEl = document.getElementById('work-modal-title');
    const formId = document.getElementById('work-form-id');
    const formTitle = document.getElementById('work-form-title');
    const formAlt = document.getElementById('work-form-alt-title');
    const formAuthor = document.getElementById('work-form-author');
    const formFormat = document.getElementById('work-form-format');
    const formStatus = document.getElementById('work-form-status');
    const formDemo = document.getElementById('work-form-demographic');
    const formSynopsis = document.getElementById('work-form-synopsis');
    const formCover = document.getElementById('work-form-cover');
    const formBanner = document.getElementById('work-form-banner');

    if (work) {
        if (titleEl) titleEl.textContent = `Editar Obra: ${work.title}`;
        if (formId) formId.value = String(work.id);
        if (formTitle) formTitle.value = work.title || '';
        if (formAlt) formAlt.value = work.alternative_title || '';
        if (formAuthor) formAuthor.value = work.author || '';
        if (formFormat && work.format_id) formFormat.value = String(work.format_id);
        if (formStatus && work.status_id) formStatus.value = String(work.status_id);
        if (formDemo && work.demographic_id) formDemo.value = String(work.demographic_id);
        if (formSynopsis) formSynopsis.value = work.synopsis || '';
        if (formCover) formCover.value = work.cover_url || '';
        if (formBanner) formBanner.value = work.banner_url || '';
        updateImagePreview(work.cover_url || '', 'work-cover-preview-wrap', 'work-cover-preview-img');
        updateImagePreview(work.banner_url || '', 'work-banner-preview-wrap', 'work-banner-preview-img');
        const activeGenreIds = Array.isArray(work.genre_ids) ? work.genre_ids.map(Number) : [];
        document.querySelectorAll('.work-genre-checkbox').forEach(cb => {
            cb.checked = activeGenreIds.includes(Number(cb.value));
        });
    } else {
        if (titleEl) titleEl.textContent = 'Registrar Nueva Obra para el Clan';
        if (formId) formId.value = '';
        if (formTitle) formTitle.value = '';
        if (formAlt) formAlt.value = '';
        if (formAuthor) formAuthor.value = '';
        if (formSynopsis) formSynopsis.value = '';
        if (formCover) formCover.value = '';
        if (formBanner) formBanner.value = '';
        updateImagePreview('', 'work-cover-preview-wrap', 'work-cover-preview-img');
        updateImagePreview('', 'work-banner-preview-wrap', 'work-banner-preview-img');
        document.querySelectorAll('.work-genre-checkbox').forEach(cb => {
            cb.checked = false;
        });
    }

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeWorkModal() {
    const modal = document.getElementById('work-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function handleSaveWork(e) {
    e.preventDefault();

    const formId = document.getElementById('work-form-id')?.value;
    const title = document.getElementById('work-form-title')?.value.trim();
    const altTitle = document.getElementById('work-form-alt-title')?.value.trim();
    const author = document.getElementById('work-form-author')?.value.trim();
    const formatId = Number(document.getElementById('work-form-format')?.value || 2);
    const statusId = Number(document.getElementById('work-form-status')?.value || 1);
    const demographicId = Number(document.getElementById('work-form-demographic')?.value || 1);
    const synopsis = document.getElementById('work-form-synopsis')?.value.trim();
    const coverUrl = document.getElementById('work-form-cover')?.value.trim();
    const bannerUrl = document.getElementById('work-form-banner')?.value.trim();
    const saveBtn = document.getElementById('btn-save-work-submit');

    if (!title) {
        showToast('El título de la obra es obligatorio.', 'warning');
        return;
    }

    const genreIds = Array.from(document.querySelectorAll('.work-genre-checkbox:checked'))
        .map(cb => Number(cb.value))
        .filter(Boolean);

    const payload = {
        title,
        alternative_title: altTitle || null,
        author: author || null,
        format_id: formatId,
        status_id: statusId,
        demographic_id: demographicId,
        synopsis: synopsis || null,
        cover_url: coverUrl || null,
        banner_url: bannerUrl || null,
        scan_group_id: currentScan.id,
        genre_ids: genreIds
    };

    if (saveBtn) saveBtn.disabled = true;

    try {
        if (formId) {
            await apiRequest(`/works/${formId}`, { method: 'PUT', body: payload });
            showToast(`¡Obra "${title}" actualizada con éxito!`, 'success');
        } else {
            await apiRequest('/works/', { method: 'POST', body: payload });
            showToast(`¡Obra "${title}" registrada exitosamente en el Clan!`, 'success');
        }

        closeWorkModal();
        await loadGroupWorks();
    } catch (err) {
        showToast(err.detail || err.message || 'Error al guardar la obra.', 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function openChaptersModal(workId, workTitle) {
    const modal = document.getElementById('chapters-modal');
    const titleEl = document.getElementById('chapters-modal-title');
    const badgeEl = document.getElementById('chapters-count-badge');
    const listContainer = document.getElementById('chapters-list-container');
    const addBtn = document.getElementById('btn-modal-add-chapter');

    if (titleEl) titleEl.textContent = `Capítulos: ${workTitle}`;
    if (addBtn) addBtn.href = `subir-capitulos.html?work=${workId}`;
    if (listContainer) listContainer.innerHTML = renderChaptersListSkeletons(4);

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    try {
        const chapters = await apiRequest(`/chapters/work/${workId}?published_only=false&order=desc`);
        const chapsList = Array.isArray(chapters) ? chapters : [];

        if (badgeEl) badgeEl.textContent = `${chapsList.length} capítulo(s) registrados`;

        if (chapsList.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="empty-state" style="padding: 2rem 1rem;">
                        <h4 class="empty-state-title" style="font-size: 0.95rem;">Aún no hay capítulos registrados</h4>
                        <p class="empty-state-desc" style="font-size: 0.775rem;">Puedes programar un capítulo en estado "Próximamente (En Traducción)" o subir el primer capítulo con sus páginas WebP.</p>
                        <a href="subir-capitulos.html?work=${workId}" class="btn-action-primary-sm">+ Subir o Programar Capítulo 1</a>
                    </div>
                `;
            }
            return;
        }

        if (listContainer) {
            const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
            const canUpload = Boolean(canManage || currentScan?.can_upload);
            if (addBtn) {
                addBtn.style.display = canUpload ? 'inline-flex' : 'none';
            }

            listContainer.innerHTML = chapsList.map(c => {
                const statusUpper = (c.status || 'PUBLISHED').toUpperCase();
                return `
                    <div class="chapter-item-row" data-chapterid="${c.id}">
                        <div class="chapter-item-info">
                            <span class="chapter-number-tag">Cap. ${esc(c.chapter_number)}</span>
                            <div>
                                <p class="chapter-item-title">${esc(c.title || 'Sin título adicional')}</p>
                                <span style="font-size: 0.68rem; color: #86948e;">Recompensa: +${c.reward_coins ?? 20} YumeCoins</span>
                            </div>
                        </div>
                        <div class="chapter-item-actions">
                            ${canUpload ? `
                                <select class="modal-input select-chapter-status-inline" data-chapterid="${c.id}" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem;">
                                    <option value="PUBLISHED" ${statusUpper === 'PUBLISHED' ? 'selected' : ''}>Publicado (Al Día)</option>
                                    <option value="SCHEDULED" ${statusUpper === 'SCHEDULED' ? 'selected' : ''}>Próximamente (En Traducción)</option>
                                    <option value="DRAFT" ${statusUpper === 'DRAFT' ? 'selected' : ''}>Borrador Interno</option>
                                    <option value="HIDDEN" ${statusUpper === 'HIDDEN' ? 'selected' : ''}>Oculto</option>
                                </select>
                                <a href="subir-capitulos.html?work=${workId}&chapter=${c.chapter_number}&chapter_id=${c.id}" class="btn-action-icon-sm" title="Subir o Reemplazar Páginas WebP">
                                    <img src="../assets/icons/svg/arrow-up.svg" class="icon-svg icon-xs" alt="Subir">
                                </a>
                            ` : `
                                <span class="badge-tag-gold">${esc(statusUpper)}</span>
                                <a href="donaciones-monedas.html" class="btn-action-primary-sm" style="padding:0.25rem 0.6rem;font-size:0.72rem;">Enviar Borrador</a>
                            `}
                            ${canManage ? `
                                <button type="button" class="btn-action-icon-sm btn-delete-chapter" data-chapterid="${c.id}" data-chapternum="${esc(c.chapter_number)}" title="Eliminar Capítulo">
                                    <img src="../assets/icons/svg/x.svg" class="icon-svg icon-xs" alt="Eliminar">
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Cambiar estado del capítulo (PUT /chapters/{id})
            listContainer.querySelectorAll('.select-chapter-status-inline').forEach(sel => {
                sel.addEventListener('change', async () => {
                    const chapId = sel.getAttribute('data-chapterid');
                    const newStatus = sel.value;
                    sel.disabled = true;
                    try {
                        await apiRequest(`/chapters/${chapId}`, {
                            method: 'PUT',
                            body: { status: newStatus }
                        });
                        showToast(`Estado del capítulo actualizado a ${newStatus}.`, 'success');
                        await loadGroupWorks();
                    } catch (err) {
                        showToast(err.detail || err.message || 'Error al cambiar estado del capítulo.', 'error');
                    } finally {
                        sel.disabled = false;
                    }
                });
            });

            // Eliminar capítulo con modal nativo (DELETE /chapters/{id})
            listContainer.querySelectorAll('.btn-delete-chapter').forEach(btn => {
                btn.addEventListener('click', () => {
                    const chapId = btn.getAttribute('data-chapterid');
                    const chapNum = btn.getAttribute('data-chapternum');
                    openConfirmDeleteModal({
                        title: `Eliminar Capítulo #${chapNum}`,
                        message: `¿Confirmas que deseas eliminar el Capítulo #${chapNum} de "${workTitle}" y todas sus páginas?`,
                        onConfirm: async () => {
                            await apiRequest(`/chapters/${chapId}`, { method: 'DELETE' });
                            showToast(`Capítulo #${chapNum} eliminado.`, 'info');
                            await openChaptersModal(workId, workTitle);
                            await loadGroupWorks();
                        }
                    });
                });
            });
        }
    } catch (err) {
        if (listContainer) {
            listContainer.innerHTML = `<p style="font-size: 0.8rem; color: #ffb3b1; text-align: center;">Error al cargar capítulos: ${esc(err.message)}</p>`;
        }
    }
}

function closeChaptersModal() {
    const modal = document.getElementById('chapters-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

document.addEventListener('DOMContentLoaded', initObrasCanvasPage);
