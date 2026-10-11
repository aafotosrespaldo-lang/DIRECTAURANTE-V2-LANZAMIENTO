import crypto from 'crypto';
import { dbClient } from '../db/connection.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import type {
  ChatMessage,
  Conversation,
  ConversationParticipant,
  ConversationPriority,
  ConversationStatus,
  Order,
  OrderEvidence,
  UserRole,
} from '../models/types.ts';

export interface ConversationWithPresence extends Conversation {
  presence: Record<string, boolean>;
}

export interface OrderCommunicationContext {
  order: Order;
  conversation: Conversation;
  messages: ChatMessage[];
  presence: {
    customer: boolean;
    restaurant: boolean;
    driver: boolean;
    master: boolean;
  };
  evidence: OrderEvidence[];
  incidents: any[];
}

export class CommunicationService {
  /**
   * Universal Query for Master Communication Center
   */
  public static async getConversations(filters: {
    status?: ConversationStatus;
    priority?: ConversationPriority;
    type?: 'direct' | 'order';
    order_id?: string;
    search?: string;
    limit?: number;
  }): Promise<ConversationWithPresence[]> {
    const col = dbClient.getConversationsCollection();
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.priority) {
      query.priority = filters.priority;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.order_id) {
      query.order_id = filters.order_id;
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { order_code: { $regex: q, $options: 'i' } },
        { order_id: { $regex: q, $options: 'i' } },
        { last_message: { $regex: q, $options: 'i' } },
        { 'participants.name': { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.min(filters.limit || 50, 150);
    const convs = await col.find(query).sort({ last_message_at: -1 }).limit(limit).toArray();

    // Attach real presence for all participants
    const allParticipantIds = new Set<string>();
    for (const c of convs) {
      for (const p of c.participants) {
        allParticipantIds.add(p.id);
        if (p.restaurant_id) allParticipantIds.add(p.restaurant_id);
      }
    }
    const presenceMap = RealtimeService.getPresenceMap(Array.from(allParticipantIds));

    return convs.map((c) => ({
      ...c,
      presence: c.participants.reduce((acc, p) => {
        acc[p.id] = Boolean(presenceMap[p.id] || (p.restaurant_id && presenceMap[p.restaurant_id]));
        return acc;
      }, {} as Record<string, boolean>),
    }));
  }

  /**
   * Get single conversation with presence
   */
  public static async getConversationById(conversationId: string): Promise<ConversationWithPresence> {
    const col = dbClient.getConversationsCollection();
    const conv = await col.findOne({
      $or: [{ id: conversationId }, { conversation_id: conversationId }],
    });
    if (!conv) {
      throw new Error(`Conversación ${conversationId} no encontrada`);
    }

    const pIds = conv.participants.map((p) => p.id);
    conv.participants.forEach((p) => {
      if (p.restaurant_id) pIds.push(p.restaurant_id);
    });
    const presenceMap = RealtimeService.getPresenceMap(pIds);

    const presence: Record<string, boolean> = {};
    for (const p of conv.participants) {
      presence[p.id] = Boolean(presenceMap[p.id] || (p.restaurant_id && presenceMap[p.restaurant_id]));
    }

    return {
      ...conv,
      presence,
    };
  }

  /**
   * Get or automatically initialize an Order Communication Room
   */
  public static async getOrCreateOrderConversation(
    orderId: string,
    actor: { id: string; name: string; role: string }
  ): Promise<OrderCommunicationContext> {
    const ordersCol = dbClient.getOrdersCollection();
    const convCol = dbClient.getConversationsCollection();
    const messagesCol = dbClient.getChatMessagesCollection();
    const evidenceCol = dbClient.getOrderEvidenceCollection();
    const incidentsCol = dbClient.getIncidentsCollection();
    const usersCol = dbClient.getUsersCollection();

    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_code: orderId }],
    });
    if (!order) {
      throw new Error(`Pedido ${orderId} no encontrado`);
    }

    // Look for existing conversation for this order
    let conv: Conversation | null = await convCol.findOne({ order_id: order.id });

    if (!conv) {
      // Build participants
      const participants: ConversationParticipant[] = [
        {
          id: order.customer_id,
          role: 'customer',
          name: order.customer_name || 'Cliente',
          phone: order.customer_phone,
        },
        {
          id: order.restaurant_id,
          role: 'restaurant',
          name: order.restaurant_name || 'Restaurante',
          restaurant_id: order.restaurant_id,
        },
      ];

      if (order.driver_id) {
        const driverUser = await usersCol.findOne({ id: order.driver_id });
        participants.push({
          id: order.driver_id,
          role: 'driver',
          name: driverUser?.name || 'Repartidor',
          phone: driverUser?.phone,
        });
      }

      // Add Master operator
      participants.push({
        id: actor.id,
        role: 'master',
        name: actor.name || 'Centro de Control Master',
      });

      const convId = `conv_ord_${order.id}`;
      const now = new Date().toISOString();

      let initialPriority: ConversationPriority = 'normal';
      const ageMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
      if (order.status === 'ready' && !order.driver_id && ageMinutes > 8) {
        initialPriority = 'urgente';
      } else if (order.status === 'pending' && ageMinutes > 5) {
        initialPriority = 'urgente';
      }

      const newConv: Conversation = {
        id: convId,
        conversation_id: convId,
        type: 'order',
        order_id: order.id,
        order_code: order.order_code,
        restaurant_id: order.restaurant_id,
        customer_id: order.customer_id,
        driver_id: order.driver_id || undefined,
        title: `Pedido ${order.order_code || order.id.slice(-6)} — ${order.restaurant_name}`,
        participants,
        participant_ids: participants.map((p) => p.id),
        status: 'active',
        priority: initialPriority,
        last_message: 'Canal de comunicación de pedido activado',
        last_message_at: now,
        unread_master: false,
        created_at: now,
        updated_at: now,
        closed_at: null,
      };

      await convCol.insertOne(newConv as any);
      conv = newConv;

      // Audit conversation creation
      await AuditService.log(
        'master.order_conversation_opened',
        'order',
        order.id,
        { conversation_id: convId, initialPriority },
        actor.id,
        'master'
      );
    }

    // Query messages
    const messages = await messagesCol
      .find({
        $or: [{ conversation_id: conv!.conversation_id }, { order_id: order.id }],
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Query evidence and incidents
    const evidence = await evidenceCol.find({ order_id: order.id }).toArray();
    const incidents = await incidentsCol.find({ order_id: order.id }).toArray();

    // Real Presence
    const presence = RealtimeService.getOrderPresence(order);

    return {
      order,
      conversation: conv!,
      messages,
      presence,
      evidence,
      incidents,
    };
  }

  /**
   * Start a Direct Chat (Master ↔ Client, Master ↔ Restaurant, Master ↔ Driver)
   */
  public static async createDirectConversation(
    targetUserId: string,
    actor: { id: string; name: string; role: string },
    options?: {
      initialMessage?: string;
      priority?: ConversationPriority;
      subject?: string;
    }
  ): Promise<ConversationWithPresence> {
    const usersCol = dbClient.getUsersCollection();
    const convCol = dbClient.getConversationsCollection();

    const targetUser = await usersCol.findOne({ id: targetUserId });
    if (!targetUser) {
      throw new Error(`Usuario destino ${targetUserId} no encontrado`);
    }

    // Check if an active direct conversation already exists between Master and Target
    let conv: Conversation | null = await convCol.findOne({
      type: 'direct',
      status: 'active',
      participant_ids: { $all: [actor.id, targetUser.id] },
    });

    const now = new Date().toISOString();

    if (!conv) {
      const convId = `conv_dir_${crypto.randomUUID()}`;
      const participants: ConversationParticipant[] = [
        {
          id: targetUser.id,
          role: targetUser.role,
          name: targetUser.name,
          phone: targetUser.phone,
        },
        {
          id: actor.id,
          role: 'master',
          name: actor.name || 'Operador Master NOC',
        },
      ];

      const newConv: Conversation = {
        id: convId,
        conversation_id: convId,
        type: 'direct',
        title: options?.subject || `Directo con ${targetUser.name} (${targetUser.role.toUpperCase()})`,
        participants,
        participant_ids: [targetUser.id, actor.id],
        status: 'active',
        priority: options?.priority || 'normal',
        last_message: options?.initialMessage || 'Conversación iniciada por Master',
        last_message_at: now,
        unread_master: false,
        created_at: now,
        updated_at: now,
        closed_at: null,
      };

      await convCol.insertOne(newConv as any);
      conv = newConv;

      await AuditService.log(
        'master.conversation_opened',
        'user',
        targetUser.id,
        {
          conversation_id: convId,
          target_role: targetUser.role,
          target_name: targetUser.name,
          priority: newConv.priority,
        },
        actor.id,
        'master'
      );
    }

    if (options?.initialMessage && options.initialMessage.trim()) {
      await this.sendMessage(conv!.conversation_id, options.initialMessage.trim(), actor);
    }

    return await this.getConversationById(conv!.conversation_id);
  }

  /**
   * Sovereign Message Sender: Uses JWT actor exclusively, persists to MongoDB and broadcasts via SSE
   */
  public static async sendMessage(
    conversationId: string,
    messageText: string,
    actor: { id: string; name: string; role: string }
  ): Promise<ChatMessage> {
    const convCol = dbClient.getConversationsCollection();
    const messagesCol = dbClient.getChatMessagesCollection();
    const orderMessagesCol = dbClient.getOrderMessagesCollection();

    const conv = await convCol.findOne({
      $or: [{ id: conversationId }, { conversation_id: conversationId }],
    });
    if (!conv) {
      throw new Error(`Conversación ${conversationId} no encontrada`);
    }

    const trimmedText = messageText.trim();
    if (!trimmedText) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const msgId = `msg_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Identify recipient if 1-on-1, or broadcast if order room
    let recipientId: string | undefined = undefined;
    let recipientRole: UserRole | undefined = undefined;
    if (conv.type === 'direct') {
      const other = conv.participants.find((p) => p.id !== actor.id);
      if (other) {
        recipientId = other.id;
        recipientRole = other.role;
      }
    }

    const chatMsg: ChatMessage = {
      id: msgId,
      message_id: msgId,
      conversation_id: conv.conversation_id,
      order_id: conv.order_id,
      sender_id: actor.id,
      sender_role: actor.role as UserRole,
      sender_name: actor.name || 'Operador Master',
      recipient_id: recipientId,
      recipient_role: recipientRole,
      message: trimmedText,
      priority: conv.priority,
      status: 'sent',
      timestamp: now,
      created_at: now,
      read_at: null,
    };

    await messagesCol.insertOne(chatMsg as any);

    // If linked to order, also insert into order_messages collection for client/driver compatibility
    if (conv.order_id) {
      await orderMessagesCol.insertOne({
        id: msgId,
        message_id: msgId,
        order_id: conv.order_id,
        sender_id: actor.id,
        sender_role: actor.role as any,
        sender_name: actor.name || 'Master',
        recipient_id: recipientId,
        message: trimmedText,
        created_at: now,
        read_at: null,
        timestamp: now,
      });
    }

    // Update conversation last message metadata
    await convCol.updateOne(
      { conversation_id: conv.conversation_id },
      {
        $set: {
          last_message: trimmedText,
          last_message_at: now,
          updated_at: now,
          unread_master: actor.role !== 'master',
        },
      }
    );

    // Audit action
    await AuditService.log(
      'master.message_sent',
      'conversation',
      conv.conversation_id,
      {
        message_id: msgId,
        order_id: conv.order_id,
        preview: trimmedText.slice(0, 80),
      },
      actor.id,
      actor.role
    );

    // Real-time SSE Broadcast
    RealtimeService.emit({
      type: 'MESSAGE_CREATED',
      order_id: conv.order_id,
      restaurant_id: conv.restaurant_id,
      driver_id: conv.driver_id,
      customer_id: conv.customer_id,
      data: {
        ...chatMsg,
        conversation_title: conv.title,
      },
      timestamp: now,
    });

    return chatMsg;
  }

  /**
   * Get all messages for conversation and mark unread as read
   */
  public static async getMessages(conversationId: string, actor: { id: string; role: string }): Promise<ChatMessage[]> {
    const messagesCol = dbClient.getChatMessagesCollection();
    const convCol = dbClient.getConversationsCollection();

    const messages = await messagesCol
      .find({
        $or: [{ conversation_id: conversationId }, { order_id: conversationId }],
      })
      .sort({ timestamp: 1 })
      .toArray();

    // If master is opening, mark unread_master = false
    if (actor.role === 'master') {
      await convCol.updateOne(
        { $or: [{ id: conversationId }, { conversation_id: conversationId }] },
        { $set: { unread_master: false } }
      );
    }

    return messages;
  }

  /**
   * Sovereign Priority Update
   */
  public static async updatePriority(
    conversationId: string,
    priority: ConversationPriority,
    actor: { id: string; name: string }
  ): Promise<Conversation> {
    const convCol = dbClient.getConversationsCollection();
    const conv = await convCol.findOne({
      $or: [{ id: conversationId }, { conversation_id: conversationId }],
    });
    if (!conv) {
      throw new Error(`Conversación ${conversationId} no encontrada`);
    }

    const previous = conv.priority;
    const now = new Date().toISOString();

    await convCol.updateOne(
      { conversation_id: conv.conversation_id },
      { $set: { priority, updated_at: now } }
    );

    await AuditService.log(
      'master.priority_changed',
      'conversation',
      conv.conversation_id,
      { previous, new_priority: priority },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'CONVERSATION_UPDATED',
      order_id: conv.order_id,
      restaurant_id: conv.restaurant_id,
      driver_id: conv.driver_id,
      customer_id: conv.customer_id,
      data: {
        conversation_id: conv.conversation_id,
        priority,
        updated_by: actor.name,
      },
      timestamp: now,
    });

    return (await convCol.findOne({ conversation_id: conv.conversation_id }))!;
  }

  /**
   * Close a conversation with reason and audit trail
   */
  public static async closeConversation(
    conversationId: string,
    reason: string,
    actor: { id: string; name: string }
  ): Promise<Conversation> {
    const convCol = dbClient.getConversationsCollection();
    const conv = await convCol.findOne({
      $or: [{ id: conversationId }, { conversation_id: conversationId }],
    });
    if (!conv) {
      throw new Error(`Conversación ${conversationId} no encontrada`);
    }

    const now = new Date().toISOString();

    await convCol.updateOne(
      { conversation_id: conv.conversation_id },
      {
        $set: {
          status: 'closed',
          closed_at: now,
          updated_at: now,
        },
      }
    );

    await AuditService.log(
      'master.conversation_closed',
      'conversation',
      conv.conversation_id,
      { reason, closed_at: now },
      actor.id,
      'master'
    );

    RealtimeService.emit({
      type: 'MESSAGE_CLOSED',
      order_id: conv.order_id,
      restaurant_id: conv.restaurant_id,
      driver_id: conv.driver_id,
      customer_id: conv.customer_id,
      data: {
        conversation_id: conv.conversation_id,
        status: 'closed',
        reason,
        closed_by: actor.name,
      },
      timestamp: now,
    });

    return (await convCol.findOne({ conversation_id: conv.conversation_id }))!;
  }
}
