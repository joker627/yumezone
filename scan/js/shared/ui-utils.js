// Utilidades de interfaz y formato para Scan Studio

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export const esc = escapeHtml;

export function formatNumber(val) {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('es-ES');
}

export function formatDate(val) {
    if (!val) return 'N/A';
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

export function getRoleBadgeClass(roleCode) {
    const code = (roleCode || '').toUpperCase();
    switch (code) {
        case 'LEADER':
            return 'badge-role-leader';
        case 'CO_LEADER':
            return 'badge-role-coleader';
        case 'EDITOR':
            return 'badge-role-editor';
        case 'TRANSLATOR':
            return 'badge-role-translator';
        default:
            return 'badge-role-uploader';
    }
}
