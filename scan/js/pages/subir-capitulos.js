// Controlador de Subida de Capítulos .WEBP & Flujo "Próximamente (SCHEDULED)" -> "Publicado (PUBLISHED)"
import { checkScanAuth, apiRequest } from '../shared/auth.js';
import { renderChaptersListSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';
import { esc } from '../shared/ui-utils.js';

let currentScan = null;
let selectedWebpFiles = [];
let previewObjectUrls = [];
let assignedWorks = [];
let currentWorkChapters = [];

async function initSubirCapitulos() {
    const authData = await checkScanAuth();
    if (!authData) return;

    currentScan = authData.currentScan;

    if (!currentScan?.id) {
        showToast('Debes pertenecer a un clan de scan para subir capítulos.', 'warning');
        return;
    }

    const canUpload = Boolean(currentScan.is_leader || currentScan.can_manage || currentScan.can_upload);
    if (!canUpload) {
        const formCard = document.getElementById('chapter-upload-form');
        if (formCard) {
            formCard.innerHTML = `
                <div class="empty-state" style="padding: 2.2rem 1.5rem;">
                    <div class="empty-state-icon">
                        <img src="../assets/icons/svg/send.svg" class="icon-svg icon-lg" alt="">
                    </div>
                    <h3 class="empty-state-title">Tu rol es ${esc(currentScan.role_name || currentScan.role_code || 'Traductor / Editor')}</h3>
                    <p class="empty-state-desc">
                        La publicación directa de páginas <strong>.WEBP</strong> está reservada para los <strong>Uploaders, Colíderes y Líderes</strong> del Scan.
                        Como Traductor o Editor, debes registrar tus entregas en la <strong>Cola de Borradores de Traducción</strong> para recibir tus +20 YumeCoins al ser aprobadas.
                    </p>
                    <a href="donaciones-monedas.html" class="btn-hero-primary">+ Ir a Entregas de Traducción</a>
                </div>
            `;
        }
        return;
    }

    initUploadControls();
    await loadWorksIntoSelect();
}

async function loadWorksIntoSelect() {
    const selectEl = document.getElementById('select-upload-work');
    if (!selectEl || !currentScan?.id) return;

    const urlParams = new URLSearchParams(window.location.search);
    const preselectedWork = urlParams.get('work');
    const preselectedChapter = urlParams.get('chapter');
    const preselectedChapterId = urlParams.get('chapter_id');

    try {
        const works = await apiRequest(`/scan-groups/${currentScan.id}/works`);
        assignedWorks = Array.isArray(works) ? works : [];

        if (assignedWorks.length === 0) {
            selectEl.innerHTML = `<option value="">No tienes obras registradas en este clan</option>`;
            showToast('Primero registra una obra en el Catálogo de Obras.', 'info');
            return;
        }

        selectEl.innerHTML = assignedWorks.map(w =>
            `<option value="${w.id}" ${preselectedWork && String(w.id) === String(preselectedWork) ? 'selected' : ''}>
                ${esc(w.title)} (${esc(w.format_name || w.format || 'Manga')})
            </option>`
        ).join('');

        await loadChaptersForWork(selectEl.value, preselectedChapter, preselectedChapterId);

        selectEl.addEventListener('change', () => {
            document.getElementById('editing-chapter-id').value = '';
            loadChaptersForWork(selectEl.value);
        });
    } catch (e) {
        console.error('Error al cargar obras en select:', e);
        selectEl.innerHTML = `<option value="">Error al cargar obras del clan</option>`;
    }
}

async function loadChaptersForWork(workId, preselectedChapter = null, preselectedChapterId = null) {
    const chapInput = document.getElementById('input-upload-number');
    const titleInput = document.getElementById('input-upload-title');
    const coinsInput = document.getElementById('input-reward-coins');
    const editingIdInput = document.getElementById('editing-chapter-id');
    const pipelineList = document.getElementById('work-chapters-pipeline-list');

    if (!workId) return;
    if (pipelineList) pipelineList.innerHTML = renderChaptersListSkeletons(3);

    try {
        const chapters = await apiRequest(`/chapters/work/${workId}?published_only=false&order=desc`);
        currentWorkChapters = Array.isArray(chapters) ? chapters : [];

        if (preselectedChapter) {
            const match = currentWorkChapters.find(c =>
                (preselectedChapterId && String(c.id) === String(preselectedChapterId)) ||
                Number(c.chapter_number) === Number(preselectedChapter)
            );
            if (chapInput) chapInput.value = String(Number(preselectedChapter));
            if (match) {
                if (editingIdInput) editingIdInput.value = String(match.id);
                if (titleInput) titleInput.value = match.title || '';
                if (coinsInput && match.reward_coins != null) coinsInput.value = String(match.reward_coins);
                const heading = document.getElementById('upload-mode-heading');
                if (heading) heading.textContent = `Actualizar Capítulo #${match.chapter_number} (${match.status})`;
            }
        } else if (currentWorkChapters.length > 0) {
            const maxNum = Math.max(...currentWorkChapters.map(c => Number(c.chapter_number) || 0));
            if (chapInput) chapInput.value = String(maxNum + 1);
        } else {
            if (chapInput) chapInput.value = '1';
        }

        renderWorkChaptersPipeline(workId, currentWorkChapters);
    } catch {
        currentWorkChapters = [];
        if (chapInput && !preselectedChapter) chapInput.value = '1';
        if (pipelineList) pipelineList.innerHTML = `<p class="empty-state-desc">No se pudieron cargar los capítulos de la obra.</p>`;
    }
}

function renderWorkChaptersPipeline(workId, chapters) {
    const pipelineList = document.getElementById('work-chapters-pipeline-list');
    if (!pipelineList) return;

    if (!chapters || chapters.length === 0) {
        pipelineList.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem;">
                <p class="empty-state-desc">Esta obra aún no tiene capítulos registrados. Usa el formulario superior para programar o publicar el Capítulo 1.</p>
            </div>
        `;
        return;
    }

    pipelineList.innerHTML = chapters.map(c => {
        const st = (c.status || 'PUBLISHED').toUpperCase();
        const isScheduled = st === 'SCHEDULED';
        const isDraft = st === 'DRAFT';
        const badgeClass = isScheduled ? 'upcoming' : (isDraft ? 'draft' : 'published');
        const badgeText = isScheduled ? 'Próximamente (En Traducción)' : (isDraft ? 'Borrador Interno' : 'Publicado');

        return `
            <div class="chapter-item-row">
                <div class="chapter-item-info">
                    <span class="chapter-number-tag">Cap. ${esc(c.chapter_number)}</span>
                    <div>
                        <p class="chapter-item-title">${esc(c.title || 'Capítulo Completo')}</p>
                        <span style="font-size: 0.68rem; color: #86948e;">Estado: ${badgeText} • Recompensa: +${c.reward_coins ?? 20} YumeCoins</span>
                    </div>
                </div>
                <div class="chapter-item-actions">
                    <span class="status-pill-btn ${badgeClass}">${badgeText}</span>
                    <button type="button" class="btn-action-primary-sm btn-select-existing-chapter"
                            data-id="${c.id}"
                            data-num="${c.chapter_number}"
                            data-title="${esc(c.title || '')}"
                            data-coins="${c.reward_coins ?? 20}">
                        <img src="../assets/icons/svg/arrow-up.svg" class="icon-svg icon-xs icon-dark" alt="">
                        <span>${isScheduled || isDraft ? 'Subir Páginas y Publicar' : 'Reemplazar Páginas'}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    pipelineList.querySelectorAll('.btn-select-existing-chapter').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const num = btn.getAttribute('data-num');
            const title = btn.getAttribute('data-title');
            const coins = btn.getAttribute('data-coins');

            document.getElementById('editing-chapter-id').value = id;
            document.getElementById('input-upload-number').value = String(Number(num));
            document.getElementById('input-upload-title').value = title || '';
            document.getElementById('input-reward-coins').value = coins || '20';
            document.getElementById('select-chapter-status').value = 'PUBLISHED';
            document.getElementById('select-chapter-status').dispatchEvent(new Event('change'));

            const heading = document.getElementById('upload-mode-heading');
            if (heading) heading.textContent = `Subiendo Páginas para Publicar Capítulo #${Number(num)}`;

            document.getElementById('quick-upload-card')?.scrollIntoView({ behavior: 'smooth' });
            showToast(`Capítulo #${Number(num)} seleccionado. Adjunta sus páginas .WEBP para publicarlo.`, 'info');
        });
    });
}

