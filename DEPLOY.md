# 🌐 Guía de Despliegue en la Nube (Acceso Universal con QR)

Esta guía explica cómo poner a funcionar el **Menú Digital 3D con QR** en un servidor en la nube para que cualquier persona pueda escanear el código QR desde **cualquier red móvil (4G/5G) o red Wi-Fi externa**, no solamente desde la red local de tu computador.

Además, al estar en la nube con **HTTPS**, los teléfonos móviles (iOS Safari y Android Chrome) permiten activar la **cámara física real** para ver la comida directamente proyectada sobre la mesa del restaurante.

---

## ⚡ Opción 1: Despliegue en Vercel (Recomendada - Gratis y Rápido)

Vercel ofrece CDN global ultrarrápido y HTTPS automático gratuito.

### Pasos:
1. Instala la herramienta de Vercel (si no la tienes):
   ```bash
   npm i -g vercel
   ```
2. Inicia sesión y despliega con un solo comando:
   ```bash
   vercel
   ```
3. Sigue las instrucciones en consola (presiona Enter para aceptar los valores por defecto).
4. Para pasar a producción:
   ```bash
   vercel --prod
   ```
5. **¡Listo!** Vercel te dará una URL como:
   `https://tu-proyecto.vercel.app`
6. Abre esa URL en tu navegador, ingresa al panel principal y genera tu QR. ¡El QR se generará automáticamente con tu URL pública y funcionará desde cualquier celular del mundo!

---

## 🚀 Opción 2: Despliegue en Render (Servidor Node.js Completo - Gratis)

Render ejecuta el servidor `server.js` con soporte completo para la API y guardado de pedidos.

### Pasos:
1. Sube tu proyecto a un repositorio en **GitHub** o **GitLab**.
2. Ve a [render.com](https://render.com) y crea una cuenta gratuita.
3. Haz clic en **New +** > **Web Service**.
4. Conecta tu repositorio de GitHub.
5. Configura los siguientes campos:
   - **Name**: `menu3d-qr`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Haz clic en **Create Web Service**.
7. Render te asignará una URL pública con HTTPS (ejemplo: `https://menu3d-qr.onrender.com`).
8. Abre esa URL, genera tus códigos QR por mesa e imprímelos.

---

## 🚂 Opción 3: Despliegue en Railway

1. Entra a [railway.app](https://railway.app).
2. Haz clic en **New Project** > **Deploy from GitHub repo**.
3. Selecciona tu repositorio. Railway detectará automáticamente el comando `npm start` y desplegará la app.
4. En la pestaña de configuración del servicio en Railway, genera un dominio público (**Generate Domain**).

---

## 📡 Opción 4: Túnel Público Inmediato sin costo (Cloudflare Tunnel o Localtunnel)

Si deseas probar el acceso universal desde cualquier celular **ya mismo** ejecutando el servidor en tu computador:

### Con Cloudflare Tunnel (100% gratuito y seguro):
```bash
# 1. Inicia el servidor
npm start

# 2. En otra terminal abre el túnel público:
npx cloudflared tunnel --url http://localhost:3000
```
Cloudflare te imprimirá en consola una URL pública segura (ejemplo: `https://palabras-aleatorias.trycloudflare.com`).
Pega esa URL en el campo "URL del Menú" en la página principal, genera tu QR y pruébalo desde cualquier red móvil.

### O con Localtunnel:
```bash
npx localtunnel --port 3000
```

---

## 📱 ¿Por qué el QR funciona en cualquier red ahora?

1. **Detección inteligente de URL**: Cuando abres la página web en tu servidor de nube, el generador de QR detecta automáticamente el dominio público (`window.location.origin`) y crea el QR con esa dirección.
2. **Cámara AR real en mesa física**: Al tener HTTPS en la nube, el navegador del teléfono habilita el permiso de cámara y muestra la mesa física real detrás del platillo 3D.
3. **Persistencia cruzada**: Los pedidos y las actualizaciones de platillos se sincronizan en tiempo real.

