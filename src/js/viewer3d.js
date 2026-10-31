/**
 * viewer3d.js - Three.js Photorealistic 3D Food Models, Non-Intrusive Lateral Indicators & Real Web AR
 * Features:
 * - Studio PBR environment lighting with PMREM reflections
 * - Canvas-generated organic PBR textures (brioche, seared beef, melted cheddar, wood-fired crust, cured pepperoni, salmon, etc.)
 * - Non-intrusive lateral indicators docked to the side (never blocks food interaction)
 * - OrbitControls with smart auto-rotate pause during touch/drag and touch-action: none
 * - Real AR Camera pass-through with fallback restaurant dining table simulator (no black screen!)
 * - Exploded view & smooth macro ingredient focus
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { playExplodeSound, playAssembleSound } from './audio.js';

let scene, camera, renderer, controls;
let currentFoodGroup = null;
let plateMesh = null;
let particleSystem = null;
let studioEnvMap = null;
let animationId = null;
let isActive = false;
let isUserInteracting = false;
let lastInteractionTime = 0;

let hotspots = [];
let hotspotsVisible = true;
let currentMode = '3d'; // '3d' | 'photo'
let currentItemData = null;
let currentImageData = null;
let containerElement = null;
let hotspotsOverlayElement = null;
let lateralIndicatorsContainer = null;

// Exploded View State
let explodedComponents = [];
let explodeProgress = 0;
let targetExplode = 0;
let onExplodeCallback = null;
let focusAnimId = null;

const SCENE_CONFIG = {
  bgColor: 0x0a0908,
  ambientColor: 0xffeedd,
  ambientIntensity: 0.9,
  spotColor: 0xfff6ea,
  spotIntensity: 2.8,
  rimColor: 0xf59e0b,
  rimIntensity: 1.1,
  fillColor: 0x7eb0d5,
  fillIntensity: 0.6,
  bounceColor: 0xd97706,
  bounceIntensity: 0.4,
  plateColor: 0x1c1a18,
  plateMetalness: 0.15,
  plateRoughness: 0.65,
};

// Texture cache
const textureCache = {};

/**
 * Generate an HDR-like studio restaurant environment map using Canvas & PMREMGenerator
 */
function createStudioEnvironment(targetRenderer, targetScene) {
  if (studioEnvMap) {
    targetScene.environment = studioEnvMap;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Background dark warm gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, '#1f1a16');
  bgGrad.addColorStop(0.35, '#120f0d');
  bgGrad.addColorStop(0.7, '#0d0b09');
  bgGrad.addColorStop(1, '#080706');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft warm pendant light on ceiling (key light reflection)
  const keyGrad = ctx.createRadialGradient(256, 50, 5, 256, 50, 90);
  keyGrad.addColorStop(0, 'rgba(255, 246, 230, 0.95)');
  keyGrad.addColorStop(0.3, 'rgba(251, 191, 36, 0.6)');
  keyGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.2)');
  keyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = keyGrad;
  ctx.fillRect(0, 0, 512, 140);

  // Soft cool rim light on the left
  const rimGrad = ctx.createRadialGradient(80, 110, 5, 80, 110, 70);
  rimGrad.addColorStop(0, 'rgba(190, 220, 255, 0.5)');
  rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 40, 160, 140);

  // Warm amber floor bounce
  const bounceGrad = ctx.createRadialGradient(256, 210, 10, 256, 210, 100);
  bounceGrad.addColorStop(0, 'rgba(217, 119, 6, 0.45)');
  bounceGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bounceGrad;
  ctx.fillRect(0, 140, 512, 116);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;

  try {
    const pmrem = new THREE.PMREMGenerator(targetRenderer);
    pmrem.compileEquirectangularShader();
    studioEnvMap = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    targetScene.environment = studioEnvMap;
  } catch (err) {
    console.warn('PMREM environment generation fallback:', err);
    targetScene.environment = tex;
  }
}

// ==========================================
// PROCEDURAL PBR TEXTURE GENERATORS
// ==========================================

function getBunTextures() {
  if (textureCache.bun) return textureCache.bun;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Golden brioche toasted gradient
  const grad = ctx.createRadialGradient(256, 200, 30, 256, 256, 260);
  grad.addColorStop(0, '#f0a850');
  grad.addColorStop(0.4, '#d97d26');
  grad.addColorStop(0.8, '#a65416');
  grad.addColorStop(1, '#7a380b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Micro-pores and baked flour speckles
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    d[i] = Math.min(255, Math.max(0, d[i] + noise));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise * 0.8));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise * 0.5));
  }
  ctx.putImageData(imgData, 0, 0);

  // Fine toasted marks
  ctx.fillStyle = 'rgba(92, 42, 10, 0.15)';
  for (let s = 0; s < 40; s++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  // Bump map for baked bread crust
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const bImg = bCtx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < bImg.data.length; i += 4) {
    const n = Math.floor(Math.random() * 40 - 20);
    bImg.data[i] = 128 + n;
    bImg.data[i + 1] = 128 + n;
    bImg.data[i + 2] = 128 + n;
  }
  bCtx.putImageData(bImg, 0, 0);
  const bump = new THREE.CanvasTexture(bumpCanvas);

  textureCache.bun = { map, bump };
  return textureCache.bun;
}

function getBeefPattyTextures() {
  if (textureCache.beef) return textureCache.beef;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Caramelized seared beef patty base
  ctx.fillStyle = '#3a1e12';
  ctx.fillRect(0, 0, 512, 512);

  // Coarse minced meat texture
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 45;
    d[i] = Math.min(255, Math.max(20, d[i] + n * 1.2));
    d[i + 1] = Math.min(255, Math.max(10, d[i + 1] + n * 0.8));
    d[i + 2] = Math.min(255, Math.max(5, d[i + 2] + n * 0.5));
  }
  ctx.putImageData(imgData, 0, 0);

  // Dark charred grill sear marks
  ctx.fillStyle = 'rgba(20, 10, 6, 0.75)';
  for (let i = -4; i <= 8; i++) {
    ctx.fillRect(i * 60, 0, 16, 512);
  }

  // Juicy fat glistening speckles
  ctx.fillStyle = 'rgba(255, 230, 200, 0.25)';
  for (let j = 0; j < 60; j++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  textureCache.beef = { map };
  return textureCache.beef;
}

