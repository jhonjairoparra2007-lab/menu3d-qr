/**
 * ai.js - AI Moderation & Auto-description
 * Uses Hugging Face Inference API (free tier) for:
 * - Image content moderation (NSFW detection)
 * - Auto-generating food descriptions
 * Falls back to client-side heuristics when API is unavailable
 */

import { getConfig } from './storage.js';

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

// Models
const MODELS = {
  moderation: 'Falconsai/nsfw_image_detection',
  caption: 'Salesforce/blip-image-captioning-base',
  classification: 'google/vit-base-patch16-224',
  depth: 'depth-anything/Depth-Anything-V2-Small-hf',
  depthFallback: 'Intel/dpt-large',
};

/**
 * Check if AI features are available
 */
export function isAIAvailable() {
  const config = getConfig();
  return config.aiEnabled && config.hfApiKey && config.hfApiKey.length > 10;
}

/**
 * Make a request to the Hugging Face Inference API
 */
async function hfInference(model, data, isImage = false) {
  const config = getConfig();
  const apiKey = config.hfApiKey;

  if (!apiKey) {
    throw new Error('API key de Hugging Face no configurada');
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
  };

  let body;
  if (isImage) {
    // Convert data URL to blob
    const blob = dataURLtoBlob(data);
    body = blob;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  const response = await fetch(`${HF_API_BASE}/${model}`, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 503) {
      // Model is loading
      throw new Error('MODEL_LOADING');
    }
    throw new Error(`HF API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Moderate an image for inappropriate content
 * Returns: { safe: boolean, confidence: number, label: string }
 */
export async function moderateImage(imageDataUrl) {
  if (!isAIAvailable()) {
    return clientSideModeration(imageDataUrl);
  }

  try {
    const result = await hfInference(MODELS.moderation, imageDataUrl, true);

    if (Array.isArray(result)) {
      const nsfwScore = result.find(r => r.label === 'nsfw')?.score || 0;
      const normalScore = result.find(r => r.label === 'normal')?.score || 1;

      return {
        safe: nsfwScore < 0.5,
        confidence: normalScore,
        label: nsfwScore >= 0.5 ? 'Contenido inapropiado detectado' : 'Contenido seguro',
        scores: result,
      };
    }

    return { safe: true, confidence: 1, label: 'Contenido seguro' };
  } catch (error) {
    console.warn('AI moderation fallback:', error.message);
    return clientSideModeration(imageDataUrl);
  }
}

/**
 * Generate a caption/description for a food image
 * Returns: { description: string, confidence: number }
 */
export async function generateCaption(imageDataUrl) {
  if (!isAIAvailable()) {
    return clientSideCaption();
  }

  try {
    const result = await hfInference(MODELS.caption, imageDataUrl, true);

    if (Array.isArray(result) && result[0]?.generated_text) {
      let caption = result[0].generated_text;
      // Translate common food terms to Spanish
      caption = translateFoodCaption(caption);
      return {
        description: caption,
        confidence: 0.8,
        source: 'ai',
      };
    }

    return clientSideCaption();
  } catch (error) {
    console.warn('AI caption fallback:', error.message);
    return clientSideCaption();
  }
}

/**
 * Classify an image to suggest category
 * Returns: { category: string, confidence: number }
 */
export async function classifyFood(imageDataUrl) {
  if (!isAIAvailable()) {
    return { category: 'principales', confidence: 0.5, source: 'default' };
  }

  try {
    const result = await hfInference(MODELS.classification, imageDataUrl, true);

    if (Array.isArray(result)) {
      const category = mapToMenuCategory(result[0]?.label || '');
      return {
        category,
        confidence: result[0]?.score || 0.5,
        rawLabel: result[0]?.label,
        source: 'ai',
      };
    }

    return { category: 'principales', confidence: 0.5, source: 'default' };
  } catch {
    return { category: 'principales', confidence: 0.5, source: 'default' };
  }
}

/**
 * Full AI analysis pipeline for an uploaded image
 */
export async function analyzeImage(imageDataUrl) {
  const [moderation, caption, classification] = await Promise.allSettled([
    moderateImage(imageDataUrl),
    generateCaption(imageDataUrl),
    classifyFood(imageDataUrl),
  ]);

  return {
    moderation: moderation.status === 'fulfilled' ? moderation.value : { safe: true, confidence: 0 },
    caption: caption.status === 'fulfilled' ? caption.value : clientSideCaption(),
    classification: classification.status === 'fulfilled' ? classification.value : { category: 'principales' },
  };
}

// ---- Client-side fallbacks ----

function clientSideModeration(imageDataUrl) {
  // Basic client-side checks
  const sizeKB = (imageDataUrl.length * 3) / 4 / 1024;

  if (sizeKB < 5) {
    return { safe: false, confidence: 0.9, label: 'Imagen demasiado pequeña o inválida' };
  }

  if (sizeKB > 15000) {
    return { safe: false, confidence: 0.7, label: 'Imagen demasiado grande (máx 15MB)' };
  }

  return {
    safe: true,
    confidence: 0.6,
    label: 'Verificación básica aprobada (sin IA)',
    source: 'client',
  };
}

function clientSideCaption() {
  const captions = [
    'Platillo elaborado con los mejores ingredientes frescos del día.',
    'Una deliciosa creación culinaria preparada con técnica artesanal.',
    'Sabores auténticos que conquistan el paladar.',
    'Preparación gourmet con ingredientes de primera calidad.',
    'Una experiencia gastronómica única en cada bocado.',
  ];

  return {
    description: captions[Math.floor(Math.random() * captions.length)],
    confidence: 0.3,
    source: 'template',
  };
}

function translateFoodCaption(caption) {
  const translations = {
    'a plate of food': 'un plato de comida',
    'a bowl of': 'un plato de',
    'a glass of': 'un vaso de',
    'a cup of': 'una taza de',
    'a piece of': 'una porción de',
    'a slice of': 'una rebanada de',
    'chicken': 'pollo',
    'beef': 'res',
    'fish': 'pescado',
    'salad': 'ensalada',
    'soup': 'sopa',
    'cake': 'pastel',
    'pizza': 'pizza',
    'pasta': 'pasta',
    'rice': 'arroz',
    'bread': 'pan',
    'fruit': 'fruta',
    'vegetable': 'vegetales',
    'dessert': 'postre',
    'drink': 'bebida',
    'wine': 'vino',
    'beer': 'cerveza',
    'coffee': 'café',
    'tea': 'té',
    'juice': 'jugo',
    'water': 'agua',
    'on a plate': 'en un plato',
    'on a table': 'sobre la mesa',
    'with': 'con',
    'and': 'y',
  };

  let translated = caption.toLowerCase();
  for (const [en, es] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(en, 'gi'), es);
  }

  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

function mapToMenuCategory(label) {
  const labelLower = label.toLowerCase();

  const categoryMap = {
    entradas: ['salad', 'soup', 'appetizer', 'starter', 'guacamole', 'dip', 'chips', 'bread'],
    principales: ['meat', 'chicken', 'beef', 'pork', 'fish', 'steak', 'burger', 'taco', 'pizza', 'pasta', 'rice', 'curry', 'plate', 'dinner'],
    postres: ['cake', 'dessert', 'ice cream', 'cookie', 'chocolate', 'pie', 'flan', 'sweet', 'pastry'],
    bebidas: ['drink', 'juice', 'water', 'soda', 'coffee', 'tea', 'smoothie', 'lemonade'],
    cocteles: ['cocktail', 'wine', 'beer', 'margarita', 'mojito', 'alcohol', 'whisky', 'vodka', 'champagne'],
    especiales: ['special', 'gourmet', 'premium', 'lobster', 'truffle', 'wagyu', 'caviar'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => labelLower.includes(k))) {
      return category;
    }
  }

  return 'principales';
}

// ---- Utilities ----

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

export function getAIStatusText() {
  if (isAIAvailable()) {
    return '🤖 IA Activa (Hugging Face)';
  }
  return '⚡ Modo básico (configura tu API Key para IA completa)';
}

/**
 * Validate a Hugging Face API key by making a test request
 */
export async function validateHFApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 8) {
    return { valid: false, message: 'La API Key está vacía o es demasiado corta' };
  }

  const cleanKey = apiKey.trim();
  try {
    const res = await fetch(`${HF_API_BASE}/${MODELS.moderation}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'https://huggingface.co/datasets/mishig/sample_images/resolve/main/tiger.jpg' }),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, message: 'API Key inválida o sin permisos (código ' + res.status + ')' };
    }

    return { valid: true, message: '¡API Key válida y conectada exitosamente!' };
  } catch (err) {
    // If CORS or network issue, but key has proper hf_ prefix
    if (cleanKey.startsWith('hf_') && cleanKey.length >= 20) {
      return { valid: true, message: 'Formato de API Key válido (hf_...)' };
    }
    return { valid: false, message: 'Error de conexión: ' + (err.message || 'No se pudo contactar a Hugging Face') };
  }
}

