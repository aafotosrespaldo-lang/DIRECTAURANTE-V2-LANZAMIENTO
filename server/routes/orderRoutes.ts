import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { config } from '../config/index.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { validateCreateOrder } from '../schemas/validation.ts';
import { OrderService } from '../services/orderService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { DriverService } from '../services/driverService.ts';
import { dbClient } from '../db/connection.ts';
import { AuditService } from '../services/auditService.ts';
import { RealtimeService } from '../services/realtimeService.ts';
import { EntitlementService } from '../services/entitlementService.ts';
import type { EvidenceType, OrderEvidence } from '../models/types.ts';

const router = Router();

// GET /checkout/fees (Public / helper)
router.get('/fees', (req, res) => {
  res.json({
    success: true,
    data: {
      service_fee: 0, // El cliente no paga tarifa de servicio
      default_delivery_fee: config.defaultDeliveryFeeCents,
      minimum_order: 0,
      currency: config.defaultCurrency,
    },
  });
});

// Require auth for creating & viewing orders
router.use(authMiddleware);

// GET /orders/my-orders (Compatibility with V1 / Client App)
router.get('/my-orders', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const orders = await OrderService.listCustomerOrders(req.user!.id);
    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

// POST /orders
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Check header for idempotency key if not in body
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotency_key;
    if (idempotencyKey) {
      req.body.idempotency_key = idempotencyKey;
    }

    const validation = validateCreateOrder(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Sovereign Entitlement Verification: Backend is the authority
    const hasOrdersEntitlement = await EntitlementService.hasActiveEntitlement(
      validation.data.restaurant_id,
      'sol_dir_online_orders'
    );
    if (!hasOrdersEntitlement) {
      return res.status(403).json({
        success: false,
        error: 'El restaurante no cuenta con la solución comercial activa de Pedidos Online (Directaurante).',
      });
    }

    if (validation.data.order_type === 'delivery') {
      const hasDeliveryEntitlement = await EntitlementService.hasActiveEntitlement(
        validation.data.restaurant_id,
        'sol_dir_delivery'
      );
      if (!hasDeliveryEntitlement) {
        return res.status(403).json({
          success: false,
          error: 'El restaurante no cuenta con la solución comercial activa de Delivery & Logística.',
        });
      }
    }

    const customerId = req.user!.id;
    const result = await OrderService.createOrder(customerId, validation.data);

    // If duplicate detected, return 200 with notice; else 201 Created
    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      data: result.order,
      is_duplicate: result.isDuplicate,
      message: result.isDuplicate ? 'Pedido preexistente devuelto por clave de idempotencia' : 'Pedido creado exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    let orders;
    if (user.role === 'restaurant') {
      const restOwner = await RestaurantRepository.findByOwnerId(user.id);
      const restaurantId = (req.query.restaurant_id as string) || (restOwner ? restOwner.id : '');
      if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'restaurant_id es requerido para listar pedidos de restaurante' });
      }
      orders = await OrderService.listRestaurantOrders(restaurantId, { id: user.id, role: user.role });
    } else {
      orders = await OrderService.listCustomerOrders(user.id);
    }
    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    const order = await OrderService.getOrderById(req.params.id, { id: user.id, role: user.role });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/status
router.post('/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'El campo status es requerido' });
    }

    const updated = await OrderService.updateOrderStatus(req.params.id, status, {
      id: req.user!.id,
      role: req.user!.role,
      notes,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id/messages
router.get('/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const messages = await DriverService.getOrderMessages(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({
      success: true,
      data: messages,
    });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/messages
router.post('/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío' });
    }

    const sent = await DriverService.sendOrderMessage(
      req.params.id,
      {
        id: req.user!.id,
        role: req.user!.role as any,
        name: req.user!.name,
      },
      message
    );

    res.status(201).json({
      success: true,
      data: sent,
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id/evidence
router.get('/:id/evidence', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await OrderService.getOrderById(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    const evidenceList = await dbClient
      .getOrderEvidenceCollection()
      .find({ order_id: order.id })
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      data: evidenceList,
    });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/evidence
router.post('/:id/evidence', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await OrderService.getOrderById(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    const { type, file_url, notes } = req.body;
    if (!type || !file_url) {
      return res.status(400).json({ success: false, error: 'type y file_url son campos obligatorios para registrar evidencia' });
    }

    const validTypes: EvidenceType[] = [
      'transfer_proof',
      'order_pickup',
      'delivery',
      'incident',
      'product',
      'other',
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: `Tipo de evidencia inválido: ${type}` });
    }

    const evidenceId = `ev_${crypto.randomUUID()}`;
    const evidenceItem: OrderEvidence = {
      id: evidenceId,
      evidence_id: evidenceId,
      order_id: order.id,
      uploaded_by: req.user!.id,
      role: req.user!.role as any,
      type,
      file_url,
      notes,
      created_at: new Date().toISOString(),
    };

    await dbClient.getOrderEvidenceCollection().insertOne(evidenceItem as any);

    await AuditService.log(
      'evidence_uploaded',
      'order',
      order.id,
      { evidence_id: evidenceId, type, file_url },
      req.user!.id,
      req.user!.role
    );

    try {
      RealtimeService.emit({
        type: 'ORDER_EVIDENCE_ADDED',
        order_id: order.id,
        restaurant_id: order.restaurant_id,
        customer_id: order.customer_id,
        driver_id: order.driver_id || undefined,
        data: evidenceItem,
        timestamp: evidenceItem.created_at,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json({
      success: true,
      data: evidenceItem,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
