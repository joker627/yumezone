// Componente Reutilizable de Pie de Página para Scan Studio
export function renderScanFooter(container) {
    if (!container) return;
    container.innerHTML = `
        <footer class="dash-footer">
            <div class="dash-footer-inner">
                <div class="dash-footer-brand">
                    <img src="../assets/icons/logo.png" alt="Logo" width="24" height="24">
                    <span>YumeZone Scan Studio © 2026 • Ecosistema LectorGhost</span>
                </div>
                <div class="dash-footer-links">
                    <a href="dashboard.html">Dashboard</a>
                    <a href="obras-canvas.html">Obras & Banners</a>
                    <a href="subir-capitulos.html">Subir Capítulos</a>
                    <a href="miembros-roles.html">Equipo & Roles</a>
                    <a href="donaciones-monedas.html">Recompensas</a>
                </div>
            </div>
        </footer>
    `;
}
