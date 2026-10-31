/**
 * menu.js - Customer Interactive Menu
 * Features:
 * - 3D procedural food models with interactive ingredient indicators
 * - AR Mode (real camera table projection)
 * - Live search & dietary filter chips
 * - Direct WhatsApp ordering with item customization notes
 * - Call Waiter & Request Bill WhatsApp triggers
 * - Share table link with group/companions
 * - Procedural Web Audio sounds & confetti celebration
 */

import {
  getMenuItems, getConfig, getImage,
  getCart, addToCart, updateCartQuantity, updateCartItemNote, clearCart, getCartTotal,
  saveOrder, seedDemoData, listenForSync,
  initialSyncFromServer, syncMenuFromServer, syncImageFromServer,
} from './storage.js';
import {
  initViewer, loadFoodItem, destroyViewer,
  toggleAutoRotate, resetCamera, zoomIn, zoomOut,
  toggleViewerMode, toggleHotspots, toggleExplodedView,
  setExplodeCallback, focusOnIngredient,
  openARView, closeARView, captureARScreenshot, setARScale,
  setViewerTheme
} from './viewer3d.js';
import { getLang, setLanguage, initLanguage, t } from './i18n.js';
import { showToast } from './toast.js';
import { playCartSound, playClickSound, playCelebrationSound } from './audio.js';
import { triggerConfetti } from './confetti.js';

let currentCategory = 'all';
let currentDietFilter = 'all';
let currentSearchQuery = '';
let currentViewerItem = null;
let currentTable = '1';
let currentTheme = localStorage.getItem('menu3d_theme') || 'dark';

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('menu3d_theme', theme);
  const btn = document.getElementById('btn-theme-toggle');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (btn) btn.textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (btn) btn.textContent = '🌙';
  }
  setViewerTheme(theme);
}

function toggleLanguage() {
  const next = getLang() === 'es' ? 'en' : 'es';
  applyLanguage(next);
  showToast(next === 'en' ? 'Language: English 🇺🇸' : 'Idioma: Español 🇪🇸', 'info');
}

