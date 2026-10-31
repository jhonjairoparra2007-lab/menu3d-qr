/**
 * main.js - Landing page logic
 * Handles QR code generation, UI interactions, and Admin Quick-Add panel
 */

import QRCode from 'qrcode';
import {
  getConfig, saveConfig, seedDemoData,
  addMenuItem, saveImage, getDefaultIngredients, detectModelType, getMenuItems,
  initialSyncFromServer, syncMenuToServer,
} from './storage.js';
import { detectFood3DModel } from './ai.js';
import { showToast } from './toast.js';

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', async () => {
  // Sync latest menu and settings from server for cross-device consistency
  await initialSyncFromServer();

  // Seed demo data on first visit
  await seedDemoData();

  const config = getConfig();

  // Pre-fill restaurant name & base URL
  const nameInput = document.getElementById('restaurant-name');
  if (nameInput && config.restaurantName) {
    nameInput.value = config.restaurantName;
  }

  const baseUrlInput = document.getElementById('qr-base-url');
  if (baseUrlInput) {
    if (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
      baseUrlInput.value = window.location.origin;
    } else {
      baseUrlInput.value = config.baseUrl || 'http://192.168.1.35:3000';
    }
  }

  document.getElementById('btn-use-wifi-ip')?.addEventListener('click', () => {
    if (baseUrlInput) {
      baseUrlInput.value = 'http://192.168.1.35:3000';
      showToast('URL configurada a IP Wi-Fi local', 'info');
      generateQR();
    }
  });

  document.getElementById('btn-use-cloud')?.addEventListener('click', () => {
    if (baseUrlInput) {
      const currentOrigin = (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://menu3d-qr.onrender.com';
      baseUrlInput.value = currentOrigin;
      showToast('URL en la nube configurada para acceso desde cualquier red 🌐', 'info');
      generateQR();
    }
  });

  // QR Generation
  const generateBtn = document.getElementById('generate-qr-btn');
  const downloadBtn = document.getElementById('download-qr-btn');
  const batchBtn = document.getElementById('batch-qr-btn');

  generateBtn?.addEventListener('click', generateQR);
  downloadBtn?.addEventListener('click', downloadQR);
  batchBtn?.addEventListener('click', generateBatchQR);

  // Mobile nav toggle
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  mobileToggle?.addEventListener('click', () => {
    const nav = document.querySelector('.navbar-nav');
    if (nav) {
      nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
      nav.style.position = 'absolute';
      nav.style.top = '64px';
      nav.style.right = '16px';
      nav.style.background = 'rgba(10,10,10,0.95)';
      nav.style.backdropFilter = 'blur(20px)';
      nav.style.padding = '12px';
      nav.style.borderRadius = '12px';
      nav.style.flexDirection = 'column';
      nav.style.border = '1px solid rgba(255,255,255,0.08)';
    }
  });

  // Smooth scroll for anchors
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Feature card animations on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'modalSlideUp 0.5s ease forwards';
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.animationDelay = `${i * 100}ms`;
    observer.observe(card);
  });

  // Initialize admin quick-add panel
  initAdminQuickAdd();
});

// ---- QR Generation ----
let currentQRDataUrl = null;

