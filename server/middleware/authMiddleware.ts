import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.ts';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    token_version?: number;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado: Token no proporcionado',
    });
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = AuthService.verifyToken(token);
    const isRevoked = await AuthService.isTokenRevoked(token, decoded.id, decoded.token_version);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Sesión revocada o cerrada. Inicia sesión nuevamente.',
      });
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Token inválido o expirado',
    });
  }
}

export async function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const decoded = AuthService.verifyToken(token);
      const isRevoked = await AuthService.isTokenRevoked(token, decoded.id, decoded.token_version);
      if (!isRevoked) {
        req.user = decoded;
      }
    } catch {
      // Ignore optional auth failure
    }
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticación requerida' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado: se requiere uno de los roles [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}