function applyLanguage(lang) {
  setLanguage(lang);
  const btn = document.getElementById('btn-lang-toggle');
  if (btn) btn.textContent = lang === 'es' ? '🇺🇸 EN' : '🇪🇸 ES';

  const sub = document.getElementById('menu-subtitle');
  if (sub) sub.textContent = t('menuSubtitle');

  const title = document.getElementById('menu-title');
  if (title) title.textContent = `${t('table')} ${currentTable}`;

  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');

  const shareBtn = document.getElementById('btn-share-table');
  if (shareBtn) shareBtn.innerHTML = t('share');

  const waiterBtn = document.getElementById('btn-call-waiter-nav');
  if (waiterBtn) waiterBtn.innerHTML = t('waiter');

  // Update dietary chips
  const filterMap = {
    all: t('filterAll'),
    popular: t('filterPopular'),
    meat: t('filterMeat'),
    veg: t('filterVeg'),
    'gluten-free': t('filterGlutenFree'),
    spicy: t('filterSpicy'),
    drink: t('filterDrink'),
    sweet: t('filterSweet'),
  };
  document.querySelectorAll('#dietary-chips .diet-chip').forEach(ch => {
    const f = ch.dataset.filter;
    if (filterMap[f]) ch.textContent = filterMap[f];
  });

  buildCategoryTabs(getConfig().categories);
  renderMenuGrid();
  renderCart();

  // Translate FAB assistance menu labels
  const fabWaiterLabel = document.querySelector('#fab-call-waiter div div:first-child');
  const fabWaiterSub = document.querySelector('#fab-call-waiter div div:last-child');
  const fabBillLabel = document.querySelector('#fab-request-bill div div:first-child');
  const fabBillSub = document.querySelector('#fab-request-bill div div:last-child');
  const fabShareLabel = document.querySelector('#fab-share-table div div:first-child');
  const fabShareSub = document.querySelector('#fab-share-table div div:last-child');
  if (fabWaiterLabel) fabWaiterLabel.textContent = t('fabCallWaiter');
  if (fabWaiterSub) fabWaiterSub.textContent = t('fabCallWaiterSub');
  if (fabBillLabel) fabBillLabel.textContent = t('fabRequestBill');
  if (fabBillSub) fabBillSub.textContent = t('fabRequestBillSub');
  if (fabShareLabel) fabShareLabel.textContent = t('fabShareTable');
  if (fabShareSub) fabShareSub.textContent = t('fabShareTableSub');

  // Translate cart sidebar header
  const cartHeaderH3 = document.querySelector('.cart-header h3');
  if (cartHeaderH3) cartHeaderH3.textContent = t('yourOrder');

  // Translate static cart summary labels (IDs added in HTML)
  const labelSubtotal = document.getElementById('cart-label-subtotal');
  const labelTax = document.getElementById('cart-label-tax');
  const labelTotal = document.getElementById('cart-label-total');
  const labelNotes = document.getElementById('cart-label-notes');
  if (labelSubtotal) labelSubtotal.textContent = t('subtotal');
  if (labelTax) labelTax.textContent = t('tax');
  if (labelTotal) labelTotal.textContent = t('total');
  if (labelNotes) labelNotes.textContent = t('orderNotes');
  const noteTA = document.getElementById('order-general-note');
  if (noteTA) noteTA.placeholder = t('orderNotesPlaceholder');
  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) placeBtn.textContent = t('orderWhatsAppBtn');

  // Update mobile cart label text (preserve count/total spans)
  const mobileCartBtnEl = document.getElementById('mobile-cart-btn');
  if (mobileCartBtnEl) {
    const countEl = document.getElementById('mobile-cart-count');
    const totalEl = document.getElementById('mobile-cart-total');
    const cnt = countEl?.textContent || '0';
    const tot = totalEl?.textContent || '$0';
    mobileCartBtnEl.innerHTML = `🛒 ${t('viewOrderMobile')} (<span id="mobile-cart-count">${cnt}</span>) — <span id="mobile-cart-total">${tot}</span>`;
  }

  // Update ingredient bar title if viewer is open
  const ingBarTitle = document.getElementById('viewer-ingredients-bar-title');
  if (ingBarTitle) ingBarTitle.textContent = t('interactiveIngredients');
}

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', async () => {
  await seedDemoData();

  // Cross-device sync: pull latest menu and config from server
  try {
    await initialSyncFromServer();
  } catch (err) {
    console.warn('Initial server sync failed, using cached local data:', err);
  }

  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || '1';
  currentTable = table;
  const restaurant = params.get('restaurant');
  const config = getConfig();

  // Initialize theme & language
  initLanguage();
  applyTheme(currentTheme);
  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) langBtn.textContent = getLang() === 'es' ? '🇺🇸 EN' : '🇪🇸 ES';

  // Set restaurant name
  const navName = document.getElementById('nav-restaurant-name');
  if (navName && restaurant) {
    navName.innerHTML = `<span class="text-gradient">${decodeURIComponent(restaurant)}</span>`;
  } else if (navName && config.restaurantName) {
    navName.innerHTML = `<span class="text-gradient">${config.restaurantName}</span>`;
  }

  // Set table badge
  const badge = document.getElementById('nav-table-badge');
  if (badge) {
    badge.textContent = `${t('table')} ${table}`;
    badge.style.display = 'flex';
    badge.title = `${t('table')} ${table}`;
  }
  const title = document.getElementById('menu-title');
  if (title) title.textContent = `${t('table')} ${table}`;

  // Friendly mobile welcome toast when scanned
  const welcomeMsg = getLang() === 'en'
    ? `📍 Welcome to Table ${table}! Tap any dish to explore in 3D`
    : `📍 ¡Bienvenido a la Mesa ${table}! Toca cualquier platillo para interactuar en 3D ✨`;
  setTimeout(() => showToast(welcomeMsg, 'info'), 700);

  // Build category tabs
  buildCategoryTabs(config.categories);

  // Setup search & dietary chips
  setupSearchAndFilters();

  // Load menu items
  renderMenuGrid();

  // Render cart
  renderCart();

  // Setup Assistance FAB and Waiter / Bill triggers
  setupAssistanceFAB();

  // Event listeners
  setupEventListeners();

  // Same-device real-time sync
  listenForSync((data) => {
    if (data.type === 'menu-update') {
      renderMenuGrid();
      showToast('El menú ha sido actualizado por el restaurante', 'info');
    }
  });

  // Cross-device server polling (every 8 seconds) so mobile phones see newly added admin products
  let lastKnownCount = getMenuItems().length;
  setInterval(async () => {
    try {
      const updated = await syncMenuFromServer();
      if (updated && Array.isArray(updated) && updated.length !== lastKnownCount) {
        lastKnownCount = updated.length;
        renderMenuGrid();
        showToast('Nuevos platillos disponibles en el menú ✨', 'info');
      }
    } catch (e) {
      // Quiet fail if offline
    }
  }, 8000);
});

