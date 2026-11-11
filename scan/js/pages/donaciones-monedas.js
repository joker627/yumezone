import { checkScanAuth, apiRequest, invalidateAuthCache } from '../shared/auth.js';
import { showToast } from '../shared/toast.js';
import { formatNumber, formatDate, esc } from '../shared/ui-utils.js';

let currentScan = null;
let clanWorks = [];
let currentChapters = [];
let treasuryState = null;

async function initRecompensasPage() {
    initDraftModals();
    initTreasuryModals();

    const authData = await checkScanAuth();
    if (!authData) return;

    currentScan = authData.currentScan;
    if (!currentScan?.id) {
        renderNoClanState();
        return;
    }

    await Promise.allSettled([
        loadClanTreasury(),
        loadClanWorksAndSubmissions()
    ]);
}

async function loadClanTreasury() {
    if (!currentScan?.id) return;
    try {
        treasuryState = await apiRequest(`/scan-groups/${currentScan.id}/treasury`);
        renderTreasuryOverview(treasuryState);
        renderFundingGoals(treasuryState?.funding_goals || []);
        renderTopSupporters(treasuryState?.top_supporters || []);
        renderClanTransactions(treasuryState?.transactions || []);
    } catch (err) {
        console.error('Error al cargar bóveda del clan:', err);
    }
}

function renderTreasuryOverview(data) {
    if (!data) return;
    const vaultEl = document.getElementById('clan-vault-amount');
    const levelTag = document.getElementById('clan-level-tag');
    const totalLabel = document.getElementById('clan-total-contributed-label');
    const upgradeBtn = document.getElementById('btn-upgrade-clan-level');
    const upgradeText = document.getElementById('btn-upgrade-clan-text');
    const createGoalBtn = document.getElementById('btn-open-create-goal');
    const headerCoinsCount = document.getElementById('header-coins-count');

    const vaultTokens = Number(data.vault_tokens || 0);
    const clanLevel = Number(data.clan_level || 1);
    const upgradeCost = Number(data.level_upgrade_cost || clanLevel * 40);

    if (vaultEl) vaultEl.textContent = formatNumber(vaultTokens);
    if (levelTag) levelTag.textContent = `Nivel ${clanLevel}`;
    if (totalLabel) {
        totalLabel.textContent = `Recaudado histórico: ${formatNumber(data.total_contributed_tokens || 0)} Cristales`;
    }
    if (headerCoinsCount) {
        headerCoinsCount.textContent = `${formatNumber(vaultTokens)} Cristales`;
    }

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    if (upgradeBtn && canManage) {
        upgradeBtn.style.display = 'inline-flex';
        if (upgradeText) {
            upgradeText.textContent = `Subir a Nivel ${clanLevel + 1} (${upgradeCost} Cristales)`;
        }
    }
    if (createGoalBtn && canManage) {
        createGoalBtn.style.display = 'inline-flex';
    }
}

