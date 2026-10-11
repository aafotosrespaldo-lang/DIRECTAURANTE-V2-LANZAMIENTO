import dotenv from 'dotenv';
dotenv.config({ override: true });

function cleanEnvStr(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

function cleanMongoUri(val?: string): string | undefined {
  if (!val) return undefined;
  let clean = val.trim().replace(/^["']|["']$/g, '');
  if (!clean) return undefined;
  // Automatically strip accidental angle brackets from password:
  // e.g. mongodb+srv://user:<my_password>@... -> mongodb+srv://user:my_password@...
  clean = clean.replace(/:\/\/([^:]+):<([^>]+)>@/, '://$1:$2@');
  return clean;
}

const INSECURE_JWT_SECRETS = new Set([
  'directaurante-core-v2-dev-secret-key',
  'directaurante-core-v2-production-key-2026',
  'secret',
  'jwtsecret',
  'changeme',
  'change-me',
  '123456',
  'admin',
]);

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 16 || INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
      throw new Error(
        'Error de seguridad crítico: JWT_SECRET es obligatorio en producción y debe ser seguro. Directaurante Core V2 no puede iniciar sin una clave JWT explícita y robusta.'
      );
    }
    return secret;
  }
  return secret || 'directaurante-core-v2-dev-secret-key';
}

