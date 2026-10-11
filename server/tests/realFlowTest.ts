import { dbClient, initDb } from '../db/connection.ts';

const BASE_URL = 'http://127.0.0.1:3000/api';

interface FlowStepResult {
  step: string;
  success: boolean;
  details?: any;
  error?: string;
}

export async function runRealFlowTest(): Promise<FlowStepResult[]> {
  const steps: FlowStepResult[] = [];

  function record(step: string, success: boolean, details?: any, error?: string) {
    steps.push({ step, success, details, error });
    if (success) {
      console.log(`✅ [PASS] ${step}`);
    } else {
      console.error(`❌ [FAIL] ${step}:`, error);
    }
  }

  console.log('\n======================================================');
  console.log('   DIRECTAURANTE CORE V2 — TEST DE FLUJO REAL E2E');
  console.log('   Login → Restaurante → Catálogo → Carrito → Checkout → Crear Pedido → MongoDB → Consultar');
  console.log('======================================================\n');

  await initDb();

  let token = '';
  let userId = '';
  let restaurantId = '';
  let productId = '';
  let productPrice = 0;
  let orderId = '';
  const idempotencyKey = `idemp_flow_test_${Date.now()}`;

  try {
    // 1. LOGIN
    console.log('[1/7] Ejecutando Login de cliente...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carlos@directaurante.com',
        password: 'cliente123',
      }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      throw new Error(`Fallo en login (${loginRes.status}): ${JSON.stringify(loginData)}`);
    }

    token = loginData.token;
    userId = loginData.user.id;
    record('1. Login', true, { email: loginData.user.email, role: loginData.user.role });

    // 2. RESTAURANTE
    console.log('[2/7] Consultando restaurantes disponibles...');
    const restRes = await fetch(`${BASE_URL}/restaurants`);
    const restData = await restRes.json();
    if (!restRes.ok || !restData.data || restData.data.length === 0) {
      throw new Error(`Fallo al consultar restaurantes (${restRes.status}): ${JSON.stringify(restData)}`);
    }

    const firstRestaurant = restData.data[0];
    restaurantId = firstRestaurant.id;

    // Consultar detalle de restaurante específico
    const restDetailRes = await fetch(`${BASE_URL}/restaurants/${restaurantId}`);
    const restDetailData = await restDetailRes.json();
    if (!restDetailRes.ok || !restDetailData.data) {
      throw new Error(`Fallo al consultar detalle de restaurante (${restDetailRes.status})`);
    }
    record('2. Restaurante', true, {
      id: restaurantId,
      name: firstRestaurant.name,
      delivery_fee: firstRestaurant.delivery_fee,
    });

    // 3. CATÁLOGO
    console.log('[3/7] Consultando catálogo de productos del restaurante...');
    const prodRes = await fetch(`${BASE_URL}/restaurants/${restaurantId}/products`);
    const prodData = await prodRes.json();
    if (!prodRes.ok || !prodData.data || prodData.data.length === 0) {
      throw new Error(`Fallo al consultar catálogo (${prodRes.status}): ${JSON.stringify(prodData)}`);
    }

    const targetProduct = prodData.data[0];
    productId = targetProduct.id;
    productPrice = targetProduct.price;
    record('3. Catálogo', true, {
      product: targetProduct.name,
      id: productId,
      price: productPrice,
      hasVariants: (targetProduct.variants || []).length > 0,
      hasToppings: (targetProduct.toppings || []).length > 0,
    });

    // 4. CARRITO
    console.log('[4/7] Configurando producto para el carrito...');
    // Si tiene variantes y toppings, seleccionamos válidos
    const selectedVariants: any[] = [];
    let extraVariantsPrice = 0;
    if (targetProduct.variants && targetProduct.variants.length > 0) {
      for (const group of targetProduct.variants) {
        if (group.options && group.options.length > 0) {
          const opt = group.options[0];
          selectedVariants.push({ group_id: group.id, option_id: opt.id });
          extraVariantsPrice += opt.price || 0;
        }
      }
    }

    const selectedToppings: string[] = [];
    let extraToppingsPrice = 0;
    if (targetProduct.toppings && targetProduct.toppings.length > 0) {
      const top = targetProduct.toppings[0];
      selectedToppings.push(top.id);
      extraToppingsPrice += top.price || 0;
    }

    const itemQuantity = 2;
    record('4. Carrito', true, {
      quantity: itemQuantity,
      selectedVariants,
      selectedToppings,
      estimatedItemTotal: (productPrice + extraVariantsPrice + extraToppingsPrice) * itemQuantity,
    });

    // 5. CHECKOUT Y CREAR PEDIDO
    console.log('[5/7] Ejecutando Checkout y Creación de Pedido con idempotencia...');
    const orderPayload = {
      restaurant_id: restaurantId,
      order_type: 'delivery',
      delivery_address: 'Av. Hidalgo #120, Col. Centro, Pénjamo',
      customer_phone: '4621234567',
      items: [
        {
          product_id: productId,
          quantity: itemQuantity,
          variants: selectedVariants,
          toppings: selectedToppings,
          notes: 'Sin cebolla, por favor',
        },
      ],
      payment_method: 'cash',
      tip_amount: 1500,
      notes: 'Entregar en portería',
      idempotency_key: idempotencyKey,
    };

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.data || !orderData.data.id) {
      throw new Error(`Fallo al crear pedido (${orderRes.status}): ${JSON.stringify(orderData)}`);
    }

    orderId = orderData.data.id;
    record('5. Checkout y Crear Pedido', true, {
      orderId,
      status: orderData.data.status,
      subtotal: orderData.data.subtotal,
      delivery_fee: orderData.data.delivery_fee,
      service_fee: orderData.data.service_fee,
      tip_amount: orderData.data.tip_amount,
      total: orderData.data.total,
    });

    // 6. PERSISTIR EN MONGODB REMOTO
    console.log('[6/7] Verificando persistencia física, auditoría e índices únicos en MongoDB remoto...');
    const db = dbClient.getDb();

    // 6.1 Pedido físicamente en orders
    const orderDoc = await db.collection('orders').findOne({ id: orderId });
    if (!orderDoc) {
      throw new Error(`El pedido ${orderId} NO se encuentra físicamente en la colección 'orders' de MongoDB`);
    }

    // 6.2 Audit log correspondiente
    const auditDoc = await db.collection('audit_logs').findOne({ entity_id: orderId, event: 'order.created' });
    if (!auditDoc) {
      throw new Error(`No se encontró el registro de auditoría 'order.created' para el pedido ${orderId}`);
    }

    // 6.3 Índices únicos creados
    const ordersIndexes = await db.collection('orders').indexes();
    const hasOrderUniqueIndex = ordersIndexes.some(
      (idx: any) => idx.name === 'idx_orders_customer_idempotency_unique' || (idx.unique && idx.key.idempotency_key)
    );
    if (!hasOrderUniqueIndex) {
      throw new Error('El índice único de idempotencia en orders no está presente en la base de datos remota');
    }

    const usersIndexes = await db.collection('users').indexes();
    const hasUserEmailIndex = usersIndexes.some(
      (idx: any) => idx.name === 'idx_users_email_unique' || (idx.unique && idx.key.email)
    );
    if (!hasUserEmailIndex) {
      throw new Error('El índice único de email en users no está presente en la base de datos remota');
    }

    record('6. Persistir en MongoDB Remoto', true, {
      remoteDbName: db.databaseName,
      mongoOrderId: orderDoc._id,
      persistedStatus: orderDoc.status,
      persistedTotal: orderDoc.total,
      auditEventFound: auditDoc.event,
      uniqueOrderIndex: 'idx_orders_customer_idempotency_unique',
      uniqueUserIndex: 'idx_users_email_unique',
    });

    // 7. CONSULTAR PEDIDO
    console.log('[7/7] Consultando pedido mediante endpoints HTTP del Core V2...');
    // A) GET /orders/:id
    const getOrderRes = await fetch(`${BASE_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getOrderData = await getOrderRes.json();
    if (!getOrderRes.ok || !getOrderData.data || getOrderData.data.id !== orderId) {
      throw new Error(`Fallo al consultar pedido por ID (${getOrderRes.status}): ${JSON.stringify(getOrderData)}`);
    }

    // B) GET /orders (listado del cliente)
    const listOrdersRes = await fetch(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listOrdersData = await listOrdersRes.json();
    if (!listOrdersRes.ok || !Array.isArray(listOrdersData.data)) {
      throw new Error(`Fallo al consultar lista de pedidos (${listOrdersRes.status})`);
    }

    const foundInList = listOrdersData.data.some((o: any) => o.id === orderId);
    if (!foundInList) {
      throw new Error(`El pedido ${orderId} no apareció en el listado del cliente`);
    }

    record('7. Consultar Pedido', true, {
      singleOrderOk: true,
      foundInCustomerList: true,
      itemsCount: getOrderData.data.items.length,
      status: getOrderData.data.status,
    });

    console.log('\n======================================================');
    console.log('   FLUJO COMPLETO VERIFICADO CON ÉXITO');
    console.log('======================================================\n');
  } catch (err: any) {
    record('Error en flujo', false, undefined, err.message);
  }

  return steps;
}

// Standalone execution
if (import.meta.url.endsWith(process.argv[1] || '')) {
  runRealFlowTest()
    .then((results) => {
      const failed = results.filter((r) => !r.success).length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