function getTomatoTexture() {
  if (textureCache.tomato) return textureCache.tomato;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Outer red flesh
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 256, 256);

  // Inner juicy pulp ring
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  grad.addColorStop(0, '#f87171');
  grad.addColorStop(0.5, '#ef4444');
  grad.addColorStop(0.85, '#b91c1c');
  grad.addColorStop(1, '#991b1b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // 4 Seed cavities with translucent gel and yellow seeds
  for (let c = 0; c < 4; c++) {
    const angle = (c / 4) * Math.PI * 2 + 0.3;
    const cx = 128 + Math.cos(angle) * 55;
    const cy = 128 + Math.sin(angle) * 55;

    ctx.fillStyle = 'rgba(180, 83, 9, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 22, 14, angle, 0, Math.PI * 2);
    ctx.fill();

    // Seeds
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx - 5, cy, 3, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  textureCache.tomato = map;
  return map;
}

function getTortillaTexture() {
  if (textureCache.tortilla) return textureCache.tortilla;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Corn masa nixtamal base
  ctx.fillStyle = '#e8b86d';
  ctx.fillRect(0, 0, 512, 512);

  // Fine masa grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 0.9));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.6));
  }
  ctx.putImageData(imgData, 0, 0);

  // Authentic charred comal browning spots
  for (let s = 0; s < 45; s++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rx = 4 + Math.random() * 12;
    const ry = 3 + Math.random() * 8;
    const rot = Math.random() * Math.PI;

    const op = 0.4 + Math.random() * 0.45;
    ctx.fillStyle = `rgba(94, 52, 18, ${op})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  textureCache.tortilla = map;
  return map;
}

function getPizzaCrustTexture() {
  if (textureCache.pizzaCrust) return textureCache.pizzaCrust;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Baked dough
  ctx.fillStyle = '#dfa052';
  ctx.fillRect(0, 0, 512, 512);

  // Wood-fired leopard char spots
  for (let c = 0; c < 70; c++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 3 + Math.random() * 11;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(38, 20, 10, 0.88)' : 'rgba(115, 60, 22, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  textureCache.pizzaCrust = map;
  return map;
}

function getPepperoniTexture() {
  if (textureCache.pep) return textureCache.pep;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Cured paprika red base
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 125);
  grad.addColorStop(0, '#c22b1d');
  grad.addColorStop(0.7, '#991b1b');
  grad.addColorStop(1, '#5a0f0a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();

  // White fat marbling & spice flecks
  for (let f = 0; f < 55; f++) {
    const r = Math.random() * 105;
    const a = Math.random() * Math.PI * 2;
    ctx.fillStyle = Math.random() > 0.3 ? 'rgba(255, 235, 220, 0.75)' : 'rgba(40, 10, 5, 0.8)';
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.5 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  textureCache.pep = map;
  return map;
}

function getSalmonTexture() {
  if (textureCache.salmon) return textureCache.salmon;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Coral-orange salmon meat
  ctx.fillStyle = '#fa7355';
  ctx.fillRect(0, 0, 512, 256);

  // Characteristic white intramuscular fat lines
  ctx.strokeStyle = 'rgba(255, 245, 240, 0.65)';
  ctx.lineWidth = 4;
  for (let x = -50; x < 600; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 20, 80, x - 15, 170, x + 10, 256);
    ctx.stroke();
  }

  // Dark sweet teriyaki glaze sheen
  ctx.fillStyle = 'rgba(45, 18, 5, 0.35)';
  ctx.fillRect(0, 0, 512, 256);

  const map = new THREE.CanvasTexture(canvas);
  textureCache.salmon = map;
  return map;
}

/**
 * Initialize 3D Viewer in a container
 */
export function initViewer(container) {
  if (!container) return;
  containerElement = container;

  // Ensure touch-action: none so mobile drag/zoom doesn't scroll page
  container.style.touchAction = 'none';

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 450;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_CONFIG.bgColor);
  scene.fog = new THREE.FogExp2(SCENE_CONFIG.bgColor, 0.06);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2.3, 3.7);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  // Setup Studio IBL Environment Map
  createStudioEnvironment(renderer, scene);

  // Hotspots Overlay Container & Lateral Indicators Dock
  createHotspotsOverlay(container);

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 6.5;
  controls.minPolarAngle = Math.PI * 0.05;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.0;

  // Smart pause auto-rotate during user interaction
  controls.addEventListener('start', () => {
    isUserInteracting = true;
  });
  controls.addEventListener('end', () => {
    isUserInteracting = false;
    lastInteractionTime = performance.now();
  });

  // Direct Click/Tap to Explode / Assemble Food Raycaster
  let pointerDownPos = { x: 0, y: 0 };
  let pointerDownTime = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
    pointerDownTime = performance.now();
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    const duration = performance.now() - pointerDownTime;

    // Generous tap tolerance for touchscreens (14px) and quick duration (< 400ms)
    if (dist < 14 && duration < 400) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      if (currentFoodGroup) {
        const hits = raycaster.intersectObjects(currentFoodGroup.children, true);
        if (hits.length > 0) {
          // Direct tap on food: Toggle between Exploded and Assembled!
          toggleExplodedView();
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch (err) {}
          }
        }
      }
    }
  });

  // Lighting & Environment
  setupLighting();
  setupEnvironment();
  createParticles();

  // Resize handler
  const resizeObserver = new ResizeObserver(() => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  isActive = true;
  animate();

  return { scene, camera, renderer, controls };
}

/**
 * Creates overlay for lateral indicator dock and non-intrusive micro-markers
 */
function createHotspotsOverlay(container) {
  const oldOverlay = container.querySelector('.hotspots-overlay');
  if (oldOverlay) oldOverlay.remove();

  const oldLateral = container.querySelector('.food-lateral-indicators');
  if (oldLateral) oldLateral.remove();

  // 3D Projection micro-markers container (pointer-events: none so it NEVER blocks user drags/gestures!)
  hotspotsOverlayElement = document.createElement('div');
  hotspotsOverlayElement.className = 'hotspots-overlay';
  hotspotsOverlayElement.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 8;
  `;
  container.style.position = 'relative';
  container.appendChild(hotspotsOverlayElement);

  // Non-intrusive Lateral Indicators Dock docked to the side
  lateralIndicatorsContainer = document.createElement('div');
  lateralIndicatorsContainer.className = 'food-lateral-indicators';
  lateralIndicatorsContainer.style.cssText = `
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 7px;
    z-index: 12;
    pointer-events: auto;
    max-width: 175px;
    transition: opacity 0.3s ease;
  `;
  container.appendChild(lateralIndicatorsContainer);
}

function setupLighting() {
  const ambient = new THREE.AmbientLight(SCENE_CONFIG.ambientColor, SCENE_CONFIG.ambientIntensity);
  scene.add(ambient);

  // Main key spotlight (restaurant overhead pendant)
  const spotLight = new THREE.SpotLight(SCENE_CONFIG.spotColor, SCENE_CONFIG.spotIntensity);
  spotLight.position.set(1.6, 5.8, 3.4);
  spotLight.angle = Math.PI / 4;
  spotLight.penumbra = 0.65;
  spotLight.decay = 1.4;
  spotLight.distance = 25;
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 2048;
  spotLight.shadow.mapSize.height = 2048;
  spotLight.shadow.camera.near = 1;
  spotLight.shadow.camera.far = 15;
  spotLight.shadow.bias = -0.0008;
  scene.add(spotLight);

  // Cooler secondary fill from front-right
  const frontLight = new THREE.SpotLight(0xfff8f0, 1.2);
  frontLight.position.set(2.2, 3.5, 2.8);
  frontLight.angle = Math.PI / 5;
  frontLight.penumbra = 0.8;
  frontLight.decay = 1.8;
  frontLight.distance = 18;
  scene.add(frontLight);

  const rimLight = new THREE.PointLight(SCENE_CONFIG.rimColor, SCENE_CONFIG.rimIntensity);
  rimLight.position.set(-2.8, 2.4, -3.2);
  scene.add(rimLight);

  // Extra cool blue rim for depth and specular pop
  const blueRim = new THREE.PointLight(0x4488cc, 0.5);
  blueRim.position.set(3.2, 1.2, -2.0);
  scene.add(blueRim);

  const fillLight = new THREE.PointLight(SCENE_CONFIG.fillColor, SCENE_CONFIG.fillIntensity);
  fillLight.position.set(-3.2, 1.8, 1.8);
  scene.add(fillLight);

  const bounceLight = new THREE.PointLight(SCENE_CONFIG.bounceColor, SCENE_CONFIG.bounceIntensity);
  bounceLight.position.set(0, -0.6, 0);
  scene.add(bounceLight);
}

function setupEnvironment() {
  // Slate/wooden restaurant table disk with wood grain texture
  const tableGeo = new THREE.CircleGeometry(7.5, 64);
  const tableCanvas = document.createElement('canvas');
  tableCanvas.width = 256; tableCanvas.height = 256;
  const tCtx = tableCanvas.getContext('2d');
  // Dark wood grain base
  const woodGrad = tCtx.createLinearGradient(0, 0, 256, 256);
  woodGrad.addColorStop(0, '#140f0b');
  woodGrad.addColorStop(0.5, '#0e0d0b');
  woodGrad.addColorStop(1, '#1a1410');
  tCtx.fillStyle = woodGrad;
  tCtx.fillRect(0, 0, 256, 256);
  // Subtle wood grain lines
  tCtx.strokeStyle = 'rgba(255,200,100,0.04)';
  tCtx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const y = (i * 9) % 256;
    tCtx.beginPath();
    tCtx.moveTo(0, y);
    tCtx.bezierCurveTo(64, y + 2, 192, y - 2, 256, y);
    tCtx.stroke();
  }
  const tableTexture = new THREE.CanvasTexture(tableCanvas);
  tableTexture.wrapS = THREE.RepeatWrapping;
  tableTexture.wrapT = THREE.RepeatWrapping;
  tableTexture.repeat.set(3, 3);
  const tableMat = new THREE.MeshStandardMaterial({
    map: tableTexture,
    metalness: 0.06,
    roughness: 0.92,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.52;
  table.receiveShadow = true;
  scene.add(table);

  // Subtle ambient gold accent ring
  const ringGeo = new THREE.RingGeometry(1.36, 1.41, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
    metalness: 0.9,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.5;
  scene.add(ring);
}

function createPlate() {
  if (plateMesh) {
    scene.remove(plateMesh);
  }

  const group = new THREE.Group();

  // Ceramic matte stoneware plate with subtle gloss
  const plateGeo = new THREE.CylinderGeometry(1.24, 1.15, 0.09, 72);
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 128; plateCanvas.height = 128;
  const pCtx = plateCanvas.getContext('2d');
  const plateGrad = pCtx.createRadialGradient(64, 64, 2, 64, 64, 90);
  plateGrad.addColorStop(0, '#252220');
  plateGrad.addColorStop(0.6, '#1c1a18');
  plateGrad.addColorStop(1, '#141210');
  pCtx.fillStyle = plateGrad;
  pCtx.fillRect(0, 0, 128, 128);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    metalness: 0.12,
    roughness: 0.58,
    envMapIntensity: 0.85,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = -0.46;
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // Ceramic beveled rim with roughness
  const rimGeo = new THREE.TorusGeometry(1.21, 0.036, 16, 72);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x1f1c19,
    metalness: 0.4,
    roughness: 0.45,
    envMapIntensity: 1.2,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.42;
  group.add(rim);

  // Delicate gold fine inner rim
  const goldRimGeo = new THREE.TorusGeometry(1.18, 0.010, 10, 72);
  const goldRimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.38,
    metalness: 0.97,
    roughness: 0.12,
    envMapIntensity: 1.5,
  });
  const goldRim = new THREE.Mesh(goldRimGeo, goldRimMat);
  goldRim.rotation.x = Math.PI / 2;
  goldRim.position.y = -0.41;
  group.add(goldRim);

  // Subtle plate shadow disk underneath
  const shadowGeo = new THREE.CircleGeometry(1.3, 48);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
  });
  const shadowDisk = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisk.rotation.x = -Math.PI / 2;
  shadowDisk.position.y = -0.515;
  group.add(shadowDisk);

  plateMesh = group;
  scene.add(group);
}

function createParticles() {
  const count = 48;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 1.5;
    positions[i3 + 1] = 0.1 + Math.random() * 2.0;
    positions[i3 + 2] = (Math.random() - 0.5) * 1.5;

    // Warm appetizing steam particles (soft amber/white)
    const col = new THREE.Color().setHSL(0.11, 0.45, 0.82);
    colors[i3] = col.r;
    colors[i3 + 1] = col.g;
    colors[i3 + 2] = col.b;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  particleSystem = new THREE.Points(geo, mat);
  scene.add(particleSystem);
}

/**
 * Load complete dish (supports both Procedural 3D model & Uploaded Photo)
 */
export async function loadFoodItem(item, imageDataUrl) {
  currentItemData = item;
  currentImageData = imageDataUrl;
  currentMode = '3d';
  explodedComponents = [];
  explodeProgress = 0;
  targetExplode = 0;

  createPlate();
  clearCurrentFood();
  clearHotspots();

  const modelType = item.modelType || 'burger';
  const foodGroup = createProceduralFoodModel(modelType, item);

  currentFoodGroup = foodGroup;
  scene.add(foodGroup);

  animateEntrance(foodGroup);
  setupIngredientsHotspots(item);
  renderIngredientsShelf(item);
}

function clearCurrentFood() {
  if (currentFoodGroup) {
    scene.remove(currentFoodGroup);
    currentFoodGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => { m.map?.dispose(); m.dispose(); });
        } else {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      }
    });
    currentFoodGroup = null;
  }
}

function clearHotspots() {
  hotspots.forEach(h => {
    if (h.element) h.element.remove();
  });
  hotspots = [];

  if (lateralIndicatorsContainer) {
    lateralIndicatorsContainer.innerHTML = '';
  }
}

