// Controlador de Equipo, Roles Oficiales (scan_roles) y Permisos (Cero prompt/confirm/alert)
import { checkScanAuth, apiRequest, invalidateAuthCache } from '../shared/auth.js';
import { renderSquadMemberCard } from '../components/cards.js';
import { renderSquadSkeletons } from '../components/skeletons.js';
import { showToast } from '../shared/toast.js';
import { esc } from '../shared/ui-utils.js';

let currentScan = null;
let currentUser = null;
let clanMembers = [];
let pendingConfirmAction = null;
let searchDebounceTimer = null;

async function initMiembrosRoles() {
    const grid = document.getElementById('squad-members-grid');
    if (grid) {
        grid.innerHTML = renderSquadSkeletons(4);
    }

    initModals();

    const authData = await checkScanAuth();
    if (!authData) return;

    currentUser = authData.currentUser;
    currentScan = authData.currentScan;

    if (!currentScan?.id) {
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">
                        <img src="../assets/icons/svg/community.svg" class="icon-svg icon-lg" alt="">
                    </div>
                    <h3 class="empty-state-title">No tienes un Clan de Scan activo</h3>
                    <p class="empty-state-desc">Funda un clan desde el Dashboard o solicita a un líder que te incorpore.</p>
                    <a href="dashboard.html" class="btn-hero-primary">Ir al Dashboard</a>
                </div>
            `;
        }
        return;
    }

    // Mostrar botón de abandonar clan si no es el líder propietario
    const leaveBtn = document.getElementById('btn-open-leave-clan');
    if (leaveBtn && !currentScan.is_leader) {
        leaveBtn.style.display = 'inline-flex';
    }

    // Ocultar botón de invitar si no tiene permisos de gestión
    const inviteBtn = document.getElementById('btn-open-invite-modal');
    if (inviteBtn && !(currentScan.is_leader || currentScan.can_manage)) {
        inviteBtn.style.display = 'none';
    }

    await Promise.allSettled([
        loadScanRoles(),
        loadClanMembers()
    ]);
}

async function loadScanRoles() {
    try {
        const roles = await apiRequest('/scan-groups/roles');
        if (!Array.isArray(roles) || roles.length === 0) return;

        // Excluir LEADER porque el backend no permite añadir un segundo líder directamente
        const assignableRoles = roles.filter(r => String(r.code).toUpperCase() !== 'LEADER');
        const optionsHtml = assignableRoles.map(r =>
            `<option value="${esc(r.code)}">${esc(r.name)} (${esc(r.code)})</option>`
        ).join('');

        const inviteRoleSel = document.getElementById('invite-role');
        const editRoleSel = document.getElementById('edit-member-role');
        if (inviteRoleSel && optionsHtml) {
            inviteRoleSel.innerHTML = optionsHtml;
            inviteRoleSel.addEventListener('change', () => {
                const code = String(inviteRoleSel.value || '').toUpperCase();
                const upCb = document.getElementById('invite-perm-upload');
                const mgCb = document.getElementById('invite-perm-manage');
                if (upCb) upCb.checked = (code === 'CO_LEADER' || code === 'UPLOADER');
                if (mgCb) mgCb.checked = (code === 'CO_LEADER');
            });
        }
        if (editRoleSel && optionsHtml) {
            editRoleSel.innerHTML = optionsHtml;
            editRoleSel.addEventListener('change', () => {
                const code = String(editRoleSel.value || '').toUpperCase();
                const upCb = document.getElementById('edit-perm-upload');
                const mgCb = document.getElementById('edit-perm-manage');
                const edCb = document.getElementById('edit-perm-edit-group');
                if (upCb) upCb.checked = (code === 'CO_LEADER' || code === 'UPLOADER');
                if (mgCb) mgCb.checked = (code === 'CO_LEADER');
                if (edCb) edCb.checked = (code === 'CO_LEADER');
            });
        }
    } catch (e) {
        console.debug('Usando roles por defecto:', e);
    }
}

async function loadClanMembers() {
    const grid = document.getElementById('squad-members-grid');
    if (!grid || !currentScan?.id) return;

    try {
        const members = await apiRequest(`/scan-groups/${currentScan.id}/members`);
        clanMembers = Array.isArray(members) ? members : [];

        if (clanMembers.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">
                        <img src="../assets/icons/svg/community.svg" class="icon-svg icon-lg" alt="">
                    </div>
                    <h3 class="empty-state-title">No hay colaboradores en este clan</h3>
                    <p class="empty-state-desc">Incorpora a traductores, editores y subidores para formar tu equipo editorial.</p>
                </div>
            `;
            return;
        }

        const canManage = Boolean(currentScan.is_leader || currentScan.can_manage);
        grid.innerHTML = clanMembers.map(m => renderSquadMemberCard(m, canManage, currentUser?.id)).join('');
        bindMemberCardEvents(grid);
    } catch (err) {
        console.error('Error al cargar miembros del clan:', err);
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3 class="empty-state-title">Error al cargar colaboradores</h3>
                <p class="empty-state-desc">${esc(err.message || 'No se pudo conectar con el servidor')}</p>
                <button type="button" class="btn-hero-dark" id="btn-retry-members">Reintentar</button>
            </div>
        `;
        document.getElementById('btn-retry-members')?.addEventListener('click', loadClanMembers);
    }
}

function bindMemberCardEvents(container) {
    // 0. Abrir Modal para Premiar Miembro desde la Bóveda (POST /scan-groups/{id}/reward-member)
    container.querySelectorAll('.btn-reward-member').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = Number(btn.getAttribute('data-userid'));
            const username = btn.getAttribute('data-username') || 'miembro';
            openRewardMemberModal(userId, username);
        });
    });

    // 1. Abrir Modal para Editar Rol y Permisos (PUT /scan-groups/{id}/members/{user_id})
    container.querySelectorAll('.btn-edit-member-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = Number(btn.getAttribute('data-userid'));
            const member = clanMembers.find(m => Number(m.user_id) === userId);
            if (member) openEditMemberModal(member);
        });
    });

    // 2. Abrir Modal de Confirmación para Expulsar Miembro (DELETE /scan-groups/{id}/members/{user_id})
    container.querySelectorAll('.btn-kick-member').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-userid');
            const username = btn.getAttribute('data-username');
            openConfirmModal({
                title: `Expulsar a @${username}`,
                message: `¿Confirmas que deseas desvincular a @${username} de "${currentScan.name}"? Perderá sus permisos de subida en las obras del clan.`,
                onConfirm: async () => {
                    await apiRequest(`/scan-groups/${currentScan.id}/members/${userId}`, {
                        method: 'DELETE'
                    });
                    showToast(`@${username} fue expulsado del clan.`, 'info');
                    await loadClanMembers();
                }
            });
        });
    });
}

function initModals() {
    // Modal Invitar
    const btnOpenInvite = document.getElementById('btn-open-invite-modal');
    const inviteModal = document.getElementById('invite-modal');
    const btnCloseInvite = document.getElementById('btn-close-invite-modal');
    const btnCancelInvite = document.getElementById('btn-cancel-invite-modal');
    const inviteForm = document.getElementById('invite-form');
    const identifierInput = document.getElementById('invite-identifier');
    const suggestionsBox = document.getElementById('user-search-suggestions');

    const closeInvite = () => {
        if (inviteModal) {
            inviteModal.classList.remove('open');
            inviteModal.setAttribute('aria-hidden', 'true');
        }
        if (suggestionsBox) suggestionsBox.style.display = 'none';
    };

    if (btnOpenInvite) {
        btnOpenInvite.addEventListener('click', () => {
            if (identifierInput) identifierInput.value = '';
            if (inviteModal) {
                inviteModal.classList.add('open');
                inviteModal.setAttribute('aria-hidden', 'false');
            }
        });
    }
    if (btnCloseInvite) btnCloseInvite.addEventListener('click', closeInvite);
    if (btnCancelInvite) btnCancelInvite.addEventListener('click', closeInvite);
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) closeInvite();
        });
    }

    // Autocompletado real contra GET /users/search?q=...
    if (identifierInput && suggestionsBox) {
        identifierInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            const q = identifierInput.value.trim().replace(/^@/, '');
            if (q.length < 2) {
                suggestionsBox.style.display = 'none';
                return;
            }
            searchDebounceTimer = setTimeout(async () => {
                try {
                    const users = await apiRequest(`/users/search?q=${encodeURIComponent(q)}`);
                    if (!Array.isArray(users) || users.length === 0) {
                        suggestionsBox.style.display = 'none';
                        return;
                    }
                    suggestionsBox.innerHTML = users.slice(0, 5).map(u => `
                        <button type="button" class="user-suggestion-item" data-username="${esc(u.username)}"
                                style="width:100%;text-align:left;padding:0.5rem 0.75rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(60,74,69,0.25);color:#e0e2ec;font-size:0.78rem;">
                            <span><strong>@${esc(u.username)}</strong></span>
                            <span style="color:#5ce2c0;font-size:0.7rem;">${esc(u.user_code || '')}</span>
                        </button>
                    `).join('');
                    suggestionsBox.style.display = 'block';

                    suggestionsBox.querySelectorAll('.user-suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            identifierInput.value = item.getAttribute('data-username') || '';
                            suggestionsBox.style.display = 'none';
                        });
                    });
                } catch {
                    suggestionsBox.style.display = 'none';
                }
            }, 250);
        });
    }

    if (inviteForm) {
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user_identifier = identifierInput?.value.trim();
            const role = document.getElementById('invite-role')?.value || 'UPLOADER';
            const canUpload = Boolean(document.getElementById('invite-perm-upload')?.checked);
            const canManage = Boolean(document.getElementById('invite-perm-manage')?.checked);
            const submitBtn = document.getElementById('btn-submit-invite');

            if (!user_identifier) {
                showToast('Ingresa el @usuario, código o correo del colaborador.', 'warning');
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            try {
                await apiRequest(`/scan-groups/${currentScan.id}/members`, {
                    method: 'POST',
                    body: {
                        user_identifier,
                        role,
                        permissions: {
                            can_upload: canUpload,
                            can_manage_members: canManage,
                            can_edit_group: canManage
                        }
                    }
                });
                showToast(`¡Colaborador "${user_identifier}" incorporado al clan!`, 'success');
                closeInvite();
                await loadClanMembers();
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo incorporar al usuario.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Modal Editar Rol y Permisos
    const editModal = document.getElementById('edit-member-modal');
    const btnCloseEdit = document.getElementById('btn-close-edit-member');
    const btnCancelEdit = document.getElementById('btn-cancel-edit-member');
    const editForm = document.getElementById('edit-member-form');

    const closeEdit = () => {
        if (editModal) {
            editModal.classList.remove('open');
            editModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEdit);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEdit();
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetUserId = document.getElementById('edit-member-userid')?.value;
            const role = document.getElementById('edit-member-role')?.value;
            const can_upload = Boolean(document.getElementById('edit-perm-upload')?.checked);
            const can_manage_members = Boolean(document.getElementById('edit-perm-manage')?.checked);
            const can_edit_group = Boolean(document.getElementById('edit-perm-edit-group')?.checked);
            const submitBtn = document.getElementById('btn-submit-edit-member');

            if (!targetUserId) return;
            if (submitBtn) submitBtn.disabled = true;

            try {
                await apiRequest(`/scan-groups/${currentScan.id}/members/${targetUserId}`, {
                    method: 'PUT',
                    body: {
                        role,
                        permissions: {
                            can_upload,
                            can_manage_members,
                            can_edit_group
                        }
                    }
                });
                showToast('Rol y permisos actualizados correctamente.', 'success');
                closeEdit();
                await loadClanMembers();
            } catch (err) {
                showToast(err.detail || err.message || 'Error al actualizar permisos.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Modal Confirmación (Expulsar o Abandonar Clan)
    const confirmModal = document.getElementById('confirm-member-modal');
    const btnCloseConfirm = document.getElementById('btn-close-confirm-member');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm-member');
    const btnExecuteConfirm = document.getElementById('btn-execute-confirm-member');
    const btnLeaveClan = document.getElementById('btn-open-leave-clan');

    const closeConfirm = () => {
        pendingConfirmAction = null;
        if (confirmModal) {
            confirmModal.classList.remove('open');
            confirmModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirm);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirm);
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirm();
        });
    }

    if (btnExecuteConfirm) {
        btnExecuteConfirm.addEventListener('click', async () => {
            if (!pendingConfirmAction) return;
            btnExecuteConfirm.disabled = true;
            try {
                await pendingConfirmAction();
                closeConfirm();
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo completar la acción.', 'error');
            } finally {
                btnExecuteConfirm.disabled = false;
            }
        });
    }

    if (btnLeaveClan) {
        btnLeaveClan.addEventListener('click', () => {
            openConfirmModal({
                title: 'Abandonar Clan de Scan',
                message: `¿Confirmas que deseas abandonar voluntariamente el clan "${currentScan?.name}"?`,
                onConfirm: async () => {
                    await apiRequest(`/scan-groups/${currentScan.id}/leave`, { method: 'POST' });
                    invalidateAuthCache();
                    showToast('Has abandonado el clan.', 'info');
                    window.location.href = 'dashboard.html';
                }
            });
        });
    }

    // Modal Premiar Miembro
    const rewardModal = document.getElementById('reward-member-modal');
    const btnCloseReward = document.getElementById('btn-close-reward-member');
    const btnCancelReward = document.getElementById('btn-cancel-reward-member');
    const rewardForm = document.getElementById('reward-member-form');

    const closeReward = () => {
        if (rewardModal) {
            rewardModal.classList.remove('open');
            rewardModal.setAttribute('aria-hidden', 'true');
        }
    };
    if (btnCloseReward) btnCloseReward.addEventListener('click', closeReward);
    if (btnCancelReward) btnCancelReward.addEventListener('click', closeReward);
    if (rewardModal) {
        rewardModal.addEventListener('click', (e) => {
            if (e.target === rewardModal) closeReward();
        });
    }
    const amountInput = document.getElementById('reward-member-amount');
    const previewEl = document.getElementById('reward-member-coins-preview');
    if (amountInput && previewEl) {
        amountInput.addEventListener('input', () => {
            const qty = Math.max(1, Number(amountInput.value || 1));
            previewEl.textContent = `El colaborador recibirá: +${qty * 40} YumeCoins en su cartera (-${qty} ${qty === 1 ? 'Cristal' : 'Cristales'} de la Bóveda)`;
        });
    }
    if (rewardForm) {
        rewardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const target_user_id = Number(document.getElementById('reward-member-userid')?.value);
            const amount_tokens = Number(document.getElementById('reward-member-amount')?.value || 1);
            const reason = document.getElementById('reward-member-reason')?.value.trim() || null;
            const submitBtn = document.getElementById('btn-submit-reward-member');
            if (!target_user_id || amount_tokens <= 0) return;

            if (submitBtn) submitBtn.disabled = true;
            try {
                const res = await apiRequest(`/scan-groups/${currentScan.id}/reward-member`, {
                    method: 'POST',
                    body: { target_user_id, amount_tokens, reason }
                });
                closeReward();
                invalidateAuthCache();
                await checkScanAuth(true);
                showToast(res?.message || 'Recompensa enviada con éxito.', 'success');
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo enviar la recompensa.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
}

function openRewardMemberModal(userId, username) {
    const modal = document.getElementById('reward-member-modal');
    const uidInput = document.getElementById('reward-member-userid');
    const labelEl = document.getElementById('reward-member-target-label');
    const amountInput = document.getElementById('reward-member-amount');
    const reasonInput = document.getElementById('reward-member-reason');

    if (uidInput) uidInput.value = String(userId);
    if (labelEl) labelEl.textContent = `Destinatario: @${username} (Bóveda actual: ${currentScan?.vault_tokens || 0} Cristales)`;
    if (amountInput) amountInput.value = '1';
    if (reasonInput) reasonInput.value = '';
    const previewEl = document.getElementById('reward-member-coins-preview');
    if (previewEl) previewEl.textContent = 'El colaborador recibirá: +40 YumeCoins en su cartera (-1 Cristal de la Bóveda)';

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function openEditMemberModal(member) {
    const modal = document.getElementById('edit-member-modal');
    document.getElementById('edit-member-userid').value = String(member.user_id);
    document.getElementById('edit-member-username-label').textContent = `Colaborador: @${member.username} (${member.user_code || '#' + member.user_id})`;

    const roleSelect = document.getElementById('edit-member-role');
    if (roleSelect && member.role) roleSelect.value = member.role.toUpperCase();

    const perms = member.permissions && typeof member.permissions === 'object' ? member.permissions : {};
    const roleUpper = (member.role || '').toUpperCase();

    document.getElementById('edit-perm-upload').checked = perms.can_upload !== undefined ? Boolean(perms.can_upload) : ['CO_LEADER', 'UPLOADER'].includes(roleUpper);
    document.getElementById('edit-perm-manage').checked = Boolean(perms.can_manage_members || roleUpper === 'CO_LEADER');
    document.getElementById('edit-perm-edit-group').checked = Boolean(perms.can_edit_group || roleUpper === 'CO_LEADER');

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function openConfirmModal({ title, message, onConfirm }) {
    const modal = document.getElementById('confirm-member-modal');
    document.getElementById('confirm-member-title').textContent = title || 'Confirmar Acción';
    document.getElementById('confirm-member-message').textContent = message || '¿Confirmas esta acción?';
    pendingConfirmAction = onConfirm;
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

document.addEventListener('DOMContentLoaded', initMiembrosRoles);
