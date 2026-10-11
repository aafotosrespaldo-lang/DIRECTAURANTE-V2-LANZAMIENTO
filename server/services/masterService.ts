import { dbClient } from '../db/connection.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import type { Order, OrderStatus, User, Restaurant, OrderEvidence, AuditLog } from '../models/types.ts';

export interface NocOverview {
  system: {
    service: string;
    version: string;
    environment: string;
    uptime_seconds: number;
    memory_mb: number;
    database: {
      connected: boolean;
      databaseName: string | null;
      isMemoryFallback: boolean;
    };
    realtime: {
      connectedClients: number;
      clientsByRole: Record<string, number>;
    };
    server_time: string;
  };
  metrics: {
    total_orders: number;
    active_orders_count: number;
    completed_orders_count: number;
    cancelled_orders_count: number;
    status_counts: Record<OrderStatus, number>;
    revenue: {
      total_cents: number;
      today_cents: number;
      average_order_cents: number;
    };
    ecosystem: {
      total_restaurants: number;
      active_restaurants: number;
      total_drivers: number;
      available_drivers: number;
      busy_drivers: number;
      offline_drivers: number;
      total_customers: number;
    };
  };
  active_orders: Order[];
  recent_alerts: {
    id: string;
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: string;
    entity_id?: string;
  }[];
  recent_audit_logs: AuditLog[];
  recent_evidence: OrderEvidence[];
}

export class MasterService {
  /**
   * Retrieves complete NOC 24/7 ecosystem snapshot.
   * Self-contained and robust even if other nodes restart.
   */
  public static async getNocOverview(): Promise<NocOverview> {
    const ordersCol = dbClient.getOrdersCollection();
    const usersCol = dbClient.getUsersCollection();
    const restaurantsCol = dbClient.getRestaurantsCollection();
    const auditLogsCol = dbClient.getAuditLogsCollection();
    const evidenceCol = dbClient.getOrderEvidenceCollection();

    // 1. Fetch all orders (limit to last 200 for fast overview)
    const recentOrders = await ordersCol.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    const totalOrdersCount = await ordersCol.countDocuments();

    // 2. Status counts calculation
    const statusCounts: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      assigned: 0,
      picked_up: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0,
    };

    let totalRevenueCents = 0;
    let todayRevenueCents = 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeOrders: Order[] = [];

    for (const ord of recentOrders) {
      if (statusCounts[ord.status] !== undefined) {
        statusCounts[ord.status]++;
      }
      if (ord.status !== 'delivered' && ord.status !== 'cancelled') {
        activeOrders.push(ord);
      }
      if (ord.status === 'delivered') {
        totalRevenueCents += ord.total || 0;
        const dateVal = ord.createdAt || (ord as any).created_at || (ord as any).timestamp;
        const ordDate = dateVal ? new Date(dateVal) : new Date();
        if (ordDate >= todayStart) {
          todayRevenueCents += ord.total || 0;
        }
      }
    }

    const completedCount = statusCounts.delivered;
    const avgOrderCents = completedCount > 0 ? Math.round(totalRevenueCents / completedCount) : 0;

    // 3. User role counts
    const drivers = await usersCol.find({ role: 'driver' }).toArray();
    let availableDrivers = 0;
    let busyDrivers = 0;
    let offlineDrivers = 0;

    for (const d of drivers) {
      if (d.driver_status === 'available') availableDrivers++;
      else if (d.driver_status === 'busy') busyDrivers++;
      else offlineDrivers++;
    }

    const totalCustomers = await usersCol.countDocuments({ role: 'customer' });

    // 4. Restaurants
    const restaurants = await restaurantsCol.find({}).toArray();
    const activeRestaurants = restaurants.filter((r) => r.is_active).length;

    // 5. Audit logs & evidence
    const recentAuditLogs = await auditLogsCol.find({}).sort({ timestamp: -1 }).limit(15).toArray();
    const recentEvidence = await evidenceCol.find({}).sort({ created_at: -1 }).limit(10).toArray();

