/**
 * storage.js - Data persistence layer
 * Uses localStorage for menu data and IndexedDB for images
 */

const DB_NAME = 'menu3d_qr_db';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const LS_MENU_KEY = 'menu3d_items';
const LS_ORDERS_KEY = 'menu3d_orders';
const LS_CONFIG_KEY = 'menu3d_config';
const LS_CART_KEY = 'menu3d_cart';

// In-memory cache for ultra-fast, iOS Safari-safe image access
const memoryImageCache = new Map();

// ---- IndexedDB for images ----
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
    };
  });
}

export async function saveImage(id, dataUrl) {
  memoryImageCache.set(id, dataUrl);
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readwrite');
      tx.objectStore(STORE_IMAGES).put({ id, data: dataUrl, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[saveImage] IndexedDB write failed (falling back to memory/server):', err);
  }
  // Also push to server for cross-device sync
  syncImageToServer(id, dataUrl);
}

export async function getImage(id) {
  // 1. Check in-memory cache first (instant, 100% works on iOS / Safari private mode)
  if (memoryImageCache.has(id)) {
    return memoryImageCache.get(id);
  }

  // 2. Try IndexedDB
  try {
    const db = await openDB();
    const localData = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_IMAGES, 'readonly');
      const request = tx.objectStore(STORE_IMAGES).get(id);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
    if (localData) {
      memoryImageCache.set(id, localData);
      return localData;
    }
  } catch (e) {
    console.warn('[getImage] IndexedDB failed (possible iOS private mode):', e);
  }

  // 3. Fallback: try fetching from server
  const serverData = await syncImageFromServer(id);
  if (serverData) {
    memoryImageCache.set(id, serverData);
  }
  return serverData;
}

export async function deleteImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    tx.objectStore(STORE_IMAGES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Menu Items (localStorage) ----
export function getMenuItems() {
  try {
    const data = localStorage.getItem(LS_MENU_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveMenuItems(items) {
  localStorage.setItem(LS_MENU_KEY, JSON.stringify(items));
  // Broadcast change to other tabs
  window.dispatchEvent(new CustomEvent('menu-updated', { detail: items }));
  // BroadcastChannel for cross-tab sync
  try {
    const bc = new BroadcastChannel('menu3d_sync');
    bc.postMessage({ type: 'menu-update', items });
    bc.close();
  } catch (e) { /* BroadcastChannel not supported */ }
  // Also push to server for cross-device sync
  syncMenuToServer(items);
}

export function addMenuItem(item) {
  const items = getMenuItems();
  item.id = item.id || generateId();
  item.createdAt = Date.now();
  item.status = item.status || 'approved';
  item.modelType = item.modelType || detectModelType(item.name, item.category);
  item.ingredients = item.ingredients || getDefaultIngredients(item.modelType);
  items.push(item);
  saveMenuItems(items);
  return item;
}

export function updateMenuItem(id, updates) {
  const items = getMenuItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates, updatedAt: Date.now() };
    saveMenuItems(items);
    return items[idx];
  }
  return null;
}

export function deleteMenuItem(id) {
  const items = getMenuItems().filter(i => i.id !== id);
  saveMenuItems(items);
  deleteImage(id).catch(() => {});
}

export function getMenuItemsByCategory(category) {
  if (category === 'all') return getMenuItems().filter(i => i.status === 'approved');
  return getMenuItems().filter(i => i.category === category && i.status === 'approved');
}

// ---- Orders ----
export function getOrders() {
  try {
    const data = localStorage.getItem(LS_ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order) {
  const orders = getOrders();
  order.id = order.id || generateId();
  order.orderNumber = generateOrderNumber();
  order.createdAt = Date.now();
  order.status = 'pending';
  orders.unshift(order);
  localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
  // Broadcast
  try {
    const bc = new BroadcastChannel('menu3d_sync');
    bc.postMessage({ type: 'new-order', order });
    bc.close();
  } catch (e) {}
  // Also push to server
  syncOrderToServer(order);
  return order;
}

export function updateOrderStatus(orderId, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = status;
    orders[idx].updatedAt = Date.now();
    localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
  }
}

// ---- Cart ----
export function getCart() {
  try {
    const data = localStorage.getItem(LS_CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem(LS_CART_KEY, JSON.stringify(cart));
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  saveCart(cart);
  return cart;
}

export function updateCartQuantity(itemId, quantity) {
  let cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter(c => c.id !== itemId);
  } else {
    const item = cart.find(c => c.id === itemId);
    if (item) item.quantity = quantity;
  }
  saveCart(cart);
  return cart;
}

export function updateCartItemNote(itemId, note) {
  const cart = getCart();
  const item = cart.find(c => c.id === itemId);
  if (item) {
    item.note = note;
    saveCart(cart);
  }
  return cart;
}

export function clearCart() {
  localStorage.removeItem(LS_CART_KEY);
}

export function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

export function detectDefaultBaseUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      // If deployed to a cloud server or tunnel, use origin directly
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return origin;
      }
    }
  }
  return 'http://192.168.1.35:3000';
}

