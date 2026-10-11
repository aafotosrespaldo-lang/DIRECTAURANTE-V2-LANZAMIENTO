import { dbClient } from '../db/connection.ts';
import { AuditService } from './auditService.ts';
import type { SystemFinancialConfig } from '../models/types.ts';

export class FinancialConfigService {
  private static readonly CONFIG_ID = 'financial_settings';

  public static readonly DEFAULT_CONFIG: SystemFinancialConfig = {
    id: 'financial_settings',
    restaurant_commission_cents: 1000, // $10.00 MXN
    driver_payment_cents: 2000,        // $20.00 MXN
    default_delivery_fee_cents: 2500,  // $25.00 MXN configurable
    is_commission_active: true,
    currency: 'MXN',
    default_trial_days: 15,            // 15 días de prueba para nuevos restaurantes
    enforce_subscription_check: true,   // Exigir suscripción o trial válido para recibir órdenes
    updated_at: new Date().toISOString(),
    updated_by: 'system_init',
  };

  /**
   * Retrieves active financial configuration from MongoDB.
   * If not yet seeded, upserts the authoritative default config.
   */
  public static async getConfig(): Promise<SystemFinancialConfig> {
    const col = dbClient.getFinancialConfigCollection();
    let config = await col.findOne({ id: this.CONFIG_ID });
    if (!config) {
      await col.updateOne(
        { id: this.CONFIG_ID },
        { $setOnInsert: this.DEFAULT_CONFIG as any },
        { upsert: true }
      );
      config = await col.findOne({ id: this.CONFIG_ID });
    }
    return config || this.DEFAULT_CONFIG;
  }

  /**
   * Updates financial configuration with strict auditing of previous vs new values.
   */
  public static async updateConfig(
    updates: Partial<Pick<SystemFinancialConfig, 'restaurant_commission_cents' | 'driver_payment_cents' | 'default_delivery_fee_cents' | 'is_commission_active' | 'currency' | 'default_trial_days' | 'enforce_subscription_check' | 'deposit_bank_name' | 'deposit_account_holder' | 'deposit_clabe_or_account' | 'deposit_instructions'>>,
    actor: { id: string; name?: string; role?: string }
  ): Promise<SystemFinancialConfig> {
    const col = dbClient.getFinancialConfigCollection();
    const current = await this.getConfig();

    const allowedUpdates: Partial<SystemFinancialConfig> = {};
    const auditDiff: Record<string, { previous: any; new: any }> = {};

    if (updates.restaurant_commission_cents !== undefined) {
      const val = Math.max(0, parseInt(String(updates.restaurant_commission_cents), 10));
      if (val !== current.restaurant_commission_cents) {
        auditDiff.restaurant_commission_cents = { previous: current.restaurant_commission_cents, new: val };
        allowedUpdates.restaurant_commission_cents = val;
      }
    }

    if (updates.driver_payment_cents !== undefined) {
      const val = Math.max(0, parseInt(String(updates.driver_payment_cents), 10));
      if (val !== current.driver_payment_cents) {
        auditDiff.driver_payment_cents = { previous: current.driver_payment_cents, new: val };
        allowedUpdates.driver_payment_cents = val;
      }
    }

    if (updates.default_delivery_fee_cents !== undefined) {
      const val = Math.max(0, parseInt(String(updates.default_delivery_fee_cents), 10));
      if (val !== current.default_delivery_fee_cents) {
        auditDiff.default_delivery_fee_cents = { previous: current.default_delivery_fee_cents, new: val };
        allowedUpdates.default_delivery_fee_cents = val;
      }
    }

    if (updates.is_commission_active !== undefined) {
      const val = Boolean(updates.is_commission_active);
      if (val !== current.is_commission_active) {
        auditDiff.is_commission_active = { previous: current.is_commission_active, new: val };
        allowedUpdates.is_commission_active = val;
      }
    }

    if (updates.default_trial_days !== undefined) {
      const val = Math.max(1, parseInt(String(updates.default_trial_days), 10));
      if (val !== (current.default_trial_days ?? 15)) {
        auditDiff.default_trial_days = { previous: current.default_trial_days ?? 15, new: val };
        allowedUpdates.default_trial_days = val;
      }
    }

    if (updates.enforce_subscription_check !== undefined) {
      const val = Boolean(updates.enforce_subscription_check);
      if (val !== (current.enforce_subscription_check ?? true)) {
        auditDiff.enforce_subscription_check = { previous: current.enforce_subscription_check ?? true, new: val };
        allowedUpdates.enforce_subscription_check = val;
      }
    }

    if (updates.currency) {
      allowedUpdates.currency = updates.currency.toUpperCase();
    }

    if (updates.deposit_bank_name !== undefined) {
      const val = typeof updates.deposit_bank_name === 'string' ? updates.deposit_bank_name.trim() : '';
      if (val !== (current.deposit_bank_name || '')) {
        auditDiff.deposit_bank_name = { previous: current.deposit_bank_name || '', new: val };
        allowedUpdates.deposit_bank_name = val;
      }
    }

    if (updates.deposit_account_holder !== undefined) {
      const val = typeof updates.deposit_account_holder === 'string' ? updates.deposit_account_holder.trim() : '';
      if (val !== (current.deposit_account_holder || '')) {
        auditDiff.deposit_account_holder = { previous: current.deposit_account_holder || '', new: val };
        allowedUpdates.deposit_account_holder = val;
      }
    }

    if (updates.deposit_clabe_or_account !== undefined) {
      const val = typeof updates.deposit_clabe_or_account === 'string' ? updates.deposit_clabe_or_account.trim() : '';
      if (val !== (current.deposit_clabe_or_account || '')) {
        auditDiff.deposit_clabe_or_account = { previous: current.deposit_clabe_or_account || '', new: val };
        allowedUpdates.deposit_clabe_or_account = val;
      }
    }

    if (updates.deposit_instructions !== undefined) {
      const val = typeof updates.deposit_instructions === 'string' ? updates.deposit_instructions.trim() : '';
      if (val !== (current.deposit_instructions || '')) {
        auditDiff.deposit_instructions = { previous: current.deposit_instructions || '', new: val };
        allowedUpdates.deposit_instructions = val;
      }
    }

    allowedUpdates.updated_at = new Date().toISOString();
    allowedUpdates.updated_by = actor.name || actor.id;

    await col.updateOne(
      { id: this.CONFIG_ID },
      { $set: allowedUpdates as any },
      { upsert: true }
    );

    const updated = await this.getConfig();

    // Audit log with actor, previous value, new value and timestamp
    await AuditService.log(
      'financial_config_modified',
      'system_financial_config',
      this.CONFIG_ID,
      {
        changes: auditDiff,
        actor_name: actor.name,
        timestamp: allowedUpdates.updated_at,
        current_rates: {
          restaurant_commission_mxn: (updated.restaurant_commission_cents / 100).toFixed(2),
          driver_payment_mxn: (updated.driver_payment_cents / 100).toFixed(2),
          default_delivery_fee_mxn: (updated.default_delivery_fee_cents / 100).toFixed(2),
          is_commission_active: updated.is_commission_active,
        },
      },
      actor.id,
      actor.role || 'master'
    );

    return updated;
  }
}
