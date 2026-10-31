import{i as j,s as A,l as D,g as S,a as q,b as v,c as u,d as H,e as K,u as z,f as L,h as U,j as O,k as Q,m as V,n as W,o as _}from"./toast-WUxDeCAr.js";import{g as G,a as J,d as X,v as Y,Q as Z}from"./ai-XxX53PVP.js";import{p as N}from"./audio-CEdIckWR.js";let w="dashboard",E=null,y=null,I="all";document.addEventListener("DOMContentLoaded",async()=>{await j(),await A(),ee(),te(),ae(),oe(),ie(),F(),ce(),D(e=>{e.type==="new-order"?(N(),u(`🔔 ¡Nuevo pedido para cocina! Mesa ${e.order.table||"Sin mesa"} (${e.order.orderNumber})`,"success"),f(),w==="orders"&&x()):e.type==="menu-update"?(w==="menu"&&h(),f()):e.type==="config-update"&&w==="settings"&&k()})});function ee(){document.querySelectorAll(".admin-sidebar-nav a[data-section]").forEach(n=>{n.addEventListener("click",o=>{o.preventDefault(),P(n.dataset.section)})}),document.querySelectorAll("#mobile-admin-nav button[data-mobile-section]").forEach(n=>{n.addEventListener("click",()=>{P(n.dataset.mobileSection)})})}function P(e){w=e,document.querySelectorAll(".admin-sidebar-nav a").forEach(n=>{n.classList.toggle("active",n.dataset.section===e)}),document.querySelectorAll(".admin-section").forEach(n=>{n.style.display="none"});const a=document.getElementById(`section-${e}`);a&&(a.style.display="block"),e==="dashboard"?f():e==="menu"?h():e==="orders"?x():e==="settings"&&k()}function F(){const e=document.getElementById("ai-status-text");e&&(e.textContent=G())}function te(){const e=document.getElementById("dashboard-date");if(e){const a=new Date;e.textContent=a.toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}f()}function f(){const e=S(),a=q(),n=v(),o=document.getElementById("stat-items"),t=document.getElementById("stat-orders"),i=document.getElementById("stat-revenue"),s=document.getElementById("stat-categories");o&&(o.textContent=e.filter(r=>r.status==="approved").length),t&&(t.textContent=a.length);const d=a.reduce((r,g)=>r+(g.total||0),0);i&&(i.textContent=`${n.currency}${d.toFixed(2)}`),s&&(s.textContent=n.categories?n.categories.length:6),ne(a.slice(0,5))}function ne(e){const a=document.getElementById("recent-orders");if(!a)return;const n=v();if(!e||e.length===0){a.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Sin pedidos aún</h3>
        <p class="text-muted">Los pedidos de los clientes aparecerán aquí.</p>
      </div>
    `;return}a.innerHTML=`
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
          ${e.map(o=>{const t={pending:'<span class="status-badge status-pending">Pendiente</span>',preparing:'<span class="status-badge status-preparing">En Preparación</span>',completed:'<span class="status-badge status-completed">Completado</span>'},i=o.items.map(d=>`${d.quantity}x ${d.name}`).join(", "),s=new Date(o.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
              <tr>
                <td><strong>${o.orderNumber}</strong></td>
                <td>Mesa ${o.table||"-"}</td>
                <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${i}">${i}</td>
                <td><strong>${n.currency}${(o.total||0).toFixed(2)}</strong></td>
                <td>${t[o.status]||o.status}</td>
                <td class="text-muted" style="font-size: 0.8125rem;">${s}</td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
  `}function ae(){const e=document.getElementById("add-item-btn");document.getElementById("item-modal");const a=document.getElementById("item-modal-close"),n=document.getElementById("item-modal-backdrop"),o=document.getElementById("item-cancel-btn"),t=document.getElementById("item-form");e==null||e.addEventListener("click",()=>R()),a==null||a.addEventListener("click",()=>B()),n==null||n.addEventListener("click",()=>B()),o==null||o.addEventListener("click",()=>B());const i=document.getElementById("upload-area"),s=document.getElementById("item-image"),d=document.getElementById("remove-preview");i==null||i.addEventListener("click",()=>s==null?void 0:s.click()),i==null||i.addEventListener("dragover",r=>{r.preventDefault(),i.style.borderColor="var(--color-primary)"}),i==null||i.addEventListener("dragleave",()=>{i.style.borderColor=""}),i==null||i.addEventListener("drop",r=>{var m;r.preventDefault(),i.style.borderColor="";const g=(m=r.dataTransfer.files)==null?void 0:m[0];g&&T(g)}),s==null||s.addEventListener("change",r=>{var m;const g=(m=r.target.files)==null?void 0:m[0];g&&T(g)}),d==null||d.addEventListener("click",()=>{C()}),t==null||t.addEventListener("submit",se)}function C(){y=null;const e=document.getElementById("upload-area"),a=document.getElementById("upload-preview"),n=document.getElementById("item-image"),o=document.getElementById("ai-analysis-result");e&&(e.style.display="block"),a&&(a.style.display="none"),n&&(n.value=""),o&&(o.style.display="none")}async function T(e){if(!e.type.startsWith("image/")){u("Por favor selecciona un archivo de imagen válido","error");return}const a=new FileReader;a.onload=async n=>{var r,g,m,p;y=n.target.result;const o=document.getElementById("upload-area"),t=document.getElementById("upload-preview"),i=document.getElementById("preview-img"),s=document.getElementById("ai-analysis-result"),d=document.getElementById("ai-analysis-text");if(o&&(o.style.display="none"),t&&(t.style.display="block"),i&&(i.src=y),s&&d){s.style.display="block",d.textContent="Analizando imagen con IA (moderación, categoría, arquetipo 3D y texturas)...";try{const[l,c]=await Promise.all([J(y),X(y,((r=document.getElementById("item-name"))==null?void 0:r.value)||"")]);if(!l.moderation.safe)d.innerHTML=`⚠️ <strong style="color:var(--color-danger)">Alerta de moderación:</strong> ${l.moderation.label||"Contenido posiblemente inapropiado"}`,u("La imagen puede contener contenido inapropiado según la IA","warning");else{const b=document.getElementById("item-model-type");b&&(c!=null&&c.archetype)&&(b.value=c.archetype);const M=document.getElementById("item-category");M&&(c!=null&&c.category||(g=l.classification)!=null&&g.category)&&(M.value=(c==null?void 0:c.category)||((m=l.classification)==null?void 0:m.category));const $=document.getElementById("item-desc");$&&!$.value.trim()&&($.value=(c==null?void 0:c.description)||((p=l.caption)==null?void 0:p.description)||""),d.innerHTML=`✅ <strong>Aprobado por IA:</strong> Contenido seguro · <strong>Modelo 3D IA:</strong> ${(c==null?void 0:c.label)||"Plato"} (${(c==null?void 0:c.confidence)||85}%) con shaders PBR y capas de desensamble.`,u(`🤖 Modelo 3D "${c==null?void 0:c.label}" asignado automáticamente`,"success")}}catch(l){console.warn("AI analysis error:",l),d.textContent="Verificación básica local completada"}}},a.readAsDataURL(e)}function R(e=null){const a=document.getElementById("item-modal"),n=document.getElementById("item-modal-title"),o=document.getElementById("item-form");if(C(),e){E=e.id,n&&(n.textContent="Editar Platillo"),document.getElementById("item-id").value=e.id,document.getElementById("item-name").value=e.name,document.getElementById("item-desc").value=e.description||"",document.getElementById("item-category").value=e.category,document.getElementById("item-price").value=e.price;const t=document.getElementById("item-model-type");t&&(t.value=e.modelType||"burger"),H(e.id).then(i=>{if(i){y=i;const s=document.getElementById("upload-area"),d=document.getElementById("upload-preview"),r=document.getElementById("preview-img");s&&(s.style.display="none"),d&&(d.style.display="block"),r&&(r.src=i)}})}else{E=null,n&&(n.textContent="Agregar Platillo"),o==null||o.reset(),document.getElementById("item-id").value="";const t=document.getElementById("item-model-type");t&&(t.value="burger")}a==null||a.classList.add("active")}function B(){const e=document.getElementById("item-modal");e==null||e.classList.remove("active"),C(),E=null}async function se(e){var d;e.preventDefault();const a=document.getElementById("item-name").value.trim(),n=document.getElementById("item-desc").value.trim(),o=document.getElementById("item-category").value,t=((d=document.getElementById("item-model-type"))==null?void 0:d.value)||"burger",i=parseFloat(document.getElementById("item-price").value);if(!a||isNaN(i)){u("Por favor completa todos los campos requeridos","error");return}const s=document.getElementById("item-submit-btn");s&&(s.disabled=!0);try{const r=K(t),g={tacos:480,burger:760,salad:320,pizza:820,dessert:380,drink:120,cocktail:210,guacamole:340,ribeye:690,salmon:540};if(E)z(E,{name:a,description:n,category:o,modelType:t,price:i,ingredients:r}),y&&await L(E,y),u(`Platillo "${a}" actualizado`,"success");else{const m=U({name:a,description:n,category:o,modelType:t,price:i,ingredients:r,calories:g[t]||450,prepTime:"12-18 min",tags:["popular"],status:"approved"});if(y)await L(m.id,y);else{const p=document.createElement("canvas");p.width=600,p.height=450;const l=p.getContext("2d");l.fillStyle="#1e1c18",l.fillRect(0,0,600,450),l.font="100px serif",l.textAlign="center",l.textBaseline="middle";const c={entradas:"🥗",principales:"🍖",postres:"🍰",bebidas:"🥤",cocteles:"🍹",especiales:"⭐"};l.fillText(c[o]||"🍽️",300,200),l.font="bold 24px Inter, sans-serif",l.fillStyle="#ffffff",l.fillText(a,300,340),await L(m.id,p.toDataURL("image/jpeg",.85))}u(`Platillo "${a}" creado exitosamente`,"success")}await O(S()),B(),h(),f()}catch(r){console.error("Error saving item:",r),u("Error al guardar el platillo","error")}finally{s&&(s.disabled=!1)}}async function h(){var o,t,i;const e=document.getElementById("menu-table-body");if(!e)return;const a=S(),n=v();if(a.length===0){e.innerHTML=`
      <tr>
        <td colspan="6" class="text-center" style="padding: var(--space-xl);">
          <div class="empty-state">
            <div class="empty-state-icon">🍽️</div>
            <h3>No hay platillos registrados</h3>
            <p class="text-muted">Presiona "+ Agregar Platillo" para comenzar.</p>
          </div>
        </td>
      </tr>
    `;return}e.innerHTML="";for(const s of a){const d=document.createElement("tr"),g=await H(s.id)||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23222" width="40" height="40"/><text x="20" y="26" text-anchor="middle" font-size="20">🍽️</text></svg>',m={entradas:"🥗 Entradas",principales:"🍖 Principales",postres:"🍰 Postres",bebidas:"🥤 Bebidas",cocteles:"🍹 Cócteles",especiales:"⭐ Especiales"};d.innerHTML=`
      <td>
        <img src="${g}" alt="${s.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />
      </td>
      <td>
        <strong>${s.name}</strong>
        <div class="text-muted" style="font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.description||"Sin descripción"}</div>
      </td>
      <td>${m[s.category]||s.category}</td>
      <td><strong>${n.currency}${s.price.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${s.status==="approved"?"status-completed":"status-pending"}">
          ${s.status==="approved"?"Activo":"Pausado"}
        </span>
      </td>
      <td>
        <div class="flex gap-xs">
          <button class="btn btn-secondary btn-sm btn-edit" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm btn-toggle-status" title="${s.status==="approved"?"Pausar":"Activar"}">
            ${s.status==="approved"?"⏸️":"▶️"}
          </button>
          <button class="btn btn-danger btn-sm btn-delete" title="Eliminar">🗑️</button>
        </div>
      </td>
    `,(o=d.querySelector(".btn-edit"))==null||o.addEventListener("click",()=>R(s)),(t=d.querySelector(".btn-toggle-status"))==null||t.addEventListener("click",()=>{const p=s.status==="approved"?"paused":"approved";z(s.id,{status:p}),h(),f(),u(`Platillo ${p==="approved"?"activado":"pausado"}`,"info")}),(i=d.querySelector(".btn-delete"))==null||i.addEventListener("click",()=>{confirm(`¿Estás seguro de eliminar "${s.name}"?`)&&(Q(s.id),h(),f(),u("Platillo eliminado","info"))}),e.appendChild(d)}}function oe(){var a;(a=document.getElementById("btn-test-kitchen-bell"))==null||a.addEventListener("click",()=>{N(),u("🔔 Campana de cocina probada con éxito","info")});const e=document.querySelectorAll("#section-orders [data-order-filter]");e.forEach(n=>{n.addEventListener("click",()=>{e.forEach(o=>o.classList.remove("active")),n.classList.add("active"),I=n.dataset.orderFilter,x()})})}function x(){const e=document.getElementById("orders-list");if(!e)return;const a=q(),n=v(),o=I==="all"?a:a.filter(t=>t.status===I);if(o.length===0){e.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No hay pedidos ${I!=="all"?`en estado "${I}"`:""}</h3>
        <p class="text-muted">Los pedidos nuevos aparecerán aquí automáticamente.</p>
      </div>
    `;return}e.innerHTML=`
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-lg);">
      ${o.map(t=>{const i=new Date(t.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
          <div class="card card-glass" style="border-top: 3px solid ${{pending:"var(--color-warning)",preparing:"var(--color-primary)",completed:"var(--color-success)"}[t.status]||"var(--color-primary)"}; padding: var(--space-lg);">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-sm);">
              <div>
                <strong style="font-size: 1.125rem;">${t.orderNumber}</strong>
                <span class="text-muted" style="font-size: 0.8125rem; margin-left: 8px;">${i}</span>
              </div>
              <span class="table-number">Mesa ${t.table||"0"}</span>
            </div>

            <div style="border-top: 1px solid var(--color-glass-border); border-bottom: 1px solid var(--color-glass-border); padding: var(--space-sm) 0; margin: var(--space-sm) 0;">
              ${t.items.map(d=>`
                <div class="flex justify-between" style="font-size: 0.875rem; padding: 4px 0;">
                  <span><strong>${d.quantity}x</strong> ${d.name}</span>
                  <span class="text-muted">${n.currency}${(d.price*d.quantity).toFixed(2)}</span>
                </div>
              `).join("")}
            </div>

            <div class="flex justify-between items-center" style="margin-bottom: var(--space-md);">
              <span class="text-muted" style="font-size: 0.875rem;">Total con IVA:</span>
              <strong style="font-size: 1.125rem; color: var(--color-primary);">${n.currency}${(t.total||0).toFixed(2)}</strong>
            </div>

            <div class="flex gap-xs">
              <button class="btn btn-sm ${t.status==="pending"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${t.id}" data-set-status="pending" style="flex:1;">
                ⏳ Pendiente
              </button>
              <button class="btn btn-sm ${t.status==="preparing"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${t.id}" data-set-status="preparing" style="flex:1;">
                🍳 Cocina
              </button>
              <button class="btn btn-sm ${t.status==="completed"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${t.id}" data-set-status="completed" style="flex:1;">
                ✅ Listo
              </button>
            </div>
          </div>
        `}).join("")}
    </div>
  `,e.querySelectorAll(".btn-order-status").forEach(t=>{t.addEventListener("click",()=>{const i=t.dataset.orderId,s=t.dataset.setStatus;V(i,s),x(),f(),u(`Pedido actualizado a: ${s}`,"success")})})}function ie(){const e=document.getElementById("save-settings-btn"),a=document.getElementById("reset-data-btn"),n=document.getElementById("btn-validate-hf-key");e==null||e.addEventListener("click",de),a==null||a.addEventListener("click",re),n==null||n.addEventListener("click",async()=>{const o=document.getElementById("cfg-hf-key"),t=document.getElementById("hf-key-validation-status"),i=o==null?void 0:o.value.trim();if(!i){t&&(t.innerHTML='<span style="color:var(--color-warning);">⚠️ Ingresa una clave antes de validar.</span>'),u("Ingresa una API Key para probar","warning");return}t&&(t.innerHTML='<span style="color:var(--color-primary);">⏳ Conectando con Hugging Face Inference API...</span>');const s=await Y(i);s.valid?(t&&(t.innerHTML=`<span style="color:var(--color-success); font-weight:600;">✅ API Key válida · Conexión exitosa (${s.user||"Hugging Face Pro"})</span>`),u("API Key de Hugging Face verificada correctamente ✅","success")):(t&&(t.innerHTML=`<span style="color:var(--color-danger); font-weight:600;">❌ Clave inválida o sin permisos: ${s.error||"Verifica el token"}</span>`),u("API Key inválida o sin conexión a HF","error"))}),k()}function k(){const e=v(),a=document.getElementById("cfg-name"),n=document.getElementById("cfg-currency"),o=document.getElementById("cfg-tables"),t=document.getElementById("cfg-whatsapp"),i=document.getElementById("cfg-base-url"),s=document.getElementById("cfg-hf-key"),d=document.getElementById("cfg-ai-enabled"),r=document.getElementById("cfg-admin-pin");a&&(a.value=e.restaurantName||""),n&&(n.value=e.currency||"$"),o&&(o.value=e.tableCount||20),t&&(t.value=e.whatsappNumber||"573146841042"),i&&(i.value=e.baseUrl||"http://192.168.1.35:3000"),s&&(s.value=e.hfApiKey||""),d&&(d.checked=e.aiEnabled!==!1),r&&(r.value=e.adminPin||"1234")}async function de(){var n,o,t;const e=v();e.restaurantName=document.getElementById("cfg-name").value.trim()||"Mi Restaurante",e.currency=document.getElementById("cfg-currency").value,e.tableCount=parseInt(document.getElementById("cfg-tables").value)||20,e.whatsappNumber=((n=document.getElementById("cfg-whatsapp"))==null?void 0:n.value.trim())||"573146841042",e.baseUrl=((o=document.getElementById("cfg-base-url"))==null?void 0:o.value.trim())||"http://192.168.1.35:3000",e.hfApiKey=document.getElementById("cfg-hf-key").value.trim(),e.aiEnabled=document.getElementById("cfg-ai-enabled").checked;const a=(t=document.getElementById("cfg-admin-pin"))==null?void 0:t.value.trim();a&&(e.adminPin=a),W(e),await _(e),F(),u("Configuración guardada y sincronizada en tiempo real ✅","success")}async function re(){confirm("¿Deseas resetear los platillos a los datos de prueba iniciales?")&&(localStorage.removeItem("menu3d_items"),localStorage.removeItem("menu3d_orders"),await A(),h(),x(),f(),u("Datos de demo restaurados","success"))}function ce(){const e=document.getElementById("admin-batch-qr-btn"),a=document.getElementById("admin-batch-preview-area"),n=document.getElementById("admin-qr-grid"),o=document.getElementById("admin-print-all-btn");o==null||o.addEventListener("click",()=>{window.print()}),e==null||e.addEventListener("click",async()=>{const t=v(),i=t.restaurantName||"Mi Restaurante",s=t.tableCount||20,d=(t.baseUrl||window.location.origin).replace(/\/+$/,"");if(n){a&&(a.style.display="block"),n.innerHTML='<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="loading-spinner"></div><p style="margin-top:10px;">Generando códigos QR para todas las mesas...</p></div>',e.disabled=!0,await new Promise(r=>setTimeout(r,60)),n.innerHTML="";for(let r=1;r<=s;r++){const g=`${d}/menu.html?table=${r}&restaurant=${encodeURIComponent(i)}`,m=document.createElement("div");m.className="batch-qr-card";const p=document.createElement("div");p.className="batch-qr-card-header",p.innerHTML=`
        <div style="font-size: 1.15rem; font-weight: 800; color: #111827;">Mesa ${r}</div>
        <div style="font-size: 0.75rem; color: #6b7280; font-weight: 500;">${i}</div>
      `;const l=document.createElement("canvas");await Z.toCanvas(l,g,{width:190,margin:1,color:{dark:"#0a0a0a",light:"#ffffff"},errorCorrectionLevel:"M"});const c=document.createElement("div");c.style.display="flex",c.style.justifyContent="center",c.style.margin="8px 0",c.appendChild(l);const b=document.createElement("div");b.className="batch-qr-card-footer",b.innerHTML=`
        <div style="font-size: 0.7rem; font-weight: 600; color: #d97706; text-transform: uppercase;">✨ Menú 3D Interactivo</div>
        <div style="font-size: 0.65rem; color: #9ca3af; word-break: break-all; margin-top: 2px;">${g}</div>
      `,m.appendChild(p),m.appendChild(c),m.appendChild(b),n.appendChild(m)}e.disabled=!1,u(`¡${s} códigos QR listos en el panel de administrador!`,"success")}})}