async function generateQR() {
  const name = document.getElementById('restaurant-name').value || 'Mi Restaurante';
  const table = document.getElementById('table-number').value || '1';
  const size = parseInt(document.getElementById('qr-size').value) || 512;

  // Save restaurant name & base URL to config
  const config = getConfig();
  const inputBaseUrl = document.getElementById('qr-base-url')?.value.trim();
  const baseUrl = inputBaseUrl || config.baseUrl || 'http://192.168.1.35:3000';
  config.restaurantName = name;
  config.baseUrl = baseUrl;
  saveConfig(config);

  // Build menu URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const menuUrl = `${cleanBase}/menu.html?table=${table}&restaurant=${encodeURIComponent(name)}`;

  const qrDisplay = document.getElementById('qr-display');
  const qrUrlEl = document.getElementById('qr-url');
  const downloadBtn = document.getElementById('download-qr-btn');

  try {
    // Clear previous QR
    qrDisplay.innerHTML = '';

    // Create canvas for QR
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, menuUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    // Add restaurant name and table number overlay
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Small center logo area
    const logoSize = canvas.width * 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - logoSize / 2, centerY - logoSize / 2, logoSize, logoSize);
    ctx.font = `${logoSize * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍽️', centerX, centerY);

    qrDisplay.appendChild(canvas);
    currentQRDataUrl = canvas.toDataURL('image/png');

    // Update URL display
    qrUrlEl.textContent = menuUrl;

    // Enable download
    downloadBtn.disabled = false;

    showToast(`QR generado para Mesa ${table}`, 'success');

    // Show the admin quick-add panel with a smooth reveal
    const adminPanel = document.getElementById('admin-quick-add-panel');
    if (adminPanel && adminPanel.style.display === 'none') {
      adminPanel.style.display = 'block';
      adminPanel.style.animation = 'modalSlideUp 0.5s ease forwards';
    }
  } catch (error) {
    console.error('Error generating QR:', error);
    qrDisplay.innerHTML = `<p style="color: var(--color-danger);">Error al generar QR</p>`;
    showToast('Error al generar el código QR', 'error');
  }
}

function downloadQR() {
  if (!currentQRDataUrl) return;

  const name = document.getElementById('restaurant-name').value || 'restaurante';
  const table = document.getElementById('table-number').value || '1';

  const link = document.createElement('a');
  link.download = `qr-${name.replace(/\s+/g, '-').toLowerCase()}-mesa-${table}.png`;
  link.href = currentQRDataUrl;
  link.click();

  showToast('QR descargado exitosamente', 'success');
}

async function generateBatchQR() {
  const name = document.getElementById('restaurant-name')?.value.trim() || 'Mi Restaurante';
  const config = getConfig();
  const tableCount = config.tableCount || 20;

  const modal = document.getElementById('batch-qr-modal');
  const grid = document.getElementById('batch-qr-grid');
  const countText = document.getElementById('batch-count-text');
  const title = document.getElementById('batch-modal-title');
  const closeBtn = document.getElementById('batch-qr-close');
  const backdrop = document.getElementById('batch-qr-backdrop');
  const printBtn = document.getElementById('batch-print-btn');

  if (!modal || !grid) {
    showToast('Modal de QR no disponible', 'error');
    return;
  }

  showToast(`Generando QR para ${tableCount} mesas...`, 'info');

  if (title) title.innerHTML = `🖨️ Códigos QR - ${name}`;
  if (countText) countText.textContent = `${tableCount} mesas configuradas`;

  // Clear previous grid items
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px;"><div class="loading-spinner"></div><p style="margin-top:10px; color:var(--text-secondary);">Generando tarjetas QR de alta resolución...</p></div>';

  modal.classList.add('active');
  modal.style.display = 'flex';

  const closeModal = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  };

  closeBtn?.addEventListener('click', closeModal, { once: true });
  backdrop?.addEventListener('click', closeModal, { once: true });

  const inputBaseUrl = document.getElementById('qr-base-url')?.value.trim();
  const baseUrl = (inputBaseUrl || config.baseUrl || 'http://192.168.1.35:3000').replace(/\/+$/, '');

  // Give DOM a frame to show modal
  await new Promise(r => setTimeout(r, 50));
  grid.innerHTML = '';

  for (let i = 1; i <= tableCount; i++) {
    const menuUrl = `${baseUrl}/menu.html?table=${i}&restaurant=${encodeURIComponent(name)}`;
    const card = document.createElement('div');
    card.className = 'batch-qr-card';

    const header = document.createElement('div');
    header.className = 'batch-qr-card-header';
    header.innerHTML = `
      <div style="font-size: 1.15rem; font-weight: 800; color: #111827;">Mesa ${i}</div>
      <div style="font-size: 0.75rem; color: #6b7280; font-weight: 500;">${name}</div>
    `;

    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, menuUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const qrWrap = document.createElement('div');
    qrWrap.style.display = 'flex';
    qrWrap.style.justifyContent = 'center';
    qrWrap.style.margin = '8px 0';
    qrWrap.appendChild(canvas);

    const footer = document.createElement('div');
    footer.className = 'batch-qr-card-footer';
    footer.innerHTML = `
      <div style="font-size: 0.7rem; font-weight: 600; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">✨ Menú 3D Interactivo</div>
      <div style="font-size: 0.65rem; color: #9ca3af; word-break: break-all; margin-top: 2px;">${menuUrl}</div>
    `;

    card.appendChild(header);
    card.appendChild(qrWrap);
    card.appendChild(footer);
    grid.appendChild(card);
  }

  printBtn?.addEventListener('click', () => {
    window.print();
  }, { once: true });

  showToast(`¡${tableCount} códigos QR listos para imprimir!`, 'success');
}

// =============================================
// ADMIN QUICK-ADD PANEL LOGIC
// =============================================
let quickAddImageDataUrl = null;
let adminUnlocked = false;

// Called from DOMContentLoaded
function initAdminQuickAdd() {
  // PIN gate
  const pinSubmit = document.getElementById('admin-pin-submit');
  const pinInput = document.getElementById('admin-pin-input');
  const pinError = document.getElementById('admin-pin-error');

  pinSubmit?.addEventListener('click', () => {
    const currentPin = getConfig().adminPin || '1234';
    if (pinInput?.value === currentPin) {
      adminUnlocked = true;
      document.getElementById('admin-pin-gate').style.display = 'none';
      document.getElementById('admin-quick-form').style.display = 'block';
      pinError.style.display = 'none';
      showToast('Acceso administrador concedido ✅', 'success');
      renderQuickAddedList();
    } else {
      pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  });

  pinInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pinSubmit?.click();
    }
  });

  // Lock button
  document.getElementById('admin-lock-btn')?.addEventListener('click', () => {
    adminUnlocked = false;
    document.getElementById('admin-pin-gate').style.display = 'block';
    document.getElementById('admin-quick-form').style.display = 'none';
    if (pinInput) pinInput.value = '';
    showToast('Panel de administrador bloqueado', 'info');
  });

  // Quick-add form upload area
  const uploadArea = document.getElementById('quick-upload-area');
  const fileInput = document.getElementById('quick-item-image');
  const removeBtn = document.getElementById('quick-remove-preview');

  uploadArea?.addEventListener('click', (e) => {
    if (e.target.closest('#quick-remove-preview')) return;
    fileInput?.click();
  });

  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-primary)';
  });
  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '';
  });
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer.files?.[0];
    if (file) handleQuickImageFile(file);
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleQuickImageFile(file);
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearQuickImagePreview();
  });

  // Auto-detect model type from name
  const nameInput = document.getElementById('quick-item-name');
  const modelSelect = document.getElementById('quick-item-model');
  nameInput?.addEventListener('input', () => {
    const category = document.getElementById('quick-item-category')?.value || '';
    const detected = detectModelType(nameInput.value, category);
    if (modelSelect) modelSelect.value = detected;
  });

  // Quick-add form submission
  document.getElementById('quick-add-form')?.addEventListener('submit', handleQuickAddSubmit);
}

function handleQuickImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Selecciona un archivo de imagen válido', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    quickAddImageDataUrl = e.target.result;
    document.getElementById('quick-upload-placeholder').style.display = 'none';
    const preview = document.getElementById('quick-upload-preview');
    if (preview) preview.style.display = 'block';
    const img = document.getElementById('quick-preview-img');
    if (img) img.src = quickAddImageDataUrl;

    // AI 3D Model Archetype Detection
    try {
      const nameVal = document.getElementById('quick-item-name')?.value || '';
      const aiResult = await detectFood3DModel(quickAddImageDataUrl, nameVal);
      if (aiResult && aiResult.archetype) {
        const modelSelect = document.getElementById('quick-item-model');
        if (modelSelect) modelSelect.value = aiResult.archetype;

        const catSelect = document.getElementById('quick-item-category');
        if (catSelect && aiResult.category) catSelect.value = aiResult.category;

        const descInput = document.getElementById('quick-item-desc');
        if (descInput && !descInput.value.trim() && aiResult.description) {
          descInput.value = aiResult.description;
        }

        showToast(`🤖 IA detectó: ${aiResult.label || aiResult.archetype} (${aiResult.confidence}%) · Modelo 3D configurado`, 'success');
      }
    } catch (err) {
      console.warn('AI 3D detection error in quick-add:', err);
    }
  };
  reader.readAsDataURL(file);
}

function clearQuickImagePreview() {
  quickAddImageDataUrl = null;
  document.getElementById('quick-upload-placeholder').style.display = 'flex';
  document.getElementById('quick-upload-preview').style.display = 'none';
  const fileInput = document.getElementById('quick-item-image');
  if (fileInput) fileInput.value = '';
}

async function handleQuickAddSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('quick-item-name')?.value.trim();
  const price = parseFloat(document.getElementById('quick-item-price')?.value);
  const category = document.getElementById('quick-item-category')?.value || 'principales';
  const desc = document.getElementById('quick-item-desc')?.value.trim() || '';
  const modelType = document.getElementById('quick-item-model')?.value || 'burger';

  if (!name || isNaN(price)) {
    showToast('Completa el nombre y precio del platillo', 'error');
    return;
  }

  const submitBtn = document.getElementById('quick-add-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando y Sincronizando...';
  }

  try {
    const ingredients = getDefaultIngredients(modelType);
    const calMap = { tacos: 480, burger: 760, salad: 320, pizza: 820, dessert: 380, drink: 120, cocktail: 210, guacamole: 340, ribeye: 690, salmon: 540 };

    const newItem = addMenuItem({
      name,
      description: desc,
      category,
      modelType,
      price,
      ingredients,
      calories: calMap[modelType] || 450,
      prepTime: '12-18 min',
      tags: ['popular'],
      status: 'approved',
    });

    // Save image (user-uploaded or auto-generated placeholder)
    if (quickAddImageDataUrl) {
      await saveImage(newItem.id, quickAddImageDataUrl);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 450;
      const ctx = canvas.getContext('2d');
      const hue = (Date.now() % 360);
      const gradient = ctx.createLinearGradient(0, 0, 600, 450);
      gradient.addColorStop(0, `hsl(${hue}, 60%, 25%)`);
      gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 50%, 15%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 450);
      const emojis = { entradas: '🥗', principales: '🍖', postres: '🍰', bebidas: '🥤', cocteles: '🍹', especiales: '⭐' };
      ctx.font = '100px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emojis[category] || '🍽️', 300, 190);
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, 300, 350);
      await saveImage(newItem.id, canvas.toDataURL('image/jpeg', 0.85));
    }

    // Force instant server sync for cross-device visibility
    await syncMenuToServer(getMenuItems());

    showToast(`"${name}" agregado al menú ✅ — visible al escanear el QR`, 'success');

    // Reset form
    document.getElementById('quick-add-form')?.reset();
    clearQuickImagePreview();
    document.getElementById('quick-item-model').value = 'burger';

    // Re-render the recently added list
    renderQuickAddedList();
  } catch (err) {
    console.error('Quick add error:', err);
    showToast('Error al agregar el platillo', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Agregar al Menú y Sincronizar';
    }
  }
}

function renderQuickAddedList() {
  const container = document.getElementById('quick-added-list');
  if (!container) return;

  const items = getMenuItems();
  const recent = items.slice(-8).reverse(); // Last 8 items, newest first

  if (recent.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8125rem; text-align:center;">Aún no hay productos agregados.</p>';
    return;
  }

  const config = getConfig();
  container.innerHTML = `
    <h4 style="font-size: 0.875rem; margin-bottom: var(--space-sm); color: var(--text-secondary);">📋 Productos en el menú (${items.length})</h4>
    <div class="quick-added-items">
      ${recent.map(item => {
        const emojis = { tacos:'🌮', burger:'🍔', pizza:'🍕', ribeye:'🥩', salad:'🥗', drink:'🥤', cocktail:'🍹', dessert:'🍮', salmon:'🐟', guacamole:'🥑' };
        return `
          <div class="quick-added-item">
            <span class="quick-added-emoji">${emojis[item.modelType] || '🍽️'}</span>
            <span class="quick-added-name">${item.name}</span>
            <span class="quick-added-price">${config.currency}${item.price}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
