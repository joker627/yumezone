
// Global variables
let heroCarouselInterval = null;
let currentSlideIndex = 0;
let carouselWorks = [];
let worksData = [];

// Renders the Skeleton Loader
function renderSkeletonGrid() {
    const grid = document.getElementById('works-grid');
    if (!grid) return;
    
    // Generar 10 skeletons
    const skeletons = Array(10).fill(`
        <div class="work-card skeleton">
        </div>
    `).join('');
    
    grid.innerHTML = skeletons;
}

// Renders the Hero Carousel
function renderHeroCarousel(works) {
    const heroRoot = document.getElementById('hero-carousel-root');
    if (!heroRoot || works.length === 0) return;

    // Tomamos hasta 5 obras
    carouselWorks = works.slice(0, 5);
    
    const slidesHTML = carouselWorks.map((work, index) => {
        const bgImage = getImageUrl(work.banner_url) || getImageUrl(work.cover_url);
        const bgStyle = bgImage ? `background-image: url('${bgImage}')` : `background: linear-gradient(135deg, var(--bg-dark) 0%, #3b0764 100%)`;

        return `
            <div class="hero-slide ${index === 0 ? 'active' : ''}" style="${bgStyle}" id="hero-slide-${index}">
                <div class="hero-overlay">
                    <span class="carousel-badge">Destacado</span>
                    <h2 class="hero-title">${work.title}</h2>
                    <p class="hero-synopsis">${work.synopsis || 'Explora este increíble título en nuestra biblioteca.'}</p>
                    <a href="/work.html?slug=${work.slug}" class="btn-hero">Ver Detalles</a>
                </div>
            </div>
        `;
    }).join('');

    const indicators = carouselWorks.map((_, index) => `
        <div class="hero-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})" id="hero-dot-${index}"></div>
    `).join('');

    heroRoot.innerHTML = `
        <div class="hero-carousel-container">
            ${slidesHTML}
            <div class="hero-controls">
                ${indicators}
            </div>
        </div>
    `;

    // Iniciar auto-play
    startCarouselAutoPlay();
}

// Logic to change slide
window.goToSlide = function(index) {
    if (index === currentSlideIndex) return;
    
    const oldSlide = document.getElementById(`hero-slide-${currentSlideIndex}`);
    const oldDot = document.getElementById(`hero-dot-${currentSlideIndex}`);
    if (oldSlide) oldSlide.classList.remove('active');
    if (oldDot) oldDot.classList.remove('active');

    currentSlideIndex = index;

    const newSlide = document.getElementById(`hero-slide-${currentSlideIndex}`);
    const newDot = document.getElementById(`hero-dot-${currentSlideIndex}`);
    if (newSlide) newSlide.classList.add('active');
    if (newDot) newDot.classList.add('active');

    // Reset autoplay interval
    startCarouselAutoPlay();
};

function startCarouselAutoPlay() {
    if (heroCarouselInterval) clearInterval(heroCarouselInterval);
    if (carouselWorks.length <= 1) return;

    heroCarouselInterval = setInterval(() => {
        let nextIndex = currentSlideIndex + 1;
        if (nextIndex >= carouselWorks.length) nextIndex = 0;
        goToSlide(nextIndex);
    }, 5000); // Change every 5 seconds
}

// Se ejecuta después de que el HTML de Home se inyecta
async function initHome(page = 1) {
    // Clear old interval if exists
    if (heroCarouselInterval) clearInterval(heroCarouselInterval);

    const grid = document.getElementById('works-grid');
    const pagination = document.getElementById('pagination-controls');
    
    // Show skeleton loaders
    renderSkeletonGrid();

    const response = await fetchWorks(page, 10); // 10 obras por página
    if (!response || !response.data) {
        if(grid) grid.innerHTML = '<div class="grid-error-msg">Error cargando las obras.</div>';
        return;
    }

    const works = response.data;

    // Render Carousel (Solo en la pagina 1 actualizamos el hero)
    if (page === 1) {
        renderHeroCarousel(works);
    }

    // Dibujar tarjetas
    if (!grid) return;
    if (works.length === 0) {
        grid.innerHTML = '<div style="text-align:center; grid-column: 1 / -1;">No hay obras disponibles.</div>';
    } else {
        grid.innerHTML = works.map((work, index) => {
            const coverUrl = getImageUrl(work.cover_url) || '/assets/images/placeholder.jpg';
            // Placeholder for type/genre (assuming we don't have them in API yet)
            const workType = work.type || 'MANHWA';
            const workDemographic = work.demographic || 'Shounen';
            
            return `
            <a href="/work.html?slug=${work.slug}" class="work-card">
                <img src="${coverUrl}" alt="${work.title}" class="work-card-img" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450/0f111a/7c3aed?text=YumeZone'">
                <div class="work-card-rank">#${index + 1}</div>
                <div class="work-card-overlay">
                    <h3 class="work-card-title">${work.title}</h3>
                    <div class="work-card-tags">
                        <span class="tag-type">${workType}</span>
                        <span class="tag-dot">•</span>
                        <span>${workDemographic}</span>
                    </div>
                </div>
            </a>
            `;
        }).join('');
    }
}
