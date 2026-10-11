import express from 'express';
import cors from 'cors';
import { config } from './config/index.ts';
import authRoutes from './routes/authRoutes.ts';
import restaurantRoutes from './routes/restaurantRoutes.ts';
import customerRoutes from './routes/customerRoutes.ts';
import orderRoutes from './routes/orderRoutes.ts';
import restaurantPortalRoutes from './routes/restaurantPortalRoutes.ts';
import driverRoutes from './routes/driverRoutes.ts';
import realtimeRoutes from './routes/realtimeRoutes.ts';
import masterRoutes from './routes/masterRoutes.ts';
import paymentRoutes from './routes/paymentRoutes.ts';
import { CatalogService } from './services/restaurantService.ts';
import { dbClient } from './db/connection.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export function getCorsOptions(overrideOrigin?: string): cors.CorsOptions {
  return {
    origin: (origin, callback) => {
      // Non-browser / same-origin requests (origin undefined) are permitted
      if (!origin) {
        return callback(null, true);
      }

      const isProd = process.env.NODE_ENV === 'production';
      const activeCorsOrigin = overrideOrigin !== undefined ? overrideOrigin : config.corsOrigin;

      // En desarrollo / staging no productivo, se puede permitir comodín si se configuró
      if (!isProd && activeCorsOrigin === '*') {
        return callback(null, true);
      }

      const allowedOrigins = (activeCorsOrigin || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      // Subdominios oficiales de producción Directaurante
      const defaultProductionOrigins = [
        'https://cliente.directaurante.com',
        'http://cliente.directaurante.com',
        'https://repartidores.directaurante.com',
        'http://repartidores.directaurante.com',
        'https://restaurantes.directaurante.com',
        'http://restaurantes.directaurante.com',
        'https://master.directaurante.com',
        'http://master.directaurante.com',
        'https://api.directaurante.com',
        'http://api.directaurante.com',
        'https://directaurante.com',
        'http://directaurante.com',
      ];
      for (const prodOrigin of defaultProductionOrigins) {
        if (!allowedOrigins.includes(prodOrigin)) {
          allowedOrigins.push(prodOrigin);
        }
      }

      if (config.appUrl) {
        const cleanApp = config.appUrl.replace(/\/+$/, '');
        if (cleanApp && !allowedOrigins.includes(cleanApp)) {
          allowedOrigins.push(cleanApp);
        }
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En entornos de desarrollo o pruebas, permitir localhost y dominios de previsualización
      if (!isProd) {
        try {
          const parsed = new URL(origin);
          if (
            parsed.hostname.endsWith('.run.app') ||
            parsed.hostname.endsWith('.google.com') ||
            parsed.hostname === 'ai.studio' ||
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1'
          ) {
            return callback(null, true);
          }
        } catch {
          // Continue to error if URL is unparseable
        }
      }

      return callback(new Error(`CORS policy: Origen '${origin}' no permitido por Directaurante Core V2`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
  };
}

export function createCoreApp() {
  const app = express();

  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check: Minimizado para evitar exponer topología interna o rutas de base de datos
  app.get('/health', (req, res) => {
    const isConnected = dbClient.isConnected();
    const isProd = config.nodeEnv === 'production';

    res.json({
      status: isConnected ? 'ok' : 'degraded',
      service: 'Directaurante Core V2',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      ...(isProd
        ? { database: { connected: isConnected } }
        : { database: dbClient.getDbInfo() }),
    });
  });

  // Reconnection check: Restringido en producción (no invocable públicamente) y sin fugar errores internos
  app.post('/health/reconnect', async (req, res) => {
    if (config.nodeEnv === 'production') {
      return res.status(403).json({
        success: false,
        error: 'El endpoint de reconexión manual no está disponible públicamente en producción',
      });
    }

    try {
      await dbClient.connect();
      res.json({
        success: true,
        status: 'ok',
        database: { connected: dbClient.isConnected() },
      });
    } catch {
      res.status(503).json({
        success: false,
        status: 'degraded',
        error: 'Error al intentar reconectar con la base de datos',
      });
    }
  });

  // Auto-connect middleware: si una petición llega antes de inicializar la BD,
  // intenta conectarse automáticamente para evitar "llama a connect() primero"
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/health')) {
      return next();
    }
    if (!dbClient.isConnected()) {
      try {
        await dbClient.connect();
      } catch (err: any) {
        return res.status(503).json({
          success: false,
          error: `Base de datos no disponible (${err.message}). Verifica la conexión a MongoDB Atlas.`,
        });
      }
    }
    next();
  });

  // Global Categories endpoint: /categories
  app.get('/categories', async (req, res, next) => {
    try {
      const categories = await CatalogService.getCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (err) {
      next(err);
    }
  });

  // Core Modular Routes
  app.use('/auth', authRoutes);
  app.use('/users', authRoutes); // supports PUT /users/me
  app.use('/restaurants', restaurantRoutes);
  app.use('/customer', customerRoutes);
  app.use('/orders', orderRoutes);
  app.use('/checkout', orderRoutes);
  app.use('/payments', paymentRoutes);
  app.use('/', paymentRoutes); // Supports public /restaurant/mercadopago/callback and payment endpoints
  app.use('/restaurant', restaurantPortalRoutes);
  app.use('/driver', driverRoutes);
  app.use('/realtime', realtimeRoutes);
  app.use('/notifications', realtimeRoutes);
  app.use('/master', masterRoutes);

  // Validate payment environment on initialization without logging secrets
  config.validatePaymentConfig();

  // Central Error Handler
  app.use(errorHandler);

  return app;
}

export const coreApiApp = createCoreApp();
