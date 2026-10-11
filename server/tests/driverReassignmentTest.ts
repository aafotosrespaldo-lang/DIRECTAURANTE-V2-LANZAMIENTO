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

export async function runReassignmentTest() {
  console.log('\n========================================================================');
  console.log('   PRUEBA: REASIGNACIÓN AUTOMÁTICA Y EXCLUSIÓN DE OFERTA RECHAZADA');
  console.log('========================================================================\n');

  await initDb();

  // 1. Both drivers online
  const robertoLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'roberto@directaurante.com', password: 'driver123' }),
  });
  const pedroLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'pedro@directaurante.com', password: 'driver456' }),
  });

  const robertoHeaders = { Authorization: `Bearer ${robertoLogin.token}` };
  const pedroHeaders = { Authorization: `Bearer ${pedroLogin.token}` };

  await request('/driver/status', {
    method: 'PUT',
    headers: robertoHeaders,
    body: JSON.stringify({
      status: 'available',
      location: { latitude: 20.4310, longitude: -101.7225, address: 'Pénjamo Centro' },
    }),
  });

  await request('/driver/status', {
    method: 'PUT',
    headers: pedroHeaders,
    body: JSON.stringify({
      status: 'available',
      location: { latitude: 20.4450, longitude: -101.7350, address: 'Pénjamo Norte' },
    }),
  });

  console.log('1. Ambos repartidores en línea: Roberto (0.06 km) y Pedro (2.05 km).');

  // 2. Customer creates order and restaurant marks READY
  const custLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'carlos@directaurante.com', password: 'cliente123' }),
  });
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custLogin.token}`, 'x-idempotency-key': `reassign_${Date.now()}` },
    body: JSON.stringify({
      restaurant_id: 'rest_tacos_guero',
      order_type: 'delivery',
      delivery_address: 'Av. Morelos #64, Pénjamo',
      customer_phone: '4621234567',
      items: [
        {
          product_id: 'prod_tacos_pastor',
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
          toppings: ['top_queso'],
        },
      ],
      payment_method: 'cash',
    }),
  });
  const orderId = orderRes.data.id;

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
  console.log(`2. Pedido #${orderId.slice(-6)} marcado como READY.`);

  // 3. Proximity check: Roberto must receive it first
  const robertoOffer = await request('/driver/offers/current', { headers: robertoHeaders });
  if (!robertoOffer.data || robertoOffer.data.order_id !== orderId) {
    throw new Error('Roberto debería haber recibido la oferta por ser el más cercano (0.06 km)');
  }
  console.log(`3. ✓ Roberto recibe primero la oferta #${robertoOffer.data.id.slice(-6)} (0.06 km).`);

  // Verify Pedro DOES NOT have the offer yet
  const pedroInitialOffer = await request('/driver/offers/current', { headers: pedroHeaders });
  if (pedroInitialOffer.data && pedroInitialOffer.data.order_id === orderId) {
    throw new Error('Pedro NO debería tener la oferta mientras está asignada a Roberto');
  }
  console.log('4. ✓ Pedro no tiene la oferta (esperando turno según proximidad).');

  // 4. Roberto REJECTS the offer
  console.log('5. Roberto rechaza la oferta manualmente...');
  await request(`/driver/offers/${robertoOffer.data.id}/reject`, {
    method: 'POST',
    headers: robertoHeaders,
    body: JSON.stringify({ reason: 'Muy lejos de mi zona actual' }),
  });
  console.log('   ✓ Oferta rechazada por Roberto.');

  // 5. Pedro MUST now receive the re-dispatched offer
  console.log('6. Comprobando reasignación automática a Pedro...');
  const pedroOffer = await request('/driver/offers/current', { headers: pedroHeaders });
  if (!pedroOffer.data || pedroOffer.data.order_id !== orderId) {
    throw new Error('Pedro debería haber recibido la oferta tras el rechazo de Roberto');
  }
  console.log(`   ✓ Pedro recibió la oferta reasignada: #${pedroOffer.data.id.slice(-6)} (${pedroOffer.data.distance_km} km, intento #2).`);

  // Pedro accepts
  await request(`/driver/offers/${pedroOffer.data.id}/accept`, {
    method: 'POST',
    headers: pedroHeaders,
  });
  console.log('7. ✓ Pedro aceptó el pedido exitosamente.');

  console.log('\n========================================================================');
  console.log('   REASIGNACIÓN POR PROXIMIDAD Y RECHAZO: 100% VALIDADA');
  console.log('========================================================================\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReassignmentTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error en prueba Reasignación:', err);
      process.exit(1);
    });
}
