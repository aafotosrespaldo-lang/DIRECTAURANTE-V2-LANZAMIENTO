import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { MasterService } from '../services/masterService.ts';
import { CommunicationService } from '../services/communicationService.ts';
import { IncidentService } from '../services/incidentService.ts';
import { EntitlementService } from '../services/entitlementService.ts';
import { FinancialConfigService } from '../services/financialConfigService.ts';
import { dbClient } from '../db/connection.ts';

const router = Router();

// Strict RBAC: All endpoints under /master require active authentication and role === 'master'
router.use(authMiddleware);
router.use(requireRole('master'));

/**
 * GET /api/master/overview
 * Central NOC 24/7 Operations Snapshot
 */
router.get('/overview', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const overview = await MasterService.getNocOverview();
    res.json({
      success: true,
      data: overview,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/orders
 * Filterable ecosystem-wide orders query
 */
router.get('/orders', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, restaurant_id, driver_id, search, limit } = req.query;
    const orders = await MasterService.getOrders({
      status: status as any,
      restaurant_id: restaurant_id as string,
      driver_id: driver_id as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/orders/:id/status
 * Sovereign status override with required justification
 */
router.post('/orders/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, reason } = req.body;
    if (!status || !reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'El nuevo estado y un motivo (reason) justificado son requeridos para la intervención Master',
      });
    }

    const updated = await MasterService.forceOrderStatus(
      req.params.id,
      status,
      reason.trim(),
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({
      success: true,
      data: updated,
      message: `Estado de pedido actualizado soberanamente a "${status}"`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/orders/:id/assign-driver
 * Force driver assignment/reassignment
 */
router.post('/orders/:id/assign-driver', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { driver_id } = req.body;
    if (!driver_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del repartidor (driver_id) es requerido',
      });
    }

    const updated = await MasterService.reassignDriver(
      req.params.id,
      driver_id,
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({
      success: true,
      data: updated,
      message: 'Repartidor asignado exitosamente por Master NOC',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/drivers
 * Driver fleet live monitor
 */
router.get('/drivers', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const fleet = await MasterService.getFleet();
    res.json({
      success: true,
      data: fleet,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/drivers/:id
 * Toggle driver active status or verification
 */
router.put('/drivers/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { is_active, is_verified, driver_status } = req.body;
    const updated = await MasterService.updateDriver(
      req.params.id,
      { is_active, is_verified, driver_status },
      { id: req.user!.id }
    );

    res.json({
      success: true,
      data: updated,
      message: 'Estado de repartidor actualizado',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/restaurants
 * Restaurants overview with catalog metrics
 */
router.get('/restaurants', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rests = await MasterService.getRestaurants();
    res.json({
      success: true,
      data: rests,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/restaurants/:id/toggle
 * Toggle restaurant active state
 */
router.put('/restaurants/:id/toggle', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'El campo is_active booleano es requerido' });
    }

    const updated = await MasterService.toggleRestaurant(
      req.params.id,
      is_active,
      { id: req.user!.id }
    );

    res.json({
      success: true,
      data: updated,
      message: `Restaurante marcado como ${is_active ? 'activo' : 'inactivo'}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/settlements
 * Overview of driver shift settlements and deposits for Master NOC
 */
router.get('/settlements', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { driver_id, deposit_status, limit } = req.query;
    const query: any = {};
    if (driver_id) query.driver_id = driver_id;
    if (deposit_status) query.deposit_status = deposit_status;

    const settlements = await dbClient
      .getDriverSettlementsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit as string, 10) : 100)
      .toArray();

    // Enrich with driver details
    const driverIds = [...new Set(settlements.map((s) => s.driver_id))];
    const drivers = await dbClient
      .getUsersCollection()
      .find({ id: { $in: driverIds } }, { projection: { id: 1, name: 1, phone: 1, vehicle_info: 1 } })
      .toArray();
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const enriched = settlements.map((s) => ({
      ...s,
      driver_name: driverMap.get(s.driver_id)?.name || 'Repartidor',
      driver_phone: driverMap.get(s.driver_id)?.phone,
    }));

    res.json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/settlements/:id/review
 * Review, confirm or reject driver deposit
 */
router.put('/settlements/:id/review', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, notes, verified_amount, discrepancy_notes, is_reconciled } = req.body;
    if (!['confirmed', 'rejected', 'deposit_uploaded'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado de depósito inválido' });
    }

    const now = new Date().toISOString();
    const updateFields: any = {
      deposit_status: status,
      deposit_reviewed_by: req.user!.name || req.user!.id,
      deposit_reviewed_at: now,
      deposit_notes: notes || undefined,
    };

    const current = await dbClient.getDriverSettlementsCollection().findOne({ id: req.params.id });
    if (!current) {
      return res.status(404).json({ success: false, error: 'Liquidación no encontrada' });
    }

    // Calcular y auditar diferencias si se proporciona un monto verificado por Master
    if (verified_amount !== undefined) {
      const verifiedCents = Math.round(Number(verified_amount));
      updateFields.deposit_verified_amount = verifiedCents;
      const expectedAmount = current.deposit_amount !== undefined ? current.deposit_amount : current.cash_collected;
      const discrepancyCents = expectedAmount - verifiedCents;
      updateFields.discrepancy_amount = discrepancyCents;
      if (discrepancy_notes) {
        updateFields.discrepancy_notes = String(discrepancy_notes).trim();
      }
      if (is_reconciled !== undefined) {
        updateFields.is_reconciled = Boolean(is_reconciled);
      }
    } else if (discrepancy_notes) {
      updateFields.discrepancy_notes = String(discrepancy_notes).trim();
      if (is_reconciled !== undefined) {
        updateFields.is_reconciled = Boolean(is_reconciled);
      }
    }

    const updated = await dbClient.getDriverSettlementsCollection().findOneAndUpdate(
      { id: req.params.id },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    const { AuditService } = await import('../services/auditService.ts');
    await AuditService.log(
      'master.deposit_reviewed',
      'settlement',
      req.params.id,
      {
        status,
        notes,
        verified_amount: updateFields.deposit_verified_amount,
        discrepancy_amount: updateFields.discrepancy_amount,
        discrepancy_notes: updateFields.discrepancy_notes,
        is_reconciled: updateFields.is_reconciled,
        reviewed_by: req.user!.id,
      },
      req.user!.id,
      'master'
    );

    res.json({
      success: true,
      data: updated,
      message: `Comprobante de depósito marcado como ${status}${updateFields.discrepancy_amount ? ` con diferencia registrada de $${(updateFields.discrepancy_amount / 100).toFixed(2)} MXN` : ''}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/evidence
 * Universal Evidence Vault
 */
router.get('/evidence', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const evidence = await MasterService.getAllEvidence(limit);
    res.json({
      success: true,
      data: evidence,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/audit-logs
 * Sovereign audit trail stream
 */
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const logs = await MasterService.getAuditLogs(limit);
    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/broadcast
 * Broadcast emergency alert to ecosystem
 */
router.post('/broadcast', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { title, message, target_role } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Título y mensaje son requeridos' });
    }

    const result = await MasterService.broadcastAlert(
      title,
      message,
      target_role || 'all',
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({
      success: true,
      data: result,
      message: 'Alerta emitida al ecosistema en tiempo real',
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1. CENTRO DE COMUNICACIÓN 24/7 ENDPOINTS
// ==========================================

/**
 * GET /api/master/communications/conversations
 */
router.get('/communications/conversations', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, priority, type, order_id, search, limit } = req.query;
    const conversations = await CommunicationService.getConversations({
      status: status as any,
      priority: priority as any,
      type: type as any,
      order_id: order_id as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/communications/conversations/:id
 */
router.get('/communications/conversations/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const conversation = await CommunicationService.getConversationById(req.params.id);
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/communications/conversations/:id/messages
 */
router.get('/communications/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const messages = await CommunicationService.getMessages(req.params.id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/communications/conversations/:id/messages
 */
router.post('/communications/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío' });
    }

    const sent = await CommunicationService.sendMessage(req.params.id, message.trim(), {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    });

    res.status(201).json({ success: true, data: sent });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/communications/conversations/:id/priority
 */
router.put('/communications/conversations/:id/priority', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { priority } = req.body;
    if (!['normal', 'importante', 'urgente', 'critica'].includes(priority)) {
      return res.status(400).json({ success: false, error: 'Prioridad inválida' });
    }

    const updated = await CommunicationService.updatePriority(req.params.id, priority, {
      id: req.user!.id,
      name: req.user!.name,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/communications/conversations/:id/close
 */
router.post('/communications/conversations/:id/close', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { reason } = req.body;
    const updated = await CommunicationService.closeConversation(
      req.params.id,
      reason || 'Cerrado por operador Master',
      {
        id: req.user!.id,
        name: req.user!.name,
      }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/communications/direct
 * Master ↔ Client, Master ↔ Restaurant, Master ↔ Driver
 */
router.post('/communications/direct', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { target_user_id, initial_message, priority, subject } = req.body;
    if (!target_user_id) {
      return res.status(400).json({ success: false, error: 'target_user_id es requerido' });
    }

    const conv = await CommunicationService.createDirectConversation(
      target_user_id,
      { id: req.user!.id, name: req.user!.name, role: req.user!.role },
      { initialMessage: initial_message, priority, subject }
    );

    res.status(201).json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/communications/order/:orderId
 * Full multi-party Order Communication Room with live presence and timeline
 */
router.get('/communications/order/:orderId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const context = await CommunicationService.getOrCreateOrderConversation(req.params.orderId, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    });

    res.json({ success: true, data: context });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. INCIDENCIAS & SOPORTE OPERATIVO
// ==========================================

/**
 * GET /api/master/incidents
 */
router.get('/incidents', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, severity, entity_type, entity_id, order_id, search, limit } = req.query;
    const incidents = await IncidentService.getIncidents({
      status: status as any,
      severity: severity as any,
      entity_type: entity_type as string,
      entity_id: entity_id as string,
      order_id: order_id as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ success: true, data: incidents });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/incidents
 */
router.post('/incidents', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { title, description, entity_type, entity_id, order_id, order_code, severity } = req.body;
    if (!title || !description || !entity_type || !entity_id) {
      return res.status(400).json({ success: false, error: 'Campos requeridos incompletos para crear incidencia' });
    }

    const inc = await IncidentService.createIncident(
      {
        title,
        description,
        entity_type,
        entity_id,
        order_id,
        order_code,
        severity: severity || 'normal',
      },
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );

    res.status(201).json({ success: true, data: inc });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/incidents/:id
 */
router.put('/incidents/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, severity, resolution_notes, assigned_to } = req.body;
    const updated = await IncidentService.updateIncident(
      req.params.id,
      { status, severity, resolution_notes, assigned_to },
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/support/overview
 */
router.get('/support/overview', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const overview = await IncidentService.getSupportOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. CENTRO COMERCIAL: SOLUCIONES & PLANES
// ==========================================

/**
 * GET /api/master/commercial/overview
 */
router.get('/commercial/overview', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const overview = await EntitlementService.getCommercialOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/commercial/solutions
 */
router.get('/commercial/solutions', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { product } = req.query;
    const solutions = await EntitlementService.getSolutions(product as any);
    res.json({ success: true, data: solutions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/commercial/plans
 */
router.get('/commercial/plans', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { product } = req.query;
    const plans = await EntitlementService.getPlans(product as any);
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/commercial/restaurants/:id/entitlements
 */
router.get('/commercial/restaurants/:id/entitlements', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const entitlements = await EntitlementService.getRestaurantEntitlements(req.params.id);
    res.json({ success: true, data: entitlements });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/commercial/restaurants/:id/plan
 */
router.post('/commercial/restaurants/:id/plan', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ success: false, error: 'plan_id es requerido' });
    }

    const result = await EntitlementService.assignPlanToRestaurant(req.params.id, plan_id, {
      id: req.user!.id,
      name: req.user!.name,
    });

    res.json({ success: true, data: result, message: 'Plan asignado con éxito y capacidades activadas' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/commercial/restaurants/:id/trial
 */
router.post('/commercial/restaurants/:id/trial', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { solution_id, days } = req.body;
    if (!solution_id) {
      return res.status(400).json({ success: false, error: 'solution_id es requerido' });
    }

    const ent = await EntitlementService.grantTrial(req.params.id, solution_id, days || 15, {
      id: req.user!.id,
      name: req.user!.name,
    });

    res.json({ success: true, data: ent, message: 'Período de prueba (Trial) activado exitosamente' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/commercial/restaurants/:id/subscription
 * Set subscription status, grant trial license, or activate plan
 */
router.put('/commercial/restaurants/:id/subscription', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      subscription_status,
      trial_days,
      trial_ends_at,
      plan_id,
      subscription_plan_name,
      subscription_price_cents,
      subscription_billing_period,
      subscription_starts_at,
      subscription_ends_at,
      subscription_notes,
      subscription_limits,
      solutions,
    } = req.body;

    if (!subscription_status || !['active', 'trial', 'expired', 'none', 'lifetime', 'paused'].includes(subscription_status)) {
      return res.status(400).json({
        success: false,
        error: 'subscription_status inválido (debe ser active, trial, expired, none, lifetime o paused)',
      });
    }

    const rest = await EntitlementService.updateRestaurantSubscriptionStatus(
      req.params.id,
      {
        subscription_status,
        trial_days,
        trial_ends_at,
        plan_id,
        subscription_plan_name,
        subscription_price_cents,
        subscription_billing_period,
        subscription_starts_at,
        subscription_ends_at,
        subscription_notes,
        subscription_limits,
        solutions,
      },
      { id: req.user!.id, name: req.user!.name }
    );

    res.json({
      success: true,
      data: rest,
      message: `Licencia y suscripción actualizada a ${subscription_status.toUpperCase()}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/commercial/restaurants/:id/entitlements/:solutionId
 */
router.put('/commercial/restaurants/:id/entitlements/:solutionId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado de entitlement inválido' });
    }

    const ent = await EntitlementService.toggleEntitlement(req.params.id, req.params.solutionId, status, {
      id: req.user!.id,
      name: req.user!.name,
    });

    res.json({ success: true, data: ent, message: `Capacidad comercial actualizada a ${status}` });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/commercial/solutions
 */
router.post('/commercial/solutions', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, description, category, product, price_cents, features, billing_period, version, status, solution_id } = req.body;
    if (!name || !description || !product || price_cents === undefined) {
      return res.status(400).json({ success: false, error: 'Nombre, descripción, producto y precio son requeridos' });
    }
    const sol = await EntitlementService.createSolution(
      { name, description, category, product, price_cents, features, billing_period, version, status, solution_id },
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );
    res.status(201).json({ success: true, data: sol, message: 'Solución creada exitosamente' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/commercial/solutions/:id
 */
router.put('/commercial/solutions/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await EntitlementService.updateSolution(
      req.params.id,
      req.body,
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );
    res.json({ success: true, data: updated, message: 'Solución comercial actualizada exitosamente' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/master/commercial/solutions/:id
 */
router.delete('/commercial/solutions/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await EntitlementService.deleteSolution(req.params.id, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    });
    res.json({ success: true, message: 'Solución eliminada de forma segura' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/master/commercial/plans
 */
router.post('/commercial/plans', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, product, description, included_solutions, limits, status, price_cents, billing_period, plan_id } = req.body;
    if (!name || !product || !description || price_cents === undefined) {
      return res.status(400).json({ success: false, error: 'Nombre, producto, descripción y precio son requeridos' });
    }
    const plan = await EntitlementService.createPlan(
      { name, product, description, included_solutions, limits, status, price_cents, billing_period, plan_id },
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );
    res.status(201).json({ success: true, data: plan, message: 'Plan comercial creado exitosamente' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/commercial/plans/:id
 */
router.put('/commercial/plans/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await EntitlementService.updatePlan(
      req.params.id,
      req.body,
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );
    res.json({ success: true, data: updated, message: 'Plan comercial actualizado exitosamente' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/master/commercial/plans/:id
 */
router.delete('/commercial/plans/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await EntitlementService.deletePlan(req.params.id, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    });
    res.json({ success: true, message: 'Plan eliminado de forma segura' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. CONFIGURACIÓN FINANCIERA DEL SISTEMA
// ==========================================

/**
 * GET /api/master/financial-config
 */
router.get('/financial-config', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const cfg = await FinancialConfigService.getConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/financial-config
 */
router.put('/financial-config', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await FinancialConfigService.updateConfig(
      req.body,
      { id: req.user!.id, name: req.user!.name, role: req.user!.role }
    );
    res.json({
      success: true,
      data: updated,
      message: 'Tarifas y configuración financiera actualizadas y auditadas en MongoDB',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/financial-config/audit
 */
router.get('/financial-config/audit', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const logs = await dbClient
      .getAuditLogsCollection()
      .find({ entity_type: 'system_financial_config' })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/users
 * Universal user lookup for starting direct communications and support
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { role, search, limit } = req.query;
    const query: any = {};
    if (role) query.role = role;
    if (search && (search as string).trim()) {
      const q = (search as string).trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }
    const users = await dbClient
      .getUsersCollection()
      .find(query, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit as string, 10) : 50)
      .toArray();

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

export default router;
