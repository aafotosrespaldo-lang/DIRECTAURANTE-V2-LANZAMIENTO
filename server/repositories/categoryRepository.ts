import { dbClient } from '../db/connection.ts';
import type { Category } from '../models/types.ts';

export class CategoryRepository {
  private static col() {
    return dbClient.getCategoriesCollection();
  }

  public static async findAll(): Promise<Category[]> {
    return this.col().find({}).sort({ sort_order: 1 }).toArray();
  }

  public static async findById(id: string): Promise<Category | null> {
    const doc = await this.col().findOne({ id });
    return doc || null;
  }
}
