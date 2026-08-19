const FooterHTML = `
    <footer class="main-footer" style="background-color: var(--bg-dark); border-top: var(--glass-border); padding: 4rem 2rem 2rem; margin-top: 5rem;">
        <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 3rem;">
            <div>
                <a href="/" class="auth-logo" style="font-family: var(--font-display); font-size: 2rem; font-weight: 800; color: var(--text-main); text-decoration: none; display: inline-block; margin-bottom: 1rem; letter-spacing: -0.5px;">
                    Yume<span style="color: var(--primary);">Zone</span>
                </a>
                <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">
                    La mejor plataforma para leer tus Manhuas y Webtoons favoritos. Sin publicidad invasiva y con la mejor calidad.
                </p>
            </div>
            <div>
                <h4 style="color: var(--text-main); font-size: 1.1rem; margin-bottom: 1.2rem; font-weight: 600;">Navegación</h4>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.8rem;">
                    <li><a href="/" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">Inicio</a></li>
                    <li><a href="#" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">Biblioteca</a></li>
                    <li><a href="#" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">Comunidad</a></li>
                </ul>
            </div>
            <div>
                <h4 style="color: var(--text-main); font-size: 1.1rem; margin-bottom: 1.2rem; font-weight: 600;">Legal</h4>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.8rem;">
                    <li><a href="#" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">Términos de Servicio</a></li>
                    <li><a href="#" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">Política de Privacidad</a></li>
                    <li><a href="#" style="color: var(--text-muted); text-decoration: none; font-size: 0.95rem;">DMCA</a></li>
                </ul>
            </div>
        </div>
        <div style="max-width: 1200px; margin: 3rem auto 0; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            &copy; 2026 YumeZone. Proyecto de Código Abierto.
        </div>
    </footer>
`;

function injectFooter() {
    const root = document.getElementById('footer-root');
    if (root) {
        root.innerHTML = FooterHTML;
    }
}

document.addEventListener('DOMContentLoaded', injectFooter);