// ---- Category Tabs ----
function buildCategoryTabs(categories) {
  const container = document.getElementById('category-tabs');
  if (!container || !categories) return;

  container.innerHTML = `<button class="category-tab ${currentCategory === 'all' ? 'active' : ''}" data-category="all">${t('catAll')}</button>`;

  const catTrans = {
    entradas: t('catEntradas'),
    principales: t('catPrincipales'),
    postres: t('catPostres'),
    bebidas: t('catBebidas'),
    cocteles: t('catCocteles'),
    especiales: t('catEspeciales'),
  };

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-tab ${currentCategory === cat.id ? 'active' : ''}`;
    btn.dataset.category = cat.id;
    btn.textContent = catTrans[cat.id] || cat.name;
    btn.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = cat.id;
      renderMenuGrid();
    });
    container.appendChild(btn);
  });

  const allTab = container.querySelector('[data-category="all"]');
  allTab?.addEventListener('click', () => {
    playClickSound();
    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
    allTab.classList.add('active');
    currentCategory = 'all';
    renderMenuGrid();
  });
}

// ---- Search & Dietary Filters ----
function setupSearchAndFilters() {
  const searchInput = document.getElementById('menu-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  searchInput?.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = currentSearchQuery ? 'block' : 'none';
    renderMenuGrid();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearchQuery = '';
    clearBtn.style.display = 'none';
    renderMenuGrid();
  });

  // Dietary Chips
  const chips = document.querySelectorAll('#dietary-chips .diet-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      playClickSound();
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentDietFilter = chip.dataset.filter;
      renderMenuGrid();
    });
  });
}

// ---- Menu Grid Rendering ----
async function renderMenuGrid() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  let items = getMenuItems().filter(i => i.status === 'approved');

  // Filter by category
  if (currentCategory !== 'all') {
    items = items.filter(i => i.category === currentCategory);
  }

  // Filter by search query
  if (currentSearchQuery) {
    items = items.filter(i => {
      const matchName = i.name.toLowerCase().includes(currentSearchQuery);
      const matchNameEn = (i.nameEn || '').toLowerCase().includes(currentSearchQuery);
      const matchDesc = (i.description || '').toLowerCase().includes(currentSearchQuery);
      const matchDescEn = (i.descEn || '').toLowerCase().includes(currentSearchQuery);
      const matchIngr = (i.ingredients || []).some(ing =>
        ing.name.toLowerCase().includes(currentSearchQuery) || (ing.desc || '').toLowerCase().includes(currentSearchQuery)
      );
      return matchName || matchNameEn || matchDesc || matchDescEn || matchIngr;
    });
  }

  // Filter by dietary chips
  if (currentDietFilter === 'popular') {
    items = items.filter(i => ['demo_1', 'demo_burger', 'demo_7', 'demo_pizza'].includes(i.id) || (i.tags || []).includes('popular'));
  } else if (currentDietFilter === 'meat') {
    items = items.filter(i => ['principales', 'especiales'].includes(i.category) || ['tacos', 'burger', 'ribeye'].includes(i.modelType));
  } else if (currentDietFilter === 'veg') {
    items = items.filter(i => ['entradas', 'salad', 'guacamole'].includes(i.category) || ['salad', 'guacamole'].includes(i.modelType) || (i.tags || []).includes('veg'));
  } else if (currentDietFilter === 'gluten-free') {
    items = items.filter(i => (i.tags || []).includes('gluten-free') || ['tacos', 'salad', 'guacamole', 'cocktail', 'drink', 'ribeye'].includes(i.modelType));
  } else if (currentDietFilter === 'spicy') {
    items = items.filter(i => (i.tags || []).includes('spicy') || ['tacos'].includes(i.modelType));
  } else if (currentDietFilter === 'drink') {
    items = items.filter(i => ['bebidas', 'cocteles'].includes(i.category));
  } else if (currentDietFilter === 'sweet') {
    items = items.filter(i => i.category === 'postres');
  }

  const lang = getLang();

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h3>${lang === 'en' ? 'No dishes found' : 'No encontramos platillos'}</h3>
        <p class="text-muted">${lang === 'en' ? 'Try another search term or filter category.' : 'Prueba con otro término de búsqueda o categoría.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  const config = getConfig();

  // Load all dish images in parallel (lightning fast on iPhone & Android)
  const imageResults = await Promise.all(items.map(it => getImage(it.id)));

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'menu-item-card';
    card.dataset.itemId = item.id;

    const itemName = (lang === 'en' && item.nameEn) ? item.nameEn : item.name;
    const itemDesc = (lang === 'en' && item.descEn) ? item.descEn : (item.description || '');

    const imgData = imageResults[index];
    const emojis = {
      tacos: '🌮', burger: '🍔', pizza: '🍕', ribeye: '🥩',
      salad: '🥗', drink: '🥤', cocktail: '🍹', dessert: '🍮',
      salmon: '🐟', guacamole: '🥑'
    };

    let imageHtml = '';
    if (imgData) {
      imageHtml = `<img src="${imgData}" alt="${itemName}" loading="lazy" decoding="async" />`;
    } else {
      imageHtml = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;background:var(--color-bg-tertiary);">${emojis[item.modelType] || '🍽️'}</div>`;
    }

    // Calorie badge & allergen pills
    const calText = item.calories ? `🔥 ${item.calories} kcal` : '';
    let tagsHtml = `<div class="item-badge-row">`;
    if (calText) tagsHtml += `<span class="item-badge-pill calorie">${calText}</span>`;
    if ((item.tags || []).includes('spicy') || item.modelType === 'tacos') {
      tagsHtml += `<span class="item-badge-pill spicy">🌶️ ${t('tagSpicy')}</span>`;
    }
    if ((item.tags || []).includes('gluten-free') || ['tacos', 'salad', 'guacamole', 'ribeye'].includes(item.modelType)) {
      tagsHtml += `<span class="item-badge-pill gluten-free">🌾 ${t('tagGlutenFree')}</span>`;
    }
    if ((item.tags || []).includes('veg') || ['salad', 'guacamole', 'dessert'].includes(item.modelType)) {
      tagsHtml += `<span class="item-badge-pill veg">🌱 ${t('tagVegan')}</span>`;
    }
    tagsHtml += `</div>`;

    // Ingredients badges summary
    const ingrSummary = (item.ingredients || []).slice(0, 3).map(ing => `<span>${ing.icon || '•'} ${ing.name}</span>`).join(' · ');

    card.innerHTML = `
      <div class="menu-item-image">
        ${imageHtml}
        <div class="menu-item-badge-3d">
          🎮 3D Interactivo
        </div>
      </div>
      <div class="menu-item-info">
        <div class="menu-item-name">${itemName}</div>
        <div class="menu-item-desc">${itemDesc}</div>
        ${tagsHtml}
        ${ingrSummary ? `<div style="font-size:0.72rem; color:var(--color-primary-light); margin-top:6px; opacity:0.85;">${ingrSummary}</div>` : ''}
      </div>
      <div class="menu-item-footer">
        <span class="menu-item-price">${config.currency}${item.price.toFixed(2)}</span>
        <button class="btn-add-cart" data-add-id="${item.id}" title="${t('addToCart')}">+</button>
      </div>
    `;

    // Click on card opens 3D interactive viewer
    card.querySelector('.menu-item-image')?.addEventListener('click', () => {
      playClickSound();
      openViewer(item);
    });

    // Add to cart button
    card.querySelector('.btn-add-cart')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAddToCart(item);
    });

    grid.appendChild(card);
  });
}

