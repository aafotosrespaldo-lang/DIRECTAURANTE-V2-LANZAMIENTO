import crypto from 'crypto';
import { getJwtSecret } from '../config/index.ts';

/**
 * Derives a consistent 32-byte (256-bit) encryption key from the environment.
 * Accepts:
 * - 64-character hex string (32 raw bytes)
 * - 44-character Base64 string (32 raw bytes)
 * - Or arbitrary secret string hashed via SHA-256 to 32 bytes
 */
function getEncryptionKey(): Buffer {
  const secret = (process.env.PAYMENT_ENCRYPTION_KEY || '').trim() || getJwtSecret();
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  if (/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
    const b = Buffer.from(secret, 'base64');
    if (b.length === 32) return b;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive tokens (OAuth tokens, refresh tokens) using AES-256-GCM.
 * Never stores plain access tokens in MongoDB.
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts tokens encrypted with AES-256-GCM.
 */
export function decryptToken(encryptedString: string): string {
  if (!encryptedString) return '';
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    // If not formatted as encrypted string (e.g. legacy/mock in development), return as is
    return encryptedString;
  }

  const [ivB64, authTagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encryptedText = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a signed, tamper-proof and expiring state parameter for OAuth CSRF protection.
 * Format: payload.signature (hex)
 */
export function generateOAuthState(restaurantId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const payload = Buffer.from(JSON.stringify({ restaurantId, nonce, timestamp })).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', getJwtSecret());
  hmac.update(payload);
  const signature = hmac.digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Validates the state parameter returned by Mercado Pago OAuth callback.
 * Checks HMAC signature, expiration (max 15 mins), and matching restaurantId.
 */
export function verifyOAuthState(
  state: string,
  expectedRestaurantId?: string
): { valid: boolean; restaurantId?: string; error?: string } {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'Parámetro state ausente o inválido' };
  }

  const parts = state.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Formato de state CSRF incorrecto' };
  }

  const [payloadB64, signature] = parts;
  const hmac = crypto.createHmac('sha256', getJwtSecret());
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    );
    if (!isSigValid) {
      return { valid: false, error: 'Firma de seguridad de state inválida (posible ataque CSRF)' };
    }
  } catch {
    return { valid: false, error: 'Falla en verificación criptográfica de state' };
  }

  try {
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const { restaurantId, timestamp } = data;

    // Check expiration (15 minutes)
    const MAX_AGE_MS = 15 * 60 * 1000;
    if (Date.now() - timestamp > MAX_AGE_MS) {
      return { valid: false, error: 'El estado de autenticación OAuth ha expirado. Por favor inicia nuevamente el enlace.' };
    }

    if (expectedRestaurantId && restaurantId !== expectedRestaurantId) {
      return { valid: false, error: 'El restaurante del state no coincide con el restaurante autenticado' };
    }

    return { valid: true, restaurantId };
  } catch {
    return { valid: false, error: 'Error al decodificar la carga útil de state' };
  }
}

/**
 * Verifies Mercado Pago Webhook signature according to official specification:
 * Header x-signature: "ts=...,v1=..."
 * Header x-request-id: "..."
 * Template to sign: "id:[data.id];request-id:[x-request-id];ts:[ts];"
 */
export function verifyMercadoPagoWebhookSignature(params: {
  xSignature?: string;
  xRequestId?: string;
  dataId: string;
  secret: string;
}): { valid: boolean; reason?: string } {
  const { xSignature, xRequestId, dataId, secret } = params;

  if (!secret) {
    return { valid: false, reason: 'MP_WEBHOOK_SECRET no configurado en el servidor' };
  }

  if (!xSignature || !xRequestId || !dataId) {
    return { valid: false, reason: 'Cabeceras de firma requeridas ausentes (x-signature, x-request-id o data.id)' };
  }

  // Parse ts and v1 from x-signature: "ts=1700000000,v1=abcdef..."
  const parts = xSignature.split(',').reduce((acc: Record<string, string>, item) => {
    const [k, v] = item.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const ts = parts['ts'];
  const hashV1 = parts['v1'];

  if (!ts || !hashV1) {
    return { valid: false, reason: 'Formato de cabecera x-signature inválido (faltan ts o v1)' };
  }

  // Replay attack prevention: max 10 minutes drift
  const tsNum = parseInt(ts, 10);
  if (isNaN(tsNum)) {
    return { valid: false, reason: 'Timestamp de firma no numérico' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = Math.abs(nowSec - tsNum);
  if (diffSec > 600) { // 10 minutes
    return { valid: false, reason: `Timestamp desfasado por ${diffSec} segundos (posible replay attack)` };
  }

  // Construct official manifest template: "id:[data.id];request-id:[x-request-id];ts:[ts];"
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const calculatedHash = hmac.digest('hex');

  try {
    const calculatedBuffer = Buffer.from(calculatedHash, 'utf8');
    const receivedBuffer = Buffer.from(hashV1, 'utf8');

    if (calculatedBuffer.length !== receivedBuffer.length) {
      return { valid: false, reason: 'Longitud de firma no coincide' };
    }

    const matches = crypto.timingSafeEqual(calculatedBuffer, receivedBuffer);
    if (!matches) {
      return { valid: false, reason: 'Firma criptográfica inválida' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Error al comparar firmas: ${err.message}` };
  }
}

/**
 * Recursively removes secrets, card details, and tokens from any object before audit logging.
 */
export function sanitizeLogData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeLogData);

  const sensitiveKeys = new Set([
    'access_token',
    'refresh_token',
    'client_secret',
    'secret',
    'password',
    'passwordHash',
    'card_number',
    'security_code',
    'cvv',
    'cvc',
    'token',
    'public_key',
    'authorization',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeLogData(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}
