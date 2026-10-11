import { MongoClient } from 'mongodb';

const BASE_URL = 'http://127.0.0.1:3000/api';

class DirectClientSimulation {
  private token: string | null = null;

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `Error ${res.status}: ${res.statusText}`);
    }
    return json;
  }

  async login(payload: { email: string; password: string }) {
    const res = await this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.token = res.token;
    return res;
  }

  async getRestaurants() {
    const res = await this.request<{ success: boolean; data: any[] }>('/restaurants');
    return res.data;
  }

  async getRestaurantProducts(restaurantId: string) {
    const res = await this.request<{ success: boolean; data: any[] }>(`/restaurants/${restaurantId}/products`);
    return res.data;
  }

  async getAddresses() {
    const res = await this.request<{ success: boolean; data: any[] }>('/customer/addresses');
    return res.data;
  }

  async createAddress(address: any) {
    const res = await this.request<{ success: boolean; data: any }>('/customer/addresses', {
      method: 'POST',
      body: JSON.stringify(address),
    });
    return res.data;
  }

  async createOrder(orderPayload: any, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
    const res = await this.request<{ success: boolean; data: any; is_duplicate: boolean }>('/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload),
    });
    return { order: res.data, isDuplicate: res.is_duplicate };
  }

  async getMyOrders() {
    const res = await this.request<{ success: boolean; data: any[] }>('/orders');
    return res.data;
  }

  async getOrderById(id: string) {
    const res = await this.request<{ success: boolean; data: any }>(`/orders/${id}`);
    return res.data;
  }
}