function initUploadControls() {
    const dropzone = document.getElementById('dropzone-webp');
    const fileInput = document.getElementById('webp-files-input');
    const folderInput = document.getElementById('webp-folder-input');
    const browseFilesBtn = document.getElementById('btn-browse-files');
    const browseFolderBtn = document.getElementById('btn-browse-folder');
    const clearBtn = document.getElementById('btn-clear-pages');
    const uploadForm = document.getElementById('express-upload-form');
    const statusSelect = document.getElementById('select-chapter-status');
    const submitBtnText = document.getElementById('btn-submit-text');

    if (statusSelect && submitBtnText) {
        statusSelect.addEventListener('change', (e) => {
            const status = e.target.value;
            if (status === 'SCHEDULED') {
                submitBtnText.textContent = 'Registrar Capítulo como Próximamente (En Traducción)';
            } else if (status === 'DRAFT') {
                submitBtnText.textContent = 'Guardar Capítulo como Borrador Interno (DRAFT)';
            } else {
                submitBtnText.textContent = 'Confirmar y Publicar Entrega WebP';
            }
        });
    }

    if (browseFolderBtn && folderInput) {
        browseFolderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            folderInput.click();
        });
    }

    if (browseFilesBtn && fileInput) {
        browseFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target === folderInput || e.target === fileInput) return;
            fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');

            const items = e.dataTransfer?.items;
            if (items && items.length > 0) {
                const entries = [];
                let detectedFolderName = null;
                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                    if (entry) {
                        if (entry.isDirectory && !detectedFolderName) {
                            detectedFolderName = entry.name;
                        }
                        entries.push(entry);
                    }
                }

                if (entries.length > 0) {
                    const extractedFiles = await extractFilesFromEntries(entries);
                    if (detectedFolderName) {
                        applyFolderChapterHint(detectedFolderName);
                    }
                    processWebpFiles(extractedFiles, detectedFolderName);
                    return;
                }
            }

            if (e.dataTransfer?.files) {
                processWebpFiles(Array.from(e.dataTransfer.files));
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files) {
                processWebpFiles(Array.from(fileInput.files));
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener('change', () => {
            if (folderInput.files && folderInput.files.length > 0) {
                const filesArr = Array.from(folderInput.files);
                const firstRelPath = filesArr[0]?.webkitRelativePath || '';
                const folderName = firstRelPath.includes('/') ? firstRelPath.split('/')[0] : null;
                if (folderName) {
                    applyFolderChapterHint(folderName);
                }
                processWebpFiles(filesArr, folderName);
            }
        });
    }

    if (clearBtn) clearBtn.addEventListener('click', resetWebpSelection);
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);
}

