/**
 * i18n.js - Multi-Language System (Español / English)
 * Real-time UI and dish translation
 */

export const translations = {
  es: {
    // Navbar
    share: '👥 Compartir',
    waiter: '🛎️ Mesero',
    bill: '💳 Pedir Cuenta',
    table: 'Mesa',

    // Header
    menuTitle: 'Nuestro Menú',
    menuSubtitle: 'Explora cada platillo en 3D. Toca para desarmar en capas y ver ingredientes.',

    // Search & Filters
    searchPlaceholder: 'Buscar platillo o ingrediente (ej: carne, queso, piña...)',
    filterAll: '🌟 Todos',
    filterPopular: '⭐ Populares',
    filterMeat: '🥩 Carnes',
    filterVeg: '🌱 Vegetariano',
    filterDrink: '🥤 Bebidas & Bar',
    filterSweet: '🍰 Postres',
    filterGlutenFree: '🌾 Sin Gluten',
    filterSpicy: '🌶️ Picante',

    // Categories
    catAll: '🍽️ Todas las Categorías',
    catEntradas: '🥗 Entradas',
    catPrincipales: '🍖 Principales',
    catPostres: '🍰 Postres',
    catBebidas: '🥤 Bebidas',
    catCocteles: '🍹 Cócteles',
    catEspeciales: '⭐ Especiales',

    // Cart
    yourOrder: '🛒 Tu Pedido',
    cartEmpty: 'Tu carrito está vacío',
    cartEmptySub: 'Toca + en los platillos para agregar',
    subtotal: 'Subtotal',
    tax: 'IVA (16%)',
    total: 'Total',
    orderNotes: '📝 Notas generales (opcional)',
    orderNotesPlaceholder: 'Ej: Sin cebolla, término medio, salsas aparte...',
    orderWhatsAppBtn: '✅ Hacer Pedido por WhatsApp',
    viewOrderMobile: '🛒 Ver Pedido',
    noteForKitchen: 'Nota para cocina...',
    addNote: '+ Agregar nota (ej: sin cebolla...)',

    // 3D Viewer
    viewerHint: '👆 Toca la comida para DESARMARLA en capas · Toca de nuevo para ARMARLA',
    btnExplode: '💥 Desarmar',
    btnAssemble: '🍔 Armar',
    btnIndicators: '🏷️ Indicadores',
    btnAR: '📸 Mesa (AR)',
    btnReset: '🏠',
    interactiveIngredients: '✨ Ingredientes interactivos (toca para ver de cerca):',
    addToCart: '+ Agregar',
    seeAll: '↩️ Ver todo',

    // AR Modal
    arBadge: '📸 Modo Realidad Aumentada (AR)',
    arRealCamera: 'Cámara Real (Mesa)',
    arSimulated: 'Mesa de Restaurante (AR)',
    arHint: '👆 Arrastra y gira con un dedo para ubicar el platillo sobre la mesa',
    arScaleReal: '1.0x Real',

    // Bill Modal
    billTitle: 'Pedir la Cuenta',
    billSubtitle: '¿Cómo deseas realizar el pago?',
    billCard: '💳 Tarjeta de Crédito / Débito (Datáfono a la mesa)',
    billCash: '💵 Efectivo',
    billTransfer: '📱 Transferencia / Código QR (Nequi/Daviplata)',
    sendBillBtn: '📲 Pedir Cuenta por WhatsApp',
    cancel: 'Cancelar',

    // Order Success
    orderSuccessTitle: '¡Pedido Realizado con Éxito!',
    orderSuccessSub: 'Se ha generado tu orden para cocina:',
    orderSuccessDesc: 'El pedido se envía directamente al WhatsApp del restaurante con tu número de mesa y platillos.',
    openWhatsApp: '📲 Enviar / Abrir en WhatsApp',
    continueMenu: '✅ Cerrar y seguir viendo el menú',

    // Assistance FAB
    fabCallWaiter: 'Llamar al Mesero',
    fabCallWaiterSub: 'Asistencia en tu mesa',
    fabRequestBill: 'Pedir la Cuenta',
    fabRequestBillSub: 'Efectivo o Tarjeta',
    fabShareTable: 'Compartir Mesa',
    fabShareTableSub: 'Invitar acompañantes',

    // Calories & allergens
    calories: 'kcal',
    prepTime: 'Tiempo prep.',
    tagSpicy: 'Picante',
    tagGlutenFree: 'Sin Gluten',
    tagVegan: 'Vegano',
    tagPopular: 'Popular',
  },

  en: {
    // Navbar
    share: '👥 Share',
    waiter: '🛎️ Waiter',
    bill: '💳 Request Bill',
    table: 'Table',

    // Header
    menuTitle: 'Our Menu',
    menuSubtitle: 'Explore each dish in 3D. Tap to disassemble into layers and inspect ingredients.',

    // Search & Filters
    searchPlaceholder: 'Search dish or ingredient (e.g., beef, cheese, pineapple...)',
    filterAll: '🌟 All',
    filterPopular: '⭐ Popular',
    filterMeat: '🥩 Meats',
    filterVeg: '🌱 Vegetarian',
    filterDrink: '🥤 Drinks & Bar',
    filterSweet: '🍰 Desserts',
    filterGlutenFree: '🌾 Gluten-Free',
    filterSpicy: '🌶️ Spicy',

    // Categories
    catAll: '🍽️ All Categories',
    catEntradas: '🥗 Appetizers',
    catPrincipales: '🍖 Mains',
    catPostres: '🍰 Desserts',
    catBebidas: '🥤 Beverages',
    catCocteles: '🍹 Cocktails',
    catEspeciales: '⭐ Specials',

    // Cart
    yourOrder: '🛒 Your Order',
    cartEmpty: 'Your cart is empty',
    cartEmptySub: 'Tap + on dishes to order',
    subtotal: 'Subtotal',
    tax: 'Tax (16%)',
    total: 'Total',
    orderNotes: '📝 General notes (optional)',
    orderNotesPlaceholder: 'E.g., No onion, medium rare, sauces on the side...',
    orderWhatsAppBtn: '✅ Place Order via WhatsApp',
    viewOrderMobile: '🛒 View Order',
    noteForKitchen: 'Special request for kitchen...',
    addNote: '+ Add note (e.g., no onion...)',

    // 3D Viewer
    viewerHint: '👆 Tap the dish to EXPLODE into layers · Tap again to ASSEMBLE',
    btnExplode: '💥 Explode',
    btnAssemble: '🍔 Assemble',
    btnIndicators: '🏷️ Indicators',
    btnAR: '📸 Table (AR)',
    btnReset: '🏠',
    interactiveIngredients: '✨ Interactive ingredients (tap to inspect close-up):',
    addToCart: '+ Add to Order',
    seeAll: '↩️ View all',

    // AR Modal
    arBadge: '📸 Augmented Reality (AR) Mode',
    arRealCamera: 'Real Camera (Table)',
    arSimulated: 'Restaurant Table (AR)',
    arHint: '👆 Drag and rotate with one finger to place the dish on your table',
    arScaleReal: '1.0x Life-size',

    // Bill Modal
    billTitle: 'Request the Bill',
    billSubtitle: 'How would you like to pay?',
    billCard: '💳 Credit / Debit Card (Card machine to table)',
    billCash: '💵 Cash',
    billTransfer: '📱 Mobile Transfer / QR Code',
    sendBillBtn: '📲 Send Bill Request via WhatsApp',
    cancel: 'Cancel',

    // Order Success
    orderSuccessTitle: 'Order Placed Successfully!',
    orderSuccessSub: 'Your kitchen order ticket has been generated:',
    orderSuccessDesc: 'The order is forwarded directly to the restaurant’s WhatsApp with your table number and items.',
    openWhatsApp: '📲 Send / Open in WhatsApp',
    continueMenu: '✅ Close and keep exploring menu',

    // Assistance FAB
    fabCallWaiter: 'Call the Waiter',
    fabCallWaiterSub: 'Assistance at your table',
    fabRequestBill: 'Request the Bill',
    fabRequestBillSub: 'Cash or Card',
    fabShareTable: 'Share Table',
    fabShareTableSub: 'Invite table companions',

    // Calories & allergens
    calories: 'kcal',
    prepTime: 'Prep time',
    tagSpicy: 'Spicy',
    tagGlutenFree: 'Gluten-Free',
    tagVegan: 'Vegan',
    tagPopular: 'Popular',
  }
};

let currentLang = 'es';

export function getLang() {
  return currentLang;
}

export function initLanguage() {
  const saved = localStorage.getItem('menu3d_lang');
  if (saved && (saved === 'es' || saved === 'en')) {
    currentLang = saved;
  }
  return currentLang;
}

export function setLanguage(lang) {
  if (lang === 'es' || lang === 'en') {
    currentLang = lang;
    localStorage.setItem('menu3d_lang', lang);
  }
  return currentLang;
}

export function t(key) {
  return translations[currentLang]?.[key] || translations.es[key] || key;
}