function registerComponent(mesh, origY, explodeY, origX = 0, explodeX = 0, origZ = 0, explodeZ = 0) {
  explodedComponents.push({
    mesh,
    origY,
    explodeY,
    origX,
    explodeX,
    origZ,
    explodeZ,
  });
}

/**
 * Procedural Real 3D Food Models with Layer Separation & Realistic PBR
 */
function createProceduralFoodModel(type, item) {
  const group = new THREE.Group();
  explodedComponents = [];

  switch (type) {
    case 'custom_ai':
      buildCustomAIFoodModel(group, item, currentImageData);
      break;
    case 'burger':
      buildBurgerModel(group);
      break;
    case 'tacos':
      buildTacosModel(group);
      break;
    case 'pizza':
      buildPizzaModel(group);
      break;
    case 'ribeye':
      buildRibeyeModel(group);
      break;
    case 'salad':
      buildSaladModel(group);
      break;
    case 'drink':
      buildDrinkModel(group, 0xffd152);
      break;
    case 'cocktail':
      buildCocktailModel(group);
      break;
    case 'dessert':
      buildFlanModel(group);
      break;
    case 'salmon':
      buildSalmonModel(group);
      break;
    case 'guacamole':
      buildGuacamoleModel(group);
      break;
    default:
      if (currentImageData || item?.image || item?.imageData || item?.aiDepthMap) {
        buildCustomAIFoodModel(group, item, currentImageData);
      } else {
        buildBurgerModel(group);
      }
  }

  return group;
}

// ==========================================
// 0. MODELO 3D ÚNICO ESCULPIDO POR IA (VOLUMÉTRICO PBR)
// ==========================================
function buildCustomAIFoodModel(group, item, imageDataUrl) {
  const photoUrl = imageDataUrl || item?.image || item?.imageData || null;
  const depthMapUrl = item?.aiDepthMap || null;

  // 1. Ceramic presentation plate with metallic gold rim
  const plateGroup = new THREE.Group();
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0x181614,
    roughness: 0.16,
    metalness: 0.08,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
  });
  const plateGeo = new THREE.CylinderGeometry(1.22, 1.05, 0.08, 48);
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = -0.34;
  plate.castShadow = true;
  plate.receiveShadow = true;
  plateGroup.add(plate);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.21, 0.014, 8, 48), rimMat);
  rim.position.y = -0.30;
  rim.rotation.x = Math.PI / 2;
  plateGroup.add(rim);

  group.add(plateGroup);
  registerComponent(plateGroup, 0, -0.75);

  // 2. Layer 1: Base / Cama Artesanal (Guarnición / Salsa / Base de plato)
  const baseGroup = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x3d2714,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const baseBed = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.94, 0.07, 36), baseMat);
  baseBed.position.y = -0.26;
  baseBed.castShadow = true;
  baseGroup.add(baseBed);

  // Garnish sauce drops around base perimeter
  const swirlMat = new THREE.MeshPhysicalMaterial({
    color: 0xb45309,
    roughness: 0.15,
    clearcoat: 0.95,
    clearcoatRoughness: 0.1,
  });
  for (let s = 0; s < 8; s++) {
    const angle = (s / 8) * Math.PI * 2;
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), swirlMat);
    drop.scale.set(1.4, 0.4, 1.0);
    drop.position.set(Math.cos(angle) * 0.95, -0.28, Math.sin(angle) * 0.95);
    baseGroup.add(drop);
  }

  group.add(baseGroup);
  registerComponent(baseGroup, 0, -0.35);

  // 3. Layer 2: Cuerpo Principal 3D Volumétrico Esculpido con Relieve IA
  const foodGroup = new THREE.Group();
  const gridSize = 64;
  const foodGeo = new THREE.PlaneGeometry(1.7, 1.7, gridSize, gridSize);
  foodGeo.rotateX(-Math.PI / 2);

  const heightGrid = createFoodHeightMatrix(depthMapUrl, photoUrl, gridSize + 1);

  const pos = foodGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);

    const u = Math.min(1, Math.max(0, (vx + 0.85) / 1.7));
    const v = Math.min(1, Math.max(0, (vz + 0.85) / 1.7));

    const gx = Math.min(gridSize, Math.floor(u * gridSize));
    const gy = Math.min(gridSize, Math.floor(v * gridSize));
    const rawHeight = heightGrid[gy * (gridSize + 1) + gx];

    const r = Math.hypot(vx, vz) / 0.82;
    const falloff = Math.pow(Math.max(0, 1.0 - Math.min(1.0, r)), 1.15);

    const vy = (rawHeight * 0.48 + 0.04) * falloff;
    pos.setY(i, vy - 0.12);
  }
  foodGeo.computeVertexNormals();

  let foodMat;
  if (photoUrl) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(photoUrl);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;

    foodMat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.32,
      metalness: 0.04,
      clearcoat: 0.88,
      clearcoatRoughness: 0.18,
      reflectivity: 0.78,
      side: THREE.DoubleSide,
    });
  } else {
    const fallbackTex = createProceduralCulinaryTexture();
    foodMat = new THREE.MeshPhysicalMaterial({
      map: fallbackTex,
      roughness: 0.36,
      clearcoat: 0.78,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
    });
  }

  const foodMesh = new THREE.Mesh(foodGeo, foodMat);
  foodMesh.castShadow = true;
  foodMesh.receiveShadow = true;
  foodGroup.add(foodMesh);

  // 3D Solid Volumetric Skirt wall connecting top mesh to base
  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0x3d1f0d,
    roughness: 0.75,
  });
  const skirtGeo = new THREE.CylinderGeometry(0.85, 0.86, 0.16, 48, 1, true);
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = -0.19;
  skirt.castShadow = true;
  foodGroup.add(skirt);

  group.add(foodGroup);
  registerComponent(foodGroup, 0, 0.08);

  // 4. Layer 3: Topping Gourmet / Glaseado PBR & Microgreens
  const garnishGroup = new THREE.Group();
  const herbMat = new THREE.MeshPhysicalMaterial({
    color: 0x1f7a28,
    roughness: 0.35,
    clearcoat: 0.75,
    side: THREE.DoubleSide,
  });

  for (let h = 0; h < 8; h++) {
    const angle = (h / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const r = 0.08 + Math.random() * 0.25;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08, 2, 2), herbMat);
    leaf.position.set(Math.cos(angle) * r, 0.28 + Math.random() * 0.06, Math.sin(angle) * r);
    leaf.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, Math.random() * Math.PI);
    leaf.castShadow = true;
    garnishGroup.add(leaf);
  }

  const spiceMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.35 });
  for (let s = 0; s < 28; s++) {
    const r = Math.random() * 0.40;
    const theta = Math.random() * Math.PI * 2;
    const spec = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.018), spiceMat);
    spec.position.set(Math.cos(theta) * r, 0.26 + Math.random() * 0.04, Math.sin(theta) * r);
    spec.rotation.set(Math.random(), Math.random(), Math.random());
    garnishGroup.add(spec);
  }

  group.add(garnishGroup);
  registerComponent(garnishGroup, 0, 0.68);
}

function createFoodHeightMatrix(depthMapUrl, photoUrl, count) {
  const grid = new Float32Array(count * count);
  const cx = count / 2;
  const cy = count / 2;
  const maxR = count * 0.48;

  const targetUrl = depthMapUrl || photoUrl;
  if (targetUrl) {
    try {
      const img = new Image();
      img.src = targetUrl;
      if (img.complete && img.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = count;
        canvas.height = count;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, count, count);
        const data = ctx.getImageData(0, 0, count, count).data;
        for (let y = 0; y < count; y++) {
          for (let x = 0; x < count; x++) {
            const idx = (y * count + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const dist = Math.hypot(x - cx, y - cy);
            const normDist = Math.min(1.0, dist / maxR);
            const mound = Math.pow(Math.max(0, Math.cos(normDist * Math.PI * 0.5)), 1.25);
            grid[y * count + x] = mound * 0.65 + lum * mound * 0.35;
          }
        }
        return grid;
      }
    } catch (e) {
      console.warn('Sync height matrix extraction fallback:', e);
    }
  }

  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      const normDist = Math.min(1.0, dist / maxR);
      const mound = Math.pow(Math.max(0, Math.cos(normDist * Math.PI * 0.5)), 1.25);
      const ripple = Math.sin(x * 0.35) * Math.cos(y * 0.35) * 0.08;
      grid[y * count + x] = Math.max(0, mound + ripple * mound);
    }
  }
  return grid;
}

function createProceduralCulinaryTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, '#ea580c');
  grad.addColorStop(0.3, '#d97706');
  grad.addColorStop(0.7, '#78350f');
  grad.addColorStop(1, '#451a03');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const id = ctx.getImageData(0, 0, 512, 512);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.8));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.4));
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  return tex;
}