async function extractFilesFromEntries(entries) {
    const files = [];

    async function traverseEntry(entry) {
        if (entry.isFile) {
            const rawFile = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
            if (rawFile) {
                try {
                    const buffer = await rawFile.arrayBuffer();
                    const cloned = new File([buffer], rawFile.name, {
                        type: rawFile.type || (rawFile.name.toLowerCase().endsWith('.webp') ? 'image/webp' : ''),
                        lastModified: rawFile.lastModified
                    });
                    files.push(cloned);
                } catch {
                    files.push(rawFile);
                }
            }
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const readBatch = () => new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
            let batch = await readBatch();
            while (batch && batch.length > 0) {
                for (const child of batch) {
                    await traverseEntry(child);
                }
                batch = await readBatch();
            }
        }
    }

    for (const entry of entries) {
        await traverseEntry(entry);
    }
    return files;
}

function applyFolderChapterHint(folderName) {
    if (!folderName) return;
    // Extraer número si la carpeta se llama "capitulo-10", "cap_10.5", "10", etc.
    const match = String(folderName).match(/(\d+(?:\.\d+)?)/);
    if (!match) return;

    const detectedNum = Number(match[1]);
    if (Number.isNaN(detectedNum)) return;

    const chapInput = document.getElementById('input-upload-number');
    const editingIdInput = document.getElementById('editing-chapter-id');
    const titleInput = document.getElementById('input-upload-title');
    const coinsInput = document.getElementById('input-reward-coins');
    const heading = document.getElementById('upload-mode-heading');

    if (chapInput) chapInput.value = String(detectedNum);

    const existing = currentWorkChapters.find(c => Number(c.chapter_number) === detectedNum);
    if (existing) {
        if (editingIdInput) editingIdInput.value = String(existing.id);
        if (titleInput && !titleInput.value && existing.title) titleInput.value = existing.title;
        if (coinsInput && existing.reward_coins != null) coinsInput.value = String(existing.reward_coins);
        if (heading) {
            heading.textContent = `Carpeta "${folderName}" → Publicando Capítulo #${detectedNum}`;
        }
    }
}

