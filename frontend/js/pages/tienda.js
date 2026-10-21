import { apiRequest, authRequest, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { escapeHTML } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';
import { renderShopSkeletons } from '../components/loader.js';

// Inicializar cabecera del sitio
const header = document.getElementById('header');
if (header) renderSiteHeader(header);

// Esqueletos del catálogo mientras llega la respuesta
const shopGrid = document.getElementById('shop-items-grid');
if (shopGrid) shopGrid.innerHTML = renderShopSkeletons(8);

let currentUser = null;
let shopItemsCache = [];
let currentFilter = 'all';

function setWalletFallback() {
  const walletCoinsVal = document.getElementById('wallet-coins-val');
  const walletUserTag = document.getElementById('shop-wallet-user-tag');
  const walletSubHint = document.getElementById('wallet-sub-hint');
  if (walletCoinsVal) walletCoinsVal.textContent = '0';
  if (walletUserTag) walletUserTag.textContent = 'Invitado';
  if (walletSubHint) walletSubHint.textContent = 'Inicia sesión para canjear fondos';
}

async function initUser() {
  const token = getAccessToken();
  const walletCoinsVal = document.getElementById('wallet-coins-val');
  const walletUserTag = document.getElementById('shop-wallet-user-tag');
  const walletSubHint = document.getElementById('wallet-sub-hint');
  const viewProfileBtn = document.getElementById('wallet-view-profile-btn');

  if (token) {
    try {
      currentUser = await authRequest('/me');
      if (currentUser) {
        if (walletCoinsVal) walletCoinsVal.textContent = (currentUser.coins || 0).toLocaleString();
        if (walletUserTag) walletUserTag.textContent = currentUser.username || 'Lector';
        if (walletSubHint) walletSubHint.textContent = `Nivel ${Math.floor((currentUser.xp || 0) / 1000) + 1} de Lector`;
        if (viewProfileBtn && currentUser.username) {
          viewProfileBtn.href = `/pages/usuario.html?id=${encodeURIComponent(currentUser.username)}`;
        }
      } else {
        setWalletFallback();
        if (viewProfileBtn) viewProfileBtn.href = '/pages/login.html';
      }
    } catch (e) {
      console.warn('No se pudo autenticar usuario en la tienda:', e);
      setWalletFallback();
      if (viewProfileBtn) viewProfileBtn.href = '/pages/login.html';
    }
  } else {
    setWalletFallback();
    if (viewProfileBtn) viewProfileBtn.href = '/pages/login.html';
  }
}

async function loadShopItems() {
  const grid = document.getElementById('shop-items-grid');
  try {
    shopItemsCache = await apiRequest('/shop/items');
    renderGrid();
  } catch (err) {
    console.error('Error al cargar items de la tienda:', err);
    const summaryLabel = document.getElementById('shop-summary-label');
    if (summaryLabel) summaryLabel.textContent = 'No se pudo cargar el catálogo';
    if (grid) {
      grid.innerHTML = `
        <div class="shop-empty-state">
          <h3 class="shop-empty-title">Error al conectar con la tienda</h3>
          <p class="shop-empty-desc">No se pudo obtener el catálogo de fondos. Intenta nuevamente más tarde.</p>
        </div>
      `;
    }
  }
}

const CATEGORY_NAMES = {
  FRAME: 'Marco de Anillo',
  BANNER: 'Banner de Fondo'
};

function renderGrid() {
  const grid = document.getElementById('shop-items-grid');
  const countBadge = document.getElementById('inventory-count-badge');
  const summaryLabel = document.getElementById('shop-summary-label');
  if (!grid) return;

  const ownedItems = shopItemsCache.filter(item => item.is_owned);
  if (countBadge) countBadge.textContent = ownedItems.length;

  const userLevel = currentUser ? (Math.floor((currentUser.xp || 0) / 1000) + 1) : 1;
  const userCoins = currentUser ? (currentUser.coins || 0) : 0;

  let itemsToDisplay = shopItemsCache;
  if (currentFilter === 'inventory') {
    itemsToDisplay = ownedItems;
    if (summaryLabel) summaryLabel.textContent = `Mostrando tu inventario (${ownedItems.length} objetos)`;
  } else if (currentFilter === 'FRAME') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'FRAME');
    if (summaryLabel) summaryLabel.textContent = `Mostrando marcos de anillo (${itemsToDisplay.length})`;
  } else if (currentFilter === 'BANNER') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'BANNER');
    if (summaryLabel) summaryLabel.textContent = `Mostrando banners de fondo (${itemsToDisplay.length})`;
  } else {
    if (summaryLabel) summaryLabel.textContent = `Mostrando todos los objetos (${shopItemsCache.length})`;
  }

  if (!itemsToDisplay.length) {
    grid.innerHTML = `
      <div class="shop-empty-state">
        <h3 class="shop-empty-title">${currentFilter === 'inventory' ? 'Tu inventario está vacío' : 'No hay artículos en esta categoría'}</h3>
        <p class="shop-empty-desc">${currentFilter === 'inventory' ? 'Explora la tienda y canjea tus Yume Coins para obtener objetos.' : 'Pronto añadiremos más cosméticos y objetos.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = itemsToDisplay.map(item => {
    const rarityClass = `shop-card-rarity--${(item.rarity || 'rare').toLowerCase()}`;
    const isEquipped = item.is_equipped;
    const isOwned = item.is_owned;
    const meetsLevel = userLevel >= item.required_level;
    const hasEnoughCoins = userCoins >= item.price_coins;
    const isFrame = item.category === 'FRAME';
    const categoryName = CATEGORY_NAMES[item.category] || item.category || 'Cosmético';

    let actionButtonHtml = '';

    if (!currentUser) {
      actionButtonHtml = `
        <a href="/pages/login.html" class="shop-btn shop-btn--buy">
          <img src="/assets/icons/svg/login.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Iniciar sesión para canjear</span>
        </a>
      `;
    } else if (isEquipped) {
      actionButtonHtml = `
        <button class="shop-btn shop-btn--equipped" disabled>
          <img src="/assets/icons/svg/check.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Equipado</span>
        </button>
      `;
    } else if (isOwned) {
      actionButtonHtml = `
        <button class="shop-btn shop-btn--equip" data-action="equip" data-id="${item.id}" data-category="${item.category}">
          <img src="/assets/icons/svg/bolt.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Equipar en Perfil</span>
        </button>
      `;
    } else if (!meetsLevel) {
      actionButtonHtml = `
        <button class="shop-btn shop-btn--disabled" disabled title="Sube de nivel leyendo más capítulos">
          <img src="/assets/icons/svg/lock.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Requiere Nv. ${item.required_level}</span>
        </button>
      `;
    } else if (!hasEnoughCoins) {
      const missingCoins = (item.price_coins - userCoins).toLocaleString();
      actionButtonHtml = `
        <button class="shop-btn shop-btn--disabled" disabled title="Gana monedas leyendo o en misiones diarias">
          <img src="/assets/icons/svg/warning.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Faltan ${missingCoins}</span>
          <img src="/assets/icons/svg/coin.svg" class="shop-btn-icon-inline" alt="" width="14" height="14" aria-hidden="true"/>
        </button>
      `;
    } else {
      actionButtonHtml = `
        <button class="shop-btn shop-btn--buy" data-action="buy" data-id="${item.id}" data-category="${item.category}">
          <img src="/assets/icons/svg/coin.svg" class="shop-btn-icon" alt="" width="15" height="15" aria-hidden="true"/>
          <span>Comprar por ${item.price_coins.toLocaleString()} Coins</span>
        </button>
      `;
    }

    const previewHtml = isFrame ? `
      <div class="shop-card-preview shop-card-preview--frame">
        <div class="shop-frame-sample-wrap">
          <div class="shop-frame-sample-avatar">
            <span class="shop-frame-sample-initials">Y</span>
          </div>
          <img src="${escapeHTML(item.preview_url)}" class="shop-frame-overlay-img" alt="${escapeHTML(item.name)}" loading="lazy"/>
        </div>
        <div class="shop-card-scrim"></div>
        <div class="shop-card-badges">
          <span class="shop-card-cat-badge">${escapeHTML(categoryName)}</span>
          <span class="shop-card-rarity ${rarityClass}">${escapeHTML(item.rarity || 'Raro')}</span>
        </div>
        <span class="shop-card-level-req">Nv. ${item.required_level}+</span>
      </div>
    ` : `
      <div class="shop-card-preview shop-card-preview--banner">
        <img src="${escapeHTML(item.preview_url)}" class="shop-card-preview-img" alt="${escapeHTML(item.name)}" loading="lazy"/>
        <div class="shop-card-scrim"></div>
        <div class="shop-card-badges">
          <span class="shop-card-cat-badge">${escapeHTML(categoryName)}</span>
          <span class="shop-card-rarity ${rarityClass}">${escapeHTML(item.rarity || 'Raro')}</span>
        </div>
        <span class="shop-card-level-req">Nv. ${item.required_level}+</span>
      </div>
    `;

    return `
      <article class="shop-card ${isEquipped ? 'shop-card--equipped' : ''}">
        ${previewHtml}
        <div class="shop-card-info">
          <div class="shop-card-name-row">
            <h3 class="shop-card-name">${escapeHTML(item.name)}</h3>
            <span class="shop-card-price">
              <img src="/assets/icons/svg/coin.svg" class="shop-card-coin-icon" alt="" width="16" height="16" aria-hidden="true"/>
              <span>${item.price_coins.toLocaleString()}</span>
            </span>
          </div>
          <p class="shop-card-desc">${escapeHTML(item.description || '')}</p>
          <div class="shop-card-footer">
            ${actionButtonHtml}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

let isProcessingAction = false;

function initEventHandlers() {
  // Pestañas
  const shopTabs = document.getElementById('shop-tabs');
  const tabBtns = shopTabs ? shopTabs.querySelectorAll('.shop-tab-btn') : [];
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.tab || 'all';
      renderGrid();
    });
  });

  // Delegación de compras y equipar
  const grid = document.getElementById('shop-items-grid');
  if (grid) {
    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (isProcessingAction) return;

      const action = btn.dataset.action;
      const itemId = parseInt(btn.dataset.id, 10);
      const itemCategory = btn.dataset.category;
      if (!itemId) return;

      isProcessingAction = true;

      if (action === 'buy') {
        try {
          btn.disabled = true;
          btn.textContent = 'Procesando compra...';

          const res = await apiRequest(`/shop/buy/${itemId}`, { method: 'POST' });
          showToast(res.message || '¡Artículo adquirido con éxito!', 'success');

          if (currentUser) currentUser.coins = res.new_coins;

          const walletCoinsVal = document.getElementById('wallet-coins-val');
          if (walletCoinsVal) walletCoinsVal.textContent = res.new_coins.toLocaleString();

          window.dispatchEvent(new CustomEvent('yume:coins-updated', { detail: { new_coins: res.new_coins } }));

          // Recargar usuario y catálogo fresco desde el servidor
          await initUser();
          await loadShopItems();
        } catch (err) {
          showToast(err.message || 'Error al procesar la compra', 'error');
          renderGrid();
        } finally {
          isProcessingAction = false;
        }
      } else if (action === 'equip') {
        try {
          btn.disabled = true;
          btn.textContent = 'Equipando en perfil...';

          const res = await apiRequest(`/shop/equip/${itemId}`, { method: 'POST' });
          showToast(res.message || '¡Artículo equipado con éxito!', 'success');

          const category = res.category || itemCategory;
          const previewUrl = res.preview_url;

          // Disparar evento para actualizar el header y el perfil inmediatamente
          if (currentUser) {
            if (category === 'FRAME') {
              currentUser.anillo_url = previewUrl;
              currentUser.avatar_frame_url = previewUrl;
            } else if (category === 'BANNER') {
              currentUser.banner_url = previewUrl;
            }
            try { localStorage.setItem('user', JSON.stringify(currentUser)); } catch {}
          }

          window.dispatchEvent(new CustomEvent('yume:cosmetics-updated', {
            detail: {
              anillo_url: res.anillo_url || (category === 'FRAME' ? previewUrl : undefined),
              avatar_frame_url: res.avatar_frame_url || (category === 'FRAME' ? previewUrl : undefined),
              banner_url: res.banner_url || (category === 'BANNER' ? previewUrl : undefined),
              category
            }
          }));

          // Recargar catálogo e inventario para reflejar el estado equipado exacto desde la BD
          await initUser();
          await loadShopItems();
        } catch (err) {
          showToast(err.message || 'Error al equipar el artículo', 'error');
          renderGrid();
        } finally {
          isProcessingAction = false;
        }
      } else {
        isProcessingAction = false;
      }
    });
  }
}

async function start() {
  initEventHandlers();
  await initUser();
  await loadShopItems();
}

start();
