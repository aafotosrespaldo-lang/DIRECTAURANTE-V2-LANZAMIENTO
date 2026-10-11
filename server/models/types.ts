export type UserRole = 'customer' | 'restaurant' | 'driver' | 'master';

export type DriverAvailability = 'offline' | 'available' | 'busy' | 'paused';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
  address?: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone: string;
  profile_image: string | null;
  birthday: string | null;
  birthdate?: string | null;
  allergies?: string;
  avatar_url?: string | null;
  is_active: boolean;
  driver_status?: DriverAvailability;
  current_location?: DriverLocation;
  is_verified?: boolean;
  vehicle_info?: string;
  vehicle_type?: 'automovil' | 'motocicleta' | 'bicicleta' | 'a_pie';
  documents?: {
    ine_front_url?: string;
    ine_back_url?: string;
    proof_of_address_url?: string;
    proof_of_address_date?: string; // Max 3 months old
    circulation_card_url?: string; // Only required for motorized vehicles (automovil, motocicleta)
    status?: 'pending' | 'approved' | 'rejected';
    reviewed_at?: string;
    notes?: string;
  };
  token_version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RevokedToken {
  token_hash: string;
  user_id: string;
  revoked_at: string;
  expires_at: Date;
}

export interface PasswordReset {
  id: string;
  email: string;
  user_id: string;
  token_hash: string;
  code_hash: string;
  attempts: number;
  used: boolean;
  expires_at: Date;
  created_at: string;
}

export interface UserPublicProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  profile_image: string | null;
  birthday: string | null;
  birthdate?: string | null;
  allergies?: string;
  avatar_url?: string | null;
  is_active: boolean;
}

export type DayScheduleConfig = {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  raw?: string;
};

export interface RestaurantSchedule {
  [day: string]: string | DayScheduleConfig | undefined;
  monday?: string | DayScheduleConfig;
  tuesday?: string | DayScheduleConfig;
  wednesday?: string | DayScheduleConfig;
  thursday?: string | DayScheduleConfig;
  friday?: string | DayScheduleConfig;
  saturday?: string | DayScheduleConfig;
  sunday?: string | DayScheduleConfig;
}

export interface Restaurant {
  id: string;
  owner_id?: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string;
  banner_url: string;
  rating: number;
  is_active: boolean;
  is_open?: boolean;
  is_temporarily_closed?: boolean;
  subscription_status?: 'active' | 'trial' | 'expired' | 'none' | 'lifetime' | 'paused';
  subscription_plan_id?: string | null;
  subscription_plan_name?: string | null;
  subscription_price_cents?: number | null;
  subscription_billing_period?: 'monthly' | 'annual' | 'quarterly' | 'semiannual' | 'lifetime' | string | null;
  subscription_starts_at?: string | null;
  subscription_ends_at?: string | null;
  trial_ends_at?: string | null;
  subscription_notes?: string | null;
  subscription_limits?: {
    max_orders_month?: number;
    max_products?: number;
    max_staff?: number;
    max_tables?: number;
  } | null;
  is_out_of_service?: boolean;
  out_of_service_reason?: 'temporarily_closed' | 'subscription_expired' | 'schedule_closed' | 'inactive';
  out_of_service_label?: string;
  delivery_fee: number; // in cents
  delivery_time_min: number | null;
  delivery_time_max: number | null;
  distance_km: number | null;
  min_order: number; // in cents
  schedule?: RestaurantSchedule;
  category_tags: string[];
  mercadopago_account?: RestaurantMercadoPagoAccount;
  delivery_mode?: 'platform_fleet' | 'local_driver';
  local_driver_name?: string;
  local_driver_phone?: string;
  createdAt: string;
}

export interface RestaurantMercadoPagoAccount {
  collector_id: string; // Mercado Pago Seller ID (user_id)
  nickname?: string;
  email?: string;
  access_token: string; // Encriptado en reposo
  refresh_token?: string; // Encriptado en reposo
  public_key?: string;
  token_expires_at?: string;
  connected_at: string;
  is_active: boolean;
  scope?: string;
  live_mode?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sort_order: number;
}

