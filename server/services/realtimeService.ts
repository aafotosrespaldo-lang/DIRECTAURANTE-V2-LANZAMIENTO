import type { Response } from 'express';
import type { RealtimeEventPayload, RealtimeEventType } from '../models/types.ts';

export interface SSEClient {
  id: string;
  userId: string;
  role: string;
  restaurantId?: string;
  res: Response;
  connectedAt: string;
}

export class RealtimeService {
  private static clients: Map<string, SSEClient> = new Map();
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  public static initialize(): void {
    if (this.heartbeatInterval) return;

    // Send keepalive ping every 25 seconds to prevent proxy/browser timeout
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        try {
          client.res.write(':keepalive\n\n');
        } catch {
          this.removeClient(clientId);
        }
      }
    }, 25000);
  }

  public static addClient(
    clientId: string,
    userId: string,
    role: string,
    res: Response,
    restaurantId?: string
  ): void {
    this.initialize();

    const client: SSEClient = {
      id: clientId,
      userId,
      role,
      restaurantId,
      res,
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(clientId, client);

    // Initial greeting event
    try {
      res.write(
        `event: CONNECTED\ndata: ${JSON.stringify({
          type: 'CONNECTED',
          userId,
          role,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    } catch {
      this.removeClient(clientId);
    }
  }

  public static removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch {
        // ignore already closed
      }
      this.clients.delete(clientId);
    }
  }

  public static emit(payload: RealtimeEventPayload): void {
    const serialized = JSON.stringify(payload);
    const eventId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sseMessage = `id: ${eventId}\nevent: ${payload.type}\ndata: ${serialized}\n\n`;

    for (const [clientId, client] of this.clients.entries()) {
      if (!this.canClientReceiveEvent(client, payload)) {
        continue;
      }

      try {
        client.res.write(sseMessage);
        if (typeof (client.res as any).flush === 'function') {
          (client.res as any).flush();
        }
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  public static canClientReceiveEvent(client: SSEClient, event: RealtimeEventPayload): boolean {
    // Master and Admin see all operational events
    if (client.role === 'master' || client.role === 'admin') {
      return true;
    }

    // 1. Non-sensitive public store catalog events (availability and stock changes)
    if (
      event.type === 'RESTAURANT_STATUS_CHANGED' ||
      event.type === 'INVENTORY_UPDATED' ||
      event.type === 'RESTAURANT_UPDATED'
    ) {
      return true;
    }

    // Guest clients only receive non-sensitive public store events
    if (client.role === 'guest') {
      return false;
    }

    // 2. Profile updates: strictly private to the user themselves
    if (event.type === 'PROFILE_UPDATED') {
      const targetUserId = event.customer_id || event.data?.id || event.data?.user_id;
      return Boolean(targetUserId && client.userId === targetUserId);
    }

    // 3. Customer: ONLY receives events for their own orders or directed to them
    if (client.role === 'customer') {
      if (event.customer_id && event.customer_id === client.userId) return true;
      if (event.data?.customer_id && event.data.customer_id === client.userId) return true;
      return false;
    }

    // 4. Restaurant: ONLY receives events belonging to their own owned restaurant
    if (client.role === 'restaurant') {
      if (!client.restaurantId) return false;
      if (event.restaurant_id && event.restaurant_id === client.restaurantId) return true;
      if (event.data?.restaurant_id && event.data.restaurant_id === client.restaurantId) return true;
      return false;
    }

    // 5. Driver: ONLY receives events for orders assigned to them, or dispatch offers directed to them
    if (client.role === 'driver') {
      if (event.driver_id) {
        return event.driver_id === client.userId;
      }
      if (event.data?.driver_id) {
        return event.data.driver_id === client.userId;
      }
      // Unassigned orders ready for pickup / general driver radar
      if (event.type === 'ORDER_READY' || event.type === 'DRIVER_OFFER_CREATED') {
        return true;
      }
      return false;
    }

    // 6. Messages and conversations: ONLY directed to recipient or involved party
    if (
      event.type === 'MESSAGE_CREATED' ||
      event.type === 'MESSAGE_READ' ||
      event.type === 'MESSAGE_UPDATED' ||
      event.type === 'MESSAGE_CLOSED' ||
      event.type === 'CONVERSATION_UPDATED'
    ) {
      if (event.data?.recipient_id && event.data.recipient_id === client.userId) return true;
      if (event.customer_id && event.customer_id === client.userId) return true;
      if (event.restaurant_id && client.restaurantId && event.restaurant_id === client.restaurantId) return true;
      if (event.driver_id && event.driver_id === client.userId) return true;
    }

    return false;
  }

  // --- Real-time Presence Queries (100% authoritative, no simulation) ---
  public static isUserOnline(userId: string): boolean {
    for (const client of this.clients.values()) {
      if (client.userId === userId) return true;
    }
    return false;
  }

  public static isRestaurantOnline(restaurantId: string): boolean {
    for (const client of this.clients.values()) {
      if (client.restaurantId === restaurantId || client.userId === restaurantId) return true;
    }
    return false;
  }

  public static getOrderPresence(order: {
    customer_id?: string;
    restaurant_id?: string;
    driver_id?: string | null;
  }): {
    customer: boolean;
    restaurant: boolean;
    driver: boolean;
    master: boolean;
  } {
    let customerOnline = false;
    let restaurantOnline = false;
    let driverOnline = false;
    let masterOnline = false;

    for (const client of this.clients.values()) {
      if (client.role === 'master' || client.role === 'admin') {
        masterOnline = true;
      }
      if (order.customer_id && client.userId === order.customer_id) {
        customerOnline = true;
      }
      if (
        order.restaurant_id &&
        (client.restaurantId === order.restaurant_id || client.userId === order.restaurant_id)
      ) {
        restaurantOnline = true;
      }
      if (order.driver_id && client.userId === order.driver_id) {
        driverOnline = true;
      }
    }

    return {
      customer: customerOnline,
      restaurant: restaurantOnline,
      driver: driverOnline,
      master: masterOnline,
    };
  }

  public static getPresenceMap(userIds: string[]): Record<string, boolean> {
    const res: Record<string, boolean> = {};
    const onlineSet = new Set<string>();
    for (const client of this.clients.values()) {
      onlineSet.add(client.userId);
      if (client.restaurantId) onlineSet.add(client.restaurantId);
    }
    for (const uid of userIds) {
      res[uid] = onlineSet.has(uid);
    }
    return res;
  }

  public static getStats() {
    return {
      connectedClients: this.clients.size,
      clientsByRole: Array.from(this.clients.values()).reduce((acc, c) => {
        acc[c.role] = (acc[c.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