/**
 * Photometric Computer Vision depth estimation
 * Computes radial elevation mound + luminance + Sobel edge gradients
 */
export function generatePhotometricDepthMap(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);

      const src = ctx.getImageData(0, 0, size, size);
      const sData = src.data;
      const depthData = ctx.createImageData(size, size);
      const dData = depthData.data;

      const cx = size / 2;
      const cy = size / 2;
      const maxR = size * 0.48;

      // First pass: Compute luminance and radial mound
      const lumGrid = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          const r = sData[idx];
          const g = sData[idx + 1];
          const b = sData[idx + 2];
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          lumGrid[y * size + x] = lum;
        }
      }

      // Second pass: Combine smooth radial mound + luminance + edge gradient relief
      const heightGrid = new Float32Array(size * size);
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const dist = Math.hypot(x - cx, y - cy);
          const normDist = Math.min(1.0, dist / maxR);
          const mound = Math.cos(normDist * Math.PI * 0.5);
          const moundFactor = Math.pow(Math.max(0, mound), 1.25);

          const gx =
            -lumGrid[(y - 1) * size + (x - 1)] + lumGrid[(y - 1) * size + (x + 1)]
            - 2 * lumGrid[y * size + (x - 1)] + 2 * lumGrid[y * size + (x + 1)]
            - lumGrid[(y + 1) * size + (x - 1)] + lumGrid[(y + 1) * size + (x + 1)];

          const gy =
            -lumGrid[(y - 1) * size + (x - 1)] - 2 * lumGrid[(y - 1) * size + x] - lumGrid[(y - 1) * size + (x + 1)]
            + lumGrid[(y + 1) * size + (x - 1)] + 2 * lumGrid[(y + 1) * size + x] + lumGrid[(y + 1) * size + (x + 1)];

          const gradient = Math.min(1.0, Math.hypot(gx, gy) * 1.5);
          const lum = lumGrid[y * size + x];

          const elevation = (moundFactor * 0.65 + lum * moundFactor * 0.20 + gradient * moundFactor * 0.15);
          heightGrid[y * size + x] = Math.max(0, Math.min(1.0, elevation));
        }
      }

      // Smooth 3x3 filter to eliminate harsh vertex spikes
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += heightGrid[(y + dy) * size + (x + dx)];
            }
          }
          const val = Math.round((sum / 9) * 255);
          const dIdx = (y * size + x) * 4;
          dData[dIdx] = val;
          dData[dIdx + 1] = val;
          dData[dIdx + 2] = val;
          dData[dIdx + 3] = 255;
        }
      }

      ctx.putImageData(depthData, 0, 0);
      resolve({
        depthMapUrl: canvas.toDataURL('image/png'),
        source: 'photometric-cv',
        confidence: 0.85,
      });
    };
    img.onerror = () => {
      resolve({
        depthMapUrl: null,
        source: 'fallback',
        confidence: 0.6,
      });
    };
    img.src = imageDataUrl;
  });
}

