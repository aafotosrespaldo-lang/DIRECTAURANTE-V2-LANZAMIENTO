import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService.ts';
import { RealtimeService } from '../services/realtimeService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { dbClient } from '../db/connection.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import type { DeviceRegistration } from '../models/types.ts';

const router = Router();

// GET /realtime/stream (SSE Endpoint)
router.get('/stream', async (req: Request, res: Response) => {
  // Support token via query param (recommended for EventSource) or Bearer header
  const token = (req.query.token as string) || req.headers.authorization?.replace(/^Bearer\s+/, '');

  let actor: { id: string; email: string; role: any; name: string };
  if (!token || token === 'guest' || token === 'anonymous') {
    actor = {
      id: `guest_${crypto.randomUUID()}`,
      email: '',
      role: 'guest',
      name: 'Invitado',
    };
  } else {
    try {
      actor = AuthService.verifyToken(token);
    } catch {
      actor = {
        id: `guest_${crypto.randomUUID()}`,
        email: '',
        role: 'guest',
        name: 'Invitado',
      };
    }
  }

  // Find owned restaurant if restaurant role
  let restaurantId: string | undefined;
  if (actor.role === 'restaurant') {
    try {
      const rest = await RestaurantRepository.findByOwnerId(actor.id);
      restaurantId = rest?.id;
    } catch {
      restaurantId = undefined;
    }
  } else if (actor.role === 'master' || (actor.role as any) === 'admin') {
    restaurantId = (req.query.restaurant_id as string) || undefined;
  }

  // SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  // Flush headers immediately if available
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Disable socket buffering for instant SSE delivery
  if (res.socket) {
    res.socket.setNoDelay(true);
    res.socket.setKeepAlive(true, 10000);
  }

  const clientId = `sse_${actor.id}_${crypto.randomUUID()}`;
  RealtimeService.addClient(clientId, actor.id, actor.role, res, restaurantId);

  req.on('close', () => {
    RealtimeService.removeClient(clientId);
  });
});

// GET /realtime/stats (For health / diagnostics)
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    data: RealtimeService.getStats(),
  });
});

// POST /notifications/devices/register (FASE 4: Dispositivos FCM / Push)
router.post('/devices/register', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { device_id, platform, push_token } = req.body;
    if (!device_id || !platform || !push_token) {
      return res.status(400).json({
        success: false,
        error: 'device_id, platform y push_token son campos requeridos para registro de dispositivo',
      });
    }

    const validPlatforms = ['web', 'android', 'ios'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ success: false, error: 'Plataforma no válida (web, android, ios)' });
    }

    const now = new Date().toISOString();
    const registration: DeviceRegistration = {
      id: `dev_${crypto.randomUUID()}`,
      device_id,
      user_id: req.user!.id,
      platform,
      push_token,
      last_seen: now,
      is_active: true,
      created_at: now,
    };

    await dbClient.getDevicesCollection().updateOne(
      { device_id, user_id: req.user!.id },
      {
        $set: {
          push_token,
          platform,
          last_seen: now,
          is_active: true,
        },
        $setOnInsert: {
          id: registration.id,
          created_at: now,
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Dispositivo registrado exitosamente para notificaciones',
      device_id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /notifications/devices
router.get('/devices', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const devices = await dbClient
      .getDevicesCollection()
      .find({ user_id: req.user!.id, is_active: true })
      .toArray();

    res.json({
      success: true,
      data: devices,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