// ==========================================
// 1. HAMBURGUESA GOURMET REALISTA 3D
// ==========================================
function buildBurgerModel(group) {
  const { map: bunMap, bump: bunBump } = getBunTextures();
  const { map: beefMap } = getBeefPattyTextures();
  const tomatoMap = getTomatoTexture();

  // Premium Brioche Bun Material with egg-wash sheen
  const bunMat = new THREE.MeshPhysicalMaterial({
    map: bunMap,
    bumpMap: bunBump,
    bumpScale: 0.015,
    roughness: 0.45,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  });

  // Layer 1: Bottom Brioche Bun
  const bottomBun = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.82, 0.24, 36), bunMat);
  bottomBun.position.y = -0.32;
  bottomBun.castShadow = true;
  bottomBun.receiveShadow = true;
  group.add(bottomBun);
  registerComponent(bottomBun, -0.32, -0.75);

  // Layer 2: Ruffled Crisp Lettuce Leaves
  const lettuceGroup = new THREE.Group();
  const lettuceMat = new THREE.MeshStandardMaterial({
    color: 0x3cb03c,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const leafGeo = new THREE.PlaneGeometry(0.55, 0.42, 6, 6);
    // Add organic ripples to leaf vertices
    const pos = leafGeo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      pos.setZ(v, Math.sin(vx * 12) * Math.cos(vy * 10) * 0.05);
    }
    leafGeo.computeVertexNormals();
    const leaf = new THREE.Mesh(leafGeo, lettuceMat);
    leaf.position.set(Math.cos(angle) * 0.74, 0.18, Math.sin(angle) * 0.74);
    leaf.rotation.x = -Math.PI / 2 + 0.35;
    leaf.rotation.z = angle;
    leaf.castShadow = true;
    lettuceGroup.add(leaf);
  }
  group.add(lettuceGroup);
  registerComponent(lettuceGroup, 0, -0.38);

  // Layer 3: Juicy Angus Beef Patty
  const meatMat = new THREE.MeshPhysicalMaterial({
    map: beefMap,
    roughness: 0.45,
    metalness: 0.08,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
  });
  const meatGeo = new THREE.CylinderGeometry(0.90, 0.90, 0.26, 36);
  // Organic edge displacement for real handcrafted patty rim
  const mPos = meatGeo.attributes.position;
  for (let v = 0; v < mPos.count; v++) {
    const y = mPos.getY(v);
    if (Math.abs(y) < 0.12) {
      const x = mPos.getX(v);
      const z = mPos.getZ(v);
      const factor = 1 + (Math.sin(v * 7) * 0.04);
      mPos.setX(v, x * factor);
      mPos.setZ(v, z * factor);
    }
  }
  meatGeo.computeVertexNormals();
  const meat = new THREE.Mesh(meatGeo, meatMat);
  meat.position.y = -0.11;
  meat.castShadow = true;
  meat.receiveShadow = true;
  group.add(meat);
  registerComponent(meat, -0.11, 0.05);

  // Layer 4: Melted Cheddar Cheese with Drooping Corners
  const cheeseGroup = new THREE.Group();
  const cheeseMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  });

  const cheeseGeo = new THREE.BoxGeometry(1.24, 0.038, 1.24, 8, 1, 8);
  // Sag cheese corners downwards naturally over the patty
  const cPos = cheeseGeo.attributes.position;
  for (let v = 0; v < cPos.count; v++) {
    const x = cPos.getX(v);
    const z = cPos.getZ(v);
    const dist = Math.hypot(x, z);
    if (dist > 0.58) {
      cPos.setY(v, cPos.getY(v) - (dist - 0.58) * 0.28);
    }
  }
  cheeseGeo.computeVertexNormals();
  const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
  cheese.position.y = 0.03;
  cheese.rotation.y = Math.PI / 4;
  cheese.castShadow = true;
  cheeseGroup.add(cheese);
  group.add(cheeseGroup);
  registerComponent(cheeseGroup, 0.03, 0.42);

  // Layer 5: Fresh Juicy Tomato Slices + Caramelized Onion
  const tomatoGroup = new THREE.Group();
  const tomatoMat = new THREE.MeshPhysicalMaterial({
    map: tomatoMap,
    roughness: 0.2,
    clearcoat: 0.95,
    clearcoatRoughness: 0.12,
  });
  const tom1 = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.065, 24), tomatoMat);
  tom1.position.set(-0.25, 0.11, -0.14);
  tom1.rotation.z = 0.06;
  tom1.castShadow = true;
  tomatoGroup.add(tom1);

  const tom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.065, 24), tomatoMat);
  tom2.position.set(0.26, 0.12, 0.14);
  tom2.rotation.z = -0.06;
  tom2.castShadow = true;
  tomatoGroup.add(tom2);

  // Sweet red onion ring
  const onionMat = new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.35 });
  const onion = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 24), onionMat);
  onion.position.set(0.02, 0.16, 0.0);
  onion.rotation.x = Math.PI / 2;
  tomatoGroup.add(onion);

  group.add(tomatoGroup);
  registerComponent(tomatoGroup, 0, 0.78);

  // Layer 6: Top Brioche Bun Dome + Golden Sesame Seeds
  const topBunGroup = new THREE.Group();
  const topBunGeo = new THREE.SphereGeometry(0.90, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.48);
  const topBun = new THREE.Mesh(topBunGeo, bunMat);
  topBun.position.y = 0.22;
  topBun.castShadow = true;
  topBunGroup.add(topBun);

  // 45 Handcrafted roasted sesame seeds
  const seedMat = new THREE.MeshStandardMaterial({ color: 0xfff7e6, roughness: 0.35 });
  const seedGeo = new THREE.ConeGeometry(0.022, 0.055, 6);
  seedGeo.scale(1, 1, 0.5);

  for (let i = 0; i < 45; i++) {
    const phi = Math.random() * Math.PI * 0.36;
    const theta = Math.random() * Math.PI * 2;
    const r = 0.902;
    const seed = new THREE.Mesh(seedGeo, seedMat);
    seed.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      0.22 + r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    seed.lookAt(0, 0.22, 0);
    seed.rotation.z += Math.random() * 0.4;
    topBunGroup.add(seed);
  }

  group.add(topBunGroup);
  registerComponent(topBunGroup, 0, 1.25);
}

// ==========================================
// 2. TACOS AL PASTOR REALISTAS 3D
// ==========================================
function createRealisticTortillaMesh(mat, scale = 1.0) {
  const tortillaGroup = new THREE.Group();
  const shape = new THREE.Shape();
  const rOuter = 0.45 * scale;
  const rInner = 0.40 * scale;
  const depth = 0.90 * scale;
  const arcPoints = 32;
  const outerPoints = [];
  const innerPoints = [];

  for (let i = 0; i <= arcPoints; i++) {
    const theta = Math.PI * 0.14 + (i / arcPoints) * (Math.PI * 0.72);
    outerPoints.push(new THREE.Vector2(Math.cos(theta) * rOuter, -Math.sin(theta) * rOuter));
  }
  for (let i = arcPoints; i >= 0; i--) {
    const theta = Math.PI * 0.14 + (i / arcPoints) * (Math.PI * 0.72);
    innerPoints.push(new THREE.Vector2(Math.cos(theta) * rInner, -Math.sin(theta) * rInner));
  }

  shape.moveTo(outerPoints[0].x, outerPoints[0].y);
  outerPoints.forEach(p => shape.lineTo(p.x, p.y));
  innerPoints.forEach(p => shape.lineTo(p.x, p.y));
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 3,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  tortillaGroup.add(mesh);

  return tortillaGroup;
}

function buildTacosModel(group) {
  const tortillaTex = getTortillaTexture();
  const tortillaMat = new THREE.MeshStandardMaterial({
    map: tortillaTex,
    roughness: 0.8,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const meatPastorMat = new THREE.MeshPhysicalMaterial({
    color: 0xba3214,
    roughness: 0.52,
    metalness: 0.12,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  });

  const pineappleMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5b818,
    roughness: 0.35,
    clearcoat: 0.5,
  });

  const avocadoMat = new THREE.MeshStandardMaterial({ color: 0x76a332, roughness: 0.42 });
  const cilantroMat = new THREE.MeshStandardMaterial({ color: 0x228822, roughness: 0.5, side: THREE.DoubleSide });
  const onionMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f5, roughness: 0.4 });
  const limeMat = new THREE.MeshStandardMaterial({ color: 0x42b542, roughness: 0.3 });

  const tacoLayout = [
    { x: 0, y: -0.26, z: 0, rotY: 0, scale: 1.0 },
    { x: -0.52, y: -0.26, z: 0.14, rotY: 0.28, scale: 0.94 },
    { x: 0.52, y: -0.26, z: 0.14, rotY: -0.28, scale: 0.94 },
  ];

  // Layer 1: Doble Tortilla Nixtamalizada + Rodajas de Limón
  const tortillaGroup = new THREE.Group();
  tacoLayout.forEach(tl => {
    const tMesh = createRealisticTortillaMesh(tortillaMat, tl.scale);
    tMesh.position.set(tl.x, tl.y, tl.z);
    tMesh.rotation.y = tl.rotY;
    tortillaGroup.add(tMesh);
  });

  // Fresh lime wedges on plate
  const lime1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16, 1, false, 0, Math.PI * 0.5), limeMat);
  lime1.position.set(-0.78, -0.38, 0.42);
  lime1.rotation.set(Math.PI / 2, 0, 0.3);
  lime1.castShadow = true;
  tortillaGroup.add(lime1);

  const lime2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16, 1, false, 0, Math.PI * 0.5), limeMat);
  lime2.position.set(0.78, -0.38, 0.42);
  lime2.rotation.set(Math.PI / 2, 0, -0.3);
  lime2.castShadow = true;
  tortillaGroup.add(lime2);

  group.add(tortillaGroup);
  registerComponent(tortillaGroup, -0.26, -0.75);

  // Layer 2: Carne al Pastor Marinada con Achiote
  const meatGroup = new THREE.Group();
  tacoLayout.forEach(tl => {
    for (let m = 0; m < 18; m++) {
      const meatChunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065 + Math.random() * 0.04), meatPastorMat);
      meatChunk.position.set(
        tl.x + (Math.random() - 0.5) * 0.48 * tl.scale,
        tl.y + 0.12 + Math.random() * 0.13,
        tl.z + (Math.random() - 0.5) * 0.22 * tl.scale
      );
      meatChunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      meatChunk.castShadow = true;
      meatGroup.add(meatChunk);
    }
  });
  group.add(meatGroup);
  registerComponent(meatGroup, -0.12, -0.22);

  // Layer 3: Piña Asada Caramelizada & Abanico de Aguacate
  const pineappleGroup = new THREE.Group();
  tacoLayout.forEach(tl => {
    for (let p = 0; p < 3; p++) {
      const pine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.11), pineappleMat);
      pine.position.set(
        tl.x + (p - 1) * 0.16 * tl.scale,
        tl.y + 0.22,
        tl.z + (Math.random() - 0.5) * 0.08
      );
      pine.rotation.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0);
      pine.castShadow = true;
      pineappleGroup.add(pine);
    }
    const avo = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.038, 8, 16, Math.PI * 0.55), avocadoMat);
    avo.position.set(tl.x, tl.y + 0.20, tl.z - 0.08);
    avo.rotation.set(Math.PI / 2, 0, tl.rotY);
    avo.castShadow = true;
    pineappleGroup.add(avo);
  });
  group.add(pineappleGroup);
  registerComponent(pineappleGroup, 0.02, 0.35);

  // Layer 4: Cebolla Blanca Crujiente & Cilantro Fresco
  const onionCilantroGroup = new THREE.Group();
  tacoLayout.forEach(tl => {
    for (let o = 0; o < 15; o++) {
      const onion = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.036), onionMat);
      onion.position.set(
        tl.x + (Math.random() - 0.5) * 0.45 * tl.scale,
        tl.y + 0.25 + Math.random() * 0.06,
        tl.z + (Math.random() - 0.5) * 0.20 * tl.scale
      );
      onionCilantroGroup.add(onion);
    }
    for (let c = 0; c < 18; c++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.04), cilantroMat);
      leaf.position.set(
        tl.x + (Math.random() - 0.5) * 0.46 * tl.scale,
        tl.y + 0.27 + Math.random() * 0.06,
        tl.z + (Math.random() - 0.5) * 0.22 * tl.scale
      );
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      onionCilantroGroup.add(leaf);
    }
  });
  group.add(onionCilantroGroup);
  registerComponent(onionCilantroGroup, 0.16, 0.88);

  // Layer 5: Salsa Verde Asada Taquera Especial
  const salsaGroup = new THREE.Group();
  const salsaMat = new THREE.MeshPhysicalMaterial({
    color: 0x448a24,
    roughness: 0.32,
    clearcoat: 0.6,
  });
  tacoLayout.forEach(tl => {
    for (let s = 0; s < 5; s++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), salsaMat);
      drop.position.set(
        tl.x + (s - 2) * 0.10 * tl.scale,
        tl.y + 0.30 + (Math.random() - 0.5) * 0.04,
        tl.z + (Math.random() - 0.5) * 0.06
      );
      drop.scale.set(1.5, 0.6, 1.2);
      salsaGroup.add(drop);
    }
  });
  group.add(salsaGroup);
  registerComponent(salsaGroup, 0.28, 1.38);
}

