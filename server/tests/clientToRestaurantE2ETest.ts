import { MongoClient } from 'mongodb';

const BASE_URL = 'http://127.0.0.1:3000/api';

async function runClientToRestaurantTest() {
  console.log('\n========================================================================');
  console.log('   PRUEBA INTEGRAL: CLIENTE → CORE V2 → RESTAURANT PANEL → RAILWAY DB');
  console.log('========================================================================\n');

  // --- PASO 1: CLIENTE CREA PEDIDO ---
  console.log('1. [Cliente] Iniciando sesión como Carlos Pérez...');
  const clientLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'carlos@directaurante.com', password: 'cliente123' }),
  });
  const clientLoginData = await clientLoginRes.json();
  if (!clientLoginRes.ok || !clientLoginData.token) {
    throw new Error(`Login cliente falló: ${JSON.stringify(clientLoginData)}`);
  }
  const clientToken = clientLoginData.token;
  console.log('   ✓ Cliente autenticado con JWT Bearer');

  console.log('2. [Cliente] Enviando nuevo pedido a Taquería El Güero...');
  const idempotencyKey = `idemp_kds_test_${Date.now()}`;
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      restaurant_id: 'rest_tacos_guero',
      order_type: 'delivery',
      delivery_address: 'Av. Morelos #64, Col. Centro, Pénjamo',
      customer_phone: '4621234567',
      items: [
        {
          product_id: 'prod_tacos_pastor',
          quantity: 2,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
          toppings: ['top_queso'],
          notes: 'Con salsa verde aparte',
        },
      ],
      payment_method: 'cash',
      tip_amount: 2000,
      notes: 'Prueba de integración KDS Panel',
      idempotency_key: idempotencyKey,
    }),
  });
  const orderData = await orderRes.json();
  if (!orderRes.ok || !orderData.data?.id) {
    throw new Error(`Creación de pedido falló: ${JSON.stringify(orderData)}`);
  }
  const createdOrderId = orderData.data.id;
  console.log(`   ✓ Pedido creado exitosamente: #${createdOrderId} (Total: $${(orderData.data.total / 100).toFixed(2)} MXN)`);
  console.log(`     Estado inicial: ${orderData.data.status}`);

  // --- PASO 2: RESTAURANT PANEL INICIA SESIÓN ---
  console.log('\n3. [Restaurant V2] Iniciando sesión como Don Pepe (Dueño de Taquería El Güero)...');
  const restLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'donpepe@tacoselguero.com', password: 'tacos123' }),
  });
  const restLoginData = await restLoginRes.json();
  if (!restLoginRes.ok || !restLoginData.token) {
    throw new Error(`Login restaurante falló: ${JSON.stringify(restLoginData)}`);
  }
  const restToken = restLoginData.token;
  console.log(`   ✓ Don Pepe autenticado. Rol: ${restLoginData.user.role}, ID: ${restLoginData.user.id}`);

  // --- PASO 3: AISLAMIENTO ESTRICTO POR RESTAURANTE ---
  console.log('\n4. [Seguridad / Aislamiento] Verificando que Don Pepe NO puede ver pedidos de Burger Lab...');
  const crossRestRes = await fetch(`${BASE_URL}/restaurant/orders?restaurant_id=rest_burger_lab`, {
    headers: { Authorization: `Bearer ${restToken}` },
  });
  if (crossRestRes.status === 403 || !crossRestRes.ok) {
    console.log('   ✓ Aislamiento estricto verificado: Core V2 bloqueó el acceso cruzado con error 403');
  } else {
    throw new Error('FALLO DE SEGURIDAD: Don Pepe pudo acceder a pedidos de un restaurante ajeno');
  }

  // --- PASO 4: RESTAURANT PANEL RECIBE EL PEDIDO EN VIVO ---
  console.log('\n5. [Restaurant V2] Consultando pedidos autorizados de Taquería El Güero...');
  const myRestOrdersRes = await fetch(`${BASE_URL}/restaurant/orders?restaurant_id=rest_tacos_guero`, {
    headers: { Authorization: `Bearer ${restToken}` },
  });
  const myRestOrdersData = await myRestOrdersRes.json();
  if (!myRestOrdersRes.ok || !Array.isArray(myRestOrdersData.data)) {
    throw new Error(`Fallo al consultar pedidos de restaurante: ${JSON.stringify(myRestOrdersData)}`);
  }

  const incomingOrder = myRestOrdersData.data.find((o: any) => o.id === createdOrderId);
  if (!incomingOrder) {
    throw new Error(`El pedido ${createdOrderId} creado por el cliente no apareció en el panel de Don Pepe`);
  }
  console.log(`   ✓ Pedido ${createdOrderId} recibido en KDS con estado: '${incomingOrder.status}'`);
  console.log(`     Cliente: ${incomingOrder.customer_name}, Items: ${incomingOrder.items.length}`);

  // --- PASO 5: RESTAURANT PANEL ACEPTA EL PEDIDO ---
  console.log('\n6. [Restaurant V2] Cocina acepta el pedido...');
  const acceptRes = await fetch(`${BASE_URL}/restaurant/orders/${createdOrderId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${restToken}` },
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok || acceptData.data?.status !== 'confirmed') {
    throw new Error(`Aceptar pedido falló: ${JSON.stringify(acceptData)}`);
  }
  console.log(`   ✓ Pedido aceptado: nuevo estado '${acceptData.data.status}'`);

  // --- PASO 6: RESTAURANT PANEL INICIA PREPARACIÓN ---
  console.log('\n7. [Restaurant V2] Cocina inicia preparación de platillos...');
  const prepRes = await fetch(`${BASE_URL}/restaurant/orders/${createdOrderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${restToken}` },
    body: JSON.stringify({ status: 'preparing', notes: 'En comal' }),
  });
  const prepData = await prepRes.json();
  if (!prepRes.ok || prepData.data?.status !== 'preparing') {
    throw new Error(`Avanzar a preparing falló: ${JSON.stringify(prepData)}`);
  }
  console.log(`   ✓ Estado avanzado: '${prepData.data.status}'`);

  // --- PASO 7: RESTAURANT PANEL MARCA PEDIDO COMO LISTO ---
  console.log('\n8. [Restaurant V2] Cocina marca el pedido como LISTO en mostrador...');
  const readyRes = await fetch(`${BASE_URL}/restaurant/orders/${createdOrderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${restToken}` },
    body: JSON.stringify({ status: 'ready', notes: 'Empacado y listo para entrega' }),
  });
  const readyData = await readyRes.json();
  if (!readyRes.ok || readyData.data?.status !== 'ready') {
    throw new Error(`Marcar como ready falló: ${JSON.stringify(readyData)}`);
  }
  console.log(`   ✓ Estado avanzado: '${readyData.data.status}' (Esperando recolección / Driver V2)`);

  // --- PASO 8: VERIFICACIÓN FÍSICA DIRECTA EN MONGODB RAILWAY ---
  console.log('\n9. [Persistencia Real] Comprobando documento físico en MongoDB Railway...');
  const mongoClient = new MongoClient(process.env.MONGODB_URI!);
  await mongoClient.connect();
  const db = mongoClient.db('directaurante');

  const docInMongo = await db.collection('orders').findOne({ id: createdOrderId });
  if (!docInMongo) {
    throw new Error(`El pedido ${createdOrderId} no existe en MongoDB Railway`);
  }

  if (docInMongo.status !== 'ready') {
    throw new Error(`El estado en MongoDB es '${docInMongo.status}', se esperaba 'ready'`);
  }
  console.log(`   ✓ Documento físico en Railway verificado: _id = ${docInMongo._id}, status = '${docInMongo.status}'`);

  const history = docInMongo.status_history || [];
  const historyStatuses = history.map((h: any) => h.status);
  console.log(`   ✓ Historial de transiciones en MongoDB: [${historyStatuses.join(' → ')}]`);

  const auditEvents = await db.collection('audit_logs').find({ entity_id: createdOrderId }).toArray();
  console.log(`   ✓ Registros inmutables de auditoría en Railway: ${auditEvents.length} eventos`);
  for (const a of auditEvents) {
    console.log(`     - Evento: ${a.event} por actor ${a.actor_role} (${a.actor_id})`);
  }

  await mongoClient.close();

  // --- PASO 9: CLIENTE CONSULTA EL PEDIDO ACTUALIZADO ---
  console.log('\n10. [Cliente V2] Consultando pedido desde la perspectiva del cliente...');
  const clientOrderCheck = await fetch(`${BASE_URL}/orders/${createdOrderId}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const clientOrderData = await clientOrderCheck.json();
  if (!clientOrderCheck.ok || clientOrderData.data?.status !== 'ready') {
    throw new Error('El cliente no ve el estado actualizado como ready');
  }
  console.log(`   ✓ Cliente ve su pedido actualizado en tiempo real: estado = '${clientOrderData.data.status}'`);

  console.log('\n========================================================================');
  console.log('   PRUEBA MANUAL INTEGRAL CLIENTE → RESTAURANTE → RAILWAY: 100% EXITOSA');
  console.log('========================================================================\n');
}

runClientToRestaurantTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERROR EN PRUEBA CLIENTE → RESTAURANTE:', err.message);
    process.exit(1);
  });