export interface ProductVariantOption {
  id: string;
  name: string;
  price_delta: number; // in cents (can be 0 or positive)
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: ProductVariantOption[];
}

export interface ProductTopping {
  id: string;
  name: string;
  price: number; // in cents
  is_available: boolean;
}

export interface Product {
  id: string;
  product_id?: string; // Universal ID alias
  restaurant_id: string;
  name: string;
  description: string;
  price: number; // in cents
  category: string;
  image_url: string;
  is_available: boolean;
  stock?: number | null; // Mini inventory: available quantity (null = unlimited)
  low_stock_threshold?: number; // Mini inventory: low stock alert threshold (default 3)
  variants: ProductVariantGroup[];
  toppings: ProductTopping[];
  createdAt: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string; // e.g. "Casa", "Trabajo"
  street: string;
  number: string;
  colony: string;
  city: string;
  state: string;
  postal_code: string;
  references: string;
  is_default: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
}

export type OrderType = 'delivery' | 'pickup';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'digital';
export type PaymentStatus = 'pending' | 'proof_uploaded' | 'approved' | 'rejected';

export interface OrderItemVariantSelection {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta: number; // in cents
}

export interface OrderItemToppingSelection {
  id: string;
  name: string;
  price: number; // in cents
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number; // in cents (Core validated)
  quantity: number;
  variants: OrderItemVariantSelection[];
  toppings: OrderItemToppingSelection[];
  notes?: string;
  subtotal: number; // in cents: (unit_price + sum(variant) + sum(toppings)) * quantity
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  actor_id?: string;
  actor_role?: string;
  notes?: string;
}

