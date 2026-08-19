// Requiere js/utils/config.js

async function fetchWorks(page = 1, perPage = 25) {
    try {
        const response = await fetch(`${API_URL}/works/?page=${page}&per_page=${perPage}`);
        if (!response.ok) throw new Error('Error al obtener las obras');
        return await response.json();
    } catch (error) {
        console.error("fetchWorks error:", error);
        return null;
    }
}

async function fetchWorkBySlug(slug) {
    try {
        const response = await fetch(`${API_URL}/works/${slug}`);
        if (!response.ok) throw new Error('Error al obtener la obra');
        return await response.json();
    } catch (error) {
        console.error("fetchWorkBySlug error:", error);
        return null;
    }
}
