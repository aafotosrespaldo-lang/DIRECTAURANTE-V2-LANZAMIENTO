import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { OrderService } from '../services/orderService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { ProductRepository } from '../repositories/productRepository.ts';
import { RealtimeService } from '../services/realtimeService.ts';
import { AuditService } from '../services/auditService.ts';
import { dbClient } from '../db/connection.ts';
import { getSeedOrders } from '../db/seed.ts';
import { enrichRestaurant } from '../services/restaurantService.ts';
import type { Restaurant } from '../models/types.ts';

const router = Router();

router.use(authMiddleware);

// Helper to get restaurant ID authorized for actor
async function getAuthorizedRestaurantId(req: AuthenticatedRequest): Promise<string> {
  const user = req.user!;
  if (user.role === 'restaurant') {
    const owned = await RestaurantRepository.findByOwnerId(user.id);
    return owned ? owned.id : '';
  }
  if (user.role === 'master' || user.role === 'admin') {
    return (req.query.restaurant_id as string) || (req.body?.restaurant_id as string) || '';
  }
  return '';
}

// GET /restaurant/orders
router.get('/orders', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({
        success: false,
        error: 'No se encontró un restaurante autorizado para este usuario',
      });
    }

    let orders = await OrderService.listRestaurantOrders(restaurantId, {
      id: req.user!.id,
      role: req.user!.role,
    });

    // Auto-seed sample history is disabled by default to prevent re-introducing mock orders.
    // It is only allowed if explicitly configured via ENABLE_ORDER_AUTOSEED === 'true' in development.
    if (orders.length === 0 && process.env.ENABLE_ORDER_AUTOSEED === 'true') {
      try {
        const seedOrders = getSeedOrders(restaurantId);
        if (seedOrders.length > 0) {
          await dbClient.getOrdersCollection().insertMany(seedOrders as any);
          orders = await OrderService.listRestaurantOrders(restaurantId, {
            id: req.user!.id,
            role: req.user!.role,
          });
        }
      } catch (seedErr) {
        console.warn('[Orders] Auto-seed non-fatal warning:', seedErr);
      }
    }

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurant/sales-summary (Real sales calculation: Hoy, Mes, Año from Core V2)
router.get('/sales-summary', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ success: false, error: 'Restaurante no autorizado' });
    }

    const orders = await OrderService.listRestaurantOrders(restaurantId, {
      id: req.user!.id,
      role: req.user!.role,
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStr = now.toISOString().slice(0, 7);
    const thisYearStr = now.toISOString().slice(0, 4);

    let salesTodayCents = 0;
    let salesMonthCents = 0;
    let salesYearCents = 0;
    let activeOrdersCount = 0;

    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;

      const ordDate = ord.createdAt || '';
      const total = ord.total || 0;

      if (['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'delivering'].includes(ord.status)) {
        activeOrdersCount++;
      }

      if (ordDate.startsWith(todayStr)) {
        salesTodayCents += total;
      }
      if (ordDate.startsWith(thisMonthStr)) {
        salesMonthCents += total;
      }
      if (ordDate.startsWith(thisYearStr)) {
        salesYearCents += total;
      }
    }

    res.json({
      success: true,
      data: {
        restaurant_id: restaurantId,
        today_cents: salesTodayCents,
        month_cents: salesMonthCents,
        year_cents: salesYearCents,
        active_orders: activeOrdersCount,
        currency: 'MXN',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /restaurant/orders/:id/accept
router.post('/orders/:id/accept', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await OrderService.updateOrderStatus(req.params.id, 'confirmed', {
      id: req.user!.id,
      role: req.user!.role,
      notes: 'Pedido aceptado por la cocina',
    });
    res.json({
      success: true,
      data: updated,
      message: 'Pedido confirmado exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

// POST /restaurant/orders/:id/reject
router.post('/orders/:id/reject', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const reason = req.body.reason || 'Rechazado por el restaurante';
    const updated = await OrderService.updateOrderStatus(req.params.id, 'cancelled', {
      id: req.user!.id,
      role: req.user!.role,
      notes: reason,
    });
    res.json({
      success: true,
      data: updated,
      message: 'Pedido rechazado',
    });
  } catch (err) {
    next(err);
  }
});

// POST /restaurant/orders/:id/status
router.post('/orders/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
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

// GET /restaurant/inventory (Mini Inventory)
router.get('/inventory', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ success: false, error: 'Restaurante no autorizado' });
    }

    const products = await ProductRepository.findByRestaurantId(restaurantId, false);
    res.json({
      success: true,
      data: products,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /restaurant/inventory/:productId (Adjust stock and availability)
router.put('/inventory/:productId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const product = await ProductRepository.findById(req.params.productId);
    if (!product || product.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'El producto no pertenece a este restaurante' });
    }

    const { stock, is_available, low_stock_threshold, image_url } = req.body;
    const updates: any = {};

    if (stock !== undefined) updates.stock = stock === null ? null : parseInt(stock, 10);
    if (is_available !== undefined) updates.is_available = Boolean(is_available);
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = parseInt(low_stock_threshold, 10);
    if (image_url !== undefined && typeof image_url === 'string') updates.image_url = image_url.trim();

    const updated = await ProductRepository.update(product.id, updates);

    await AuditService.log(
      'inventory_adjusted',
      'product',
      product.id,
      { updates },
      req.user!.id,
      req.user!.role
    );

    try {
      RealtimeService.emit({
        type: 'INVENTORY_UPDATED',
        restaurant_id: restaurantId,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurant/products (Full product list)
router.get('/products', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ success: false, error: 'Restaurante no autorizado' });
    }
    const products = await ProductRepository.findByRestaurantId(restaurantId, false);
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
});

// POST /restaurant/products (Create Product)
router.post('/products', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    if (!restaurantId) {
      return res.status(403).json({ success: false, error: 'Restaurante no autorizado' });
    }

    const { name, description, price, category, image_url, is_available, stock, low_stock_threshold, variants, toppings } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ success: false, error: 'Nombre, precio y categoría son obligatorios' });
    }

    const priceCents = Math.max(0, parseInt(String(price), 10));
    const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newProd = await ProductRepository.create({
      id: prodId,
      product_id: prodId,
      restaurant_id: restaurantId,
      name: name.trim(),
      description: description ? description.trim() : '',
      price: priceCents,
      category: category.trim(),
      image_url: image_url ? image_url.trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
      is_available: is_available !== undefined ? Boolean(is_available) : true,
      stock: stock === null || stock === '' || stock === undefined ? null : Math.max(0, parseInt(String(stock), 10)),
      low_stock_threshold: low_stock_threshold !== undefined ? Math.max(0, parseInt(String(low_stock_threshold), 10)) : 3,
      variants: Array.isArray(variants) ? variants : [],
      toppings: Array.isArray(toppings) ? toppings : [],
      createdAt: new Date().toISOString(),
    });

    await AuditService.log('product_created', 'product', newProd.id, { product: newProd }, req.user!.id, req.user!.role);

    try {
      RealtimeService.emit({
        type: 'INVENTORY_UPDATED',
        restaurant_id: restaurantId,
        data: newProd,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    res.status(201).json({ success: true, data: newProd, message: 'Producto creado exitosamente' });
  } catch (err) {
    next(err);
  }
});

// PUT /restaurant/products/:productId (Update full Product)
router.put('/products/:productId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const product = await ProductRepository.findById(req.params.productId);
    if (!product || product.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'El producto no pertenece a este restaurante' });
    }

    const { name, description, price, category, image_url, is_available, stock, low_stock_threshold, variants, toppings } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (price !== undefined) updates.price = Math.max(0, parseInt(String(price), 10));
    if (category !== undefined) updates.category = category.trim();
    if (image_url !== undefined) updates.image_url = image_url.trim();
    if (is_available !== undefined) updates.is_available = Boolean(is_available);
    if (stock !== undefined) updates.stock = stock === null || stock === '' ? null : Math.max(0, parseInt(String(stock), 10));
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = Math.max(0, parseInt(String(low_stock_threshold), 10));
    if (variants !== undefined && Array.isArray(variants)) updates.variants = variants;
    if (toppings !== undefined && Array.isArray(toppings)) updates.toppings = toppings;

    const updated = await ProductRepository.update(product.id, updates);
    await AuditService.log('product_updated', 'product', product.id, { previous: product, updates }, req.user!.id, req.user!.role);

    try {
      RealtimeService.emit({
        type: 'INVENTORY_UPDATED',
        restaurant_id: restaurantId,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    res.json({ success: true, data: updated, message: 'Producto actualizado exitosamente' });
  } catch (err) {
    next(err);
  }
});

// DELETE /restaurant/products/:productId (Delete Product safely)
router.delete('/products/:productId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const product = await ProductRepository.findById(req.params.productId);
    if (!product || product.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'El producto no pertenece a este restaurante' });
    }

    // Safety check: is product currently in active pending orders?
    const activeOrdersCount = await dbClient.getOrdersCollection().countDocuments({
      restaurant_id: restaurantId,
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'delivering'] },
      'items.product_id': product.id,
    });
    if (activeOrdersCount > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar el producto '${product.name}': está incluido en ${activeOrdersCount} pedido(s) activo(s) en curso. Puedes desactivarlo en su lugar.`,
      });
    }

    await ProductRepository.delete(product.id);
    await AuditService.log('product_deleted', 'product', product.id, { deleted: product }, req.user!.id, req.user!.role);

    try {
      RealtimeService.emit({
        type: 'INVENTORY_UPDATED',
        restaurant_id: restaurantId,
        data: { id: product.id, deleted: true },
        timestamp: new Date().toISOString(),
      });
    } catch {}

    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (err) {
    next(err);
  }
});

// GET /restaurant/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const rest = await RestaurantRepository.findById(restaurantId);
    if (!rest) {
      return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
    }
    res.json({
      success: true,
      data: enrichRestaurant(rest),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /restaurant/toggle-closed
router.put('/toggle-closed', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const rest = await RestaurantRepository.findById(restaurantId);
    if (!rest) {
      return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
    }

    const currentClosed = rest.is_temporarily_closed ?? (!rest.is_open);
    const targetClosed = req.body.is_temporarily_closed !== undefined
      ? Boolean(req.body.is_temporarily_closed)
      : !currentClosed;

    const updates: Partial<Restaurant> = {
      is_temporarily_closed: targetClosed,
      is_open: !targetClosed,
    };

    const updated = await RestaurantRepository.update(rest.id, updates);
    const enriched = updated ? enrichRestaurant(updated) : null;

    await AuditService.log(
      targetClosed ? 'restaurant_closed_temporarily' : 'restaurant_reopened',
      'restaurant',
      rest.id,
      { updates, targetClosed },
      req.user!.id,
      req.user!.role
    );

    try {
      RealtimeService.emit({
        type: 'RESTAURANT_STATUS_CHANGED',
        restaurant_id: rest.id,
        data: enriched,
        timestamp: new Date().toISOString(),
      });
      RealtimeService.emit({
        type: 'PROFILE_UPDATED',
        restaurant_id: rest.id,
        data: enriched,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      data: enriched,
      message: targetClosed
        ? 'Restaurante cerrado temporalmente (Fuera de servicio)'
        : 'Restaurante abierto para recibir comandas',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /restaurant/profile
router.put('/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const rest = await RestaurantRepository.findById(restaurantId);
    if (!rest) {
      return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
    }

    const {
      name,
      description,
      phone,
      address,
      logo_url,
      banner_url,
      schedule,
      delivery_fee,
      min_order,
      is_open,
      is_temporarily_closed,
      category_tags,
      delivery_time_min,
      delivery_time_max,
      delivery_mode,
      local_driver_name,
      local_driver_phone,
      subscription_plan_id,
    } = req.body;
    const updates: any = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (phone) updates.phone = phone.trim();
    if (address) updates.address = address.trim();
    if (logo_url !== undefined) updates.logo_url = typeof logo_url === 'string' ? logo_url.trim() : logo_url;
    if (banner_url !== undefined) updates.banner_url = typeof banner_url === 'string' ? banner_url.trim() : banner_url;
    // Las tarifas de envío NO las define el restaurante (de momento); sólo Master las define a nivel central
    if (min_order !== undefined) updates.min_order = parseInt(min_order, 10);
    if (schedule !== undefined) updates.schedule = schedule;
    
    if (is_temporarily_closed !== undefined) {
      updates.is_temporarily_closed = Boolean(is_temporarily_closed);
      if (updates.is_temporarily_closed) {
        updates.is_open = false;
      }
    }
    if (is_open !== undefined) {
      updates.is_open = Boolean(is_open);
      if (updates.is_open) {
        updates.is_temporarily_closed = false;
      }
    }

    if (Array.isArray(category_tags)) updates.category_tags = category_tags;
    if (delivery_time_min !== undefined) updates.delivery_time_min = parseInt(delivery_time_min, 10);
    if (delivery_time_max !== undefined) updates.delivery_time_max = parseInt(delivery_time_max, 10);

    // Modalidad de Entrega + Reglas Financieras (Conductor Local Propio vs Red de Plataforma)
    if (delivery_mode !== undefined) {
      updates.delivery_mode = delivery_mode === 'local_driver' ? 'local_driver' : 'platform_fleet';
      if (updates.delivery_mode === 'local_driver') {
        updates.subscription_plan_id = 'plan_dir_conductor_local';
      }
    }
    if (local_driver_name !== undefined) updates.local_driver_name = typeof local_driver_name === 'string' ? local_driver_name.trim() : local_driver_name;
    if (local_driver_phone !== undefined) updates.local_driver_phone = typeof local_driver_phone === 'string' ? local_driver_phone.trim() : local_driver_phone;
    if (subscription_plan_id !== undefined) updates.subscription_plan_id = subscription_plan_id;

    const updated = await RestaurantRepository.update(rest.id, updates);
    const enriched = updated ? enrichRestaurant(updated) : null;

    const auditUpdates = { ...updates };
    if (auditUpdates.logo_url && auditUpdates.logo_url.startsWith('data:')) {
      auditUpdates.logo_url = `[data:image;size=${auditUpdates.logo_url.length}]`;
    }
    if (auditUpdates.banner_url && auditUpdates.banner_url.startsWith('data:')) {
      auditUpdates.banner_url = `[data:image;size=${auditUpdates.banner_url.length}]`;
    }

    await AuditService.log(
      'profile_updated',
      'restaurant',
      rest.id,
      { updates: auditUpdates },
      req.user!.id,
      req.user!.role
    );

    try {
      RealtimeService.emit({
        type: 'PROFILE_UPDATED',
        restaurant_id: rest.id,
        data: enriched,
        timestamp: new Date().toISOString(),
      });
      RealtimeService.emit({
        type: 'RESTAURANT_STATUS_CHANGED',
        restaurant_id: rest.id,
        data: enriched,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
});

// GET /restaurant/crm/notes
router.get('/crm/notes', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const col = dbClient.getDb().collection('restaurant_crm_notes');
    const notesDocs = await col.find({ restaurant_id: restaurantId }).toArray();
    const notesMap: Record<string, string> = {};
    for (const doc of notesDocs) {
      if (doc.customer_id && doc.notes) {
        notesMap[doc.customer_id] = doc.notes;
      }
    }
    res.json({ success: true, data: notesMap });
  } catch (err) {
    next(err);
  }
});

// POST /restaurant/crm/notes
router.post('/crm/notes', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const restaurantId = await getAuthorizedRestaurantId(req);
    const { customer_id, notes } = req.body;
    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'customer_id es requerido' });
    }
    const col = dbClient.getDb().collection('restaurant_crm_notes');
    await col.updateOne(
      { restaurant_id: restaurantId, customer_id },
      {
        $set: {
          restaurant_id: restaurantId,
          customer_id,
          notes: notes || '',
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
    res.json({ success: true, message: 'Nota de CRM guardada exitosamente' });
  } catch (err) {
    next(err);
  }
});

export default router;
