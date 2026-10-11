import { dbClient } from '../db/connection.ts';
import type { Order } from '../models/types.ts';

export class OrderRepository {
  private static col() {
    return dbClient.getOrdersCollection();
  }

  private static normalize(doc: any): Order | null {
    if (!doc) return null;
    if (!doc.order_id) doc.order_id = doc.id;
    if (!doc.order_code) {
      const short = (doc.id || '').replace(/^ord_/, '').slice(0, 4).toUpperCase();
      doc.order_code = `DIR-${short || '0000'}`;
    }
    return doc as Order;
  }

  public static async findById(id: string): Promise<Order | null> {
    const doc = await this.col().findOne({ $or: [{ id }, { order_id: id }, { order_code: id }] });
    return this.normalize(doc);
  }

  public static async findByOrderCode(orderCode: string): Promise<Order | null> {
    const doc = await this.col().findOne({ order_code: orderCode });
    return this.normalize(doc);
  }

  public static async findByIdempotencyKey(customerId: string, idempotencyKey: string): Promise<Order | null> {
    const doc = await this.col().findOne({ customer_id: customerId, idempotency_key: idempotencyKey });
    return this.normalize(doc);
  }

  /**
   * Inserts an order with atomic uniqueness constraint.
   * If a concurrent duplicate idempotency_key arrives at the same instant,
   * MongoDB throws error code 11000 (duplicate key), which is caught and handled.
   */
  public static async insertOrderAtomic(order: Order): Promise<{ order: Order; isDuplicate: boolean }> {
    if (!order.order_id) order.order_id = order.id;
    if (!order.order_code) {
      const short = (order.id || '').replace(/^ord_/, '').slice(0, 4).toUpperCase();
      order.order_code = `DIR-${short || '0000'}`;
    }

    try {
      await this.col().insertOne(order as any);
      return { order, isDuplicate: false };
    } catch (err: any) {
      // MongoDB duplicate key error code 11000
      if (err.code === 11000 || err.message?.includes('E11000') || err.message?.includes('duplicate key')) {
        const existing = await this.findByIdempotencyKey(order.customer_id, order.idempotency_key);
        if (existing) {
          return { order: existing, isDuplicate: true };
        }
      }
      throw err;
    }
  }

  public static async update(id: string, updates: Partial<Order>): Promise<Order | null> {
    const updated = await this.col().findOneAndUpdate(
      { $or: [{ id }, { order_id: id }] },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return this.normalize(updated);
  }

  public static async findByCustomerId(customerId: string): Promise<Order[]> {
    const list = await this.col().find({ customer_id: customerId }).sort({ createdAt: -1 }).toArray();
    return list.map((d) => this.normalize(d)!);
  }

  public static async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const list = await this.col().find({ restaurant_id: restaurantId }).sort({ createdAt: -1 }).toArray();
    return list.map((d) => this.normalize(d)!);
  }

  public static async findByDriverId(driverId: string): Promise<Order[]> {
    const list = await this.col().find({ driver_id: driverId }).sort({ createdAt: -1 }).toArray();
    return list.map((d) => this.normalize(d)!);
  }
}
