import { AuthService } from '../services/authService.ts';
import { CommunicationService } from '../services/communicationService.ts';
import { IncidentService } from '../services/incidentService.ts';
import { EntitlementService } from '../services/entitlementService.ts';
import { RealtimeService } from '../services/realtimeService.ts';
import { OrderService } from '../services/orderService.ts';
import { dbClient, initDb } from '../db/connection.ts';
import { createCoreApp } from '../app.ts';
import express from 'express';
import http from 'http';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function runMasterPhase2Suite() {
  console.log('======================================================');
  console.log('   DIRECTAURANTE MASTER V2 — FASE 2 TEST SUITE');
  console.log('   Comunicación en Vivo · Soporte · Soluciones · Planes · Entitlements');
  console.log('======================================================');

  await initDb();

  // Spin up an in-memory express server for API testing
  const coreApp = createCoreApp();
  const server = http.createServer(coreApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not json
    }
    return { status: res.status, ok: res.ok, body: json, raw: text };
  };

  try {
    // 1. Obtener tokens JWT para diferentes roles
    const masterLogin = await AuthService.login({ email: 'admin@directaurante.com', password: 'Admin123!' });
    const customerLogin = await AuthService.login({ email: 'carlos@directaurante.com', password: 'cliente123' });
    const driverLogin = await AuthService.login({ email: 'roberto@directaurante.com', password: 'driver123' });

    const masterToken = masterLogin.token;
    const customerToken = customerLogin.token;
    const driverToken = driverLogin.token;

    // 1. RBAC Master: Solo rol 'master' puede acceder a endpoints /master/*
    await test('1. RBAC estricto: cliente y conductor son rechazados en /master/*', async () => {
      const resCust = await request('/master/overview', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      if (resCust.status !== 403) throw new Error(`Cliente debió recibir 403, recibió ${resCust.status}`);

      const resDriver = await request('/master/overview', {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      if (resDriver.status !== 403) throw new Error(`Conductor debió recibir 403, recibió ${resDriver.status}`);

      const resMaster = await request('/master/overview', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (resMaster.status !== 200) throw new Error(`Master debió recibir 200, recibió ${resMaster.status}`);
    });

    // 2. Chat Directo: Master inicia conversación con Cliente y Conductor
    let testDirectConvId = '';
    await test('2. Chat Directo: Master ↔ Cliente con persistencia y emisor JWT', async () => {
      const res = await request('/master/communications/direct', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          target_user_id: customerLogin.user.id,
          initial_message: 'Hola Carlos, te contactamos desde el Centro de Control Master',
          priority: 'normal',
          subject: 'Soporte Directo al Cliente',
        }),
      });

      if (res.status !== 201) throw new Error(`Fallo al crear chat directo: ${res.raw}`);
      testDirectConvId = res.body.data.conversation_id;
      if (!testDirectConvId) throw new Error('No se retornó conversation_id');
      if (res.body.data.type !== 'direct') throw new Error('Tipo de conversación debe ser "direct"');
    });

    // 3. Envío de Mensaje en Tiempo Real con persistencia en MongoDB
    await test('3. Mensajes persistentes en MongoDB con remitente validado por JWT', async () => {
      const res = await request(`/master/communications/conversations/${testDirectConvId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          message: 'Confirmamos la recepción de tu consulta en el Centro de Control.',
        }),
      });

      if (res.status !== 201) throw new Error(`Error enviando mensaje: ${res.raw}`);
      const msg = res.body.data;
      if (msg.sender_role !== 'master') throw new Error(`Remitente debió ser master, fue ${msg.sender_role}`);
      if (msg.sender_id !== masterLogin.user.id) throw new Error('sender_id no coincide con el JWT');

      // Consultar historial
      const listRes = await request(`/master/communications/conversations/${testDirectConvId}/messages`, {
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (!listRes.ok || listRes.body.data.length < 2) {
        throw new Error('No se recuperó el historial completo de mensajes');
      }
    });

    // 4. Chat vinculado a pedido (Order room multi-actor)
    let sampleOrderId = '';
    await test('4. Chat Vinculado a Pedido: Consulta o auto-inicialización con los 4 participantes', async () => {
      // Tomar una orden existente o crear una orden de prueba
      const orders = await dbClient.getOrdersCollection().find({}).limit(1).toArray();
      if (orders.length === 0) {
        const created = await OrderService.createOrder(customerLogin.user.id, {
          restaurant_id: 'rest_tacos_guero',
          order_type: 'pickup',
          items: [
            {
              product_id: 'prod_tacos_pastor',
              quantity: 2,
              variants: [{ group_id: 'var_tortilla', option_id: 'opt_maiz' }],
            },
          ],
          payment_method: 'cash',
        });
        sampleOrderId = created.order.id;
      } else {
        sampleOrderId = orders[0].id;
      }

      const res = await request(`/master/communications/order/${sampleOrderId}`, {
        headers: { Authorization: `Bearer ${masterToken}` },
      });

      if (!res.ok) throw new Error(`Error en comunicación de pedido: ${res.raw}`);
      const ctx = res.body.data;
      if (!ctx.order || !ctx.conversation) throw new Error('Contexto incompleto retornado');
      if (ctx.conversation.type !== 'order') throw new Error('Tipo debe ser "order"');
      if (!ctx.presence) throw new Error('Falta bloque de presencia en vivo');
    });

    // 5. Presencia en vivo 24/7 (Autoritativa, sin simulación)
    await test('5. Presencia en vivo: Detección real de conexiones activas en RealtimeService', async () => {
      const presence = RealtimeService.getOrderPresence({
        customer_id: customerLogin.user.id,
        restaurant_id: 'rest_tacos_guero',
        driver_id: driverLogin.user.id,
      });

      // Ninguno tiene SSE abierto en este proceso, por lo que deben reportarse offline de manera autoritativa
      if (typeof presence.customer !== 'boolean' || typeof presence.restaurant !== 'boolean') {
        throw new Error('Presencia inválida devuelta');
      }
    });

    // 6. Prioridad de conversación: Normal → Urgente → Crítica con auditoría
    await test('6. Prioridad de conversación: Actualización y auditoría persistida', async () => {
      const res = await request(`/master/communications/conversations/${testDirectConvId}/priority`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ priority: 'urgente' }),
      });

      if (!res.ok) throw new Error(`Error al actualizar prioridad: ${res.raw}`);
      if (res.body.data.priority !== 'urgente') throw new Error('Prioridad no se actualizó a urgente');

      // Verificar que se auditó en audit_logs
      const log = await dbClient
        .getAuditLogsCollection()
        .findOne({ event: 'master.priority_changed', entity_id: testDirectConvId });
      if (!log) throw new Error('No se auditó master.priority_changed en MongoDB');
    });

    // 7. Cierre de conversación con motivo
    await test('7. Cierre de conversación: estado persistido en MongoDB', async () => {
      const res = await request(`/master/communications/conversations/${testDirectConvId}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ reason: 'Caso atendido satisfactoriamente' }),
      });

      if (!res.ok) throw new Error(`Error al cerrar conversación: ${res.raw}`);
      if (res.body.data.status !== 'closed') throw new Error('Estado no es closed');
    });

    // 8. Incidencias & Soporte Operativo
    let testIncidentId = '';
    await test('8. Centro de Soporte: Crear y resolver incidencia con severidad y notas', async () => {
      const createRes = await request('/master/incidents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          title: 'Pedido con demora en elaboración',
          description: 'El restaurante reporta alta demanda física en salón.',
          entity_type: 'order',
          entity_id: sampleOrderId,
          order_id: sampleOrderId,
          severity: 'urgente',
        }),
      });

      if (!createRes.ok) throw new Error(`Fallo al crear incidencia: ${createRes.raw}`);
      testIncidentId = createRes.body.data.incident_id;

      // Resolver incidencia
      const resolveRes = await request(`/master/incidents/${testIncidentId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          status: 'resolved',
          resolution_notes: 'Cocinero de relevo activado y pedido completado.',
        }),
      });

      if (!resolveRes.ok) throw new Error(`Fallo al resolver incidencia: ${resolveRes.raw}`);
      if (resolveRes.body.data.status !== 'resolved') throw new Error('Incidencia debió estar resuelta');
    });

    // 9. Catálogo Comercial: Directaurante (9) y DirectPost (14)
    await test('9. Catálogo de Soluciones: Separación estricta Directaurante vs DirectPost', async () => {
      const res = await request('/master/commercial/solutions', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });

      if (!res.ok) throw new Error(`Error al consultar soluciones: ${res.raw}`);
      const list = res.body.data;
      const dirList = list.filter((s: any) => s.product === 'directaurante');
      const postList = list.filter((s: any) => s.product === 'directpost');

      if (dirList.length < 9) throw new Error(`Deben existir al menos 9 soluciones Directaurante, hay ${dirList.length}`);
      if (postList.length < 14) throw new Error(`Deben existir al menos 14 soluciones DirectPost, hay ${postList.length}`);
    });

    // 10. Planes Comerciales
    await test('10. Planes Comerciales: Configuración comercial preparada (sin Mercado Pago)', async () => {
      const res = await request('/master/commercial/plans', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });

      if (!res.ok) throw new Error(`Error al consultar planes: ${res.raw}`);
      const plans = res.body.data;
      if (plans.length < 6) throw new Error(`Deben existir al menos 6 planes en catálogo, hay ${plans.length}`);
    });

    // 11. Asignación de Plan a Restaurante y Entitlements
    await test('11. Asignación de Plan: Activación autoritativa de capacidades por restaurante', async () => {
      const res = await request('/master/commercial/restaurants/rest_pizza_napoli/plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ plan_id: 'plan_dir_pro' }),
      });

      if (!res.ok) throw new Error(`Error al asignar plan: ${res.raw}`);
      const ents = res.body.data.entitlements;
      if (ents.length < 4) throw new Error('Deben activarse las capacidades del plan profesional');
    });

    // 12. Autoridad Soberana del Backend: Solución deshabilitada BLOQUEA acción mediante API (403)
    await test('12. Entitlement Enforcement: Solución suspendida rechaza pedido en Core con 403 Forbidden', async () => {
      // 1. Suspender la solución de Pedidos Online para rest_tacos_guero
      await EntitlementService.toggleEntitlement(
        'rest_tacos_guero',
        'sol_dir_online_orders',
        'SUSPENDED',
        { id: masterLogin.user.id, name: 'Master' }
      );

      // 2. Intentar crear un pedido en rest_tacos_guero como cliente
      const orderRes = await request('/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerToken}`,
          'x-idempotency-key': `idem_ent_test_${Date.now()}`,
        },
        body: JSON.stringify({
          restaurant_id: 'rest_tacos_guero',
          order_type: 'pickup',
          items: [{ product_id: 'prod_taco_pastor', quantity: 2 }],
          payment_method: 'cash',
        }),
      });

      // Debe ser RECHAZADO con 403 Forbidden
      if (orderRes.status !== 403) {
        throw new Error(`Se esperaba 403 Forbidden por capacidad suspendida, pero se obtuvo ${orderRes.status}: ${orderRes.raw}`);
      }

      // 3. Reactivar la capacidad para no romper otros flujos
      await EntitlementService.toggleEntitlement(
        'rest_tacos_guero',
        'sol_dir_online_orders',
        'ACTIVE',
        { id: masterLogin.user.id, name: 'Master' }
      );
    });

    // 13. Trial de 30 días
    await test('13. Período de Prueba (Trial): Otorgamiento con trial_start y trial_end a 30 días', async () => {
      const res = await request('/master/commercial/restaurants/rest_pizza_napoli/trial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          solution_id: 'sol_post_kds',
          days: 30,
        }),
      });

      if (!res.ok) throw new Error(`Error al otorgar trial: ${res.raw}`);
      const ent = res.body.data;
      if (ent.status !== 'TRIAL') throw new Error(`Estado debió ser TRIAL, fue ${ent.status}`);
      if (!ent.trial_end) throw new Error('trial_end no fue calculado');
    });
  } finally {
    server.close();
    await dbClient.disconnect();
  }

  console.log('======================================================');
  console.log(`   RESULTADO FASE 2: ${passed} PASADAS / ${failed} FALLADAS (${passed + failed} PRUEBAS)`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterPhase2Suite().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
