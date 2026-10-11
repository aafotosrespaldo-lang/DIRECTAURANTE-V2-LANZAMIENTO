import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { AuthService } from '../services/authService.ts';
import { CustomerService } from '../services/customerService.ts';
import { dbClient } from '../db/connection.ts';
import { AuditService } from '../services/auditService.ts';

const router = Router();

// Require auth for all customer routes
router.use(authMiddleware);

// GET /customer/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const profile = await AuthService.getProfile(req.user!.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /customer/profile
router.put('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await AuthService.updateProfile(req.user!.id, req.body);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// GET /customer/addresses
router.get('/addresses', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const addresses = await CustomerService.listAddresses(req.user!.id);
    res.json({
      success: true,
      data: addresses,
    });
  } catch (err) {
    next(err);
  }
});

// POST /customer/addresses
router.post('/addresses', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.body.street || !req.body.number || !req.body.city) {
      return res.status(400).json({
        success: false,
        error: 'Calle, número y ciudad son requeridos',
      });
    }

    const created = await CustomerService.createAddress(req.user!.id, {
      label: req.body.label || 'Dirección',
      street: req.body.street,
      number: req.body.number,
      colony: req.body.colony || '',
      city: req.body.city,
      state: req.body.state || 'Guanajuato',
      postal_code: req.body.postal_code || '',
      references: req.body.references || '',
      is_default: req.body.is_default,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /customer/addresses/:id
router.put('/addresses/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await CustomerService.updateAddress(req.user!.id, req.params.id, req.body);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /customer/addresses/:id
router.delete('/addresses/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const deleted = await CustomerService.deleteAddress(req.user!.id, req.params.id);
    res.json({
      success: true,
      message: 'Dirección eliminada correctamente',
    });
  } catch (err) {
    next(err);
  }
});

// GET /customer/support/tickets (List customer tickets)
router.get('/support/tickets', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tickets = await dbClient
      .getSupportTicketsCollection()
      .find({ user_id: req.user!.id })
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

// POST /customer/support/tickets (Create customer ticket with optional order)
router.post('/support/tickets', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { category, description, order_id, priority } = req.body;
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'La descripción del problema o consulta es obligatoria',
      });
    }

    const ticketId = `tkt_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ticket = {
      id: ticketId,
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      order_id: order_id ? String(order_id).trim() : undefined,
      category: category ? String(category).trim() : 'general',
      description: description.trim(),
      status: 'open' as const,
      priority: priority === 'urgent' ? ('urgent' as const) : ('normal' as const),
      createdAt: new Date().toISOString(),
    };

    await dbClient.getSupportTicketsCollection().insertOne(ticket as any);

    await AuditService.log(
      'customer_ticket_created',
      'support_ticket',
      ticketId,
      { ticket },
      req.user!.id,
      req.user!.role
    );

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket de soporte enviado al equipo de atención',
    });
  } catch (err) {
    next(err);
  }
});

// GET /customer/cards (List saved cards)
router.get('/cards', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const cards = await dbClient
      .getDb()
      .collection('saved_cards')
      .find({ user_id: req.user!.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: cards,
    });
  } catch (err) {
    next(err);
  }
});

// POST /customer/cards (Save new credit/debit card)
router.post('/cards', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { brand, last4, holder_name, exp_month, exp_year, card_type, is_default } = req.body;
    if (!last4 || !holder_name || !exp_month || !exp_year) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos de la tarjeta son requeridos',
      });
    }

    const collection = dbClient.getDb().collection('saved_cards');
    const existingCount = await collection.countDocuments({ user_id: req.user!.id });
    const shouldBeDefault = is_default !== undefined ? Boolean(is_default) : existingCount === 0;

    if (shouldBeDefault) {
      await collection.updateMany({ user_id: req.user!.id }, { $set: { is_default: false } });
    }

    const cardId = `crd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCard = {
      id: cardId,
      user_id: req.user!.id,
      brand: brand || 'visa',
      last4: String(last4).slice(-4),
      holder_name: String(holder_name).trim().toUpperCase(),
      exp_month: String(exp_month).padStart(2, '0'),
      exp_year: String(exp_year).slice(-2),
      card_type: card_type === 'debito' ? 'debito' : 'credito',
      is_default: shouldBeDefault,
      createdAt: new Date().toISOString(),
    };

    await collection.insertOne(newCard as any);

    res.status(201).json({
      success: true,
      data: newCard,
      message: 'Tarjeta agregada exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /customer/cards/:id (Delete saved card)
router.delete('/cards/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const collection = dbClient.getDb().collection('saved_cards');
    await collection.deleteOne({ id: req.params.id, user_id: req.user!.id });
    res.json({
      success: true,
      message: 'Tarjeta eliminada exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /customer/cards/:id/default (Set default card)
router.put('/cards/:id/default', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const collection = dbClient.getDb().collection('saved_cards');
    await collection.updateMany({ user_id: req.user!.id }, { $set: { is_default: false } });
    await collection.updateOne({ id: req.params.id, user_id: req.user!.id }, { $set: { is_default: true } });
    res.json({
      success: true,
      message: 'Tarjeta establecida como predeterminada',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