// ==========================================
// 3. PIZZA ARTESANAL NAPOLITANA 3D
// ==========================================
function buildPizzaModel(group) {
  const crustTex = getPizzaCrustTexture();
  const pepTex = getPepperoniTexture();

  // Layer 1: Wood-fired Cornicione Crust & San Marzano Pomodoro
  const crustGroup = new THREE.Group();
  const doughMat = new THREE.MeshStandardMaterial({
    map: crustTex,
    roughness: 0.75,
    metalness: 0.02,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.075, 48), doughMat);
  base.position.y = -0.32;
  base.castShadow = true;
  base.receiveShadow = true;
  crustGroup.add(base);

  // Puffy Torus cornicione rim
  const rimGeo = new THREE.TorusGeometry(1.14, 0.13, 16, 48);
  const rimMesh = new THREE.Mesh(rimGeo, doughMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.25;
  rimMesh.castShadow = true;
  crustGroup.add(rimMesh);

  // San Marzano Tomato Sauce
  const sauceMat = new THREE.MeshStandardMaterial({ color: 0xba2415, roughness: 0.45, metalness: 0.05 });
  const sauce = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.08, 48), sauceMat);
  sauce.position.y = -0.30;
  crustGroup.add(sauce);

  group.add(crustGroup);
  registerComponent(crustGroup, -0.32, -0.75);

  // Layer 2: Melted Mozzarella Fior di Latte with Bubbly Toasts
  const cheeseGroup = new THREE.Group();
  const cheeseMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbeab2,
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
  });
  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.068, 48), cheeseMat);
  cheese.position.y = -0.26;
  cheese.castShadow = true;
  cheeseGroup.add(cheese);

  // Roasted bubbly spots
  const toastMat = new THREE.MeshStandardMaterial({ color: 0xd48f1e, roughness: 0.45 });
  for (let i = 0; i < 20; i++) {
    const r = Math.random() * 0.88;
    const theta = Math.random() * Math.PI * 2;
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.07 + Math.random() * 0.07, 0.07, 0.02, 16), toastMat);
    spot.position.set(Math.cos(theta) * r, -0.22, Math.sin(theta) * r);
    spot.scale.set(1 + Math.random() * 0.5, 1, 1 + Math.random() * 0.5);
    cheeseGroup.add(spot);
  }
  group.add(cheeseGroup);
  registerComponent(cheeseGroup, -0.26, -0.22);

  // Layer 3: Cured Pepperoni Slices (14 slices with glossy cupped edges)
  const pepGroup = new THREE.Group();
  const pepMat = new THREE.MeshPhysicalMaterial({
    map: pepTex,
    roughness: 0.3,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.2,
  });

  const pepPositions = [
    { r: 0.38, a: 0.2 }, { r: 0.40, a: 1.4 }, { r: 0.37, a: 2.7 }, { r: 0.42, a: 4.0 }, { r: 0.39, a: 5.2 },
    { r: 0.76, a: 0.0 }, { r: 0.78, a: 0.7 }, { r: 0.75, a: 1.4 }, { r: 0.79, a: 2.1 },
    { r: 0.76, a: 2.8 }, { r: 0.77, a: 3.5 }, { r: 0.75, a: 4.2 }, { r: 0.78, a: 4.9 }, { r: 0.76, a: 5.6 }
  ];

  pepPositions.forEach(p => {
    const sliceMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.15, 0.03, 22), pepMat);
    sliceMesh.position.set(Math.cos(p.a) * p.r, -0.21, Math.sin(p.a) * p.r);
    sliceMesh.rotation.x = (Math.random() - 0.5) * 0.1;
    sliceMesh.rotation.z = (Math.random() - 0.5) * 0.1;
    sliceMesh.castShadow = true;
    pepGroup.add(sliceMesh);
  });
  group.add(pepGroup);
  registerComponent(pepGroup, -0.21, 0.32);

  // Layer 4: Sliced Portobellos & Black Olives
  const veggiesGroup = new THREE.Group();
  const mushMat = new THREE.MeshStandardMaterial({ color: 0xbaa48e, roughness: 0.65 });
  for (let i = 0; i < 9; i++) {
    const r = 0.25 + Math.random() * 0.55;
    const theta = i * 0.7 + 0.3;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.03, 12, 1, false, 0, Math.PI), mushMat);
    cap.position.set(Math.cos(theta) * r, -0.18, Math.sin(theta) * r);
    cap.rotation.x = Math.PI / 2;
    cap.rotation.z = Math.random() * Math.PI * 2;
    veggiesGroup.add(cap);
  }

  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.35 });
  for (let i = 0; i < 8; i++) {
    const r = 0.3 + Math.random() * 0.5;
    const theta = i * 0.8 + 0.5;
    const olive = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 16), oliveMat);
    olive.position.set(Math.cos(theta) * r, -0.17, Math.sin(theta) * r);
    olive.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
    veggiesGroup.add(olive);
  }
  group.add(veggiesGroup);
  registerComponent(veggiesGroup, -0.18, 0.85);

  // Layer 5: Fresh Basil Leaves & Oregano
  const basilGroup = new THREE.Group();
  const basilMat = new THREE.MeshPhysicalMaterial({
    color: 0x1f7a28,
    roughness: 0.42,
    clearcoat: 0.6,
    side: THREE.DoubleSide,
  });

  const basilPositions = [
    { r: 0.2, a: 0.8, rot: 0.3 },
    { r: 0.55, a: 2.2, rot: -0.5 },
    { r: 0.6, a: 3.9, rot: 0.8 },
    { r: 0.45, a: 5.3, rot: -0.2 }
  ];
  basilPositions.forEach(b => {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.13, 4, 4), basilMat);
    leaf.position.set(Math.cos(b.a) * b.r, -0.15, Math.sin(b.a) * b.r);
    leaf.rotation.x = -Math.PI / 2 + 0.2;
    leaf.rotation.z = b.rot;
    leaf.castShadow = true;
    basilGroup.add(leaf);
  });
  group.add(basilGroup);
  registerComponent(basilGroup, -0.15, 1.35);
}

// ==========================================
// 4. RIBEYE PRIME STEAK 3D
// ==========================================
function buildRibeyeModel(group) {
  // Layer 1: Roasted Cambray Potatoes
  const potGroup = new THREE.Group();
  const potatoMat = new THREE.MeshStandardMaterial({ color: 0xc89848, roughness: 0.65 });
  const potPositions = [{ x: -0.75, z: 0.45 }, { x: -0.9, z: 0.2 }, { x: -0.65, z: 0.65 }];
  potPositions.forEach(p => {
    const pot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), potatoMat);
    pot.position.set(p.x, -0.32, p.z);
    pot.castShadow = true;
    potGroup.add(pot);
  });
  group.add(potGroup);
  registerComponent(potGroup, 0, -0.4, 0, -0.45);

  // Layer 2: Seared Ribeye Slab with Crosshatch Grill Marks
  const steakGroup = new THREE.Group();
  const steakMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a2414,
    roughness: 0.45,
    metalness: 0.12,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
  const steakGeo = new THREE.CylinderGeometry(0.85, 0.90, 0.35, 28);
  steakGeo.scale(1.22, 1, 0.82);
  const steak = new THREE.Mesh(steakGeo, steakMat);
  steak.position.y = -0.22;
  steak.castShadow = true;
  steak.receiveShadow = true;
  steakGroup.add(steak);

  // Dark charred cross-hatch grill sear lines
  const grillMat = new THREE.MeshStandardMaterial({ color: 0x140a05, roughness: 0.9 });
  for (let i = -3; i <= 3; i++) {
    const line1 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.02, 0.038), grillMat);
    line1.position.set(0, -0.04, i * 0.18);
    line1.rotation.y = 0.55;
    steakGroup.add(line1);

    const line2 = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.02, 0.038), grillMat);
    line2.position.set(0, -0.04, i * 0.18);
    line2.rotation.y = -0.55;
    steakGroup.add(line2);
  }

  // Sea salt flakes
  const saltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.85 });
  for (let s = 0; s < 18; s++) {
    const flake = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.025), saltMat);
    flake.position.set((Math.random() - 0.5) * 0.8, -0.035, (Math.random() - 0.5) * 0.5);
    flake.rotation.y = Math.random() * Math.PI;
    steakGroup.add(flake);
  }

  group.add(steakGroup);
  registerComponent(steakGroup, 0, 0.05);

  // Layer 3: Fresh Rosemary Sprig
  const herbMat = new THREE.MeshStandardMaterial({ color: 0x275922, roughness: 0.55 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 8), herbMat);
  stem.position.set(-0.15, 0.01, 0.1);
  stem.rotation.z = Math.PI / 2.8;
  stem.castShadow = true;
  group.add(stem);
  registerComponent(stem, 0.01, 0.55);

  // Layer 4: Melting Garlic Herb Butter
  const butterMat = new THREE.MeshPhysicalMaterial({
    color: 0xffea75,
    roughness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });
  const butter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.24), butterMat);
  butter.position.set(0.1, -0.01, 0);
  butter.rotation.y = 0.3;
  butter.castShadow = true;
  group.add(butter);
  registerComponent(butter, -0.01, 0.85);
}

