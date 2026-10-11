import crypto from 'crypto';
import { initDb, dbClient } from '../db/connection.ts';
import { config } from '../config/index.ts';
import { MercadoPagoService } from '../services/mercadoPagoService.ts';
import { OrderService } from '../services/orderService.ts';
import { AuthService } from '../services/authService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { CatalogService } from '../services/restaurantService.ts';
import { AuditService } from '../services/auditService.ts';
import { decryptToken } from '../utils/cryptoUtils.ts';
import type { Order } from '../models/types.ts';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runMercadoPagoTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];
  await initDb();

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ num, name, passed: true });
      console.log(`  ✓ ${num}. ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, error: err.message });
      console.error(`  ✗ ${num}. ${name}: ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log('   DIRECTAURANTE CORE V2 — TEST SUITE: MERCADO PAGO MARKETPLACE');
  console.log('========================================================================\n');

  // Shared test variables
  const testRestaurantId = 'rest_tacos_guero';
  const testWebhookSecret = 'test_webhook_signing_secret_directaurante_2026';
  config.mpWebhookSecret = testWebhookSecret;

  let customerUser: any;
  let unauthorizedUser: any;
  let testOrderA: Order;
  let testOrderB: Order;

  // Setup test users and orders
  const setupEmail = `mp_cust_${Date.now()}@test.com`;
  const customerAuth = await AuthService.register({
    email: setupEmail,
    password: 'password123',
    name: 'Carlos MP Test',
    phone: '4621112233',
    role: 'customer',
  });
  customerUser = customerAuth.user;

  const unauthAuth = await AuthService.register({
    email: `unauth_${Date.now()}@test.com`,
    password: 'password123',
    name: 'Atacante Externo',
    phone: '4629990000',
    role: 'customer',
  });
  unauthorizedUser = unauthAuth.user;

  // Retrieve valid catalog product for test restaurant
  const catalogProducts = await CatalogService.getProductsByRestaurant(testRestaurantId);
  const testProductId = catalogProducts && catalogProducts.length > 0 ? catalogProducts[0].id : 'prod_tacos_pastor';

  // Create base test orders
  const testVariants = [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }];

  const orderResultA = await OrderService.createOrder(customerUser.id, {
    restaurant_id: testRestaurantId,
    order_type: 'pickup',
    items: [{ product_id: testProductId, quantity: 3, variants: testVariants }],
    payment_method: 'digital',
    tip_amount: 1000,
    idempotency_key: `idemp_mp_test_a_${Date.now()}`,
  });
  testOrderA = orderResultA.order;

  const orderResultB = await OrderService.createOrder(customerUser.id, {
    restaurant_id: testRestaurantId,
    order_type: 'pickup',
    items: [{ product_id: testProductId, quantity: 2, variants: testVariants }],
    payment_method: 'digital',
    tip_amount: 0,
    idempotency_key: `idemp_mp_test_b_${Date.now()}`,
  });
  testOrderB = orderResultB.order;

  // 1. Flujo OAuth de vendedor con generación de State CSRF y almacenamiento seguro
  await test(1, 'OAuth: flujo de vendedor con CSRF state y almacenamiento cifrado de tokens', async () => {
    const { url, state } = MercadoPagoService.getOAuthAuthorizationUrl(testRestaurantId);
    if (!url.includes('client_id=') || !url.includes('state=')) {
      throw new Error('URL de autorización OAuth mal formada');
    }

    const callbackRes = await MercadoPagoService.handleOAuthCallback({
      code: 'mock_auth_code_123',
      state,
      expectedRestaurantId: testRestaurantId,
    });

    if (!callbackRes.success || !callbackRes.collectorId) {
      throw new Error('El intercambio OAuth no reportó éxito');
    }

    // Verify tokens in DB are encrypted and NEVER stored in plaintext
    const restDoc = await RestaurantRepository.findById(testRestaurantId);
    if (!restDoc?.mercadopago_account?.access_token) {
      throw new Error('No se guardó mercadopago_account en el restaurante');
    }

    const rawEncrypted = restDoc.mercadopago_account.access_token;
    if (!rawEncrypted.includes(':')) {
      throw new Error('El access token no está cifrado en formato IV:TAG:DATA');
    }

    const decrypted = decryptToken(rawEncrypted);
    if (!decrypted.startsWith('APP_USR_TEST_TOKEN_')) {
      throw new Error('El token descifrado no coincide');
    }

    // Non-sensitive status check (must NOT expose access_token)
    const status = await MercadoPagoService.getAccountStatus(testRestaurantId);
    if (!status.is_connected || !status.collector_id) {
      throw new Error('El estado público no refleja la cuenta conectada');
    }
    if ((status as any).access_token) {
      throw new Error('Falla de seguridad: getAccountStatus filtró el access_token al cliente');
    }
  });

  // 2. OAuth con State CSRF inválido o manipulado
  await test(2, 'OAuth: rechazo de state CSRF incorrecto o manipulado', async () => {
    let threw = false;
    try {
      await MercadoPagoService.handleOAuthCallback({
        code: 'mock_code',
        state: 'tampered.signature',
        expectedRestaurantId: testRestaurantId,
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error('Se debió rechazar el state con firma adulterada');
    }
  });

  // 3. Creación de preferencia de pago válida con Marketplace Fee autoritativo
  await test(3, 'Preferencia de pago válida con comisión calculada por el Core', async () => {
    const idempotencyKey = `idemp_pref_${testOrderA.id}`;
    const pref = await MercadoPagoService.createPaymentPreference({
      orderId: testOrderA.id,
      customerId: customerUser.id,
      idempotencyKey,
    });

    if (!pref.preference_id || !pref.init_point) {
      throw new Error('No se generó el preference_id o init_point');
    }
    if (pref.amount_cents !== testOrderA.total) {
      throw new Error(`El importe de la preferencia (${pref.amount_cents}) no coincide con el total congelado (${testOrderA.total})`);
    }
    if (pref.marketplace_fee_cents <= 0) {
      throw new Error('No se aplicó la comisión de marketplace de Directaurante');
    }

    // Verify order was updated with preference ID
    const updatedOrder = await OrderRepository.findById(testOrderA.id);
    if (updatedOrder?.mercadopago_preference_id !== pref.preference_id) {
      throw new Error('El pedido no guardó el mercadopago_preference_id');
    }
  });

  // 4. Pedido ajeno al usuario autenticado (Protección RBAC 403)
  await test(4, 'Rechazo al intentar crear pago para un pedido ajeno (403 Forbidden)', async () => {
    let threw = false;
    try {
      await MercadoPagoService.createPaymentPreference({
        orderId: testOrderA.id,
        customerId: unauthorizedUser.id, // Different user
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) {
        throw new Error(`Se esperaba status 403, recibido: ${err.statusCode}`);
      }
    }

    if (!threw) {
      throw new Error('Se debió denegar la creación de pago para un pedido ajeno');
    }
  });

  // 5. Doble solicitud de creación de pago (Idempotencia)
  await test(5, 'Idempotencia en creación de preferencia de pago (previene duplicados)', async () => {
    const idempotencyKey = `idemp_double_test_${Date.now()}`;

    const first = await MercadoPagoService.createPaymentPreference({
      orderId: testOrderB.id,
      customerId: customerUser.id,
      idempotencyKey,
    });

    const second = await MercadoPagoService.createPaymentPreference({
      orderId: testOrderB.id,
      customerId: customerUser.id,
      idempotencyKey,
    });

    if (first.preference_id !== second.preference_id) {
      throw new Error('La segunda llamada generó una preferencia diferente');
    }
    if (!second.is_duplicate) {
      throw new Error('La segunda llamada debió ser marcada como is_duplicate');
    }
  });

  // 6. Webhook con firma HMAC válida: Pago aprobado
  await test(6, 'Webhook: firma HMAC válida y procesamiento de pago aprobado', async () => {
    const paymentId = `pay_approved_${Date.now()}`;
    const amountPesos = parseFloat((testOrderA.total / 100).toFixed(2));

    // Seed mock payment in Mercado Pago
    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: amountPesos,
      external_reference: testOrderA.id,
      currency_id: 'MXN',
    });

    // Generate valid HMAC signature
    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    const res = await MercadoPagoService.processWebhookNotification({
      headers: {
        'x-signature': xSignature,
        'x-request-id': requestId,
      },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });

    if (!res.handled) {
      throw new Error(`El webhook no fue manejado: ${res.reason}`);
    }

    // Verify order transitioned to approved & confirmed
    const updated = await OrderRepository.findById(testOrderA.id);
    if (updated?.payment_status !== 'approved') {
      throw new Error(`Estado de pago no actualizado a approved. Actual: ${updated?.payment_status}`);
    }
    if (updated?.status !== 'confirmed') {
      throw new Error(`El pedido no transicionó a confirmed. Actual: ${updated?.status}`);
    }
    if (updated?.mercadopago_payment_id !== paymentId) {
      throw new Error('El pedido no almacenó el payment_id de Mercado Pago');
    }
  });

  // 7. Webhook con firma inválida (Rechazo de seguridad)
  await test(7, 'Webhook: rechazo estricto ante firma inválida (401)', async () => {
    const paymentId = `pay_tampered_${Date.now()}`;

    let threw = false;
    try {
      await MercadoPagoService.processWebhookNotification({
        headers: {
          'x-signature': 'ts=1700000000,v1=bad_signature_hash',
          'x-request-id': 'req_tampered',
        },
        query: { 'data.id': paymentId, type: 'payment' },
        body: { data: { id: paymentId }, type: 'payment' },
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 401) {
        throw new Error(`Se esperaba status 401, recibido: ${err.statusCode}`);
      }
    }

    if (!threw) {
      throw new Error('El webhook debió rechazar la firma adulterada');
    }
  });

  // 8. Webhook repetido (Procesamiento idempotente de notificaciones)
  await test(8, 'Webhook repetido: procesamiento idempotente sin duplicar transiciones', async () => {
    const paymentId = `pay_dup_${Date.now()}`;
    const amountPesos = parseFloat((testOrderB.total / 100).toFixed(2));

    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: amountPesos,
      external_reference: testOrderB.id,
      currency_id: 'MXN',
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    // First call
    const res1 = await MercadoPagoService.processWebhookNotification({
      headers: { 'x-signature': xSignature, 'x-request-id': requestId },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });
    if (!res1.handled) throw new Error('Primer webhook no procesado');

    // Second call with same event
    const res2 = await MercadoPagoService.processWebhookNotification({
      headers: { 'x-signature': xSignature, 'x-request-id': requestId },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });

    if (!res2.handled || !res2.reason.includes('idempotente')) {
      throw new Error('La notificación repetida no fue detectada como idempotente');
    }
  });

  // 9. Importe manipulado (Rechazo y alerta de seguridad)
  await test(9, 'Seguridad: detección y rechazo de importe de pago manipulado', async () => {
    // Create new order to test tamper detection
    const orderTamperRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 4, variants: testVariants }], // total ~ $100
      payment_method: 'digital',
      idempotency_key: `idemp_tamper_${Date.now()}`,
    });
    const orderTamper = orderTamperRes.order;

    const paymentId = `pay_tamper_${Date.now()}`;
    // Payment amount is manipulated to $1.00 MXN!
    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'approved',
      transaction_amount: 1.00, // Intentional mismatch
      external_reference: orderTamper.id,
      currency_id: 'MXN',
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    let threw = false;
    try {
      await MercadoPagoService.processWebhookNotification({
        headers: { 'x-signature': xSignature, 'x-request-id': requestId },
        query: { 'data.id': paymentId, type: 'payment' },
        body: { data: { id: paymentId }, type: 'payment' },
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Alerta de seguridad') && !err.message.includes('no coincide')) {
        throw new Error(`Mensaje inesperado: ${err.message}`);
      }
    }

    if (!threw) {
      throw new Error('El sistema debió rechazar el pago con importe adulterado');
    }

    // Verify order was NOT marked as approved
    const checkOrder = await OrderRepository.findById(orderTamper.id);
    if (checkOrder?.payment_status === 'approved') {
      throw new Error('Falla de integridad: el pedido fue marcado como aprobado a pesar del importe manipulado');
    }
  });

  // 10. Webhook: Pago rechazado
  await test(10, 'Webhook: procesamiento de pago rechazado sin corromper el pedido', async () => {
    const orderRejectRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_reject_${Date.now()}`,
    });
    const orderReject = orderRejectRes.order;

    const paymentId = `pay_rejected_${Date.now()}`;
    const amountPesos = parseFloat((orderReject.total / 100).toFixed(2));

    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'rejected',
      status_detail: 'cc_rejected_insufficient_amount',
      transaction_amount: amountPesos,
      external_reference: orderReject.id,
      currency_id: 'MXN',
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    await MercadoPagoService.processWebhookNotification({
      headers: { 'x-signature': xSignature, 'x-request-id': requestId },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });

    const updated = await OrderRepository.findById(orderReject.id);
    if (updated?.payment_status !== 'rejected') {
      throw new Error(`Se esperaba payment_status 'rejected', obtenido: ${updated?.payment_status}`);
    }
  });

  // 11. Webhook: Pago pendiente (in_process)
  await test(11, 'Webhook: pago pendiente mantiene estado sin transicionar prematuramente', async () => {
    const orderPendingRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_pending_${Date.now()}`,
    });
    const orderPending = orderPendingRes.order;

    const paymentId = `pay_pending_${Date.now()}`;
    const amountPesos = parseFloat((orderPending.total / 100).toFixed(2));

    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'pending',
      status_detail: 'pending_waiting_transfer',
      transaction_amount: amountPesos,
      external_reference: orderPending.id,
      currency_id: 'MXN',
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    await MercadoPagoService.processWebhookNotification({
      headers: { 'x-signature': xSignature, 'x-request-id': requestId },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });

    const updated = await OrderRepository.findById(orderPending.id);
    if (updated?.payment_status !== 'pending') {
      throw new Error(`Se esperaba payment_status 'pending', obtenido: ${updated?.payment_status}`);
    }
    if (updated?.status !== 'pending') {
      throw new Error(`El estado del pedido no debe avanzar con pago pendiente`);
    }
  });

  // 12. Indisponibilidad o fallo de red en Mercado Pago
  await test(12, 'Resiliencia: manejo seguro de fallos y excepciones en la API de Mercado Pago', async () => {
    MercadoPagoService.setSimulateNetworkFailure(true);

    let threw = false;
    try {
      await MercadoPagoService.createPaymentPreference({
        orderId: testOrderB.id,
        customerId: customerUser.id,
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('temporalmente no disponible')) {
        throw new Error(`Error inesperado: ${err.message}`);
      }
    } finally {
      MercadoPagoService.setSimulateNetworkFailure(false);
    }

    if (!threw) {
      throw new Error('El sistema debió capturar el fallo de red controladamente');
    }
  });

  // 13. Protección de estados terminales: notificación retrasada sobre pedido cancelado
  await test(13, 'Máquina de estados: notificación retrasada no revierte pedido cancelado', async () => {
    const orderCancelRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_cancel_${Date.now()}`,
    });
    const orderCancel = orderCancelRes.order;

    // Cancel order first
    await OrderService.updateOrderStatus(orderCancel.id, 'cancelled', {
      id: customerUser.id,
      role: 'customer',
      notes: 'Cancelado por el cliente',
    });

    const paymentId = `pay_late_${Date.now()}`;
    const amountPesos = parseFloat((orderCancel.total / 100).toFixed(2));

    MercadoPagoService.seedMockPayment({
      id: paymentId,
      status: 'approved',
      transaction_amount: amountPesos,
      external_reference: orderCancel.id,
      currency_id: 'MXN',
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const requestId = `req_${crypto.randomUUID()}`;
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', testWebhookSecret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${hmac}`;

    await MercadoPagoService.processWebhookNotification({
      headers: { 'x-signature': xSignature, 'x-request-id': requestId },
      query: { 'data.id': paymentId, type: 'payment' },
      body: { data: { id: paymentId }, type: 'payment' },
    });

    const check = await OrderRepository.findById(orderCancel.id);
    if (check?.status !== 'cancelled') {
      throw new Error('Falla: una notificación retrasada revirtió el estado cancelado');
    }
  });

  // 14. Auditoría limpia sin secretos ni tokens
  await test(14, 'Auditoría persistente: registros libres de secretos, tarjetas y access tokens', async () => {
    const logs = await AuditService.getLogsForEntity(testRestaurantId);
    for (const log of logs) {
      const detailsStr = JSON.stringify(log.details);
      if (detailsStr.includes('APP_USR_') || detailsStr.includes('REFRESH_')) {
        throw new Error('Falla de seguridad: los registros de auditoría contienen tokens no redactados');
      }
    }
  });

  // 15. Brick: Procesamiento de pago con cálculo soberano y transición a confirmed
  await test(15, 'Brick: procesamiento de pago con cálculo soberano y transición automática', async () => {
    const orderBrickRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 2, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_brick_test_${Date.now()}`,
    });
    const orderBrick = orderBrickRes.order;

    const payResult = await MercadoPagoService.processPayment({
      orderId: orderBrick.id,
      customerId: customerUser.id,
      token: 'mock_card_token_123',
      paymentMethodId: 'visa',
      installments: 1,
      payerEmail: 'comprador_test@test.com',
      idempotencyKey: `idemp_pay_proc_${orderBrick.id}`,
    });

    if (payResult.status !== 'approved') {
      throw new Error(`Se esperaba pago approved, recibido: ${payResult.status}`);
    }
    if (payResult.amount_cents !== orderBrick.total) {
      throw new Error(`Importe procesado (${payResult.amount_cents}) no coincide con total soberano (${orderBrick.total})`);
    }

    // Verify order was confirmed & payment_status approved
    const updated = await OrderRepository.findById(orderBrick.id);
    if (updated?.payment_status !== 'approved') {
      throw new Error(`Estado de pago del pedido incorrecto: ${updated?.payment_status}`);
    }
    if (updated?.status !== 'confirmed') {
      throw new Error(`El pedido debió transicionar a confirmed. Actual: ${updated?.status}`);
    }
    if (!updated?.mercadopago_payment_id) {
      throw new Error('El pedido no guardó mercadopago_payment_id');
    }
  });

  // 16. Brick: Idempotencia en procesamiento de pago
  await test(16, 'Brick: idempotencia en procesamiento (previene doble cobro al reintentar)', async () => {
    const orderDupRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_brick_dup_${Date.now()}`,
    });
    const orderDup = orderDupRes.order;
    const idempotencyKey = `idemp_key_dup_${orderDup.id}`;

    const res1 = await MercadoPagoService.processPayment({
      orderId: orderDup.id,
      customerId: customerUser.id,
      token: 'mock_token_dup',
      paymentMethodId: 'mastercard',
      idempotencyKey,
    });

    const res2 = await MercadoPagoService.processPayment({
      orderId: orderDup.id,
      customerId: customerUser.id,
      token: 'mock_token_dup',
      paymentMethodId: 'mastercard',
      idempotencyKey,
    });

    if (!res2.is_duplicate) {
      throw new Error('La segunda invocación no fue marcada como is_duplicate');
    }
    if (res1.payment_id !== res2.payment_id) {
      throw new Error('El ID de pago cambió entre llamadas idempotentes');
    }
  });

  // 17. Brick: Rechazo de pago para pedido ajeno (403)
  await test(17, 'Brick: rechazo de pago para pedido de otro usuario (403 Forbidden)', async () => {
    const orderUnauthRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_brick_unauth_${Date.now()}`,
    });
    const orderUnauth = orderUnauthRes.order;

    let threw = false;
    try {
      await MercadoPagoService.processPayment({
        orderId: orderUnauth.id,
        customerId: unauthorizedUser.id, // Attacker user
        token: 'mock_attacker_token',
        paymentMethodId: 'visa',
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) {
        throw new Error(`Se esperaba statusCode 403, recibido: ${err.statusCode}`);
      }
    }

    if (!threw) {
      throw new Error('El sistema debió rechazar el pago del atacante para pedido ajeno');
    }
  });

  // 18. Brick: Rechazo de pago para pedido en estado no pagable (cancelado)
  await test(18, 'Brick: rechazo de pago para pedido cancelado (400 Bad Request)', async () => {
    const orderCancelRes = await OrderService.createOrder(customerUser.id, {
      restaurant_id: testRestaurantId,
      order_type: 'pickup',
      items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
      payment_method: 'digital',
      idempotency_key: `idemp_brick_cancel_${Date.now()}`,
    });
    const orderCancel = orderCancelRes.order;

    await OrderService.updateOrderStatus(orderCancel.id, 'cancelled', {
      id: customerUser.id,
      role: 'customer',
      notes: 'Cancelado antes del pago',
    });

    let threw = false;
    try {
      await MercadoPagoService.processPayment({
        orderId: orderCancel.id,
        customerId: customerUser.id,
        token: 'mock_token_cancel',
        paymentMethodId: 'visa',
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 400) {
        throw new Error(`Se esperaba statusCode 400, recibido: ${err.statusCode}`);
      }
    }

    if (!threw) {
      throw new Error('El sistema debió rechazar el pago para un pedido cancelado');
    }
  });

  // 19. Brick: Manejo seguro ante indisponibilidad de Mercado Pago (503)
  await test(19, 'Brick: resiliencia ante fallo de proveedor o red (503 Service Unavailable)', async () => {
    MercadoPagoService.setSimulateNetworkFailure(true);

    let threw = false;
    try {
      await MercadoPagoService.processPayment({
        orderId: testOrderB.id,
        customerId: customerUser.id,
        token: 'mock_token_fail',
        paymentMethodId: 'visa',
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 503) {
        throw new Error(`Se esperaba status 503, recibido: ${err.statusCode}`);
      }
    } finally {
      MercadoPagoService.setSimulateNetworkFailure(false);
    }

    if (!threw) {
      throw new Error('El sistema debió capturar el fallo de red controladamente con status 503');
    }
  });

  // 20. Producción: Bloquea por completo tokens de pago simulados ("mock_")
  await test(20, 'Producción: Bloqueo estricto de tokens de pago simulados ("mock_")', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevToken = process.env.MP_PLATFORM_ACCESS_TOKEN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.MP_PLATFORM_ACCESS_TOKEN = 'APP_USR-valid-prod-platform-token-987654';

      const orderProdRes = await OrderService.createOrder(customerUser.id, {
        restaurant_id: testRestaurantId,
        order_type: 'pickup',
        items: [{ product_id: testProductId, quantity: 1, variants: testVariants }],
        payment_method: 'digital',
        idempotency_key: `idemp_brick_prod_${Date.now()}`,
      });
      const orderProd = orderProdRes.order;

      let threw = false;
      try {
        await MercadoPagoService.processPayment({
          orderId: orderProd.id,
          customerId: customerUser.id,
          token: 'mock_card_token_123',
          paymentMethodId: 'visa',
        });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('estrictamente bloqueados los tokens de tarjeta simulados')) {
          throw new Error(`Mensaje inesperado: ${err.message}`);
        }
      }

      if (!threw) {
        throw new Error('El sistema debió rechazar el token simulado en producción');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevToken) process.env.MP_PLATFORM_ACCESS_TOKEN = prevToken;
      else delete process.env.MP_PLATFORM_ACCESS_TOKEN;
    }
  });

  // 21. Producción: Bloquea por completo códigos OAuth simulados ("mock_")
  await test(21, 'Producción: Bloqueo estricto de códigos OAuth simulados ("mock_")', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const validState = MercadoPagoService.getOAuthAuthorizationUrl(testRestaurantId).state;

      let threw = false;
      try {
        await MercadoPagoService.handleOAuthCallback({
          code: 'mock_oauth_code_xyz',
          state: validState,
          expectedRestaurantId: testRestaurantId,
        });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('estrictamente bloqueadas las vinculaciones OAuth simuladas')) {
          throw new Error(`Mensaje inesperado: ${err.message}`);
        }
      }

      if (!threw) {
        throw new Error('El sistema debió rechazar el código OAuth simulado en producción');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  console.log('\n========================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`   RESULTADO SUITE MERCADO PAGO: ${passed} PASADAS / ${failed} FALLADAS (${results.length} PRUEBAS)`);
  console.log('========================================================================\n');

  return { passed, failed, results };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('mercadoPago.test.ts')) {
  runMercadoPagoTests()
    .then((res) => {
      if (res.failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Error fatal ejecutando pruebas de Mercado Pago:', err);
      process.exit(1);
    });
}