// ---- Cart Handling ----
function handleAddToCart(item) {
  playCartSound();
  addToCart({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    modelType: item.modelType,
    note: '',
  });

  renderCart();
  showToast(`${item.name} agregado al pedido`, 'success');

  // Haptic feedback for mobile phones
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }

  // Pulse animation on card button and mobile cart pill
  const btn = document.querySelector(`[data-add-id="${item.id}"]`);
  if (btn) {
    btn.style.transform = 'scale(1.35)';
    btn.style.background = 'var(--color-success)';
    setTimeout(() => {
      btn.style.transform = '';
      btn.style.background = '';
    }, 250);
  }

  const mobCart = document.getElementById('mobile-cart-btn');
  if (mobCart) {
    mobCart.style.transform = 'scale(1.05)';
    setTimeout(() => { mobCart.style.transform = ''; }, 200);
  }
}

async function renderCart() {
  const cart = getCart();
  const config = getConfig();
  const cartItemsEl = document.getElementById('cart-items');
  const cartSummaryEl = document.getElementById('cart-summary');
  const cartCountEl = document.getElementById('cart-count');
  const navCartCount = document.getElementById('nav-cart-count');
  const mobileCartBtn = document.getElementById('mobile-cart-btn');
  const mobileCartCount = document.getElementById('mobile-cart-count');
  const mobileCartTotal = document.getElementById('mobile-cart-total');

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  if (cartCountEl) cartCountEl.textContent = totalItems;
  if (navCartCount) navCartCount.textContent = totalItems;
  if (mobileCartCount) mobileCartCount.textContent = totalItems;

  if (mobileCartBtn) {
    mobileCartBtn.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  if (cart.length === 0) {
    if (cartItemsEl) {
      cartItemsEl.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛒</div>
          <p>${t('cartEmpty')}</p>
          <p style="font-size: 0.75rem; margin-top: 4px;">${t('cartEmptySub')}</p>
        </div>
      `;
    }
    if (cartSummaryEl) cartSummaryEl.style.display = 'none';
    return;
  }

  if (cartItemsEl) {
    cartItemsEl.innerHTML = '';
    for (const item of cart) {
      const imgData = await getImage(item.id);
      const imgSrc = imgData || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect fill="%231a1a1a" width="56" height="56" rx="8"/><text x="28" y="36" text-anchor="middle" font-size="24">🍽️</text></svg>';

      const div = document.createElement('div');
      div.className = 'cart-item';
      div.style.flexDirection = 'column';
      div.style.alignItems = 'stretch';

      div.innerHTML = `
        <div class="flex items-center gap-sm w-full">
          <img class="cart-item-img" src="${imgSrc}" alt="${item.name}" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${config.currency}${(item.price * item.quantity).toFixed(2)}</div>
            <div class="cart-qty-controls">
              <button class="cart-qty-btn" data-qty-action="decrease" data-item-id="${item.id}">−</button>
              <span class="cart-qty">${item.quantity}</span>
              <button class="cart-qty-btn" data-qty-action="increase" data-item-id="${item.id}">+</button>
            </div>
          </div>
        </div>

        <!-- Customization note per item -->
        <div class="cart-item-note-row">
          <button class="cart-item-note-btn" data-toggle-note="${item.id}">
            📝 ${item.note ? `${t('noteForKitchen').replace('...', '')}: "${item.note}"` : t('addNote')}
          </button>
          <input
            type="text"
            class="cart-item-note-input"
            id="note-input-${item.id}"
            placeholder="${t('noteForKitchen')}"
            value="${item.note || ''}"
            style="display: ${item.note ? 'block' : 'none'};"
          />
        </div>
      `;

      // Note toggle and change listeners
      const noteBtn = div.querySelector(`[data-toggle-note="${item.id}"]`);
      const noteInput = div.querySelector(`#note-input-${item.id}`);

      noteBtn?.addEventListener('click', () => {
        const isHidden = noteInput.style.display === 'none';
        noteInput.style.display = isHidden ? 'block' : 'none';
        if (isHidden) noteInput.focus();
      });

      noteInput?.addEventListener('change', (e) => {
        const text = e.target.value.trim();
        updateCartItemNote(item.id, text);
        noteBtn.textContent = text ? `📝 ${t('noteForKitchen').replace('...', '')}: "${text}"` : t('addNote');
        showToast('Nota de platillo guardada', 'info');
      });

      cartItemsEl.appendChild(div);
    }

    // Quantity controls
    cartItemsEl.querySelectorAll('[data-qty-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        playClickSound();
        const id = btn.dataset.itemId;
        const action = btn.dataset.qtyAction;
        const cartItem = cart.find(c => c.id === id);
        if (!cartItem) return;

        const newQty = action === 'increase' ? cartItem.quantity + 1 : cartItem.quantity - 1;
        updateCartQuantity(id, newQty);
        renderCart();
      });
    });
  }

  // Summary
  if (cartSummaryEl) {
    const subtotal = getCartTotal(cart);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').textContent = `${config.currency}${subtotal.toFixed(2)}`;
    document.getElementById('cart-tax').textContent = `${config.currency}${tax.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `${config.currency}${total.toFixed(2)}`;

    if (mobileCartTotal) mobileCartTotal.textContent = `${config.currency}${total.toFixed(2)}`;

    // Sync translated labels (IDs on static HTML elements)
    const lbSub = document.getElementById('cart-label-subtotal');
    const lbTax = document.getElementById('cart-label-tax');
    const lbTot = document.getElementById('cart-label-total');
    const lbNotes = document.getElementById('cart-label-notes');
    if (lbSub) lbSub.textContent = t('subtotal');
    if (lbTax) lbTax.textContent = t('tax');
    if (lbTot) lbTot.textContent = t('total');
    if (lbNotes) lbNotes.textContent = t('orderNotes');
    const noteTa = document.getElementById('order-general-note');
    if (noteTa) noteTa.placeholder = t('orderNotesPlaceholder');
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) placeOrderBtn.textContent = t('orderWhatsAppBtn');

    cartSummaryEl.style.display = 'block';
  }
}

// ---- 3D Interactive Viewer ----
async function openViewer(item) {
  const modal = document.getElementById('viewer-modal');
  const canvas = document.getElementById('viewer-canvas');
  if (!modal || !canvas) return;

  currentViewerItem = item;
  const config = getConfig();
  const lang = getLang();

  const itemName = (lang === 'en' && item.nameEn) ? item.nameEn : item.name;
  const itemDesc = (lang === 'en' && item.descEn) ? item.descEn : (item.description || '');

  document.getElementById('viewer-title').textContent = itemName;
  document.getElementById('viewer-item-name').textContent = itemName;
  document.getElementById('viewer-item-desc').textContent = itemDesc;
  document.getElementById('viewer-item-price').textContent = `${config.currency}${item.price.toFixed(2)}`;

  // Meta calories & prep time
  const calEl = document.getElementById('viewer-calories');
  if (calEl) calEl.textContent = `🔥 ${item.calories || 450} kcal`;

  const prepEl = document.getElementById('viewer-prep-time');
  if (prepEl) prepEl.textContent = `⏱️ ${item.prepTime || '15 min'}`;

  // Tags
  const tagsContainer = document.getElementById('viewer-tags-container');
  if (tagsContainer) {
    tagsContainer.innerHTML = '';
    (item.tags || []).forEach(tg => {
      const span = document.createElement('span');
      span.className = `item-badge-pill ${tg}`;
      if (tg === 'spicy') span.textContent = '🌶️ ' + t('tagSpicy');
      else if (tg === 'gluten-free') span.textContent = '🌾 ' + t('tagGlutenFree');
      else if (tg === 'veg') span.textContent = '🌱 ' + t('tagVegan');
      else if (tg === 'popular') span.textContent = '⭐ ' + t('tagPopular');
      else span.textContent = tg;
      tagsContainer.appendChild(span);
    });
  }

  // Update button texts
  const explodeBtn = document.getElementById('btn-toggle-explode');
  if (explodeBtn) {
    explodeBtn.textContent = t('btnExplode');
    explodeBtn.classList.remove('active');
  }

  const hotspotsBtn = document.getElementById('btn-toggle-hotspots');
  if (hotspotsBtn) hotspotsBtn.textContent = t('btnIndicators');

  const arBtn = document.getElementById('btn-ar-view');
  if (arBtn) arBtn.textContent = t('btnAR');

  const addCartBtn = document.getElementById('viewer-add-cart');
  if (addCartBtn) addCartBtn.textContent = t('addToCart');

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Update ingredient bar title
  const ingBarTitle = document.getElementById('viewer-ingredients-bar-title');
  if (ingBarTitle) ingBarTitle.textContent = t('interactiveIngredients');

  const hint = document.getElementById('viewer-hint');
  if (hint) {
    hint.innerHTML = `<span class="icon">👆</span> ${t('viewerHint')}`;
    hint.style.animation = 'none';
    hint.style.opacity = '1';
    void hint.offsetHeight;
    hint.style.animation = 'fadeOut 3s ease forwards';
    hint.style.animationDelay = '2.5s';
  }

  const canvasChildren = canvas.querySelectorAll('canvas');
  canvasChildren.forEach(c => c.remove());

  initViewer(canvas);
  setViewerTheme(currentTheme);

  const imgData = await getImage(item.id);
  try {
    await loadFoodItem(item, imgData);
  } catch (err) {
    console.error('Error cargando modelo 3D:', err);
  }
}

function closeViewer() {
  const modal = document.getElementById('viewer-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  destroyViewer();
  currentViewerItem = null;
}

// ---- Augmented Reality (AR) Mode ----
async function startAR() {
  if (!currentViewerItem) return;
  playClickSound();

  const arModal = document.getElementById('ar-modal');
  const videoFeed = document.getElementById('ar-video');
  const arCanvasContainer = document.getElementById('ar-canvas-container');
  const dishNameEl = document.getElementById('ar-dish-name');
  const statusTextEl = document.getElementById('ar-status-text');
  const statusIconEl = document.getElementById('ar-status-icon');

  if (!arModal || !videoFeed || !arCanvasContainer) return;

  if (dishNameEl) dishNameEl.textContent = currentViewerItem.name;
  arModal.classList.add('active');

  try {
    const res = await openARView(currentViewerItem, videoFeed, arCanvasContainer);
    if (res && res.cameraActive) {
      if (statusIconEl) statusIconEl.textContent = '📸';
      if (statusTextEl) statusTextEl.textContent = 'Cámara Real (Mesa)';
      showToast('Cámara activa: proyectando sobre tu mesa física ✨', 'success');
    } else {
      if (statusIconEl) statusIconEl.textContent = '🍽️';
      if (statusTextEl) statusTextEl.textContent = 'Mesa de Restaurante (AR)';
      showToast('Proyectado sobre mesa de restaurante. En celular con HTTPS activa tu cámara real 📱', 'info');
    }
  } catch (err) {
    console.error('AR error:', err);
    if (statusIconEl) statusIconEl.textContent = '🍽️';
    if (statusTextEl) statusTextEl.textContent = 'Mesa Virtual';
    showToast('Modo Mesa AR activo', 'info');
  }
}

function stopAR() {
  playClickSound();
  const arModal = document.getElementById('ar-modal');
  if (arModal) arModal.classList.remove('active');
  closeARView();
}

// ---- Orders & WhatsApp Integration ----
function placeOrder() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Tu carrito está vacío', 'warning');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || '1';
  const restaurantParam = params.get('restaurant');
  const config = getConfig();
  const restaurantName = restaurantParam ? decodeURIComponent(restaurantParam) : (config.restaurantName || 'Mi Restaurante');

  const subtotal = getCartTotal(cart);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  const generalNote = document.getElementById('order-general-note')?.value.trim() || '';

  const order = saveOrder({
    table,
    items: cart.map(c => ({
      id: c.id,
      name: c.name,
      price: c.price,
      quantity: c.quantity,
      note: c.note || '',
    })),
    subtotal,
    tax,
    total,
    notes: generalNote,
  });

  // Prepare WhatsApp message
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let waText = `🍽️ *NUEVO PEDIDO - ${restaurantName.toUpperCase()}*\n`;
  waText += `━━━━━━━━━━━━━━━━━━━━\n`;
  waText += `📍 *Mesa:* Mesa ${table}\n`;
  waText += `🆔 *No. Pedido:* ${order.orderNumber}\n`;
  waText += `🕒 *Hora:* ${timeStr}\n`;
  waText += `━━━━━━━━━━━━━━━━━━━━\n`;
  waText += `🛒 *DETALLE DEL PEDIDO:*\n`;

  order.items.forEach(it => {
    waText += `• *${it.quantity}x* ${it.name} — ${config.currency}${(it.price * it.quantity).toFixed(2)}\n`;
    if (it.note) {
      waText += `  ↳ 📝 _Nota: ${it.note}_\n`;
    }
  });

  if (generalNote) {
    waText += `━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `📌 *Nota General:* ${generalNote}\n`;
  }

  waText += `━━━━━━━━━━━━━━━━━━━━\n`;
  waText += `💵 *Subtotal:* ${config.currency}${subtotal.toFixed(2)}\n`;
  waText += `🧾 *IVA (16%):* ${config.currency}${tax.toFixed(2)}\n`;
  waText += `💰 *TOTAL A PAGAR:* ${config.currency}${total.toFixed(2)}\n`;
  waText += `━━━━━━━━━━━━━━━━━━━━\n`;
  waText += `✅ _Pedido enviado desde el Menú Digital 3D_\n`;
  waText += `👉 ¡Hola! Acabo de hacer este pedido desde mi mesa. Por favor confírmame la recepción.`;

  let phone = (config.whatsappNumber || '3146841042').replace(/\D/g, '');
  if (phone.length === 10) phone = '57' + phone;

  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(waText)}`;

  // Update order modal
  const modal = document.getElementById('order-modal');
  const orderNumEl = document.getElementById('order-number');
  const waBtn = document.getElementById('order-whatsapp-btn');

  if (orderNumEl) orderNumEl.textContent = order.orderNumber;
  if (waBtn) waBtn.href = waUrl;

  modal?.classList.add('active');

  // Trigger sound celebration and confetti
  playCelebrationSound();
  triggerConfetti();

  // Attempt automatic open to WhatsApp
  try {
    window.open(waUrl, '_blank');
  } catch (e) {
    console.warn('Auto popup WhatsApp bloqueado, botón manual disponible:', e);
  }

  clearCart();
  renderCart();
  showToast('¡Pedido registrado! Abriendo WhatsApp...', 'success');
}

// ---- Assistance (Mesero / Cuenta / Compartir) ----
function setupAssistanceFAB() {
  const fabBtn = document.getElementById('assistance-fab-btn');
  const menu = document.getElementById('assistance-menu');

  fabBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    playClickSound();
    menu?.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    menu?.classList.remove('show');
  });

  // Call Waiter
  document.getElementById('fab-call-waiter')?.addEventListener('click', () => callWaiter());
  document.getElementById('btn-call-waiter-nav')?.addEventListener('click', () => callWaiter());

  // Request Bill
  document.getElementById('fab-request-bill')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('bill-modal')?.classList.add('active');
  });

  document.getElementById('close-bill-btn')?.addEventListener('click', () => {
    document.getElementById('bill-modal')?.classList.remove('active');
  });
  document.getElementById('bill-backdrop')?.addEventListener('click', () => {
    document.getElementById('bill-modal')?.classList.remove('active');
  });

  document.getElementById('send-bill-whatsapp-btn')?.addEventListener('click', sendBillWhatsApp);

  // Share Table
  document.getElementById('fab-share-table')?.addEventListener('click', shareTable);
  document.getElementById('btn-share-table')?.addEventListener('click', shareTable);
}

function callWaiter() {
  playClickSound();
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || '1';
  const config = getConfig();

  let phone = (config.whatsappNumber || '3146841042').replace(/\D/g, '');
  if (phone.length === 10) phone = '57' + phone;

  const msg = `🙋‍♂️ *ATENCIÓN A MESA - ${config.restaurantName || 'Restaurante'}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Mesa:* Mesa ${table}\n` +
    `🕒 *Hora:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 ¡Hola! Por favor necesitamos la atención de un mesero en nuestra mesa. ¡Muchas gracias!`;

  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
  showToast(`Solicitando mesero para Mesa ${table}...`, 'info');
}

function sendBillWhatsApp() {
  playClickSound();
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || '1';
  const config = getConfig();

  const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'Tarjeta / Datáfono';

  let phone = (config.whatsappNumber || '3146841042').replace(/\D/g, '');
  if (phone.length === 10) phone = '57' + phone;

  const msg = `💳 *SOLICITUD DE CUENTA - ${config.restaurantName || 'Restaurante'}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Mesa:* Mesa ${table}\n` +
    `💵 *Método de Pago Seleccionado:* ${selectedMethod}\n` +
    `🕒 *Hora:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Por favor traernos la cuenta a la mesa. ¡Excelente servicio!`;

  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
  document.getElementById('bill-modal')?.classList.remove('active');
  showToast('Solicitud de cuenta enviada por WhatsApp', 'success');
}

function shareTable() {
  playClickSound();
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || '1';
  const config = getConfig();
  const url = window.location.href;

  const title = `Menú Digital 3D - Mesa ${table}`;
  const text = `🍽️ ¡Acompáñame a comer en ${config.restaurantName || 'este restaurante'}! Mira el menú 3D y pide desde tu teléfono para la Mesa ${table}:`;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Enlace de la mesa copiado al portapapeles', 'success');
    }).catch(() => {
      prompt('Copia este enlace para compartir la mesa con tus amigos:', url);
    });
  }
}

// ---- Event Listeners ----
function setupEventListeners() {
  // Theme Toggle (Day / Night)
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    playClickSound();
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(nextTheme === 'light' ? 'Modo Día activado ☀️' : 'Modo Noche activado 🌙', 'info');
  });

  // Language Toggle (ES / EN)
  document.getElementById('btn-lang-toggle')?.addEventListener('click', () => {
    playClickSound();
    toggleLanguage();
  });

  // 3D Viewer close
  document.getElementById('viewer-close')?.addEventListener('click', closeViewer);
  document.getElementById('viewer-backdrop')?.addEventListener('click', closeViewer);

  // 3D Controls
  document.getElementById('btn-auto-rotate')?.addEventListener('click', (e) => {
    playClickSound();
    const isRotating = toggleAutoRotate();
    e.currentTarget.classList.toggle('active', isRotating);
  });
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => { playClickSound(); zoomIn(); });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => { playClickSound(); zoomOut(); });
  document.getElementById('btn-reset')?.addEventListener('click', () => { playClickSound(); resetCamera(); });

  // Toggle Hotspots
  document.getElementById('btn-toggle-hotspots')?.addEventListener('click', (e) => {
    playClickSound();
    const visible = toggleHotspots();
    e.currentTarget.classList.toggle('active', visible);
    showToast(visible ? 'Indicadores de ingredientes activados' : 'Indicadores ocultos', 'info');
  });

  // Toggle 3D vs Photo
  document.getElementById('btn-toggle-mode')?.addEventListener('click', async (e) => {
    playClickSound();
    const newMode = await toggleViewerMode();
    e.currentTarget.textContent = newMode === 'photo' ? '🎮 Ver en 3D' : '📸/🎮 3D';
    showToast(newMode === 'photo' ? 'Modo Foto 3D con relieve' : 'Modo Modelo 3D Geométrico Real', 'info');
  });

  // Sync button text when 3D food is clicked directly to explode/assemble
  setExplodeCallback((isExploded) => {
    const explodeBtn = document.getElementById('btn-toggle-explode');
    if (explodeBtn) {
      explodeBtn.textContent = isExploded ? '🍔 Armar' : '💥 Desarmar';
      explodeBtn.classList.toggle('active', isExploded);
    }
  });

  // Toggle Exploded View (Desarmar / Armar)
  document.getElementById('btn-toggle-explode')?.addEventListener('click', (e) => {
    const isExploded = toggleExplodedView();
    e.currentTarget.textContent = isExploded ? '🍔 Armar' : '💥 Desarmar';
    showToast(isExploded ? '💥 Platillo desarmado: viendo capas de ingredientes' : '🍔 Platillo armado nuevamente', 'info');
  });

  // AR Mode Button
  document.getElementById('btn-ar-view')?.addEventListener('click', startAR);
  document.getElementById('ar-close-btn')?.addEventListener('click', stopAR);
  document.getElementById('ar-snap-btn')?.addEventListener('click', () => {
    playClickSound();
    const video = document.getElementById('ar-video');
    captureARScreenshot(video);
    showToast('¡Foto AR guardada en tu galería!', 'success');
  });

  // AR Scale Buttons
  document.querySelectorAll('[data-ar-scale]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      playClickSound();
      const scale = parseFloat(e.currentTarget.dataset.arScale) || 1.0;
      setARScale(scale);
      document.querySelectorAll('[data-ar-scale]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      showToast(`Escala AR: ${e.currentTarget.textContent}`, 'info');
    });
  });

  // Add to cart from viewer
  document.getElementById('viewer-add-cart')?.addEventListener('click', () => {
    if (currentViewerItem) {
      handleAddToCart(currentViewerItem);
    }
  });

  // Place order
  document.getElementById('place-order-btn')?.addEventListener('click', placeOrder);

  // Order modal close
  document.getElementById('order-done-btn')?.addEventListener('click', () => {
    document.getElementById('order-modal')?.classList.remove('active');
  });
  document.getElementById('order-backdrop')?.addEventListener('click', () => {
    document.getElementById('order-modal')?.classList.remove('active');
  });

  // Mobile cart toggle
  document.getElementById('mobile-cart-btn')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('cart-sidebar')?.classList.toggle('show');
  });

  document.getElementById('cart-toggle-mobile')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('cart-sidebar')?.classList.toggle('show');
  });

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeViewer();
      stopAR();
      document.getElementById('order-modal')?.classList.remove('active');
      document.getElementById('bill-modal')?.classList.remove('active');
      document.getElementById('cart-sidebar')?.classList.remove('show');
    }
  });
}
