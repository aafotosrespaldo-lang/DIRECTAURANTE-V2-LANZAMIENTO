import { dbClient } from '../db/connection.ts';
import type { Product } from '../models/types.ts';

export class ProductRepository {
  private static col() {
    return dbClient.getProductsCollection();
  }

  private static normalize(doc: any): Product | null {
    if (!doc) return null;
    if (!doc.product_id) doc.product_id = doc.id;
    return doc as Product;
  }

  public static async findByRestaurantId(restaurantId: string, availableOnly = false): Promise<Product[]> {
    const filter: any = { restaurant_id: restaurantId };
    if (availableOnly) {
      filter.is_available = true;
    }
    const list = await this.col().find(filter).toArray();
    return list.map((p) => this.normalize(p)!);
  }

  public static async findById(id: string): Promise<Product | null> {
    const doc = await this.col().findOne({ $or: [{ id }, { product_id: id }] });
    return this.normalize(doc);
  }

  public static async update(id: string, updates: Partial<Product>): Promise<Product | null> {
    const updated = await this.col().findOneAndUpdate(
      { $or: [{ id }, { product_id: id }] },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return this.normalize(updated);
  }

  public static async updateStock(id: string, newStock: number | null): Promise<Product | null> {
    const updated = await this.col().findOneAndUpdate(
      { $or: [{ id }, { product_id: id }] },
      { $set: { stock: newStock } },
      { returnDocument: 'after' }
    );
    return this.normalize(updated);
  }

  /**
   * Atomically decrements stock if tracking is active on the product.
   * If stock is null / undefined, no limit is enforced (returns true).
   * If stock is tracked and stock >= quantity, decrements atomically and returns true.
   * If stock is tracked and stock < quantity, returns false without modifying.
   */
  public static async decrementStockAtomic(id: string, quantity: number): Promise<{ success: boolean; currentStock?: number | null }> {
    const product = await this.findById(id);
    if (!product) return { success: false };

    // If stock is null or undefined, product has unlimited stock
    if (product.stock === undefined || product.stock === null) {
      return { success: true, currentStock: null };
    }

    // Attempt atomic decrement if stock >= quantity
    const res = await this.col().findOneAndUpdate(
      {
        $or: [{ id }, { product_id: id }],
        stock: { $gte: quantity },
      },
      {
        $inc: { stock: -quantity },
      },
      { returnDocument: 'after' }
    );

    if (!res) {
      return { success: false, currentStock: product.stock };
    }

    return { success: true, currentStock: res.stock };
  }

  public static async incrementStockAtomic(id: string, quantity: number): Promise<{ success: boolean; currentStock?: number | null }> {
    const product = await this.findById(id);
    if (!product) return { success: false };
    if (product.stock === undefined || product.stock === null) {
      return { success: true, currentStock: null };
    }
    const res = await this.col().findOneAndUpdate(
      { $or: [{ id }, { product_id: id }] },
      { $inc: { stock: quantity } },
      { returnDocument: 'after' }
    );
    return { success: true, currentStock: res?.stock };
  }

  public static async create(product: Product): Promise<Product> {
    const doc = {
      ...product,
      id: product.id || product.product_id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      product_id: product.product_id || product.id,
      createdAt: product.createdAt || new Date().toISOString(),
    };
    if (!doc.product_id) doc.product_id = doc.id;
    await this.col().insertOne(doc as any);
    return this.normalize(doc)!;
  }

  public static async delete(id: string): Promise<boolean> {
    const res = await this.col().deleteOne({ $or: [{ id }, { product_id: id }] });
    return res.deletedCount > 0;
  }
}
