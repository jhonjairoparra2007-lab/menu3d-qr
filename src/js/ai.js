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