function processWebpFiles(files, sourceFolderName = null) {
    if (!files || files.length === 0) {
        showToast('La carpeta o selección no contiene archivos .WEBP.', 'warning');
        return;
    }

    // Ignorar archivos ocultos del sistema operativo dentro de carpetas (desktop.ini, Thumbs.db, .DS_Store)
    const relevantFiles = files.filter(f => {
        const name = (f.name || '').toLowerCase();
        return name && !name.startsWith('.') && name !== 'desktop.ini' && name !== 'thumbs.db';
    });

    const nonWebp = relevantFiles.filter(f => {
        const name = (f.name || '').toLowerCase();
        return !name.endsWith('.webp') && f.type !== 'image/webp';
    });

    if (nonWebp.length > 0) {
        showToast(`Se omitieron ${nonWebp.length} archivo(s) no válidos. Solo se cargaron las páginas .WEBP.`, 'warning');
    }

    const validFiles = relevantFiles.filter(f => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.webp') || f.type === 'image/webp';
    });

    if (validFiles.length === 0) {
        showToast('No se encontraron páginas en formato .WEBP dentro de la carpeta o selección.', 'warning');
        resetWebpSelection();
        return;
    }

    validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    selectedWebpFiles = validFiles;

    const container = document.getElementById('preview-container');
    const grid = document.getElementById('preview-grid');
    const countLabel = document.getElementById('preview-count-label');

    const totalBytes = validFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
    const folderPrefix = sourceFolderName ? `📁 ${sourceFolderName} • ` : '';

    if (countLabel) countLabel.textContent = `${folderPrefix}${validFiles.length} páginas WebP ordenadas (${totalMb} MB)`;

    if (grid) {
        grid.innerHTML = validFiles.map((file, idx) => {
            const objUrl = URL.createObjectURL(file);
            previewObjectUrls.push(objUrl);
            return `
                <div class="thumb-preview-card" title="${esc(file.name)}">
                    <img src="${objUrl}" alt="${esc(file.name)}">
                    <span class="thumb-page-badge">#${idx + 1}</span>
                </div>
            `;
        }).join('');
    }

    if (container) container.classList.remove('hidden');
}