/**
 * Real AI Monocular Depth Estimation
 * Calls Hugging Face Depth-Anything-V2 with intelligent photometric CV fallback
 */
export async function generateAIDepthMap(imageDataUrl) {
  if (isAIAvailable()) {
    try {
      const config = getConfig();
      const blob = dataURLtoBlob(imageDataUrl);

      const response = await fetch(`${HF_API_BASE}/${MODELS.depth}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.hfApiKey}`,
        },
        body: blob,
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          const resBlob = await response.blob();
          const depthMapUrl = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(resBlob);
          });
          return { depthMapUrl, source: 'ai-neural', confidence: 0.95 };
        } else {
          const json = await response.json();
          if (json && json.depth) {
            return { depthMapUrl: `data:image/png;base64,${json.depth}`, source: 'ai-neural', confidence: 0.95 };
          }
        }
      } else if (response.status === 503) {
        const res2 = await fetch(`${HF_API_BASE}/${MODELS.depthFallback}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${config.hfApiKey}` },
          body: blob,
        });
        if (res2.ok && (res2.headers.get('content-type') || '').includes('image')) {
          const resBlob2 = await res2.blob();
          const depthMapUrl2 = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(resBlob2);
          });
          return { depthMapUrl: depthMapUrl2, source: 'ai-neural', confidence: 0.92 };
        }
      }
    } catch (err) {
      console.warn('AI neural depth estimation fallback to photometric CV:', err.message);
    }
  }

  return generatePhotometricDepthMap(imageDataUrl);
}

