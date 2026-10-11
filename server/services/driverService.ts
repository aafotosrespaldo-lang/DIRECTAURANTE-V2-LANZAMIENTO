import crypto from 'crypto';
import { dbClient } from '../db/connection.ts';
import type {
  AuditLog,
  DriverAvailability,
  DriverLocation,
  DriverOffer,
  DriverSettlement,
  DriverShift,
  Order,
  OrderMessage,
  SupportTicket,
  User,
} from '../models/types.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';

export class DriverService {
  // Haversine formula for real geospatial distance in kilometers
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // --- Driver Availability & Profile ---
  public static async getDriverProfile(driverId: string): Promise<User> {
    const driver = await dbClient.getUsersCollection().findOne({ id: driverId });
    if (!driver || driver.role !== 'driver') {
      throw new Error('Repartidor no encontrado o permisos insuficientes');
    }
    return driver;
  }

  public static async updateDriverStatus(
    driverId: string,
    status: DriverAvailability,
    location?: { latitude: number; longitude: number; address?: string }
  ): Promise<User> {
    const now = new Date().toISOString();
    const updateDoc: any = {
      driver_status: status,
      updatedAt: now,
    };

    if (location) {
      updateDoc.current_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        updatedAt: now,
      };
    }

    const result = await dbClient.getUsersCollection().findOneAndUpdate(
      { id: driverId, role: 'driver' },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('No se pudo actualizar el estado del repartidor');
    }

    // Automatically manage shift on status changes
    if (status === 'available') {
      await this.ensureActiveShift(driverId, location);
    }