function renderFundingGoals(goals) {
    const listEl = document.getElementById('funding-goals-list');
    if (!listEl) return;

    if (!goals || goals.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 1rem; text-align: center; color: #86948e; font-size: 0.78rem;">
                No hay metas de capítulos activas. El líder puede crear una meta para que los lectores aporten Cristales desde la vitrina pública.
            </div>
        `;
        return;
    }

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    listEl.innerHTML = goals.map(g => {
        const current = Number(g.current_tokens || 0);
        const target = Math.max(1, Number(g.target_tokens || 25));
        const pct = Math.min(100, Math.round((current / target) * 100));
        const isCompleted = g.status === 'COMPLETED' || current >= target;
        return `
            <div style="background:#10131a;border:1px solid rgba(92,226,192,0.22);border-radius:10px;padding:0.85rem 1rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.35rem;">
                    <strong style="color:#eef1fa;font-size:0.86rem;">${esc(g.title)}</strong>
                    <span class="${isCompleted ? 'badge-tag-teal' : 'badge-tag-gold'}">${current}/${target} Cristales (${pct}%)</span>
                </div>
                ${g.work_title ? `<span style="display:block;font-size:0.72rem;color:#5ce2c0;margin-bottom:0.25rem;">Obra: ${esc(g.work_title)}</span>` : ''}
                ${g.description ? `<p style="font-size:0.76rem;color:#9ea4b8;margin:0 0 0.5rem 0;">${esc(g.description)}</p>` : ''}
                <div class="kpi-progress-bar" style="margin-bottom:0.5rem;">
                    <div class="kpi-progress-fill teal" style="width:${pct}%;"></div>
                </div>
                ${canManage ? `
                    <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                        <button type="button" class="btn-hero-dark btn-delete-goal" data-goalid="${g.id}" style="padding:0.28rem 0.6rem;font-size:0.72rem;color:#ffb4ab;">
                            Eliminar Meta
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.btn-delete-goal').forEach(btn => {
        btn.addEventListener('click', async () => {
            const gid = btn.getAttribute('data-goalid');
            if (!gid) return;
            btn.disabled = true;
            try {
                await apiRequest(`/scan-groups/${currentScan.id}/goals/${gid}`, { method: 'DELETE' });
                showToast('Meta eliminada.', 'info');
                await loadClanTreasury();
            } catch (err) {
                showToast(err.detail || 'Error al eliminar meta.', 'error');
                btn.disabled = false;
            }
        });
    });
}

function renderTopSupporters(supporters) {
    const el = document.getElementById('top-supporters-list');
    if (!el) return;
    if (!supporters || supporters.length === 0) {
        el.innerHTML = `<p style="font-size:0.76rem;color:#86948e;margin:0;">Aún no hay aportes de Cristales registrados en este clan.</p>`;
        return;
    }
    el.innerHTML = supporters.map((s, idx) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.75rem;background:#10131a;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:#eef1fa;"><strong>#${idx + 1}</strong> @${esc(s.username)}</span>
            <span class="badge-tag-gold">${formatNumber(s.total_tokens)} Cristales</span>
        </div>
    `).join('');
}

function renderClanTransactions(txs) {
    const listEl = document.getElementById('clan-treasury-transactions-list');
    if (!listEl) return;
    if (!txs || txs.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 1.25rem; text-align: center; color: #86948e; font-size: 0.78rem;">
                La Bóveda del Clan aún no registra movimientos de Cristales.
            </div>
        `;
        return;
    }
    listEl.innerHTML = txs.map(tx => {
        const isPos = Number(tx.amount) >= 0;
        const sign = isPos ? '+' : '';
        const color = isPos ? '#5ce2c0' : '#ffb3b1';
        return `
            <div style="background:#10131a;border:1px solid rgba(60,74,69,0.35);border-radius:8px;padding:0.6rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                <div style="min-width:0;">
                    <p style="font-size:0.78rem;font-weight:700;color:#e0e2ec;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(tx.description)}</p>
                    <span style="font-size:0.68rem;color:#86948e;">${esc(tx.type)} • ${formatDate(tx.created_at)}</span>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <strong style="font-size:0.84rem;color:${color};display:block;">${sign}${formatNumber(tx.amount)} Cristales</strong>
                    <span style="font-size:0.65rem;color:#86948e;">Bóveda: ${formatNumber(tx.balance_after)}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadClanWorksAndSubmissions() {
    const workSel = document.getElementById('sub-select-work');
    const chapSel = document.getElementById('sub-select-chapter');
    const goalWorkSel = document.getElementById('goal-work-select');

    try {
        const works = await apiRequest(`/scan-groups/${currentScan.id}/works`);
        clanWorks = Array.isArray(works) ? works : [];

        if (goalWorkSel) {
            goalWorkSel.innerHTML = `<option value="">General del Clan</option>` +
                clanWorks.map(w => `<option value="${w.id}">${esc(w.title)}</option>`).join('');
        }

        if (!workSel) return;
        if (clanWorks.length === 0) {
            workSel.innerHTML = `<option value="">Sin obras en el clan</option>`;
            if (chapSel) chapSel.innerHTML = `<option value="">Sin capítulos</option>`;
            renderEmptySubmissions('Registra primero una obra y un capítulo para gestionar borradores.');
            return;
        }

        workSel.innerHTML = clanWorks.map(w => `<option value="${w.id}">${esc(w.title)}</option>`).join('');
        await loadChaptersIntoSelect(workSel.value);

        workSel.addEventListener('change', () => loadChaptersIntoSelect(workSel.value));
        if (chapSel) {
            chapSel.addEventListener('change', () => loadChapterSubmissions(chapSel.value));
        }
    } catch (err) {
        console.error('Error al cargar obras para recompensas:', err);
    }
}

async function loadChaptersIntoSelect(workId) {
    const chapSel = document.getElementById('sub-select-chapter');
    if (!chapSel || !workId) return;

    try {
        const chaps = await apiRequest(`/chapters/work/${workId}?published_only=false&order=desc`);
        currentChapters = Array.isArray(chaps) ? chaps : [];

        if (currentChapters.length === 0) {
            chapSel.innerHTML = `<option value="">Sin capítulos registrados</option>`;
            renderEmptySubmissions('Esta obra aún no tiene capítulos. Crea o programa uno en Subir Capítulos.');
            return;
        }

        chapSel.innerHTML = currentChapters.map(c =>
            `<option value="${c.id}">Cap. ${esc(c.chapter_number)} — ${esc(c.title || c.status)} (+${c.reward_coins ?? 20} YumeCoins)</option>`
        ).join('');

        await loadChapterSubmissions(chapSel.value);
    } catch {
        chapSel.innerHTML = `<option value="">Error al cargar capítulos</option>`;
    }
}

async function loadChapterSubmissions(chapterId) {
    const container = document.getElementById('submissions-list-container');
    if (!container || !chapterId) return;

    const canManage = Boolean(currentScan?.is_leader || currentScan?.can_manage);
    container.innerHTML = `<span class="is-loading is-loading--block is-loading--w80"></span>`;

    try {
        const subs = await apiRequest(`/chapters/${chapterId}/submissions`);
        const list = Array.isArray(subs) ? subs : [];

        if (list.length === 0) {
            renderEmptySubmissions(
                canManage
                    ? 'No hay borradores de traducción enviados para este capítulo.'
                    : 'Aún no hay entregas para este capítulo. Usa "+ Enviar Borrador de Traducción" arriba para registrar tu trabajo.'
            );
            return;
        }

        const activeChap = currentChapters.find(c => String(c.id) === String(chapterId));
        const defaultCoins = activeChap?.reward_coins ?? 20;

        container.innerHTML = list.map(s => {
            const st = (s.status || 'PENDING').toUpperCase();
            const badgeClass = st === 'APPROVED' ? 'badge-tag-teal' : (st === 'REJECTED' ? 'badge-tag-coral' : 'badge-tag-gold');
            return `
                <div style="background:#10131a;border:1px solid rgba(60,74,69,0.4);border-radius:10px;padding:0.9rem 1rem;display:flex;flex-direction:column;gap:0.5rem;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <strong style="color:#e0e2ec;font-size:0.85rem;">@${esc(s.username || 'Usuario #' + s.user_id)}</strong>
                            <span style="font-size:0.72rem;color:#86948e;">• ${s.page_count} págs • ${formatDate(s.created_at)}</span>
                        </div>
                        <span class="${badgeClass}">${esc(st)}</span>
                    </div>
                    <div style="font-size:0.78rem;color:#bbcac3;word-break:break-all;">
                        Enlace: <a href="${esc(s.content_url)}" target="_blank" rel="noopener" style="color:#5ce2c0;text-decoration:underline;">${esc(s.content_url)}</a>
                    </div>
                    ${s.notes ? `<p style="font-size:0.75rem;color:#86948e;margin:0;">Notas: ${esc(s.notes)}</p>` : ''}
                    ${s.rejection_reason ? `<p style="font-size:0.75rem;color:#ffb3b1;margin:0;">Motivo rechazo: ${esc(s.rejection_reason)}</p>` : ''}
                    ${st === 'PENDING' && canManage ? `
                        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.25rem;">
                            <button type="button" class="btn-action-primary-sm btn-review-sub"
                                    data-subid="${s.id}"
                                    data-decision="APPROVED"
                                    data-username="${esc(s.username || '')}"
                                    data-coins="${defaultCoins}">
                                <img src="../assets/icons/svg/check.svg" class="icon-svg icon-xs icon-dark" alt="">
                                <span>Aprobar (+${defaultCoins} Coins + 1 Cristal)</span>
                            </button>
                            <button type="button" class="btn-hero-dark btn-review-sub"
                                    style="padding:0.35rem 0.75rem;font-size:0.75rem;color:#ffb3b1;"
                                    data-subid="${s.id}"
                                    data-decision="REJECTED"
                                    data-username="${esc(s.username || '')}"
                                    data-coins="${defaultCoins}">
                                <span>Rechazar</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-review-sub').forEach(btn => {
            btn.addEventListener('click', () => {
                openReviewModal({
                    submissionId: btn.getAttribute('data-subid'),
                    decision: btn.getAttribute('data-decision'),
                    username: btn.getAttribute('data-username'),
                    defaultCoins: btn.getAttribute('data-coins')
                });
            });
        });
    } catch (err) {
        renderEmptySubmissions(err.detail || err.message || 'Error al consultar borradores del capítulo.');
    }
}

function renderEmptySubmissions(message) {
    const container = document.getElementById('submissions-list-container');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem 1rem;">
            <div class="empty-state-icon">
                <img src="../assets/icons/svg/coin.svg" class="icon-svg icon-md" alt="">
            </div>
            <p class="empty-state-desc" style="font-size: 0.78rem;">${esc(message)}</p>
        </div>
    `;
}

function initTreasuryModals() {
    const goalModal = document.getElementById('create-goal-modal');
    const btnOpenGoal = document.getElementById('btn-open-create-goal');
    const btnCloseGoal = document.getElementById('btn-close-create-goal');
    const btnCancelGoal = document.getElementById('btn-cancel-create-goal');
    const goalForm = document.getElementById('create-goal-form');

    const closeGoal = () => {
        if (goalModal) {
            goalModal.classList.remove('open');
            goalModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnOpenGoal) {
        btnOpenGoal.addEventListener('click', () => {
            if (goalForm) goalForm.reset();
            if (goalModal) {
                goalModal.classList.add('open');
                goalModal.setAttribute('aria-hidden', 'false');
            }
        });
    }
    if (btnCloseGoal) btnCloseGoal.addEventListener('click', closeGoal);
    if (btnCancelGoal) btnCancelGoal.addEventListener('click', closeGoal);
    if (goalModal) {
        goalModal.addEventListener('click', (e) => {
            if (e.target === goalModal) closeGoal();
        });
    }

    if (goalForm) {
        goalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentScan?.id) return;
            const title = document.getElementById('goal-title-input')?.value.trim();
            const workVal = document.getElementById('goal-work-select')?.value;
            const work_id = workVal ? Number(workVal) : null;
            const target_tokens = Number(document.getElementById('goal-target-tokens')?.value || 25);
            const description = document.getElementById('goal-desc-input')?.value.trim() || null;
            const submitBtn = document.getElementById('btn-submit-create-goal');

            if (!title) return;
            if (submitBtn) submitBtn.disabled = true;
            try {
                await apiRequest(`/scan-groups/${currentScan.id}/goals`, {
                    method: 'POST',
                    body: { title, work_id, target_tokens, description }
                });
                closeGoal();
                showToast('Meta de capítulos patrocinados creada.', 'success');
                await loadClanTreasury();
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo crear la meta.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // 3. Botón Subir Nivel del Clan
    const upgradeBtn = document.getElementById('btn-upgrade-clan-level');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', async () => {
            if (!currentScan?.id) return;
            upgradeBtn.disabled = true;
            try {
                const res = await apiRequest(`/scan-groups/${currentScan.id}/upgrade-level`, {
                    method: 'POST'
                });
                showToast(res?.message || '¡Nivel del Clan mejorado!', 'success');
                invalidateAuthCache();
                await checkScanAuth(true);
                await loadClanTreasury();
            } catch (err) {
                showToast(err.detail || err.message || 'No se pudo subir el nivel del clan.', 'error');
            } finally {
                upgradeBtn.disabled = false;
            }
        });
    }
}

function initDraftModals() {
    // Modal Enviar Borrador
    const submitModal = document.getElementById('submit-draft-modal');
    const btnOpenSubmit = document.getElementById('btn-open-submit-draft');
    const btnCloseSubmit = document.getElementById('btn-close-submit-draft');
    const btnCancelSubmit = document.getElementById('btn-cancel-submit-draft');
    const submitForm = document.getElementById('submit-draft-form');

    const closeSubmit = () => {
        if (submitModal) {
            submitModal.classList.remove('open');
            submitModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnOpenSubmit) {
        btnOpenSubmit.addEventListener('click', () => {
            const chapId = document.getElementById('sub-select-chapter')?.value;
            if (!chapId) {
                showToast('Primero selecciona una obra y un capítulo en el panel derecho.', 'warning');
                return;
            }
            if (submitModal) {
                submitModal.classList.add('open');
                submitModal.setAttribute('aria-hidden', 'false');
            }
        });
    }
    if (btnCloseSubmit) btnCloseSubmit.addEventListener('click', closeSubmit);
    if (btnCancelSubmit) btnCancelSubmit.addEventListener('click', closeSubmit);
    if (submitModal) {
        submitModal.addEventListener('click', (e) => {
            if (e.target === submitModal) closeSubmit();
        });
    }

    if (submitForm) {
        submitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const chapId = document.getElementById('sub-select-chapter')?.value;
            const content_url = document.getElementById('draft-content-url')?.value.trim();
            const page_count = Number(document.getElementById('draft-page-count')?.value || 1);
            const notes = document.getElementById('draft-notes')?.value.trim() || null;
            const btn = document.getElementById('btn-confirm-submit-draft');

            if (!chapId || !content_url) return;
            if (btn) btn.disabled = true;

            try {
                await apiRequest(`/chapters/${chapId}/submissions`, {
                    method: 'POST',
                    body: { content_url, page_count, notes }
                });
                showToast('Borrador de traducción enviado correctamente.', 'success');
                closeSubmit();
                await loadChapterSubmissions(chapId);
            } catch (err) {
                showToast(err.detail || err.message || 'Error al enviar el borrador.', 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    // Modal Revisar Borrador (Aprobar / Rechazar)
    const reviewModal = document.getElementById('review-draft-modal');
    const btnCloseReview = document.getElementById('btn-close-review-draft');
    const btnCancelReview = document.getElementById('btn-cancel-review-draft');
    const reviewForm = document.getElementById('review-draft-form');

    const closeReview = () => {
        if (reviewModal) {
            reviewModal.classList.remove('open');
            reviewModal.setAttribute('aria-hidden', 'true');
        }
    };

    if (btnCloseReview) btnCloseReview.addEventListener('click', closeReview);
    if (btnCancelReview) btnCancelReview.addEventListener('click', closeReview);
    if (reviewModal) {
        reviewModal.addEventListener('click', (e) => {
            if (e.target === reviewModal) closeReview();
        });
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const chapId = document.getElementById('sub-select-chapter')?.value;
            const subId = document.getElementById('review-submission-id')?.value;
            const status = document.getElementById('review-decision-status')?.value;
            const reward_coins = Number(document.getElementById('review-reward-coins')?.value || 20);
            const rejection_reason = document.getElementById('review-rejection-reason')?.value.trim() || null;
            const btn = document.getElementById('btn-confirm-review-draft');

            if (!chapId || !subId || !status) return;
            if (btn) btn.disabled = true;

            try {
                const payload = status === 'APPROVED'
                    ? { status: 'APPROVED', reward_coins }
                    : { status: 'REJECTED', rejection_reason };

                await apiRequest(`/chapters/${chapId}/submissions/${subId}`, {
                    method: 'PATCH',
                    body: payload
                });

                invalidateAuthCache();
                await checkScanAuth(true);
                await Promise.allSettled([
                    loadClanTreasury(),
                    loadChapterSubmissions(chapId)
                ]);

                closeReview();
                showToast(
                    status === 'APPROVED'
                        ? `¡Borrador aprobado! +${reward_coins} YumeCoins al traductor y +1 Cristal a la Bóveda del Clan.`
                        : 'Propuesta rechazada: se notificó al usuario y se eliminó el borrador de la cola.',
                    status === 'APPROVED' ? 'success' : 'info'
                );
            } catch (err) {
                showToast(err.detail || err.message || 'Error al revisar el borrador.', 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }
}

function openReviewModal({ submissionId, decision, username, defaultCoins }) {
    const modal = document.getElementById('review-draft-modal');
    document.getElementById('review-submission-id').value = String(submissionId);
    document.getElementById('review-decision-status').value = decision;

    const isApprove = decision === 'APPROVED';
    document.getElementById('review-draft-title').textContent = isApprove
        ? 'Aprobar Traducción (+YumeCoins y +1 Cristal al Clan)'
        : 'Rechazar y Eliminar Propuesta';
    document.getElementById('review-draft-summary').textContent = isApprove
        ? `Vas a aprobar la entrega de @${username}. Recibirá YumeCoins + 50 XP y la Bóveda del Clan sumará +1 Cristal.`
        : `Se enviará una notificación con el motivo a @${username} y el borrador se eliminará de la cola.`;

    document.getElementById('review-coins-group').style.display = isApprove ? 'flex' : 'none';
    document.getElementById('review-reason-group').style.display = isApprove ? 'none' : 'flex';
    document.getElementById('review-reward-coins').value = String(defaultCoins || 20);
    document.getElementById('review-rejection-reason').value = '';

    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function renderNoClanState() {
    const vaultEl = document.getElementById('clan-vault-amount');
    if (vaultEl) vaultEl.textContent = '0';
    renderEmptySubmissions('No perteneces a un clan activo.');
}

document.addEventListener('DOMContentLoaded', initRecompensasPage);
