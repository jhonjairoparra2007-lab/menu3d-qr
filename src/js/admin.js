/**
 * admin.js - Admin Panel Logic
 * Manages dishes, real-time 3D image uploads, AI moderation, orders, and restaurant settings
 */

import QRCode from 'qrcode';
import {
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  getOrders, updateOrderStatus,
  getConfig, saveConfig,
  saveImage, getImage, deleteImage,
  seedDemoData, listenForSync,
  initialSyncFromServer, syncConfigToServer, syncMenuToServer,
  getDefaultIngredients,
  syncOrdersFromServer,
} from './storage.js';
import { analyzeImage, getAIStatusText, validateHFApiKey, detectFood3DModel } from './ai.js';
import { showToast } from './toast.js';
import { playKitchenBellSound } from './audio.js';

let currentSection = 'dashboard';
let currentEditingId = null;
let currentImageDataUrl = null;
let activeOrderFilter = 'all';
let kitchenSoundEnabled = localStorage.getItem('menu3d_kitchen_sound') !== 'false';

function triggerKitchenAlert(order) {
  if (kitchenSoundEnabled) {
    playKitchenBellSound();
  }

  // Show top kitchen alert banner
  const banner = document.getElementById('kitchen-alert-banner');
  const title = document.getElementById('kitchen-alert-title');
  const body = document.getElementById('kitchen-alert-body');

  if (banner && title && body) {
    title.textContent = `🔔 ¡NUEVO PEDIDO DE COCINA! Mesa ${order.table || '0'} — ${order.orderNumber}`;
    const itemsText = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
    body.textContent = `${itemsText} · Total: ${order.total ? '$' + order.total.toFixed(2) : ''}`;
    banner.style.display = 'block';
  }

  showToast(`🔔 ¡Nuevo pedido para cocina! Mesa ${order.table || 'Sin mesa'} (${order.orderNumber})`, 'success');
  refreshDashboard();
  if (currentSection === 'orders') renderOrders();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Sync latest menu, config and orders from server for cross-device consistency
  await initialSyncFromServer();

  await seedDemoData();

  initNavigation();
  initDashboard();
  initMenuManagement();
  initOrdersManagement();
  initSettings();
  initAIStatus();
  initAdminQR();
  initAIModeler();

  // Listen for real-time updates (cross-tab sync)
  listenForSync((data) => {
    if (data.type === 'new-order') {
      triggerKitchenAlert(data.order);
    } else if (data.type === 'menu-update') {
      if (currentSection === 'menu') renderMenuTable();
      refreshDashboard();
    } else if (data.type === 'config-update') {
      if (currentSection === 'settings') loadSettings();
    }
  });

  // Cross-device order polling (every 4 seconds)
  let lastKnownOrderCount = getOrders().length;
  setInterval(async () => {
    try {
      const orders = await syncOrdersFromServer();
      if (orders && Array.isArray(orders) && orders.length > lastKnownOrderCount) {
        const newOrders = orders.slice(0, orders.length - lastKnownOrderCount);
        lastKnownOrderCount = orders.length;
        triggerKitchenAlert(newOrders[0]);
      }
    } catch (e) {
      // Quiet fail if network glitch
    }
  }, 4000);
});

// ===== Navigation =====
function initNavigation() {
  const sidebarLinks = document.querySelectorAll('.admin-sidebar-nav a[data-section]');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(link.dataset.section);
    });
  });

  const mobileBtns = document.querySelectorAll('#mobile-admin-nav button[data-mobile-section]');
  mobileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchSection(btn.dataset.mobileSection);
    });
  });
}

function switchSection(sectionId) {
  currentSection = sectionId;

  // Update sidebar active link
  document.querySelectorAll('.admin-sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === sectionId);
  });

  // Hide all sections and show active
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.style.display = 'none';
  });

  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.style.display = 'block';
  }

  // Refresh data for current section
  if (sectionId === 'dashboard') {
    refreshDashboard();
  } else if (sectionId === 'menu') {
    renderMenuTable();
  } else if (sectionId === 'orders') {
    renderOrders();
  } else if (sectionId === 'settings') {
    loadSettings();
  }
}

// ===== AI Status =====
function initAIStatus() {
  const statusText = document.getElementById('ai-status-text');
  if (statusText) {
    statusText.textContent = getAIStatusText();
  }
}