export interface Order {
  id: string;
  folio?: string; // Human-readable unique persistent shared folio (e.g. D101, D102)
  order_id?: string; // Universal ID alias
  order_code?: string; // Human readable tracking code (e.g. DIR-5824)
  idempotency_key: string;
  restaurant_id: string;
  restaurant_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  address_id: string | null;
  delivery_address: string | null;
  items: OrderItem[];
  subtotal: number; // in cents
  extras_total: number; // in cents
  delivery_fee: number; // in cents (0 if pickup)
  service_fee: number; // in cents
  tip_amount: number; // in cents
  discount_amount: number; // in cents
  total: number; // in cents
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  driver_id?: string | null;
  driver_name?: string | null;
  restaurant_commission?: number; // in cents: applied fee from financial config
  driver_payment?: number; // in cents: applied driver fee from financial config
  has_allergies: boolean;
  allergies?: string;
  notes?: string;
  promo_code?: string;
  mercadopago_payment_id?: string;
  mercadopago_preference_id?: string;
  mercadopago_status?: string;
  mercadopago_fee_cents?: number;
  inventory_deducted?: boolean; // Idempotency protection for inventory deduction
  status_history: OrderStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttempt {
  id: string; // pay_att_uuid
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  idempotency_key: string;
  preference_id?: string;
  payment_id?: string;
  amount_cents: number;
  currency: string;
  status: 'initiated' | 'pending' | 'approved' | 'rejected' | 'failed';
  marketplace_fee_cents: number;
  mp_status_detail?: string;
  init_point?: string;
  sandbox_init_point?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessedWebhook {
  id: string;
  event_id: string;
  action?: string;
  topic?: string;
  resource_id: string;
  status: string;
  processed_at: string;
  signature_verified: boolean;
}

export interface AuditLog {
  id: string;
  event: string;
  entity_type: string;
  entity_id: string;
  actor_id?: string;
  actor_role?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface DriverOffer {
  id: string;
  order_id: string;
  folio?: string; // Human-readable order folio (e.g. D101)
  driver_id: string;
  restaurant_id: string;
  restaurant_name: string;
  delivery_address: string;
  order_total: number; // in cents
  driver_earnings: number; // in cents
  distance_km: number;
  attempt_number: number;
  offered_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'superseded';
  reject_reason?: string;
}

export interface DriverShift {
  id: string;
  driver_id: string;
  started_at: string;
  closed_at?: string;
  status: 'active' | 'closed';
  initial_location?: DriverLocation;
}

export interface DriverSettlement {
  id: string;
  driver_id: string;
  shift_id: string;
  closed_at: string;
  orders_completed: number;
  orders_cancelled: number;
  offers_rejected: number;
  offers_expired: number;
  cash_collected: number; // in cents
  digital_total: number; // in cents
  tips_total: number; // in cents
  earnings_total: number; // in cents
  net_balance: number; // in cents: cash_collected minus earnings
  discrepancies?: string;
  notes?: string;
  // Deposit and voucher reconciliation
  deposit_amount?: number; // in cents
  deposit_proof_url?: string;
  deposit_date?: string;
  deposit_status?: 'pending_proof' | 'deposit_uploaded' | 'confirmed' | 'rejected';
  deposit_reviewed_by?: string;
  deposit_reviewed_at?: string;
  deposit_notes?: string;
  deposit_verified_amount?: number; // Monto real verificado por Master en centavos
  discrepancy_amount?: number; // Diferencia detectada (ej. deposit_amount - verified_amount) en centavos
  discrepancy_notes?: string; // Observaciones de la diferencia registradas por Master
  is_reconciled?: boolean; // Indica si fue conciliado con reglas autorizadas
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  message_id?: string; // Universal ID alias
  order_id: string;
  sender_id: string;
  sender_role: 'driver' | 'customer' | 'restaurant' | 'master';
  sender_name: string;
  recipient_id?: string;
  message: string;
  created_at?: string;
  read_at?: string | null;
  timestamp: string; // ISO string
}

export interface SupportTicket {
  id: string;
  user_id?: string;
  user_name?: string;
  user_role?: UserRole;
  driver_id?: string;
  driver_name?: string;
  order_id?: string;
  category: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  priority: 'normal' | 'urgent';
  createdAt: string;
}

export interface SystemFinancialConfig {
  id: string; // 'financial_settings'
  restaurant_commission_cents: number; // default: 1000 ($10 MXN)
  driver_payment_cents: number; // default: 2000 ($20 MXN)
  default_delivery_fee_cents: number; // default: 2500 ($25 MXN)
  is_commission_active: boolean; // default: true
  currency: string;
  default_trial_days: number; // default: 15 days
  enforce_subscription_check: boolean; // default: true
  deposit_bank_name?: string; // Nombre del Banco (ej. BBVA)
  deposit_account_holder?: string; // Titular de la cuenta
  deposit_clabe_or_account?: string; // CLABE interbancaria o número de cuenta
  deposit_instructions?: string; // Instrucciones adicionales para el repartidor
  allow_local_drivers?: boolean; // default: true
  local_driver_delivery_fee_cents?: number; // default: 0
  updated_at: string;
  updated_by?: string;
}

export type EvidenceType =
  | 'transfer_proof'
  | 'order_pickup'
  | 'delivery'
  | 'incident'
  | 'product'
  | 'other';

export interface OrderEvidence {
  id: string;
  evidence_id: string; // Universal ID alias
  order_id: string;
  uploaded_by: string; // user_id
  role: UserRole;
  type: EvidenceType;
  file_url: string;
  notes?: string;
  created_at: string;
}

export interface DeviceRegistration {
  id: string;
  device_id: string;
  user_id: string;
  platform: 'web' | 'android' | 'ios';
  push_token: string;
  last_seen: string;
  is_active: boolean;
  created_at: string;
}

// Master Communication Types
export type ConversationPriority = 'normal' | 'importante' | 'urgente' | 'critica';
export type ConversationStatus = 'active' | 'pending' | 'closed';
export type ConversationType = 'direct' | 'order';

export interface ConversationParticipant {
  id: string;
  role: UserRole;
  name: string;
  phone?: string;
  restaurant_id?: string;
}

export interface Conversation {
  id: string;
  conversation_id: string;
  type: ConversationType;
  order_id?: string;
  order_code?: string;
  restaurant_id?: string;
  customer_id?: string;
  driver_id?: string;
  title: string;
  participants: ConversationParticipant[];
  participant_ids: string[];
  status: ConversationStatus;
  priority: ConversationPriority;
  last_message?: string;
  last_message_at: string;
  unread_master: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
}

export interface ChatMessage {
  id: string;
  message_id: string;
  conversation_id: string;
  order_id?: string;
  sender_id: string;
  sender_role: UserRole;
  sender_name: string;
  recipient_id?: string;
  recipient_role?: UserRole;
  message: string;
  priority?: ConversationPriority;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  created_at: string;
  read_at?: string | null;
}

// Support Incidents
export type IncidentSeverity = 'normal' | 'importante' | 'urgente' | 'critica';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  incident_id: string;
  title: string;
  description: string;
  order_id?: string;
  order_code?: string;
  entity_type: 'order' | 'restaurant' | 'driver' | 'customer' | 'system';
  entity_id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reported_by: {
    id: string;
    role: UserRole;
    name: string;
  };
  assigned_to?: string;
  resolution_notes?: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Commercial Solutions Catalog (Directaurante & DirectPost)
export type CommercialProduct = 'directaurante' | 'directpost';
export type SolutionStatus = 'active' | 'catalog' | 'inactive';

export interface CommercialSolution {
  id: string;
  solution_id: string;
  name: string;
  description: string;
  category: string;
  product: CommercialProduct;
  status: SolutionStatus;
  price_cents: number;
  billing_period: 'monthly' | 'annual';
  version: string;
  features: string[];
  created_at: string;
  updated_at: string;
}

// Commercial Plans
export interface CommercialPlan {
  id: string;
  plan_id: string;
  name: string;
  product: CommercialProduct;
  description: string;
  included_solutions: string[]; // solution_id array
  limits: {
    max_orders_month?: number;
    max_products?: number;
    max_staff?: number;
    max_tables?: number;
  };
  status: 'active' | 'inactive';
  price_cents: number;
  billing_period: 'monthly' | 'annual' | 'quarterly' | 'semiannual' | 'lifetime' | string;
  features?: string[];
  created_at: string;
  updated_at: string;
}

// Restaurant Entitlements
export type EntitlementStatus = 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED';

export interface RestaurantEntitlement {
  id: string;
  entitlement_id: string;
  restaurant_id: string;
  solution_id: string;
  product: CommercialProduct;
  status: EntitlementStatus;
  activated_at: string;
  expires_at: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  source: 'plan' | 'addon' | 'trial';
  plan_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_REJECTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'DRIVER_OFFER_CREATED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_LOCATION_UPDATED'
  | 'ORDER_ON_THE_WAY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'MESSAGE_CREATED'
  | 'MESSAGE_READ'
  | 'MESSAGE_UPDATED'
  | 'MESSAGE_CLOSED'
  | 'CONVERSATION_UPDATED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'ENTITLEMENT_UPDATED'
  | 'ORDER_EVIDENCE_ADDED'
  | 'PROFILE_UPDATED'
  | 'RESTAURANT_STATUS_CHANGED'
  | 'RESTAURANT_UPDATED'
  | 'INVENTORY_UPDATED'
  | 'PAYMENT_UPDATED';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  order_id?: string;
  folio?: string;
  restaurant_id?: string;
  driver_id?: string;
  customer_id?: string;
  data: any;
  timestamp: string;
}

// Runtime exports for Node.js 22 type-stripping ESM compatibility
export const Address = {};
export const AuditLog = {};
export const Category = {};
export const ChatMessage = {};
export const CommercialPlan = {};
export const CommercialSolution = {};
export const Conversation = {};
export const DeviceRegistration = {};
export const DriverOffer = {};
export const DriverSettlement = {};
export const DriverShift = {};
export const Incident = {};
export const Order = {};
export const OrderEvidence = {};
export const OrderItem = {};
export const OrderMessage = {};
export const PaymentAttempt = {};
export const ProcessedWebhook = {};
export const Product = {};
export const RealtimeEventPayload = {};
export const Restaurant = {};
export const RestaurantEntitlement = {};
export const RestaurantMercadoPagoAccount = {};
export const SupportTicket = {};
export const SystemFinancialConfig = {};
export const User = {};


