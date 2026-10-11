import { dbClient } from '../server/db/connection.ts';
import { config } from '../server/config/index.ts';
import fs from 'fs';
import path from 'path';

const PRESERVED_USER_IDS = new Set([
  'usr_master_admin',
  'usr_master_01',
  'usr_rest_owner_01',
  'usr_driver_roberto_01',
  'usr_driver_pedro_02',
  'usr_carlos_01',
  'usr_mariana_02',
  'usr_roberto_03',
  'usr_aafotosrespaldo', // Cuenta real del usuario (aafotosrespaldo@gmail.com)
  'usr_restaurant_39d737ea-aeaa-4c7e-afcc-fb994b0fdd7a', // Dueño de Burger Lab
]);

async function runControlledReset() {
  console.log('=== INICIANDO RESET CONTROLADO DE DIRECTAURANTE CORE V2 ===');

  // 1. Verificación de entorno y seguridad
  if (config.nodeEnv === 'production') {
    throw new Error('ABORTADO: nodeEnv es production. El reset solo puede ejecutarse en desarrollo.');
  }

  const backupDir = './backups/backup_dev_2026-10-09T05-17-54-111Z';
  if (!fs.existsSync(backupDir) || !fs.existsSync(path.join(backupDir, 'metadata.json'))) {
    throw new Error('ABORTADO: No se encontró el respaldo verificado en ' + backupDir);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(backupDir, 'metadata.json'), 'utf8'));
  console.log(`[Backup Verificado] Base: ${meta.database}, Fecha: ${meta.timestamp}, Colecciones: ${Object.keys(meta.collections).length}`);

  const db = await dbClient.connect();
  const dbName = db.databaseName;
  if (dbName !== 'directaurante') {
    throw new Error(`ABORTADO: Nombre de base inesperado: ${dbName}. Se esperaba "directaurante".`);
  }
  console.log(`[Entorno Confirmado] Conectado a base DEV: "${dbName}"`);

  // 2. Eliminación de pedidos ficticios y colecciones dependientes
  console.log('\n--- 1. Limpieza de Pedidos y Dependencias Ficticias ---');
  
  const ordersDel = await db.collection('orders').deleteMany({});
  console.log(`- orders eliminados: ${ordersDel.deletedCount}`);

  const orderMsgsDel = await db.collection('order_messages').deleteMany({});
  console.log(`- order_messages eliminados: ${orderMsgsDel.deletedCount}`);

  const offersDel = await db.collection('driver_offers').deleteMany({});
  console.log(`- driver_offers eliminados: ${offersDel.deletedCount}`);

  const settlementsDel = await db.collection('driver_settlements').deleteMany({});
  console.log(`- driver_settlements eliminados: ${settlementsDel.deletedCount}`);

  const shiftsDel = await db.collection('driver_shifts').deleteMany({});
  console.log(`- driver_shifts eliminados: ${shiftsDel.deletedCount}`);

  const incidentsDel = await db.collection('incidents').deleteMany({});
  console.log(`- incidents eliminados: ${incidentsDel.deletedCount}`);

  const payAttemptsDel = await db.collection('payment_attempts').deleteMany({});
  console.log(`- payment_attempts eliminados: ${payAttemptsDel.deletedCount}`);

  const webhooksDel = await db.collection('processed_webhooks').deleteMany({});
  console.log(`- processed_webhooks eliminados: ${webhooksDel.deletedCount}`);

  const convsDel = await db.collection('conversations').deleteMany({});
  console.log(`- conversations eliminados: ${convsDel.deletedCount}`);

  const chatMsgsDel = await db.collection('chat_messages').deleteMany({});
  console.log(`- chat_messages eliminados: ${chatMsgsDel.deletedCount}`);

  const ticketsDel = await db.collection('support_tickets').deleteMany({});
  console.log(`- support_tickets eliminados: ${ticketsDel.deletedCount}`);

  // 3. Password resets expirados
  console.log('\n--- 2. Limpieza de Password Resets Expirados ---');
  const pwdDel = await db.collection('password_resets').deleteMany({});
  console.log(`- password_resets eliminados (todos vencidos): ${pwdDel.deletedCount}`);

  // 4. Usuarios de prueba efímeros
  console.log('\n--- 3. Depuración de Usuarios Efímeros ---');
  const allUsers = await dbClient.getUsersCollection().find({}).toArray();
  const usersToDelete = allUsers.filter(u => !PRESERVED_USER_IDS.has(u.id));
  const deleteIds = usersToDelete.map(u => u.id);
  
  const usersDel = await dbClient.getUsersCollection().deleteMany({ id: { $in: deleteIds } });
  console.log(`- users eliminados (cuentas temporales de tests): ${usersDel.deletedCount}`);
  
  const remainingUsers = await dbClient.getUsersCollection().find({}).toArray();
  console.log(`- users conservados (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(`   * [${u.role}] ${u.email} (${u.name}) - ID: ${u.id}`));

  // 5. Direcciones huérfanas
  console.log('\n--- 4. Direcciones ---');
  const addrDel = await db.collection('addresses').deleteMany({ user_id: { $nin: Array.from(PRESERVED_USER_IDS) } });
  console.log(`- addresses huérfanas eliminadas: ${addrDel.deletedCount}`);
  const remainingAddrs = await db.collection('addresses').find({}).toArray();
  console.log(`- addresses conservadas: ${remainingAddrs.length}`);

  // 6. Colecciones protegidas y conservadas intactas
  console.log('\n--- 5. Colecciones Protegidas Conservadas ---');
  const restaurantsCount = await db.collection('restaurants').countDocuments();
  const categoriesCount = await db.collection('categories').countDocuments();
  const productsCount = await db.collection('products').countDocuments();
  const commercialSolutionsCount = await db.collection('commercial_solutions').countDocuments();
  const commercialPlansCount = await db.collection('commercial_plans').countDocuments();
  const entitlementsCount = await db.collection('restaurant_entitlements').countDocuments();
  const finConfigCount = await db.collection('system_financial_config').countDocuments();
  const auditLogsCount = await db.collection('audit_logs').countDocuments();
  const revokedTokensCount = await db.collection('revoked_tokens').countDocuments();

  console.log(`- restaurants: ${restaurantsCount} (conservados intactos)`);
  console.log(`- categories: ${categoriesCount} (conservados intactos)`);
  console.log(`- products: ${productsCount} (conservados intactos)`);
  console.log(`- commercial_solutions: ${commercialSolutionsCount} (conservados intactos)`);
  console.log(`- commercial_plans: ${commercialPlansCount} (conservados intactos)`);
  console.log(`- restaurant_entitlements: ${entitlementsCount} (conservados intactos)`);
  console.log(`- system_financial_config: ${finConfigCount} (conservados intactos)`);
  console.log(`- audit_logs: ${auditLogsCount} (conservados intactos para trazabilidad)`);
  console.log(`- revoked_tokens: ${revokedTokensCount} (conservados intactos para seguridad)`);

  // 7. Verificación de Integridad Referencial
  console.log('\n--- 6. Verificación de Integridad Referencial ---');
  const restaurants = await db.collection('restaurants').find({}).toArray();
  for (const r of restaurants) {
    if (r.owner_id) {
      const owner = await dbClient.getUsersCollection().findOne({ id: r.owner_id });
      console.log(`✓ Restaurante "${r.name}" (${r.id}) -> Dueño: ${owner ? owner.email : 'SIN ASIGNAR'} (OK)`);
    }
  }

  console.log('\n=== RESET CONTROLADO COMPLETADO EXITOSAMENTE ===');
}

runControlledReset().catch(err => {
  console.error('ERROR EN RESET:', err);
  process.exit(1);
}).then(() => process.exit(0));