    // 6. Generate NOC alerts
    const alerts: NocOverview['recent_alerts'] = [];

    const now = Date.now();
    for (const ord of activeOrders) {
      const ageMinutes = Math.floor((now - new Date(ord.createdAt).getTime()) / 60000);
      if (ord.status === 'pending' && ageMinutes > 5) {
        alerts.push({
          id: `alt_pend_${ord.id}`,
          type: 'warning',
          title: `Pedido pendiente demorado (${ord.order_code || ord.id.slice(-6)})`,
          message: `El pedido lleva ${ageMinutes} min sin confirmación del restaurante ${ord.restaurant_name}.`,
          timestamp: new Date().toISOString(),
          entity_id: ord.id,
        });
      } else if (ord.status === 'ready' && !ord.driver_id && ageMinutes > 8) {
        alerts.push({
          id: `alt_nodriver_${ord.id}`,
          type: 'critical',
          title: `Pedido Listo sin Repartidor (${ord.order_code || ord.id.slice(-6)})`,
          message: `Listo en mostrador pero ningún repartidor lo ha tomado aún.`,
          timestamp: new Date().toISOString(),
          entity_id: ord.id,
        });
      }
    }

    if (availableDrivers === 0 && activeOrders.some((o) => o.status === 'ready' || o.status === 'preparing')) {
      alerts.push({
        id: `alt_nofleet_${Date.now()}`,
        type: 'warning',
        title: 'Flota saturada o sin repartidores disponibles',
        message: 'Hay pedidos en curso pero 0 repartidores en estado "Disponible".',
        timestamp: new Date().toISOString(),
      });
    }

    // 7. System metadata
    const mem = process.memoryUsage();
    const memoryMb = Math.round(mem.rss / 1024 / 1024);

