import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './server/config/index.ts';
import { createCoreApp } from './server/app.ts';
import { initDb } from './server/db/connection.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production' || path.basename(__dirname) === 'dist';
  if (isProduction) {
    // Validar JWT_SECRET, MONGODB_URI y Mercado Pago: detiene el arranque en producción si faltan o son incompatibles
    config.jwtSecret;
    config.mongodbUri;
    config.validatePaymentConfig();
  }

  const app = express();
  const coreApp = createCoreApp();

  // Mount API at /api
  app.use('/api', coreApp);

  // Health check directo accesible en /health con 200 OK (sin redirección para Cloud Run / balanceador)
  app.get('/health', (req, res, next) => {
    (coreApp as any).handle(req, res, next);
  });

  if (isProduction) {
    const distPath = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/restaurant-panel*', (req, res) => {
      res.sendFile(path.join(distPath, 'restaurant-panel', 'index.html'));
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Redirect /restaurant-panel without trailing slash to /restaurant-panel/
    app.get(/^\/restaurant-panel$/, (req, res) => {
      res.redirect(301, '/restaurant-panel/');
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = config.port || 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[Directaurante Core V2] Servidor activo en http://0.0.0.0:${port}`);
    console.log(`[Directaurante Core V2] API Base: http://0.0.0.0:${port}/api`);
    console.log(`[Directaurante Core V2] Health Check: http://0.0.0.0:${port}/api/health`);
  });

  try {
    await initDb();
  } catch (dbErr: any) {
    console.error('[Directaurante Core V2] Error al conectar base de datos:', dbErr.message);
    // En Cloud Run, no terminamos el proceso HTTP: el servidor se mantiene escuchando en el puerto 3000
    // y /health reportará el estado degraded/reintento sin reiniciar en bucle el contenedor.
  }
}

startServer().catch((err) => {
  console.error('[Directaurante Core V2] Error fatal al iniciar servidor:', err);
  process.exit(1);
});
