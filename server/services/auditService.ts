import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import type { AuditLog } from '../models/types.ts';

export class AuditService {
  public static async log(
    event: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown> = {},
    actorId?: string,
    actorRole?: string
  ): Promise<AuditLog> {
    const entry = await AuditLogRepository.create({
      event,
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId,
      actor_role: actorRole,
      details,
    });
    return entry;
  }

  public static async getLogsForEntity(entityId: string): Promise<AuditLog[]> {
    return AuditLogRepository.findByEntityId(entityId);
  }
}
