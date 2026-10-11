import { dbClient } from '../db/connection.ts';
import type { AuditLog } from '../models/types.ts';
import crypto from 'crypto';

export class AuditLogRepository {
  private static col() {
    return dbClient.getAuditLogsCollection();
  }

  public static async create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const entry: AuditLog = {
      ...log,
      id: `audit_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };
    await this.col().insertOne(entry as any);
    return entry;
  }

  public static async findByEntityId(entityId: string): Promise<AuditLog[]> {
    return this.col().find({ entity_id: entityId }).sort({ timestamp: -1 }).toArray();
  }

  public static async findRecent(limit = 100): Promise<AuditLog[]> {
    return this.col().find({}).sort({ timestamp: -1 }).limit(limit).toArray();
  }
}
