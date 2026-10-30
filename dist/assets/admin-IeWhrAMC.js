import{g as f,s as T,l as R,a as z,b as j,c as m,d as q,u as D,e as B,f as K,h as _,i as U,j as V}from"./toast-i2GfW-yM.js";import{p as F}from"./audio-CEdIckWR.js";const G="https://api-inference.huggingface.co/models",L={moderation:"Falconsai/nsfw_image_detection",caption:"Salesforce/blip-image-captioning-base",classification:"google/vit-base-patch16-224"};function w(){const e=f();return e.aiEnabled&&e.hfApiKey&&e.hfApiKey.length>10}async function S(e,t,a=!1){const s=f().hfApiKey;if(!s)throw new Error("API key de Hugging Face no configurada");const i={Authorization:`Bearer ${s}`};let o;a?o=ee(t):(i["Content-Type"]="application/json",o=JSON.stringify(t));const r=await fetch(`${G}/${e}`,{method:"POST",headers:i,body:o});if(!r.ok){const c=await r.text();throw r.status===503?new Error("MODEL_LOADING"):new Error(`HF API Error: ${r.status} - ${c}`)}return r.json()}async function J(e){var t,a;if(!w())return C(e);try{const n=await S(L.moderation,e,!0);if(Array.isArray(n)){const s=((t=n.find(o=>o.label==="nsfw"))==null?void 0:t.score)||0,i=((a=n.find(o=>o.label==="normal"))==null?void 0:a.score)||1;return{safe:s<.5,confidence:i,label:s>=.5?"Contenido inapropiado detectado":"Contenido seguro",scores:n}}return{safe:!0,confidence:1,label:"Contenido seguro"}}catch(n){return console.warn("AI moderation fallback:",n.message),C(e)}}async function W(e){var t;if(!w())return E();try{const a=await S(L.caption,e,!0);if(Array.isArray(a)&&((t=a[0])!=null&&t.generated_text)){let n=a[0].generated_text;return n=Y(n),{description:n,confidence:.8,source:"ai"}}return E()}catch(a){return console.warn("AI caption fallback:",a.message),E()}}async function Q(e){var t,a,n;if(!w())return{category:"principales",confidence:.5,source:"default"};try{const s=await S(L.classification,e,!0);return Array.isArray(s)?{category:Z(((t=s[0])==null?void 0:t.label)||""),confidence:((a=s[0])==null?void 0:a.score)||.5,rawLabel:(n=s[0])==null?void 0:n.label,source:"ai"}:{category:"principales",confidence:.5,source:"default"}}catch{return{category:"principales",confidence:.5,source:"default"}}}async function X(e){const[t,a,n]=await Promise.allSettled([J(e),W(e),Q(e)]);return{moderation:t.status==="fulfilled"?t.value:{safe:!0,confidence:0},caption:a.status==="fulfilled"?a.value:E(),classification:n.status==="fulfilled"?n.value:{category:"principales"}}}function C(e){const t=e.length*3/4/1024;return t<5?{safe:!1,confidence:.9,label:"Imagen demasiado pequeña o inválida"}:t>15e3?{safe:!1,confidence:.7,label:"Imagen demasiado grande (máx 15MB)"}:{safe:!0,confidence:.6,label:"Verificación básica aprobada (sin IA)",source:"client"}}function E(){const e=["Platillo elaborado con los mejores ingredientes frescos del día.","Una deliciosa creación culinaria preparada con técnica artesanal.","Sabores auténticos que conquistan el paladar.","Preparación gourmet con ingredientes de primera calidad.","Una experiencia gastronómica única en cada bocado."];return{description:e[Math.floor(Math.random()*e.length)],confidence:.3,source:"template"}}function Y(e){const t={"a plate of food":"un plato de comida","a bowl of":"un plato de","a glass of":"un vaso de","a cup of":"una taza de","a piece of":"una porción de","a slice of":"una rebanada de",chicken:"pollo",beef:"res",fish:"pescado",salad:"ensalada",soup:"sopa",cake:"pastel",pizza:"pizza",pasta:"pasta",rice:"arroz",bread:"pan",fruit:"fruta",vegetable:"vegetales",dessert:"postre",drink:"bebida",wine:"vino",beer:"cerveza",coffee:"café",tea:"té",juice:"jugo",water:"agua","on a plate":"en un plato","on a table":"sobre la mesa",with:"con",and:"y"};let a=e.toLowerCase();for(const[n,s]of Object.entries(t))a=a.replace(new RegExp(n,"gi"),s);return a.charAt(0).toUpperCase()+a.slice(1)}function Z(e){const t=e.toLowerCase(),a={entradas:["salad","soup","appetizer","starter","guacamole","dip","chips","bread"],principales:["meat","chicken","beef","pork","fish","steak","burger","taco","pizza","pasta","rice","curry","plate","dinner"],postres:["cake","dessert","ice cream","cookie","chocolate","pie","flan","sweet","pastry"],bebidas:["drink","juice","water","soda","coffee","tea","smoothie","lemonade"],cocteles:["cocktail","wine","beer","margarita","mojito","alcohol","whisky","vodka","champagne"],especiales:["special","gourmet","premium","lobster","truffle","wagyu","caviar"]};for(const[n,s]of Object.entries(a))if(s.some(i=>t.includes(i)))return n;return"principales"}function ee(e){var o;const t=e.split(","),a=((o=t[0].match(/:(.*?);/))==null?void 0:o[1])||"image/jpeg",n=atob(t[1]),s=new ArrayBuffer(n.length),i=new Uint8Array(s);for(let r=0;r<n.length;r++)i[r]=n.charCodeAt(r);return new Blob([s],{type:a})}function te(){return w()?"🤖 IA Activa (Hugging Face)":"⚡ Modo básico (configura tu API Key para IA completa)"}let $="dashboard",y=null,p=null,v="all";document.addEventListener("DOMContentLoaded",async()=>{await T(),ae(),ne(),oe(),re(),ce(),N(),R(e=>{e.type==="new-order"?(F(),m(`🔔 ¡Nuevo pedido para cocina! Mesa ${e.order.table||"Sin mesa"} (${e.order.orderNumber})`,"success"),g(),$==="orders"&&h()):e.type==="menu-update"&&($==="menu"&&b(),g())})});function ae(){document.querySelectorAll(".admin-sidebar-nav a[data-section]").forEach(a=>{a.addEventListener("click",n=>{n.preventDefault(),M(a.dataset.section)})}),document.querySelectorAll("#mobile-admin-nav button[data-mobile-section]").forEach(a=>{a.addEventListener("click",()=>{M(a.dataset.mobileSection)})})}function M(e){$=e,document.querySelectorAll(".admin-sidebar-nav a").forEach(a=>{a.classList.toggle("active",a.dataset.section===e)}),document.querySelectorAll(".admin-section").forEach(a=>{a.style.display="none"});const t=document.getElementById(`section-${e}`);t&&(t.style.display="block"),e==="dashboard"?g():e==="menu"?b():e==="orders"?h():e==="settings"&&O()}function N(){const e=document.getElementById("ai-status-text");e&&(e.textContent=te())}function ne(){const e=document.getElementById("dashboard-date");if(e){const t=new Date;e.textContent=t.toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}g()}function g(){const e=z(),t=j(),a=f(),n=document.getElementById("stat-items"),s=document.getElementById("stat-orders"),i=document.getElementById("stat-revenue"),o=document.getElementById("stat-categories");n&&(n.textContent=e.filter(c=>c.status==="approved").length),s&&(s.textContent=t.length);const r=t.reduce((c,d)=>c+(d.total||0),0);i&&(i.textContent=`${a.currency}${r.toFixed(2)}`),o&&(o.textContent=a.categories?a.categories.length:6),se(t.slice(0,5))}function se(e){const t=document.getElementById("recent-orders");if(!t)return;const a=f();if(!e||e.length===0){t.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Sin pedidos aún</h3>
        <p class="text-muted">Los pedidos de los clientes aparecerán aquí.</p>
      </div>
    `;return}t.innerHTML=`
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
          ${e.map(n=>{const s={pending:'<span class="status-badge status-pending">Pendiente</span>',preparing:'<span class="status-badge status-preparing">En Preparación</span>',completed:'<span class="status-badge status-completed">Completado</span>'},i=n.items.map(r=>`${r.quantity}x ${r.name}`).join(", "),o=new Date(n.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
              <tr>
                <td><strong>${n.orderNumber}</strong></td>
                <td>Mesa ${n.table||"-"}</td>
                <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${i}">${i}</td>
                <td><strong>${a.currency}${(n.total||0).toFixed(2)}</strong></td>
                <td>${s[n.status]||n.status}</td>
                <td class="text-muted" style="font-size: 0.8125rem;">${o}</td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
  `}function oe(){const e=document.getElementById("add-item-btn");document.getElementById("item-modal");const t=document.getElementById("item-modal-close"),a=document.getElementById("item-modal-backdrop"),n=document.getElementById("item-cancel-btn"),s=document.getElementById("item-form");e==null||e.addEventListener("click",()=>H()),t==null||t.addEventListener("click",()=>I()),a==null||a.addEventListener("click",()=>I()),n==null||n.addEventListener("click",()=>I());const i=document.getElementById("upload-area"),o=document.getElementById("item-image"),r=document.getElementById("remove-preview");i==null||i.addEventListener("click",()=>o==null?void 0:o.click()),i==null||i.addEventListener("dragover",c=>{c.preventDefault(),i.style.borderColor="var(--color-primary)"}),i==null||i.addEventListener("dragleave",()=>{i.style.borderColor=""}),i==null||i.addEventListener("drop",c=>{var l;c.preventDefault(),i.style.borderColor="";const d=(l=c.dataTransfer.files)==null?void 0:l[0];d&&P(d)}),o==null||o.addEventListener("change",c=>{var l;const d=(l=c.target.files)==null?void 0:l[0];d&&P(d)}),r==null||r.addEventListener("click",()=>{A()}),s==null||s.addEventListener("submit",ie)}function A(){p=null;const e=document.getElementById("upload-area"),t=document.getElementById("upload-preview"),a=document.getElementById("item-image"),n=document.getElementById("ai-analysis-result");e&&(e.style.display="block"),t&&(t.style.display="none"),a&&(a.value=""),n&&(n.style.display="none")}async function P(e){if(!e.type.startsWith("image/")){m("Por favor selecciona un archivo de imagen válido","error");return}const t=new FileReader;t.onload=async a=>{var c,d,l;p=a.target.result;const n=document.getElementById("upload-area"),s=document.getElementById("upload-preview"),i=document.getElementById("preview-img"),o=document.getElementById("ai-analysis-result"),r=document.getElementById("ai-analysis-text");if(n&&(n.style.display="none"),s&&(s.style.display="block"),i&&(i.src=p),o&&r){o.style.display="block",r.textContent="Analizando imagen con IA (moderación, categoría y descripción)...";try{const u=await X(p);if(!u.moderation.safe)r.innerHTML=`⚠️ <strong style="color:var(--color-danger)">Alerta de moderación:</strong> ${u.moderation.label||"Contenido posiblemente inapropiado"}`,m("La imagen puede contener contenido inapropiado según la IA","warning");else{r.innerHTML=`✅ <strong>Aprobado por IA:</strong> Contenido seguro · Sugerencia: ${((c=u.classification)==null?void 0:c.category)||"General"}`;const x=document.getElementById("item-desc");x&&!x.value.trim()&&((d=u.caption)!=null&&d.description)&&(x.value=u.caption.description);const k=document.getElementById("item-category");k&&((l=u.classification)!=null&&l.category)&&(k.value=u.classification.category)}}catch(u){console.warn("AI analysis error:",u),r.textContent="Verificación básica local completada"}}},t.readAsDataURL(e)}function H(e=null){const t=document.getElementById("item-modal"),a=document.getElementById("item-modal-title"),n=document.getElementById("item-form");if(A(),e){y=e.id,a&&(a.textContent="Editar Platillo"),document.getElementById("item-id").value=e.id,document.getElementById("item-name").value=e.name,document.getElementById("item-desc").value=e.description||"",document.getElementById("item-category").value=e.category,document.getElementById("item-price").value=e.price;const s=document.getElementById("item-model-type");s&&(s.value=e.modelType||"burger"),q(e.id).then(i=>{if(i){p=i;const o=document.getElementById("upload-area"),r=document.getElementById("upload-preview"),c=document.getElementById("preview-img");o&&(o.style.display="none"),r&&(r.style.display="block"),c&&(c.src=i)}})}else{y=null,a&&(a.textContent="Agregar Platillo"),n==null||n.reset(),document.getElementById("item-id").value="";const s=document.getElementById("item-model-type");s&&(s.value="burger")}t==null||t.classList.add("active")}function I(){const e=document.getElementById("item-modal");e==null||e.classList.remove("active"),A(),y=null}async function ie(e){var r;e.preventDefault();const t=document.getElementById("item-name").value.trim(),a=document.getElementById("item-desc").value.trim(),n=document.getElementById("item-category").value,s=((r=document.getElementById("item-model-type"))==null?void 0:r.value)||"burger",i=parseFloat(document.getElementById("item-price").value);if(!t||isNaN(i)){m("Por favor completa todos los campos requeridos","error");return}const o=document.getElementById("item-submit-btn");o&&(o.disabled=!0);try{if(y)D(y,{name:t,description:a,category:n,modelType:s,price:i}),p&&await B(y,p),m(`Platillo "${t}" actualizado`,"success");else{const c=K({name:t,description:a,category:n,modelType:s,price:i,status:"approved"});if(p)await B(c.id,p);else{const d=document.createElement("canvas");d.width=600,d.height=450;const l=d.getContext("2d");l.fillStyle="#1e1c18",l.fillRect(0,0,600,450),l.font="100px serif",l.textAlign="center",l.textBaseline="middle";const u={entradas:"🥗",principales:"🍖",postres:"🍰",bebidas:"🥤",cocteles:"🍹",especiales:"⭐"};l.fillText(u[n]||"🍽️",300,200),l.font="bold 24px Inter, sans-serif",l.fillStyle="#ffffff",l.fillText(t,300,340),await B(c.id,d.toDataURL("image/jpeg",.85))}m(`Platillo "${t}" creado exitosamente`,"success")}I(),b(),g()}catch(c){console.error("Error saving item:",c),m("Error al guardar el platillo","error")}finally{o&&(o.disabled=!1)}}async function b(){var n,s,i;const e=document.getElementById("menu-table-body");if(!e)return;const t=z(),a=f();if(t.length===0){e.innerHTML=`
      <tr>
        <td colspan="6" class="text-center" style="padding: var(--space-xl);">
          <div class="empty-state">
            <div class="empty-state-icon">🍽️</div>
            <h3>No hay platillos registrados</h3>
            <p class="text-muted">Presiona "+ Agregar Platillo" para comenzar.</p>
          </div>
        </td>
      </tr>
    `;return}e.innerHTML="";for(const o of t){const r=document.createElement("tr"),d=await q(o.id)||'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23222" width="40" height="40"/><text x="20" y="26" text-anchor="middle" font-size="20">🍽️</text></svg>',l={entradas:"🥗 Entradas",principales:"🍖 Principales",postres:"🍰 Postres",bebidas:"🥤 Bebidas",cocteles:"🍹 Cócteles",especiales:"⭐ Especiales"};r.innerHTML=`
      <td>
        <img src="${d}" alt="${o.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />
      </td>
      <td>
        <strong>${o.name}</strong>
        <div class="text-muted" style="font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.description||"Sin descripción"}</div>
      </td>
      <td>${l[o.category]||o.category}</td>
      <td><strong>${a.currency}${o.price.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${o.status==="approved"?"status-completed":"status-pending"}">
          ${o.status==="approved"?"Activo":"Pausado"}
        </span>
      </td>
      <td>
        <div class="flex gap-xs">
          <button class="btn btn-secondary btn-sm btn-edit" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm btn-toggle-status" title="${o.status==="approved"?"Pausar":"Activar"}">
            ${o.status==="approved"?"⏸️":"▶️"}
          </button>
          <button class="btn btn-danger btn-sm btn-delete" title="Eliminar">🗑️</button>
        </div>
      </td>
    `,(n=r.querySelector(".btn-edit"))==null||n.addEventListener("click",()=>H(o)),(s=r.querySelector(".btn-toggle-status"))==null||s.addEventListener("click",()=>{const u=o.status==="approved"?"paused":"approved";D(o.id,{status:u}),b(),g(),m(`Platillo ${u==="approved"?"activado":"pausado"}`,"info")}),(i=r.querySelector(".btn-delete"))==null||i.addEventListener("click",()=>{confirm(`¿Estás seguro de eliminar "${o.name}"?`)&&(_(o.id),b(),g(),m("Platillo eliminado","info"))}),e.appendChild(r)}}function re(){var t;(t=document.getElementById("btn-test-kitchen-bell"))==null||t.addEventListener("click",()=>{F(),m("🔔 Campana de cocina probada con éxito","info")});const e=document.querySelectorAll("#section-orders [data-order-filter]");e.forEach(a=>{a.addEventListener("click",()=>{e.forEach(n=>n.classList.remove("active")),a.classList.add("active"),v=a.dataset.orderFilter,h()})})}function h(){const e=document.getElementById("orders-list");if(!e)return;const t=j(),a=f(),n=v==="all"?t:t.filter(s=>s.status===v);if(n.length===0){e.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No hay pedidos ${v!=="all"?`en estado "${v}"`:""}</h3>
        <p class="text-muted">Los pedidos nuevos aparecerán aquí automáticamente.</p>
      </div>
    `;return}e.innerHTML=`
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-lg);">
      ${n.map(s=>{const i=new Date(s.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
          <div class="card card-glass" style="border-top: 3px solid ${{pending:"var(--color-warning)",preparing:"var(--color-primary)",completed:"var(--color-success)"}[s.status]||"var(--color-primary)"}; padding: var(--space-lg);">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-sm);">
              <div>
                <strong style="font-size: 1.125rem;">${s.orderNumber}</strong>
                <span class="text-muted" style="font-size: 0.8125rem; margin-left: 8px;">${i}</span>
              </div>
              <span class="table-number">Mesa ${s.table||"0"}</span>
            </div>

            <div style="border-top: 1px solid var(--color-glass-border); border-bottom: 1px solid var(--color-glass-border); padding: var(--space-sm) 0; margin: var(--space-sm) 0;">
              ${s.items.map(r=>`
                <div class="flex justify-between" style="font-size: 0.875rem; padding: 4px 0;">
                  <span><strong>${r.quantity}x</strong> ${r.name}</span>
                  <span class="text-muted">${a.currency}${(r.price*r.quantity).toFixed(2)}</span>
                </div>
              `).join("")}
            </div>

            <div class="flex justify-between items-center" style="margin-bottom: var(--space-md);">
              <span class="text-muted" style="font-size: 0.875rem;">Total con IVA:</span>
              <strong style="font-size: 1.125rem; color: var(--color-primary);">${a.currency}${(s.total||0).toFixed(2)}</strong>
            </div>

            <div class="flex gap-xs">
              <button class="btn btn-sm ${s.status==="pending"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${s.id}" data-set-status="pending" style="flex:1;">
                ⏳ Pendiente
              </button>
              <button class="btn btn-sm ${s.status==="preparing"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${s.id}" data-set-status="preparing" style="flex:1;">
                🍳 Cocina
              </button>
              <button class="btn btn-sm ${s.status==="completed"?"btn-primary":"btn-ghost"} btn-order-status" data-order-id="${s.id}" data-set-status="completed" style="flex:1;">
                ✅ Listo
              </button>
            </div>
          </div>
        `}).join("")}
    </div>
  `,e.querySelectorAll(".btn-order-status").forEach(s=>{s.addEventListener("click",()=>{const i=s.dataset.orderId,o=s.dataset.setStatus;U(i,o),h(),g(),m(`Pedido actualizado a: ${o}`,"success")})})}function ce(){const e=document.getElementById("save-settings-btn"),t=document.getElementById("reset-data-btn");e==null||e.addEventListener("click",le),t==null||t.addEventListener("click",de),O()}function O(){const e=f(),t=document.getElementById("cfg-name"),a=document.getElementById("cfg-currency"),n=document.getElementById("cfg-tables"),s=document.getElementById("cfg-whatsapp"),i=document.getElementById("cfg-base-url"),o=document.getElementById("cfg-hf-key"),r=document.getElementById("cfg-ai-enabled");t&&(t.value=e.restaurantName||""),a&&(a.value=e.currency||"$"),n&&(n.value=e.tableCount||20),s&&(s.value=e.whatsappNumber||"573146841042"),i&&(i.value=e.baseUrl||"http://192.168.1.35:3000"),o&&(o.value=e.hfApiKey||""),r&&(r.checked=e.aiEnabled!==!1)}function le(){var t,a;const e=f();e.restaurantName=document.getElementById("cfg-name").value.trim()||"Mi Restaurante",e.currency=document.getElementById("cfg-currency").value,e.tableCount=parseInt(document.getElementById("cfg-tables").value)||20,e.whatsappNumber=((t=document.getElementById("cfg-whatsapp"))==null?void 0:t.value.trim())||"573146841042",e.baseUrl=((a=document.getElementById("cfg-base-url"))==null?void 0:a.value.trim())||"http://192.168.1.35:3000",e.hfApiKey=document.getElementById("cfg-hf-key").value.trim(),e.aiEnabled=document.getElementById("cfg-ai-enabled").checked,V(e),N(),m("Configuración guardada exitosamente","success")}async function de(){confirm("¿Deseas resetear los platillos a los datos de prueba iniciales?")&&(localStorage.removeItem("menu3d_items"),localStorage.removeItem("menu3d_orders"),await T(),b(),h(),g(),m("Datos de demo restaurados","success"))}
