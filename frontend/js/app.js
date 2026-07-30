// State to hold our data
let seriesData = [];

// Fallback image in case the source is broken or missing locally
const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" style="background:%232a2d36"><text x="50%" y="50%" fill="%239ca3af" font-family="sans-serif" font-size="24" text-anchor="middle" alignment-baseline="middle">Imagen no disponible</text></svg>';

// Main App Initialization
async function initApp() {
    const routerView = document.getElementById('router-view');
    routerView.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            Cargando Top 20...
        </div>
    `;

    try {
        // Fetch the generated top 20 json
        const response = await fetch('./data_top20.json');
        if (!response.ok) throw new Error('Error al cargar data_top20.json');
        seriesData = await response.json();
        
        // Setup Routing
        window.addEventListener('hashchange', router);
        router(); // Call router to handle initial load
    } catch (error) {
        console.error(error);
        routerView.innerHTML = `
            <div style="text-align: center; margin-top: 4rem;">
                <h2 style="color: #ef4444;">Ocurrió un error</h2>
                <p style="color: var(--text-muted); margin-top: 1rem;">No se pudo cargar la información. Verifica que data_top20.json exista.</p>
            </div>
        `;
    }
}

// Simple Hash Router
function router() {
    const hash = window.location.hash.slice(1) || '/';
    const routerView = document.getElementById('router-view');
    
    // Smooth fade out/in effect
    routerView.style.opacity = '0';
    
    setTimeout(() => {
        if (hash === '/') {
            renderHome(routerView);
        } else if (hash.startsWith('/series/')) {
            const id = hash.split('/')[2];
            renderDetail(routerView, id);
        } else {
            renderHome(routerView);
        }
        routerView.style.opacity = '1';
    }, 200);
}

// Render Home View (List)
function renderHome(container) {
    let html = `
        <section class="hero-section">
            <h1 class="hero-title">El Top 20 Definitivo</h1>
            <p class="hero-subtitle">Descubre las obras más leídas, aclamadas y con mayor número de capítulos de toda la red.</p>
        </section>
        <div class="series-grid">
    `;

    seriesData.forEach((item, index) => {
        // Rank #1 to #20 badge
        const rank = index + 1;
        const badgeText = rank <= 3 ? `🏆 Top ${rank}` : `#${rank}`;
        
        html += `
            <div class="series-card" onclick="window.location.hash = '/series/${item.clave}'">
                <span class="badge">${badgeText}</span>
                <div class="card-image-wrapper">
                    <img class="card-image" src="${item.imagen}" alt="${item.titulo}" onerror="this.src='${FALLBACK_IMAGE}'" loading="lazy">
                </div>
                <div class="card-overlay">
                    <h3 class="card-title" title="${item.titulo}">${item.titulo}</h3>
                    <div class="card-meta">
                        <span>⭐ Capítulos: ${item.capitulos}</span>
                        <span>${item.tipo}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// Render Detail View
function renderDetail(container, clave) {
    const item = seriesData.find(s => s.clave === clave);
    
    if (!item) {
        container.innerHTML = `
            <a href="#/" class="back-btn">← Volver al Top 20</a>
            <h2>Serie no encontrada</h2>
        `;
        return;
    }

    const genresHtml = item.generos ? item.generos.map(g => `<span class="genre-tag">${g}</span>`).join('') : '';

    container.innerHTML = `
        <a href="#/" class="back-btn">← Volver al Inicio</a>
        <div class="detail-view">
            <div class="detail-image-container">
                <img class="detail-image" src="${item.imagen}" alt="${item.titulo}" onerror="this.src='${FALLBACK_IMAGE}'">
            </div>
            <div class="detail-info">
                <h2 class="detail-title">${item.titulo}</h2>
                
                <div class="detail-stats">
                    <div class="stat-pill"><span>Tipo:</span> ${item.tipo || 'Desconocido'}</div>
                    <div class="stat-pill"><span>Capítulos:</span> ${item.capitulos}</div>
                    <div class="stat-pill"><span>Estado:</span> ${item.estado || 'Desconocido'}</div>
                    <div class="stat-pill"><span>Traducciones:</span> ${item.scanCount || 1} Scans</div>
                </div>

                <div class="genres-container">
                    ${genresHtml}
                </div>

                <div class="detail-synopsis">
                    ${item.sinopsis ? item.sinopsis : '<em>No hay sinopsis disponible para esta obra.</em>'}
                </div>

                ${item.enlace ? `<a href="${item.enlace}" target="_blank" class="read-btn">Leer Ahora</a>` : ''}
            </div>
        </div>
    `;
}

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
