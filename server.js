/**
 * server.js - Production Node.js Cloud Server
 * Serves the compiled Menu3D app and provides full REST API persistence
 * Zero-dependency: runs on native Node.js (v18+)
 * Compatible with: Render, Railway, Vercel, Fly.io, Heroku, Docker, VPS
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const dataDir = path.resolve(__dirname, 'data');
const distDir = path.resolve(__dirname, 'dist');
const menuFile = path.resolve(dataDir, 'menu.json');
const imagesFile = path.resolve(dataDir, 'images.json');
const ordersFile = path.resolve(dataDir, 'orders.json');
const configFile = path.resolve(dataDir, 'config.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJson(file, fallback = '[]') {
  try {
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf-8');
    }
  } catch (e) {
    console.error('Error reading JSON file:', file, e);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing JSON file:', file, e);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health check for cloud monitors
  if (pathname === '/health' || pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));
    return;
  }

  // 1. /api/menu
  if (pathname === '/api/menu') {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(readJson(menuFile, '[]'));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        writeJson(menuFile, body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }
  }

  // 2. /api/images
  if (pathname === '/api/images') {
    if (req.method === 'GET') {
      const id = urlObj.searchParams.get('id');
      const allImages = JSON.parse(readJson(imagesFile, '{}'));
      res.setHeader('Content-Type', 'application/json');
      if (id) {
        res.end(JSON.stringify({ id, data: allImages[id] || null }));
      } else {
        res.end(JSON.stringify(allImages));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const allImages = JSON.parse(readJson(imagesFile, '{}'));
          if (payload.id && payload.data) {
            allImages[payload.id] = payload.data;
            writeJson(imagesFile, allImages);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // 3. /api/config
  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(readJson(configFile, 'null'));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        writeJson(configFile, body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }
  }

  // 4. /api/orders
  if (pathname === '/api/orders') {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(readJson(ordersFile, '[]'));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newOrder = JSON.parse(body);
          const orders = JSON.parse(readJson(ordersFile, '[]'));
          orders.unshift(newOrder);
          writeJson(ordersFile, orders);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, order: newOrder }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // Static File Serving
  let targetPath = path.normalize(pathname);
  if (targetPath === '/' || targetPath === '') {
    targetPath = '/index.html';
  }

  // Check dist/ first, then root fallback
  let filePath = path.join(distDir, targetPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, targetPath);
  }

  // If still not found, check if it's an html page without extension
  if (!fs.existsSync(filePath)) {
    const htmlTry = filePath + '.html';
    if (fs.existsSync(htmlTry)) {
      filePath = htmlTry;
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);

    // Cache static assets
    if (ext !== '.html') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } else {
    // 404 fallback to index.html for SPA
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(fallback).pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MENU 3D QR — Servidor en la Nube Activo`);
  console.log(`🌐 Puerto: ${PORT} | Host: ${HOST}`);
  console.log(`📱 Acceso Local: http://localhost:${PORT}`);
  console.log(`📡 Para escanear QR desde cualquier red:`);
  console.log(`   Usa la URL pública asignada por tu proveedor en la nube`);
  console.log(`======================================================\n`);
});

