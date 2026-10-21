import { GIPHY_ID } from '../api/api-config.js';

export function getChatPickerTemplate() {
  return `
    <div class="chat-picker-header">
      <span class="chat-picker-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        GIFs de Anime
      </span>
      <button type="button" class="chat-picker-close" id="chat-picker-close" aria-label="Cerrar selector">&times;</button>
    </div>

    <div class="chat-picker-panel is-active" id="chat-panel-gifs">
      <div class="chat-gif-search-wrap">
        <input type="text" class="chat-gif-search-input" id="chat-gif-search" placeholder="Buscar GIFs (ej: anime, luffy, dance)..." autocomplete="off" />
      </div>
      <div class="chat-gif-grid" id="chat-gif-grid">
        <p class="chat-online-empty">Cargando GIFs en vivo...</p>
      </div>
    </div>
  `;
}

export function initChatPicker({
  popoverEl,
  triggerGifBtn,
  onSelectGif
}) {
  if (!popoverEl) return null;

  const closeBtn = popoverEl.querySelector('#chat-picker-close');
  const gifSearch = popoverEl.querySelector('#chat-gif-search');
  const gifGrid = popoverEl.querySelector('#chat-gif-grid');

  let gifSearchTimer = null;
  let cachedGifs = null;
  let currentAbortController = null;

  async function searchGiphy(query = '') {
    if (!gifGrid) return;

    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    gifGrid.innerHTML = '<p class="chat-online-empty">Buscando GIFs en vivo...</p>';

    try {
      const clean = query.trim();
      const endpoint = clean
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_ID}&q=${encodeURIComponent(clean)}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_ID}&limit=24&rating=pg-13`;

      const res = await fetch(endpoint, { signal: currentAbortController.signal });
      const data = await res.json();
      const list = data?.data || [];

      if (!list.length) {
        gifGrid.innerHTML = '<p class="chat-online-empty">No se encontraron GIFs para esa búsqueda.</p>';
        return;
      }

      if (!clean) cachedGifs = list;

      gifGrid.innerHTML = list.map(g => {
        const preview = g.images?.fixed_height_small?.url || g.images?.downsized_medium?.url || g.images?.original?.url;
        const full = g.images?.downsized_medium?.url || g.images?.original?.url || preview;
        const title = (g.title || 'GIF').replace(/"/g, '&quot;');
        return `
          <button type="button" class="chat-gif-item" data-gif-url="${full}" title="${title}">
            <img src="${preview}" alt="${title}" loading="lazy" />
          </button>
        `;
      }).join('');
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Error fetching Giphy:', err);
      gifGrid.innerHTML = '<p class="chat-online-empty">No se pudo cargar la galería de GIFs.</p>';
    }
  }

  if (gifSearch) {
    gifSearch.addEventListener('input', (e) => {
      clearTimeout(gifSearchTimer);
      gifSearchTimer = setTimeout(() => {
        searchGiphy(e.target.value);
      }, 300);
    });
  }

  if (gifGrid) {
    gifGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-gif-item');
      if (!btn?.dataset.gifUrl) return;

      const gifUrl = btn.dataset.gifUrl;
      popoverEl.hidden = true;

      if (typeof onSelectGif === 'function') {
        onSelectGif(gifUrl);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      popoverEl.hidden = true;
    });
  }

  function toggle() {
    if (popoverEl.hidden) {
      popoverEl.hidden = false;
      if (!cachedGifs) {
        searchGiphy('');
      }
      setTimeout(() => gifSearch?.focus(), 50);
    } else {
      popoverEl.hidden = true;
    }
  }

  if (triggerGifBtn) {
    triggerGifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
  }

  document.addEventListener('click', (e) => {
    if (!popoverEl || popoverEl.hidden) return;
    if (!popoverEl.contains(e.target) &&
        (!triggerGifBtn || !triggerGifBtn.contains(e.target))) {
      popoverEl.hidden = true;
    }
  });

  return {
    toggle,
    searchGiphy
  };
}
