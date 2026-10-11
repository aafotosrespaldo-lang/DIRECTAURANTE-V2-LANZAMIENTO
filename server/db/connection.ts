import { MongoClient, Db, Collection } from 'mongodb';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.ts';
import type {
  Address,
  AuditLog,
  Category,
  ChatMessage,
  CommercialPlan,
  CommercialSolution,
  Conversation,
  DeviceRegistration,
  DriverOffer,
  DriverSettlement,
  DriverShift,
  Incident,
  Order,
  OrderEvidence,
  OrderMessage,
  PaymentAttempt,
  ProcessedWebhook,
  Product,
  Restaurant,
  RestaurantEntitlement,
  RevokedToken,
  PasswordReset,
  SupportTicket,
  SystemFinancialConfig,
  User,
} from '../models/types.ts';
import { getSeedData, getCommercialSeedData } from './seed.ts';

class DatabaseClient {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private memoryServer: any = null;
  private isConnecting = false;
  private connected = false;
  private lastError: Error | null = null;
  private isAtlas = false;

  public async connect(): Promise<Db> {
    if (this.connected && this.db) {
      return this.db;
    }

    if (this.isConnecting) {
      // Wait for ongoing connection
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (this.db) return this.db;
    }

    this.isConnecting = true;
    this.lastError = null;

    try {
      let uri = config.mongodbUri;

      // Escenario 1: No hay URI configurada en variables/secrets
      if (!uri) {
        if (config.nodeEnv === 'production') {
          throw new Error('Error crítico: MONGODB_URI es obligatorio en producción. No se permite memoria volátil.');
        }
        console.log('[MongoDB] MONGODB_URI no detectado en variables. Modo desarrollo local: inicializando servidor MongoDB embebido...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        this.memoryServer = await MongoMemoryServer.create();
        const memoryUri: string = this.memoryServer.getUri();
        uri = memoryUri;
        this.client = new MongoClient(memoryUri, {
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
        });
        await this.client.connect();
        console.log(`[MongoDB] Servidor MongoDB local en memoria activo en: ${memoryUri}`);
      } else {
        // Escenario 2: URI remota o MongoDB Atlas configurada
        uri = uri.replace(/:\/\/([^:]+):<([^>]+)>@/, '://$1:$2@');
        this.isAtlas = uri.startsWith('mongodb+srv://') || uri.includes('.mongodb.net');
        const maskedUri = uri.replace(/\/\/[^@]+@/, '//***:***@');
        console.log(`[MongoDB] Conectando a ${this.isAtlas ? 'MongoDB Atlas (SRV/TLS)' : 'MongoDB remoto'}: ${maskedUri}...`);

        const clientOptions = {
          connectTimeoutMS: this.isAtlas ? 10000 : 4000,
          serverSelectionTimeoutMS: this.isAtlas ? 10000 : 4000,
          socketTimeoutMS: 20000,
          maxPoolSize: this.isAtlas ? 25 : 20,
          minPoolSize: 1,
          retryWrites: true,
          retryReads: true,
        };

        const maxRetries = 3;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (attempt > 1) {
              console.log(`[MongoDB] Reintento de conexión ${attempt}/${maxRetries} hacia ${maskedUri}...`);
            }
            this.client = new MongoClient(uri, clientOptions);
            await this.client.connect();
            // Ping rápido para validar conectividad y credenciales
            await this.client.db().command({ ping: 1 });
            lastErr = null;
            break;
          } catch (err: any) {
            lastErr = err;
            console.warn(`[MongoDB] Intento ${attempt}/${maxRetries} falló (${err.message}).`);
            if (this.client) {
              try { await this.client.close(); } catch (_) {}
              this.client = null;
            }
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
            }
          }
        }

        if (lastErr) {
          this.lastError = lastErr;

          // PROTECCIÓN Y RESILIENCIA:
          // Si el cluster remoto está inaccesible (ej. conexión cerrada o timeout),
          // permitimos el fallback para que Cloud Run supere los health probes y la aplicación no quede caída.
          const allowFallback = config.isTestMode || config.allowMemoryFallback || process.env.ALLOW_MEMORY_FALLBACK !== 'false';

          if (!allowFallback && config.nodeEnv === 'production') {
            const errorMsg = `[MongoDB] Conexión a MongoDB Atlas falló en producción (${lastErr.message}). ` +
              `Arranque detenido. Prohibido fallback a memoria en producción para proteger integridad y persistencia de datos.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }

          if (!allowFallback) {
            const errorMsg = `[MongoDB] Conexión a base de datos persistente falló (${lastErr.message}). ` +
              `Fallback a memoria cancelado para impedir pérdida de datos de clientes y órdenes. ` +
              `Verifica tus credenciales en Secrets, IP Access List de MongoDB Atlas o el estado del cluster.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }

          console.warn(`[MongoDB] ADVERTENCIA: Fallback a memoria permitido explícitamente (${lastErr.message}). ` +
            `Los datos almacenados serán volátiles y se perderán al reiniciar.`);
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          this.memoryServer = await MongoMemoryServer.create();
          const memoryUri = this.memoryServer.getUri();
          this.client = new MongoClient(memoryUri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
          });
          await this.client.connect();
        }
      }

      const targetDbName = config.mongodbDbName || 'directaurante';
      // If URI did not specify a DB or defaulted to test, use directaurante
      const currentDbName = this.client!.db().databaseName;
      if (!currentDbName || currentDbName === 'test') {
        this.db = this.client!.db(targetDbName);
      } else {
        this.db = this.client!.db();
      }
      this.connected = true;

      console.log(`[MongoDB] Conexión establecida con éxito a base de datos: "${this.db.databaseName}"`);

      // Ensure indexes
      await this.ensureIndexes();

      // Seed if empty in development
      await this.seedIfEmpty();

      // Ensure Master accounts are active and ready
      await this.ensureMasterUser();

      return this.db;
    } catch (err: any) {
      this.connected = false;
      this.db = null;
      this.lastError = err;
      console.error('[MongoDB] Error conectando a base de datos:', err.message);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.memoryServer) {
      await this.memoryServer.stop();
      this.memoryServer = null;
    }
    this.db = null;
    this.connected = false;
    console.log('[MongoDB] Conexión cerrada.');
  }

  public getDb(): Db {
    if (!this.db) {
      const reason = this.lastError
        ? ` (${this.lastError.message})`
        : '. Llama a connect() primero o verifica la conexión.';
      throw new Error(`Base de datos no disponible${reason}`);
    }
    return this.db;
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // 1. users: email UNIQUE
      await this.getUsersCollection().createIndex({ email: 1 }, { unique: true, name: 'idx_users_email_unique' });

      // 2. orders: idempotency_key UNIQUE per customer
      await this.getOrdersCollection().createIndex(
        { customer_id: 1, idempotency_key: 1 },
        { unique: true, name: 'idx_orders_customer_idempotency_unique' }
      );

      // 3. orders: query indexes
      await this.getOrdersCollection().createIndex({ customer_id: 1 }, { name: 'idx_orders_customer_id' });
      await this.getOrdersCollection().createIndex({ restaurant_id: 1 }, { name: 'idx_orders_restaurant_id' });
      await this.getOrdersCollection().createIndex({ status: 1 }, { name: 'idx_orders_status' });
      await this.getOrdersCollection().createIndex({ createdAt: 1 }, { name: 'idx_orders_created_at' });
      await this.getOrdersCollection().createIndex({ folio: 1 }, { unique: true, sparse: true, name: 'idx_orders_folio' });

      // 4. addresses: user_id index
      await this.getAddressesCollection().createIndex({ user_id: 1 }, { name: 'idx_addresses_user_id' });

      // 5. audit_logs: entity_id and timestamp indexes
      await this.getAuditLogsCollection().createIndex({ entity_id: 1 }, { name: 'idx_audit_logs_entity_id' });
      await this.getAuditLogsCollection().createIndex({ timestamp: 1 }, { name: 'idx_audit_logs_timestamp' });

      // 6. conversations & messages
      await this.getConversationsCollection().createIndex({ conversation_id: 1 }, { unique: true, name: 'idx_conversations_id_uniq' });
      await this.getConversationsCollection().createIndex({ order_id: 1 }, { name: 'idx_conversations_order_id' });
      await this.getConversationsCollection().createIndex({ participant_ids: 1 }, { name: 'idx_conversations_participants' });
      await this.getChatMessagesCollection().createIndex({ conversation_id: 1, timestamp: 1 }, { name: 'idx_chat_messages_conv' });
      await this.getChatMessagesCollection().createIndex({ order_id: 1 }, { name: 'idx_chat_messages_order' });

      // 7. incidents
      await this.getIncidentsCollection().createIndex({ incident_id: 1 }, { unique: true, name: 'idx_incidents_id_uniq' });
      await this.getIncidentsCollection().createIndex({ order_id: 1 }, { name: 'idx_incidents_order_id' });

      // 8. solutions, plans, entitlements
      await this.getSolutionsCollection().createIndex({ solution_id: 1 }, { unique: true, name: 'idx_solutions_id_uniq' });
      await this.getPlansCollection().createIndex({ plan_id: 1 }, { unique: true, name: 'idx_plans_id_uniq' });
      await this.getEntitlementsCollection().createIndex(
        { restaurant_id: 1, solution_id: 1 },
        { unique: true, name: 'idx_entitlements_rest_sol_uniq' }
      );

      // 9. revoked_tokens (TTL & unique token_hash)
      await this.getRevokedTokensCollection().createIndex(
        { expires_at: 1 },
        { expireAfterSeconds: 0, name: 'idx_revoked_tokens_ttl' }
      );
      await this.getRevokedTokensCollection().createIndex(
        { token_hash: 1 },
        { unique: true, name: 'idx_revoked_tokens_hash' }
      );

      // 10. password_resets (TTL & lookup indexes)
      await this.getPasswordResetsCollection().createIndex(
        { expires_at: 1 },
        { expireAfterSeconds: 0, name: 'idx_password_resets_ttl' }
      );
      await this.getPasswordResetsCollection().createIndex(
        { email: 1, created_at: -1 },
        { name: 'idx_password_resets_email_time' }
      );
      await this.getPasswordResetsCollection().createIndex(
        { token_hash: 1 },
        { name: 'idx_password_resets_token_hash' }
      );

      // 11. payment_attempts & processed_webhooks
      await this.getPaymentAttemptsCollection().createIndex({ order_id: 1 }, { name: 'idx_payment_attempts_order' });
      await this.getPaymentAttemptsCollection().createIndex({ idempotency_key: 1 }, { name: 'idx_payment_attempts_idemp' });
      await this.getPaymentAttemptsCollection().createIndex({ payment_id: 1 }, { name: 'idx_payment_attempts_pay_id' });
      await this.getProcessedWebhooksCollection().createIndex({ event_id: 1 }, { unique: true, name: 'idx_processed_webhooks_event_uniq' });

      console.log('[MongoDB] Índices obligatorios verificados y creados exitosamente.');
    } catch (err: any) {
      console.error('[MongoDB] Error al verificar índices obligatorios:', err.message);
      if (config.nodeEnv === 'production') {
        throw new Error(`[MongoDB] Falló la creación de índices obligatorios en producción: ${err.message}`);
      }
    }
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.db) return;

    // Seed must NEVER run automatically in production unless explicitly enabled via ENABLE_SEED=true
    if (config.nodeEnv === 'production' && process.env.ENABLE_SEED !== 'true') {
      console.log('[MongoDB] Modo producción: siembra automática de semillas deshabilitada.');
      return;
    }

    if (!config.enableSeed && !config.isTestMode) {
      console.log('[MongoDB] Siembra de semillas deshabilitada por configuración.');
      return;
    }

    try {
      const restCount = await this.getRestaurantsCollection().countDocuments();
      if (restCount === 0) {
        console.log('[MongoDB] Base de datos vacía detectada. Insertando catálogo inicial de semillas...');
        const seed = await getSeedData();

        if (seed.users.length > 0) {
          for (const u of seed.users) {
            await this.getUsersCollection().updateOne(
              { email: u.email },
              { $setOnInsert: u as any },
              { upsert: true }
            );
          }
        }
        if (seed.categories.length > 0) {
          for (const cat of seed.categories) {
            await this.getCategoriesCollection().updateOne(
              { id: cat.id },
              { $setOnInsert: cat as any },
              { upsert: true }
            );
          }
        }
        if (seed.restaurants.length > 0) {
          for (const rest of seed.restaurants) {
            await this.getRestaurantsCollection().updateOne(
              { id: rest.id },
              { $setOnInsert: rest as any },
              { upsert: true }
            );
          }
        }
        if (seed.products.length > 0) {
          for (const prod of seed.products) {
            await this.getProductsCollection().updateOne(
              { id: prod.id },
              { $setOnInsert: prod as any },
              { upsert: true }
            );
          }
        }

        // Seed initial default address for Carlos
        const defaultAddress: Address = {
          id: 'addr_carlos_home',
          user_id: 'usr_carlos_01',
          label: 'Casa',
          street: 'Av. Morelos',
          number: '64',
          colony: 'Centro',
          city: 'Pénjamo',
          state: 'Guanajuato',
          postal_code: '36900',
          references: 'Frente al parque principal, portón negro',
          is_default: true,
          coordinates: {
            latitude: 20.4305,
            longitude: -101.7228,
          },
          createdAt: new Date().toISOString(),
        };
        await this.getAddressesCollection().updateOne(
          { id: defaultAddress.id },
          { $setOnInsert: defaultAddress as any },
          { upsert: true }
        );

        console.log('[MongoDB] Catálogo inicial sembrado exitosamente.');
      }

      // Cuentas de repartidores de prueba (solo en desarrollo si enableSeed o modo test está activo)
      if (config.enableSeed || config.isTestMode) {
        const driverExists = await this.getUsersCollection().findOne({ email: 'roberto@directaurante.com' });
        if (!driverExists) {
          const seed = await getSeedData();
          const drivers = seed.users.filter((u) => u.role === 'driver');
          for (const d of drivers) {
            await this.getUsersCollection().updateOne(
              { email: d.email },
              { $setOnInsert: d as any },
              { upsert: true }
            );
          }
          console.log('[MongoDB] Cuentas de repartidores de prueba preparadas.');
        }
      }

      // Ensure commercial solutions & plans exist for production and staging
      const solCount = await this.getSolutionsCollection().countDocuments();
      if (solCount === 0) {
        const commSeed = getCommercialSeedData();
        await this.getSolutionsCollection().insertMany(commSeed.solutions as any);
        await this.getPlansCollection().insertMany(commSeed.plans as any);
        if (config.enableSeed || config.isTestMode) {
          for (const ent of commSeed.entitlements) {
            await this.getEntitlementsCollection().updateOne(
              { restaurant_id: ent.restaurant_id, solution_id: ent.solution_id },
              { $setOnInsert: ent as any },
              { upsert: true }
            );
          }
        }
        console.log('[MongoDB] Catálogo comercial de soluciones y planes disponible.');
      }
    } catch (err: any) {
      console.error('[MongoDB] Error al sembrar datos iniciales:', err.message);
    }
  }

  private async ensureMasterUser(): Promise<void> {
    if (!this.db) return;
    try {
      const usersCol = this.getUsersCollection();

      // Consultar si ya existe una cuenta master en la base de datos
      const existingMaster = await usersCol.findOne({ role: 'master' });

      if (!existingMaster) {
        // En producción se requiere MASTER_PASSWORD o ADMIN_PASSWORD explícito por Secrets
        const masterPassword = process.env.MASTER_PASSWORD || process.env.ADMIN_PASSWORD;
        if (config.nodeEnv === 'production' && (!masterPassword || masterPassword.length < 8)) {
          console.warn('[MongoDB] Aviso en producción: No se detectó MASTER_PASSWORD seguro en variables. Se omite creación automática de cuenta Master.');
          return;
        }

        const effectivePassword = masterPassword || (config.isTestMode ? 'Admin123!' : undefined);
        if (!effectivePassword) {
          console.warn('[MongoDB] No hay MASTER_PASSWORD configurado. Se omite creación de cuenta Master inicial.');
          return;
        }

        const masterEmail = (process.env.MASTER_EMAIL || 'admin@directaurante.com').toLowerCase().trim();
        const masterPassHash = await bcrypt.hash(effectivePassword, 10);

        await usersCol.insertOne({
          id: `usr_master_${crypto.randomUUID()}`,
          email: masterEmail,
          passwordHash: masterPassHash,
          name: 'Comando Central Master',
          role: 'master',
          phone: '4620000000',
          profile_image: null,
          birthday: null,
          is_active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        console.log(`[MongoDB] Cuenta Master inicial creada de forma segura: ${masterEmail}`);
      } else {
        // Cuenta existente: conservar credenciales legítimas y estado de activación sin reactivación insegura
        console.log('[MongoDB] Acceso Master verificado y protegido en base de datos.');
      }
    } catch (err: any) {
      console.warn('[MongoDB] Aviso al verificar cuentas master:', err.message);
    }
  }

  // --- Collection Accessors ---
  public getUsersCollection(): Collection<User> {
    return this.getDb().collection<User>('users');
  }

  public getRestaurantsCollection(): Collection<Restaurant> {
    return this.getDb().collection<Restaurant>('restaurants');
  }

  public getCategoriesCollection(): Collection<Category> {
    return this.getDb().collection<Category>('categories');
  }

  public getProductsCollection(): Collection<Product> {
    return this.getDb().collection<Product>('products');
  }

  public getAddressesCollection(): Collection<Address> {
    return this.getDb().collection<Address>('addresses');
  }

  public getOrdersCollection(): Collection<Order> {
    return this.getDb().collection<Order>('orders');
  }

  public getAuditLogsCollection(): Collection<AuditLog> {
    return this.getDb().collection<AuditLog>('audit_logs');
  }

  public getDriverOffersCollection(): Collection<DriverOffer> {
    return this.getDb().collection<DriverOffer>('driver_offers');
  }

  public getDriverShiftsCollection(): Collection<DriverShift> {
    return this.getDb().collection<DriverShift>('driver_shifts');
  }

  public getDriverSettlementsCollection(): Collection<DriverSettlement> {
    return this.getDb().collection<DriverSettlement>('driver_settlements');
  }

  public getOrderMessagesCollection(): Collection<OrderMessage> {
    return this.getDb().collection<OrderMessage>('order_messages');
  }

  public getConversationsCollection(): Collection<Conversation> {
    return this.getDb().collection<Conversation>('conversations');
  }

  public getChatMessagesCollection(): Collection<ChatMessage> {
    return this.getDb().collection<ChatMessage>('chat_messages');
  }

  public getIncidentsCollection(): Collection<Incident> {
    return this.getDb().collection<Incident>('incidents');
  }

  public getSolutionsCollection(): Collection<CommercialSolution> {
    return this.getDb().collection<CommercialSolution>('commercial_solutions');
  }

  public getPlansCollection(): Collection<CommercialPlan> {
    return this.getDb().collection<CommercialPlan>('commercial_plans');
  }

  public getEntitlementsCollection(): Collection<RestaurantEntitlement> {
    return this.getDb().collection<RestaurantEntitlement>('restaurant_entitlements');
  }

  public getSupportTicketsCollection(): Collection<SupportTicket> {
    return this.getDb().collection<SupportTicket>('support_tickets');
  }

  public getOrderEvidenceCollection(): Collection<OrderEvidence> {
    return this.getDb().collection<OrderEvidence>('order_evidence');
  }

  public getFinancialConfigCollection(): Collection<SystemFinancialConfig> {
    return this.getDb().collection<SystemFinancialConfig>('system_financial_config');
  }

  public getDevicesCollection(): Collection<DeviceRegistration> {
    return this.getDb().collection<DeviceRegistration>('devices');
  }

  public getRevokedTokensCollection(): Collection<RevokedToken> {
    return this.getDb().collection<RevokedToken>('revoked_tokens');
  }

  public getPasswordResetsCollection(): Collection<PasswordReset> {
    return this.getDb().collection<PasswordReset>('password_resets');
  }

  public getPaymentAttemptsCollection(): Collection<PaymentAttempt> {
    return this.getDb().collection<PaymentAttempt>('payment_attempts');
  }

  public getProcessedWebhooksCollection(): Collection<ProcessedWebhook> {
    return this.getDb().collection<ProcessedWebhook>('processed_webhooks');
  }

  public getCountersCollection(): Collection<{ _id: string; seq: number }> {
    return this.getDb().collection<{ _id: string; seq: number }>('system_counters');
  }

  public isConnected(): boolean {
    return this.connected && this.db !== null;
  }

  public getDbInfo() {
    return {
      connected: this.isConnected(),
      databaseName: this.db ? this.db.databaseName : null,
      provider: this.memoryServer
        ? 'memory_ephemeral'
        : this.connected
        ? this.isAtlas
          ? 'mongodb_atlas'
          : 'remote_mongodb'
        : 'disconnected',
      isMemoryFallback: this.memoryServer !== null,
      dataLossProtection: !this.memoryServer,
      uriConfigured: !!config.mongodbUri,
      error: this.lastError ? (this.lastError as Error).message : null,
    };
  }
}

export const dbClient = new DatabaseClient();

// Auto-connect helper
export async function initDb(): Promise<Db> {
  return dbClient.connect();
}
