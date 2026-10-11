import crypto from 'crypto';
import { config } from '../config/index.ts';
import { dbClient } from '../db/connection.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { ProductRepository } from '../repositories/productRepository.ts';
import { AddressRepository } from '../repositories/addressRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import type {
  Order,
  OrderItem,
  OrderItemToppingSelection,
  OrderItemVariantSelection,
  OrderStatus,
  RealtimeEventType,
} from '../models/types.ts';
import type { CreateOrderDto } from '../schemas/validation.ts';
import { AuditService } from './auditService.ts';
import { DriverService } from './driverService.ts';
import { RealtimeService } from './realtimeService.ts';
import { FinancialConfigService } from './financialConfigService.ts';

export class OrderService {
  // State machine transition rules: current -> allowed targets
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['assigned', 'delivering', 'delivered', 'cancelled'],
    assigned: ['picked_up', 'cancelled'],
    picked_up: ['delivering', 'cancelled'],
    delivering: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };

  public static async createOrder(
    customerId: string,
    dto: CreateOrderDto
  ): Promise<{ order: Order; isDuplicate: boolean }> {
    // 1. Quick check for idempotency key if already stored
    if (dto.idempotency_key) {
      const existing = await OrderRepository.findByIdempotencyKey(customerId, dto.idempotency_key);
      if (existing) {
        return { order: existing, isDuplicate: true };
      }
    }

    // 2. Validate Customer
    const customer = await UserRepository.findById(customerId);
    if (!customer) {
      throw new Error('Usuario cliente no encontrado');
    }
    if (!customer.is_active) {
      throw new Error('El usuario se encuentra inactivo');
    }

    // 3. Validate Restaurant
    const restaurant = await RestaurantRepository.findById(dto.restaurant_id);
    if (!restaurant) {
      throw new Error(`Restaurante '${dto.restaurant_id}' no encontrado`);
    }
    if (!restaurant.is_active) {
      throw new Error(`El restaurante '${restaurant.name}' no está disponible actualmente`);
    }

    // 4. Validate Delivery Address if order_type === 'delivery'
    let resolvedDeliveryAddress = dto.delivery_address || '';
    if (dto.order_type === 'delivery') {
      if (dto.address_id) {
        const address = await AddressRepository.findById(dto.address_id);
        if (!address || address.user_id !== customerId) {
          throw new Error('La dirección seleccionada no pertenece al cliente o no existe');
        }
        resolvedDeliveryAddress = `${address.street} #${address.number}, ${address.colony}, ${address.city}`;
      }
      if (!resolvedDeliveryAddress) {
        const userAddresses = await AddressRepository.findByUserId(customerId);
        const defaultAddr = userAddresses.find((a) => a.is_default) || userAddresses[0];
        if (defaultAddr) {
          resolvedDeliveryAddress = `${defaultAddr.street} #${defaultAddr.number}, ${defaultAddr.colony}, ${defaultAddr.city}`;
        } else {
          throw new Error('Se requiere una dirección de entrega válida para pedidos a domicilio');
        }
      }
    }

    // 5. Core Sovereign Product, Variant and Topping Validation & Pricing
    const validatedItems: OrderItem[] = [];
    let subtotalCents = 0;
    let extrasTotalCents = 0;

    for (const itemInput of dto.items) {
      const product = await ProductRepository.findById(itemInput.product_id);
      if (!product) {
        throw new Error(`El producto con ID '${itemInput.product_id}' no existe en el catálogo`);
      }
      if (product.restaurant_id !== restaurant.id) {
        throw new Error(`El producto '${product.name}' no pertenece a ${restaurant.name}`);
      }
      if (!product.is_available) {
        throw new Error(`El producto '${product.name}' está agotado o no disponible`);
      }

      // Validate variant selections strictly
      const itemVariants: OrderItemVariantSelection[] = [];
      const selectedByGroup: Record<string, string[]> = {};

      if (itemInput.variants && Array.isArray(itemInput.variants)) {
        for (const vInput of itemInput.variants) {
          const group = product.variants.find((g) => g.id === vInput.group_id);
          if (!group) {
            throw new Error(
              `El grupo de variantes '${vInput.group_id}' no existe o no es compatible con '${product.name}'`
            );
          }
          const option = group.options.find((o) => o.id === vInput.option_id);
          if (!option) {
            throw new Error(
              `La opción de variante '${vInput.option_id}' no es válida para el grupo '${group.name}' en '${product.name}'`
            );
          }

          if (!selectedByGroup[group.id]) selectedByGroup[group.id] = [];
          selectedByGroup[group.id].push(option.id);

          itemVariants.push({
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price_delta: option.price_delta,
          });
          extrasTotalCents += option.price_delta * itemInput.quantity;
        }
      }

      // Check group rules: required, min_selections, max_selections
      for (const group of product.variants) {
        const count = (selectedByGroup[group.id] || []).length;
        if (group.required && count === 0) {
          throw new Error(`Debes seleccionar una opción requerida para '${group.name}' en '${product.name}'`);
        }
        if (group.min_selections > 0 && count < group.min_selections) {
          throw new Error(
            `Debes seleccionar al menos ${group.min_selections} opción(es) para '${group.name}' en '${product.name}'`
          );
        }
        if (group.max_selections > 0 && count > group.max_selections) {
          throw new Error(
            `No puedes seleccionar más de ${group.max_selections} opción(es) para '${group.name}' en '${product.name}'`
          );
        }
      }

      // Validate toppings strictly
      const itemToppings: OrderItemToppingSelection[] = [];
      if (itemInput.toppings && Array.isArray(itemInput.toppings)) {
        for (const topId of itemInput.toppings) {
          const topping = product.toppings.find((t) => t.id === topId);
          if (!topping) {
            throw new Error(`El complemento o topping '${topId}' no es compatible con '${product.name}'`);
          }
          if (!topping.is_available) {
            throw new Error(`El complemento '${topping.name}' no está disponible actualmente en '${product.name}'`);
          }

          itemToppings.push({
            id: topping.id,
            name: topping.name,
            price: topping.price,
          });
          extrasTotalCents += topping.price * itemInput.quantity;
        }
      }

      const variantExtraPerUnit = itemVariants.reduce((sum, v) => sum + v.price_delta, 0);
      const toppingsExtraPerUnit = itemToppings.reduce((sum, t) => sum + t.price, 0);
      const unitTotal = product.price + variantExtraPerUnit + toppingsExtraPerUnit;
      const lineSubtotal = unitTotal * itemInput.quantity;

      subtotalCents += lineSubtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: itemInput.quantity,
        variants: itemVariants,
        toppings: itemToppings,
        notes: itemInput.notes,
        subtotal: lineSubtotal,
      });
    }

    // 6. Authoritative Financial Rates & Sovereign Totals
    // Las tarifas de envío NO las define el restaurante (de momento); se rigen centralmente por la plataforma (Master)
    const finConfig = await FinancialConfigService.getConfig();
    const deliveryFeeCents =
      dto.order_type === 'pickup'
        ? 0
        : (finConfig.default_delivery_fee_cents || config.defaultDeliveryFeeCents);
    // El cliente NO tiene tarifa de servicio (sólo paga el producto, el envío y la propina sugerida)
    const serviceFeeCents = 0;
    const tipAmountCents = dto.tip_amount || 0;
    const discountAmountCents = 0; // Backend is sole authority

    // La comisión de venta Directaurante NO la paga el cliente, la paga el restaurante (deducida de su liquidación neta)
    // y sólo es modificable por Master
    const restaurantCommissionCents = finConfig.is_commission_active
      ? finConfig.restaurant_commission_cents
      : 0;
    const isLocalDriverMode =
      (restaurant as any).delivery_mode === 'local_driver' ||
      restaurant.subscription_plan_id === 'plan_dir_conductor_local';

    const driverPaymentCents =
      dto.order_type === 'delivery' && !isLocalDriverMode
        ? finConfig.driver_payment_cents
        : 0;

    const totalCents = subtotalCents + deliveryFeeCents + serviceFeeCents + tipAmountCents - discountAmountCents;

    // Check minimum order amount if delivery
    if (dto.order_type === 'delivery' && restaurant.min_order > 0 && subtotalCents < restaurant.min_order) {
      const minPesos = (restaurant.min_order / 100).toFixed(2);
      throw new Error(`El pedido no alcanza el monto mínimo de entrega de $${minPesos} MXN`);
    }

    const orderId = `ord_${crypto.randomUUID()}`;
    const idempotencyKey = dto.idempotency_key || `idemp_${crypto.randomUUID()}`;

    // Atomic concurrent-safe unique folio generation (e.g. D101, D102...)
    let folio = 'D101';
    try {
      const counterDoc = await dbClient.getCountersCollection().findOneAndUpdate(
        { _id: 'order_folio' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      if (counterDoc && typeof counterDoc.seq === 'number') {
        const seqVal = counterDoc.seq < 101 ? counterDoc.seq + 100 : counterDoc.seq;
        folio = `D${seqVal}`;
      }
    } catch {
      const count = await dbClient.getOrdersCollection().countDocuments();
      folio = `D${101 + count}`;
    }

    const newOrder: Order = {
      id: orderId,
      folio: folio,
      order_id: orderId,
      order_code: folio,
      idempotency_key: idempotencyKey,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: dto.customer_phone || customer.phone,
      order_type: dto.order_type,
      address_id: dto.address_id || null,
      delivery_address: resolvedDeliveryAddress,
      items: validatedItems,
      subtotal: subtotalCents,
      extras_total: extrasTotalCents,
      delivery_fee: deliveryFeeCents,
      service_fee: serviceFeeCents,
      tip_amount: tipAmountCents,
      discount_amount: discountAmountCents,
      restaurant_commission: restaurantCommissionCents,
      driver_payment: driverPaymentCents,
      total: totalCents,
      currency: config.defaultCurrency,
      payment_method: dto.payment_method,
      payment_status: 'pending',
      status: 'pending',
      has_allergies: Boolean(dto.has_allergies),
      allergies: dto.allergies,
      notes: dto.notes,
      promo_code: dto.promo_code,
      status_history: [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          actor_id: customer.id,
          actor_role: 'customer',
          notes: 'Pedido recibido por Directaurante',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 7. Atomic Insert into MongoDB with Unique Idempotency Index Handling
    const insertResult = await OrderRepository.insertOrderAtomic(newOrder);

    if (insertResult.isDuplicate) {
      return insertResult;
    }

    await AuditService.log(
      'order.created',
      'order',
      newOrder.id,
      {
        total: newOrder.total,
        restaurant_id: newOrder.restaurant_id,
        items_count: newOrder.items.length,
        idempotency_key: newOrder.idempotency_key,
      },
      customer.id,
      'customer'
    );

    // Emit real-time event
    try {
      RealtimeService.emit({
        type: 'ORDER_CREATED',
        order_id: newOrder.id,
        folio: newOrder.folio,
        restaurant_id: newOrder.restaurant_id,
        customer_id: newOrder.customer_id,
        data: newOrder,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    return insertResult;
  }

  public static async getOrderById(orderId: string, actor: { id: string; role: string }): Promise<Order | null> {
    const order = await OrderRepository.findById(orderId);
    if (!order) return null;

    // RBAC & Ownership check
    await this.assertCanViewOrder(order, actor);

    return order;
  }

  public static async listCustomerOrders(customerId: string): Promise<Order[]> {
    return OrderRepository.findByCustomerId(customerId);
  }

  public static async listRestaurantOrders(restaurantId: string, actor: { id: string; role: string }): Promise<Order[]> {
    // Restaurant role must own the restaurant, or actor is master
    if (actor.role === 'restaurant') {
      const rest = await RestaurantRepository.findByOwnerId(actor.id);
      if (!rest || rest.id !== restaurantId) {
        throw new Error('Acceso denegado: no tienes permiso para consultar pedidos de este restaurante');
      }
    } else if (actor.role !== 'master') {
      throw new Error('Acceso denegado: permiso insuficiente para ver pedidos de restaurante');
    }

    return OrderRepository.findByRestaurantId(restaurantId);
  }

  /**
   * Validates state transition, RBAC and resource ownership.
   */
  public static async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    actor: { id: string; role: string; notes?: string }
  ): Promise<Order> {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Pedido '${orderId}' no encontrado`);
    }

    // 1. Validate State Transition in State Machine
    const validNextStates = this.VALID_TRANSITIONS[order.status] || [];
    if (!validNextStates.includes(newStatus)) {
      throw new Error(
        `Transición de estado inválida: no se puede pasar de '${order.status}' a '${newStatus}'. Estados permitidos: [${validNextStates.join(', ')}]`
      );
    }

    // 2. Validate Role & Ownership Authorization for the transition
    await this.assertCanTransitionStatus(order, newStatus, actor);

    // Mini inventory rule: Deduct stock when restaurant accepts the order ('confirmed')
    // Idempotent: Only deduct once
    let newInventoryDeducted = order.inventory_deducted;
    if (newStatus === 'confirmed' && !order.inventory_deducted) {
      for (const item of order.items) {
        const decResult = await ProductRepository.decrementStockAtomic(item.product_id, item.quantity);
        if (!decResult.success) {
          throw new Error(
            `Stock insuficiente para el producto '${item.product_name}'. Disponible: ${decResult.currentStock ?? 0}, Requerido: ${item.quantity}`
          );
        }
        if (decResult.currentStock !== null && decResult.currentStock !== undefined) {
          try {
            RealtimeService.emit({
              type: 'INVENTORY_UPDATED',
              restaurant_id: order.restaurant_id,
              data: { product_id: item.product_id, new_stock: decResult.currentStock },
              timestamp: new Date().toISOString(),
            });
          } catch {
            // non-fatal
          }
        }
      }
      newInventoryDeducted = true;
    } else if (newStatus === 'cancelled' && order.inventory_deducted) {
      for (const item of order.items) {
        await ProductRepository.incrementStockAtomic(item.product_id, item.quantity);
      }
      newInventoryDeducted = false;
    }

    const historyItem = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      actor_id: actor.id,
      actor_role: actor.role,
      notes: actor.notes || `Estado actualizado a ${newStatus}`,
    };

    const updated = await OrderRepository.update(orderId, {
      status: newStatus,
      inventory_deducted: newInventoryDeducted,
      status_history: [...order.status_history, historyItem],
    });

    if (!updated) {
      throw new Error('Error al actualizar el estado del pedido');
    }

    // 3. Persistent Audit Log
    const auditEvent =
      newStatus === 'confirmed'
        ? 'order.confirmed'
        : newStatus === 'cancelled'
        ? 'order.cancelled'
        : `order.status_${newStatus}`;

    await AuditService.log(
      auditEvent,
      'order',
      orderId,
      {
        previous_status: order.status,
        new_status: newStatus,
        inventory_deducted: newInventoryDeducted,
        notes: actor.notes,
      },
      actor.id,
      actor.role
    );

    // Emit Real-Time Status Event
    try {
      const eventTypeMap: Record<OrderStatus, RealtimeEventType> = {
        pending: 'ORDER_CREATED',
        confirmed: 'ORDER_ACCEPTED',
        preparing: 'ORDER_PREPARING',
        ready: 'ORDER_READY',
        assigned: 'DRIVER_ASSIGNED',
        picked_up: 'ORDER_ON_THE_WAY',
        delivering: 'ORDER_ON_THE_WAY',
        delivered: 'ORDER_DELIVERED',
        cancelled: 'ORDER_CANCELLED',
      };

      const eventType = eventTypeMap[newStatus];
      if (eventType) {
        RealtimeService.emit({
          type: eventType,
          order_id: updated.id,
          folio: updated.folio,
          restaurant_id: updated.restaurant_id,
          customer_id: updated.customer_id,
          driver_id: updated.driver_id || undefined,
          data: updated,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // non-fatal
    }

    // Automatic Driver Dispatch for Delivery orders when status reaches 'ready'
    if (newStatus === 'ready' && order.order_type === 'delivery') {
      const rest = await RestaurantRepository.findById(order.restaurant_id);
      const isLocal = (rest as any)?.delivery_mode === 'local_driver' || rest?.subscription_plan_id === 'plan_dir_conductor_local';
      if (!isLocal) {
        try {
          await DriverService.dispatchOrder(orderId);
        } catch (dispatchErr: any) {
          console.warn(`[DriverService] Dispatch automático para pedido ${orderId}: ${dispatchErr.message}`);
        }
      } else {
        // Modalidad Conductor Local: despacho gestionado internamente por el restaurante
        try {
          const localDriverName = (rest as any)?.local_driver_name || `${rest?.name || 'Restaurante'} (Conductor Local)`;
          await OrderRepository.update(orderId, {
            driver_name: localDriverName,
          });
        } catch {
          // non-fatal
        }
      }
    }

    return updated;
  }

  public static async transitionOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    actor: { id: string; role: string; notes?: string }
  ): Promise<Order> {
    return this.updateOrderStatus(orderId, newStatus, actor);
  }

  // --- Ownership and RBAC Check Helpers ---

  public static async assertCanViewOrder(order: Order, actor: { id: string; role: string }): Promise<void> {
    if (actor.role === 'master') return;

    if (actor.role === 'customer') {
      if (order.customer_id !== actor.id) {
        const error: any = new Error('Acceso denegado: no puedes ver pedidos pertenecientes a otro usuario');
        error.statusCode = 403;
        throw error;
      }
      return;
    }

    if (actor.role === 'restaurant') {
      const rest = await RestaurantRepository.findByOwnerId(actor.id);
      if (!rest || rest.id !== order.restaurant_id) {
        const error: any = new Error('Acceso denegado: no tienes permiso para consultar pedidos de este restaurante');
        error.statusCode = 403;
        throw error;
      }
      return;
    }

    if (actor.role === 'driver') {
      if (!order.driver_id || order.driver_id !== actor.id) {
        const error: any = new Error('Acceso denegado: este pedido no está asignado a tu conductor');
        error.statusCode = 403;
        throw error;
      }
      return;
    }

    const error: any = new Error('Acceso denegado: rol desconocido o sin permisos para consultar este pedido');
    error.statusCode = 403;
    throw error;
  }

  private static async assertCanTransitionStatus(
    order: Order,
    newStatus: OrderStatus,
    actor: { id: string; role: string }
  ): Promise<void> {
    if (actor.role === 'master') return;

    if (actor.role === 'customer') {
      // Customer can ONLY cancel, and ONLY while order is still pending
      if (newStatus !== 'cancelled') {
        const err: any = new Error('Acceso denegado: clientes solo pueden cancelar pedidos');
        err.statusCode = 403;
        throw err;
      }
      if (order.customer_id !== actor.id) {
        const err: any = new Error('Acceso denegado: no puedes cancelar pedidos de otro usuario');
        err.statusCode = 403;
        throw err;
      }
      if (order.status !== 'pending') {
        throw new Error('El pedido ya fue confirmado por la cocina y no puede ser cancelado por el cliente');
      }
      return;
    }

    if (actor.role === 'restaurant') {
      // Verify restaurant ownership
      const rest = await RestaurantRepository.findByOwnerId(actor.id);
      if (!rest || rest.id !== order.restaurant_id) {
        const err: any = new Error('Acceso denegado: no eres el propietario de este restaurante');
        err.statusCode = 403;
        throw err;
      }

      // Allowed transitions for restaurant: confirmed, preparing, ready, cancelled.
      // PLUS: if pickup or local_driver (repartidor propio), restaurant can advance to delivering & delivered!
      const isLocalOrPickup =
        order.order_type === 'pickup' ||
        (rest as any)?.delivery_mode === 'local_driver' ||
        rest?.subscription_plan_id === 'plan_dir_conductor_local';

      const restaurantAllowed: OrderStatus[] = isLocalOrPickup
        ? ['confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']
        : ['confirmed', 'preparing', 'ready', 'cancelled'];

      if (!restaurantAllowed.includes(newStatus)) {
        const err: any = new Error(`Acceso denegado: el rol restaurant no puede marcar el pedido como '${newStatus}'`);
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    if (actor.role === 'driver') {
      // Allowed transitions for driver: assigned, picked_up, delivering, delivered
      const driverAllowed: OrderStatus[] = ['assigned', 'picked_up', 'delivering', 'delivered'];
      if (!driverAllowed.includes(newStatus)) {
        const err: any = new Error(`Acceso denegado: conductores no pueden cambiar a '${newStatus}'`);
        err.statusCode = 403;
        throw err;
      }

      if (newStatus !== 'assigned' && (order as any).driver_id && (order as any).driver_id !== actor.id) {
        const err: any = new Error('Acceso denegado: este pedido está asignado a otro conductor');
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    const err: any = new Error('Acceso denegado: rol desconocido o sin permisos');
    err.statusCode = 403;
    throw err;
  }
}