export const config = {
  // If running directly in Cloud Run (no NGINX_PORT present), honor process.env.PORT.
  // In AI Studio dev container (where NGINX proxies to 3000), use APP_PORT / DEFAULT_APP_PORT / 3000.
  port: parseInt(
    process.env.NGINX_PORT
      ? (process.env.APP_PORT || process.env.DEFAULT_APP_PORT || '3000')
      : (process.env.PORT || process.env.APP_PORT || '3000'),
    10
  ),
  apiPort: parseInt(process.env.CORE_PORT || '3001', 10),
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get jwtSecret() {
    return getJwtSecret();
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  get mongodbUri(): string {
    const raw =
      cleanMongoUri(process.env.MONGODB_URI) ||
      cleanMongoUri(process.env.MONGODB_URL) ||
      cleanMongoUri(process.env.MONGO_URI) ||
      cleanMongoUri(process.env.MONGO_URL) ||
      cleanMongoUri(process.env.ATLAS_URI) ||
      cleanMongoUri(process.env.MONGODB_ATLAS_URI);

    if (process.env.NODE_ENV === 'production') {
      if (!raw) {
        throw new Error(
          'Error de seguridad crítico: MONGODB_URI es obligatorio en producción y debe configurarse mediante Secrets. Directaurante Core V2 no puede iniciar sin una base de datos persistente.'
        );
      }
    }

    return raw || '';
  },
  get mongodbDbName(): string {
    return cleanEnvStr(process.env.MONGODB_DB_NAME) || 'directaurante';
  },
  get allowMemoryFallback(): boolean {
    if (process.env.ALLOW_MEMORY_FALLBACK !== undefined) {
      return process.env.ALLOW_MEMORY_FALLBACK === 'true';
    }
    // In development/preview environments, allow fallback to memory so the app never crashes if remote DB is down
    return process.env.NODE_ENV !== 'production';
  },
  isTestMode:
    process.env.NODE_ENV === 'test' ||
    process.env.TEST_MODE === 'true' ||
    process.argv.some((arg) => arg.includes('.test.') || arg.includes('test:')),
  corsOrigin: process.env.CORS_ORIGIN || '',
  get enableSeed(): boolean {
    return cleanEnvStr(process.env.ENABLE_SEED).toLowerCase() === 'true';
  },
  defaultCurrency: 'MXN',
  serviceFeeCents: 0, // $0.00 MXN - El cliente no paga tarifa de servicio
  defaultDeliveryFeeCents: 2500, // $25.00 MXN

  // Mercado Pago Marketplace Configuration
  _appUrl: undefined as string | undefined,
  get appUrl(): string {
    return this._appUrl !== undefined ? this._appUrl : cleanEnvStr(process.env.APP_URL);
  },
  set appUrl(v: string) {
    this._appUrl = v;
  },

  get mpMode(): 'sandbox' | 'production' {
    const raw = cleanEnvStr(process.env.MP_MODE).toLowerCase();
    // Conserva sandbox para pruebas y nunca actives cobros reales automáticamente
    if (raw === 'production') return 'production';
    return 'sandbox';
  },

  _mpClientId: undefined as string | undefined,
  get mpClientId(): string {
    return this._mpClientId !== undefined ? this._mpClientId : cleanEnvStr(process.env.MP_CLIENT_ID);
  },
  set mpClientId(v: string) {
    this._mpClientId = v;
  },

  _mpClientSecret: undefined as string | undefined,
  get mpClientSecret(): string {
    return this._mpClientSecret !== undefined ? this._mpClientSecret : cleanEnvStr(process.env.MP_CLIENT_SECRET);
  },
  set mpClientSecret(v: string) {
    this._mpClientSecret = v;
  },

  _mpPlatformAccessToken: undefined as string | undefined,
  get mpPlatformAccessToken(): string {
    return this._mpPlatformAccessToken !== undefined ? this._mpPlatformAccessToken : cleanEnvStr(process.env.MP_PLATFORM_ACCESS_TOKEN);
  },
  set mpPlatformAccessToken(v: string) {
    this._mpPlatformAccessToken = v;
  },

  _mpPublicKey: undefined as string | undefined,
  get mpPublicKey(): string {
    return this._mpPublicKey !== undefined ? this._mpPublicKey : cleanEnvStr(process.env.MP_PUBLIC_KEY);
  },
  set mpPublicKey(v: string) {
    this._mpPublicKey = v;
  },

  _mpWebhookSecret: undefined as string | undefined,
  get mpWebhookSecret(): string {
    return this._mpWebhookSecret !== undefined ? this._mpWebhookSecret : cleanEnvStr(process.env.MP_WEBHOOK_SECRET);
  },
  set mpWebhookSecret(v: string) {
    this._mpWebhookSecret = v;
  },

  _mpRedirectUri: undefined as string | undefined,
  get mpRedirectUri(): string {
    if (this._mpRedirectUri !== undefined) return this._mpRedirectUri;
    const raw = cleanEnvStr(process.env.MP_REDIRECT_URI);
    if (raw && !raw.includes('localhost')) return raw;
    if (this.appUrl && this.appUrl.startsWith('http')) {
      return `${this.appUrl}/api/restaurant/mercadopago/callback`;
    }
    return raw || 'http://localhost:3000/api/restaurant/mercadopago/callback';
  },
  set mpRedirectUri(v: string) {
    this._mpRedirectUri = v;
  },

  _mpWebhookUrl: undefined as string | undefined,
  get mpWebhookUrl(): string {
    if (this._mpWebhookUrl !== undefined) return this._mpWebhookUrl;
    const raw = cleanEnvStr(process.env.MP_WEBHOOK_URL);
    if (raw && !raw.includes('localhost')) return raw;
    if (this.appUrl && this.appUrl.startsWith('http')) {
      return `${this.appUrl}/api/payments/mercadopago/webhook`;
    }
    return raw || 'http://localhost:3000/api/payments/mercadopago/webhook';
  },
  set mpWebhookUrl(v: string) {
    this._mpWebhookUrl = v;
  },

  /**
   * Validates Mercado Pago environment settings without logging secrets or credentials.
   * In production, halts startup if mandatory variables are missing or if MP_MODE and credentials are incompatible.
   */
  validatePaymentConfig(): { isConfigured: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const isProd = process.env.NODE_ENV === 'production';

    const missingVars: string[] = [];
    if (!this.mpClientId) missingVars.push('MP_CLIENT_ID');
    if (!this.mpClientSecret) missingVars.push('MP_CLIENT_SECRET');
    if (!this.mpPlatformAccessToken) missingVars.push('MP_PLATFORM_ACCESS_TOKEN');
    if (!this.mpWebhookSecret) missingVars.push('MP_WEBHOOK_SECRET');

    // Validación de compatibilidad entre MP_MODE y el prefijo de credenciales
    const token = this.mpPlatformAccessToken || '';
    const pubKey = this.mpPublicKey || '';
    const isTestToken = token.startsWith('TEST-');
    const isProdToken = token.startsWith('APP_USR-');
    const isTestPubKey = pubKey.startsWith('TEST-');
    const isProdPubKey = pubKey.startsWith('APP_USR-');

    let modeMismatch: string | null = null;
    if (this.mpMode === 'production') {
      if (isTestToken || isTestPubKey) {
        modeMismatch = 'MP_MODE está configurado en "production" pero se detectaron credenciales de pruebas (TEST-).';
      }
    } else if (this.mpMode === 'sandbox') {
      if (isProdToken || isProdPubKey) {
        modeMismatch = 'MP_MODE está configurado en "sandbox" pero se detectaron credenciales de producción real (APP_USR-).';
      }
    }

    if (isProd) {
      if (missingVars.length > 0) {
        throw new Error(
          `Error de seguridad crítico: Faltan variables obligatorias de Mercado Pago en producción: [${missingVars.join(', ')}]. Directaurante Core V2 detiene el arranque.`
        );
      }
      if (modeMismatch) {
        throw new Error(
          `Error de seguridad crítico: Incompatibilidad de credenciales de Mercado Pago: ${modeMismatch} Directaurante Core V2 detiene el arranque para prevenir cobros erróneos o fallos en pasarela.`
        );
      }
    }

    if (missingVars.length > 0) {
      warnings.push(...missingVars.map((v) => `${v} no configurado`));
    }
    if (modeMismatch) {
      warnings.push(modeMismatch);
    }

    if (!isProd && warnings.length > 0) {
      console.log(`[Mercado Pago] Inicializado en modo Sandbox/Simulado para pruebas. Variables pendientes: ${missingVars.length}`);
    } else {
      console.log(`[Mercado Pago] Servicio inicializado correctamente en modo ${this.mpMode.toUpperCase()}`);
    }

    return {
      isConfigured: missingVars.length === 0 && !modeMismatch,
      warnings,
    };
  },
};