// ---- Config ----
export function getConfig() {
  try {
    const data = localStorage.getItem(LS_CONFIG_KEY);
    const parsed = data ? JSON.parse(data) : getDefaultConfig();
    // Guarantee defaults for new required fields
    if (!parsed.whatsappNumber) parsed.whatsappNumber = '573146841042';
    if (!parsed.adminPin) parsed.adminPin = '1234';
    if (!parsed.baseUrl || (typeof window !== 'undefined' && window.location && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1') && parsed.baseUrl.includes('192.168.'))) {
      parsed.baseUrl = detectDefaultBaseUrl();
    }
    return parsed;
  } catch {
    return getDefaultConfig();
  }
}

export function saveConfig(config) {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
  // BroadcastChannel for cross-tab sync
  try {
    const bc = new BroadcastChannel('menu3d_sync');
    bc.postMessage({ type: 'config-update', config });
    bc.close();
  } catch {
    // BroadcastChannel unsupported fallback
  }
  // Also push to server for cross-device sync
  syncConfigToServer(config);
}

function getDefaultConfig() {
  return {
    restaurantName: 'Mi Restaurante',
    currency: '$',
    tableCount: 20,
    whatsappNumber: '573146841042',
    adminPin: '1234',
    baseUrl: detectDefaultBaseUrl(),
    aiEnabled: true,
    geminiApiKey: '',
    hfApiKey: '',
    categories: [
      { id: 'entradas', name: '🥗 Entradas', icon: '🥗' },
      { id: 'principales', name: '🍖 Principales', icon: '🍖' },
      { id: 'postres', name: '🍰 Postres', icon: '🍰' },
      { id: 'bebidas', name: '🥤 Bebidas', icon: '🥤' },
      { id: 'cocteles', name: '🍹 Cócteles', icon: '🍹' },
      { id: 'especiales', name: '⭐ Especiales', icon: '⭐' },
    ],
  };
}

// ---- Utilities ----
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateOrderNumber() {
  const prefix = 'ORD';
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export function detectModelType(name = '', category = '') {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes('taco')) return 'tacos';
  if (n.includes('burger') || n.includes('hamburguesa')) return 'burger';
  if (n.includes('pizza')) return 'pizza';
  if (n.includes('ribeye') || n.includes('corte') || n.includes('carne') || n.includes('steak')) return 'ribeye';
  if (n.includes('ensalada') || n.includes('salad')) return 'salad';
  if (n.includes('salmón') || n.includes('salmon') || n.includes('pescado')) return 'salmon';
  if (n.includes('flan') || n.includes('pastel') || n.includes('postre') || n.includes('chocolate') || c === 'postres') return 'dessert';
  if (n.includes('margarita') || n.includes('mojito') || n.includes('coctel') || n.includes('vino') || c === 'cocteles') return 'cocktail';
  if (n.includes('limonada') || n.includes('agua') || n.includes('jugo') || c === 'bebidas') return 'drink';
  if (n.includes('guacamole') || n.includes('totopo')) return 'guacamole';
  return 'burger';
}

export function getDefaultIngredients(modelType) {
  const map = {
    custom_ai: [
      { name: 'Base & Acompañamiento 3D', desc: 'Guarnición, cama de salsa o base artesanal', icon: '🍽️' },
      { name: 'Cuerpo Principal Esculpido', desc: 'Ingredientes principales modelados con relieve IA y PBR', icon: '✨' },
      { name: 'Topping & Glaseado Gourmet', desc: 'Aderezo, microgreens o acabado superior brillante', icon: '🌿' }
    ],
    tacos: [
      { name: 'Tortillas de Maíz & Limón', desc: 'Doble tortilla hecha a mano con limón criollo', icon: '🌽' },
      { name: 'Carne al Pastor Marinada', desc: 'Marinado tradicional 24h en achiote y especias', icon: '🥩' },
      { name: 'Piña Asada & Aguacate', desc: 'Caramelizada al carbón con abanico de aguacate', icon: '🍍' },
      { name: 'Cebolla Crujiente & Cilantro', desc: 'Picado fino al momento', icon: '🌿' },
      { name: 'Salsa Taquera Especial', desc: 'Salsa verde asada con toque de chile', icon: '🌶️' }
    ],
    burger: [
      { name: 'Carne 100% Angus', desc: '200g de res jugosa a la parrilla', icon: '🥩' },
      { name: 'Queso Cheddar', desc: 'Fundido sobre la carne caliente', icon: '🧀' },
      { name: 'Tomate Maduro', desc: 'Rodaja fresca de huerto orgánico', icon: '🍅' },
      { name: 'Lechuga Romana', desc: 'Hojas verdes crujientes', icon: '🥬' },
      { name: 'Pan Brioche', desc: 'Tostado con mantequilla y sésamo', icon: '🥖' }
    ],
    ribeye: [
      { name: 'Ribeye Prime 350g', desc: 'Sellado al fuego con costra dorada', icon: '🥩' },
      { name: 'Mantequilla de Romero', desc: 'Derritiéndose sobre el corte', icon: '🧈' },
      { name: 'Papas Rostizadas', desc: 'Salteadas con romero y ajo', icon: '🥔' },
      { name: 'Sal Marina Gruesa', desc: 'Cosechada artesanalmente', icon: '🧂' }
    ],
    salad: [
      { name: 'Lechuga Romana', desc: 'Corazones frescos hidropónicos', icon: '🥬' },
      { name: 'Queso Parmesano', desc: 'Láminas de Reggiano curado 24m', icon: '🧀' },
      { name: 'Crutones de Ajo', desc: 'Horneados con aceite de oliva', icon: '🍞' },
      { name: 'Aderezo César', desc: 'Receta de la casa con anchoas', icon: '🥣' }
    ],
    pizza: [
      { name: 'Masa Madre & Salsa Pomodoro', desc: 'Fermentada 48 horas en frío con tomates San Marzano', icon: '🍕' },
      { name: 'Mozzarella Fior di Latte', desc: 'Queso elástico fundido y parmesano gratinado', icon: '🧀' },
      { name: 'Pepperoni Curado', desc: 'Rodajas crujientes con especias italianas', icon: '🥓' },
      { name: 'Champiñones & Pimientos', desc: 'Portobellos salteados y aceitunas negras', icon: '🍄' },
      { name: 'Albahaca Fresca & Orégano', desc: 'Hojas aromáticas de huerto orgánico', icon: '🌿' }
    ],
    drink: [
      { name: 'Limones Frescos', desc: 'Recién exprimidos al momento', icon: '🍋' },
      { name: 'Menta / Hierbabuena', desc: 'Hojas aromatizantes recién cortadas', icon: '🌿' },
      { name: 'Hielos Cristalinos', desc: 'Agua purificada triple filtro', icon: '🧊' },
      { name: 'Jarabe Natural', desc: 'Dulzura equilibrada y refrescante', icon: '🍯' }
    ],
    cocktail: [
      { name: 'Tequila Blanco 100% Agave', desc: 'Destilado artesanal premium', icon: '🍸' },
      { name: 'Licor Triple Sec', desc: 'Cítricos de naranja dulce', icon: '🍊' },
      { name: 'Jugo de Lima Fresca', desc: 'Ácido natural refrescante', icon: '🍋' },
      { name: 'Borde de Sal Marina', desc: 'Escarchado fino tradicional', icon: '🧂' }
    ],
    dessert: [
      { name: 'Flan de Vainilla Real', desc: 'Cremoso elaborado con vaina natural', icon: '🍮' },
      { name: 'Caramelo Ámbar', desc: 'Baño dorado lustroso espeso', icon: '🍯' },
      { name: 'Cereza Silvestre', desc: 'Fruta fresca brillante en la cima', icon: '🍒' },
      { name: 'Nata Montada', desc: 'Espiral suave de crema batida', icon: '🧁' }
    ],
    salmon: [
      { name: 'Salmón Noruego Fresco', desc: 'Rico en Omega-3, sellado a fuego medio', icon: '🐟' },
      { name: 'Glaseado Teriyaki', desc: 'Soya, jengibre y miel caramelizada', icon: '🍯' },
      { name: 'Arroz Jazmín', desc: 'Al vapor aromático y esponjoso', icon: '🍚' },
      { name: 'Semillas de Sésamo', desc: 'Tostadas al comal', icon: '🌱' }
    ],
    guacamole: [
      { name: 'Aguacate Hass Maduro', desc: 'Machacado en molcajete de piedra', icon: '🥑' },
      { name: 'Jitomate y Cebolla', desc: 'Pico de gallo fresco al momento', icon: '🍅' },
      { name: 'Totopos de Maíz', desc: 'Crujientes y dorados artesanalmente', icon: '🌽' },
      { name: 'Chile Serrano', desc: 'Picor balanceado con limón', icon: '🌶️' }
    ]
  };

  return map[modelType] || map.burger;
}

// ---- Seed Demo Data ----
export async function seedDemoData() {
  const existing = getMenuItems();
  if (existing.length > 0) {
    // Ensure existing items have modelType, ingredients, calories, tags
    let modified = false;
    existing.forEach(item => {
      if (!item.modelType) {
        item.modelType = detectModelType(item.name, item.category);
        modified = true;
      }
      if (!item.ingredients || item.ingredients.length === 0) {
        item.ingredients = getDefaultIngredients(item.modelType);
        modified = true;
      }
      if (!item.calories) {
        const calMap = { tacos: 480, burger: 760, salad: 320, pizza: 820, dessert: 380, drink: 120, cocktail: 210, guacamole: 340, ribeye: 690, salmon: 540 };
        item.calories = calMap[item.modelType] || 450;
        item.prepTime = '12-18 min';
        item.tags = item.tags || (item.modelType === 'tacos' ? ['spicy', 'gluten-free', 'popular'] : item.modelType === 'salad' ? ['veg', 'gluten-free'] : item.modelType === 'guacamole' ? ['veg', 'gluten-free'] : ['popular']);
        modified = true;
      }
    });
    if (modified) {
      saveMenuItems(existing);
    }
    return;
  }

  const demoItems = [
    {
      id: 'demo_1',
      name: 'Tacos al Pastor',
      nameEn: 'Al Pastor Tacos',
      description: 'Deliciosos tacos con carne al pastor marinada, piña asada, cilantro y cebolla sobre tortilla de maíz.',
      descEn: 'Marinated pork tacos with roasted pineapple, fresh cilantro, and onions on double corn tortillas.',
      price: 85,
      category: 'principales',
      status: 'approved',
      modelType: 'tacos',
      calories: 480,
      prepTime: '10-15 min',
      tags: ['popular', 'gluten-free', 'spicy'],
      ingredients: getDefaultIngredients('tacos'),
    },
    {
      id: 'demo_burger',
      name: 'Hamburguesa Doble Smash',
      nameEn: 'Double Smash Burger',
      description: 'Doble carne angus con queso cheddar fundido, lechuga, tomate y pan brioche artesanal con sésamo.',
      descEn: 'Double Angus beef patties with melted cheddar cheese, crisp lettuce, ripe tomato, and artisan brioche bun.',
      price: 195,
      category: 'principales',
      status: 'approved',
      modelType: 'burger',
      calories: 780,
      prepTime: '15-20 min',
      tags: ['popular'],
      ingredients: getDefaultIngredients('burger'),
    },
    {
      id: 'demo_2',
      name: 'Ensalada César',
      nameEn: 'Caesar Salad',
      description: 'Lechuga romana fresca, crutones artesanales, parmesano y aderezo César casero.',
      descEn: 'Fresh crisp romaine lettuce, herb croutons, aged Parmesan shavings, and house Caesar dressing.',
      price: 120,
      category: 'entradas',
      status: 'approved',
      modelType: 'salad',
      calories: 320,
      prepTime: '8-12 min',
      tags: ['veg', 'gluten-free'],
      ingredients: getDefaultIngredients('salad'),
    },
    {
      id: 'demo_pizza',
      name: 'Pizza Artesanal Pepperoni',
      nameEn: 'Artisan Pepperoni Pizza',
      description: 'Masa madre horneada a la piedra, salsa pomodoro, mozzarella fundido y pepperoni curado.',
      descEn: 'Stone-baked sourdough crust, San Marzano pomodoro sauce, bubbly mozzarella, and cured pepperoni.',
      price: 210,
      category: 'principales',
      status: 'approved',
      modelType: 'pizza',
      calories: 820,
      prepTime: '18-22 min',
      tags: ['popular'],
      ingredients: getDefaultIngredients('pizza'),
    },
    {
      id: 'demo_3',
      name: 'Flan Napolitano',
      nameEn: 'Neapolitan Flan',
      description: 'Flan cremoso con caramelo artesanal, receta tradicional de la casa con vainilla natural.',
      descEn: 'Silky creamy custard with golden amber caramel sauce, traditional recipe with real vanilla.',
      price: 75,
      category: 'postres',
      status: 'approved',
      modelType: 'dessert',
      calories: 380,
      prepTime: '5 min',
      tags: ['veg'],
      ingredients: getDefaultIngredients('dessert'),
    },
    {
      id: 'demo_4',
      name: 'Limonada Natural Fría',
      nameEn: 'Fresh Mint Lemonade',
      description: 'Limonada fresca recién exprimida con hierbabuena, hielos cristalinos y toque de jengibre.',
      descEn: 'Freshly squeezed natural lemonade with garden spearmint, crystal ice, and a ginger hint.',
      price: 45,
      category: 'bebidas',
      status: 'approved',
      modelType: 'drink',
      calories: 120,
      prepTime: '5 min',
      tags: ['veg', 'gluten-free'],
      ingredients: getDefaultIngredients('drink'),
    },
    {
      id: 'demo_5',
      name: 'Margarita Clásica',
      nameEn: 'Classic Margarita',
      description: 'Tequila 100% agave, jugo de limón, triple sec y sal marina escarchada en el borde.',
      descEn: '100% blue agave tequila, fresh lime juice, triple sec, and coarse sea salt frosted rim.',
      price: 150,
      category: 'cocteles',
      status: 'approved',
      modelType: 'cocktail',
      calories: 210,
      prepTime: '5 min',
      tags: ['popular', 'gluten-free'],
      ingredients: getDefaultIngredients('cocktail'),
    },
    {
      id: 'demo_6',
      name: 'Guacamole con Totopos',
      nameEn: 'Guacamole & Crispy Chips',
      description: 'Aguacate hass machacado con tomate, cebolla, cilantro, limón y totopos de maíz crujientes.',
      descEn: 'Crushed Hass avocado in volcanic stone with tomato, onion, cilantro, lime, and crispy corn totopos.',
      price: 95,
      category: 'entradas',
      status: 'approved',
      modelType: 'guacamole',
      calories: 340,
      prepTime: '8-10 min',
      tags: ['veg', 'gluten-free'],
      ingredients: getDefaultIngredients('guacamole'),
    },
    {
      id: 'demo_7',
      name: 'Ribeye a la Parrilla 350g',
      nameEn: 'Grilled Prime Ribeye 350g',
      description: 'Corte premium a la parrilla con mantequilla de romero y papas cambray rostizadas.',
      descEn: 'Prime grilled ribeye steak with melted rosemary garlic butter and roasted cambray potatoes.',
      price: 380,
      category: 'principales',
      status: 'approved',
      modelType: 'ribeye',
      calories: 690,
      prepTime: '20-25 min',
      tags: ['popular', 'gluten-free'],
      ingredients: getDefaultIngredients('ribeye'),
    },
    {
      id: 'demo_10',
      name: 'Salmón Glaseado Teriyaki',
      nameEn: 'Teriyaki Glazed Salmon',
      description: 'Filete de salmón noruego glaseado con salsa teriyaki, arroz jazmín y semillas de sésamo.',
      descEn: 'Fresh Norwegian salmon fillet glazed with sweet teriyaki, steamed jasmine rice, and toasted sesame.',
      price: 290,
      category: 'especiales',
      status: 'approved',
      modelType: 'salmon',
      calories: 540,
      prepTime: '15-20 min',
      tags: ['popular'],
      ingredients: getDefaultIngredients('salmon'),
    },
  ];

  for (const item of demoItems) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');

    const hue = (demoItems.indexOf(item) * 37 + 25) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 600, 450);
    gradient.addColorStop(0, `hsl(${hue}, 60%, 25%)`);
    gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 50%, 15%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 450);

    const emojis = {
      tacos: '🌮',
      burger: '🍔',
      pizza: '🍕',
      ribeye: '🥩',
      salad: '🥗',
      drink: '🥤',
      cocktail: '🍹',
      dessert: '🍮',
      salmon: '🐟',
      guacamole: '🥑',
    };
    ctx.font = '130px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojis[item.modelType] || '🍽️', 300, 190);

    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(item.name, 300, 350);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    await saveImage(item.id, dataUrl);
  }

  saveMenuItems(demoItems.map(item => ({ ...item, createdAt: Date.now() })));
}