// ==========================================
// 5. ENSALADA CÉSAR 3D
// ==========================================
function buildSaladModel(group) {
  // Layer 1: Ceramic Salad Bowl
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.3, metalness: 0.1 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.6, 0.45, 32), bowlMat);
  bowl.position.y = -0.25;
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);
  registerComponent(bowl, -0.25, -0.65);

  // Layer 2: Romaine Lettuce Heap
  const lettuceGroup = new THREE.Group();
  const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x48b048, roughness: 0.55, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x2e852e, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.72;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26, 3, 3), i % 2 === 0 ? leafMat1 : leafMat2);
    leaf.position.set(Math.cos(angle) * r, -0.15 + Math.random() * 0.28, Math.sin(angle) * r);
    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    leaf.castShadow = true;
    lettuceGroup.add(leaf);
  }
  group.add(lettuceGroup);
  registerComponent(lettuceGroup, 0, -0.05);

  // Layer 3: Garlic-Herb Croutons
  const croutonGroup = new THREE.Group();
  const croutonMat = new THREE.MeshStandardMaterial({ color: 0xc89646, roughness: 0.8 });
  for (let c = 0; c < 9; c++) {
    const crouton = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), croutonMat);
    crouton.position.set((Math.random() - 0.5) * 0.9, 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.9);
    crouton.rotation.set(Math.random(), Math.random(), 0);
    crouton.castShadow = true;
    croutonGroup.add(crouton);
  }
  group.add(croutonGroup);
  registerComponent(croutonGroup, 0, 0.45);

  // Layer 4: Cherry Tomatoes & Shaved Parmigiano
  const tomGroup = new THREE.Group();
  const tomMat = new THREE.MeshPhysicalMaterial({ color: 0xd92626, roughness: 0.2, clearcoat: 0.9 });
  for (let t = 0; t < 5; t++) {
    const tom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), tomMat);
    tom.position.set((Math.random() - 0.5) * 0.75, 0.1 + Math.random() * 0.08, (Math.random() - 0.5) * 0.75);
    tom.castShadow = true;
    tomGroup.add(tom);
  }
  group.add(tomGroup);
  registerComponent(tomGroup, 0, 0.85);
}

// ==========================================
// 6. BEBIDA / LIMONADA FRÍA 3D
// ==========================================
function buildDrinkModel(group, liquidColor = 0xffd152) {
  // Layer 1: Clear Glass
  const glassGroup = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    transmission: 0.92,
    ior: 1.5,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 1.4, 32, 1, true), glassMat);
  glass.position.y = 0.22;
  glassGroup.add(glass);

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 32), glassMat);
  bottom.position.y = -0.45;
  glassGroup.add(bottom);
  group.add(glassGroup);
  registerComponent(glassGroup, 0, -0.5);

  // Layer 2: Refreshing Liquid
  const liquidMat = new THREE.MeshStandardMaterial({
    color: liquidColor,
    transparent: true,
    opacity: 0.82,
    roughness: 0.15,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 1.15, 32), liquidMat);
  liquid.position.y = 0.12;
  group.add(liquid);
  registerComponent(liquid, 0.12, 0.25);

  // Layer 3: Crystal Ice Cubes
  const iceGroup = new THREE.Group();
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    roughness: 0.08,
    transmission: 0.85,
    ior: 1.31,
  });
  [{ x: -0.1, y: 0.45, z: 0.05 }, { x: 0.15, y: 0.38, z: -0.1 }, { x: 0.0, y: 0.58, z: 0.1 }].forEach(p => {
    const ice = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), iceMat);
    ice.position.set(p.x, p.y, p.z);
    ice.rotation.set(Math.random(), Math.random(), 0);
    iceGroup.add(ice);
  });
  group.add(iceGroup);
  registerComponent(iceGroup, 0, 0.7);

  // Layer 4: Lemon Slice
  const lemonMat = new THREE.MeshStandardMaterial({ color: 0xf5ee38, roughness: 0.3 });
  const lemonSlice = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 18), lemonMat);
  lemonSlice.position.set(0.48, 0.92, 0);
  lemonSlice.rotation.z = Math.PI / 3;
  lemonSlice.castShadow = true;
  group.add(lemonSlice);
  registerComponent(lemonSlice, 0.92, 1.25);

  // Layer 5: Straw
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 16), strawMat);
  straw.position.set(0.12, 0.5, 0.1);
  straw.rotation.z = -0.22;
  group.add(straw);
  registerComponent(straw, 0.5, 1.6);
}

// ==========================================
// 7. CÓCTEL MARGARITA CLÁSICA 3D
// ==========================================
function buildCocktailModel(group) {
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    roughness: 0.05,
    transmission: 0.92,
    ior: 1.5,
  });

  const stemGroup = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 32), glassMat);
  base.position.y = -0.46;
  stemGroup.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 16), glassMat);
  stem.position.y = -0.11;
  stemGroup.add(stem);
  group.add(stemGroup);
  registerComponent(stemGroup, 0, -0.4);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 32, 1, true), glassMat);
  cone.position.y = 0.54;
  cone.rotation.x = Math.PI;
  group.add(cone);
  registerComponent(cone, 0.54, 0.1);

  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xb5e7a0, transparent: true, opacity: 0.85, roughness: 0.1 });
  const liquid = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.48, 32), liquidMat);
  liquid.position.y = 0.46;
  liquid.rotation.x = Math.PI;
  group.add(liquid);
  registerComponent(liquid, 0.46, 0.6);

  // Sea salt rim
  const saltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 32), saltMat);
  rim.position.y = 0.84;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  registerComponent(rim, 0.84, 1.1);
}

// ==========================================
// 8. FLAN NAPOLITANO / POSTRE 3D
// ==========================================
function buildFlanModel(group) {
  const flanMat = new THREE.MeshStandardMaterial({ color: 0xfceda4, roughness: 0.45 });
  const flan = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.86, 0.48, 32), flanMat);
  flan.position.y = -0.18;
  flan.castShadow = true;
  group.add(flan);
  registerComponent(flan, -0.18, -0.5);

  const caramelMat = new THREE.MeshPhysicalMaterial({
    color: 0x944005,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.95,
  });
  const caramelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 32), caramelMat);
  caramelTop.position.y = 0.07;
  caramelTop.castShadow = true;
  group.add(caramelTop);
  registerComponent(caramelTop, 0.07, 0.15);

  const creamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const cream = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 16), creamMat);
  cream.position.y = 0.22;
  cream.castShadow = true;
  group.add(cream);
  registerComponent(cream, 0.22, 0.65);

  const cherryMat = new THREE.MeshPhysicalMaterial({ color: 0xb30909, roughness: 0.12, clearcoat: 0.95 });
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), cherryMat);
  cherry.position.y = 0.42;
  cherry.castShadow = true;
  group.add(cherry);
  registerComponent(cherry, 0.42, 1.15);
}

// ==========================================
// 9. SALMÓN TERIYAKI 3D
// ==========================================
function buildSalmonModel(group) {
  const salmonTex = getSalmonTexture();

  const riceMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.85 });
  const rice = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.18, 32), riceMat);
  rice.position.y = -0.35;
  rice.castShadow = true;
  group.add(rice);
  registerComponent(rice, -0.35, -0.55);

  const salmonMat = new THREE.MeshPhysicalMaterial({
    map: salmonTex,
    roughness: 0.35,
    metalness: 0.06,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });
  const fillet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.6), salmonMat);
  fillet.position.y = -0.16;
  fillet.castShadow = true;
  group.add(fillet);
  registerComponent(fillet, -0.16, 0.05);

  const glazeMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d1705,
    roughness: 0.1,
    transparent: true,
    opacity: 0.75,
    clearcoat: 1.0,
  });
  const glaze = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 0.62), glazeMat);
  glaze.position.y = -0.04;
  group.add(glaze);
  registerComponent(glaze, -0.04, 0.5);

  const edamameGroup = new THREE.Group();
  const edamameMat = new THREE.MeshStandardMaterial({ color: 0x76b630, roughness: 0.45 });
  for (let e = 0; e < 7; e++) {
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), edamameMat);
    bean.scale.set(1.4, 1, 1);
    bean.position.set(0.65 + (Math.random() - 0.5) * 0.2, -0.22, (e - 3) * 0.14);
    bean.castShadow = true;
    edamameGroup.add(bean);
  }
  group.add(edamameGroup);
  registerComponent(edamameGroup, 0, 0.35, 0, 0.45);
}

