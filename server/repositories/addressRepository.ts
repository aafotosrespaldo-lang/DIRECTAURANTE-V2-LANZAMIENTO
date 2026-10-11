import { dbClient } from '../db/connection.ts';
import type { Address } from '../models/types.ts';

export class AddressRepository {
  private static col() {
    return dbClient.getAddressesCollection();
  }

  public static async findByUserId(userId: string): Promise<Address[]> {
    return this.col().find({ user_id: userId }).toArray();
  }

  public static async findById(id: string): Promise<Address | null> {
    const doc = await this.col().findOne({ id });
    return doc || null;
  }

  public static async create(address: Address): Promise<Address> {
    if (address.is_default) {
      // Unset previous defaults for this user
      await this.col().updateMany({ user_id: address.user_id }, { $set: { is_default: false } });
    }
    await this.col().insertOne(address as any);
    return address;
  }

  public static async update(id: string, updates: Partial<Address>): Promise<Address | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (updates.is_default) {
      await this.col().updateMany(
        { user_id: existing.user_id, id: { $ne: id } },
        { $set: { is_default: false } }
      );
    }

    const updated = await this.col().findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return updated || null;
  }

  public static async delete(id: string): Promise<boolean> {
    const res = await this.col().deleteOne({ id });
    return res.deletedCount > 0;
  }
}
