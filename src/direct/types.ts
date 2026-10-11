export type UserRole = 'customer' | 'restaurant' | 'driver' | 'master';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  profile_image: string | null;
  birthday?: string | null;
  birthdate?: string | null;
  allergies?: string;
  notes?: string;
  is_active: boolean;
  driver_status?: DriverStatus;
  vehicle_info?: string;
  current_location?: {
    latitude: number;
    longitude: number;
    address?: string;
    updatedAt?: string;
  };
  is_verified?: boolean;
  vehicle_type?: 'automovil' | 'motocicleta' | 'bicicleta' | 'a_pie';
  documents?: {
    ine_front_url?: string;
    ine_back_url?: string;
    proof_of_address_url?: string;
    proof_of_address_date?: string;
    circulation_card_url?: string;
    status?: 'pending' | 'approved' | 'rejected';
    reviewed_at?: string;
    notes?: string;
  };
  createdAt?: string;
  updatedAt?: string;
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
  delivery_mode?: 'local_driver' | 'platform_fleet';
  local_driver_name?: string;
  local_driver_phone?: string;
  mercadopago_account?: {
    is_connected: boolean;
    collector_id?: string;
    nickname?: string;
    connected_at?: string;
  };
}

export interface RestaurantMercadoPagoPublicStatus {
  is_connected: boolean;
  collector_id?: string;
  nickname?: string;
  connected_at?: string;
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
  price_delta: number; // in cents
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
  product_id?: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number; // in cents
  category: string;
  image_url: string;
  is_available: boolean;
  stock?: number | null;
  low_stock_threshold?: number;
  variants: ProductVariantGroup[];
  toppings: ProductTopping[];
}

export interface CartItemVariant {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta: number;
}

export interface CartItemTopping {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique cart entry key
  product: Product;
  quantity: number;
  selectedVariants: CartItemVariant[];
  selectedToppings: CartItemTopping[];
  notes?: string;
  unitPrice: number; // product.price + sum(variants) + sum(toppings)
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  street: string;
  number: string;
  colony: string;
  city: string;
  state: string;
  postal_code: string;
  references: string;
  is_default: boolean;
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

export interface SavedCard {
  id: string;
  user_id: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'otro';
  last4: string;
  holder_name: string;
  exp_month: string;
  exp_year: string;
  card_type: 'credito' | 'debito';
  is_default: boolean;
  createdAt: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  variants: {
    group_id: string;
    group_name: string;
    option_id: string;
    option_name: string;
    price_delta: number;
  }[];
  toppings: {
    id: string;
    name: string;
    price: number;
  }[];
  notes?: string;
  subtotal: number;
}

export interface Order {
  id: string;
  folio?: string;
  order_id?: string;
  order_code?: string;
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
  subtotal: number;
  extras_total: number;
  delivery_fee: number;
  service_fee: number;
  tip_amount: number;
  discount_amount: number;
  restaurant_commission?: number;
  driver_payment?: number;
  total: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  driver_id?: string | null;
  driver_name?: string | null;
  has_allergies: boolean;
  allergies?: string;
  notes?: string;
  mercadopago_payment_id?: string;
  mercadopago_preference_id?: string;
  mercadopago_status?: string;
  status_history: {
    status: OrderStatus;
    timestamp: string;
    actor_id?: string;
    actor_role?: string;
    notes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface FeesInfo {
  service_fee: number;
  default_delivery_fee: number;
  minimum_order: number;
  currency: string;
}

export type DriverStatus = 'offline' | 'available' | 'busy' | 'paused';

export interface DriverOffer {
  id: string;
  order_id: string;
  folio?: string;
  driver_id: string;
  restaurant_id: string;
  restaurant_name: string;
  delivery_address: string;
  order_total: number;
  driver_earnings: number;
  distance_km: number;
  attempt_number: number;
  offered_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'superseded';
  reject_reason?: string;
}

export interface DriverShiftSummary {
  shift_id: string | null;
  status: 'active' | 'inactive';
  started_at: string;
  orders_completed: number;
  offers_rejected: number;
  offers_expired: number;
  cash_collected: number;
  digital_total: number;
  tips_total: number;
  earnings_total: number;
  net_balance: number;
  recent_orders: {
    id: string;
    restaurant_name: string;
    total: number;
    payment_method: string;
    completedAt: string;
  }[];
}

export interface DriverSettlement {
  id: string;
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  shift_id: string;
  closed_at: string;
  orders_completed: number;
  cash_collected: number;
  earnings_total: number;
  net_balance: number;
  notes?: string;
  deposit_amount?: number;
  deposit_proof_url?: string;
  deposit_date?: string;
  deposit_status?: 'pending_proof' | 'deposit_uploaded' | 'confirmed' | 'rejected';
  deposit_reviewed_by?: string;
  deposit_reviewed_at?: string;
  deposit_notes?: string;
  deposit_verified_amount?: number;
  discrepancy_amount?: number;
  discrepancy_notes?: string;
  is_reconciled?: boolean;
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'driver' | 'customer' | 'restaurant';
  sender_name: string;
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  driver_id: string;
  driver_name: string;
  order_id?: string;
  category: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  priority: 'normal' | 'urgent';
  createdAt: string;
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
  evidence_id?: string;
  order_id: string;
  uploaded_by: string;
  role: UserRole;
  type: EvidenceType;
  file_url: string;
  notes?: string;
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

// Commercial Solutions & Plans
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

export interface CommercialPlan {
  id: string;
  plan_id: string;
  name: string;
  product: CommercialProduct;
  description: string;
  included_solutions: string[];
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

export interface SystemFinancialConfig {
  id: string;
  restaurant_commission_cents: number;
  driver_payment_cents: number;
  default_delivery_fee_cents: number;
  is_commission_active: boolean;
  currency: string;
  default_trial_days: number;
  enforce_subscription_check: boolean;
  deposit_bank_name?: string;
  deposit_account_holder?: string;
  deposit_clabe_or_account?: string;
  deposit_instructions?: string;
  updated_at: string;
  updated_by?: string;
}