// ==========================================
// 10. GUACAMOLE TRADICIONAL 3D
// ==========================================
function buildGuacamoleModel(group) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x272727, roughness: 0.95 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.65, 0.4, 24), stoneMat);
  bowl.position.y = -0.26;
  bowl.castShadow = true;
  group.add(bowl);
  registerComponent(bowl, -0.26, -0.6);

  const guacMat = new THREE.MeshStandardMaterial({ color: 0x6e992b, roughness: 0.8 });
  const guac = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 24), guacMat);
  guac.position.y = -0.12;
  guac.castShadow = true;
  group.add(guac);
  registerComponent(guac, -0.12, 0.1);

  const chipGroup = new THREE.Group();
  const chipMat = new THREE.MeshStandardMaterial({ color: 0xdfad52, roughness: 0.75, side: THREE.DoubleSide });
  for (let c = 0; c < 8; c++) {
    const angle = (c / 8) * Math.PI * 2;
    const chip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 3), chipMat);
    chip.position.set(Math.cos(angle) * 0.6, 0.06, Math.sin(angle) * 0.6);
    chip.rotation.set(0.4, angle, 0.3);
    chip.castShadow = true;
    chipGroup.add(chip);
  }
  group.add(chipGroup);
  registerComponent(chipGroup, 0, 0.75);
}

export function setExplodeCallback(cb) {
  onExplodeCallback = cb;
}

export function isExploded() {
  return targetExplode === 1;
}

/**
 * Toggle Exploded / Disassembled View
 */
export function toggleExplodedView() {
  if (targetExplode === 0) {
    targetExplode = 1;
    playExplodeSound();
    onExplodeCallback?.(true);
    return true;
  } else {
    targetExplode = 0;
    playAssembleSound();
    hideIngredientSpotlight();
    resetCamera(false);
    onExplodeCallback?.(false);
    return false;
  }
}

/**
 * Focus camera smoothly on a specific ingredient layer with close-up macro view
 */
export function focusOnIngredient(index, ingData = null) {
  if (targetExplode === 0) {
    targetExplode = 1;
    playExplodeSound();
    onExplodeCallback?.(true);
  }

  const comp = explodedComponents[index] || explodedComponents[explodedComponents.length - 1 - index];
  if (!comp || !comp.mesh || !camera || !controls) return;

  const targetWorldPos = new THREE.Vector3();
  comp.mesh.getWorldPosition(targetWorldPos);

  controls.autoRotate = false;

  const startCam = camera.position.clone();
  const startTarget = controls.target.clone();

  const desiredDistance = 1.35;
  const targetCam = new THREE.Vector3(
    targetWorldPos.x + 0.65,
    targetWorldPos.y + 0.38,
    targetWorldPos.z + desiredDistance
  );

  const startTime = performance.now();
  const duration = 750;

  if (focusAnimId) cancelAnimationFrame(focusAnimId);

  function animateFocus(now) {
    const elapsed = now - startTime;
    const p = Math.min(elapsed / duration, 1);
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    camera.position.lerpVectors(startCam, targetCam, ease);
    controls.target.lerpVectors(startTarget, targetWorldPos, ease);
    controls.update();

    if (p < 1) {
      focusAnimId = requestAnimationFrame(animateFocus);
    }
  }
  focusAnimId = requestAnimationFrame(animateFocus);

  // Show floating ingredient spotlight banner directly on the 3D canvas
  showIngredientSpotlight(ingData);

  const infoDesc = document.getElementById('viewer-item-desc');
  if (infoDesc && ingData) {
    infoDesc.innerHTML = `<span style="color:var(--color-primary-light);font-weight:700;">${ingData.icon || '✨'} ${ingData.name}:</span> ${ingData.desc || 'Ingrediente premium seleccionado para este platillo.'} <button id="btn-focus-reset" style="margin-left:8px;padding:3px 10px;border-radius:12px;background:rgba(245,158,11,0.2);font-size:0.75rem;font-weight:600;color:var(--color-primary-light);border:1px solid rgba(245,158,11,0.5);cursor:pointer;">↩️ Ver todo</button>`;
    document.getElementById('btn-focus-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetCamera();
    });
  }

  // Highlight lateral indicator
  document.querySelectorAll('.lateral-ing-chip').forEach((c, idx) => {
    c.classList.toggle('active', idx === index);
  });
  document.querySelectorAll('.viewer-ing-chip').forEach((c, idx) => {
    c.classList.toggle('active', idx === index);
  });
}

function showIngredientSpotlight(ing) {
  if (!containerElement || !ing) return;
  let spotlight = containerElement.querySelector('.viewer-ingredient-spotlight');
  if (!spotlight) {
    spotlight = document.createElement('div');
    spotlight.className = 'viewer-ingredient-spotlight';
    containerElement.appendChild(spotlight);
  }
  spotlight.innerHTML = `
    <span class="spotlight-icon">${ing.icon || '✨'}</span>
    <div class="spotlight-body">
      <div class="spotlight-name">${ing.name}</div>
      <div class="spotlight-desc">${ing.desc || 'Ingrediente fresco y seleccionado.'}</div>
    </div>
    <button type="button" class="spotlight-close" title="Cerrar">✕</button>
  `;
  spotlight.style.display = 'flex';
  spotlight.querySelector('.spotlight-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideIngredientSpotlight();
    resetCamera();
  });
}

export function hideIngredientSpotlight() {
  if (!containerElement) return;
  const spotlight = containerElement.querySelector('.viewer-ingredient-spotlight');
  if (spotlight) spotlight.style.display = 'none';
}

/**
 * Render horizontal thumb-friendly ingredients shelf bar under 3D canvas
 */
export function renderIngredientsShelf(item) {
  const bar = document.getElementById('viewer-ingredients-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const ingredients = item.ingredients || [];
  if (ingredients.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';

  ingredients.forEach((ing, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'viewer-ing-chip';
    chip.innerHTML = `
      <span class="ing-icon">${ing.icon || '✨'}</span>
      <span class="ing-name">${ing.name}</span>
    `;
    chip.title = `Toca para ver ${ing.name} de cerca en 3D`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      playClickSound();
      focusOnIngredient(i, ing);
    });
    bar.appendChild(chip);
  });
}

/**
 * Setup Clean Lateral Indicators Dock (docked to side, NO dots/pins on the food)
 */
function setupIngredientsHotspots(item) {
  if (!lateralIndicatorsContainer) return;
  lateralIndicatorsContainer.innerHTML = '';
  hotspots = [];

  const ingredients = item.ingredients || [];
  if (ingredients.length === 0) return;

  ingredients.slice(0, 5).forEach((ing, i) => {
    // Sleek lateral indicator chip (docked cleanly to the side)
    const lateralChip = document.createElement('button');
    lateralChip.type = 'button';
    lateralChip.className = 'lateral-ing-chip';
    lateralChip.innerHTML = `
      <span style="font-size: 0.95rem;">${ing.icon || '✨'}</span>
      <span>${ing.name}</span>
    `;

    lateralChip.addEventListener('click', (e) => {
      e.stopPropagation();
      playClickSound();
      focusOnIngredient(i, ing);
    });

    lateralIndicatorsContainer.appendChild(lateralChip);
    hotspots.push({ lateralChip, data: ing });
  });
}

function updateHotspotsProjection() {
  if (!hotspotsVisible || !lateralIndicatorsContainer) {
    if (lateralIndicatorsContainer) lateralIndicatorsContainer.style.display = 'none';
    return;
  }
  if (lateralIndicatorsContainer) lateralIndicatorsContainer.style.display = 'flex';
}

/**
 * Toggle between Real 3D Model and Photo View
 */
export async function toggleViewerMode() {
  if (currentMode === '3d' && currentImageData) {
    currentMode = 'photo';
    clearCurrentFood();
    await loadCurvedPhotoPlane(currentImageData);
    if (hotspotsOverlayElement) hotspotsOverlayElement.style.display = 'none';
    if (lateralIndicatorsContainer) lateralIndicatorsContainer.style.display = 'none';
    return 'photo';
  } else if (currentItemData) {
    currentMode = '3d';
    clearCurrentFood();
    const modelType = currentItemData.modelType || 'burger';
    currentFoodGroup = createProceduralFoodModel(modelType, currentItemData);
    scene.add(currentFoodGroup);
    animateEntrance(currentFoodGroup);
    setupIngredientsHotspots(currentItemData);
    if (hotspotsOverlayElement && hotspotsVisible) hotspotsOverlayElement.style.display = 'block';
    if (lateralIndicatorsContainer && hotspotsVisible) lateralIndicatorsContainer.style.display = 'flex';
    return '3d';
  }
  return currentMode;
}

export function toggleHotspots() {
  hotspotsVisible = !hotspotsVisible;
  if (hotspotsOverlayElement) {
    hotspotsOverlayElement.style.display = hotspotsVisible ? 'block' : 'none';
  }
  if (lateralIndicatorsContainer) {
    lateralIndicatorsContainer.style.display = hotspotsVisible ? 'flex' : 'none';
  }
  return hotspotsVisible;
}

function loadCurvedPhotoPlane(imageUrl) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const aspect = texture.image.width / texture.image.height;
        const width = 1.9;
        const height = width / aspect;

        const photoGroup = new THREE.Group();

        // 1. Ceramic / Porcelain Display Serving Platter Base
        const plateRadius = Math.max(width, height) * 0.62;
        const plateGeo = new THREE.CylinderGeometry(plateRadius, plateRadius * 0.94, 0.08, 48);
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0x18181b,
          roughness: 0.22,
          metalness: 0.08,
        });
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.y = -0.06;
        plateMesh.receiveShadow = true;
        plateMesh.castShadow = true;
        photoGroup.add(plateMesh);

        // Gold / Copper decorative rim trim
        const rimGeo = new THREE.TorusGeometry(plateRadius * 0.98, 0.015, 16, 48);
        const rimMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.3,
          metalness: 0.85,
        });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.y = -0.018;
        photoGroup.add(rimMesh);

        // 2. High-res Curved Food Relief with Parabolic Volumetric Falloff
        const geometry = new THREE.PlaneGeometry(width, height, 48, 48);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const distNorm = Math.sqrt((x / (width * 0.5)) ** 2 + (y / (height * 0.5)) ** 2);
          // Parabolic dome relief curve
          const dome = Math.max(0, 1 - distNorm * distNorm) * 0.18;
          positions.setZ(i, dome);
        }
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          roughness: 0.35,
          metalness: 0.04,
        });

        const foodMesh = new THREE.Mesh(geometry, material);
        foodMesh.position.y = 0.05;
        foodMesh.rotation.x = -Math.PI * 0.35;
        foodMesh.castShadow = true;
        foodMesh.receiveShadow = true;
        photoGroup.add(foodMesh);

        currentFoodGroup = photoGroup;
        scene.add(photoGroup);
        animateEntrance(photoGroup);
        resolve();
      },
      undefined,
      reject
    );
  });
}

