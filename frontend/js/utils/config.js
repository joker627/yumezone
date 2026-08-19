const API_URL = 'https://yumezone-api.com/api/v1';

// Función auxiliar para obtener URLs de imágenes completas
function getImageUrl(path) {
    if (!path) return null;
    if (path.startsWith('http')) {
        // wsrv.nl proxy bypass
        if (path.includes('wsrv.nl')) return path;
        return `https://wsrv.nl/?url=${encodeURIComponent(path)}`;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://yumezone-api.com/${cleanPath}`;
}
