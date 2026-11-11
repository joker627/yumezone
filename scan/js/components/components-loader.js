// Cargador Universal de Componentes para Scan Studio
import { renderScanHeader } from './header.js';
import { renderScanFooter } from './footer.js';
import { checkScanAuth } from '../shared/auth.js';

export async function initUniversalComponents() {
    const header = document.getElementById('header') || document.getElementById('dash-header-mount');
    const footer = document.getElementById('site-footer') || document.getElementById('dash-footer-mount');
    const activePage = document.body.dataset.page || 'dashboard';

    const authData = await checkScanAuth();
    if (!authData) {
        return;
    }

    if (header && !header.dataset.mounted) {
        header.dataset.mounted = 'true';
        renderScanHeader(header, {
            currentUser: authData.currentUser,
            currentScan: authData.currentScan,
            activePage,
            isLoading: false
        });
    }

    if (footer && !footer.dataset.mounted) {
        footer.dataset.mounted = 'true';
        renderScanFooter(footer);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUniversalComponents, { once: true });
    } else {
        initUniversalComponents();
    }
}