function animateEntrance(mesh, duration = 800) {
  const start = performance.now();
  mesh.scale.set(0.01, 0.01, 0.01);

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const t = progress < 1
      ? 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 1.5)
      : 1;

    mesh.scale.set(t, t, t);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function animate() {
  if (!isActive) return;
  animationId = requestAnimationFrame(animate);

  const time = performance.now() * 0.001;

  // Gentle floating animation
  if (currentFoodGroup && targetExplode === 0) {
    currentFoodGroup.position.y = Math.sin(time * 1.2) * 0.02;
  }

  // Smooth Interpolation for Exploded / Disassembled Layers
  if (explodedComponents.length > 0 && Math.abs(explodeProgress - targetExplode) > 0.001) {
    explodeProgress += (targetExplode - explodeProgress) * 0.12;
    explodedComponents.forEach(comp => {
      comp.mesh.position.y = comp.origY + (comp.explodeY - comp.origY) * explodeProgress;
      if (comp.explodeX !== undefined && comp.origX !== undefined) {
        comp.mesh.position.x = comp.origX + (comp.explodeX - comp.origX) * explodeProgress;
      }
      if (comp.explodeZ !== undefined && comp.origZ !== undefined) {
        comp.mesh.position.z = comp.origZ + (comp.explodeZ - comp.origZ) * explodeProgress;
      }
    });
  }

  // Floating warm steam particles
  if (particleSystem) {
    const pos = particleSystem.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += 0.0035;
      if (pos[i + 1] > 2.4) {
        pos[i + 1] = 0.05;
        pos[i] = (Math.random() - 0.5) * 1.2;
        pos[i + 2] = (Math.random() - 0.5) * 1.2;
      }
      pos[i] += Math.sin(time * 2 + i) * 0.0008;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.rotation.y = time * 0.015;
  }

  // Smart auto-rotate: pause during user touch/drag and resume only after 3.5s of stillness
  if (controls) {
    if (isUserInteracting || (performance.now() - lastInteractionTime < 3500)) {
      controls.autoRotate = false;
    } else {
      controls.autoRotate = true;
    }
    controls.update();
  }

  renderer.render(scene, camera);
  updateHotspotsProjection();
}

export function toggleAutoRotate() {
  if (controls) {
    controls.autoRotate = !controls.autoRotate;
    return controls.autoRotate;
  }
  return false;
}

export function resetCamera(animate = true) {
  if (!camera || !controls) return;
  const defaultCam = new THREE.Vector3(0, 2.3, 3.7);
  const defaultTarget = new THREE.Vector3(0, 0, 0);

  if (focusAnimId) cancelAnimationFrame(focusAnimId);

  if (animate) {
    const startCam = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();
    const duration = 600;

    function animateReset(now) {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      camera.position.lerpVectors(startCam, defaultCam, ease);
      controls.target.lerpVectors(startTarget, defaultTarget, ease);
      controls.update();
      if (p < 1) {
        focusAnimId = requestAnimationFrame(animateReset);
      }
    }
    focusAnimId = requestAnimationFrame(animateReset);
  } else {
    camera.position.copy(defaultCam);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  if (currentItemData) {
    const infoDesc = document.getElementById('viewer-item-desc');
    if (infoDesc) infoDesc.textContent = currentItemData.description || '';
  }

  hideIngredientSpotlight();
  document.querySelectorAll('.lateral-ing-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.viewer-ing-chip').forEach(c => c.classList.remove('active'));
}

export function zoomIn() {
  if (camera && controls) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, 0.45);
    controls.update();
  }
}

export function zoomOut() {
  if (camera && controls) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, -0.45);
    controls.update();
  }
}

export function destroyViewer() {
  isActive = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  clearHotspots();
  clearCurrentFood();

  if (renderer) {
    renderer.dispose();
    renderer.domElement?.remove();
    renderer = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    scene = null;
  }
}

export function setViewerTheme(theme = 'dark') {
  if (!scene) return;
  if (theme === 'light') {
    scene.background = new THREE.Color(0xf2efe9);
    scene.fog = new THREE.FogExp2(0xf2efe9, 0.05);
  } else {
    scene.background = new THREE.Color(0x0a0908);
    scene.fog = new THREE.FogExp2(0x0a0908, 0.06);
  }
}

export function getCurrentItem() {
  return currentItemData;
}

// ==========================================
// REAL WEB AR CAMERA PASSTHROUGH & TABLE VIEW
// ==========================================
let arScene = null;
let arCamera = null;
let arRenderer = null;
let arControls = null;
let arAnimId = null;
let arStream = null;
let arFoodGroup = null;

export async function openARView(item, videoElement, canvasContainer) {
  closeARView();

  let cameraActive = false;

  // Request back camera with fallback
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      arStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraActive = true;
    } catch (e1) {
      console.warn('Fallo intento camara trasera, intentando camara por defecto:', e1);
      try {
        arStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        cameraActive = true;
      } catch (e2) {
        console.warn('Acceso a camara no disponible:', e2);
      }
    }
  }

  // Set video properties for mobile autoplay
  if (videoElement) {
    if (cameraActive && arStream) {
      videoElement.srcObject = arStream;
      videoElement.setAttribute('autoplay', '');
      videoElement.setAttribute('muted', '');
      videoElement.setAttribute('playsinline', '');
      videoElement.setAttribute('webkit-playsinline', '');
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.style.display = 'block';
      videoElement.play().catch(e => console.warn('Video play error:', e));

      // Remove simulator background if present
      const modal = document.getElementById('ar-modal');
      if (modal) {
        modal.classList.remove('ar-simulated-table');
        modal.style.background = '#000';
      }
    } else {
      // Camera is unavailable or denied or unencrypted HTTP:
      // DO NOT show pitch black screen! Activate realistic restaurant dining table simulator!
      videoElement.style.display = 'none';
      const modal = document.getElementById('ar-modal');
      if (modal) {
        modal.classList.add('ar-simulated-table');
      }
    }
  }

  const width = canvasContainer.clientWidth || window.innerWidth;
  const height = canvasContainer.clientHeight || window.innerHeight;

  arScene = new THREE.Scene();
  arScene.background = null; // 100% transparent so camera or table texture shows through!

  arCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  arCamera.position.set(0, 1.9, 3.1);

  arRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  arRenderer.setSize(width, height);
  arRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  arRenderer.setClearColor(0x000000, 0); // Transparent clear color
  arRenderer.shadowMap.enabled = true;
  arRenderer.domElement.style.touchAction = 'none';
  canvasContainer.innerHTML = '';
  canvasContainer.appendChild(arRenderer.domElement);

  // Setup AR Lighting matching real room/table lighting
  const ambient = new THREE.AmbientLight(0xffeedd, 1.4);
  arScene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff6eb, 2.2);
  sun.position.set(2.5, 6, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.bias = -0.001;
  arScene.add(sun);

  // Soft table shadow receiver
  const shadowPlaneGeo = new THREE.PlaneGeometry(4, 4);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.38 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.48;
  shadowPlane.receiveShadow = true;
  arScene.add(shadowPlane);

  // AR Table Surface Placement Grid (subtle guidance ring)
  const ringGeo = new THREE.RingGeometry(1.2, 1.25, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.47;
  arScene.add(ring);

  // Food Model in AR
  const modelType = item.modelType || 'burger';
  arFoodGroup = createProceduralFoodModel(modelType, item);
  arFoodGroup.position.set(0, -0.15, 0);
  arFoodGroup.scale.set(0.95, 0.95, 0.95);
  arScene.add(arFoodGroup);

  // AR Controls: enable pan and smooth rotation so user can place dish on table
  arControls = new OrbitControls(arCamera, arRenderer.domElement);
  arControls.enableDamping = true;
  arControls.dampingFactor = 0.08;
  arControls.autoRotate = false; // Never auto-rotate in AR mode so user can inspect steadily
  arControls.minDistance = 1.0;
  arControls.maxDistance = 5.5;

  function renderAR() {
    arAnimId = requestAnimationFrame(renderAR);
    arControls.update();
    arRenderer.render(arScene, arCamera);
  }
  renderAR();

  return { cameraActive };
}

export function setARScale(scaleFactor) {
  if (arFoodGroup) {
    arFoodGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }
}

export function closeARView() {
  if (arAnimId) {
    cancelAnimationFrame(arAnimId);
    arAnimId = null;
  }
  if (arStream) {
    arStream.getTracks().forEach(t => t.stop());
    arStream = null;
  }
  if (arRenderer) {
    arRenderer.dispose();
    arRenderer.domElement?.remove();
    arRenderer = null;
  }
  if (arControls) {
    arControls.dispose();
    arControls = null;
  }
  if (arScene) {
    arScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    arScene = null;
    arFoodGroup = null;
  }

  const modal = document.getElementById('ar-modal');
  if (modal) {
    modal.classList.remove('ar-simulated-table');
  }
}

export function captureARScreenshot(videoElement) {
  if (!arRenderer) return;

  const width = arRenderer.domElement.width;
  const height = arRenderer.domElement.height;

  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = width;
  snapCanvas.height = height;
  const ctx = snapCanvas.getContext('2d');

  if (videoElement && videoElement.videoWidth > 0 && videoElement.style.display !== 'none') {
    ctx.drawImage(videoElement, 0, 0, width, height);
  } else {
    // Fill with warm table background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#231811');
    grad.addColorStop(0.5, '#3d281a');
    grad.addColorStop(1, '#1b120c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(arRenderer.domElement, 0, 0, width, height);

  // Watermark
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('🍽️ Menú 3D - Realidad Aumentada', 24, height - 30);

  const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.92);
  const link = document.createElement('a');
  link.download = `menu3d-ar-foto-${Date.now()}.jpg`;
  link.href = dataUrl;
  link.click();
}
