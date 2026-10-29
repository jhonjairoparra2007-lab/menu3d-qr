import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

function apiSyncPlugin() {
  const dataDir = resolve(__dirname, 'data');
  const menuFile = resolve(dataDir, 'menu.json');
  const imagesFile = resolve(dataDir, 'images.json');
  const ordersFile = resolve(dataDir, 'orders.json');
  const configFile = resolve(dataDir, 'config.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function readJson(file, fallback = '[]') {
    try {
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf-8');
      }
    } catch (e) {
      console.error('Error reading JSON:', file, e);
    }
    return fallback;
  }

  function writeJson(file, data) {
    try {
      fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing JSON:', file, e);
    }
  }

  return {
    name: 'api-sync-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost:3000');
        const pathname = urlObj.pathname;

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
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

        next();
      });
    }
  };
}

export default defineConfig({
  root: '.',
  plugins: [apiSyncPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'menu.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
});