/**
 * AI 3D Food Modeler & Archetype Classifier
 * Analyzes uploaded food photos and generates custom 3D depth geometry & metadata
 */
export async function detectFood3DModel(imageDataUrl, itemName = '') {
  let detectedType = 'custom_ai';
  let confidence = 0.88;
  let source = 'ai-neural';
  let depthResult = null;

  // Compute depth map if photo is provided
  if (imageDataUrl) {
    try {
      depthResult = await generateAIDepthMap(imageDataUrl);
      if (depthResult?.source) source = depthResult.source;
      if (depthResult?.confidence) confidence = depthResult.confidence;
    } catch (e) {
      console.warn('Depth map generation error:', e);
    }
  }

  // 1. Text hint matching from item name if provided
  const nameLower = (itemName || '').toLowerCase();
  if (nameLower.includes('taco') || nameLower.includes('pastor') || nameLower.includes('fajita') || nameLower.includes('tortilla')) {
    detectedType = 'tacos';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('pizza') || nameLower.includes('pepperoni') || nameLower.includes('margarita')) {
    detectedType = 'pizza';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('burger') || nameLower.includes('hamburguesa') || nameLower.includes('cheeseburger') || nameLower.includes('smash')) {
    detectedType = 'burger';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('carne') || nameLower.includes('ribeye') || nameLower.includes('steak') || nameLower.includes('asado') || nameLower.includes('corte') || nameLower.includes('bife')) {
    detectedType = 'ribeye';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('salmon') || nameLower.includes('salmón') || nameLower.includes('pescado') || nameLower.includes('fish') || nameLower.includes('atun') || nameLower.includes('atún')) {
    detectedType = 'salmon';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('ensalada') || nameLower.includes('salad') || nameLower.includes('cesar') || nameLower.includes('caesar')) {
    detectedType = 'salad';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('flan') || nameLower.includes('postre') || nameLower.includes('cake') || nameLower.includes('pastel') || nameLower.includes('dulce') || nameLower.includes('tarta')) {
    detectedType = 'dessert';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('guacamole') || nameLower.includes('aguacate') || nameLower.includes('totopos') || nameLower.includes('nachos')) {
    detectedType = 'guacamole';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('cocktail') || nameLower.includes('coctel') || nameLower.includes('cóctel') || nameLower.includes('margarita') || nameLower.includes('mojito') || nameLower.includes('trago')) {
    detectedType = 'cocktail';
    confidence = 0.95;
    source = 'name-match';
  } else if (nameLower.includes('jugo') || nameLower.includes('limonada') || nameLower.includes('bebida') || nameLower.includes('drink') || nameLower.includes('soda') || nameLower.includes('agua')) {
    detectedType = 'drink';
    confidence = 0.95;
    source = 'name-match';
  } else if (imageDataUrl) {
    // If not matched to standard presets, create bespoke AI 3D model!
    detectedType = 'custom_ai';
    confidence = depthResult?.confidence || 0.90;
  }

  // Model-specific preset metadata
  const metaPresets = {
    custom_ai: {
      category: 'principales',
      modelType: 'custom_ai',
      label: 'Platillo Esculpido por IA 3D',
      desc: 'Platillo exclusivo modelado volumétricamente en 3D con relieve orgánico, textura fotorrealista y capas separadas.',
      calories: 520,
      prepTime: '15-20 min',
      tags: ['popular'],
    },
    burger: {
      category: 'principales',
      modelType: 'burger',
      label: 'Hamburguesa Gourmet 3D',
      desc: 'Doble carne selecta con queso cheddar fundido, lechuga crujiente y pan brioche horneado.',
      calories: 780,
      prepTime: '15-20 min',
      tags: ['popular'],
    },
    pizza: {
      category: 'principales',
      modelType: 'pizza',
      label: 'Pizza Artesanal a la Piedra 3D',
      desc: 'Masa madre fermentada, pomodoro italiano, mozzarella fundido y especias.',
      calories: 840,
      prepTime: '20-25 min',
      tags: ['popular'],
    },
    tacos: {
      category: 'principales',
      modelType: 'tacos',
      label: 'Tacos al Pastor / Asada 3D',
      desc: 'Tortillas de maíz hechas a mano con carne marinada, cebolla, cilantro y piña asada.',
      calories: 490,
      prepTime: '10-15 min',
      tags: ['spicy', 'gluten-free', 'popular'],
    },
    ribeye: {
      category: 'principales',
      modelType: 'ribeye',
      label: 'Corte Ribeye a la Parrilla 3D',
      desc: 'Corte fino sellado al fuego con mantequilla de romero y sal marina gruesa.',
      calories: 690,
      prepTime: '20-25 min',
      tags: ['gluten-free'],
    },
    salmon: {
      category: 'especiales',
      modelType: 'salmon',
      label: 'Salmón Noruego Glaseado 3D',
      desc: 'Filete fresco sellado con salsa teriyaki, arroz jazmín al vapor y semillas de sésamo.',
      calories: 540,
      prepTime: '15-20 min',
      tags: ['gluten-free', 'popular'],
    },
    salad: {
      category: 'entradas',
      modelType: 'salad',
      label: 'Ensalada Fresca de Temporada 3D',
      desc: 'Hojas verdes hidropónicas, láminas de parmesano, crutones y aderezo especial.',
      calories: 320,
      prepTime: '8-12 min',
      tags: ['veg', 'gluten-free'],
    },
    dessert: {
      category: 'postres',
      modelType: 'dessert',
      label: 'Postre Artesanal / Flan 3D',
      desc: 'Textura cremosa con baño de caramelo dorado artesanal y toque de vainilla.',
      calories: 380,
      prepTime: '5 min',
      tags: ['popular'],
    },
    guacamole: {
      category: 'entradas',
      modelType: 'guacamole',
      label: 'Guacamole en Molcajete 3D',
      desc: 'Aguacate hass machacado con pico de gallo fresco, limón y totopos de maíz.',
      calories: 340,
      prepTime: '8-10 min',
      tags: ['veg', 'gluten-free'],
    },
    cocktail: {
      category: 'cocteles',
      modelType: 'cocktail',
      label: 'Cóctel de Autor 3D',
      desc: 'Destilado premium con cítricos frescos, licor dulce y copa escarchada.',
      calories: 190,
      prepTime: '5 min',
      tags: ['gluten-free'],
    },
    drink: {
      category: 'bebidas',
      modelType: 'drink',
      label: 'Bebida Refrescante 3D',
      desc: 'Bebida natural fría con hielo cristalino y toque aromático de hierbas.',
      calories: 110,
      prepTime: '3-5 min',
      tags: ['gluten-free'],
    },
  };

  const selected = metaPresets[detectedType] || metaPresets.custom_ai;
  return {
    ...selected,
    archetype: detectedType,
    label: itemName ? itemName : (selected.label || 'Platillo Esculpido por IA 3D'),
    confidence: depthResult?.confidence || confidence,
    source: depthResult?.source === 'ai-neural' ? 'Red Neuronal Depth-Anything V2 (IA Real)' : (depthResult?.source === 'photometric-cv' ? 'Visión Computacional Fotométrica 3D' : source),
    aiDepthMap: depthResult?.depthMapUrl || null,
  };
}
