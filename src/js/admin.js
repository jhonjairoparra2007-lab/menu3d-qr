/**
 * admin.js - Admin Panel Logic
 * Manages dishes, real-time 3D image uploads, AI moderation, orders, and restaurant settings
 */

import {
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  getOrders, updateOrderStatus,
  getConfig, saveConfig,
  saveImage, getImage, deleteImage,
  seedDemoData, listenForSync,
} from './storage.js';
import { analyzeImage, getAIStatusText } from './ai.js';
import { showToast } from './toast.js';
import { playKitchenBellSound } from './audio.js';

let currentSection = 'dashboard';
let currentEditingId = null;
let currentImageDataUrl = null;
let activeOrderFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await seedDemoData();

  initNavigation();
  initDashboard();
  initMenuManagement();
  initOrdersManagement();
  initSettings();
  initAIStatus();

  // Listen for real-time updates (cross-tab sync)
  listenForSync((data) => {
    if (data.type === 'new-order') {
      playKitchenBellSound();
      showToast(`🔔 ¡Nuevo pedido para cocina! Mesa ${data.order.table || 'Sin mesa'} (${data.order.orderNumber})`, 'success');
      refreshDashboard();
      if (currentSection === 'orders') renderOrders();
    } else if (data.type === 'menu-update') {
      if (currentSection === 'menu') renderMenuTable();
      refreshDashboard();
    }
  });
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

    // Trigger AI moderation & analysis
    if (aiBadge && aiText) {
      aiBadge.style.display = 'block';
      aiText.textContent = 'Analizando imagen con IA (moderación, categoría y descripción)...';

      try {
        const analysis = await analyzeImage(currentImageDataUrl);

        if (!analysis.moderation.safe) {
          aiText.innerHTML = `⚠️ <strong style="color:var(--color-danger)">Alerta de moderación:</strong> ${analysis.moderation.label || 'Contenido posiblemente inapropiado'}`;
          showToast('La imagen puede contener contenido inapropiado según la IA', 'warning');
        } else {
          aiText.innerHTML = `✅ <strong>Aprobado por IA:</strong> Contenido seguro · Sugerencia: ${analysis.classification?.category || 'General'}`;

          // Autofill description if empty
          const descInput = document.getElementById('item-desc');
          if (descInput && !descInput.value.trim() && analysis.caption?.description) {
            descInput.value = analysis.caption.description;
          }

          // Auto-select category if available
          const catSelect = document.getElementById('item-category');
          if (catSelect && analysis.classification?.category) {
            catSelect.value = analysis.classification.category;
          }
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
    if (currentEditingId) {
      updateMenuItem(currentEditingId, {
        name,
        description: desc,
        category,
        modelType,
        price,
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

  saveBtn?.addEventListener('click', handleSaveSettings);
  resetBtn?.addEventListener('click', handleResetDemo);

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

  if (nameInput) nameInput.value = config.restaurantName || '';
  if (currSelect) currSelect.value = config.currency || '$';
  if (tablesInput) tablesInput.value = config.tableCount || 20;
  if (whatsappInput) whatsappInput.value = config.whatsappNumber || '573146841042';
  if (baseUrlInput) baseUrlInput.value = config.baseUrl || 'http://192.168.1.35:3000';
  if (hfKeyInput) hfKeyInput.value = config.hfApiKey || '';
  if (aiEnabledCheck) aiEnabledCheck.checked = config.aiEnabled !== false;
}

function handleSaveSettings() {
  const config = getConfig();

  config.restaurantName = document.getElementById('cfg-name').value.trim() || 'Mi Restaurante';
  config.currency = document.getElementById('cfg-currency').value;
  config.tableCount = parseInt(document.getElementById('cfg-tables').value) || 20;
  config.whatsappNumber = document.getElementById('cfg-whatsapp')?.value.trim() || '573146841042';
  config.baseUrl = document.getElementById('cfg-base-url')?.value.trim() || 'http://192.168.1.35:3000';
  config.hfApiKey = document.getElementById('cfg-hf-key').value.trim();
  config.aiEnabled = document.getElementById('cfg-ai-enabled').checked;

  saveConfig(config);
  initAIStatus();
  showToast('Configuración guardada exitosamente', 'success');
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