// ---- Cross-tab sync listener ----
export function listenForSync(callback) {
  try {
    const bc = new BroadcastChannel('menu3d_sync');
    bc.onmessage = (e) => callback(e.data);
    return bc;
  } catch {
    return null;
  }
}

// =========================================
// SERVER SYNC — Cross-Device Persistence
// =========================================
// Syncs menu, images and config to the Vite
// middleware `data/*.json` files so that
// phones scanning the QR always see the
// latest products and photos.
// =========================================

const API_BASE = ''; // relative — same origin

/**
 * Push the current menu items to the server.
 * Called automatically by saveMenuItems.
 */
export async function syncMenuToServer(items) {
  try {
    await fetch(`${API_BASE}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
  } catch (e) {
    console.warn('[sync] Could not push menu to server:', e);
  }
}

/**
 * Push an image to the server.
 * Called automatically by saveImage.
 */
export async function syncImageToServer(id, dataUrl) {
  try {
    await fetch(`${API_BASE}/api/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data: dataUrl }),
    });
  } catch (e) {
    console.warn('[sync] Could not push image to server:', e);
  }
}

/**
 * Push config to the server.
 */
export async function syncConfigToServer(config) {
  try {
    await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (e) {
    console.warn('[sync] Could not push config to server:', e);
  }
}

/**
 * Push an order to the server.
 */
export async function syncOrderToServer(order) {
  try {
    await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  } catch (e) {
    console.warn('[sync] Could not push order to server:', e);
  }
}

/**
 * Fetch latest orders from the server
 */
export async function syncOrdersFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) return null;
    const orders = await res.json();
    if (Array.isArray(orders)) {
      localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(orders));
      return orders;
    }
  } catch (e) {
    console.warn('[sync] Could not pull orders from server:', e);
  }
  return null;
}

