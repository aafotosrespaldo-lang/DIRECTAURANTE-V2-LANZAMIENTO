import { Restaurant, DayScheduleConfig } from '../types.ts';

export interface RestaurantStatusResult {
  is_out_of_service: boolean;
  badge_text: string;
  reason: 'temporarily_closed' | 'subscription_expired' | 'schedule_closed' | 'inactive' | null;
  reason_label: string;
  trial_days_left: number | null;
  is_trial_active: boolean;
}

export function getRestaurantOperationalStatus(restaurant?: Partial<Restaurant> | null): RestaurantStatusResult {
  if (!restaurant) {
    return {
      is_out_of_service: true,
      badge_text: 'Fuera de servicio',
      reason: 'inactive',
      reason_label: 'Restaurante no disponible',
      trial_days_left: null,
      is_trial_active: false,
    };
  }

  // 1. Inactive by Master
  if (restaurant.is_active === false) {
    return {
      is_out_of_service: true,
      badge_text: 'Fuera de servicio',
      reason: 'inactive',
      reason_label: 'Restaurante suspendido por administración',
      trial_days_left: null,
      is_trial_active: false,
    };
  }

  // 2. Explicitly closed temporarily or is_open === false
  if (restaurant.is_temporarily_closed === true || restaurant.is_open === false) {
    return {
      is_out_of_service: true,
      badge_text: 'Fuera de servicio',
      reason: 'temporarily_closed',
      reason_label: 'Cerrado temporalmente por el restaurante',
      trial_days_left: null,
      is_trial_active: false,
    };
  }

  // 3. Subscription & Trial Check
  const now = Date.now();
  let trialDaysLeft: number | null = null;
  let isTrialActive = false;

  if (restaurant.trial_ends_at) {
    const trialEndTime = new Date(restaurant.trial_ends_at).getTime();
    const diffMs = trialEndTime - now;
    trialDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (trialDaysLeft > 0) {
      isTrialActive = true;
    }
  }

  if (restaurant.subscription_status === 'paused') {
    return {
      is_out_of_service: true,
      badge_text: 'Fuera de servicio',
      reason: 'inactive',
      reason_label: 'Suscripción pausada por administración',
      trial_days_left: null,
      is_trial_active: false,
    };
  }

  if (restaurant.subscription_status === 'expired') {
    return {
      is_out_of_service: true,
      badge_text: 'Fuera de servicio',
      reason: 'subscription_expired',
      reason_label: 'Suscripción o pase caducado · Fuera de servicio',
      trial_days_left: 0,
      is_trial_active: false,
    };
  }

  if (restaurant.subscription_status === 'lifetime') {
    // Lifetime subscription is perpetually active
  } else if (restaurant.subscription_status === 'active') {
    if (restaurant.subscription_ends_at && new Date(restaurant.subscription_ends_at).getTime() < now) {
      return {
        is_out_of_service: true,
        badge_text: 'Fuera de servicio',
        reason: 'subscription_expired',
        reason_label: 'Suscripción vencida · Requiere renovación',
        trial_days_left: 0,
        is_trial_active: false,
      };
    }
  } else if (restaurant.subscription_status === 'trial') {
    if (trialDaysLeft !== null && trialDaysLeft <= 0) {
      return {
        is_out_of_service: true,
        badge_text: 'Fuera de servicio',
        reason: 'subscription_expired',
        reason_label: 'Pase de prueba de 15 días caducado',
        trial_days_left: 0,
        is_trial_active: false,
      };
    }
  } else if (!restaurant.subscription_status || restaurant.subscription_status === 'none') {
    if (restaurant.trial_ends_at && (trialDaysLeft === null || trialDaysLeft <= 0)) {
      return {
        is_out_of_service: true,
        badge_text: 'Fuera de servicio',
        reason: 'subscription_expired',
        reason_label: 'Sin suscripción activa ni prueba vigente',
        trial_days_left: 0,
        is_trial_active: false,
      };
    }
  }

  // 4. Day of the week check
  if (restaurant.schedule) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const currentDay = days[new Date().getDay()];
    const dayConfig = (restaurant.schedule as any)[currentDay];

    if (dayConfig !== undefined) {
      if (typeof dayConfig === 'object' && dayConfig !== null) {
        const cfg = dayConfig as DayScheduleConfig;
        if (cfg.isOpen === false) {
          return {
            is_out_of_service: true,
            badge_text: 'Fuera de servicio',
            reason: 'schedule_closed',
            reason_label: 'Cerrado hoy según horario de atención',
            trial_days_left: trialDaysLeft,
            is_trial_active: isTrialActive,
          };
        }
      } else if (typeof dayConfig === 'string') {
        const lower = dayConfig.trim().toLowerCase();
        if (lower === 'cerrado' || lower === 'closed' || lower === 'inactivo' || lower === '') {
          return {
            is_out_of_service: true,
            badge_text: 'Fuera de servicio',
            reason: 'schedule_closed',
            reason_label: 'Cerrado hoy según horario de atención',
            trial_days_left: trialDaysLeft,
            is_trial_active: isTrialActive,
          };
        }
      }
    }
  }

  return {
    is_out_of_service: false,
    badge_text: 'Abierto',
    reason: null,
    reason_label: 'Abierto para recibir pedidos',
    trial_days_left: trialDaysLeft,
    is_trial_active: isTrialActive,
  };
}