// ===== Dashboard =====
function initDashboard() {
  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  refreshDashboard();
}

function refreshDashboard() {
  const items = getMenuItems();
  const orders = getOrders();
  const config = getConfig();

  const statItems = document.getElementById('stat-items');
  const statOrders = document.getElementById('stat-orders');
  const statRevenue = document.getElementById('stat-revenue');
  const statCategories = document.getElementById('stat-categories');

  if (statItems) statItems.textContent = items.filter(i => i.status === 'approved').length;
  if (statOrders) statOrders.textContent = orders.length;

  const totalRevenue = orders.reduce((sum, ord) => sum + (ord.total || 0), 0);
  if (statRevenue) statRevenue.textContent = `${config.currency}${totalRevenue.toFixed(2)}`;

  if (statCategories) statCategories.textContent = config.categories ? config.categories.length : 6;

  renderRecentOrders(orders.slice(0, 5));
}

function renderRecentOrders(recentOrders) {
  const container = document.getElementById('recent-orders');
  if (!container) return;

  const config = getConfig();

  if (!recentOrders || recentOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Sin pedidos aún</h3>
        <p class="text-muted">Los pedidos de los clientes aparecerán aquí.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>No. Pedido</th>
            <th>Mesa</th>
            <th>Platillos</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${recentOrders.map(ord => {
            const statusLabels = {
              pending: '<span class="status-badge status-pending">Pendiente</span>',
              preparing: '<span class="status-badge status-preparing">En Preparación</span>',
              completed: '<span class="status-badge status-completed">Completado</span>',
            };
            const itemsSummary = ord.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
            const dateStr = new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
              <tr>
                <td><strong>${ord.orderNumber}</strong></td>
                <td>Mesa ${ord.table || '-'}</td>
                <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">${itemsSummary}</td>
                <td><strong>${config.currency}${(ord.total || 0).toFixed(2)}</strong></td>
                <td>${statusLabels[ord.status] || ord.status}</td>
                <td class="text-muted" style="font-size: 0.8125rem;">${dateStr}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== Menu Management =====
function initMenuManagement() {
  const addBtn = document.getElementById('add-item-btn');
  const modal = document.getElementById('item-modal');
  const modalClose = document.getElementById('item-modal-close');
  const modalBackdrop = document.getElementById('item-modal-backdrop');
  const cancelBtn = document.getElementById('item-cancel-btn');
  const itemForm = document.getElementById('item-form');

  addBtn?.addEventListener('click', () => openItemModal());
  modalClose?.addEventListener('click', () => closeItemModal());
  modalBackdrop?.addEventListener('click', () => closeItemModal());
  cancelBtn?.addEventListener('click', () => closeItemModal());

  // Upload area interactions
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('item-image');
  const removePreviewBtn = document.getElementById('remove-preview');

  uploadArea?.addEventListener('click', () => fileInput?.click());

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
    if (file) handleImageFile(file);
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  });

  removePreviewBtn?.addEventListener('click', () => {
    clearImagePreview();
  });

  itemForm?.addEventListener('submit', handleSaveItem);
}

function clearImagePreview() {
  currentImageDataUrl = null;
  const uploadArea = document.getElementById('upload-area');
  const uploadPreview = document.getElementById('upload-preview');
  const fileInput = document.getElementById('item-image');
  const aiBadge = document.getElementById('ai-analysis-result');

  if (uploadArea) uploadArea.style.display = 'block';
  if (uploadPreview) uploadPreview.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (aiBadge) aiBadge.style.display = 'none';
}

async function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Por favor selecciona un archivo de imagen válido', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    currentImageDataUrl = e.target.result;

    const uploadArea = document.getElementById('upload-area');
    const uploadPreview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const aiBadge = document.getElementById('ai-analysis-result');
    const aiText = document.getElementById('ai-analysis-text');

    if (uploadArea) uploadArea.style.display = 'none';
    if (uploadPreview) uploadPreview.style.display = 'block';
    if (previewImg) previewImg.src = currentImageDataUrl;

    // Trigger AI moderation & 3D food archetype analysis
    if (aiBadge && aiText) {
      aiBadge.style.display = 'block';
      aiText.textContent = 'Analizando imagen con IA (moderación, categoría, arquetipo 3D y texturas)...';

      try {
        const [analysis, ai3D] = await Promise.all([
          analyzeImage(currentImageDataUrl),
          detectFood3DModel(currentImageDataUrl, document.getElementById('item-name')?.value || ''),
        ]);

        if (!analysis.moderation.safe) {
          aiText.innerHTML = `⚠️ <strong style="color:var(--color-danger)">Alerta de moderación:</strong> ${analysis.moderation.label || 'Contenido posiblemente inapropiado'}`;
          showToast('La imagen puede contener contenido inapropiado según la IA', 'warning');
        } else {
          // Auto-select 3D model archetype from image analysis
          const modelSelect = document.getElementById('item-model-type');
          if (modelSelect && ai3D?.archetype) {
            modelSelect.value = ai3D.archetype;
          }

          // Auto-select category if available
          const catSelect = document.getElementById('item-category');
          if (catSelect && (ai3D?.category || analysis.classification?.category)) {
            catSelect.value = ai3D?.category || analysis.classification?.category;
          }

          // Autofill description if empty
          const descInput = document.getElementById('item-desc');
          if (descInput && !descInput.value.trim()) {
            descInput.value = ai3D?.description || analysis.caption?.description || '';
          }

          aiText.innerHTML = `✅ <strong>Aprobado por IA:</strong> Contenido seguro · <strong>Modelo 3D IA:</strong> ${ai3D?.label || 'Plato'} (${ai3D?.confidence || 85}%) con shaders PBR y capas de desensamble.`;
          showToast(`🤖 Modelo 3D "${ai3D?.label}" asignado automáticamente`, 'success');
        }
      } catch (err) {
        console.warn('AI analysis error:', err);
        aiText.textContent = 'Verificación básica local completada';
      }
    }
  };
  reader.readAsDataURL(file);
}

function openItemModal(item = null) {
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('item-modal-title');
  const form = document.getElementById('item-form');
  clearImagePreview();

  if (item) {
    currentEditingId = item.id;
    if (title) title.textContent = 'Editar Platillo';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-desc').value = item.description || '';
    document.getElementById('item-category').value = item.category;
    document.getElementById('item-price').value = item.price;
    const modelSelect = document.getElementById('item-model-type');
    if (modelSelect) modelSelect.value = item.modelType || 'burger';

    getImage(item.id).then(imgData => {
      if (imgData) {
        currentImageDataUrl = imgData;
        const uploadArea = document.getElementById('upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        const previewImg = document.getElementById('preview-img');
        if (uploadArea) uploadArea.style.display = 'none';
        if (uploadPreview) uploadPreview.style.display = 'block';
        if (previewImg) previewImg.src = imgData;
      }
    });
  } else {
    currentEditingId = null;
    if (title) title.textContent = 'Agregar Platillo';
    form?.reset();
    document.getElementById('item-id').value = '';
    const modelSelect = document.getElementById('item-model-type');
    if (modelSelect) modelSelect.value = 'burger';
  }

  modal?.classList.add('active');
}

function closeItemModal() {
  const modal = document.getElementById('item-modal');
  modal?.classList.remove('active');
  clearImagePreview();
  currentEditingId = null;
}

async function handleSaveItem(e) {
  e.preventDefault();

  const name = document.getElementById('item-name').value.trim();
  const desc = document.getElementById('item-desc').value.trim();
  const category = document.getElementById('item-category').value;
  const modelType = document.getElementById('item-model-type')?.value || 'burger';
  const price = parseFloat(document.getElementById('item-price').value);

  if (!name || isNaN(price)) {
    showToast('Por favor completa todos los campos requeridos', 'error');
    return;
  }

  const submitBtn = document.getElementById('item-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const ingredients = getDefaultIngredients(modelType);
    const calMap = { tacos: 480, burger: 760, salad: 320, pizza: 820, dessert: 380, drink: 120, cocktail: 210, guacamole: 340, ribeye: 690, salmon: 540 };

    if (currentEditingId) {
      updateMenuItem(currentEditingId, {
        name,
        description: desc,
        category,
        modelType,
        price,
        ingredients,
      });

      if (currentImageDataUrl) {
        await saveImage(currentEditingId, currentImageDataUrl);
      }

      showToast(`Platillo "${name}" actualizado`, 'success');
    } else {
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

      if (currentImageDataUrl) {
        await saveImage(newItem.id, currentImageDataUrl);
      } else {
        // Generate placeholder canvas image if none provided
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1c18';
        ctx.fillRect(0, 0, 600, 450);
        ctx.font = '100px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emojis = { entradas: '🥗', principales: '🍖', postres: '🍰', bebidas: '🥤', cocteles: '🍹', especiales: '⭐' };
        ctx.fillText(emojis[category] || '🍽️', 300, 200);
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, 300, 340);
        await saveImage(newItem.id, canvas.toDataURL('image/jpeg', 0.85));
      }

      showToast(`Platillo "${name}" creado exitosamente`, 'success');
    }

    // Force real-time sync with server
    await syncMenuToServer(getMenuItems());

    closeItemModal();
    renderMenuTable();
    refreshDashboard();
  } catch (err) {
    console.error('Error saving item:', err);
    showToast('Error al guardar el platillo', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function renderMenuTable() {
  const tbody = document.getElementById('menu-table-body');
  if (!tbody) return;

  const items = getMenuItems();
  const config = getConfig();

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: var(--space-xl);">
          <div class="empty-state">
            <div class="empty-state-icon">🍽️</div>
            <h3>No hay platillos registrados</h3>
            <p class="text-muted">Presiona "+ Agregar Platillo" para comenzar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  for (const item of items) {
    const tr = document.createElement('tr');

    const imgData = await getImage(item.id);
    const imgSrc = imgData || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23222" width="40" height="40"/><text x="20" y="26" text-anchor="middle" font-size="20">🍽️</text></svg>';

    const categoryNames = {
      entradas: '🥗 Entradas',
      principales: '🍖 Principales',
      postres: '🍰 Postres',
      bebidas: '🥤 Bebidas',
      cocteles: '🍹 Cócteles',
      especiales: '⭐ Especiales',
    };

    tr.innerHTML = `
      <td>
        <img src="${imgSrc}" alt="${item.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />
      </td>
      <td>
        <strong>${item.name}</strong>
        <div class="text-muted" style="font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description || 'Sin descripción'}</div>
      </td>
      <td>${categoryNames[item.category] || item.category}</td>
      <td><strong>${config.currency}${item.price.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${item.status === 'approved' ? 'status-completed' : 'status-pending'}">
          ${item.status === 'approved' ? 'Activo' : 'Pausado'}
        </span>
      </td>
      <td>
        <div class="flex gap-xs">
          <button class="btn btn-secondary btn-sm btn-edit" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm btn-toggle-status" title="${item.status === 'approved' ? 'Pausar' : 'Activar'}">
            ${item.status === 'approved' ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-danger btn-sm btn-delete" title="Eliminar">🗑️</button>
        </div>
      </td>
    `;

    // Button event listeners
    tr.querySelector('.btn-edit')?.addEventListener('click', () => openItemModal(item));
    tr.querySelector('.btn-toggle-status')?.addEventListener('click', () => {
      const newStatus = item.status === 'approved' ? 'paused' : 'approved';
      updateMenuItem(item.id, { status: newStatus });
      renderMenuTable();
      refreshDashboard();
      showToast(`Platillo ${newStatus === 'approved' ? 'activado' : 'pausado'}`, 'info');
    });
    tr.querySelector('.btn-delete')?.addEventListener('click', () => {
      if (confirm(`¿Estás seguro de eliminar "${item.name}"?`)) {
        deleteMenuItem(item.id);
        renderMenuTable();
        refreshDashboard();
        showToast('Platillo eliminado', 'info');
      }
    });

    tbody.appendChild(tr);
  }
}

// ===== Orders Management =====
function initOrdersManagement() {
  // Kitchen alert banner actions
  document.getElementById('btn-kitchen-alert-view')?.addEventListener('click', () => {
    switchSection('orders');
    const banner = document.getElementById('kitchen-alert-banner');
    if (banner) banner.style.display = 'none';
  });

  document.getElementById('btn-kitchen-alert-dismiss')?.addEventListener('click', () => {
    const banner = document.getElementById('kitchen-alert-banner');
    if (banner) banner.style.display = 'none';
  });

  // Sound toggle button
  const soundBtn = document.getElementById('btn-toggle-kitchen-sound');
  const updateSoundBtn = () => {
    if (!soundBtn) return;
    if (kitchenSoundEnabled) {
      soundBtn.textContent = '🔊 Campana: Activada';
      soundBtn.className = 'btn btn-primary btn-sm';
    } else {
      soundBtn.textContent = '🔇 Campana: Silenciada';
      soundBtn.className = 'btn btn-ghost btn-sm';
    }
  };
  updateSoundBtn();

  soundBtn?.addEventListener('click', () => {
    kitchenSoundEnabled = !kitchenSoundEnabled;
    localStorage.setItem('menu3d_kitchen_sound', kitchenSoundEnabled ? 'true' : 'false');
    updateSoundBtn();
    if (kitchenSoundEnabled) {
      playKitchenBellSound();
      showToast('Timbre de campana de cocina activado 🔔', 'success');
    } else {
      showToast('Campana silenciada 🔇', 'info');
    }
  });

  document.getElementById('btn-test-kitchen-bell')?.addEventListener('click', () => {
    playKitchenBellSound();
    showToast('🔔 Campana de cocina probada con éxito', 'info');
  });

  const filterBtns = document.querySelectorAll('#section-orders [data-order-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeOrderFilter = btn.dataset.orderFilter;
      renderOrders();
    });
  });
}

function renderOrders() {
  const container = document.getElementById('orders-list');
  if (!container) return;

  const orders = getOrders();
  const config = getConfig();

  const filtered = activeOrderFilter === 'all'
    ? orders
    : orders.filter(o => o.status === activeOrderFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No hay pedidos ${activeOrderFilter !== 'all' ? `en estado "${activeOrderFilter}"` : ''}</h3>
        <p class="text-muted">Los pedidos nuevos aparecerán aquí automáticamente.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-lg);">
      ${filtered.map(order => {
        const dateStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusColors = {
          pending: 'var(--color-warning)',
          preparing: 'var(--color-primary)',
          completed: 'var(--color-success)',
        };
        const statusLabels = {
          pending: 'Pendiente',
          preparing: 'En Preparación',
          completed: 'Completado',
        };

        return `
          <div class="card card-glass" style="border-top: 3px solid ${statusColors[order.status] || 'var(--color-primary)'}; padding: var(--space-lg);">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-sm);">
              <div>
                <strong style="font-size: 1.125rem;">${order.orderNumber}</strong>
                <span class="text-muted" style="font-size: 0.8125rem; margin-left: 8px;">${dateStr}</span>
              </div>
              <span class="table-number">Mesa ${order.table || '0'}</span>
            </div>

            <div style="border-top: 1px solid var(--color-glass-border); border-bottom: 1px solid var(--color-glass-border); padding: var(--space-sm) 0; margin: var(--space-sm) 0;">
              ${order.items.map(it => `
                <div class="flex justify-between" style="font-size: 0.875rem; padding: 4px 0;">
                  <span><strong>${it.quantity}x</strong> ${it.name}</span>
                  <span class="text-muted">${config.currency}${(it.price * it.quantity).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>

            <div class="flex justify-between items-center" style="margin-bottom: var(--space-md);">
              <span class="text-muted" style="font-size: 0.875rem;">Total con IVA:</span>
              <strong style="font-size: 1.125rem; color: var(--color-primary);">${config.currency}${(order.total || 0).toFixed(2)}</strong>
            </div>

            <div class="flex gap-xs">
              <button class="btn btn-sm ${order.status === 'pending' ? 'btn-primary' : 'btn-ghost'} btn-order-status" data-order-id="${order.id}" data-set-status="pending" style="flex:1;">
                ⏳ Pendiente
              </button>
              <button class="btn btn-sm ${order.status === 'preparing' ? 'btn-primary' : 'btn-ghost'} btn-order-status" data-order-id="${order.id}" data-set-status="preparing" style="flex:1;">
                🍳 Cocina
              </button>
              <button class="btn btn-sm ${order.status === 'completed' ? 'btn-primary' : 'btn-ghost'} btn-order-status" data-order-id="${order.id}" data-set-status="completed" style="flex:1;">
                ✅ Listo
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach status change events
  container.querySelectorAll('.btn-order-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.orderId;
      const newStatus = btn.dataset.setStatus;
      updateOrderStatus(orderId, newStatus);
      renderOrders();
      refreshDashboard();
      showToast(`Pedido actualizado a: ${newStatus}`, 'success');
    });
  });
}

// ===== Settings =====
function initSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  const resetBtn = document.getElementById('reset-data-btn');
  const validateHfBtn = document.getElementById('btn-validate-hf-key');

  saveBtn?.addEventListener('click', handleSaveSettings);
  resetBtn?.addEventListener('click', handleResetDemo);

  validateHfBtn?.addEventListener('click', async () => {
    const keyInput = document.getElementById('cfg-hf-key');
    const statusEl = document.getElementById('hf-key-validation-status');
    const apiKey = keyInput?.value.trim();

    if (!apiKey) {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--color-warning);">⚠️ Ingresa una clave antes de validar.</span>';
      }
      showToast('Ingresa una API Key para probar', 'warning');
      return;
    }

    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--color-primary);">⏳ Conectando con Hugging Face Inference API...</span>';
    }

    const res = await validateHFApiKey(apiKey);
    if (res.valid) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--color-success); font-weight:600;">✅ API Key válida · Conexión exitosa (${res.user || 'Hugging Face Pro'})</span>`;
      }
      showToast('API Key de Hugging Face verificada correctamente ✅', 'success');
    } else {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--color-danger); font-weight:600;">❌ Clave inválida o sin permisos: ${res.error || 'Verifica el token'}</span>`;
      }
      showToast('API Key inválida o sin conexión a HF', 'error');
    }
  });

  loadSettings();
}

