import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { validateForgotPassword, validateLogin, validateRegister, validateResetPassword } from '../schemas/validation.ts';
import { AuthService } from '../services/authService.ts';

const router = Router();

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const validation = validateRegister(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await AuthService.register(validation.data);
    res.status(201).json({
      success: true,
      token: result.token,
      access_token: result.token,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const validation = validateLogin(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await AuthService.login(validation.data);
    res.json({
      success: true,
      token: result.token,
      access_token: result.token,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const profile = await AuthService.getProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({
      success: true,
      user: profile,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /auth/profile or PUT /users/me
router.put('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await AuthService.updateProfile(req.user!.id, req.body);
    res.json({
      success: true,
      user: updated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout (Revokes token on server)
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const decoded = AuthService.verifyToken(token);
      await AuthService.revokeToken(token, decoded?.id);
    } catch {
      await AuthService.revokeToken(token);
    }
  }
  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente',
  });
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const validation = validateForgotPassword(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const result = await AuthService.forgotPassword(validation.data.email, clientIp);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-reset-token
router.post('/verify-reset-token', async (req, res, next) => {
  try {
    const { token, code, email } = req.body;
    const result = await AuthService.verifyResetToken({ token, code, email });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const validation = validateResetPassword(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await AuthService.resetPassword(validation.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
