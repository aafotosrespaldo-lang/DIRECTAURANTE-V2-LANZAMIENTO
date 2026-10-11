import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { DriverService } from '../services/driverService.ts';
import { dbClient } from '../db/connection.ts';
import type { DriverAvailability } from '../models/types.ts';

const router = Router();

// Protect all driver routes with authentication and driver role
router.use(authMiddleware);
router.use(requireRole('driver', 'master'));

// GET /driver/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const driver = await DriverService.getDriverProfile(req.user!.id);
    res.json({
      success: true,
      data: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        role: driver.role,
        driver_status: driver.driver_status || 'offline',
        is_verified: driver.is_verified || false,
        is_active: driver.is_active,
        vehicle_info: driver.vehicle_info || 'Motocicleta estándar',
        vehicle_type: driver.vehicle_type || 'motocicleta',
        documents: driver.documents || null,
        current_location: driver.current_location || null,
        profile_image: driver.profile_image || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /driver/status
router.put('/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, location } = req.body;
    const validStatuses: DriverAvailability[] = ['offline', 'available', 'busy', 'paused'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Debe ser uno de: [${validStatuses.join(', ')}]`,
      });
    }

    const updated = await DriverService.updateDriverStatus(req.user!.id, status, location);
    res.json({
      success: true,
      data: {
        id: updated.id,
        driver_status: updated.driver_status,
        current_location: updated.current_location,
      },
      message: `Estado actualizado a ${status}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/location
router.post('/location', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Las coordenadas latitude y longitude deben ser números válidos',
      });
    }

    const loc = await DriverService.updateDriverLocation(req.user!.id, latitude, longitude, address);
    res.json({
      success: true,
      data: loc,
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/offers/current
router.get('/offers/current', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const offer = await DriverService.getCurrentOfferForDriver(req.user!.id);
    res.json({
      success: true,
      data: offer,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/offers/:id/accept
router.post('/offers/:id/accept', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await DriverService.acceptOffer(req.params.id, req.user!.id);
    res.json({
      success: true,
      data: order,
      message: 'Oferta aceptada y pedido asignado exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/offers/:id/reject
router.post('/offers/:id/reject', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { reason } = req.body;
    await DriverService.rejectOffer(req.params.id, req.user!.id, reason);
    res.json({
      success: true,
      message: 'Oferta rechazada',
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/orders/current
router.get('/orders/current', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await DriverService.getCurrentDriverOrder(req.user!.id);
    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/orders/:id/arrived
router.post('/orders/:id/arrived', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await DriverService.markArrivedAtRestaurant(req.params.id, req.user!.id);
    res.json({
      success: true,
      data: order,
      message: 'Llegada al restaurante confirmada',
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/orders/:id/pickup
router.post('/orders/:id/pickup', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await DriverService.pickUpOrder(req.params.id, req.user!.id);
    res.json({
      success: true,
      data: order,
      message: 'Pedido recolectado',
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/orders/:id/delivering
router.post('/orders/:id/delivering', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await DriverService.startDelivery(req.params.id, req.user!.id);
    res.json({
      success: true,
      data: order,
      message: 'En ruta de entrega al cliente',
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/orders/:id/deliver
router.post('/orders/:id/deliver', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { notes } = req.body;
    const order = await DriverService.completeDelivery(req.params.id, req.user!.id, notes);
    res.json({
      success: true,
      data: order,
      message: 'Entrega finalizada con éxito',
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/shift/summary
router.get('/shift/summary', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const summary = await DriverService.getCurrentShiftSummary(req.user!.id);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/shift/close
router.post('/shift/close', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { notes } = req.body;
    const settlement = await DriverService.closeShift(req.user!.id, notes);
    res.json({
      success: true,
      data: settlement,
      message: 'Corte de jornada realizado exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/deposit-bank-info (Tarjeta de datos para depositar configurada por Master)
router.get('/deposit-bank-info', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { FinancialConfigService } = await import('../services/financialConfigService.ts');
    const cfg = await FinancialConfigService.getConfig();
    res.json({
      success: true,
      data: {
        bank_name: cfg.deposit_bank_name || 'BBVA Bancomer',
        account_holder: cfg.deposit_account_holder || 'Directaurante S.A.P.I. de C.V.',
        clabe_or_account: cfg.deposit_clabe_or_account || '012 180 00123456789 0',
        instructions: cfg.deposit_instructions || 'Realiza la transferencia interbancaria o depósito en ventanilla/practicaja. Usa tu número de repartidor o teléfono como concepto y sube tu comprobante a continuación.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/shift/deposit (Flujo de comprobante de depósito post-corte)
router.post('/shift/deposit', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { settlement_id, deposit_amount, proof_url, notes } = req.body;
    if (!settlement_id || !proof_url) {
      return res.status(400).json({
        success: false,
        error: 'settlement_id y proof_url son obligatorios para registrar el depósito',
      });
    }

    const updatedSettlement = await DriverService.registerDepositProof(
      req.user!.id,
      settlement_id,
      deposit_amount,
      proof_url,
      notes
    );

    res.json({
      success: true,
      data: updatedSettlement,
      message: 'Comprobante de depósito enviado exitosamente a revisión de Master',
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/settlements (Historial de cortes y liquidaciones del repartidor)
router.get('/settlements', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const settlements = await dbClient
      .getDriverSettlementsCollection()
      .find({ driver_id: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    res.json({
      success: true,
      data: settlements,
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/orders/history
router.get('/orders/history', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const history = await dbClient
      .getOrdersCollection()
      .find({ driver_id: req.user!.id, status: 'delivered' })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/orders/:id/messages
router.get('/orders/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
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

// POST /driver/orders/:id/messages
router.post('/orders/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío' });
    }

    const newMsg = await DriverService.sendOrderMessage(
      req.params.id,
      {
        id: req.user!.id,
        role: 'driver',
        name: req.user!.name || 'Repartidor',
      },
      message
    );

    res.json({
      success: true,
      data: newMsg,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/support/ticket
router.post('/support/ticket', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { category, description, order_id, priority } = req.body;
    if (!category || !description) {
      return res.status(400).json({
        success: false,
        error: 'Los campos category y description son obligatorios',
      });
    }

    const ticket = await DriverService.createSupportTicket(req.user!.id, req.user!.name || 'Repartidor', {
      category,
      description,
      order_id,
      priority,
    });

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket de soporte creado correctamente',
    });
  } catch (err) {
    next(err);
  }
});

// GET /driver/support/tickets
router.get('/support/tickets', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tickets = await dbClient
      .getSupportTicketsCollection()
      .find({ driver_id: req.user!.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    next(err);
  }
});

// POST /driver/dispatch/trigger (manual dispatch trigger for a ready order)
router.post('/dispatch/trigger', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id es requerido' });
    }
    const offer = await DriverService.dispatchOrder(order_id);
    res.json({
      success: true,
      data: offer,
      message: offer ? 'Oferta enviada al repartidor más cercano' : 'No se encontraron repartidores disponibles',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
