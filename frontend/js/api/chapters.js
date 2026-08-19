// Requiere js/utils/config.js

async function fetchChaptersByWorkId(workId) {
    try {
        const response = await fetch(`${API_URL}/chapters/work/${workId}`);
        if (!response.ok) throw new Error('Error al obtener los capítulos');
        return await response.json();
    } catch (error) {
        console.error("fetchChaptersByWorkId error:", error);
        return [];
    }
}

async function fetchChapterPages(chapterId) {
    try {
        const response = await fetch(`${API_URL}/chapters/${chapterId}/pages`);
        if (!response.ok) throw new Error('Error al obtener las imágenes del capítulo');
        return await response.json();
    } catch (error) {
        console.error("fetchChapterPages error:", error);
        return [];
    }
}
