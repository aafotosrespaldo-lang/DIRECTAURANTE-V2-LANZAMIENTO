import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { CategoryRepository } from '../repositories/categoryRepository.ts';
import { ProductRepository } from '../repositories/productRepository.ts';
import type { Category, Product, Restaurant } from '../models/types.ts';

export function computeRestaurantStatus(restaurant: Partial<Restaurant>): {
  is_out_of_service: boolean;
  reason?: 'temporarily_closed' | 'subscription_expired' | 'schedule_closed' | 'inactive';
  label: string;
} {
  // 1. Inactive by Master
  if (restaurant.is_active === false) {
    return {
      is_out_of_service: true,
      reason: 'inactive',
      label: 'Fuera de servicio (Suspendido por administración)',
    };
  }

  // 2. Temporarily closed by restaurant
  if (restaurant.is_temporarily_closed === true || restaurant.is_open === false) {
    return {
      is_out_of_service: true,
      reason: 'temporarily_closed',
      label: 'Fuera de servicio (Cerrado temporalmente)',
    };
  }

  // 3. Subscription & Trial Check
  const now = Date.now();
  if (restaurant.subscription_status === 'paused') {
    return {
      is_out_of_service: true,
      reason: 'inactive',
      label: 'Fuera de servicio (Suscripción pausada por administración)',
    };
  }

  if (restaurant.subscription_status === 'expired') {
    return {
      is_out_of_service: true,
      reason: 'subscription_expired',
      label: 'Fuera de servicio (Pase de prueba caducado / Sin suscripción)',
    };
  }

  if (restaurant.subscription_status === 'lifetime') {
    // Lifetime subscription is perpetually active
  } else if (restaurant.subscription_status === 'active') {
    if (restaurant.subscription_ends_at && new Date(restaurant.subscription_ends_at).getTime() < now) {
      return {
        is_out_of_service: true,
        reason: 'subscription_expired',
        label: 'Fuera de servicio (Suscripción vencida)',
      };
    }
  } else if (restaurant.subscription_status === 'trial') {
    if (restaurant.trial_ends_at && new Date(restaurant.trial_ends_at).getTime() < now) {
      return {
        is_out_of_service: true,
        reason: 'subscription_expired',
        label: 'Fuera de servicio (Pase de prueba caducado)',
      };
    }
  } else if (!restaurant.subscription_status || restaurant.subscription_status === 'none') {
    if (restaurant.trial_ends_at && new Date(restaurant.trial_ends_at).getTime() < now) {
      return {
        is_out_of_service: true,
        reason: 'subscription_expired',
        label: 'Fuera de servicio (Sin suscripción activa)',
      };
    }
  }

  // 4. Days of the week schedule check
  if (restaurant.schedule) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const currentDay = days[new Date().getDay()];
    const dayConfig = (restaurant.schedule as any)[currentDay];
    if (dayConfig !== undefined) {
      if (typeof dayConfig === 'object' && dayConfig !== null) {
        if (dayConfig.isOpen === false) {
          return {
            is_out_of_service: true,
            reason: 'schedule_closed',
            label: 'Fuera de servicio (Cerrado hoy por horario)',
          };
        }
      } else if (typeof dayConfig === 'string') {
        const lower = dayConfig.trim().toLowerCase();
        if (lower === 'cerrado' || lower === 'closed' || lower === 'inactivo' || lower === '') {
          return {
            is_out_of_service: true,
            reason: 'schedule_closed',
            label: 'Fuera de servicio (Cerrado hoy por horario)',
          };
        }
      }
    }
  }

  return {
    is_out_of_service: false,
    label: 'Abierto para recibir pedidos',
  };
}

export function enrichRestaurant(r: Restaurant): Restaurant {
  const status = computeRestaurantStatus(r);
  return {
    ...r,
    is_open: !status.is_out_of_service,
    is_out_of_service: status.is_out_of_service,
    out_of_service_reason: status.reason,
    out_of_service_label: status.label,
  };
}

export class RestaurantService {
  public static async listRestaurants(filters?: { category?: string; query?: string }): Promise<Restaurant[]> {
    const list = await RestaurantRepository.findAll({ activeOnly: true, category: filters?.category, query: filters?.query });
    return list.map(enrichRestaurant);
  }

  public static async getRestaurantById(id: string): Promise<Restaurant | null> {
    const rest = await RestaurantRepository.findById(id);
    return rest ? enrichRestaurant(rest) : null;
  }

  public static async getRestaurantByOwnerId(ownerId: string): Promise<Restaurant | null> {
    const rest = await RestaurantRepository.findByOwnerId(ownerId);
    return rest ? enrichRestaurant(rest) : null;
  }
}

export class CatalogService {
  public static async getCategories(): Promise<Category[]> {
    return CategoryRepository.findAll();
  }

  public static async getProductsByRestaurant(restaurantId: string): Promise<Product[]> {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new Error(`Restaurante '${restaurantId}' no encontrado`);
    }
    return ProductRepository.findByRestaurantId(restaurantId, true);
  }

  public static async getProductById(id: string): Promise<Product | null> {
    return ProductRepository.findById(id);
  }
}
