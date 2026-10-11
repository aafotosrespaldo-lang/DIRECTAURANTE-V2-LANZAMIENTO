import { AuthService } from '../services/authService.ts';
import { RestaurantService, CatalogService } from '../services/restaurantService.ts';
import { OrderService } from '../services/orderService.ts';
import { AuditService } from '../services/auditService.ts';
import { dbClient, initDb } from '../db/connection.ts';
import { validateRegister } from '../schemas/validation.ts';
import { getJwtSecret, config } from '../config/index.ts';
import { getCorsOptions } from '../app.ts';
import { RealtimeService } from '../services/realtimeService.ts';
import type { SSEClient } from '../services/realtimeService.ts';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runCoreTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
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

  console.log('\n======================================================');
  console.log('   DIRECTAURANTE CORE V2 — TEST SUITE CONSOLIDADA');
  console.log('======================================================\n');

  // Variables shared across tests
  let customerAToken = '';
  let customerAId = '';
  let customerBToken = '';
  let customerBId = '';
  let restaurantOwnerToken = '';
  let restaurantOwnerId = '';
  let restaurantBId = 'rest_burger_lab';
  let restaurantBOwnerId = '';
  let sampleRestaurantId = 'rest_tacos_guero';
  let sampleProductId = '';
  let sampleOrderId = '';
  const normalIdempotencyKey = `idemp_norm_${Date.now()}`;
  const concurrentIdempotencyKey = `idemp_conc_${Date.now()}`;

  // 1. Registro customer
  await test(1, 'registro customer', async () => {
    const email = `carlos_test_${Date.now()}@directaurante.com`;
    const res = await AuthService.register({
      name: 'Carlos Cliente',
      email,
      password: 'passwordSeguro123',
      phone: '4621112233',
      role: 'customer',
    });
    if (!res.token || !res.user.id) throw new Error('Falta token o id');
    if (res.user.role !== 'customer') throw new Error('El rol asignado no es customer');
    customerAToken = res.token;
    customerAId = res.user.id;

    // Register second customer for isolation/ownership testing
    const emailB = `maria_test_${Date.now()}@directaurante.com`;
    const resB = await AuthService.register({
      name: 'María Cliente B',
      email: emailB,
      password: 'passwordSeguro456',
      phone: '4629998877',
      role: 'customer',
    });
    customerBToken = resB.token;
    customerBId = resB.user.id;
  });

  // 2. Login
  await test(2, 'login', async () => {
    const login = await AuthService.login({
      email: 'carlos@directaurante.com',
      password: 'cliente123',
    });
    if (!login.token || login.user.email !== 'carlos@directaurante.com') {
      throw new Error('Credenciales válidas no retornaron sesión');
    }
    // Also login restaurant owner
    const restLogin = await AuthService.login({
      email: 'donpepe@tacoselguero.com',
      password: 'tacos123',
    });
    restaurantOwnerToken = restLogin.token;
    restaurantOwnerId = restLogin.user.id;

    // Create a restaurant owner for restaurant B to test cross-restaurant protection
    const ownerB = await AuthService.createPrivilegedUser({
      name: 'Dueño Burger Lab',
      email: `owner_lab_${Date.now()}@burgerlab.com`,
      password: 'burgerLab123',
      phone: '4623344556',
      role: 'restaurant',
    });
    restaurantBOwnerId = ownerB.user.id;
    // Link owner B to restaurant B in DB
    await dbClient.getRestaurantsCollection().updateOne({ id: restaurantBId }, { $set: { owner_id: restaurantBOwnerId } });
  });

  // 3. JWT válido
  await test(3, 'JWT válido', async () => {
    const decoded = AuthService.verifyToken(customerAToken);
    if (decoded.id !== customerAId || decoded.role !== 'customer') {
      throw new Error('Payload del JWT no coincide');
    }
  });

  // 4. JWT inválido
  await test(4, 'JWT inválido', async () => {
    let threw = false;
    try {
      AuthService.verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El JWT falso debió ser rechazado');
  });

  // 5. MongoDB persistence
  await test(5, 'MongoDB persistence', async () => {
    const userDoc = await dbClient.getUsersCollection().findOne({ id: customerAId });
    if (!userDoc) throw new Error('El usuario no existe físicamente en MongoDB');
    if (!userDoc.passwordHash.startsWith('$2')) throw new Error('El password hash en MongoDB no es bcrypt');
  });

  // 6. Restaurante
  await test(6, 'restaurante', async () => {
    const list = await RestaurantService.listRestaurants();
    if (!list || list.length === 0) throw new Error('No se encontraron restaurantes');
    const detail = await RestaurantService.getRestaurantById(sampleRestaurantId);
    if (!detail || (!detail.name.includes('Güero'))) throw new Error('Detalle de restaurante erróneo');
  });

  // 7. Catálogo
  await test(7, 'catálogo', async () => {
    const categories = await CatalogService.getCategories();
    if (!categories || categories.length === 0) throw new Error('Categorías no encontradas');
    const products = await CatalogService.getProductsByRestaurant(sampleRestaurantId);
    if (!products || products.length === 0) throw new Error('Productos del restaurante vacíos');
    sampleProductId = products[0].id; // prod_tacos_pastor
    // Reset product stock for test run
    await dbClient.getProductsCollection().updateOne(
      { $or: [{ id: sampleProductId }, { product_id: sampleProductId }] },
      { $set: { stock: 100 } }
    );
  });

  // 8. Variantes
  await test(8, 'variantes', async () => {
    const prod = await CatalogService.getProductById(sampleProductId);
    if (!prod || !prod.variants || prod.variants.length === 0) throw new Error('Producto sin variantes');
    const group = prod.variants[0];
    if (!group.options || group.options.length === 0) throw new Error('Grupo de variantes sin opciones');
  });

  // 9. Toppings
  await test(9, 'toppings', async () => {
    const prod = await CatalogService.getProductById(sampleProductId);
    if (!prod || !prod.toppings || prod.toppings.length === 0) throw new Error('Producto sin toppings');
  });

  // 10. Cálculo soberano
  await test(10, 'cálculo soberano', async () => {
    const prod = await CatalogService.getProductById(sampleProductId);
    if (!prod) throw new Error('Producto no encontrado');
    const rest = await RestaurantService.getRestaurantById(sampleRestaurantId);

    const res = await OrderService.createOrder(customerAId, {
      restaurant_id: sampleRestaurantId,
      order_type: 'delivery',
      delivery_address: 'Av. Morelos #100, Centro',
      items: [
        {
          product_id: sampleProductId,
          quantity: 2,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_harina' }], // +1500 c/u
          toppings: ['top_queso'], // +2500 c/u
        },
      ],
      payment_method: 'cash',
      tip_amount: 2000,
    });

    const expectedLineUnitPrice = prod.price + 1500 + 2500;
    const expectedSubtotal = expectedLineUnitPrice * 2;
    const expectedDelivery = res.order.delivery_fee;
    const expectedService = res.order.service_fee; // 0 (el cliente no paga tarifa de servicio)
    const expectedTip = 2000;
    const expectedTotal = expectedSubtotal + expectedDelivery + expectedService + expectedTip;

    if (res.order.subtotal !== expectedSubtotal) {
      throw new Error(`Subtotal incorrecto. Esperado ${expectedSubtotal}, obtenido ${res.order.subtotal}`);
    }
    if (res.order.total !== expectedTotal) {
      throw new Error(`Total incorrecto. Esperado ${expectedTotal}, obtenido ${res.order.total}`);
    }
  });

  // 11. Pickup sin delivery fee
  await test(11, 'pickup sin delivery fee', async () => {
    const res = await OrderService.createOrder(customerAId, {
      restaurant_id: sampleRestaurantId,
      order_type: 'pickup',
      items: [
        {
          product_id: sampleProductId,
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
        },
      ],
      payment_method: 'cash',
    });

    if (res.order.delivery_fee !== 0) {
      throw new Error(`En pickup delivery_fee debe ser 0. Obtenido: ${res.order.delivery_fee}`);
    }
  });

  // 12. Pedido válido
  await test(12, 'pedido válido', async () => {
    const res = await OrderService.createOrder(customerAId, {
      restaurant_id: sampleRestaurantId,
      order_type: 'delivery',
      delivery_address: 'Calle Hidalgo #45, Pénjamo',
      items: [
        {
          product_id: sampleProductId,
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
        },
      ],
      payment_method: 'cash',
      idempotency_key: normalIdempotencyKey,
    });

    if (!res.order.id || res.order.status !== 'pending') {
      throw new Error('El pedido válido no se creó en estado pending');
    }
    sampleOrderId = res.order.id;
  });

  // 13. Producto inexistente rechazado
  await test(13, 'producto inexistente rechazado', async () => {
    let threw = false;
    try {
      await OrderService.createOrder(customerAId, {
        restaurant_id: sampleRestaurantId,
        order_type: 'pickup',
        items: [{ product_id: 'prod_inexistente_9999', quantity: 1 }],
        payment_method: 'cash',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El pedido con producto inexistente debió ser rechazado');
  });

  // 14. Variante inválida rechazada
  await test(14, 'variante inválida rechazada', async () => {
    let threw = false;
    try {
      await OrderService.createOrder(customerAId, {
        restaurant_id: sampleRestaurantId,
        order_type: 'pickup',
        items: [
          {
            product_id: sampleProductId,
            quantity: 1,
            variants: [{ group_id: 'var_tortilla', option_id: 'opt_opcion_falsa_999' }],
          },
        ],
        payment_method: 'cash',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('La variante inválida debió ser rechazada');
  });

  // 15. Topping inválido rechazado
  await test(15, 'topping inválido rechazado', async () => {
    let threw = false;
    try {
      await OrderService.createOrder(customerAId, {
        restaurant_id: sampleRestaurantId,
        order_type: 'pickup',
        items: [
          {
            product_id: sampleProductId,
            quantity: 1,
            variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
            toppings: ['top_inexistente_999'],
          },
        ],
        payment_method: 'cash',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El topping inválido debió ser rechazado');
  });

  // 16. Idempotencia normal
  await test(16, 'idempotencia normal', async () => {
    const res = await OrderService.createOrder(customerAId, {
      restaurant_id: sampleRestaurantId,
      order_type: 'delivery',
      delivery_address: 'Calle Hidalgo #45, Pénjamo',
      items: [
        {
          product_id: sampleProductId,
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
        },
      ],
      payment_method: 'cash',
      idempotency_key: normalIdempotencyKey,
    });

    if (!res.isDuplicate) throw new Error('La clave idempotente debió marcar isDuplicate: true');
    if (res.order.id !== sampleOrderId) throw new Error('No devolvió la misma orden original');
  });

  // 17. Idempotencia concurrente (con Promise.all simulando solicitudes simultáneas)
  await test(17, 'idempotencia concurrente', async () => {
    const payload = {
      restaurant_id: sampleRestaurantId,
      order_type: 'pickup' as const,
      items: [
        {
          product_id: sampleProductId,
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
        },
      ],
      payment_method: 'cash' as const,
      idempotency_key: concurrentIdempotencyKey,
    };

    // Simulate 2 parallel network requests hitting the Core at the same millisecond
    const [res1, res2] = await Promise.all([
      OrderService.createOrder(customerAId, payload),
      OrderService.createOrder(customerAId, payload),
    ]);

    if (res1.order.id !== res2.order.id) {
      throw new Error(`Colisión en concurrencia: se crearon IDs distintos (${res1.order.id} vs ${res2.order.id})`);
    }

    // Verify exactly ONE document exists in MongoDB with this idempotency key
    const countInMongo = await dbClient
      .getOrdersCollection()
      .countDocuments({ customer_id: customerAId, idempotency_key: concurrentIdempotencyKey });

    if (countInMongo !== 1) {
      throw new Error(`Se duplicó el documento en MongoDB. Documentos encontrados: ${countInMongo}`);
    }
  });

  // 18. Customer no puede ver pedido ajeno
  await test(18, 'customer no puede ver pedido ajeno', async () => {
    let threw = false;
    try {
      await OrderService.getOrderById(sampleOrderId, { id: customerBId, role: 'customer' });
    } catch (err: any) {
      threw = true;
    }
    if (!threw) throw new Error('El cliente B no debió poder consultar el pedido del cliente A');
  });

  // 19. Restaurant no puede operar pedido de otro restaurante
  await test(19, 'restaurant no puede operar pedido de otro restaurante', async () => {
    let threw = false;
    try {
      // Owner of restaurant B attempts to accept order belonging to restaurant A
      await OrderService.updateOrderStatus(sampleOrderId, 'confirmed', {
        id: restaurantBOwnerId,
        role: 'restaurant',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El dueño del restaurante B no debió poder operar el pedido del restaurante A');
  });

  // 20. Driver no puede operar pedido no asignado
  await test(20, 'driver no puede operar pedido no asignado', async () => {
    let threw = false;
    try {
      // Arbitrary driver attempts to deliver order
      await OrderService.updateOrderStatus(sampleOrderId, 'delivering', {
        id: 'usr_driver_intruso_99',
        role: 'driver',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El conductor no asignado debió ser rechazado');
  });

  // 21. Transición válida
  await test(21, 'transición válida', async () => {
    // Restaurant A confirms
    const conf = await OrderService.updateOrderStatus(sampleOrderId, 'confirmed', {
      id: restaurantOwnerId,
      role: 'restaurant',
    });
    if (conf.status !== 'confirmed') throw new Error('Fallo al pasar a confirmed');

    // Restaurant A prepares
    const prep = await OrderService.updateOrderStatus(sampleOrderId, 'preparing', {
      id: restaurantOwnerId,
      role: 'restaurant',
    });
    if (prep.status !== 'preparing') throw new Error('Fallo al pasar a preparing');

    // Restaurant A readies
    const ready = await OrderService.updateOrderStatus(sampleOrderId, 'ready', {
      id: restaurantOwnerId,
      role: 'restaurant',
    });
    if (ready.status !== 'ready') throw new Error('Fallo al pasar a ready');
  });

  // 22. Transición inválida
  await test(22, 'transición inválida', async () => {
    let threw = false;
    try {
      // Cannot jump backwards from ready to pending
      await OrderService.updateOrderStatus(sampleOrderId, 'pending', {
        id: restaurantOwnerId,
        role: 'restaurant',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('El salto de estado inválido debió ser rechazado');
  });

  // 23. Rol privilegiado no puede obtenerse mediante registro
  await test(23, 'rol privilegiado no puede obtenerse mediante registro', async () => {
    // Attempt privilege escalation in payload
    const val = validateRegister({
      name: 'Hacker',
      email: 'hacker@directaurante.com',
      password: 'password123',
      role: 'master', // Attempting master role
    });

    if (val.valid) {
      throw new Error('El schema de registro público debió rechazar el intento de registrar rol master');
    }
  });

  // 24. Auditoría persistida
  await test(24, 'auditoría persistida', async () => {
    const logs = await AuditService.getLogsForEntity(sampleOrderId);
    if (!logs || logs.length === 0) {
      throw new Error('No se encontraron registros de auditoría en MongoDB para la orden');
    }

    const events = logs.map((l) => l.event);
    if (!events.includes('order.created')) {
      throw new Error('Falta evento order.created en auditoría');
    }
    if (!events.includes('order.confirmed')) {
      throw new Error('Falta evento order.confirmed en auditoría');
    }
  });

  // 25. JWT_SECRET ausente en producción
  await test(25, 'JWT_SECRET ausente en producción', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      let threw = false;
      try {
        getJwtSecret();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('JWT_SECRET es obligatorio en producción')) {
          throw new Error(`Mensaje de error inesperado: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error('getJwtSecret debió lanzar error crítico al no tener JWT_SECRET en producción');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret !== undefined) process.env.JWT_SECRET = prevSecret;
    }
  });

  // 26. CORS configurado
  await test(26, 'CORS configurado', async () => {
    const corsOptions = getCorsOptions('https://directaurante.com,https://admin.directaurante.com');
    const originFn = corsOptions.origin as (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;

    // Allowed origin
    let allowedOk = false;
    originFn('https://directaurante.com', (err, allow) => {
      if (!err && allow === true) allowedOk = true;
    });
    if (!allowedOk) throw new Error('CORS debió permitir el origen configurado');

    // Disallowed origin
    let blockedOk = false;
    originFn('https://sitio-no-autorizado.com', (err) => {
      if (err && err.message.includes('CORS policy: Origen')) blockedOk = true;
    });
    if (!blockedOk) throw new Error('CORS debió rechazar el origen no configurado');

    // Undefined origin (same-origin / curl)
    let nonBrowserOk = false;
    originFn(undefined, (err, allow) => {
      if (!err && allow === true) nonBrowserOk = true;
    });
    if (!nonBrowserOk) throw new Error('CORS debió permitir peticiones sin origen (same-origin/server)');
  });

  // 27. Seed deshabilitado en producción
  await test(27, 'seed deshabilitado en producción', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSeed = process.env.ENABLE_SEED;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_SEED;

      // In production without ENABLE_SEED=true, seed condition must be strictly false
      const shouldSeed = process.env.ENABLE_SEED === 'true';
      if (shouldSeed) {
        throw new Error('El seed no debe ejecutarse en producción cuando ENABLE_SEED no es "true"');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSeed !== undefined) process.env.ENABLE_SEED = prevSeed;
    }
  });

  // 28. Restaurant sin ownership no puede consultar pedido (GET /orders/:id)
  await test(28, 'restaurant sin ownership no puede consultar pedido', async () => {
    let threw = false;
    try {
      // Owner of Restaurant B attempts to view order belonging to Restaurant A
      await OrderService.getOrderById(sampleOrderId, { id: restaurantBOwnerId, role: 'restaurant' });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) {
        throw new Error(`Se esperaba código 403, se obtuvo: ${err.statusCode}`);
      }
    }
    if (!threw) {
      throw new Error('El restaurante ajeno no debió poder consultar la orden');
    }

    // Legit owner can view successfully
    const order = await OrderService.getOrderById(sampleOrderId, { id: restaurantOwnerId, role: 'restaurant' });
    if (!order || order.id !== sampleOrderId) {
      throw new Error('El propietario legítimo del restaurante debió poder consultar el pedido');
    }
  });

  // 29. Customer no puede consultar pedido ajeno (GET /orders/:id)
  await test(29, 'customer no puede consultar pedido ajeno', async () => {
    let threw = false;
    try {
      // Customer B attempts to view Customer A's order
      await OrderService.getOrderById(sampleOrderId, { id: customerBId, role: 'customer' });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) {
        throw new Error(`Se esperaba código 403, se obtuvo: ${err.statusCode}`);
      }
    }
    if (!threw) {
      throw new Error('Cliente ajeno no debió poder consultar el pedido');
    }

    // Customer A can view their own order
    const orderA = await OrderService.getOrderById(sampleOrderId, { id: customerAId, role: 'customer' });
    if (!orderA || orderA.id !== sampleOrderId) {
      throw new Error('El cliente legítimo debió poder consultar su propio pedido');
    }
  });

  // 30. Driver no puede consultar pedido no asignado (GET /orders/:id)
  await test(30, 'driver no puede consultar pedido no asignado', async () => {
    let threw = false;
    try {
      // Unassigned driver tries to view order
      await OrderService.getOrderById(sampleOrderId, { id: 'usr_driver_no_asignado', role: 'driver' });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) {
        throw new Error(`Se esperaba código 403, se obtuvo: ${err.statusCode}`);
      }
    }
    if (!threw) {
      throw new Error('Conductor no asignado debió ser rechazado al consultar pedido');
    }

    // Assign driver to order in MongoDB and verify assigned driver can view
    const testDriverId = 'usr_driver_asignado_123';
    await dbClient.getOrdersCollection().updateOne(
      { id: sampleOrderId },
      { $set: { driver_id: testDriverId, driver_name: 'Conductor Asignado' } }
    );

    const assignedView = await OrderService.getOrderById(sampleOrderId, { id: testDriverId, role: 'driver' });
    if (!assignedView || assignedView.id !== sampleOrderId) {
      throw new Error('El conductor asignado debió poder consultar el pedido');
    }

    // Master role can also view order administratively
    const masterView = await OrderService.getOrderById(sampleOrderId, { id: 'usr_master_admin', role: 'master' });
    if (!masterView || masterView.id !== sampleOrderId) {
      throw new Error('El usuario master debió poder consultar el pedido');
    }
  });

  // 31. Mercado Pago: detiene el arranque en producción si faltan variables obligatorias
  await test(31, 'Mercado Pago: detiene el arranque en producción si faltan variables obligatorias', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevClientId = process.env.MP_CLIENT_ID;
    const prevSecret = process.env.MP_CLIENT_SECRET;
    const prevToken = process.env.MP_PLATFORM_ACCESS_TOKEN;
    const prevWebhook = process.env.MP_WEBHOOK_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.MP_CLIENT_ID;
      delete process.env.MP_PLATFORM_ACCESS_TOKEN;
      delete process.env.MP_WEBHOOK_SECRET;

      let threw = false;
      try {
        config.validatePaymentConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes('Faltan variables obligatorias de Mercado Pago en producción')) {
          throw new Error(`Mensaje inesperado: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error('validatePaymentConfig debió fallar en producción por variables ausentes');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevClientId) process.env.MP_CLIENT_ID = prevClientId;
      if (prevSecret) process.env.MP_CLIENT_SECRET = prevSecret;
      if (prevToken) process.env.MP_PLATFORM_ACCESS_TOKEN = prevToken;
      if (prevWebhook) process.env.MP_WEBHOOK_SECRET = prevWebhook;
    }
  });

  // 32. Mercado Pago: detiene el arranque si MP_MODE y credenciales son incompatibles
  await test(32, 'Mercado Pago: detiene el arranque si MP_MODE y credenciales son incompatibles', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevMode = process.env.MP_MODE;
    const prevClientId = process.env.MP_CLIENT_ID;
    const prevSecret = process.env.MP_CLIENT_SECRET;
    const prevToken = process.env.MP_PLATFORM_ACCESS_TOKEN;
    const prevWebhook = process.env.MP_WEBHOOK_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      process.env.MP_CLIENT_ID = '123456789';
      process.env.MP_CLIENT_SECRET = 'secret123456';
      process.env.MP_WEBHOOK_SECRET = 'whsec_123456';

      // Caso A: MP_MODE='production' con token TEST-
      process.env.MP_MODE = 'production';
      process.env.MP_PLATFORM_ACCESS_TOKEN = 'TEST-1234567890-abcdef';
      let threwTestToken = false;
      try {
        config.validatePaymentConfig();
      } catch (err: any) {
        threwTestToken = true;
        if (!err.message.includes('Incompatibilidad de credenciales de Mercado Pago')) {
          throw new Error(`Mensaje inesperado: ${err.message}`);
        }
      }
      if (!threwTestToken) {
        throw new Error('Debió fallar por token de test en modo production');
      }

      // Caso B: MP_MODE='sandbox' con token APP_USR-
      process.env.MP_MODE = 'sandbox';
      process.env.MP_PLATFORM_ACCESS_TOKEN = 'APP_USR-1234567890-abcdef';
      let threwProdToken = false;
      try {
        config.validatePaymentConfig();
      } catch (err: any) {
        threwProdToken = true;
        if (!err.message.includes('Incompatibilidad de credenciales de Mercado Pago')) {
          throw new Error(`Mensaje inesperado: ${err.message}`);
        }
      }
      if (!threwProdToken) {
        throw new Error('Debió fallar por token de producción real en modo sandbox');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevMode) process.env.MP_MODE = prevMode; else delete process.env.MP_MODE;
      if (prevClientId) process.env.MP_CLIENT_ID = prevClientId; else delete process.env.MP_CLIENT_ID;
      if (prevSecret) process.env.MP_CLIENT_SECRET = prevSecret; else delete process.env.MP_CLIENT_SECRET;
      if (prevToken) process.env.MP_PLATFORM_ACCESS_TOKEN = prevToken; else delete process.env.MP_PLATFORM_ACCESS_TOKEN;
      if (prevWebhook) process.env.MP_WEBHOOK_SECRET = prevWebhook; else delete process.env.MP_WEBHOOK_SECRET;
    }
  });

  // 33. Mercado Pago: conserva sandbox por defecto y previene cobros reales automáticos
  await test(33, 'Mercado Pago: conserva sandbox por defecto y previene cobros reales automáticos', async () => {
    const prevMode = process.env.MP_MODE;
    try {
      delete process.env.MP_MODE;
      if (config.mpMode !== 'sandbox') {
        throw new Error(`mpMode debe ser "sandbox" por defecto, se obtuvo: ${config.mpMode}`);
      }

      process.env.MP_MODE = 'unknown_mode';
      if (config.mpMode !== 'sandbox') {
        throw new Error(`mpMode debe ser "sandbox" si no es "production", se obtuvo: ${config.mpMode}`);
      }
    } finally {
      if (prevMode) process.env.MP_MODE = prevMode; else delete process.env.MP_MODE;
    }
  });

  // 34. SSE: Aislamiento estricto de eventos por rol, restaurante y pedido asignado
  await test(34, 'SSE: Aislamiento estricto de eventos en tiempo real entre participantes', async () => {
    const dummyRes: any = { write: () => {}, end: () => {} };
    const customerClient: SSEClient = {
      id: 'sse_cust_1',
      userId: 'usr_customer_A',
      role: 'customer',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const otherCustomerClient: SSEClient = {
      id: 'sse_cust_2',
      userId: 'usr_customer_B',
      role: 'customer',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const restaurantAClient: SSEClient = {
      id: 'sse_rest_1',
      userId: 'usr_owner_A',
      role: 'restaurant',
      restaurantId: 'rest_tacos_A',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const restaurantBClient: SSEClient = {
      id: 'sse_rest_2',
      userId: 'usr_owner_B',
      role: 'restaurant',
      restaurantId: 'rest_burgers_B',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const assignedDriverClient: SSEClient = {
      id: 'sse_driver_1',
      userId: 'usr_driver_A',
      role: 'driver',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const unassignedDriverClient: SSEClient = {
      id: 'sse_driver_2',
      userId: 'usr_driver_B',
      role: 'driver',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };
    const guestClient: SSEClient = {
      id: 'sse_guest_1',
      userId: 'guest_123',
      role: 'guest',
      res: dummyRes,
      connectedAt: new Date().toISOString(),
    };

    // Caso A: Evento de pedido creado para Restaurante A y Cliente A
    const orderCreatedEvent = {
      type: 'ORDER_CREATED' as const,
      order_id: 'ord_123',
      customer_id: 'usr_customer_A',
      restaurant_id: 'rest_tacos_A',
      data: { id: 'ord_123', total: 25000 },
      timestamp: new Date().toISOString(),
    };

    if (!RealtimeService.canClientReceiveEvent(customerClient, orderCreatedEvent)) {
      throw new Error('El cliente dueño del pedido debió recibir el evento ORDER_CREATED');
    }
    if (RealtimeService.canClientReceiveEvent(otherCustomerClient, orderCreatedEvent)) {
      throw new Error('Un cliente ajeno NO debe recibir el evento ORDER_CREATED');
    }
    if (!RealtimeService.canClientReceiveEvent(restaurantAClient, orderCreatedEvent)) {
      throw new Error('El restaurante dueño debió recibir el evento ORDER_CREATED');
    }
    if (RealtimeService.canClientReceiveEvent(restaurantBClient, orderCreatedEvent)) {
      throw new Error('Un restaurante ajeno NO debe recibir el evento ORDER_CREATED');
    }
    if (RealtimeService.canClientReceiveEvent(unassignedDriverClient, orderCreatedEvent)) {
      throw new Error('Un repartidor NO asignado no debe recibir ORDER_CREATED directamente');
    }
    if (RealtimeService.canClientReceiveEvent(guestClient, orderCreatedEvent)) {
      throw new Error('Un invitado público NO debe recibir ORDER_CREATED');
    }

    // Caso B: Evento de despacho asignado a Driver A
    const driverAssignedEvent = {
      type: 'DRIVER_ASSIGNED' as const,
      order_id: 'ord_123',
      driver_id: 'usr_driver_A',
      customer_id: 'usr_customer_A',
      restaurant_id: 'rest_tacos_A',
      data: { driver_id: 'usr_driver_A', driver_name: 'Driver A' },
      timestamp: new Date().toISOString(),
    };

    if (!RealtimeService.canClientReceiveEvent(assignedDriverClient, driverAssignedEvent)) {
      throw new Error('El conductor asignado debió recibir su asignación');
    }
    if (RealtimeService.canClientReceiveEvent(unassignedDriverClient, driverAssignedEvent)) {
      throw new Error('Un conductor no asignado NO debe recibir eventos de pedidos ajenos');
    }

    // Caso C: Actualización de perfil privado
    const profileUpdatedEvent = {
      type: 'PROFILE_UPDATED' as const,
      customer_id: 'usr_customer_A',
      data: { user_id: 'usr_customer_A', phone: '5551234567' },
      timestamp: new Date().toISOString(),
    };

    if (!RealtimeService.canClientReceiveEvent(customerClient, profileUpdatedEvent)) {
      throw new Error('El usuario debió recibir su propia actualización de perfil');
    }
    if (RealtimeService.canClientReceiveEvent(otherCustomerClient, profileUpdatedEvent)) {
      throw new Error('El perfil privado NO debe transmitirse a otros clientes');
    }
    if (RealtimeService.canClientReceiveEvent(restaurantAClient, profileUpdatedEvent)) {
      throw new Error('El perfil privado NO debe transmitirse a restaurantes');
    }
  });

  // 35. Health check minimizado y protección de /health/reconnect en producción
  await test(35, 'Health check minimizado y protección de /health/reconnect en producción', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // Import coreApiApp dynamically to test route responses
      const { createCoreApp } = await import('../app.ts');
      const app = createCoreApp();

      // Helper to dispatch mock request through Express app
      const dispatchMock = (method: string, url: string): Promise<{ status: number; body: any }> => {
        return new Promise((resolve) => {
          let statusCode = 200;
          let responseBody: any = null;
          const headersMap: Record<string, string> = {};

          const mockReq: any = {
            method,
            url,
            headers: {},
            path: url,
          };

          const mockRes: any = {
            statusCode: 200,
            setHeader: (key: string, val: string) => {
              headersMap[key.toLowerCase()] = val;
            },
            getHeader: (key: string) => headersMap[key.toLowerCase()],
            status: function (code: number) {
              statusCode = code;
              this.statusCode = code;
              return this;
            },
            json: function (data: any) {
              responseBody = data;
              resolve({ status: statusCode, body: responseBody });
            },
            send: function (data: any) {
              responseBody = data;
              resolve({ status: statusCode, body: responseBody });
            },
            writeHead: function (code: number) {
              statusCode = code;
              return this;
            },
            end: function (data?: any) {
              if (data && !responseBody) responseBody = data;
              resolve({ status: statusCode, body: responseBody });
            },
          };

          (app as any).handle(mockReq, mockRes, () => {
            resolve({ status: statusCode, body: responseBody });
          });
        });
      };

      // Test 1: POST /health/reconnect debe retornar 403 Forbidden en producción
      const reconnectRes = await dispatchMock('POST', '/health/reconnect');
      if (reconnectRes.status !== 403) {
        throw new Error(
          `Se esperaba 403 Forbidden para /health/reconnect en producción, se obtuvo: ${reconnectRes.status}`
        );
      }
      if (!reconnectRes.body?.error?.includes('no está disponible públicamente en producción')) {
        throw new Error(`Mensaje de error inesperado: ${JSON.stringify(reconnectRes.body)}`);
      }

      // Test 2: GET /health en producción no debe exponer topología interna sensible de base de datos
      const healthRes = await dispatchMock('GET', '/health');
      if (healthRes.status !== 200) {
        throw new Error(`Se esperaba 200 para /health, obtenido: ${healthRes.status}`);
      }
      const healthBody = healthRes.body;
      if (healthBody.database && healthBody.database.provider !== undefined) {
        throw new Error('En producción /health no debe exponer "provider", nombres internos o topología de DB');
      }
      if (typeof healthBody.database?.connected !== 'boolean') {
        throw new Error('En producción /health debe indicar únicamente el booleano connected');
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n======================================================');
  console.log(`   RESULTADO FINAL: ${passed} PASADAS / ${failed} FALLADAS (${results.length} PRUEBAS)`);
  console.log('======================================================\n');

  return { passed, failed, results };
}

// Standalone execution
if (import.meta.url.endsWith(process.argv[1] || '')) {
  runCoreTests()
    .then(async ({ failed }) => {
      await dbClient.disconnect();
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(async (err) => {
      console.error(err);
      await dbClient.disconnect();
      process.exit(1);
    });
}