export async function runClientToMongoTest() {
  console.log('\n========================================================================');
  console.log('   PRUEBA INTEGRAL CLIENT V2 → CORE V2 → MONGODB RAILWAY');
  console.log('========================================================================\n');

  const client = new DirectClientSimulation();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI no configurado');

  // 1. LOGIN
  console.log('1. [Client V2] Iniciando sesión...');
  const loginResult = await client.login({
    email: 'carlos@directaurante.com',
    password: 'cliente123',
  });
  console.log(`   ✓ Sesión establecida como: ${loginResult.user.name} (${loginResult.user.email})`);

  // 2. RESTAURANTES
  console.log('2. [Client V2] Obteniendo restaurantes desde el Core V2...');
  const restaurants = await client.getRestaurants();
  if (restaurants.length === 0) throw new Error('No se encontraron restaurantes');
  const restaurant = restaurants[0];
  console.log(`   ✓ Restaurante seleccionado: ${restaurant.name} (ID: ${restaurant.id})`);

  // 3. CATÁLOGO
  console.log('3. [Client V2] Obteniendo catálogo de platillos...');
  const products = await client.getRestaurantProducts(restaurant.id);
  if (products.length === 0) throw new Error('No se encontraron productos en el menú');
  const product = products[0];
  console.log(`   ✓ Producto seleccionado: ${product.name} ($${(product.price / 100).toFixed(2)} MXN)`);

  // 4. PRODUCTO Y CARRITO
  console.log('4. [Client V2] Configurando producto con variantes y toppings para el carrito...');
  const selectedVariants: any[] = [];
  if (product.variants && product.variants.length > 0) {
    const vGroup = product.variants[0];
    if (vGroup.options.length > 0) {
      selectedVariants.push({ group_id: vGroup.id, option_id: vGroup.options[0].id });
    }
  }
  const selectedToppings: string[] = [];
  if (product.toppings && product.toppings.length > 0) {
    selectedToppings.push(product.toppings[0].id);
  }
  const cartItemQuantity = 2;
  console.log(`   ✓ Carrito preparado: 2x ${product.name} con ${selectedVariants.length} variantes y ${selectedToppings.length} toppings`);

  // 5. DIRECCIÓN
  console.log('5. [Client V2] Verificando / creando dirección de entrega del cliente...');
  let addresses = await client.getAddresses();
  let addressId = addresses[0]?.id;
  let deliveryAddressStr = addresses[0] ? `${addresses[0].street} #${addresses[0].number}, ${addresses[0].colony}` : 'Av. Morelos #64, Centro';
  if (!addressId) {
    const newAddr = await client.createAddress({
      label: 'Casa Principal',
      street: 'Av. Morelos',
      number: '64',
      colony: 'Centro',
      city: 'Pénjamo',
      state: 'Guanajuato',
      postal_code: '36900',
      is_default: true,
    });
    addressId = newAddr.id;
    deliveryAddressStr = `${newAddr.street} #${newAddr.number}, ${newAddr.colony}`;
    console.log(`   ✓ Nueva dirección creada en Railway MongoDB: ID ${addressId}`);
  } else {
    console.log(`   ✓ Dirección existente cargada: ${addresses[0].label} (${deliveryAddressStr})`);
  }

  // 6. CHECKOUT Y CREAR PEDIDO
  console.log('6. [Client V2] Enviando Checkout con idempotencia al Core V2...');
  const idempotencyKey = `idemp_client_v2_${Date.now()}`;
  const orderPayload = {
    restaurant_id: restaurant.id,
    order_type: 'delivery',
    address_id: addressId,
    delivery_address: deliveryAddressStr,
    customer_phone: '4621234567',
    items: [
      {
        product_id: product.id,
        quantity: cartItemQuantity,
        variants: selectedVariants,
        toppings: selectedToppings,
        notes: 'Pedido generado desde Client V2',
      },
    ],
    payment_method: 'cash',
    tip_amount: 1500,
    notes: 'Tocar el timbre por favor',
    idempotency_key: idempotencyKey,
  };

  const createOrderResult = await client.createOrder(orderPayload, idempotencyKey);
  const createdOrder = createOrderResult.order;
  console.log(`   ✓ Pedido creado exitosamente: #${createdOrder.id}`);
  console.log(`     - Subtotal soberano: $${(createdOrder.subtotal / 100).toFixed(2)} MXN`);
  console.log(`     - Envío: $${(createdOrder.delivery_fee / 100).toFixed(2)} MXN`);
  console.log(`     - Servicio: $${(createdOrder.service_fee / 100).toFixed(2)} MXN`);
  console.log(`     - Total: $${(createdOrder.total / 100).toFixed(2)} MXN`);

  // 7. VERIFICACIÓN FÍSICA EN MONGODB RAILWAY
  console.log('7. [Verificación Directa] Comprobando documento en MongoDB Railway...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db('directaurante');

  const orderInMongo = await db.collection('orders').findOne({ id: createdOrder.id });
  if (!orderInMongo) {
    throw new Error(`El pedido ${createdOrder.id} no existe físicamente en MongoDB Railway`);
  }
  console.log(`   ✓ Pedido físicamente persistido en Railway: MongoDB _id = ${orderInMongo._id}`);

  const auditLog = await db.collection('audit_logs').findOne({ entity_id: createdOrder.id, event: 'order.created' });
  if (!auditLog) {
    throw new Error(`Audit log order.created no encontrado en Railway para el pedido ${createdOrder.id}`);
  }
  console.log(`   ✓ Registro de auditoría verificado en Railway: ID = ${auditLog.id}`);

  await mongoClient.close();

  // 8. CONSULTAR PEDIDO DESDE CLIENT V2
  console.log('8. [Client V2] Consultando pedido por ID y en listado de pedidos del usuario...');
  const fetchedOrder = await client.getOrderById(createdOrder.id);
  if (!fetchedOrder || fetchedOrder.id !== createdOrder.id) {
    throw new Error('No se pudo recuperar el pedido por ID desde Client V2');
  }

  const myOrders = await client.getMyOrders();
  const existsInList = myOrders.some((o: any) => o.id === createdOrder.id);
  if (!existsInList) {
    throw new Error('El pedido no aparece en la lista de pedidos del usuario en Client V2');
  }
  console.log(`   ✓ Pedido recuperado correctamente en Client V2 (${myOrders.length} pedidos en historial)`);

  console.log('\n========================================================================');
  console.log('   RESULTADO: FLUJO COMPLETO CLIENT V2 → CORE V2 → RAILWAY EXITOSO (100% PASS)');
  console.log('========================================================================\n');
}

runClientToMongoTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERROR EN FLUJO CLIENT V2:', err);
    process.exit(1);
  });
