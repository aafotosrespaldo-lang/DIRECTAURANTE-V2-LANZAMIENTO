import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';
import { dbClient } from '../db/connection.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import type { PasswordReset, Restaurant, RevokedToken, User, UserPublicProfile, UserRole } from '../models/types.ts';
import type { LoginDto, PrivilegedUserDto, RegisterDto, UpdateProfileDto } from '../schemas/validation.ts';
import { AuditService } from './auditService.ts';
import { EmailService } from './emailService.ts';
import { FinancialConfigService } from './financialConfigService.ts';

export class AuthService {
  private static revokedTokensMemory = new Set<string>();
  private static resetAttemptsByIpOrEmail = new Map<string, { count: number; firstAttemptAt: number }>();

  public static async register(dto: RegisterDto): Promise<{ user: UserPublicProfile; token: string }> {
    const existing = await UserRepository.findByEmail(dto.email);
    if (existing) {
      throw new Error('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role: UserRole = dto.role || 'customer';
    const userId = `usr_${role}_${crypto.randomUUID()}`;

    const newUser: User = {
      id: userId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role,
      phone: dto.phone || '',
      profile_image: null,
      birthday: null,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (role === 'driver') {
      newUser.is_verified = false;
      newUser.driver_status = 'offline';
      newUser.vehicle_info = dto.vehicle_info || 'Motocicleta estándar';
      newUser.vehicle_type = (dto.vehicle_type as any) || 'motocicleta';
    }

    await UserRepository.create(newUser);

    if (role === 'restaurant') {
      const restId = `rest_${crypto.randomUUID().slice(0, 8)}`;
      const sysConfig = await FinancialConfigService.getConfig();
      const trialDays = sysConfig.default_trial_days || 15;
      const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

      const newRestaurant: Restaurant = {
        id: restId,
        owner_id: newUser.id,
        name: dto.restaurant_name || dto.name,
        description: 'Restaurante asociado a Directaurante',
        address: 'Pénjamo, Guanajuato',
        phone: dto.phone || '4620000000',
        logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=400&fit=crop&q=80',
        rating: 5.0,
        is_active: true,
        is_open: true,
        is_temporarily_closed: false,
        subscription_status: 'trial',
        trial_ends_at: trialEnd,
        delivery_fee: sysConfig.default_delivery_fee_cents || 2500,
        delivery_time_min: 20,
        delivery_time_max: 35,
        distance_km: 1.5,
        min_order: 5000,
        category_tags: ['Comida Local', 'Restaurante'],
        schedule: {
          monday: { isOpen: true, openTime: '13:00', closeTime: '23:00', raw: '13:00 - 23:00' },
          tuesday: { isOpen: true, openTime: '13:00', closeTime: '23:00', raw: '13:00 - 23:00' },
          wednesday: { isOpen: true, openTime: '13:00', closeTime: '23:00', raw: '13:00 - 23:00' },
          thursday: { isOpen: true, openTime: '13:00', closeTime: '23:30', raw: '13:00 - 23:30' },
          friday: { isOpen: true, openTime: '13:00', closeTime: '00:00', raw: '13:00 - 00:00' },
          saturday: { isOpen: true, openTime: '13:00', closeTime: '00:30', raw: '13:00 - 00:30' },
          sunday: { isOpen: true, openTime: '13:00', closeTime: '23:00', raw: '13:00 - 23:00' },
        },
        createdAt: new Date().toISOString(),
      };
      await RestaurantRepository.create(newRestaurant);
    }

    await AuditService.log('user.registered', 'user', newUser.id, { email: newUser.email, role }, newUser.id, role);

    const token = this.generateToken(newUser);
    return { user: this.toPublicProfile(newUser), token };
  }

  public static async createPrivilegedUser(
    dto: PrivilegedUserDto,
    actor?: { id: string; role: string }
  ): Promise<{ user: UserPublicProfile; token: string }> {
    if (actor && actor.role !== 'master') {
      throw new Error('Acceso denegado: solo el rol master puede crear usuarios con roles privilegiados');
    }

    const existing = await UserRepository.findByEmail(dto.email);
    if (existing) {
      throw new Error('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = `usr_${dto.role}_${crypto.randomUUID()}`;

    const newUser: User = {
      id: userId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      phone: dto.phone || '',
      profile_image: null,
      birthday: null,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await UserRepository.create(newUser);
    await AuditService.log(
      'user.privileged_created',
      'user',
      newUser.id,
      { email: newUser.email, role: newUser.role, created_by: actor?.id || 'seed' },
      actor?.id || 'system',
      actor?.role || 'master'
    );

    const token = this.generateToken(newUser);
    return { user: this.toPublicProfile(newUser), token };
  }

  public static async login(dto: LoginDto): Promise<{ user: UserPublicProfile; token: string }> {
    const cleanEmail = dto.email.toLowerCase().trim();

    const user = await UserRepository.findByEmail(cleanEmail);
    if (!user) {
      const err: any = new Error('Credenciales inválidas: correo no registrado');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      const err: any = new Error('Credenciales inválidas: contraseña incorrecta');
      err.statusCode = 401;
      throw err;
    }

    if (!user.is_active) {
      const err: any = new Error('La cuenta se encuentra desactivada o suspendida');
      err.statusCode = 403;
      throw err;
    }

    // Role check: master role has universal authority and can log in without expectedRole mismatch
    if (dto.expectedRole && user.role !== 'master') {
      if (user.role !== dto.expectedRole) {
        const roleLabels: Record<string, string> = {
          customer: 'Cliente',
          driver: 'Repartidor',
          restaurant: 'Restaurante',
          master: 'Master',
        };
        const err: any = new Error(
          `Acceso denegado: Esta cuenta tiene rol autorizado de '${roleLabels[user.role] || user.role}' y no cuenta con permisos para acceder como '${roleLabels[dto.expectedRole] || dto.expectedRole}'.`
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // Special verification requirement for driver operating readiness
    if (user.role === 'driver' && user.is_verified === false) {
      const err: any = new Error(
        'Tu cuenta de repartidor está en proceso de revisión y aún no ha sido autorizada para operar.'
      );
      err.statusCode = 403;
      throw err;
    }

    await AuditService.log('user.login', 'user', user.id, { email: user.email, role: user.role }, user.id, user.role);

    const token = this.generateToken(user);
    return { user: this.toPublicProfile(user), token };
  }

  public static generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      token_version: user.token_version || 1,
    };
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  }

  public static verifyToken(token: string): { id: string; email: string; role: UserRole; name: string; token_version?: number } {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (this.revokedTokensMemory.has(hash)) {
      const err: any = new Error('Sesión cerrada o token revocado');
      err.statusCode = 401;
      throw err;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      return decoded;
    } catch {
      const err: any = new Error('Token inválido o expirado');
      err.statusCode = 401;
      throw err;
    }
  }

  public static async isTokenRevoked(token: string, userId?: string, tokenVersion?: number): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (this.revokedTokensMemory.has(hash)) return true;

    try {
      const revoked = await dbClient.getRevokedTokensCollection().findOne({ token_hash: hash });
      if (revoked) {
        this.revokedTokensMemory.add(hash);
        return true;
      }

      if (userId && tokenVersion !== undefined) {
        const user = await UserRepository.findById(userId);
        if (!user || !user.is_active) return true;
        if (user.token_version && user.token_version > tokenVersion) {
          return true;
        }
      }
    } catch {
      // Non-fatal fallback
    }
    return false;
  }

  public static async revokeToken(token: string, userId?: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    this.revokedTokensMemory.add(hash);

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days matching JWT expiration
      await dbClient.getRevokedTokensCollection().updateOne(
        { token_hash: hash },
        {
          $setOnInsert: {
            token_hash: hash,
            user_id: userId || 'anonymous',
            revoked_at: new Date().toISOString(),
            expires_at: expiresAt,
          },
        },
        { upsert: true }
      );

      if (userId) {
        await AuditService.log('user.logout', 'user', userId, { token_revoked: true }, userId, 'user');
      }
    } catch (err: any) {
      console.warn('[AuthService] Error al persistir token revocado:', err.message);
    }
  }

  public static async revokeAllUserTokens(userId: string): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) return;
    const nextVersion = (user.token_version || 1) + 1;
    await UserRepository.update(userId, { token_version: nextVersion } as any);
    await AuditService.log('user.sessions_revoked', 'user', userId, { token_version: nextVersion }, userId, user.role);
  }

  // --- Password Recovery (Rate Limited & SHA-256 Hashed Tokens) ---
  public static checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): void {
    const now = Date.now();
    const entry = this.resetAttemptsByIpOrEmail.get(key);
    if (!entry || now - entry.firstAttemptAt > windowMs) {
      this.resetAttemptsByIpOrEmail.set(key, { count: 1, firstAttemptAt: now });
      return;
    }

    if (entry.count >= maxAttempts) {
      const err: any = new Error(
        'Has alcanzado el límite de solicitudes de recuperación. Por seguridad, espera 15 minutos antes de intentar de nuevo.'
      );
      err.statusCode = 429;
      throw err;
    }

    entry.count += 1;
  }

  public static async forgotPassword(email: string, clientIp?: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitKey = `${clientIp || 'client'}_${normalizedEmail}`;
    this.checkRateLimit(rateLimitKey);

    const genericMessage =
      'Si el correo electrónico está registrado, recibirás un mensaje con las instrucciones y el código para restablecer tu contraseña.';

    const user = await UserRepository.findByEmail(normalizedEmail);
    if (!user || !user.is_active) {
      return { success: true, message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetDoc: PasswordReset = {
      id: `rst_${crypto.randomUUID()}`,
      email: normalizedEmail,
      user_id: user.id,
      token_hash: tokenHash,
      code_hash: codeHash,
      attempts: 0,
      used: false,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    await dbClient.getPasswordResetsCollection().insertOne(resetDoc as any);

    await AuditService.log(
      'user.password_reset_requested',
      'user',
      user.id,
      { email: normalizedEmail, expires_at: expiresAt.toISOString() },
      user.id,
      user.role
    );

    // Send email using EmailService
    await EmailService.sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      rawToken,
      rawCode,
    });

    return { success: true, message: genericMessage };
  }

  public static async verifyResetToken(params: {
    token?: string;
    code?: string;
    email?: string;
  }): Promise<{ valid: boolean; email?: string }> {
    const { token, code, email } = params;
    if (!token && (!code || !email)) {
      return { valid: false };
    }

    const query: any = {
      used: false,
      expires_at: { $gt: new Date() },
    };

    if (token && token.trim()) {
      query.token_hash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    } else if (code && email && code.trim() && email.trim()) {
      query.code_hash = crypto.createHash('sha256').update(code.trim()).digest('hex');
      query.email = email.toLowerCase().trim();
    }

    const record = await dbClient.getPasswordResetsCollection().findOne(query);
    if (!record || record.attempts >= 5) {
      return { valid: false };
    }

    return { valid: true, email: record.email };
  }

  public static async resetPassword(params: {
    token?: string;
    code?: string;
    email?: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const { token, code, email, newPassword } = params;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      const err: any = new Error('La nueva contraseña debe tener al menos 6 caracteres');
      err.statusCode = 400;
      throw err;
    }

    const query: any = {
      used: false,
    };

    if (token && token.trim()) {
      query.token_hash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    } else if (code && email && code.trim() && email.trim()) {
      query.code_hash = crypto.createHash('sha256').update(code.trim()).digest('hex');
      query.email = email.toLowerCase().trim();
    } else {
      const err: any = new Error('Se requiere un token válido o un código con correo electrónico');
      err.statusCode = 400;
      throw err;
    }

    const record = await dbClient.getPasswordResetsCollection().findOne(query);
    if (!record) {
      const err: any = new Error('El enlace o código de recuperación es inválido o ya ha sido utilizado.');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(record.expires_at) < new Date()) {
      const err: any = new Error('El enlace o código de recuperación ha expirado. Solicita uno nuevo.');
      err.statusCode = 400;
      throw err;
    }

    if (record.attempts >= 5) {
      const err: any = new Error('Se ha superado el número de intentos permitidos. Solicita un nuevo código.');
      err.statusCode = 429;
      throw err;
    }

    // Invalidate reset record immediately
    await dbClient.getPasswordResetsCollection().updateOne(
      { _id: (record as any)._id },
      { $set: { used: true, used_at: new Date().toISOString() } }
    );

    const user = await UserRepository.findById(record.user_id);
    if (!user) {
      const err: any = new Error('Usuario asociado no encontrado');
      err.statusCode = 404;
      throw err;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (user.token_version || 1) + 1;

    await UserRepository.update(user.id, {
      passwordHash: newPasswordHash,
      token_version: nextTokenVersion,
      updatedAt: new Date().toISOString(),
    } as any);

    await AuditService.log(
      'user.password_reset_completed',
      'user',
      user.id,
      { email: user.email, token_version_bumped: nextTokenVersion },
      user.id,
      user.role
    );

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente. Todas las sesiones anteriores han sido revocadas.',
    };
  }

  public static async getProfile(userId: string): Promise<UserPublicProfile | null> {
    const user = await UserRepository.findById(userId);
    if (!user) return null;
    return this.toPublicProfile(user);
  }

  public static async updateProfile(userId: string, dto: UpdateProfileDto & { vehicle_info?: string }): Promise<UserPublicProfile> {
    const existing = await UserRepository.findById(userId);
    if (!existing) {
      throw new Error('Usuario no encontrado');
    }

    if (existing.role === 'master') {
      throw new Error('El perfil de cuenta Master no puede ser modificado por autogestión');
    }

    const updates: Partial<User> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.phone !== undefined) updates.phone = dto.phone.trim();
    if (dto.profile_image !== undefined) updates.profile_image = dto.profile_image;
    if (dto.birthday !== undefined) updates.birthday = dto.birthday;
    if (dto.vehicle_info !== undefined && existing.role === 'driver') {
      updates.vehicle_info = dto.vehicle_info.trim();
    }
    if ((dto as any).vehicle_type !== undefined && existing.role === 'driver') {
      updates.vehicle_type = (dto as any).vehicle_type;
    }
    if ((dto as any).documents !== undefined && existing.role === 'driver') {
      updates.documents = {
        ...(existing.documents || {}),
        ...(dto as any).documents,
      };
    }

    const updated = await UserRepository.update(userId, updates);
    if (!updated) throw new Error('Error al actualizar usuario');

    await AuditService.log('user.profile_updated', 'user', userId, updates, userId, existing.role);

    try {
      const { RealtimeService } = await import('./realtimeService.ts');
      RealtimeService.emit({
        type: 'PROFILE_UPDATED',
        customer_id: userId,
        data: this.toPublicProfile(updated),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    return this.toPublicProfile(updated);
  }

  public static toPublicProfile(user: User): UserPublicProfile & {
    vehicle_info?: string;
    vehicle_type?: string;
    documents?: any;
    driver_status?: string;
    is_verified?: boolean;
  } {
    const base: any = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      profile_image: user.profile_image,
      birthday: user.birthday,
      is_active: user.is_active,
    };
    if (user.role === 'driver') {
      base.vehicle_info = user.vehicle_info;
      base.vehicle_type = user.vehicle_type;
      base.documents = user.documents;
      base.driver_status = user.driver_status;
      base.is_verified = user.is_verified;
    }
    return base;
  }
}
