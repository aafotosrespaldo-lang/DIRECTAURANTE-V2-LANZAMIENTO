import {
  Address,
  Category,
  FeesInfo,
  Order,
  Product,
  Restaurant,
  User,
  DriverOffer,
  DriverShiftSummary,
  DriverSettlement,
  OrderMessage,
  SupportTicket,
  DriverStatus,
  OrderEvidence,
  Conversation,
  ChatMessage,
  Incident,
  CommercialSolution,
  CommercialPlan,
  RestaurantEntitlement,
  SavedCard,
  SystemFinancialConfig,
} from '../types.ts';

class DirectApiClient {
  private baseUrl = '/api';
  private token: string | null = null;

  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('direct_token') : null;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('direct_token', token);
      } else {
        localStorage.removeItem('direct_token');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Error ${res.status}: ${res.statusText}`);
    }

    return json;
  }

  // --- Auth ---
  public async register(payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: 'customer' | 'driver' | 'restaurant' | string;
    vehicle_info?: string;
    vehicleInfo?: string;
    vehicle_type?: string;
    vehicleType?: string;
    restaurant_name?: string;
    restaurantName?: string;
  }): Promise<{ token: string; user: User }> {
    const res = await this.request<{ success: boolean; token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async login(payload: { email: string; password: string; expectedRole?: string }): Promise<{ token: string; user: User }> {
    const res = await this.request<{ success: boolean; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async verifyResetToken(params: { token?: string; code?: string; email?: string }): Promise<{ valid: boolean; email?: string }> {
    return this.request<{ valid: boolean; email?: string }>('/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async resetPassword(payload: { token?: string; code?: string; email?: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getMe(): Promise<User> {
    const res = await this.request<{ success: boolean; user: User }>('/auth/me');
    return res.user;
  }

  public async updateProfile(payload: { name?: string; phone?: string; profile_image?: string | null; birthday?: string | null }): Promise<User> {
    const res = await this.request<{ success: boolean; user: User }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.user;
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await this.request<{ success: boolean }>('/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } finally {
      this.setToken(null);
    }
  }

  // --- Restaurants & Catalog ---
  public async getRestaurants(params?: { category?: string; query?: string }): Promise<Restaurant[]> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.query) query.append('query', params.query);
    const qs = query.toString() ? `?${query.toString()}` : '';

    const res = await this.request<{ success: boolean; data: Restaurant[] }>(`/restaurants${qs}`);
    return res.data;
  }

  public async getRestaurantById(id: string): Promise<Restaurant> {
    const res = await this.request<{ success: boolean; data: Restaurant }>(`/restaurants/${id}`);
    return res.data;
  }

  public async getCategories(): Promise<Category[]> {
    const res = await this.request<{ success: boolean; data: Category[] }>('/categories');
    return res.data;
  }

  public async getRestaurantProducts(restaurantId: string): Promise<Product[]> {
    const res = await this.request<{ success: boolean; data: Product[] }>(`/restaurants/${restaurantId}/products`);
    return res.data;
  }

  // --- Customer Addresses ---
  public async getAddresses(): Promise<Address[]> {
    const res = await this.request<{ success: boolean; data: Address[] }>('/customer/addresses');
    return res.data;
  }

  public async createAddress(address: Omit<Address, 'id' | 'user_id'>): Promise<Address> {
    const res = await this.request<{ success: boolean; data: Address }>('/customer/addresses', {
      method: 'POST',
      body: JSON.stringify(address),
    });
    return res.data;
  }

  public async deleteAddress(id: string): Promise<void> {
    await this.request(`/customer/addresses/${id}`, { method: 'DELETE' });
  }

  // --- Customer Wallet & Cards ---
  public async getSavedCards(): Promise<SavedCard[]> {
    const res = await this.request<{ success: boolean; data: SavedCard[] }>('/customer/cards');
    return res.data;
  }

  public async createSavedCard(card: {
    brand: 'visa' | 'mastercard' | 'amex' | 'otro';
    last4: string;
    holder_name: string;
    exp_month: string;
    exp_year: string;
    card_type?: 'credito' | 'debito';
    is_default?: boolean;
  }): Promise<SavedCard> {
    const res = await this.request<{ success: boolean; data: SavedCard }>('/customer/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
    return res.data;
  }

  public async deleteSavedCard(id: string): Promise<void> {
    await this.request(`/customer/cards/${id}`, { method: 'DELETE' });
  }

  public async setDefaultSavedCard(id: string): Promise<void> {
    await this.request(`/customer/cards/${id}/default`, { method: 'PUT' });
  }

  // --- Orders ---
  public async getFees(): Promise<FeesInfo> {
    const res = await this.request<{ success: boolean; data: FeesInfo }>('/checkout/fees');
    return res.data;
  }

  public async createOrder(orderPayload: any, idempotencyKey?: string): Promise<{ order: Order; isDuplicate: boolean }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }

    const res = await this.request<{ success: boolean; data: Order; is_duplicate: boolean }>('/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload),
    });

    return { order: res.data, isDuplicate: res.is_duplicate };
  }

  public async getMyOrders(): Promise<Order[]> {
    const res = await this.request<{ success: boolean; data: Order[] }>('/orders');
    return res.data;
  }

  public async getOrderById(id: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/orders/${id}`);
    return res.data;
  }

  // --- Restaurant Portal Operations ---
  public async getRestaurantOrders(restaurantId?: string): Promise<Order[]> {
    const qs = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
    const res = await this.request<{ success: boolean; data: Order[] }>(`/restaurant/orders${qs}`);
    return res.data;
  }

  public async acceptOrder(id: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/restaurant/orders/${id}/accept`, {
      method: 'POST',
    });
    return res.data;
  }

  public async rejectOrder(id: string, reason?: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/restaurant/orders/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  public async updateOrderStatus(id: string, status: string, notes?: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/restaurant/orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
    return res.data;
  }

  public async acceptRestaurantOrder(id: string): Promise<Order> {
    return this.acceptOrder(id);
  }

  public async rejectRestaurantOrder(id: string, reason?: string): Promise<Order> {
    return this.rejectOrder(id, reason);
  }

  public async updateRestaurantOrderStatus(id: string, status: string, notes?: string): Promise<Order> {
    return this.updateOrderStatus(id, status, notes);
  }

  public async getRestaurantCrmNotes(restaurantId?: string): Promise<Record<string, string>> {
    try {
      const qs = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
      const res = await this.request<{ success: boolean; data: Record<string, string> }>(`/restaurant/crm/notes${qs}`);
      return res.data || {};
    } catch {
      return {};
    }
  }

  public async saveRestaurantCrmNote(customerId: string, notes: string, restaurantId?: string): Promise<void> {
    await this.request('/restaurant/crm/notes', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, notes, restaurant_id: restaurantId }),
    });
  }

  // --- Driver API Operations ---
  public async getDriverProfile(): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/driver/profile');
    return res.data;
  }

  public async updateDriverStatus(status: DriverStatus, location?: { latitude: number; longitude: number; address?: string }): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/driver/status', {
      method: 'PUT',
      body: JSON.stringify({ status, location }),
    });
    return res.data;
  }

  public async updateDriverLocation(latitude: number, longitude: number, address?: string): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/driver/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, address }),
    });
    return res.data;
  }

  public async getCurrentOffer(): Promise<DriverOffer | null> {
    const res = await this.request<{ success: boolean; data: DriverOffer | null }>('/driver/offers/current');
    return res.data;
  }

  public async acceptOffer(offerId: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/driver/offers/${offerId}/accept`, {
      method: 'POST',
    });
    return res.data;
  }

  public async rejectOffer(offerId: string, reason?: string): Promise<void> {
    await this.request(`/driver/offers/${offerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async getCurrentDriverOrder(): Promise<Order | null> {
    const res = await this.request<{ success: boolean; data: Order | null }>('/driver/orders/current');
    return res.data;
  }

  public async markDriverArrived(orderId: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/driver/orders/${orderId}/arrived`, {
      method: 'POST',
    });
    return res.data;
  }

  public async markDriverPickup(orderId: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/driver/orders/${orderId}/pickup`, {
      method: 'POST',
    });
    return res.data;
  }

  public async startDriverDelivering(orderId: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/driver/orders/${orderId}/delivering`, {
      method: 'POST',
    });
    return res.data;
  }

  public async completeDriverDelivery(orderId: string, notes?: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/driver/orders/${orderId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    return res.data;
  }

  public async getShiftSummary(): Promise<DriverShiftSummary> {
    const res = await this.request<{ success: boolean; data: DriverShiftSummary }>('/driver/shift/summary');
    return res.data;
  }

  public async closeShift(notes?: string): Promise<DriverSettlement> {
    const res = await this.request<{ success: boolean; data: DriverSettlement }>('/driver/shift/close', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    return res.data;
  }

  public async uploadDepositProof(payload: { settlement_id: string; deposit_amount?: number; proof_url: string; notes?: string }): Promise<DriverSettlement> {
    const res = await this.request<{ success: boolean; data: DriverSettlement }>('/driver/shift/deposit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async getDriverDepositBankInfo(): Promise<{
    bank_name: string;
    account_holder: string;
    clabe_or_account: string;
    instructions: string;
  }> {
    const res = await this.request<{
      success: boolean;
      data: {
        bank_name: string;
        account_holder: string;
        clabe_or_account: string;
        instructions: string;
      };
    }>('/driver/deposit-bank-info');
    return res.data;
  }

  public async getDriverSettlements(): Promise<DriverSettlement[]> {
    const res = await this.request<{ success: boolean; data: DriverSettlement[] }>('/driver/settlements');
    return res.data;
  }

  public async getMasterSettlements(filters?: { driver_id?: string; deposit_status?: string }): Promise<DriverSettlement[]> {
    const params = new URLSearchParams();
    if (filters?.driver_id) params.set('driver_id', filters.driver_id);
    if (filters?.deposit_status) params.set('deposit_status', filters.deposit_status);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ success: boolean; data: DriverSettlement[] }>(`/master/settlements${q}`);
    return res.data;
  }

  public async reviewMasterDeposit(
    settlementId: string,
    status: 'confirmed' | 'rejected',
    notes?: string,
    verified_amount?: number,
    discrepancy_notes?: string,
    is_reconciled?: boolean
  ): Promise<DriverSettlement> {
    const res = await this.request<{ success: boolean; data: DriverSettlement }>(`/master/settlements/${settlementId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes, verified_amount, discrepancy_notes, is_reconciled }),
    });
    return res.data;
  }

  public async getDriverOrderHistory(): Promise<Order[]> {
    const res = await this.request<{ success: boolean; data: Order[] }>('/driver/orders/history');
    return res.data;
  }

  public async getOrderMessages(orderId: string): Promise<OrderMessage[]> {
    const res = await this.request<{ success: boolean; data: OrderMessage[] }>(`/orders/${orderId}/messages`);
    return res.data;
  }

  public async sendOrderMessage(orderId: string, message: string): Promise<OrderMessage> {
    const res = await this.request<{ success: boolean; data: OrderMessage }>(`/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return res.data;
  }

  public async getOrderEvidence(orderId: string): Promise<any[]> {
    const res = await this.request<{ success: boolean; data: any[] }>(`/orders/${orderId}/evidence`);
    return res.data;
  }

  public async uploadOrderEvidence(orderId: string, payload: { type: string; file_url: string; notes?: string }): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>(`/orders/${orderId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async getRestaurantSalesSummary(restaurantId?: string): Promise<any> {
    const query = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
    const res = await this.request<{ success: boolean; data: any }>(`/restaurant/sales-summary${query}`);
    return res.data;
  }

  public async getRestaurantInventory(restaurantId?: string): Promise<Product[]> {
    const query = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
    const res = await this.request<{ success: boolean; data: Product[] }>(`/restaurant/inventory${query}`);
    return res.data;
  }

  public async updateRestaurantInventory(productId: string, data: { stock?: number | null; is_available?: boolean; low_stock_threshold?: number; image_url?: string }): Promise<Product> {
    const res = await this.request<{ success: boolean; data: Product }>(`/restaurant/inventory/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async getRestaurantProfile(): Promise<Restaurant> {
    const res = await this.request<{ success: boolean; data: Restaurant }>('/restaurant/profile');
    return res.data;
  }

  public async updateRestaurantProfile(data: Partial<Restaurant>): Promise<Restaurant> {
    const res = await this.request<{ success: boolean; data: Restaurant }>('/restaurant/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async toggleRestaurantClosed(isTemporarilyClosed?: boolean): Promise<{ success: boolean; data: Restaurant; message: string }> {
    const res = await this.request<{ success: boolean; data: Restaurant; message: string }>('/restaurant/toggle-closed', {
      method: 'PUT',
      body: JSON.stringify({ is_temporarily_closed: isTemporarilyClosed }),
    });
    return res;
  }

  public async updateUserProfile(data: { name?: string; phone?: string; profile_image?: string | null; birthday?: string | null; allergies?: string; vehicle_info?: string }): Promise<User> {
    const res = await this.request<{ success: boolean; user: User }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.user;
  }

  public async createSupportTicket(ticket: { category: string; description: string; order_id?: string; priority?: 'normal' | 'urgent' }): Promise<SupportTicket> {
    const res = await this.request<{ success: boolean; data: SupportTicket }>('/driver/support/ticket', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
    return res.data;
  }

  public async getSupportTickets(): Promise<SupportTicket[]> {
    const res = await this.request<{ success: boolean; data: SupportTicket[] }>('/driver/support/tickets');
    return res.data;
  }

  public async triggerDispatch(orderId: string): Promise<DriverOffer | null> {
    const res = await this.request<{ success: boolean; data: DriverOffer | null }>('/driver/dispatch/trigger', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId }),
    });
    return res.data;
  }

  // --- Master NOC 24/7 Operations Endpoints ---
  public async getMasterOverview(): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/master/overview');
    return res.data;
  }

  public async getMasterOrders(filters?: { status?: string; restaurant_id?: string; search?: string; limit?: number }): Promise<Order[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.restaurant_id) params.set('restaurant_id', filters.restaurant_id);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ success: boolean; data: Order[] }>(`/master/orders${q}`);
    return res.data;
  }

  public async masterForceOrderStatus(orderId: string, status: string, reason: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order; message: string }>(`/master/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
    return res.data;
  }

  public async masterAssignDriver(orderId: string, driverId: string): Promise<Order> {
    const res = await this.request<{ success: boolean; data: Order }>(`/master/orders/${orderId}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    });
    return res.data;
  }

  public async getMasterDrivers(): Promise<User[]> {
    const res = await this.request<{ success: boolean; data: User[] }>('/master/drivers');
    return res.data;
  }

  public async masterUpdateDriver(driverId: string, updates: { is_active?: boolean; is_verified?: boolean; driver_status?: string }): Promise<User> {
    const res = await this.request<{ success: boolean; data: User }>(`/master/drivers/${driverId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.data;
  }

  public async getMasterRestaurants(): Promise<any[]> {
    const res = await this.request<{ success: boolean; data: any[] }>('/master/restaurants');
    return res.data;
  }

  public async masterToggleRestaurant(restaurantId: string, is_active: boolean): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>(`/master/restaurants/${restaurantId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
    return res.data;
  }

  public async getMasterEvidence(limit = 100): Promise<OrderEvidence[]> {
    const res = await this.request<{ success: boolean; data: OrderEvidence[] }>(`/master/evidence?limit=${limit}`);
    return res.data;
  }

  public async getMasterAuditLogs(limit = 100): Promise<any[]> {
    const res = await this.request<{ success: boolean; data: any[] }>(`/master/audit-logs?limit=${limit}`);
    return res.data;
  }

  public async masterBroadcastAlert(title: string, message: string, target_role = 'all'): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/master/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, message, target_role }),
    });
    return res.data;
  }

  // --- Master 24/7 Communication Center ---
  public async getMasterConversations(filters?: {
    status?: string;
    priority?: string;
    type?: string;
    order_id?: string;
    search?: string;
    limit?: number;
  }): Promise<(Conversation & { presence: Record<string, boolean> })[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.order_id) params.set('order_id', filters.order_id);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ success: boolean; data: any[] }>(`/master/communications/conversations${q}`);
    return res.data;
  }

  public async getMasterConversation(conversationId: string): Promise<Conversation & { presence: Record<string, boolean> }> {
    const res = await this.request<{ success: boolean; data: any }>(`/master/communications/conversations/${conversationId}`);
    return res.data;
  }

  public async getMasterMessages(conversationId: string): Promise<ChatMessage[]> {
    const res = await this.request<{ success: boolean; data: ChatMessage[] }>(`/master/communications/conversations/${conversationId}/messages`);
    return res.data;
  }

  public async sendMasterMessage(conversationId: string, message: string): Promise<ChatMessage> {
    const res = await this.request<{ success: boolean; data: ChatMessage }>(`/master/communications/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return res.data;
  }

  public async updateMasterConversationPriority(conversationId: string, priority: string): Promise<Conversation> {
    const res = await this.request<{ success: boolean; data: Conversation }>(`/master/communications/conversations/${conversationId}/priority`, {
      method: 'PUT',
      body: JSON.stringify({ priority }),
    });
    return res.data;
  }

  public async closeMasterConversation(conversationId: string, reason?: string): Promise<Conversation> {
    const res = await this.request<{ success: boolean; data: Conversation }>(`/master/communications/conversations/${conversationId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  public async startMasterDirectConversation(
    target_user_id: string,
    initial_message?: string,
    priority?: string,
    subject?: string
  ): Promise<Conversation & { presence: Record<string, boolean> }> {
    const res = await this.request<{ success: boolean; data: any }>('/master/communications/direct', {
      method: 'POST',
      body: JSON.stringify({ target_user_id, initial_message, priority, subject }),
    });
    return res.data;
  }

  public async getMasterOrderCommunication(orderId: string): Promise<{
    order: Order;
    conversation: Conversation;
    messages: ChatMessage[];
    presence: { customer: boolean; restaurant: boolean; driver: boolean; master: boolean };
    evidence: OrderEvidence[];
    incidents: Incident[];
  }> {
    const res = await this.request<{ success: boolean; data: any }>(`/master/communications/order/${orderId}`);
    return res.data;
  }

  // --- Master Support & Incidents ---
  public async getMasterIncidents(filters?: {
    status?: string;
    severity?: string;
    order_id?: string;
    search?: string;
    limit?: number;
  }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.order_id) params.set('order_id', filters.order_id);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ success: boolean; data: Incident[] }>(`/master/incidents${q}`);
    return res.data;
  }

  public async createMasterIncident(data: {
    title: string;
    description: string;
    entity_type: string;
    entity_id: string;
    order_id?: string;
    order_code?: string;
    severity: string;
  }): Promise<Incident> {
    const res = await this.request<{ success: boolean; data: Incident }>('/master/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async updateMasterIncident(
    incidentId: string,
    updates: { status?: string; severity?: string; resolution_notes?: string }
  ): Promise<Incident> {
    const res = await this.request<{ success: boolean; data: Incident }>(`/master/incidents/${incidentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.data;
  }

  public async getMasterSupportOverview(): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/master/support/overview');
    return res.data;
  }

  // --- Master Commercial Solutions & Plans ---
  public async getMasterCommercialOverview(): Promise<any> {
    const res = await this.request<{ success: boolean; data: any }>('/master/commercial/overview');
    return res.data;
  }

  public async getMasterCommercialSolutions(product?: string): Promise<CommercialSolution[]> {
    const q = product ? `?product=${product}` : '';
    const res = await this.request<{ success: boolean; data: CommercialSolution[] }>(`/master/commercial/solutions${q}`);
    return res.data;
  }

  public async getMasterCommercialPlans(product?: string): Promise<CommercialPlan[]> {
    const q = product ? `?product=${product}` : '';
    const res = await this.request<{ success: boolean; data: CommercialPlan[] }>(`/master/commercial/plans${q}`);
    return res.data;
  }

  public async getMasterRestaurantEntitlements(restaurantId: string): Promise<any[]> {
    const res = await this.request<{ success: boolean; data: any[] }>(`/master/commercial/restaurants/${restaurantId}/entitlements`);
    return res.data;
  }

  public async masterAssignPlan(restaurantId: string, plan_id: string): Promise<any> {
    const res = await this.request<{ success: boolean; data: any; message: string }>(`/master/commercial/restaurants/${restaurantId}/plan`, {
      method: 'POST',
      body: JSON.stringify({ plan_id }),
    });
    return res.data;
  }

  public async masterGrantTrial(restaurantId: string, solution_id: string, days = 15): Promise<RestaurantEntitlement> {
    const res = await this.request<{ success: boolean; data: RestaurantEntitlement; message: string }>(`/master/commercial/restaurants/${restaurantId}/trial`, {
      method: 'POST',
      body: JSON.stringify({ solution_id, days }),
    });
    return res.data;
  }

  public async masterUpdateRestaurantSubscription(
    restaurantId: string,
    params: {
      subscription_status: 'active' | 'trial' | 'expired' | 'none' | 'lifetime' | 'paused';
      trial_days?: number;
      trial_ends_at?: string | null;
      plan_id?: string | null;
      subscription_plan_name?: string | null;
      subscription_price_cents?: number | null;
      subscription_billing_period?: string | null;
      subscription_starts_at?: string | null;
      subscription_ends_at?: string | null;
      subscription_notes?: string | null;
      subscription_limits?: {
        max_orders_month?: number;
        max_products?: number;
        max_staff?: number;
        max_tables?: number;
      } | null;
      solutions?: string[];
    }
  ): Promise<{ success: boolean; data: Restaurant; message: string }> {
    const res = await this.request<{ success: boolean; data: Restaurant; message: string }>(
      `/master/commercial/restaurants/${restaurantId}/subscription`,
      {
        method: 'PUT',
        body: JSON.stringify(params),
      }
    );
    return res;
  }

  public async masterToggleEntitlement(restaurantId: string, solutionId: string, status: string): Promise<RestaurantEntitlement> {
    const res = await this.request<{ success: boolean; data: RestaurantEntitlement; message: string }>(`/master/commercial/restaurants/${restaurantId}/entitlements/${solutionId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res.data;
  }

  public async getMasterUsers(role?: string, search?: string): Promise<User[]> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ success: boolean; data: User[] }>(`/master/users${q}`);
    return res.data;
  }

  // --- Restaurant Product Full CRUD ---
  public async createRestaurantProduct(data: Partial<Product>): Promise<Product> {
    const res = await this.request<{ success: boolean; data: Product; message: string }>('/restaurant/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async updateRestaurantProduct(productId: string, data: Partial<Product>): Promise<Product> {
    const res = await this.request<{ success: boolean; data: Product; message: string }>(`/restaurant/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async deleteRestaurantProduct(productId: string): Promise<boolean> {
    await this.request<{ success: boolean; message: string }>(`/restaurant/products/${productId}`, {
      method: 'DELETE',
    });
    return true;
  }

  // --- Master Commercial CRUD ---
  public async createMasterCommercialSolution(data: Partial<CommercialSolution>): Promise<CommercialSolution> {
    const res = await this.request<{ success: boolean; data: CommercialSolution; message: string }>('/master/commercial/solutions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async updateMasterCommercialSolution(solutionId: string, data: Partial<CommercialSolution>): Promise<CommercialSolution> {
    const res = await this.request<{ success: boolean; data: CommercialSolution; message: string }>(`/master/commercial/solutions/${solutionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async deleteMasterCommercialSolution(solutionId: string): Promise<boolean> {
    await this.request<{ success: boolean; message: string }>(`/master/commercial/solutions/${solutionId}`, {
      method: 'DELETE',
    });
    return true;
  }

  public async createMasterCommercialPlan(data: Partial<CommercialPlan>): Promise<CommercialPlan> {
    const res = await this.request<{ success: boolean; data: CommercialPlan; message: string }>('/master/commercial/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async updateMasterCommercialPlan(planId: string, data: Partial<CommercialPlan>): Promise<CommercialPlan> {
    const res = await this.request<{ success: boolean; data: CommercialPlan; message: string }>(`/master/commercial/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async deleteMasterCommercialPlan(planId: string): Promise<boolean> {
    await this.request<{ success: boolean; message: string }>(`/master/commercial/plans/${planId}`, {
      method: 'DELETE',
    });
    return true;
  }

  // --- Master Financial Configuration ---
  public async getMasterFinancialConfig(): Promise<SystemFinancialConfig> {
    const res = await this.request<{ success: boolean; data: SystemFinancialConfig }>('/master/financial-config');
    return res.data;
  }

  public async updateMasterFinancialConfig(updates: Partial<SystemFinancialConfig>): Promise<SystemFinancialConfig> {
    const res = await this.request<{ success: boolean; data: SystemFinancialConfig; message: string }>('/master/financial-config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.data;
  }

  public async getMasterFinancialAudit(): Promise<any[]> {
    const res = await this.request<{ success: boolean; data: any[] }>('/master/financial-config/audit');
    return res.data;
  }

  // --- Customer Support Tickets ---
  public async getCustomerSupportTickets(): Promise<SupportTicket[]> {
    const res = await this.request<{ success: boolean; data: SupportTicket[] }>('/customer/support/tickets');
    return res.data;
  }

  public async createCustomerSupportTicket(data: { category: string; description: string; order_id?: string; priority?: 'normal' | 'urgent' }): Promise<SupportTicket> {
    const res = await this.request<{ success: boolean; data: SupportTicket; message: string }>('/customer/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  // --- Mercado Pago Marketplace ---
  public async getMercadoPagoConfig(): Promise<{ mode: string; public_key: string; is_configured: boolean }> {
    const res = await this.request<{ success: boolean; data: { mode: string; public_key: string; is_configured: boolean } }>('/payments/mercadopago/config');
    return res.data;
  }

  public async createPaymentPreference(orderId: string, idempotencyKey?: string): Promise<{
    preference_id: string;
    init_point: string;
    sandbox_init_point: string;
    amount_cents: number;
    marketplace_fee_cents: number;
    is_duplicate: boolean;
  }> {
    const res = await this.request<{
      success: boolean;
      data: {
        preference_id: string;
        init_point: string;
        sandbox_init_point: string;
        amount_cents: number;
        marketplace_fee_cents: number;
        is_duplicate: boolean;
      };
    }>(`/payments/mercadopago/preference/${orderId}`, {
      method: 'POST',
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
      body: JSON.stringify({ idempotency_key: idempotencyKey }),
    });
    return res.data;
  }

  public async processMercadoPagoPayment(data: {
    order_id: string;
    token: string;
    payment_method_id?: string;
    issuer_id?: string;
    installments?: number;
    payer?: {
      email?: string;
      identification?: { type: string; number: string };
    };
    idempotency_key?: string;
  }): Promise<{
    payment_id: string;
    status: 'approved' | 'in_process' | 'rejected' | 'pending';
    status_detail?: string;
    amount_cents: number;
    order_id: string;
    is_duplicate: boolean;
    date_approved?: string;
  }> {
    const res = await this.request<{
      success: boolean;
      data: {
        payment_id: string;
        status: 'approved' | 'in_process' | 'rejected' | 'pending';
        status_detail?: string;
        amount_cents: number;
        order_id: string;
        is_duplicate: boolean;
        date_approved?: string;
      };
    }>('/payments/mercadopago/process', {
      method: 'POST',
      headers: data.idempotency_key ? { 'x-idempotency-key': data.idempotency_key } : undefined,
      body: JSON.stringify(data),
    });
    return res.data;
  }

  public async getRestaurantMercadoPagoStatus(restaurantId?: string): Promise<{
    is_connected: boolean;
    collector_id?: string;
    nickname?: string;
    connected_at?: string;
  }> {
    const query = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
    const res = await this.request<{
      success: boolean;
      data: { is_connected: boolean; collector_id?: string; nickname?: string; connected_at?: string };
    }>(`/restaurant/mercadopago/status${query}`);
    return res.data;
  }

  public async getRestaurantMercadoPagoAuthUrl(restaurantId?: string): Promise<{ url: string; state: string }> {
    const query = restaurantId ? `?restaurant_id=${encodeURIComponent(restaurantId)}` : '';
    const res = await this.request<{ success: boolean; data: { url: string; state: string } }>(
      `/restaurant/mercadopago/auth-url${query}`
    );
    return res.data;
  }

  public async disconnectRestaurantMercadoPago(restaurantId?: string): Promise<boolean> {
    await this.request<{ success: boolean; message: string }>('/restaurant/mercadopago/disconnect', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: restaurantId }),
    });
    return true;
  }
}

export const directApi = new DirectApiClient();
