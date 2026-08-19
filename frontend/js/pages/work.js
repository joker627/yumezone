async function initDetail(slug) {
    const container = document.getElementById('detail-container');
    if (!container) return;

    // Fetch Obra
    const work = await fetchWorkBySlug(slug);
    
    if (!work) {
        container.innerHTML = `
            <div class="error-container">
                <h2 class="error-title">Error 404</h2>
                <p>La obra no pudo ser cargada o no existe.</p>
                <a href="/" class="btn btn-primary mt-2">Volver al Inicio</a>
            </div>
        `;
        return;
    }

    // Fetch Capítulos
    let chapters = await fetchChaptersByWorkId(work.id);
    
    // Sort Descending
    if (chapters && chapters.length > 0) {
        chapters.sort((a, b) => b.chapter_number - a.chapter_number);
    }

    const bgImage = getImageUrl(work.banner_url) || getImageUrl(work.cover_url);
    const coverImage = getImageUrl(work.cover_url) || 'https://via.placeholder.com/300x420/0f111a/7c3aed?text=YumeZone';
    
    // Rellenar Banner y Cover
    if(bgImage) {
        document.getElementById('detail-banner').style.backgroundImage = `url('${bgImage}')`;
    }
    document.getElementById('detail-cover').src = coverImage;
    
    // Textos
    document.getElementById('detail-title').innerText = work.title;
    
    const altTitle = document.getElementById('detail-alt-title');
    if (work.alternative_title) {
        altTitle.innerText = work.alternative_title;
    } else {
        altTitle.style.display = 'none';
    }

    document.getElementById('detail-author').innerText = work.author || 'Desconocido';
    document.getElementById('detail-synopsis').innerHTML = work.synopsis || 'No hay sinopsis disponible para esta obra.';
    
    // Status
    const statusEl = document.getElementById('detail-status');
    statusEl.className = `detail-status ${work.status_id === 1 ? 'status-active' : 'status-finished'}`;
    statusEl.innerText = work.status_id === 1 ? 'En Emisión' : 'Finalizado';

    // Preparar el botón de leer
    const actionsBox = document.getElementById('detail-actions');
    const theme = localStorage.getItem('yumezone_theme') || 'dark';
    if (chapters && chapters.length > 0) {
        const firstChapter = chapters.reduce((prev, curr) => prev.chapter_number < curr.chapter_number ? prev : curr);
        actionsBox.innerHTML = `
            <a href="/reader.html?slug=${work.slug}&chapter_id=${firstChapter.id}" class="btn btn-primary read-btn">
                <img src="/assets/icons/${theme}/play.svg" alt="Play" width="20" height="20" style="filter: brightness(0) invert(1);">
                Empezar a Leer Cap. ${firstChapter.chapter_number}
            </a>
        `;
    } else {
        actionsBox.innerHTML = `
            <button class="btn btn-primary read-btn-disabled" disabled>
                Aún no hay capítulos
            </button>
        `;
    }

    // Preparar la lista de capítulos
    const chaptersList = document.getElementById('chapters-list');
    if (chapters && chapters.length > 0) {
        chaptersList.innerHTML = chapters.map(chap => `
            <a href="/reader.html?slug=${work.slug}&chapter_id=${chap.id}" class="chapter-item">
                <span class="chapter-name">Capítulo ${chap.chapter_number} ${chap.title ? '- ' + chap.title : ''}</span>
                <span class="chapter-date-info">
                    ${new Date(chap.created_at).toLocaleDateString()}
                </span>
            </a>
        `).join('');
    } else {
        chaptersList.innerHTML = `
            <div class="empty-chapters-msg">
                <p class="text-muted">Aún no hay capítulos disponibles. ¡Vuelve pronto!</p>
            </div>
        `;
    }
}
