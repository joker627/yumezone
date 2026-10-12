const SAFE_URL_PATTERN = /^(?:https?:\/\/|\/(?!\/)|\.|#)/i;

export const IMG_FALLBACK = '/assets/up-image.jpg';

export function safeUrl(value, fallback = '#') {
    const url = String(value ?? '').trim();
    return SAFE_URL_PATTERN.test(url) ? url : fallback;
}

if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
        if (e.target?.tagName === 'IMG' && !e.target.src.includes(IMG_FALLBACK)) {
            e.target.src = IMG_FALLBACK;
        }
    }, true);
}
