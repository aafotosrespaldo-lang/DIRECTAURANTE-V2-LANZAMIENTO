import crypto from 'crypto';
import { dbClient } from '../db/connection.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import type { Incident, IncidentSeverity, IncidentStatus, UserRole } from '../models/types.ts';

export class IncidentService {
  /**
   * Retrieve Incidents with filters
   */
  public static async getIncidents(filters: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    entity_type?: string;
    entity_id?: string;
    order_id?: string;
    search?: string;
    limit?: number;
  }): Promise<Incident[]> {
    const col = dbClient.getIncidentsCollection();
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.severity) query.severity = filters.severity;
    if (filters.entity_type) query.entity_type = filters.entity_type;
    if (filters.entity_id) query.entity_id = filters.entity_id;
    if (filters.order_id) query.order_id = filters.order_id;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { order_code: { $regex: q, $options: 'i' } },
        { incident_id: { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.min(filters.limit || 50, 150);
    return await col.find(query).sort({ created_at: -1 }).limit(limit).toArray();
  }

  /**
   * Create an Incident with audit trail and SSE broadcast
   */
  public static async createIncident(
    data: {
      title: string;
      description: string;
      entity_type: 'order' | 'restaurant' | 'driver' | 'customer' | 'system';
      entity_id: string;
      order_id?: string;
      order_code?: string;
      severity: IncidentSeverity;
    },
    actor: { id: string; name: string; role: string }
  ): Promise<Incident> {
    const col = dbClient.getIncidentsCollection();
    const incId = `inc_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id: incId,
      incident_id: incId,
      title: data.title.trim(),
      description: data.description.trim(),
      order_id: data.order_id,
      order_code: data.order_code,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      severity: data.severity,
      status: 'open',
      reported_by: {
        id: actor.id,
        name: actor.name,
        role: actor.role as UserRole,
      },
      created_at: now,
      updated_at: now,
    };

    await col.insertOne(incident as any);

    await AuditService.log(
      'master.incident_opened',
      'incident',
      incId,
      {
        title: incident.title,
        severity: incident.severity,
        entity_type: incident.entity_type,
        entity_id: incident.entity_id,
        order_id: incident.order_id,
      },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'INCIDENT_CREATED',
      order_id: incident.order_id,
      data: incident,
      timestamp: now,
    });

    return incident;
  }

  /**
   * Update Incident Status or Severity
   */
  public static async updateIncident(
    incidentId: string,
    updates: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      resolution_notes?: string;
      assigned_to?: string;
    },
    actor: { id: string; name: string }
  ): Promise<Incident> {
    const col = dbClient.getIncidentsCollection();
    const inc = await col.findOne({
      $or: [{ id: incidentId }, { incident_id: incidentId }],
    });
    if (!inc) {
      throw new Error(`Incidencia ${incidentId} no encontrada`);
    }

    const now = new Date().toISOString();
    const setFields: any = { updated_at: now };

    if (updates.status) {
      setFields.status = updates.status;
      if (updates.status === 'resolved' || updates.status === 'closed') {
        setFields.resolved_at = now;
      }
    }
    if (updates.severity) setFields.severity = updates.severity;
    if (updates.resolution_notes !== undefined) setFields.resolution_notes = updates.resolution_notes;
    if (updates.assigned_to !== undefined) setFields.assigned_to = updates.assigned_to;

    await col.updateOne({ incident_id: inc.incident_id }, { $set: setFields });

    const isResolved = updates.status === 'resolved' || updates.status === 'closed';
    await AuditService.log(
      isResolved ? 'master.incident_resolved' : 'master.incident_updated',
      'incident',
      inc.incident_id,
      updates,
      actor.id,
      'master'
    );

    const updated = await col.findOne({ incident_id: inc.incident_id });

    RealtimeService.emit({
      type: 'INCIDENT_UPDATED',
      order_id: updated?.order_id,
      data: updated,
      timestamp: now,
    });

    return updated!;
  }

  /**
   * Complete Support Desk Overview for Master NOC
   */
  public static async getSupportOverview(): Promise<{
    open_incidents: Incident[];
    critical_alerts: any[];
    problem_orders: any[];
    problem_restaurants: any[];
    problem_drivers: any[];
    counts: {
      open: number;
      investigating: number;
      resolved: number;
      by_severity: Record<IncidentSeverity, number>;
    };
  }> {
    const incCol = dbClient.getIncidentsCollection();
    const ordersCol = dbClient.getOrdersCollection();
    const restCol = dbClient.getRestaurantsCollection();
    const usersCol = dbClient.getUsersCollection();

    const openIncidents = await incCol
      .find({ status: { $in: ['open', 'investigating'] } })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    const counts = {
      open: 0,
      investigating: 0,
      resolved: await incCol.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
      by_severity: { normal: 0, importante: 0, urgente: 0, critica: 0 } as Record<IncidentSeverity, number>,
    };

    for (const inc of openIncidents) {
      if (inc.status === 'open') counts.open++;
      if (inc.status === 'investigating') counts.investigating++;
      if (counts.by_severity[inc.severity] !== undefined) {
        counts.by_severity[inc.severity]++;
      }
    }

    // Problem Orders
    const now = Date.now();
    const activeOrders = await ordersCol
      .find({ status: { $nin: ['delivered', 'cancelled'] } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const problemOrders = activeOrders.filter((ord) => {
      const ageMinutes = Math.floor((now - new Date(ord.createdAt).getTime()) / 60000);
      return (
        (ord.status === 'pending' && ageMinutes > 5) ||
        (ord.status === 'ready' && !ord.driver_id && ageMinutes > 8)
      );
    });

    // Problem Restaurants (inactive)
    const problemRestaurants = await restCol.find({ is_active: false }).toArray();

    // Problem Drivers (busy/paused with no active delivery or unverified)
    const problemDrivers = await usersCol
      .find({ role: 'driver', $or: [{ is_verified: false }, { is_active: false }] })
      .toArray();

    return {
      open_incidents: openIncidents,
      critical_alerts: problemOrders.map((ord) => ({
        id: `crit_${ord.id}`,
        title: `Pedido detenido: ${ord.order_code || ord.id.slice(-6)}`,
        message: `Estado ${ord.status} en restaurante ${ord.restaurant_name}`,
        order_id: ord.id,
        created_at: ord.createdAt,
      })),
      problem_orders: problemOrders,
      problem_restaurants: problemRestaurants,
      problem_drivers: problemDrivers,
      counts,
    };
  }
}
