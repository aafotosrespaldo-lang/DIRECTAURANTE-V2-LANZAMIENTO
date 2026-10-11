import crypto from 'crypto';
import { config } from '../config/index.ts';
import { dbClient } from '../db/connection.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { FinancialConfigService } from './financialConfigService.ts';
import { AuditService } from './auditService.ts';
import { RealtimeService } from './realtimeService.ts';
import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  verifyOAuthState,
  verifyMercadoPagoWebhookSignature,
  sanitizeLogData,
} from '../utils/cryptoUtils.ts';
import type {
  Order,
  PaymentAttempt,
  PaymentStatus,
  ProcessedWebhook,
  Restaurant,
  RestaurantMercadoPagoAccount,
} from '../models/types.ts';

export interface MercadoPagoPaymentDetails {
  id: string;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  status_detail?: string;
  transaction_amount: number; // en pesos MXN
  external_reference: string;
  currency_id: string;
  date_approved?: string;
  payer?: {
    email?: string;
    id?: string;
  };
}

export class MercadoPagoService {
  private static readonly API_BASE = 'https://api.mercadopago.com';
  private static readonly AUTH_BASE = 'https://auth.mercadopago.com.mx';

  // In-memory / Mock handler for tests and local simulation when live network is unavailable
  private static mockPayments: Map<string, MercadoPagoPaymentDetails> = new Map();
  private static simulateNetworkFailure = false;

  /**
   * For testing: enables or disables simulated network failure
   */
  public static setSimulateNetworkFailure(fail: boolean): void {
    this.simulateNetworkFailure = fail;
  }

  /**
   * For testing: seeds a mock payment in the local test registry
   */
  public static seedMockPayment(details: MercadoPagoPaymentDetails): void {
    this.mockPayments.set(String(details.id), details);
  }

  /**
   * For testing: clears mock payments
   */
  public static clearMockPayments(): void {
    this.mockPayments.clear();
    this.simulateNetworkFailure = false;
  }

  public static getConfig() {
    return {
      mode: config.mpMode,
      publicKey: config.mpPublicKey || 'TEST-PUBLIC-KEY',
      isConfigured: Boolean(config.mpClientId || config.mpClientSecret || config.mpPlatformAccessToken),
    };
  }

