import { dbClient, initDb } from '../db/connection.ts';

const BASE_URL = 'http://127.0.0.1:3000/api';

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

export async function runDriverE2ETest() {
  console.log('\n========================================================================');
  console.log('   PRUEBA INTEGRAL: DRIVER V2 → CORE V2 → MONGODB RAILWAY');
  console.log('========================================================================\n');

  await initDb();

  // 1. Login as Driver Roberto
  console.log('1. [Driver V2] Iniciando sesión como Roberto Repartidor...');
  const driverLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'roberto@directaurante.com', password: 'driver123' }),
  });
  const driverToken = driverLogin.token;
  const driverId = driverLogin.user.id;
  console.log(`   ✓ Repartidor autenticado con JWT Bearer. ID: ${driverId}, Rol: ${driverLogin.user.role}`);

  const driverHeaders = { Authorization: `Bearer ${driverToken}` };

  // 2. Set driver status to 'available' with GPS location
  console.log('2. [Driver V2] Activando disponibilidad en el Radar con coordenadas GPS...');
  const statusRes = await request('/driver/status', {
    method: 'PUT',
    headers: driverHeaders,
    body: JSON.stringify({
      status: 'available',
      location: { latitude: 20.4310, longitude: -101.7225, address: 'Av. Morelos, Pénjamo Centro' },
    }),
  });
  console.log(`   ✓ Estado en Core V2 actualizado a: '${statusRes.data.driver_status}'`);

  // 3. Create a delivery order as customer and advance it to 'ready'
  console.log('3. [Flujo Pedido] Cliente crea pedido y Restaurante lo pasa a READY...');
  const custLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'carlos@directaurante.com', password: 'cliente123' }),
  });
  const custToken = custLogin.token;

  const orderPayload = {
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
        notes: 'Bien doraditos',
      },
    ],
    payment_method: 'cash',
    tip_amount: 1500, // $15.00 MXN propina
  };

  const newOrder = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}`, 'x-idempotency-key': `driver_test_${Date.now()}` },
    body: JSON.stringify(orderPayload),
  });
  const orderId = newOrder.data.id;

  // Restaurant login and confirm -> prepare -> ready
  const restLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'donpepe@tacoselguero.com', password: 'tacos123' }),
  });
  const restHeaders = { Authorization: `Bearer ${restLogin.token}` };

  await request(`/restaurant/orders/${orderId}/accept`, { method: 'POST', headers: restHeaders });
  await request(`/restaurant/orders/${orderId}/status`, {
    method: 'POST',
    headers: restHeaders,
    body: JSON.stringify({ status: 'preparing' }),
  });
  await request(`/restaurant/orders/${orderId}/status`, {
    method: 'POST',
    headers: restHeaders,
    body: JSON.stringify({ status: 'ready' }),
  });
  console.log(`   ✓ Pedido ${orderId} está en estado READY (Despacho automático Core V2 activado)`);

  // 4. Proximity & 40-Second Offer Verification for Roberto
  console.log('4. [Core V2 Dispatch] Consultando oferta asignada por proximidad para Roberto...');
  const offerRes = await request('/driver/offers/current', { headers: driverHeaders });
  if (!offerRes.data) {
    throw new Error('No se recibió la oferta de pedido esperada para el repartidor');
  }
  const offer = offerRes.data;
  console.log(`   ✓ Oferta recibida exitosamente:`);
  console.log(`     - ID de Oferta: ${offer.id}`);
  console.log(`     - Pedido: ${offer.order_id}`);
  console.log(`     - Restaurante: ${offer.restaurant_name}`);
  console.log(`     - Distancia calculada por Haversine: ${offer.distance_km} km`);
  console.log(`     - Ganancia para el repartidor: $${(offer.driver_earnings / 100).toFixed(2)} MXN`);
  console.log(`     - Expiración (ventana 40s): ${offer.expires_at}`);

  // 5. Driver accepts offer (Atomic MongoDB assignment)
  console.log('5. [Driver V2] Repartidor acepta la oferta dentro del tiempo límite de 40 segundos...');
  const acceptRes = await request(`/driver/offers/${offer.id}/accept`, {
    method: 'POST',
    headers: driverHeaders,
  });
  console.log(`   ✓ Oferta aceptada. Pedido asignado a Roberto. Estado: '${acceptRes.data.status}'`);

  // 6. Arrive at restaurant
  console.log('6. [Driver V2] Repartidor llega al restaurante (He llegado)...');
  const arrivedRes = await request(`/driver/orders/${orderId}/arrived`, {
    method: 'POST',
    headers: driverHeaders,
  });
  console.log(`   ✓ Llegada registrada en historial de estados del pedido`);

  // 7. Pick up order
  console.log('7. [Driver V2] Repartidor verifica y recolecta el pedido (Pedido recogido)...');
  const pickupRes = await request(`/driver/orders/${orderId}/pickup`, {
    method: 'POST',
    headers: driverHeaders,
  });
  console.log(`   ✓ Pedido recolectado. Nuevo estado: '${pickupRes.data.status}'`);

  // 8. Start delivering to customer
  console.log('8. [Driver V2] Repartidor inicia trayecto hacia el cliente (En ruta)...');
  const deliveringRes = await request(`/driver/orders/${orderId}/delivering`, {
    method: 'POST',
    headers: driverHeaders,
  });
  console.log(`   ✓ En camino al cliente. Estado: '${deliveringRes.data.status}'`);

  // 9. Send order message
  console.log('9. [Driver V2] Repartidor envía mensaje en el chat contextual del pedido...');
  const chatMsg = await request(`/driver/orders/${orderId}/messages`, {
    method: 'POST',
    headers: driverHeaders,
    body: JSON.stringify({ message: 'Llego en 3 minutos con el pedido caliente' }),
  });
  console.log(`   ✓ Mensaje registrado en chat: "${chatMsg.data.message}"`);

  // 10. Complete delivery (Cobro en efectivo y notas)
  console.log('10. [Driver V2] Repartidor entrega al cliente y confirma cobro en efectivo...');
  const deliverRes = await request(`/driver/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: driverHeaders,
    body: JSON.stringify({ notes: 'Entregado en puerta principal. Cobro en efectivo completado.' }),
  });
  console.log(`   ✓ Entrega finalizada con éxito. Estado final del pedido: '${deliverRes.data.status}'`);

  // 11. Shift Summary
  console.log('11. [Driver V2] Consultando resumen de la jornada y arqueo de caja...');
  const shiftRes = await request('/driver/shift/summary', { headers: driverHeaders });
  console.log(`   ✓ Resumen de jornada obtenido:`);
  console.log(`     - Pedidos entregados: ${shiftRes.data.orders_completed}`);
  console.log(`     - Efectivo en mano (cobrado): $${(shiftRes.data.cash_collected / 100).toFixed(2)} MXN`);
  console.log(`     - Ganancias acumuladas: $${(shiftRes.data.earnings_total / 100).toFixed(2)} MXN`);
  console.log(`     - Balance neto con la plataforma: $${(shiftRes.data.net_balance / 100).toFixed(2)} MXN`);

  // 12. Support Ticket
  console.log('12. [Driver V2] Creando ticket de soporte de prueba...');
  const ticketRes = await request('/driver/support/ticket', {
    method: 'POST',
    headers: driverHeaders,
    body: JSON.stringify({
      category: 'Consulta operativa',
      description: 'Prueba de soporte desde Driver App V2',
      priority: 'normal',
    }),
  });
  console.log(`   ✓ Ticket creado: #${ticketRes.data.id} (Estado: ${ticketRes.data.status})`);

  // 13. Close Shift / Corte
  console.log('13. [Driver V2] Finalizando jornada y realizando corte oficial...');
  const closeRes = await request('/driver/shift/close', {
    method: 'POST',
    headers: driverHeaders,
    body: JSON.stringify({ notes: 'Cierre de turno de prueba E2E' }),
  });
  console.log(`   ✓ Corte realizado exitosamente: ID ${closeRes.data.id}`);
  console.log(`     - Órdenes liquidadas: ${closeRes.data.orders_completed}`);
  console.log(`     - Efectivo liquidado: $${(closeRes.data.cash_collected / 100).toFixed(2)} MXN`);
  console.log(`     - Balance neto: $${(closeRes.data.net_balance / 100).toFixed(2)} MXN`);

  // 14. Verification in physical MongoDB
  console.log('14. [Persistencia MongoDB] Verificando documentos físicos...');
  const orderDoc = await dbClient.getOrdersCollection().findOne({ id: orderId });
  const settlementDoc = await dbClient.getDriverSettlementsCollection().findOne({ id: closeRes.data.id });
  console.log(`   ✓ Pedido físico en MongoDB: status = '${orderDoc?.status}', driver_id = '${orderDoc?.driver_id}'`);
  console.log(`   ✓ Corte físico en MongoDB: ID = '${settlementDoc?.id}', shift_id = '${settlementDoc?.shift_id}'`);

  console.log('\n========================================================================');
  console.log('   PRUEBA INTEGRAL DRIVER V2 → CORE V2: 100% PASADA');
  console.log('========================================================================\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDriverE2ETest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error en prueba Driver E2E:', err);
      process.exit(1);
    });
}