    return {
      system: {
        service: 'Directaurante Core V2 — NOC Control Center',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb: memoryMb,
        database: dbClient.getDbInfo(),
        realtime: RealtimeService.getStats(),
        server_time: new Date().toISOString(),
      },
      metrics: {
        total_orders: totalOrdersCount,
        active_orders_count: activeOrders.length,
        completed_orders_count: statusCounts.delivered,
        cancelled_orders_count: statusCounts.cancelled,
        status_counts: statusCounts,
        revenue: {
          total_cents: totalRevenueCents,
          today_cents: todayRevenueCents,
          average_order_cents: avgOrderCents,
        },
        ecosystem: {
          total_restaurants: restaurants.length,
          active_restaurants: activeRestaurants,
          total_drivers: drivers.length,
          available_drivers: availableDrivers,
          busy_drivers: busyDrivers,
          offline_drivers: offlineDrivers,
          total_customers: totalCustomers,
        },
      },
      active_orders: activeOrders,
      recent_alerts: alerts,
      recent_audit_logs: recentAuditLogs,
      recent_evidence: recentEvidence,
    };
  }

  /**
   * Universal Order Query for Master with filters
   */
  public static async getOrders(filters: {
    status?: OrderStatus;
    restaurant_id?: string;
    driver_id?: string;
    search?: string;
    limit?: number;
  }): Promise<Order[]> {
    const ordersCol = dbClient.getOrdersCollection();
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.restaurant_id) {
      query.restaurant_id = filters.restaurant_id;
    }
    if (filters.driver_id) {
      query.driver_id = filters.driver_id;
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      query.$or = [
        { id: { $regex: q, $options: 'i' } },
        { order_code: { $regex: q, $options: 'i' } },
        { customer_name: { $regex: q, $options: 'i' } },
        { customer_phone: { $regex: q, $options: 'i' } },
        { restaurant_name: { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.min(filters.limit || 100, 300);
    return await ordersCol.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  /**
   * Sovereign Master Override: Change order status with mandatory audit trail
   */
  public static async forceOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    reason: string,
    actor: { id: string; name: string }
  ): Promise<Order> {
    const ordersCol = dbClient.getOrdersCollection();
    const order = await ordersCol.findOne({ id: orderId });
    if (!order) {
      throw new Error(`Pedido no encontrado: ${orderId}`);
    }

    const previousStatus = order.status;
    const now = new Date().toISOString();

    const historyItem = {
      status: newStatus,
      timestamp: now,
      actor_id: actor.id,
      actor_role: 'master',
      notes: `[INTERVENCIÓN MASTER NOC]: ${reason}`,
    };

    const updateFields: any = {
      status: newStatus,
      updatedAt: now,
    };

    // If marked delivered, update payment status if cash
    if (newStatus === 'delivered' && order.payment_method === 'cash') {
      updateFields.payment_status = 'approved';
    }

    await ordersCol.updateOne(
      { id: orderId },
      {
        $set: updateFields,
        $push: { status_history: historyItem } as any,
      }
    );

    const updated = await ordersCol.findOne({ id: orderId });

    await AuditService.log(
      'master.order_status_override',
      'order',
      orderId,
      {
        from_status: previousStatus,
        to_status: newStatus,
        reason,
        actor_name: actor.name,
      },
      actor.id,
      'master'
    );

    // Real-time broadcast
    RealtimeService.emit({
      type: newStatus === 'cancelled' ? 'ORDER_CANCELLED' : newStatus === 'delivered' ? 'ORDER_DELIVERED' : 'ORDER_ACCEPTED',
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      driver_id: order.driver_id || undefined,
      customer_id: order.customer_id,
      data: {
        order_id: orderId,
        order_code: order.order_code,
        previous_status: previousStatus,
        new_status: newStatus,
        override_reason: reason,
        actor_role: 'master',
      },
      timestamp: now,
    });

    return updated!;
  }

  /**
   * Sovereign Master Override: Reassign driver
   */
  public static async reassignDriver(
    orderId: string,
    driverId: string,
    actor: { id: string; name: string }
  ): Promise<Order> {
    const ordersCol = dbClient.getOrdersCollection();
    const usersCol = dbClient.getUsersCollection();

    const order = await ordersCol.findOne({ id: orderId });
    if (!order) {
      throw new Error(`Pedido ${orderId} no encontrado`);
    }

    const driver = await usersCol.findOne({ id: driverId, role: 'driver' });
    if (!driver) {
      throw new Error(`Repartidor ${driverId} no encontrado o inactivo`);
    }

    const previousDriverId = order.driver_id;
    const now = new Date().toISOString();

    const historyItem = {
      status: 'assigned' as OrderStatus,
      timestamp: now,
      actor_id: actor.id,
      actor_role: 'master',
      notes: `[REASIGNACIÓN MANUAL MASTER NOC]: Asignado a ${driver.name} (${driver.phone})`,
    };

    await ordersCol.updateOne(
      { id: orderId },
      {
        $set: {
          driver_id: driverId,
          status: 'assigned',
          updatedAt: now,
        },
        $push: { status_history: historyItem } as any,
      }
    );

    await AuditService.log(
      'master.order_driver_reassigned',
      'order',
      orderId,
      {
        previous_driver_id: previousDriverId,
        new_driver_id: driverId,
        driver_name: driver.name,
      },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'DRIVER_ASSIGNED',
      order_id: orderId,
      restaurant_id: order.restaurant_id,
      driver_id: driverId,
      customer_id: order.customer_id,
      data: {
        order_id: orderId,
        driver_id: driverId,
        driver_name: driver.name,
        driver_phone: driver.phone,
        vehicle_info: driver.vehicle_info,
      },
      timestamp: now,
    });

    return (await ordersCol.findOne({ id: orderId }))!;
  }

  /**
   * Drivers fleet overview & management
   */
  public static async getFleet(): Promise<User[]> {
    const usersCol = dbClient.getUsersCollection();
    return await usersCol.find({ role: 'driver' }).sort({ name: 1 }).toArray();
  }

  /**
   * Toggle driver active/verification state
   */
  public static async updateDriver(
    driverId: string,
    updates: { is_active?: boolean; is_verified?: boolean; driver_status?: 'available' | 'offline' | 'busy' },
    actor: { id: string }
  ): Promise<User> {
    const usersCol = dbClient.getUsersCollection();
    const driver = await usersCol.findOne({ id: driverId, role: 'driver' });
    if (!driver) {
      throw new Error(`Repartidor ${driverId} no encontrado`);
    }

    const setFields: any = { updatedAt: new Date().toISOString() };
    if (updates.is_active !== undefined) setFields.is_active = updates.is_active;
    if (updates.is_verified !== undefined) setFields.is_verified = updates.is_verified;
    if (updates.driver_status !== undefined) setFields.driver_status = updates.driver_status;

    await usersCol.updateOne({ id: driverId }, { $set: setFields });

    await AuditService.log(
      'master.driver_updated',
      'user',
      driverId,
      updates,
      actor.id,
      'master'
    );

    return (await usersCol.findOne({ id: driverId }))!;
  }

  /**
   * Restaurants overview for Master
   */
  public static async getRestaurants(): Promise<(Restaurant & { products_count: number })[]> {
    const restaurantsCol = dbClient.getRestaurantsCollection();
    const productsCol = dbClient.getProductsCollection();

    const rests = await restaurantsCol.find({}).toArray();
    const result: (Restaurant & { products_count: number })[] = [];

    for (const r of rests) {
      const pCount = await productsCol.countDocuments({ restaurant_id: r.id });
      result.push({ ...r, products_count: pCount });
    }

    return result;
  }

  /**
   * Toggle restaurant active state
   */
  public static async toggleRestaurant(
    restaurantId: string,
    isActive: boolean,
    actor: { id: string }
  ): Promise<Restaurant> {
    const restaurantsCol = dbClient.getRestaurantsCollection();
    const rest = await restaurantsCol.findOne({ id: restaurantId });
    if (!rest) throw new Error(`Restaurante ${restaurantId} no encontrado`);

    await restaurantsCol.updateOne(
      { id: restaurantId },
      { $set: { is_active: isActive } }
    );

    await AuditService.log(
      'master.restaurant_toggled',
      'restaurant',
      restaurantId,
      { is_active: isActive },
      actor.id,
      'master'
    );

    return (await restaurantsCol.findOne({ id: restaurantId }))!;
  }

  /**
   * Universal Evidence Vault for Master
   */
  public static async getAllEvidence(limit = 100): Promise<OrderEvidence[]> {
    const evidenceCol = dbClient.getOrderEvidenceCollection();
    return await evidenceCol.find({}).sort({ created_at: -1 }).limit(limit).toArray();
  }

  /**
   * Audit Logs Stream for Master
   */
  public static async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const auditLogsCol = dbClient.getAuditLogsCollection();
    return await auditLogsCol.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
  }

  /**
   * Broadcast real-time ecosystem message
   */
  public static async broadcastAlert(
    title: string,
    message: string,
    targetRole: string = 'all',
    actor: { id: string; name: string }
  ): Promise<{ delivered: boolean }> {
    const now = new Date().toISOString();

    RealtimeService.emit({
      type: 'PROFILE_UPDATED', // standard event received by clients
      data: {
        is_system_broadcast: true,
        title,
        message,
        target_role: targetRole,
        sender: actor.name,
        timestamp: now,
      },
      timestamp: now,
    });

    await AuditService.log(
      'master.system_broadcast',
      'system',
      'all',
      { title, message, targetRole },
      actor.id,
      'master'
    );

    return { delivered: true };
  }
}