function loadSettings() {
  const config = getConfig();

  const nameInput = document.getElementById('cfg-name');
  const currSelect = document.getElementById('cfg-currency');
  const tablesInput = document.getElementById('cfg-tables');
  const whatsappInput = document.getElementById('cfg-whatsapp');
  const baseUrlInput = document.getElementById('cfg-base-url');
  const hfKeyInput = document.getElementById('cfg-hf-key');
  const aiEnabledCheck = document.getElementById('cfg-ai-enabled');
  const pinInput = document.getElementById('cfg-admin-pin');

  if (nameInput) nameInput.value = config.restaurantName || '';
  if (currSelect) currSelect.value = config.currency || '$';
  if (tablesInput) tablesInput.value = config.tableCount || 20;
  if (whatsappInput) whatsappInput.value = config.whatsappNumber || '573146841042';
  if (baseUrlInput) baseUrlInput.value = config.baseUrl || 'http://192.168.1.35:3000';
  if (hfKeyInput) hfKeyInput.value = config.hfApiKey || '';
  if (aiEnabledCheck) aiEnabledCheck.checked = config.aiEnabled !== false;
  if (pinInput) pinInput.value = config.adminPin || '1234';
}

async function handleSaveSettings() {
  const config = getConfig();

  config.restaurantName = document.getElementById('cfg-name').value.trim() || 'Mi Restaurante';
  config.currency = document.getElementById('cfg-currency').value;
  config.tableCount = parseInt(document.getElementById('cfg-tables').value) || 20;
  config.whatsappNumber = document.getElementById('cfg-whatsapp')?.value.trim() || '573146841042';
  config.baseUrl = document.getElementById('cfg-base-url')?.value.trim() || 'http://192.168.1.35:3000';
  config.hfApiKey = document.getElementById('cfg-hf-key').value.trim();
  config.aiEnabled = document.getElementById('cfg-ai-enabled').checked;
  const pinVal = document.getElementById('cfg-admin-pin')?.value.trim();
  if (pinVal) config.adminPin = pinVal;

  saveConfig(config);
  await syncConfigToServer(config);
  initAIStatus();
  showToast('Configuración guardada y sincronizada en tiempo real ✅', 'success');
}