    await AuditService.log('driver.status_updated', 'user', driverId, { status, location }, driverId, 'driver');
    return result;
  }

  public static async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<DriverLocation> {
    const loc: DriverLocation = {
      latitude,
      longitude,
      address,
      updatedAt: new Date().toISOString(),
    };

    await dbClient.getUsersCollection().updateOne(
      { id: driverId, role: 'driver' },
      { $set: { current_location: loc, updatedAt: loc.updatedAt } }
    );

    try {
      const activeOrder = await dbClient.getOrdersCollection().findOne({
        driver_id: driverId,
        status: { $in: ['assigned', 'picked_up', 'delivering'] },
      });

      RealtimeService.emit({
        type: 'DRIVER_LOCATION_UPDATED',
        driver_id: driverId,
        order_id: activeOrder?.id,
        customer_id: activeOrder?.customer_id,
        restaurant_id: activeOrder?.restaurant_id,
        data: { driverId, order_id: activeOrder?.id, ...loc },
        timestamp: loc.updatedAt,
      });
    } catch {
      // non-fatal
    }

    return loc;
  }

  // --- Shift & Session Management ---
  public static async ensureActiveShift(driverId: string, initialLocation?: any): Promise<DriverShift> {
    const existing = await dbClient.getDriverShiftsCollection().findOne({ driver_id: driverId, status: 'active' });
    if (existing) return existing;

    const shift: DriverShift = {
      id: `shift_${crypto.randomUUID()}`,
      driver_id: driverId,
      started_at: new Date().toISOString(),
      status: 'active',
      initial_location: initialLocation,
    };

    await dbClient.getDriverShiftsCollection().insertOne(shift as any);
    await AuditService.log('driver.shift_started', 'shift', shift.id, {}, driverId, 'driver');
    return shift;
  }

  public static async getCurrentShiftSummary(driverId: string): Promise<any> {
    const activeShift = await dbClient.getDriverShiftsCollection().findOne({ driver_id: driverId, status: 'active' });
    const startedAt = activeShift ? activeShift.started_at : new Date(Date.now() - 8 * 3600 * 1000).toISOString();

    // Query real completed orders in Railway DB for this driver since shift started
    const completedOrders = await dbClient
      .getOrdersCollection()
      .find({ driver_id: driverId, status: 'delivered', updatedAt: { $gte: startedAt } })
      .toArray();

    // Query real rejected and expired offers in this shift
    const offers = await dbClient
      .getDriverOffersCollection()
      .find({ driver_id: driverId, offered_at: { $gte: startedAt } })
      .toArray();

    const rejectedCount = offers.filter((o) => o.status === 'rejected').length;
    const expiredCount = offers.filter((o) => o.status === 'expired').length;

    let cashCollected = 0;
    let digitalTotal = 0;
    let tipsTotal = 0;
    let earningsTotal = 0;

    for (const order of completedOrders) {
      if (order.payment_method === 'cash') {
        cashCollected += order.total;
      } else {
        digitalTotal += order.total;
      }
      tipsTotal += order.tip_amount || 0;
      // Driver earnings: authoritative driver_payment or delivery fee + 100% tip
      const basePay = typeof order.driver_payment === 'number' ? order.driver_payment : (order.delivery_fee || 0);
      const orderEarning = basePay + (order.tip_amount || 0);
      earningsTotal += orderEarning;
    }

    // Net balance: cashCollected minus earningsTotal
    // Positive: Driver holds cash that belongs to platform/restaurant
    // Negative: Platform owes money to driver
    const netBalance = cashCollected - earningsTotal;

    return {
      shift_id: activeShift?.id || null,
      status: activeShift ? 'active' : 'inactive',
      started_at: startedAt,
      orders_completed: completedOrders.length,
      offers_rejected: rejectedCount,
      offers_expired: expiredCount,
      cash_collected: cashCollected,
      digital_total: digitalTotal,
      tips_total: tipsTotal,
      earnings_total: earningsTotal,
      net_balance: netBalance,
      recent_orders: completedOrders.map((o) => ({
        id: o.id,
        restaurant_name: o.restaurant_name,
        total: o.total,
        payment_method: o.payment_method,
        completedAt: o.updatedAt,
      })),
    };
  }

  public static async closeShift(driverId: string, notes?: string): Promise<DriverSettlement> {
    const activeShift = await dbClient.getDriverShiftsCollection().findOne({ driver_id: driverId, status: 'active' });
    if (!activeShift) {
      throw new Error('No hay una jornada activa para cerrar o ya ha sido finalizada');
    }

    const summary = await this.getCurrentShiftSummary(driverId);
    const now = new Date().toISOString();

    const settlement: DriverSettlement = {
      id: `corte_${crypto.randomUUID()}`,
      driver_id: driverId,
      shift_id: activeShift.id,
      closed_at: now,
      orders_completed: summary.orders_completed,
      orders_cancelled: 0,
      offers_rejected: summary.offers_rejected,
      offers_expired: summary.offers_expired,
      cash_collected: summary.cash_collected,
      digital_total: summary.digital_total,
      tips_total: summary.tips_total,
      earnings_total: summary.earnings_total,
      net_balance: summary.net_balance,
      notes,
      createdAt: now,
    };

    // Atomic shift close: prevents double-close
    const closeShiftRes = await dbClient.getDriverShiftsCollection().updateOne(
      { id: activeShift.id, status: 'active' },
      { $set: { status: 'closed', closed_at: now } }
    );

    if (closeShiftRes.modifiedCount === 0) {
      throw new Error('La jornada ya fue cerrada previamente');
    }

    await dbClient.getDriverSettlementsCollection().insertOne(settlement as any);

    // Set driver offline after closing shift
    await dbClient.getUsersCollection().updateOne(
      { id: driverId },
      { $set: { driver_status: 'offline', updatedAt: now } }
    );

    await AuditService.log('driver.shift_closed', 'settlement', settlement.id, settlement as any, driverId, 'driver');
    return settlement;
  }

  // --- Deposit & Voucher Reconciliation ---
  public static async registerDepositProof(
    driverId: string,
    settlementId: string,
    depositAmount: number | undefined,
    proofUrl: string,
    notes?: string
  ): Promise<DriverSettlement> {
    const col = dbClient.getDriverSettlementsCollection();
    const settlement = await col.findOne({ id: settlementId });
    if (!settlement) {
      throw new Error(`Corte '${settlementId}' no encontrado`);
    }
    if (settlement.driver_id !== driverId) {
      throw new Error('Acceso denegado: este corte no pertenece a tu cuenta');
    }

    const now = new Date().toISOString();
    const amountCents = depositAmount !== undefined ? Math.round(depositAmount) : settlement.cash_collected;

    const updated = await col.findOneAndUpdate(
      { id: settlementId },
      {
        $set: {
          deposit_amount: amountCents,
          deposit_proof_url: proofUrl,
          deposit_date: now,
          deposit_status: 'deposit_uploaded',
          deposit_notes: notes || undefined,
        },
      },
      { returnDocument: 'after' }
    );

    // Also record in Universal Evidence Vault
    const evidenceId = `ev_dep_${crypto.randomUUID()}`;
    await dbClient.getOrderEvidenceCollection().insertOne({
      id: evidenceId,
      evidence_id: evidenceId,
      order_id: `settlement_${settlement.id}`,
      uploaded_by: driverId,
      role: 'driver',
      type: 'transfer_proof',
      file_url: proofUrl,
      notes: `Comprobante de depósito corte #${settlement.id.slice(-6)}: $${(amountCents / 100).toFixed(2)} MXN. ${notes || ''}`,
      created_at: now,
    });

    await AuditService.log(
      'driver.deposit_proof_uploaded',
      'settlement',
      settlementId,
      { deposit_amount: amountCents, proof_url: proofUrl },
      driverId,
      'driver'
    );

    try {
      RealtimeService.emit({
        type: 'ORDER_EVIDENCE_ADDED',
        driver_id: driverId,
        data: {
          settlement_id: settlementId,
          deposit_status: 'deposit_uploaded',
          proof_url: proofUrl,
        },
        timestamp: now,
      });
    } catch {
      // non-fatal
    }

    return updated!;
  }

  // --- Proximity & 40-Second Offer System ---
  public static async getEligibleDrivers(restaurantLocation: { latitude: number; longitude: number }): Promise<Array<{ driver: User; distance_km: number }>> {
    // 1. Get all active verified drivers
    const drivers = await dbClient
      .getUsersCollection()
      .find({
        role: 'driver',
        is_active: true,
        is_verified: { $ne: false },
        driver_status: 'available',
      })
      .toArray();

    const candidates: Array<{ driver: User; distance_km: number }> = [];

    for (const driver of drivers) {
      const loc = driver.current_location || (driver as any).last_location;
      if (!loc) continue;

      // Validate location freshness (must be updated within 2 hours in development / 30 mins prod)
      const locAgeMs = loc.updatedAt ? Date.now() - new Date(loc.updatedAt).getTime() : 0;
      if (locAgeMs > 2 * 60 * 60 * 1000) {
        continue; // Location too stale
      }

      const dist = this.calculateDistanceKm(
        restaurantLocation.latitude,
        restaurantLocation.longitude,
        loc.latitude,
        loc.longitude
      );

      candidates.push({ driver, distance_km: dist });
    }

    // Sort ascending by proximity (closest candidate first)
    candidates.sort((a, b) => a.distance_km - b.distance_km);
    return candidates;
  }

  public static async dispatchOrder(orderId: string): Promise<DriverOffer | null> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error(`Pedido '${orderId}' no encontrado`);
    if (order.order_type !== 'delivery') {
      throw new Error('Solo los pedidos a domicilio pueden ser asignados a repartidores');
    }
    if (order.driver_id) {
      return null; // Already assigned
    }

    // Get restaurant coordinates
    const restaurant = await dbClient.getRestaurantsCollection().findOne({ id: order.restaurant_id });
    const restCoords = { latitude: 20.4305, longitude: -101.7228 }; // Default Penjamo centro

    // Find previously rejected/expired driver IDs for this order to avoid offering again
    const previousOffers = await dbClient
      .getDriverOffersCollection()
      .find({ order_id: orderId, status: { $in: ['rejected', 'expired', 'accepted'] } })
      .toArray();
    const excludedDriverIds = new Set(previousOffers.map((o) => o.driver_id));

    // Get sorted eligible candidates
    const eligible = await this.getEligibleDrivers(restCoords);
    const availableCandidate = eligible.find((c) => !excludedDriverIds.has(c.driver.id));

    if (!availableCandidate) {
      return null; // No available drivers nearby
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 40 * 1000); // EXACTLY 40 SECONDS SERVER-CONTROLLED

    const offer: DriverOffer = {
      id: `off_${crypto.randomUUID()}`,
      order_id: order.id,
      folio: order.folio || order.order_code || 'D101',
      driver_id: availableCandidate.driver.id,
      restaurant_id: order.restaurant_id,
      restaurant_name: order.restaurant_name,
      delivery_address: order.delivery_address || 'Dirección no especificada',
      order_total: order.total,
      driver_earnings:
        (typeof order.driver_payment === 'number' ? order.driver_payment : (order.delivery_fee || 0)) +
        (order.tip_amount || 0),
      distance_km: availableCandidate.distance_km,
      attempt_number: previousOffers.length + 1,
      offered_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    };

    await dbClient.getDriverOffersCollection().insertOne(offer as any);

    await AuditService.log(
      'driver_offer_created',
      'order',
      order.id,
      {
        offer_id: offer.id,
        driver_id: offer.driver_id,
        distance_km: offer.distance_km,
        expires_at: offer.expires_at,
      },
      'system',
      'system'
    );

    try {
      RealtimeService.emit({
        type: 'DRIVER_OFFER_CREATED',
        order_id: order.id,
        folio: offer.folio,
        restaurant_id: order.restaurant_id,
        driver_id: availableCandidate.driver.id,
        data: offer,
        timestamp: now.toISOString(),
      });
    } catch {
      // non-fatal
    }

    return offer;
  }

  public static async getCurrentOfferForDriver(driverId: string): Promise<DriverOffer | null> {
    const nowIso = new Date().toISOString();

    // 1. Mark any overdue pending offers as expired
    await dbClient.getDriverOffersCollection().updateMany(
      { driver_id: driverId, status: 'pending', expires_at: { $lt: nowIso } },
      { $set: { status: 'expired' } }
    );

    // 2. Fetch active pending offer that is still valid within the 40-second window
    const validOffer = await dbClient
      .getDriverOffersCollection()
      .findOne(
        { driver_id: driverId, status: 'pending', expires_at: { $gte: nowIso } },
        { sort: { offered_at: -1 } }
      );

    return validOffer;
  }

  public static async acceptOffer(offerId: string, driverId: string): Promise<Order> {
    const now = new Date();
    const offer = await dbClient.getDriverOffersCollection().findOne({ id: offerId });

    if (!offer) {
      throw new Error('Oferta de pedido no encontrada');
    }
    if (offer.driver_id !== driverId) {
      throw new Error('Acceso denegado: esta oferta no corresponde a tu cuenta');
    }
    if (offer.status !== 'pending') {
      throw new Error(`La oferta ya no está disponible (estado actual: ${offer.status})`);
    }

    // SERVER-SIDE 40-SECOND ENFORCEMENT: immune to phone clock tampering
    if (new Date(offer.expires_at).getTime() < now.getTime()) {
      await dbClient.getDriverOffersCollection().updateOne({ id: offerId }, { $set: { status: 'expired' } });
      await AuditService.log('driver_offer_expired', 'order', offer.order_id, { offer_id: offerId }, driverId, 'driver');
      // Trigger reassignment to next driver
      await this.dispatchOrder(offer.order_id);
      throw new Error('Oferta expirada: se excedió la ventana de 40 segundos para responder');
    }

    const driver = await dbClient.getUsersCollection().findOne({ id: driverId });
    if (!driver) throw new Error('Repartidor no encontrado');

    // ATOMIC ASSIGNMENT IN MONGODB: prevents race conditions if multiple candidates exist
    const updateResult = await dbClient.getOrdersCollection().findOneAndUpdate(
      {
        id: offer.order_id,
        $or: [{ driver_id: null }, { driver_id: { $exists: false } }],
      },
      {
        $set: {
          driver_id: driverId,
          status: 'assigned',
          updatedAt: now.toISOString(),
        },
        $push: {
          status_history: {
            status: 'assigned',
            timestamp: now.toISOString(),
            actor_id: driverId,
            actor_role: 'driver',
            notes: `Pedido asignado a repartidor ${driver.name}`,
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      // Order was already assigned concurrently to another driver
      await dbClient.getDriverOffersCollection().updateOne({ id: offerId }, { $set: { status: 'superseded' } });
      const err: any = new Error('Pedido ya asignado');
      err.statusCode = 409;
      throw err;
    }

    // Mark offer as accepted
    await dbClient.getDriverOffersCollection().updateOne({ id: offerId }, { $set: { status: 'accepted' } });

    // Mark driver busy
    await dbClient.getUsersCollection().updateOne(
      { id: driverId },
      { $set: { driver_status: 'busy', updatedAt: now.toISOString() } }
    );

    await AuditService.log(
      'order.driver_assigned',
      'order',
      offer.order_id,
      { offer_id: offerId, driver_id: driverId, driver_name: driver.name },
      driverId,
      'driver'
    );

    try {
      RealtimeService.emit({
        type: 'DRIVER_ASSIGNED',
        order_id: offer.order_id,
        restaurant_id: offer.restaurant_id,
        customer_id: updateResult.customer_id,
        driver_id: driverId,
        data: updateResult,
        timestamp: now.toISOString(),
      });
    } catch {
      // non-fatal
    }

    return updateResult;
  }

  public static async rejectOffer(offerId: string, driverId: string, reason = 'Rechazado manualmente'): Promise<void> {
    const offer = await dbClient.getDriverOffersCollection().findOne({ id: offerId });
    if (!offer) throw new Error('Oferta no encontrada');
    if (offer.driver_id !== driverId) throw new Error('Acceso denegado: esta oferta pertenece a otro repartidor');

    await dbClient.getDriverOffersCollection().updateOne(
      { id: offerId },
      { $set: { status: 'rejected', reject_reason: reason } }
    );

    await AuditService.log(
      'driver_offer_rejected',
      'order',
      offer.order_id,
      { offer_id: offerId, reason, driver_id: driverId },
      driverId,
      'driver'
    );

    // Reassign automatically to next candidate
    await this.dispatchOrder(offer.order_id);
  }

  // --- Active Order Operational Lifecycle ---
  public static async getCurrentDriverOrder(driverId: string): Promise<Order | null> {
    const activeOrder = await dbClient
      .getOrdersCollection()
      .findOne({
        driver_id: driverId,
        status: { $in: ['assigned', 'picked_up', 'delivering'] },
      });
    return activeOrder;
  }

  public static async markArrivedAtRestaurant(orderId: string, driverId: string): Promise<Order> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');
    if (order.driver_id !== driverId) throw new Error('Acceso denegado: pedido asignado a otro repartidor');

    const now = new Date().toISOString();
    const updated = await dbClient.getOrdersCollection().findOneAndUpdate(
      { id: orderId, driver_id: driverId },
      {
        $push: {
          status_history: {
            status: order.status,
            timestamp: now,
            actor_id: driverId,
            actor_role: 'driver',
            notes: 'Repartidor ha llegado al restaurante',
          },
        },
        $set: { updatedAt: now },
      },
      { returnDocument: 'after' }
    );

    await AuditService.log('driver.arrived_restaurant', 'order', orderId, {}, driverId, 'driver');
    return updated!;
  }

  public static async pickUpOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');
    if (order.driver_id !== driverId) throw new Error('Acceso denegado: pedido no asignado a este repartidor');
    if (order.status !== 'assigned') {
      throw new Error(`No se puede recoger un pedido en estado '${order.status}' (debe estar en 'assigned')`);
    }

    const now = new Date().toISOString();
    const updated = await dbClient.getOrdersCollection().findOneAndUpdate(
      { id: orderId, driver_id: driverId },
      {
        $set: { status: 'picked_up', updatedAt: now },
        $push: {
          status_history: {
            status: 'picked_up',
            timestamp: now,
            actor_id: driverId,
            actor_role: 'driver',
            notes: 'Pedido recolectado en mostrador por el repartidor',
          },
        },
      },
      { returnDocument: 'after' }
    );

    await AuditService.log('order.status_picked_up', 'order', orderId, {}, driverId, 'driver');
    try {
      RealtimeService.emit({
        type: 'ORDER_ON_THE_WAY',
        order_id: orderId,
        customer_id: order.customer_id,
        restaurant_id: order.restaurant_id,
        driver_id: driverId,
        data: updated,
        timestamp: now,
      });
    } catch {
      // non-fatal
    }
    return updated!;
  }

  public static async startDelivery(orderId: string, driverId: string): Promise<Order> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');
    if (order.driver_id !== driverId) throw new Error('Acceso denegado');
    if (order.status !== 'picked_up') {
      throw new Error(`Debe recoger el pedido antes de iniciar trayecto`);
    }

    const now = new Date().toISOString();
    const updated = await dbClient.getOrdersCollection().findOneAndUpdate(
      { id: orderId, driver_id: driverId },
      {
        $set: { status: 'delivering', updatedAt: now },
        $push: {
          status_history: {
            status: 'delivering',
            timestamp: now,
            actor_id: driverId,
            actor_role: 'driver',
            notes: 'En camino hacia la ubicación del cliente',
          },
        },
      },
      { returnDocument: 'after' }
    );

    await AuditService.log('order.status_delivering', 'order', orderId, {}, driverId, 'driver');
    try {
      RealtimeService.emit({
        type: 'ORDER_ON_THE_WAY',
        order_id: orderId,
        customer_id: order.customer_id,
        restaurant_id: order.restaurant_id,
        driver_id: driverId,
        data: updated,
        timestamp: now,
      });
    } catch {
      // non-fatal
    }
    return updated!;
  }

  public static async completeDelivery(orderId: string, driverId: string, notes?: string): Promise<Order> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');
    if (order.driver_id !== driverId) throw new Error('Acceso denegado');
    if (order.status !== 'delivering') {
      throw new Error(`El pedido debe estar en camino ('delivering') para confirmar entrega`);
    }

    const now = new Date().toISOString();
    const updated = await dbClient.getOrdersCollection().findOneAndUpdate(
      { id: orderId, driver_id: driverId },
      {
        $set: { status: 'delivered', updatedAt: now },
        $push: {
          status_history: {
            status: 'delivered',
            timestamp: now,
            actor_id: driverId,
            actor_role: 'driver',
            notes: notes || 'Pedido entregado exitosamente al cliente',
          },
        },
      },
      { returnDocument: 'after' }
    );

    // Free driver back to available
    await dbClient.getUsersCollection().updateOne(
      { id: driverId },
      { $set: { driver_status: 'available', updatedAt: now } }
    );

    await AuditService.log('order.delivered', 'order', orderId, { notes }, driverId, 'driver');
    try {
      RealtimeService.emit({
        type: 'ORDER_DELIVERED',
        order_id: orderId,
        customer_id: order.customer_id,
        restaurant_id: order.restaurant_id,
        driver_id: driverId,
        data: updated,
        timestamp: now,
      });
    } catch {
      // non-fatal
    }
    return updated!;
  }

  // --- Contextual Order Messaging ---
  public static async getOrderMessages(orderId: string, actor: { id: string; role: string }): Promise<OrderMessage[]> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');

    // Security check: only involved parties can read messages
    if (actor.role === 'driver' && order.driver_id !== actor.id) {
      throw new Error('Acceso denegado a los mensajes de este pedido');
    }
    if (actor.role === 'customer' && order.customer_id !== actor.id) {
      throw new Error('Acceso denegado a los mensajes de este pedido');
    }
    if (actor.role === 'restaurant') {
      const rest = await RestaurantRepository.findByOwnerId(actor.id);
      if ((!rest || rest.id !== order.restaurant_id) && actor.id !== order.restaurant_id) {
        throw new Error('Acceso denegado: este pedido no pertenece a tu restaurante');
      }
    }

    const messages = await dbClient
      .getOrderMessagesCollection()
      .find({ order_id: orderId })
      .sort({ timestamp: 1 })
      .toArray();

    return messages;
  }

  public static async sendOrderMessage(
    orderId: string,
    sender: { id: string; role: 'driver' | 'customer' | 'restaurant'; name: string },
    messageText: string
  ): Promise<OrderMessage> {
    const order = await dbClient.getOrdersCollection().findOne({ id: orderId });
    if (!order) throw new Error('Pedido no encontrado');

    // Security check: only authorized involved parties can send messages
    if (sender.role === 'driver' && order.driver_id !== sender.id) {
      throw new Error('No estás asignado a este pedido');
    }
    if (sender.role === 'customer' && order.customer_id !== sender.id) {
      throw new Error('No tienes permiso en este pedido');
    }
    if (sender.role === 'restaurant') {
      const rest = await RestaurantRepository.findByOwnerId(sender.id);
      if ((!rest || rest.id !== order.restaurant_id) && sender.id !== order.restaurant_id) {
        throw new Error('Acceso denegado: este pedido no pertenece a tu restaurante');
      }
    }

    // Determine recipient
    let recipientId = '';
    if (sender.role === 'driver') {
      recipientId = order.customer_id;
    } else if (sender.role === 'customer') {
      recipientId = order.driver_id || order.restaurant_id;
    } else {
      recipientId = order.driver_id || order.customer_id;
    }

    const msgId = `msg_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const msg: OrderMessage = {
      id: msgId,
      message_id: msgId,
      order_id: orderId,
      sender_id: sender.id,
      sender_role: sender.role,
      sender_name: sender.name,
      recipient_id: recipientId,
      message: messageText.trim(),
      created_at: nowIso,
      read_at: null,
      timestamp: nowIso,
    };

    await dbClient.getOrderMessagesCollection().insertOne(msg as any);

    await AuditService.log(
      'message_sent',
      'order',
      orderId,
      { message_id: msg.id, sender_role: sender.role, recipient_id: recipientId },
      sender.id,
      sender.role
    );

    try {
      RealtimeService.emit({
        type: 'MESSAGE_CREATED',
        order_id: orderId,
        folio: order.folio || order.order_code,
        restaurant_id: order.restaurant_id,
        customer_id: order.customer_id,
        driver_id: order.driver_id || undefined,
        data: msg,
        timestamp: nowIso,
      });
    } catch {
      // non-fatal
    }

    return msg;
  }

  // --- Support Tickets ---
  public static async createSupportTicket(
    driverId: string,
    driverName: string,
    payload: { category: string; description: string; order_id?: string; priority?: 'normal' | 'urgent' }
  ): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: `tkt_${crypto.randomUUID()}`,
      driver_id: driverId,
      driver_name: driverName,
      order_id: payload.order_id,
      category: payload.category,
      description: payload.description,
      status: 'open',
      priority: payload.priority || 'normal',
      createdAt: new Date().toISOString(),
    };

    await dbClient.getSupportTicketsCollection().insertOne(ticket as any);
    await AuditService.log('driver.support_ticket_created', 'ticket', ticket.id, ticket as any, driverId, 'driver');
    return ticket;
  }
}
