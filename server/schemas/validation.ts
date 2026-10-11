export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: 'customer' | 'driver' | 'restaurant';
  vehicle_info?: string;
  vehicle_type?: 'automovil' | 'motocicleta' | 'bicicleta' | 'a_pie';
  restaurant_name?: string;
}

export interface PrivilegedUserDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'restaurant' | 'driver' | 'master';
}

export interface LoginDto {
  email: string;
  password: string;
  expectedRole?: 'customer' | 'restaurant' | 'driver' | 'master';
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token?: string;
  code?: string;
  email?: string;
  newPassword: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  profile_image?: string | null;
  birthday?: string | null;
}

export interface CreateAddressDto {
  label: string;
  street: string;
  number: string;
  colony: string;
  city: string;
  state: string;
  postal_code: string;
  references?: string;
  is_default?: boolean;
}

export interface OrderItemInputDto {
  product_id: string;
  quantity: number;
  variants?: {
    group_id: string;
    option_id: string;
  }[];
  toppings?: string[]; // IDs of toppings selected
  notes?: string;
}

export interface CreateOrderDto {
  restaurant_id: string;
  order_type: 'delivery' | 'pickup';
  address_id?: string | null;
  delivery_address?: string | null;
  customer_phone?: string;
  items: OrderItemInputDto[];
  payment_method: 'cash' | 'transfer' | 'card' | 'digital';
  tip_amount?: number; // in cents
  promo_code?: string;
  has_allergies?: boolean;
  allergies?: string;
  notes?: string;
  idempotency_key?: string;
}

export function validateRegister(body: any): { valid: boolean; error?: string; data?: RegisterDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return { valid: false, error: 'Email válido requerido' };
  }
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
  }
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: 'El nombre es requerido' };
  }

  // Security check: master role is protected and cannot be self-registered
  const role = body.role || 'customer';
  if (role === 'master' || role === 'admin') {
    return {
      valid: false,
      error: 'El rol master o administrativo no permite auto-registro público.',
    };
  }

  if (!['customer', 'driver', 'restaurant'].includes(role)) {
    return {
      valid: false,
      error: 'Rol no válido. Permitidos: customer, driver, restaurant.',
    };
  }

  return {
    valid: true,
    data: {
      email: body.email.trim().toLowerCase(),
      password: body.password,
      name: body.name.trim(),
      phone: body.phone ? String(body.phone).trim() : '',
      role: role as 'customer' | 'driver' | 'restaurant',
      vehicle_info: body.vehicle_info || body.vehicleInfo || '',
      vehicle_type: body.vehicle_type || body.vehicleType,
      restaurant_name: body.restaurant_name || body.restaurantName || '',
    },
  };
}

export function validatePrivilegedUser(body: any): { valid: boolean; error?: string; data?: PrivilegedUserDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return { valid: false, error: 'Email válido requerido' };
  }
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
  }
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: 'El nombre es requerido' };
  }
  const allowed = ['restaurant', 'driver', 'master'];
  if (!body.role || !allowed.includes(body.role)) {
    return { valid: false, error: 'El rol debe ser restaurant, driver o master' };
  }

  return {
    valid: true,
    data: {
      email: body.email.trim().toLowerCase(),
      password: body.password,
      name: body.name.trim(),
      phone: body.phone ? String(body.phone).trim() : '',
      role: body.role,
    },
  };
}

export function validateLogin(body: any): { valid: boolean; error?: string; data?: LoginDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.email || typeof body.email !== 'string') {
    return { valid: false, error: 'Email requerido' };
  }
  if (!body.password || typeof body.password !== 'string') {
    return { valid: false, error: 'Contraseña requerida' };
  }

  const allowedRoles = ['customer', 'restaurant', 'driver', 'master'];
  if (body.expectedRole && !allowedRoles.includes(body.expectedRole)) {
    return { valid: false, error: `Rol solicitado '${body.expectedRole}' no es válido` };
  }

  return {
    valid: true,
    data: {
      email: body.email.trim().toLowerCase(),
      password: body.password,
      expectedRole: body.expectedRole,
    },
  };
}

export function validateForgotPassword(body: any): { valid: boolean; error?: string; data?: ForgotPasswordDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return { valid: false, error: 'Correo electrónico válido requerido' };
  }
  return {
    valid: true,
    data: {
      email: body.email.trim().toLowerCase(),
    },
  };
}

export function validateResetPassword(body: any): { valid: boolean; error?: string; data?: ResetPasswordDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.newPassword || typeof body.newPassword !== 'string' || body.newPassword.length < 6) {
    return { valid: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' };
  }
  if (!body.token && (!body.code || !body.email)) {
    return { valid: false, error: 'Se requiere token o código de verificación con correo electrónico' };
  }
  return {
    valid: true,
    data: {
      token: body.token ? String(body.token).trim() : undefined,
      code: body.code ? String(body.code).trim() : undefined,
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      newPassword: body.password || body.newPassword,
    },
  };
}

export function validateCreateOrder(body: any): { valid: boolean; error?: string; data?: CreateOrderDto } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Cuerpo de solicitud requerido' };
  if (!body.restaurant_id || typeof body.restaurant_id !== 'string') {
    return { valid: false, error: 'restaurant_id es requerido' };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { valid: false, error: 'El pedido debe contener al menos 1 producto en items' };
  }
  if (body.order_type !== 'delivery' && body.order_type !== 'pickup') {
    return { valid: false, error: "order_type debe ser 'delivery' o 'pickup'" };
  }
  for (const item of body.items) {
    if (!item.product_id || typeof item.product_id !== 'string') {
      return { valid: false, error: 'Cada item debe tener product_id' };
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      return { valid: false, error: 'Cada item debe tener una cantidad entera positiva' };
    }
  }

  const validPayments = ['cash', 'transfer', 'card', 'digital'];
  const payment_method = validPayments.includes(body.payment_method) ? body.payment_method : 'cash';

  return {
    valid: true,
    data: {
      restaurant_id: body.restaurant_id,
      order_type: body.order_type,
      address_id: body.address_id || null,
      delivery_address: body.delivery_address || null,
      customer_phone: body.customer_phone ? String(body.customer_phone) : '',
      items: body.items,
      payment_method,
      tip_amount: typeof body.tip_amount === 'number' && body.tip_amount >= 0 ? Math.round(body.tip_amount) : 0,
      promo_code: body.promo_code ? String(body.promo_code).trim().toUpperCase() : undefined,
      has_allergies: Boolean(body.has_allergies),
      allergies: body.allergies ? String(body.allergies).trim() : undefined,
      notes: body.notes ? String(body.notes).trim() : undefined,
      idempotency_key: body.idempotency_key ? String(body.idempotency_key).trim() : undefined,
    },
  };
}
