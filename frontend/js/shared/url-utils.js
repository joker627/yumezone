const SAFE_URL_PATTERN = /^(?:https?:\/\/|\/(?!\/)|\.{1,2}\/|#)/i;

export function safeUrl(value, fallback = '#') {
    const url = String(value ?? '').trim();
    return SAFE_URL_PATTERN.test(url) ? url : fallback;
}