  /**
   * Returns OAuth authorization URL with CSRF state token for a restaurant seller.
   */
  public static getOAuthAuthorizationUrl(restaurantId: string): { url: string; state: string } {
    const clientId = config.mpClientId || 'TEST_MP_CLIENT_ID';
    const redirectUri =
      config.mpRedirectUri ||
      `${config.appUrl || 'http://localhost:3000'}/api/restaurant/mercadopago/callback`;

    const state = generateOAuthState(restaurantId);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: redirectUri,
    });

    const url = `${this.AUTH_BASE}/authorization?${params.toString()}`;

    return { url, state };
  }

  /**
   * Handles OAuth Callback when a seller authorizes their Mercado Pago account.
   * Exchanges code for tokens, encrypts them at rest, and saves to restaurant document.
   */
  public static async handleOAuthCallback(params: {
    code: string;
    state: string;
    expectedRestaurantId?: string;
  }): Promise<{ success: boolean; restaurantId: string; collectorId: string; nickname?: string }> {
    const { code, state, expectedRestaurantId } = params;

    // 1. Verify CSRF State
    const stateVerification = verifyOAuthState(state, expectedRestaurantId);
    if (!stateVerification.valid || !stateVerification.restaurantId) {
      const err: any = new Error(stateVerification.error || 'Validación de seguridad CSRF fallida');
      err.statusCode = 400;
      throw err;
    }

    const restaurantId = stateVerification.restaurantId;
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      const err: any = new Error(`Restaurante '${restaurantId}' no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Token Exchange with Mercado Pago
    let tokenData: {
      access_token: string;
      refresh_token?: string;
      public_key?: string;
      user_id: number | string;
      scope?: string;
      live_mode?: boolean;
      expires_in?: number;
    };

    if (this.simulateNetworkFailure) {
      throw new Error('Mercado Pago API indisponible (simulación de fallo de red)');
    }

    const isProd = config.nodeEnv === 'production';
    if (isProd) {
      if (code.startsWith('mock_') || code.includes('mock') || code === 'TEST_OAUTH_CODE') {
        const err: any = new Error(
          'Error de seguridad crítico: En producción están estrictamente bloqueadas las vinculaciones OAuth simuladas o ficticias ("mock_"). Se requiere autorización auténtica de Mercado Pago.'
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const isTestEnvironment =
      !isProd &&
      (config.isTestMode ||
        !config.mpClientSecret ||
        config.mpClientSecret.startsWith('TEST') ||
        code.startsWith('mock_'));

    if (isTestEnvironment) {
      // Deterministic Mock Token for tests and offline development
      tokenData = {
        access_token: `APP_USR_TEST_TOKEN_${restaurantId}_${Date.now()}`,
        refresh_token: `REFRESH_TEST_TOKEN_${restaurantId}`,
        public_key: `TEST-PUB-KEY-${restaurantId}`,
        user_id: `mp_seller_${restaurantId.replace(/[^a-zA-Z0-9]/g, '')}`,
        scope: 'read write',
        live_mode: false,
        expires_in: 15552000,
      };
    } else {
      const redirectUri =
        config.mpRedirectUri ||
        `${config.appUrl || 'http://localhost:3000'}/api/restaurant/mercadopago/callback`;

      const response = await fetch(`${this.API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_secret: config.mpClientSecret,
          client_id: config.mpClientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(
          errorJson.message || `Error al vincular cuenta en Mercado Pago: ${response.statusText}`
        );
      }

      tokenData = await response.json();
    }

    // 3. Encrypt sensitive tokens at rest
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : undefined;

    const mpAccount: RestaurantMercadoPagoAccount = {
      collector_id: String(tokenData.user_id),
      nickname: restaurant.name,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      public_key: tokenData.public_key,
      connected_at: new Date().toISOString(),
      is_active: true,
      scope: tokenData.scope,
      live_mode: tokenData.live_mode,
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : undefined,
    };

    // 4. Update Restaurant in MongoDB
    await RestaurantRepository.update(restaurantId, {
      mercadopago_account: mpAccount,
    });

    // 5. Audit Log (Stripped of tokens)
    await AuditService.log(
      'payment.oauth_connected',
      'restaurant',
      restaurantId,
      sanitizeLogData({
        collector_id: mpAccount.collector_id,
        live_mode: mpAccount.live_mode,
        connected_at: mpAccount.connected_at,
      }),
      restaurant.owner_id || 'system',
      'restaurant'
    );

    return {
      success: true,
      restaurantId,
      collectorId: mpAccount.collector_id,
      nickname: restaurant.name,
    };
  }

  /**
   * Disconnects a restaurant's Mercado Pago seller account.
   */
  public static async disconnectAccount(
    restaurantId: string,
    actor: { id: string; role: string }
  ): Promise<boolean> {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      const err: any = new Error(`Restaurante '${restaurantId}' no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    // Role verification
    if (actor.role === 'restaurant' && restaurant.owner_id && restaurant.owner_id !== actor.id) {
      const err: any = new Error('Acceso denegado: no puedes desvincular cuentas de otro restaurante');
      err.statusCode = 403;
      throw err;
    }

    const previousCollector = restaurant.mercadopago_account?.collector_id;

    await RestaurantRepository.update(restaurantId, {
      mercadopago_account: undefined,
    });

    await AuditService.log(
      'payment.oauth_disconnected',
      'restaurant',
      restaurantId,
      { previous_collector_id: previousCollector },
      actor.id,
      actor.role
    );

    return true;
  }

  /**
   * Retrieves non-sensitive payment account status for a restaurant.
   * NEVER returns access tokens or secrets to the client.
   */
  public static async getAccountStatus(restaurantId: string): Promise<{
    is_connected: boolean;
    collector_id?: string;
    nickname?: string;
    connected_at?: string;
  }> {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant || !restaurant.mercadopago_account || !restaurant.mercadopago_account.is_active) {
      return { is_connected: false };
    }

    return {
      is_connected: true,
      collector_id: restaurant.mercadopago_account.collector_id,
      nickname: restaurant.mercadopago_account.nickname,
      connected_at: restaurant.mercadopago_account.connected_at,
    };
  }

  /**
   * Creates a Checkout Pro Preference with Marketplace Fee.
   * Validates authentication, order ownership, pending status, and frozen Core amounts.
   */
  public static async createPaymentPreference(params: {
    orderId: string;
    customerId: string;
    idempotencyKey?: string;
  }): Promise<{
    preference_id: string;
    init_point: string;
    sandbox_init_point: string;
    amount_cents: number;
    marketplace_fee_cents: number;
    is_duplicate: boolean;
  }> {
    const { orderId, customerId } = params;
    const idempotencyKey = params.idempotencyKey || `idemp_pay_${orderId}`;

    if (this.simulateNetworkFailure) {
      throw new Error('Servicio de Mercado Pago temporalmente no disponible');
    }

    // 1. Fetch Order and validate
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      const err: any = new Error(`Pedido '${orderId}' no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Ownership check: Only customer owner (or master) can create payment for order
    if (order.customer_id !== customerId) {
      const err: any = new Error('Acceso denegado: no puedes crear un pago para el pedido de otro usuario');
      err.statusCode = 403;
      throw err;
    }

    // 3. Order status check: Must be in 'pending' and not already paid
    if (order.payment_status === 'approved') {
      const err: any = new Error('El pedido ya se encuentra pagado y aprobado');
      err.statusCode = 400;
      throw err;
    }

    if (order.status === 'cancelled') {
      const err: any = new Error('El pedido está cancelado y no admite pagos');
      err.statusCode = 400;
      throw err;
    }

    // 4. Idempotency Check: Look for existing active payment attempt
    const existingAttempt = await dbClient
      .getPaymentAttemptsCollection()
      .findOne({ order_id: order.id, idempotency_key: idempotencyKey });

    if (existingAttempt && existingAttempt.preference_id && existingAttempt.status === 'initiated') {
      return {
        preference_id: existingAttempt.preference_id,
        init_point: existingAttempt.init_point || '',
        sandbox_init_point: existingAttempt.sandbox_init_point || existingAttempt.init_point || '',
        amount_cents: existingAttempt.amount_cents,
        marketplace_fee_cents: existingAttempt.marketplace_fee_cents,
        is_duplicate: true,
      };
    }

    // 5. Validate Restaurant and its Mercado Pago Account
    const restaurant = await RestaurantRepository.findById(order.restaurant_id);
    if (!restaurant) {
      const err: any = new Error('Restaurante no encontrado para este pedido');
      err.statusCode = 404;
      throw err;
    }

    // In production or full test, ensure restaurant has linked account or fallback to test account
    let sellerAccessToken = '';
    let sellerCollectorId = '';
    if (restaurant.mercadopago_account?.access_token) {
      sellerAccessToken = decryptToken(restaurant.mercadopago_account.access_token);
      sellerCollectorId = restaurant.mercadopago_account.collector_id;
    }

    // 6. Sovereign Financial Calculation from Core (NEVER trust client values)
    const finConfig = await FinancialConfigService.getConfig();
    const authoritativeCommissionCents = finConfig.is_commission_active
      ? (order.restaurant_commission ?? finConfig.restaurant_commission_cents)
      : 0;

    const totalCents = order.total; // Authoritative frozen amount
    const totalPesos = parseFloat((totalCents / 100).toFixed(2));
    const commissionPesos = parseFloat((authoritativeCommissionCents / 100).toFixed(2));

    // Ensure marketplace fee does not exceed order total
    const marketplaceFeePesos = Math.min(commissionPesos, totalPesos);
    const marketplaceFeeCents = Math.round(marketplaceFeePesos * 100);

    // 7. Create Preference
    let preferenceId: string;
    let initPoint: string;
    let sandboxInitPoint: string;

    const tokenToUse = sellerAccessToken || config.mpPlatformAccessToken;
    const isProd = config.nodeEnv === 'production';

    if (isProd) {
      if (
        !tokenToUse ||
        tokenToUse.includes('YOUR_') ||
        tokenToUse.includes('mock_') ||
        tokenToUse.startsWith('APP_USR_TEST_TOKEN_') ||
        tokenToUse === 'TEST-YOUR_PLATFORM_ACCESS_TOKEN'
      ) {
        const err: any = new Error(
          'Error de seguridad crítico: En producción no se permiten tokens simulados o ficticios para crear preferencias de pago de Mercado Pago.'
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const isMockMode =
      !isProd &&
      (config.isTestMode ||
        !tokenToUse ||
        tokenToUse.includes('YOUR_') ||
        tokenToUse.includes('mock_') ||
        tokenToUse.startsWith('APP_USR_TEST_TOKEN_') ||
        tokenToUse === 'TEST-YOUR_PLATFORM_ACCESS_TOKEN');

    const preferencePayload: any = {
      external_reference: order.id,
      items: [
        {
          id: order.id,
          title: `Pedido ${order.order_code || order.id} en ${order.restaurant_name}`,
          description: `Consumo en ${order.restaurant_name} (${order.items.length} productos)`,
          quantity: 1,
          currency_id: config.defaultCurrency,
          unit_price: totalPesos,
        },
      ],
      notification_url:
        config.mpWebhookUrl ||
        `${config.appUrl || 'http://localhost:3000'}/api/payments/mercadopago/webhook`,
      back_urls: {
        success: `${config.appUrl || 'http://localhost:3000'}/?view=orders&order_id=${order.id}&status=success`,
        failure: `${config.appUrl || 'http://localhost:3000'}/?view=orders&order_id=${order.id}&status=failure`,
        pending: `${config.appUrl || 'http://localhost:3000'}/?view=orders&order_id=${order.id}&status=pending`,
      },
      auto_return: 'approved',
      statement_descriptor: 'DIRECTAURANTE',
      payer: {
        name: order.customer_name,
        ...(order.customer_phone ? { phone: { number: order.customer_phone.replace(/\D/g, '') } } : {}),
      },
    };

    if (marketplaceFeePesos > 0) {
      preferencePayload.marketplace_fee = marketplaceFeePesos;
    }

    if (this.simulateNetworkFailure) {
      const err: any = new Error('Mercado Pago API temporalmente no disponible');
      err.statusCode = 503;
      throw err;
    }

    if (isMockMode) {
      // Deterministic Sandbox Mock for tests and local dev
      preferenceId = `pref_${crypto.randomUUID()}`;
      initPoint = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`;
      sandboxInitPoint = `https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`;
    } else {
      try {
        // Real API Call with Platform Access Token & seller's Marketplace split
        const response = await fetch(`${this.API_BASE}/checkout/preferences`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(preferencePayload),
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(
            errorJson.message || `Error de Mercado Pago al crear preferencia: ${response.statusText}`
          );
        }

        const prefData = await response.json();
        preferenceId = prefData.id;
        initPoint = prefData.init_point;
        sandboxInitPoint = prefData.sandbox_init_point || prefData.init_point;
      } catch (prefApiErr: any) {
        if (config.isTestMode || this.mockPayments.size > 0) {
          preferenceId = `pref_${crypto.randomUUID()}`;
          initPoint = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`;
          sandboxInitPoint = `https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`;
        } else {
          throw prefApiErr;
        }
      }
    }

    // 8. Persist Payment Attempt
    const attempt: PaymentAttempt = {
      id: `pay_att_${crypto.randomUUID()}`,
      order_id: order.id,
      customer_id: order.customer_id,
      restaurant_id: order.restaurant_id,
      idempotency_key: idempotencyKey,
      preference_id: preferenceId,
      amount_cents: totalCents,
      currency: config.defaultCurrency,
      status: 'initiated',
      marketplace_fee_cents: marketplaceFeeCents,
      init_point: initPoint,
      sandbox_init_point: sandboxInitPoint,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await dbClient.getPaymentAttemptsCollection().insertOne(attempt as any);

    // 9. Update Order payment references
    await OrderRepository.update(order.id, {
      mercadopago_preference_id: preferenceId,
      mercadopago_fee_cents: marketplaceFeeCents,
      payment_method: 'digital',
    });

    // 10. Audit Log
    await AuditService.log(
      'payment.preference_created',
      'order',
      order.id,
      {
        preference_id: preferenceId,
        amount_cents: totalCents,
        marketplace_fee_cents: marketplaceFeeCents,
        idempotency_key: idempotencyKey,
      },
      customerId,
      'customer'
    );

    return {
      preference_id: preferenceId,
      init_point: initPoint,
      sandbox_init_point: sandboxInitPoint,
      amount_cents: totalCents,
      marketplace_fee_cents: marketplaceFeeCents,
      is_duplicate: false,
    };
  }

  /**
   * Processes a direct card / brick payment with Mercado Pago.
   * Validates ownership, pending status, sovereign Core amounts, idempotency,
   * calls Mercado Pago API /v1/payments, updates Order & PaymentAttempt,
   * emits realtime notifications, and logs audit trail.
   */
  public static async processPayment(params: {
    orderId: string;
    customerId: string;
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments?: number;
    payerEmail?: string;
    payerIdentification?: {
      type: string;
      number: string;
    };
    idempotencyKey?: string;
  }): Promise<{
    payment_id: string;
    status: 'approved' | 'pending' | 'in_process' | 'rejected';
    status_detail?: string;
    amount_cents: number;
    order_id: string;
    is_duplicate: boolean;
    date_approved?: string;
  }> {
    if (this.simulateNetworkFailure) {
      const err: any = new Error('Mercado Pago API temporalmente no disponible');
      err.statusCode = 503;
      throw err;
    }

    // 1. Validate Order Existence & Ownership
    const order = await OrderRepository.findById(params.orderId);
    if (!order) {
      const err: any = new Error(`Pedido '${params.orderId}' no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    if (order.customer_id !== params.customerId) {
      const err: any = new Error('Acceso denegado: no estás autorizado para pagar este pedido');
      err.statusCode = 403;
      throw err;
    }

    // 2. Validate Order Status
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      const err: any = new Error(`El pedido está en estado '${order.status}' y no admite nuevos pagos`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Idempotency Check on already approved order
    if (order.payment_status === 'approved' && order.mercadopago_payment_id) {
      return {
        payment_id: order.mercadopago_payment_id,
        status: 'approved',
        status_detail: 'accredited',
        amount_cents: order.total,
        order_id: order.id,
        is_duplicate: true,
      };
    }

    // 4. Idempotency Check on payment attempts
    const idempotencyKey = params.idempotencyKey || `pay_proc_${order.id}_${params.token.slice(-8)}`;
    const existingAttempt = await dbClient
      .getPaymentAttemptsCollection()
      .findOne({ order_id: order.id, idempotency_key: idempotencyKey });

    if (existingAttempt && existingAttempt.status === 'approved' && existingAttempt.payment_id) {
      return {
        payment_id: existingAttempt.payment_id,
        status: 'approved',
        status_detail: existingAttempt.mp_status_detail || 'accredited',
        amount_cents: existingAttempt.amount_cents,
        order_id: order.id,
        is_duplicate: true,
      };
    }

    // 5. Sovereign Financial Calculation from Core (NEVER trust frontend)
    const totalCents = order.total;
    const totalPesos = parseFloat((totalCents / 100).toFixed(2));

    const finConfig = await FinancialConfigService.getConfig();
    const authoritativeCommissionCents = finConfig.is_commission_active
      ? (order.restaurant_commission ?? finConfig.restaurant_commission_cents)
      : 0;
    const commissionPesos = parseFloat((authoritativeCommissionCents / 100).toFixed(2));
    const marketplaceFeePesos = Math.min(commissionPesos, totalPesos);
    const marketplaceFeeCents = Math.round(marketplaceFeePesos * 100);

    // 6. Credentials & Tokens
    const restaurant = await RestaurantRepository.findById(order.restaurant_id);
    let sellerAccessToken = '';
    if (restaurant?.mercadopago_account?.access_token) {
      sellerAccessToken = decryptToken(restaurant.mercadopago_account.access_token);
    }
    const tokenToUse = sellerAccessToken || config.mpPlatformAccessToken;

    // 7. Payer Email Handling
    let effectivePayerEmail = params.payerEmail || (order as any).customer_email || 'cliente@directaurante.com';
    // In sandbox test mode, Mercado Pago rejects @testuser.com (error 4390) and collector accounts (error 2067)
    if (config.mpMode === 'sandbox' || config.mpPlatformAccessToken?.startsWith('TEST-')) {
      if (
        effectivePayerEmail.endsWith('@testuser.com') ||
        effectivePayerEmail.includes('directaurante') ||
        effectivePayerEmail.includes('aafotosrespaldo')
      ) {
        effectivePayerEmail = 'cliente_sandbox_directaurante@gmail.com';
      }
    }

    // 8. Execute Payment or Mock
    const isProd = config.nodeEnv === 'production';
    if (isProd) {
      if (params.token.startsWith('mock_') || params.token.includes('mock')) {
        const err: any = new Error(
          'Error de seguridad crítico: En producción están estrictamente bloqueados los tokens de tarjeta simulados o ficticios ("mock_"). Se requiere un token auténtico generado por el SDK de Mercado Pago.'
        );
        err.statusCode = 400;
        throw err;
      }
      if (!tokenToUse || tokenToUse.includes('YOUR_') || tokenToUse === 'TEST-YOUR_PLATFORM_ACCESS_TOKEN') {
        const err: any = new Error(
          'Error de seguridad crítico: Token de plataforma no configurado o no válido para procesar cobros reales en producción.'
        );
        err.statusCode = 500;
        throw err;
      }
    }

    const isMockMode =
      !isProd &&
      (config.isTestMode ||
        !tokenToUse ||
        tokenToUse.includes('YOUR_') ||
        tokenToUse === 'TEST-YOUR_PLATFORM_ACCESS_TOKEN' ||
        params.token.startsWith('mock_'));

    let paymentData: any;

    if (isMockMode) {
      const mockPaymentId = `pay_mock_${Date.now()}`;
      paymentData = {
        id: mockPaymentId,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: totalPesos,
        currency_id: config.defaultCurrency,
        date_approved: new Date().toISOString(),
      };
    } else {
      const mpBody: any = {
        token: params.token,
        transaction_amount: totalPesos,
        description: `Pedido ${order.order_code || order.id} en ${order.restaurant_name}`,
        payment_method_id: params.paymentMethodId,
        installments: Number(params.installments || 1),
        payer: {
          email: effectivePayerEmail,
        },
        external_reference: order.id,
        notification_url:
          config.mpWebhookUrl ||
          `${config.appUrl || 'http://localhost:3000'}/api/payments/mercadopago/webhook`,
      };

      if (params.issuerId) {
        mpBody.issuer_id = params.issuerId;
      }
      if (params.payerIdentification?.number) {
        mpBody.payer.identification = params.payerIdentification;
      }
      if (sellerAccessToken && marketplaceFeePesos > 0) {
        mpBody.marketplace_fee = marketplaceFeePesos;
      }

      const response = await fetch(`${this.API_BASE}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(mpBody),
      });

      const responseJson = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorDesc =
          responseJson.message ||
          (Array.isArray(responseJson.cause) && responseJson.cause[0]?.description) ||
          `Error de Mercado Pago al procesar pago: ${response.statusText}`;
        const err: any = new Error(errorDesc);
        err.statusCode = response.status;
        err.details = sanitizeLogData(responseJson);
        throw err;
      }

      paymentData = responseJson;
    }

    const paymentId = String(paymentData.id);
    const rawStatus = paymentData.status;
    const paymentStatus: 'approved' | 'pending' | 'in_process' | 'rejected' =
      rawStatus === 'approved' ? 'approved' : rawStatus === 'rejected' ? 'rejected' : 'pending';
    const statusDetail = paymentData.status_detail;

    // 9. Persist Payment Attempt
    const attempt: PaymentAttempt = {
      id: `pay_att_${crypto.randomUUID()}`,
      order_id: order.id,
      customer_id: order.customer_id,
      restaurant_id: order.restaurant_id,
      idempotency_key: idempotencyKey,
      preference_id: order.mercadopago_preference_id,
      payment_id: paymentId,
      amount_cents: totalCents,
      currency: config.defaultCurrency,
      status: paymentStatus === 'approved' ? 'approved' : paymentStatus === 'rejected' ? 'rejected' : 'pending',
      marketplace_fee_cents: marketplaceFeeCents,
      mp_status_detail: statusDetail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await dbClient.getPaymentAttemptsCollection().insertOne(attempt as any);

    // 10. Update Order
    const orderUpdates: Partial<Order> = {
      mercadopago_payment_id: paymentId,
      mercadopago_status: rawStatus,
      payment_status: paymentStatus === 'approved' ? 'approved' : paymentStatus === 'rejected' ? 'rejected' : 'pending',
      payment_method: 'digital',
    };

    const shouldConfirmOrder = paymentStatus === 'approved' && order.status === 'pending';
    if (shouldConfirmOrder) {
      orderUpdates.status = 'confirmed';
      orderUpdates.status_history = [
        ...order.status_history,
        {
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          actor_id: 'mercadopago_brick',
          actor_role: 'system',
          notes: `Pago aprobado desde Brick de Mercado Pago (ID: ${paymentId})`,
        },
      ];
    }

    await OrderRepository.update(order.id, orderUpdates);

    // 11. Realtime Broadcast
    try {
      if (shouldConfirmOrder) {
        RealtimeService.emit({
          type: 'ORDER_ACCEPTED',
          order_id: order.id,
          restaurant_id: order.restaurant_id,
          customer_id: order.customer_id,
          data: {
            ...order,
            ...orderUpdates,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // non-fatal
    }

    // 12. Persistent Audit
    await AuditService.log(
      paymentStatus === 'approved' ? 'payment.approved' : paymentStatus === 'rejected' ? 'payment.rejected' : 'payment.pending',
      'order',
      order.id,
      {
        payment_id: paymentId,
        status: paymentStatus,
        status_detail: statusDetail,
        amount_cents: totalCents,
        marketplace_fee_cents: marketplaceFeeCents,
        idempotency_key: idempotencyKey,
      },
      params.customerId,
      'customer'
    );

    return {
      payment_id: paymentId,
      status: paymentStatus,
      status_detail: statusDetail,
      amount_cents: totalCents,
      order_id: order.id,
      is_duplicate: false,
      date_approved: paymentData.date_approved,
    };
  }

  /**
   * Queries payment status directly from Mercado Pago API.
   * NEVER trusts unverified notification bodies.
   */
  public static async fetchPaymentFromMercadoPago(paymentId: string): Promise<MercadoPagoPaymentDetails> {
    if (this.simulateNetworkFailure) {
      throw new Error('Mercado Pago API indisponible para consultar pago');
    }

    // In production, NEVER trust unverified or simulated responses without real MP verification
    if (config.nodeEnv === 'production') {
      if (paymentId.startsWith('mock_') || paymentId.includes('mock')) {
        const err: any = new Error(
          'Error de seguridad crítico: En producción está prohibido consultar o validar identificadores de pago simulados ("mock_").'
        );
        err.statusCode = 400;
        throw err;
      }
      if (!config.mpPlatformAccessToken) {
        throw new Error('Error crítico: MP_PLATFORM_ACCESS_TOKEN no configurado en producción para consultar el pago en Mercado Pago');
      }

      const response = await fetch(`${this.API_BASE}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.mpPlatformAccessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Error al consultar pago ${paymentId}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: String(data.id),
        status: data.status,
        status_detail: data.status_detail,
        transaction_amount: data.transaction_amount,
        external_reference: data.external_reference,
        currency_id: data.currency_id,
        date_approved: data.date_approved,
        payer: data.payer,
      };
    }

    // In test mode and development:
    // 1. Check local mock registry (for tests)
    if (this.mockPayments.has(paymentId)) {
      return this.mockPayments.get(paymentId)!;
    }

    // 2. If test mode or mock ID, return simulated fallback
    if (config.isTestMode || !config.mpPlatformAccessToken || paymentId.startsWith('mock_')) {
      return {
        id: paymentId,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100.0,
        external_reference: 'ord_mock',
        currency_id: config.defaultCurrency,
      };
    }

    // 3. Real HTTP call to Mercado Pago in development
    const response = await fetch(`${this.API_BASE}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.mpPlatformAccessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || `Error al consultar pago ${paymentId}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: String(data.id),
      status: data.status,
      status_detail: data.status_detail,
      transaction_amount: data.transaction_amount,
      external_reference: data.external_reference,
      currency_id: data.currency_id,
      date_approved: data.date_approved,
      payer: data.payer,
    };
  }

  /**
   * Processes a Webhook notification from Mercado Pago with signature verification,
   * resource verification, idempotent handling, and state machine protection.
   */
  public static async processWebhookNotification(params: {
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, any>;
    body: any;
  }): Promise<{
    handled: boolean;
    reason: string;
    orderId?: string;
    paymentId?: string;
    paymentStatus?: string;
  }> {
    const { headers, query, body } = params;

    // 1. Extract resource ID and Topic/Type
    const dataId =
      body?.data?.id ||
      query['data.id'] ||
      query.id ||
      body?.id ||
      (body?.resource ? body.resource.split('/').pop() : undefined);

    const type = body?.type || query.type || body?.topic || query.topic;

    if (!dataId) {
      return { handled: false, reason: 'Identificador de recurso (data.id) ausente en notificación' };
    }

    if (config.nodeEnv === 'production' && (String(dataId).startsWith('mock_') || String(dataId).includes('mock'))) {
      return { handled: false, reason: 'Identificadores de pago simulados ("mock_") están prohibidos en producción' };
    }

    // 2. Webhook Signature Verification
    const xSignature = (headers['x-signature'] as string) || '';
    const xRequestId = (headers['x-request-id'] as string) || '';

    if (config.nodeEnv === 'production') {
      if (!config.mpWebhookSecret) {
        const errorMsg = 'Error de seguridad crítico: MP_WEBHOOK_SECRET no está configurado en producción';
        await AuditService.log('payment.webhook_rejected_no_secret', 'webhook', String(dataId), {
          reason: errorMsg,
          headers: sanitizeLogData(headers),
        });
        const err: any = new Error(errorMsg);
        err.statusCode = 401;
        throw err;
      }

      const sigResult = verifyMercadoPagoWebhookSignature({
        xSignature,
        xRequestId,
        dataId: String(dataId),
        secret: config.mpWebhookSecret,
      });

      if (!sigResult.valid) {
        const errorMsg = `Firma de webhook de Mercado Pago inválida: ${sigResult.reason}`;
        await AuditService.log('payment.webhook_signature_rejected', 'webhook', String(dataId), {
          reason: sigResult.reason,
          headers: sanitizeLogData(headers),
        });
        const err: any = new Error(errorMsg);
        err.statusCode = 401;
        throw err;
      }
    } else if (config.mpWebhookSecret) {
      const sigResult = verifyMercadoPagoWebhookSignature({
        xSignature,
        xRequestId,
        dataId: String(dataId),
        secret: config.mpWebhookSecret,
      });

      if (!sigResult.valid) {
        const errorMsg = `Firma de webhook de Mercado Pago inválida: ${sigResult.reason}`;
        await AuditService.log('payment.webhook_signature_rejected', 'webhook', String(dataId), {
          reason: sigResult.reason,
          headers: sanitizeLogData(headers),
        });
        const err: any = new Error(errorMsg);
        err.statusCode = 401;
        throw err;
      }
    }

    // Ignore non-payment topics gracefully (e.g. merchant_order, chargebacks)
    if (type && type !== 'payment' && type !== 'payment.created' && type !== 'payment.updated') {
      return { handled: true, reason: `Tipo de notificación '${type}' recibido pero no requiere actualización de pedido` };
    }

    const paymentId = String(dataId);

    // 3. Consult payment resource directly from Mercado Pago (Authoritative Truth)
    const payment = await this.fetchPaymentFromMercadoPago(paymentId);
    if (!payment || !payment.external_reference) {
      return { handled: false, reason: `No se pudo obtener el pago ${paymentId} o carece de external_reference` };
    }

    const orderId = payment.external_reference;

    // 4. Idempotency Check on Processed Webhooks
    const eventKey = `evt_${paymentId}_${payment.status}`;
    const existingWebhook = await dbClient
      .getProcessedWebhooksCollection()
      .findOne({ event_id: eventKey });

    if (existingWebhook) {
      return {
        handled: true,
        reason: 'Notificación repetida ya procesada previamente (idempotente)',
        orderId,
        paymentId,
        paymentStatus: payment.status,
      };
    }

    // 5. Look up Order in Core
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      await AuditService.log('payment.webhook_order_not_found', 'order', orderId, {
        payment_id: paymentId,
        mp_status: payment.status,
      });
      return { handled: false, reason: `Pedido '${orderId}' vinculado al pago no existe en la base de datos` };
    }

    // 6. Security Check: Validate Amount (Prevent tampering attacks)
    const expectedPesos = parseFloat((order.total / 100).toFixed(2));
    const paidPesos = parseFloat(payment.transaction_amount.toFixed(2));

    if (Math.abs(paidPesos - expectedPesos) > 0.05) {
      // Amount mismatch! Security incident
      await AuditService.log('payment.amount_mismatch_detected', 'order', orderId, {
        payment_id: paymentId,
        expected_pesos: expectedPesos,
        paid_pesos: paidPesos,
        difference: paidPesos - expectedPesos,
      });
      const err: any = new Error(
        `Alerta de seguridad: el importe del pago ($${paidPesos}) no coincide con el total congelado del pedido ($${expectedPesos})`
      );
      err.statusCode = 400;
      throw err;
    }

    // 7. State Machine and Terminal State Protection
    // A late webhook must NEVER revert terminal states (cancelled, delivered)
    if (order.status === 'cancelled') {
      await AuditService.log('payment.webhook_ignored_order_cancelled', 'order', orderId, {
        payment_id: paymentId,
        mp_status: payment.status,
      });
      return { handled: true, reason: 'Pedido ya cancelado; no se actualiza estado', orderId, paymentId };
    }

    if (order.status === 'delivered') {
      await AuditService.log('payment.webhook_ignored_order_delivered', 'order', orderId, {
        payment_id: paymentId,
        mp_status: payment.status,
      });
      return { handled: true, reason: 'Pedido ya entregado; se conserva estado', orderId, paymentId };
    }

    // Map Mercado Pago status to Core status
    let newPaymentStatus: PaymentStatus = order.payment_status;
    let shouldConfirmOrder = false;

    if (payment.status === 'approved') {
      newPaymentStatus = 'approved';
      if (order.status === 'pending') {
        shouldConfirmOrder = true;
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      // Do not overwrite if already approved previously
      if (order.payment_status !== 'approved') {
        newPaymentStatus = 'rejected';
      }
    } else if (payment.status === 'in_process' || payment.status === 'pending') {
      if (order.payment_status !== 'approved') {
        newPaymentStatus = 'pending';
      }
    }

    // 8. Update Order in Database
    const orderUpdates: Partial<Order> = {
      mercadopago_payment_id: paymentId,
      mercadopago_status: payment.status,
      payment_status: newPaymentStatus,
    };

    if (shouldConfirmOrder) {
      orderUpdates.status = 'confirmed';
      orderUpdates.status_history = [
        ...order.status_history,
        {
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          actor_id: 'mercadopago_webhook',
          actor_role: 'system',
          notes: `Pago aprobado por Mercado Pago (ID: ${paymentId})`,
        },
      ];
    }

    await OrderRepository.update(order.id, orderUpdates);

    // 9. Update PaymentAttempt document
    await dbClient.getPaymentAttemptsCollection().updateOne(
      { order_id: order.id, payment_id: paymentId },
      {
        $set: {
          status: payment.status === 'approved' ? 'approved' : payment.status === 'rejected' ? 'rejected' : 'pending',
          payment_id: paymentId,
          mp_status_detail: payment.status_detail,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: false }
    );

    // 10. Record Processed Webhook for Idempotency
    const processedRecord: ProcessedWebhook = {
      id: `proc_wh_${crypto.randomUUID()}`,
      event_id: eventKey,
      action: body?.action || 'payment.update',
      topic: type || 'payment',
      resource_id: paymentId,
      status: payment.status,
      processed_at: new Date().toISOString(),
      signature_verified: Boolean(config.mpWebhookSecret),
    };

    await dbClient.getProcessedWebhooksCollection().insertOne(processedRecord as any);

    // 11. Persistent Audit Log
    await AuditService.log(
      payment.status === 'approved' ? 'payment.approved' : `payment.${payment.status}`,
      'order',
      order.id,
      {
        payment_id: paymentId,
        amount_mxn: payment.transaction_amount,
        mp_status: payment.status,
        status_detail: payment.status_detail,
        order_status: shouldConfirmOrder ? 'confirmed' : order.status,
      },
      'mercadopago_webhook',
      'system'
    );

    // 12. Real-time Notification
    try {
      if (shouldConfirmOrder) {
        RealtimeService.emit({
          type: 'ORDER_ACCEPTED',
          order_id: order.id,
          restaurant_id: order.restaurant_id,
          customer_id: order.customer_id,
          data: { ...order, ...orderUpdates },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // non-fatal
    }

    return {
      handled: true,
      reason: `Pago procesado con éxito (estado: ${payment.status})`,
      orderId: order.id,
      paymentId,
      paymentStatus: payment.status,
    };
  }
}