/**
 * Fetch the latest menu from the server and merge into localStorage.
 * Returns the up-to-date array of items.
 */
export async function syncMenuFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/menu`);
    if (!res.ok) return null;
    const items = await res.json();
    if (Array.isArray(items) && items.length > 0) {
      localStorage.setItem(LS_MENU_KEY, JSON.stringify(items));
      return items;
    }
  } catch (e) {
    console.warn('[sync] Could not pull menu from server:', e);
  }
  return null;
}

/**
 * Fetch a single image from the server.
 */
export async function syncImageFromServer(id) {
  try {
    const res = await fetch(`${API_BASE}/api/images?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload && payload.data) {
      await saveImageLocal(id, payload.data);
      return payload.data;
    }
  } catch (e) {
    console.warn('[sync] Could not pull image from server:', e);
  }
  return null;
}

/**
 * Fetch config from the server and merge into localStorage.
 */
export async function syncConfigFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) return null;
    const config = await res.json();
    if (config && typeof config === 'object' && config.restaurantName) {
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
      return config;
    }
  } catch (e) {
    console.warn('[sync] Could not pull config from server:', e);
  }
  return null;
}

// Low-level saveImage without server push (used by syncImageFromServer to avoid loops)
async function saveImageLocal(id, dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    tx.objectStore(STORE_IMAGES).put({ id, data: dataUrl, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fetch ALL images in a single call — perfect for iOS / Safari startup
 */
export async function syncAllImagesFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/images`);
    if (!res.ok) return null;
    const all = await res.json();
    if (all && typeof all === 'object') {
      for (const [id, dataUrl] of Object.entries(all)) {
        if (dataUrl) {
          memoryImageCache.set(id, dataUrl);
          // Also save in local IndexedDB without waiting
          saveImageLocal(id, dataUrl).catch(() => {});
        }
      }
      return all;
    }
  } catch (e) {
    console.warn('[sync] Could not pull all images from server:', e);
  }
  return null;
}

/**
 * Full initial sync from server — call on page load for cross-device pages (menu.html).
 * Fetches menu + config + all dish images in parallel.
 */
export async function initialSyncFromServer() {
  await Promise.all([
    syncMenuFromServer(),
    syncConfigFromServer(),
    syncAllImagesFromServer(),
  ]);
}