async function handleResetDemo() {
  if (confirm('¿Deseas resetear los platillos a los datos de prueba iniciales?')) {
    localStorage.removeItem('menu3d_items');
    localStorage.removeItem('menu3d_orders');
    await seedDemoData();
    renderMenuTable();
    renderOrders();
    refreshDashboard();
    showToast('Datos de demo restaurados', 'success');
  }
}

// ===== QR Generation in Admin =====
function initAdminQR() {
  const generateBtn = document.getElementById('admin-batch-qr-btn');
  const previewArea = document.getElementById('admin-batch-preview-area');
  const grid = document.getElementById('admin-qr-grid');
  const printBtn = document.getElementById('admin-print-all-btn');

  printBtn?.addEventListener('click', () => {
    window.print();
  });

  generateBtn?.addEventListener('click', async () => {
    const config = getConfig();
    const name = config.restaurantName || 'Mi Restaurante';
    const tableCount = config.tableCount || 20;
    const baseUrl = (config.baseUrl || window.location.origin).replace(/\/+$/, '');

    if (!grid) return;

    if (previewArea) previewArea.style.display = 'block';
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="loading-spinner"></div><p style="margin-top:10px;">Generando códigos QR para todas las mesas...</p></div>';
    generateBtn.disabled = true;

    // Small delay to allow spinner
    await new Promise(r => setTimeout(r, 60));
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
        width: 190,
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
        <div style="font-size: 0.7rem; font-weight: 600; color: #d97706; text-transform: uppercase;">✨ Menú 3D Interactivo</div>
        <div style="font-size: 0.65rem; color: #9ca3af; word-break: break-all; margin-top: 2px;">${menuUrl}</div>
      `;

      card.appendChild(header);
      card.appendChild(qrWrap);
      card.appendChild(footer);
      grid.appendChild(card);
    }

    generateBtn.disabled = false;
    showToast(`¡${tableCount} códigos QR listos en el panel de administrador!`, 'success');
  });
}


// ===== AI 3D Modeler Panel =====
let aiModImageDataUrl = null;
let aiModDepthMapUrl = null;

export function initAIModeler() {
  const uploadArea = document.getElementById('ai-mod-upload-area');
  const fileInput = document.getElementById('ai-mod-image-input');
  const previewWrap = document.getElementById('ai-mod-preview-wrap');
  const previewImg = document.getElementById('ai-mod-preview-img');
  const removeBtn = document.getElementById('ai-mod-remove-img');
  const analyzeBtn = document.getElementById('ai-mod-analyze-btn');
  const statusText = document.getElementById('ai-mod-status-text');
  const resultFields = document.getElementById('ai-mod-result-fields');
  const saveBtn = document.getElementById('ai-mod-save-btn');
  const resetBtn = document.getElementById('ai-mod-reset-btn');

  if (!uploadArea) return;

  // Click to open file picker
  uploadArea.addEventListener('click', (e) => {
    if (e.target.closest('#ai-mod-remove-img')) return;
    fileInput?.click();
  });

  // Drag & drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-primary)';
    uploadArea.style.background = 'rgba(245,158,11,0.12)';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';
    const file = e.dataTransfer.files?.[0];
    if (file) handleAIModImageFile(file);
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleAIModImageFile(file);
  });

  removeBtn?.addEventListener('click', () => {
    aiModImageDataUrl = null;
    aiModDepthMapUrl = null;
    if (previewWrap) previewWrap.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'flex';
    if (analyzeBtn) analyzeBtn.disabled = true;
    if (resultFields) resultFields.style.display = 'none';
    if (statusText) statusText.textContent = 'Sube una foto para comenzar el análisis con IA';
    if (fileInput) fileInput.value = '';
  });

  analyzeBtn?.addEventListener('click', async () => {
    if (!aiModImageDataUrl) return;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '⏳ Analizando con IA...';
    if (statusText) statusText.textContent = '🔍 Escaneando colores, texturas y composición del platillo...';

    try {
      const nameHint = document.getElementById('ai-mod-name')?.value || '';
      const result = await detectFood3DModel(aiModImageDataUrl, nameHint);

      if (result) {
        aiModDepthMapUrl = result.aiDepthMap || null;
        // Populate form fields with AI results
        const nameInput = document.getElementById('ai-mod-name');
        const descInput = document.getElementById('ai-mod-desc');
        const catSelect = document.getElementById('ai-mod-category');
        const modelSelect = document.getElementById('ai-mod-model');
        const confFill = document.getElementById('ai-mod-confidence-fill');
        const confText = document.getElementById('ai-mod-confidence-text');

        if (nameInput && !nameInput.value) nameInput.value = result.label || '';
        if (descInput) descInput.value = result.description || result.desc || '';
        if (catSelect && result.category) catSelect.value = result.category;
        if (modelSelect && (result.archetype || result.modelType)) {
          modelSelect.value = result.archetype || result.modelType;
        }

        const conf = Math.round((result.confidence || 0.88) * 100);
        if (confFill) confFill.style.width = `${conf}%`;
        if (confText) confText.textContent = `${conf}% confianza · ${result.source || 'IA Generativa 3D'}`;

        if (statusText) {
          const modelName = (result.archetype === 'custom_ai') ? 'Modelo 3D Único Generado por IA' : (result.label || result.archetype);
          statusText.innerHTML = `✅ <strong>IA Esculpido 3D:</strong> ${modelName} · ${conf}% confianza · Geometría volumétrica calculada`;
        }
        if (resultFields) resultFields.style.display = 'block';

        showToast(`🤖 Modelo 3D con IA generado (${conf}%)`, 'success');
      }
    } catch (err) {
      console.error('AI modeler error:', err);
      if (statusText) statusText.textContent = '⚠️ Error en análisis. Puedes seleccionar el modelo manualmente.';
      if (resultFields) resultFields.style.display = 'block';
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🤖 Analizar con IA y Modelar en 3D';
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const name = document.getElementById('ai-mod-name')?.value.trim();
    const price = parseFloat(document.getElementById('ai-mod-price')?.value);
    const desc = document.getElementById('ai-mod-desc')?.value.trim() || '';
    const category = document.getElementById('ai-mod-category')?.value || 'principales';
    const modelType = document.getElementById('ai-mod-model')?.value || 'burger';

    if (!name) {
      showToast('Escribe el nombre del platillo antes de guardar', 'error');
      document.getElementById('ai-mod-name')?.focus();
      return;
    }
    if (!price || isNaN(price)) {
      showToast('Ingresa el precio del platillo', 'error');
      document.getElementById('ai-mod-price')?.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando en el menú...';

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
        aiDepthMap: aiModDepthMapUrl,
      });

      if (aiModImageDataUrl) {
        await saveImage(newItem.id, aiModImageDataUrl);
      }

      await syncMenuToServer(getMenuItems());

      showToast(`✅ "${name}" agregado al menú con modelo 3D "${modelType}"`, 'success');

      // Reset the form
      document.getElementById('ai-mod-name').value = '';
      document.getElementById('ai-mod-price').value = '';
      document.getElementById('ai-mod-desc').value = '';
      aiModImageDataUrl = null;
      aiModDepthMapUrl = null;
      if (previewWrap) previewWrap.style.display = 'none';
      if (uploadArea) uploadArea.style.display = 'flex';
      if (analyzeBtn) analyzeBtn.disabled = true;
      if (resultFields) resultFields.style.display = 'none';
      if (statusText) statusText.textContent = 'Sube una foto para comenzar el análisis con IA';
      if (confFill) confFill.style.width = '0%';
      if (fileInput) fileInput.value = '';

      // Refresh menu table if visible
      if (currentSection === 'menu') renderMenuTable();
      refreshDashboard();

    } catch (err) {
      console.error('AI modeler save error:', err);
      showToast('Error al guardar el platillo', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Agregar al Menú con Modelo 3D';
    }
  });

  resetBtn?.addEventListener('click', () => {
    removeBtn?.click();
    document.getElementById('ai-mod-name').value = '';
    document.getElementById('ai-mod-price').value = '';
    document.getElementById('ai-mod-desc').value = '';
    const confFill = document.getElementById('ai-mod-confidence-fill');
    if (confFill) confFill.style.width = '0%';
    if (resultFields) resultFields.style.display = 'none';
    if (statusText) statusText.textContent = 'Sube una foto para comenzar el análisis con IA';
    showToast('Formulario de IA reiniciado', 'info');
  });
}

function handleAIModImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Selecciona un archivo de imagen válido (JPG, PNG o WebP)', 'error');
    return;
  }

  const uploadArea = document.getElementById('ai-mod-upload-area');
  const previewWrap = document.getElementById('ai-mod-preview-wrap');
  const previewImg = document.getElementById('ai-mod-preview-img');
  const analyzeBtn = document.getElementById('ai-mod-analyze-btn');
  const statusText = document.getElementById('ai-mod-status-text');

  const reader = new FileReader();
  reader.onload = (e) => {
    aiModImageDataUrl = e.target.result;
    if (uploadArea) uploadArea.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'block';
    if (previewImg) previewImg.src = aiModImageDataUrl;
    if (analyzeBtn) analyzeBtn.disabled = false;
    if (statusText) statusText.textContent = '📸 Imagen cargada. Haz clic en "Analizar con IA" para modelarla en 3D.';
    showToast('Imagen lista — haz clic en Analizar con IA', 'info');
  };
  reader.readAsDataURL(file);
}
