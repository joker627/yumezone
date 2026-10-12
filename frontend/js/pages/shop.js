import { apiRequest, authRequest, getAccessToken } from '../shared/auth.js';
import { renderSiteHeader } from '../components/header.js';
import { escapeHTML } from '../shared/ui-utils.js';
import { showToast } from '../shared/toast.js';

// Inicializar cabecera del sitio
const header = document.getElementById('header');
if (header) renderSiteHeader(header);

let currentUser = null;
let shopItemsCache = [];
let currentFilter = 'all';

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
      }
    } catch (e) {
      console.warn('No se pudo autenticar usuario en la tienda:', e);
    }
  } else {
    if (walletCoinsVal) walletCoinsVal.textContent = '0';
    if (walletUserTag) walletUserTag.textContent = 'Invitado';
    if (walletSubHint) walletSubHint.textContent = 'Inicia sesión para canjear fondos';
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
    if (grid) {
      grid.innerHTML = `
        <div class="shop-empty-state">
          <h3 style="color: #fff; margin-bottom: 0.5rem;">Error al conectar con la tienda</h3>
          <p style="color: var(--neutral-400); margin: 0;">No se pudo obtener el catálogo de fondos. Intenta nuevamente más tarde.</p>
        </div>
      `;
    }
  }
}

const CATEGORY_NAMES = {
  BANNER: 'Banner',
  FRAME: 'Marco',
  BADGE: 'Insignia',
  TITLE: 'Título',
  CONSUMABLE: 'Consumible'
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
  } else if (currentFilter === 'BANNER') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'BANNER');
    if (summaryLabel) summaryLabel.textContent = `Mostrando fondos y banners (${itemsToDisplay.length})`;
  } else if (currentFilter === 'FRAME') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'FRAME');
    if (summaryLabel) summaryLabel.textContent = `Mostrando marcos de avatar (${itemsToDisplay.length})`;
  } else if (currentFilter === 'BADGE_TITLE') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'BADGE' || i.category === 'TITLE');
    if (summaryLabel) summaryLabel.textContent = `Mostrando insignias y títulos (${itemsToDisplay.length})`;
  } else if (currentFilter === 'CONSUMABLE') {
    itemsToDisplay = shopItemsCache.filter(i => i.category === 'CONSUMABLE');
    if (summaryLabel) summaryLabel.textContent = `Mostrando consumibles y objetos (${itemsToDisplay.length})`;
  } else {
    if (summaryLabel) summaryLabel.textContent = `Mostrando todos los objetos (${shopItemsCache.length})`;
  }

  if (!itemsToDisplay.length) {
    grid.innerHTML = `
      <div class="shop-empty-state">
        <h3 style="color: #fff; margin-bottom: 0.5rem;">${currentFilter === 'inventory' ? 'Tu inventario está vacío' : 'No hay artículos en esta categoría'}</h3>
        <p style="color: var(--neutral-400); margin: 0;">${currentFilter === 'inventory' ? 'Explora la tienda y canjea tus Yume Coins para obtener objetos.' : 'Pronto añadiremos más cosméticos y objetos.'}</p>
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
    const isBanner = item.category === 'BANNER';
    const categoryName = CATEGORY_NAMES[item.category] || item.category || 'Objeto';

    let actionButtonHtml = '';

    if (!currentUser) {
      actionButtonHtml = `<a href="/pages/login.html" class="shop-btn shop-btn--buy" style="text-decoration: none;">Inicia sesión para canjear</a>`;
    } else if (isEquipped) {
      actionButtonHtml = `<button class="shop-btn shop-btn--equipped" disabled>✓ Equipado</button>`;
    } else if (isOwned) {
      if (item.category === 'CONSUMABLE') {
        actionButtonHtml = `<button class="shop-btn shop-btn--equipped" disabled>✓ En Tu Inventario</button>`;
      } else {
        actionButtonHtml = `<button class="shop-btn shop-btn--equip" data-action="equip" data-id="${item.id}" data-category="${item.category}">⚡ Equipar en Perfil</button>`;
      }
    } else if (!meetsLevel) {
      actionButtonHtml = `<button class="shop-btn shop-btn--disabled" disabled title="Sube de nivel leyendo más capítulos">🔒 Requiere Nv. ${item.required_level}</button>`;
    } else if (!hasEnoughCoins) {
      actionButtonHtml = `<button class="shop-btn shop-btn--disabled" disabled title="Gana monedas leyendo o en misiones diarias">⚠️ Faltan ${(item.price_coins - userCoins).toLocaleString()} 🪙</button>`;
    } else {
      actionButtonHtml = `<button class="shop-btn shop-btn--buy" data-action="buy" data-id="${item.id}">🪙 Comprar por ${item.price_coins} Coins</button>`;
    }

    return `
      <article class="shop-card ${isEquipped ? 'shop-card--equipped' : ''}">
        <div class="shop-card-preview ${isBanner ? '' : 'shop-card-preview--contain'}" style="background-image: url('${escapeHTML(item.preview_url)}')">
          <div class="shop-card-scrim"></div>
          <div class="shop-card-badges">
            <span class="shop-card-cat-badge">${escapeHTML(categoryName)}</span>
            <span class="shop-card-rarity ${rarityClass}">${escapeHTML(item.rarity || 'Raro')}</span>
          </div>
          <span class="shop-card-level-req">Nv. ${item.required_level}+</span>
        </div>
        <div class="shop-card-info">
          <div class="shop-card-name-row">
            <h3 class="shop-card-name">${escapeHTML(item.name)}</h3>
            <span class="shop-card-price">🪙 ${item.price_coins}</span>
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
      const action = btn.dataset.action;
      const itemId = parseInt(btn.dataset.id, 10);
      const itemCategory = btn.dataset.category;
      if (!itemId) return;

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

          const targetItem = shopItemsCache.find(i => i.id === itemId);
          if (targetItem) targetItem.is_owned = true;

          renderGrid();
        } catch (err) {
          showToast(err.message || 'Error al procesar la compra', 'error');
          renderGrid();
        }
      } else if (action === 'equip') {
        try {
          btn.disabled = true;
          btn.textContent = 'Equipando en perfil...';

          const res = await apiRequest(`/shop/equip/${itemId}`, { method: 'POST' });
          showToast(res.message || '¡Artículo equipado con éxito!', 'success');

          shopItemsCache.forEach(i => {
            if (i.category === itemCategory) {
              i.is_equipped = (i.id === itemId);
            }
          });

          renderGrid();
        } catch (err) {
          showToast(err.message || 'Error al equipar el artículo', 'error');
          renderGrid();
        }
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