function resetWebpSelection() {
    previewObjectUrls.forEach(url => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    selectedWebpFiles = [];

    const fileInput = document.getElementById('webp-files-input');
    if (fileInput) fileInput.value = '';
    const folderInput = document.getElementById('webp-folder-input');
    if (folderInput) folderInput.value = '';

    const container = document.getElementById('preview-container');
    if (container) container.classList.add('hidden');

    const grid = document.getElementById('preview-grid');
    if (grid) grid.innerHTML = '';
}

async function handleUploadSubmit(e) {
    e.preventDefault();

    const workSelect = document.getElementById('select-upload-work');
    const chapInput = document.getElementById('input-upload-number');
    const titleInput = document.getElementById('input-upload-title');
    const statusSelect = document.getElementById('select-chapter-status');
    const coinsInput = document.getElementById('input-reward-coins');
    const editingIdInput = document.getElementById('editing-chapter-id');
    const submitBtn = document.getElementById('btn-upload-submit');
    const submitBtnText = document.getElementById('btn-submit-text');

    const workId = workSelect ? Number(workSelect.value) : null;
    const chapNum = chapInput ? Number(chapInput.value) : null;
    const title = titleInput?.value?.trim() || null;
    const dbStatus = statusSelect ? statusSelect.value : 'PUBLISHED';
    const rewardCoins = Number(coinsInput?.value ?? 20);

    if (!workId || chapNum === null || Number.isNaN(chapNum)) {
        showToast('Selecciona la obra y el número de capítulo.', 'warning');
        return;
    }

    // Verificar si ya existe ese número de capítulo en la obra (ej. estaba en SCHEDULED / Próximamente)
    const existingChap = currentWorkChapters.find(c =>
        (editingIdInput?.value && String(c.id) === String(editingIdInput.value)) ||
        Number(c.chapter_number) === Number(chapNum)
    );

    // FLUJO 1: Programar como "Próximamente (SCHEDULED)" o "Borrador (DRAFT)" sin páginas obligatorias
    if (dbStatus === 'SCHEDULED' || dbStatus === 'DRAFT') {
        if (submitBtn) submitBtn.disabled = true;
        try {
            let targetChapId = existingChap?.id;
            if (targetChapId) {
                await apiRequest(`/chapters/${targetChapId}`, {
                    method: 'PUT',
                    body: {
                        chapter_number: chapNum,
                        title,
                        status: dbStatus,
                        reward_coins: rewardCoins
                    }
                });
            } else {
                const created = await apiRequest('/chapters/create_chapter', {
                    method: 'POST',
                    body: {
                        work_id: workId,
                        chapter_number: chapNum,
                        title,
                        scan_group_id: Number(currentScan.id),
                        status: dbStatus,
                        reward_coins: rewardCoins
                    }
                });
                targetChapId = created?.id;
            }

            // Si además adjuntó páginas para el borrador, subirlas también
            if (targetChapId && selectedWebpFiles.length > 0) {
                await uploadAndAssignPages(targetChapId, selectedWebpFiles, submitBtnText);
            }

            showToast(
                dbStatus === 'SCHEDULED'
                    ? `¡Capítulo #${chapNum} registrado como "Próximamente (En Traducción)"!`
                    : `¡Capítulo #${chapNum} guardado como Borrador Interno!`,
                'success'
            );

            if (editingIdInput) editingIdInput.value = '';
            if (titleInput) titleInput.value = '';
            resetWebpSelection();
            await loadChaptersForWork(workId);
        } catch (err) {
            showToast(err.detail || err.message || 'Error al registrar el capítulo.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
        return;
    }

    // FLUJO 2: Publicar Capítulo (PUBLISHED) con páginas .WEBP
    if (!selectedWebpFiles || selectedWebpFiles.length === 0) {
        showToast('Para publicar el capítulo debes seleccionar sus páginas en formato .WEBP.', 'warning');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
        let chapterId = existingChap?.id;

        if (chapterId) {
            // Actualizar el capítulo que estaba en SCHEDULED/DRAFT a PUBLISHED
            await apiRequest(`/chapters/${chapterId}`, {
                method: 'PUT',
                body: {
                    chapter_number: chapNum,
                    title,
                    status: 'PUBLISHED',
                    reward_coins: rewardCoins
                }
            });
        } else {
            const chapterRes = await apiRequest('/chapters/create_chapter', {
                method: 'POST',
                body: {
                    work_id: workId,
                    chapter_number: chapNum,
                    title,
                    scan_group_id: Number(currentScan.id),
                    status: 'PUBLISHED',
                    reward_coins: rewardCoins
                }
            });
            chapterId = chapterRes?.id;
        }

        if (!chapterId) throw new Error('No se pudo obtener el ID del capítulo.');

        await uploadAndAssignPages(chapterId, selectedWebpFiles, submitBtnText);

        showToast(`¡Capítulo #${chapNum} publicado con ${selectedWebpFiles.length} páginas WebP! (+2 Cristales a la Bóveda del Clan)`, 'success');
        await checkScanAuth(true);

        if (editingIdInput) editingIdInput.value = '';
        if (titleInput) titleInput.value = '';
        const heading = document.getElementById('upload-mode-heading');
        if (heading) heading.textContent = 'Publicación o Programación de Entrega';
        resetWebpSelection();
        await loadChaptersForWork(workId);
    } catch (err) {
        console.error('Error en subida WebP:', err);
        showToast(err.detail || err.message || 'Error al procesar la subida del capítulo.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            if (submitBtnText) submitBtnText.textContent = 'Confirmar y Publicar Entrega WebP';
        }
    }
}

async function uploadAndAssignPages(chapterId, files, submitBtnText) {
    const batchSize = 40;
    let allUploadedUrls = [];

    for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        if (submitBtnText) {
            submitBtnText.textContent = `Subiendo páginas (${Math.min(i + chunk.length, files.length)}/${files.length})...`;
        }
        const formData = new FormData();
        chunk.forEach(f => formData.append('files', f));

        const uploadRes = await apiRequest('/uploads/images', {
            method: 'POST',
            body: formData
        });

        const urls = Array.isArray(uploadRes?.urls) ? uploadRes.urls : [];
        allUploadedUrls = allUploadedUrls.concat(urls);
    }

    if (allUploadedUrls.length === 0) {
        throw new Error('El servidor no devolvió URLs tras subir las imágenes WebP.');
    }

    const pagesPayload = {
        pages: allUploadedUrls.map((url, idx) => ({
            image_url: url,
            order_number: idx + 1
        }))
    };

    await apiRequest(`/chapters/${chapterId}/pages`, {
        method: 'PUT',
        body: pagesPayload
    });
}

document.addEventListener('DOMContentLoaded', initSubirCapitulos);
