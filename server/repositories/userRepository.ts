import { dbClient } from '../db/connection.ts';
import type { User } from '../models/types.ts';

export class UserRepository {
  private static col() {
    return dbClient.getUsersCollection();
  }

  public static async findByEmail(email: string): Promise<User | null> {
    const doc = await this.col().findOne({ email: email.toLowerCase().trim() });
    return doc || null;
  }

  public static async findById(id: string): Promise<User | null> {
    const doc = await this.col().findOne({ id });
    return doc || null;
  }

  public static async create(user: User): Promise<User> {
    await this.col().insertOne(user as any);
    return user;
  }

  public static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const res = await this.col().findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return res || null;
  }
}
