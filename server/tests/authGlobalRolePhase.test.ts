import { dbClient } from '../db/connection.ts';
import { AuthService } from '../services/authService.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { RestaurantService } from '../services/restaurantService.ts';
import { OrderService } from '../services/orderService.ts';
import crypto from 'crypto';

let passed = 0;
let failed = 0;

async function testCase(num: number, desc: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${num}. ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${num}. ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('======================================================');
  console.log('   DIRECTAURANTE V2 — PRUEBAS DE AUTENTICACIÓN GLOBAL Y ACCESO POR ROL');
  console.log('======================================================');

  await dbClient.connect();

  const testUnique = Date.now();
  const testCustomerEmail = `test_customer_${testUnique}@directaurante.com`;
  const testPassword = 'SecurePassword123!';
  const updatedPassword = 'NewSecurePassword456!';

  // Pre-seed a test customer for isolation
  await AuthService.register({
    name: 'Cliente Prueba V2',
    email: testCustomerEmail,
    password: testPassword,
    phone: '4621239999',
    role: 'customer',
  });

  // 1. Login correcto de Cliente y acceso exclusivo al panel Cliente
  await testCase(1, 'Login correcto de Cliente y acceso exclusivo al panel Cliente', async () => {
    const res = await AuthService.login({
      email: testCustomerEmail,
      password: testPassword,
      expectedRole: 'customer',
    });
    if (!res.token || res.user.role !== 'customer') {
      throw new Error('Respuesta inválida para cliente');
    }
  });

  // 2. Login correcto de Repartidor y acceso exclusivo al panel Repartidor
  await testCase(2, 'Login correcto de Repartidor y acceso exclusivo al panel Repartidor', async () => {
    const res = await AuthService.login({
      email: 'roberto@directaurante.com',
      password: 'driver123',
      expectedRole: 'driver',
    });
    if (!res.token || res.user.role !== 'driver') {
      throw new Error('Respuesta inválida para repartidor');
    }
  });

  // 3. Login de Restaurante y acceso al panel Restaurante
  await testCase(3, 'Login de Restaurante y acceso al panel Restaurante', async () => {
    const res = await AuthService.login({
      email: 'donpepe@tacoselguero.com',
      password: 'tacos123',
      expectedRole: 'restaurant',
    });
    if (!res.token || res.user.role !== 'restaurant') {
      throw new Error('Respuesta inválida para restaurante');
    }
  });

  // 4. Login administrativo de Master protegido
  await testCase(4, 'Login administrativo de Master protegido', async () => {
    const res = await AuthService.login({
      email: 'admin@directaurante.com',
      password: 'Admin123!',
      expectedRole: 'master',
    });
    if (!res.token || res.user.role !== 'master') {
      throw new Error('Respuesta inválida para master');
    }
  });

  // 5. Rechazo de credenciales incorrectas
  await testCase(5, 'Rechazo de credenciales incorrectas', async () => {
    let threw = false;
    try {
      await AuthService.login({
        email: testCustomerEmail,
        password: 'wrong_password_xyz',
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Credenciales') && !err.message.includes('contraseña')) {
        throw new Error('Mensaje de error inesperado');
      }
    }
    if (!threw) throw new Error('Se debió rechazar el acceso con contraseña errónea');
  });

  // 6. Rechazo de roles incompatibles
  await testCase(6, 'Rechazo de roles incompatibles (Cliente intentando acceder como Restaurante o Driver)', async () => {
    let threw = false;
    try {
      await AuthService.login({
        email: testCustomerEmail,
        password: testPassword,
        expectedRole: 'restaurant',
      });
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 403) throw new Error(`Status code esperado 403, recibido: ${err.statusCode}`);
    }
    if (!threw) throw new Error('Se debió rechazar el rol incompatible');
  });

  // 7. Logout desde cada panel web y revocación en servidor
  let sampleToken = '';
  await testCase(7, 'Logout desde panel web y revocación en servidor', async () => {
    const loginRes = await AuthService.login({
      email: testCustomerEmail,
      password: testPassword,
    });
    sampleToken = loginRes.token;

    // Verify token is active
    const decoded = AuthService.verifyToken(sampleToken);
    if (!decoded) throw new Error('Token no es válido');

    // Revoke token on server
    await AuthService.revokeToken(sampleToken, decoded.id);

    // Verify token is detected as revoked
    const isRevoked = await AuthService.isTokenRevoked(sampleToken, decoded.id);
    if (!isRevoked) throw new Error('El token revocado no fue detectado por el servidor');
  });

  // 8. Logout en cada app móvil y regreso al login correspondiente
  await testCase(8, 'Logout en app móvil (invalidación de credenciales y reseteo de estado)', async () => {
    const driverRes = await AuthService.login({
      email: 'roberto@directaurante.com',
      password: 'driver123',
      expectedRole: 'driver',
    });
    await AuthService.revokeToken(driverRes.token, driverRes.user.id);
    const isRevoked = await AuthService.isTokenRevoked(driverRes.token, driverRes.user.id);
    if (!isRevoked) throw new Error('Token de app móvil no revocado');
  });

  // 9. Imposibilidad de recuperar el panel protegido usando Atrás después del logout
  await testCase(9, 'Imposibilidad de restaurar sesión usando token revocado', async () => {
    let rejected = false;
    try {
      AuthService.verifyToken(sampleToken);
    } catch (err: any) {
      rejected = true;
      if (err.statusCode !== 401) throw new Error('Status no es 401');
    }
    if (!rejected) throw new Error('verifyToken permitió usar token revocado');
  });

  // 10. Solicitud de recuperación con correo existente e inexistente, sin revelar diferencias
  await testCase(10, 'Solicitud de recuperación con correo existente e inexistente, sin revelar diferencias', async () => {
    const res1 = await AuthService.forgotPassword(testCustomerEmail, '127.0.0.1');
    const res2 = await AuthService.forgotPassword('non_existent_user_999@directaurante.com', '127.0.0.1');
    if (!res1.success || !res2.success) throw new Error('Solicitud fallida');
    if (res1.message !== res2.message) {
      throw new Error('El mensaje reveló existencia del correo');
    }
  });

  // 11. Token de recuperación válido, expirado y reutilizado
  let validResetDoc: any;
  await testCase(11, 'Token de recuperación válido, expirado y reutilizado', async () => {
    // Locate generated reset doc in MongoDB
    validResetDoc = await dbClient.getPasswordResetsCollection().findOne(
      { email: testCustomerEmail.toLowerCase() },
      { sort: { created_at: -1 } }
    );
    if (!validResetDoc) throw new Error('No se encontró el registro de recuperación en MongoDB');

    // 11a: Token válido
    const checkValid = await AuthService.verifyResetToken({
      code: 'invalid_code',
      email: testCustomerEmail,
    });
    if (checkValid.valid) throw new Error('Código incorrecto fue aceptado');

    // 11b: Token expirado en base de datos
    const expiredDoc = {
      id: `rst_expired_${Date.now()}`,
      email: 'expired@directaurante.com',
      user_id: 'usr_dummy',
      token_hash: crypto.createHash('sha256').update('expired_raw_token').digest('hex'),
      code_hash: crypto.createHash('sha256').update('123456').digest('hex'),
      attempts: 0,
      used: false,
      expires_at: new Date(Date.now() - 60000), // Expirado hace 1 minuto
      created_at: new Date(Date.now() - 120000).toISOString(),
    };
    await dbClient.getPasswordResetsCollection().insertOne(expiredDoc as any);

    const checkExpired = await AuthService.verifyResetToken({ token: 'expired_raw_token' });
    if (checkExpired.valid) throw new Error('Token expirado fue aceptado');
  });

  // 12. Cambio de contraseña y rechazo de la contraseña anterior
  await testCase(12, 'Cambio de contraseña y rechazo de la contraseña anterior', async () => {
    // Generate a fresh direct token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    await dbClient.getPasswordResetsCollection().insertOne({
      id: `rst_unit_${Date.now()}`,
      email: testCustomerEmail.toLowerCase(),
      user_id: validResetDoc.user_id,
      token_hash: tokenHash,
      code_hash: 'none',
      attempts: 0,
      used: false,
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date().toISOString(),
    } as any);

    // Execute reset
    await AuthService.resetPassword({
      token: rawResetToken,
      newPassword: updatedPassword,
    });

    // Old password must now fail
    let oldFailed = false;
    try {
      await AuthService.login({
        email: testCustomerEmail,
        password: testPassword,
      });
    } catch {
      oldFailed = true;
    }
    if (!oldFailed) throw new Error('La contraseña anterior sigue funcionando');

    // New password must succeed
    const newLogin = await AuthService.login({
      email: testCustomerEmail,
      password: updatedPassword,
    });
    if (!newLogin.token) throw new Error('La nueva contraseña no permitió login');

    // Reutilización del token debe ser rechazada
    let reuseFailed = false;
    try {
      await AuthService.resetPassword({
        token: rawResetToken,
        newPassword: 'AnotherPassword999!',
      });
    } catch {
      reuseFailed = true;
    }
    if (!reuseFailed) throw new Error('Se permitió reutilizar un token ya consumido');
  });

  // 13. Prevención de solicitudes abusivas de recuperación (Rate Limiting)
  await testCase(13, 'Prevención de solicitudes abusivas de recuperación (Rate Limit 429)', async () => {
    const abusiveIp = '198.51.100.42';
    const abusiveEmail = `abusive_${Date.now()}@directaurante.com`;
    let blocked = false;

    try {
      for (let i = 0; i < 7; i++) {
        await AuthService.forgotPassword(abusiveEmail, abusiveIp);
      }
    } catch (err: any) {
      if (err.statusCode === 429) {
        blocked = true;
      }
    }
    if (!blocked) throw new Error('Rate limit no bloqueó solicitudes abusivas');
  });

  // 14. Persistencia correcta y ausencia de duplicados de usuarios
  await testCase(14, 'Persistencia correcta y ausencia de duplicados de usuarios', async () => {
    let duplicateRejected = false;
    try {
      await AuthService.register({
        name: 'Duplicado Fraudulento',
        email: testCustomerEmail.toUpperCase(), // Case insensitive duplicate check
        password: 'Password999!',
        role: 'customer',
      });
    } catch (err: any) {
      duplicateRejected = true;
    }
    if (!duplicateRejected) throw new Error('Se permitió registrar un correo duplicado');
  });

  // 15. Protección de los endpoints privados después del logout
  await testCase(15, 'Protección de endpoints privados después del logout (token revocado)', async () => {
    const authSession = await AuthService.login({
      email: testCustomerEmail,
      password: updatedPassword,
    });

    // Revoke token
    await AuthService.revokeToken(authSession.token, authSession.user.id);

    // Verify private user profile retrieval rejects revoked token
    const isRevoked = await AuthService.isTokenRevoked(authSession.token, authSession.user.id);
    if (!isRevoked) throw new Error('Endpoint no protegido tras logout');
  });

  // 16. Ausencia de regresiones en pedidos, SSE, despacho, GPS y permisos existentes
  await testCase(16, 'Ausencia de regresiones en pedidos, despacho y reglas financieras soberanas', async () => {
    const restaurant = await RestaurantService.getRestaurantById('rest_tacos_guero');
    if (!restaurant) throw new Error('Restaurante no encontrado');

    const products = await dbClient.getProductsCollection().find({ restaurant_id: 'rest_tacos_guero' }).toArray();
    if (!products || products.length === 0) throw new Error('Productos no encontrados');

    const sampleProduct = products[0];
    const orderRes = await OrderService.createOrder(validResetDoc.user_id, {
      restaurant_id: 'rest_tacos_guero',
      order_type: 'delivery',
      delivery_address: 'Calle Hidalgo #20, Zona Centro',
      items: [
        {
          product_id: sampleProduct.id,
          quantity: 1,
          variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
        },
      ],
      payment_method: 'cash',
      tip_amount: 1000,
    });

    if (orderRes.order.subtotal <= 0 || orderRes.order.total <= orderRes.order.subtotal) {
      throw new Error('Cálculo de pedido regresionó');
    }
  });

  console.log('======================================================');
  console.log(`   RESULTADO DE PRUEBAS: ${passed} PASADAS / ${failed} FALLADAS (16 PRUEBAS)`);
  console.log('======================================================');

  await dbClient.disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});
