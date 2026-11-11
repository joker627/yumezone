// Componentes Reutilizables de Tarjetas y Filas para Scan Studio (Cero SVG inline)
import { esc, formatNumber, formatDate } from '../shared/ui-utils.js';

export function renderSeriesCatalogRow(w, rank = 1, canManage = false) {
    const scheduledCount = Number(w.scheduled_count) || 0;
    const draftCount = Number(w.draft_count) || 0;
    const publishedCount = Number(w.published_count ?? w.chapters_count) || 0;
    const totalChapters = Number(w.chapters_count) || 0;
    const isUpcoming = scheduledCount > 0 || (w.status_name || w.status || '').toLowerCase().includes('próximamente');

    const formatName = w.format_name || w.format || 'Manga';
    const formatLower = formatName.toLowerCase();
    const formatBadge = formatLower.includes('manhua') ? 'badge-tag-gold' : 'badge-tag-teal';
    const statusName = w.status_name || w.status || 'En emisión';

    return `
        <div class="series-catalog-row" data-format="${esc(formatLower)}" data-status="${isUpcoming ? 'proximamente' : 'al-dia'}" data-workid="${w.id}">
            <div class="series-info-group">
                <div class="series-cover-thumbnail">
                    <img src="${esc(w.cover_url || '../assets/icons/logo.png')}" alt="${esc(w.title)}" onerror="this.src='../assets/icons/logo.png'">
                    <span class="series-rank-tag">#${String(rank).padStart(2, '0')}</span>
                </div>
                <div class="series-text-block">
                    <div class="series-tags-inline">
                        <span class="${formatBadge}">${esc(formatName)}</span>
                        <span class="series-status-pill">${esc(statusName)}</span>
                        ${isUpcoming ? `
                            <span class="status-flow-badge proximamente" title="Tiene capítulos programados como Próximamente (En Traducción)">
                                <span class="status-dot-gold"></span> Próximamente (${scheduledCount > 0 ? scheduledCount + ' en traducción' : 'En Traducción'})
                            </span>
                        ` : `
                            <span class="status-flow-badge al-dia">
                                <span class="pulse-dot"></span> Al Día (${publishedCount} publ.)
                            </span>
                        `}
                        ${draftCount > 0 ? `<span class="badge-tag-coral">${draftCount} borrador(es)</span>` : ''}
                    </div>
                    <h4 class="series-title-text" title="${esc(w.title)}">${esc(w.title)}</h4>
                    <div class="series-metrics-sub">
                        <span class="metric-highlight">${formatNumber(totalChapters)} cap(s) totales</span>
                        <span>•</span>
                        <span>${formatNumber(w.total_views || 0)} vistas</span>
                        <span>•</span>
                        <span>★ ${Number(w.score || 0).toFixed(1)}</span>
                        <span>•</span>
                        <span class="metric-demographic">${esc(w.demographic_name || 'General')}</span>
                        ${Array.isArray(w.genres) && w.genres.length > 0 ? `<span>•</span><span style="color:#5ce2c0;">${esc(w.genres.slice(0, 3).join(', '))}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="series-row-actions">
                <a href="subir-capitulos.html?work=${w.id}" class="btn-action-primary-sm" title="Subir o Programar Capítulo .WEBP">
                    <img src="../assets/icons/svg/arrow-up.svg" class="icon-svg icon-xs icon-dark" alt="">
                    <span>Subir Cap</span>
                </a>
                <button class="btn-action-icon-sm btn-manage-chapters" data-workid="${w.id}" data-worktitle="${esc(w.title)}" title="Gestionar Capítulos y Flujo Próximamente" type="button">
                    <img src="../assets/icons/svg/library.svg" class="icon-svg icon-sm" alt="Capítulos">
                </button>
                <button class="btn-action-icon-sm btn-edit-work" data-workid="${w.id}" title="Editar Obra, Portada y Banner" type="button">
                    <img src="../assets/icons/svg/settings.svg" class="icon-svg icon-sm" alt="Editar">
                </button>
                ${canManage ? `
                    <button class="btn-action-icon-sm btn-delete-work" data-workid="${w.id}" data-worktitle="${esc(w.title)}" title="Eliminar Obra" type="button">
                        <img src="../assets/icons/svg/x.svg" class="icon-svg icon-sm" alt="Eliminar">
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

export function renderSquadMemberCard(m, canManage = false, currentUserId = null) {
    const roleCode = (m.role || 'UPLOADER').toUpperCase();
    const isLeader = roleCode === 'LEADER';
    const isSelf = currentUserId && Number(m.user_id) === Number(currentUserId);
    const roleName = m.role_name || (
        isLeader ? 'Líder de Scan' :
        roleCode === 'CO_LEADER' ? 'Colíder' :
        roleCode === 'UPLOADER' ? 'Subidor de Capítulos' :
        roleCode === 'EDITOR' ? 'Editor / Typesetter' :
        roleCode === 'TRANSLATOR' ? 'Traductor' : roleCode
    );
    const badgeClass = isLeader ? 'badge-tag-teal' : (roleCode === 'CO_LEADER' ? 'badge-tag-gold' : 'badge-tag-coral');

    const perms = m.permissions && typeof m.permissions === 'object' ? m.permissions : {};
    const canUploadPerm = isLeader || roleCode === 'CO_LEADER' || (perms.can_upload !== undefined ? Boolean(perms.can_upload) : roleCode === 'UPLOADER');
    const canManagePerm = isLeader || roleCode === 'CO_LEADER' || Boolean(perms.can_manage_members || perms.can_edit_group);

    return `
        <div class="member-bento-card" data-userid="${m.user_id}">
            <div class="member-card-top">
                <div class="member-profile-block">
                    <div class="member-avatar-wrap">
                        ${m.avatar_url
                            ? `<img src="${esc(m.avatar_url)}" alt="${esc(m.username)}" onerror="this.parentElement.innerHTML='<div class=\\'avatar-initials\\'>${esc((m.username || 'U').slice(0, 2).toUpperCase())}</div>'">`
                            : `<div class="avatar-initials">${esc((m.username || 'U').slice(0, 2).toUpperCase())}</div>`
                        }
                        <div class="member-status-dot"></div>
                    </div>
                    <div class="member-name-block">
                        <h4 class="member-name">${esc(m.username)} ${isSelf ? '<span style="font-size:0.68rem;color:#5ce2c0;">(Tú)</span>' : ''}</h4>
                        <span class="member-handle">@${esc((m.username || '').toLowerCase())}</span>
                    </div>
                </div>
                <span class="${badgeClass}">${esc(roleName)}</span>
            </div>
            <div class="member-stats-col">
                <div class="member-stat-row">
                    <span>Código de Usuario:</span>
                    <strong>${esc(m.user_code || '#' + String(m.user_id || '0000'))}</strong>
                </div>
                <div class="member-stat-row">
                    <span>Permisos Activos:</span>
                    <strong style="color: #5ce2c0;">${canManagePerm ? 'Admin + Subida' : (canUploadPerm ? 'Subida de Caps' : 'Solo Lectura/Trad.')}</strong>
                </div>
                <div class="member-stat-row">
                    <span>Fecha de Unión:</span>
                    <span class="member-joined-date">${formatDate(m.joined_at)}</span>
                </div>
            </div>
            <div class="member-actions-row">
                ${canManage ? `
                    <button class="btn-assign-work btn-reward-member" data-userid="${m.user_id}" data-username="${esc(m.username)}" title="Premiar con Cristales de la Bóveda del Clan" type="button" style="border-color: rgba(240,199,94,0.35); color: #f0c75e;">
                        <img src="../assets/icons/svg/coin.svg" class="icon-svg icon-xs" alt="" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                        Premiar
                    </button>
                ` : ''}
                ${canManage && !isLeader && !isSelf ? `
                    <button class="btn-assign-work btn-edit-member-role" data-userid="${m.user_id}" type="button">
                        <img src="../assets/icons/svg/settings.svg" class="icon-svg icon-xs" alt="" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                        Rol / Permisos
                    </button>
                    <button class="btn-kick-member" data-userid="${m.user_id}" data-username="${esc(m.username)}" title="Expulsar del Clan" type="button">
                        <img src="../assets/icons/svg/x.svg" class="icon-svg icon-xs" alt="Expulsar">
                    </button>
                ` : (!canManage ? `
                    <span class="btn-assign-work" style="opacity: 0.65; cursor: default; text-align: center;">
                        ${isLeader ? 'Propietario / Líder del Clan' : (isSelf ? 'Tu Cuenta Actual' : 'Miembro Activo del Clan')}
                    </span>
                ` : '')}
            </div>
        </div>
    `;
}
