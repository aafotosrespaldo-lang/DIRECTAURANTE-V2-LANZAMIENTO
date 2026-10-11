import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.ts';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { MercadoPagoService } from '../services/mercadoPagoService.ts';
import { RestaurantRepository } from '../repositories/restaurantRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { config } from '../config/index.ts';

const router = Router();

// ==========================================
// PUBLIC CONFIGURATION & WEBHOOK ENDPOINTS
// ==========================================

/**
 * GET /payments/mercadopago/config
 * Exposes non-sensitive public configuration (public key, mode) to frontend.
 */
router.get('/mercadopago/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      mode: config.mpMode,
      public_key: config.mpPublicKey || '',
      is_configured: Boolean(config.mpClientId && config.mpClientSecret),
    },
  });
});

/**
 * POST /payments/mercadopago/webhook
 * Public endpoint for Mercado Pago Webhook / IPN notifications.
 * Validates HMAC signature, fetches authoritative resource from MP,
 * processes status idempotently, and prevents terminal state regressions.
 */
router.post('/mercadopago/webhook', async (req: Request, res: Response) => {
  try {
    const result = await MercadoPagoService.processWebhookNotification({
      headers: req.headers,
      query: req.query,
      body: req.body,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Error al procesar notificación de webhook',
    });
  }
});

// ==========================================
// RESTAURANT OAUTH ENDPOINTS
// ==========================================

/**
 * GET /restaurant/mercadopago/callback (Public redirect handler from Mercado Pago OAuth)
 * Handles callback when a restaurant owner finishes OAuth on Mercado Pago.
 */
router.get('/restaurant/mercadopago/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; background: #0a0f30; color: #fff; text-align: center; padding: 40px;">
            <h2>Error de vinculación</h2>
            <p>Faltan parámetros requeridos (code o state).</p>
            <a href="/" style="color: #FFD318;">Volver a Directaurante</a>
          </body>
        </html>
      `);
    }

    const result = await MercadoPagoService.handleOAuthCallback({ code, state });

    // If browser redirect request, show friendly confirmation and redirect back to portal
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cuenta Vinculada - Directaurante</title>
            <meta http-equiv="refresh" content="3;url=/?view=restaurant_portal&tab=settings&mp_connected=true" />
          </head>
          <body style="font-family: sans-serif; background: #06091e; color: #fff; text-align: center; padding: 60px 20px;">
            <div style="max-width: 450px; margin: 0 auto; background: #0a0f30; border: 1px solid #FFD318; border-radius: 20px; padding: 30px;">
              <h2 style="color: #FFD318; margin-bottom: 10px;">¡Cuenta Vinculada con Éxito!</h2>
              <p style="color: #cbd5e1; font-size: 14px;">Tu cuenta de Mercado Pago (ID: ${result.collectorId}) está conectada a Directaurante Marketplace.</p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Redirigiendo a tu panel en 3 segundos...</p>
              <a href="/?view=restaurant_portal&tab=settings&mp_connected=true" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #05268F; color: #FFD318; font-weight: bold; border-radius: 12px; text-decoration: none;">Ir al Panel Ahora</a>
            </div>
          </body>
        </html>
      `);
    }

    res.json({
      success: true,
      message: 'Cuenta de Mercado Pago vinculada exitosamente',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Error en el flujo de callback OAuth',
    });
  }
});

// ==========================================
// AUTHENTICATED ENDPOINTS (Orders & Portal)
// ==========================================

router.use(authMiddleware);

/**
 * POST /payments/mercadopago/preference/:orderId
 * Generates a Checkout Pro preference with Marketplace Fee for a customer order.
 * Validates ownership, pending status, and frozen Core amount.
 */
router.post('/mercadopago/preference/:orderId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const orderId = req.params.orderId;
    const customerId = req.user!.id;
    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string) ||
      req.body.idempotency_key ||
      `idemp_pref_${orderId}`;

    const preferenceResult = await MercadoPagoService.createPaymentPreference({
      orderId,
      customerId,
      idempotencyKey,
    });

    res.status(preferenceResult.is_duplicate ? 200 : 201).json({
      success: true,
      data: preferenceResult,
      message: preferenceResult.is_duplicate
        ? 'Preferencia preexistente recuperada por clave de idempotencia'
        : 'Preferencia de pago generada exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payments/mercadopago/process
 * Processes a direct payment submitted from Mercado Pago Brick or card token.
 * Validates ownership, pending status, sovereign Core amount, and idempotency.
 */
router.post('/mercadopago/process', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    const body = req.body || {};
    const formData = body.formData || body;
    const orderId = body.order_id || formData.order_id || body.orderId || formData.orderId;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'order_id es requerido para procesar el pago' });
    }

    const token = formData.token || body.token;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token de pago es requerido' });
    }

    if (config.nodeEnv === 'production' && (token.startsWith('mock_') || token.includes('mock'))) {
      return res.status(400).json({
        success: false,
        error: 'Tokens de pago simulados ("mock_") están prohibidos en producción. Se requiere token auténtico de tarjeta.',
      });
    }

    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string) ||
      body.idempotency_key ||
      formData.idempotency_key ||
      `pay_proc_${orderId}_${token.slice(-8)}`;

    const result = await MercadoPagoService.processPayment({
      orderId,
      customerId: user.id,
      token,
      paymentMethodId: formData.payment_method_id || formData.paymentMethodId || body.payment_method_id || 'visa',
      issuerId: formData.issuer_id || formData.issuerId || body.issuer_id,
      installments: Number(formData.installments || body.installments || 1),
      payerEmail: formData.payer?.email || body.payer?.email || user.email,
      payerIdentification: formData.payer?.identification || body.payer?.identification,
      idempotencyKey,
    });

    res.status(result.is_duplicate ? 200 : 201).json({
      success: true,
      data: result,
      message: result.status === 'approved' ? 'Pago aprobado exitosamente' : `Estado del pago: ${result.status}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /restaurant/mercadopago/auth-url
 * Generates OAuth connection URL for a restaurant seller.
 * Role: restaurant (owner) or master.
 */
router.get('/restaurant/mercadopago/auth-url', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    if (user.role !== 'master' && (user.role as any) !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: la configuración de Mercado Pago está restringida exclusivamente a la administración Master',
      });
    }

    const restaurantId = (req.query.restaurant_id as string) || 'rest_tacos_guero';
    const authData = MercadoPagoService.getOAuthAuthorizationUrl(restaurantId);

    res.json({
      success: true,
      data: authData,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /restaurant/mercadopago/status
 * Returns non-sensitive connection status of a restaurant seller account.
 * Role: Master / Admin only.
 */
router.get('/restaurant/mercadopago/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    if (user.role !== 'master' && (user.role as any) !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: la configuración de Mercado Pago está restringida exclusivamente a la administración Master',
      });
    }

    const restaurantId = (req.query.restaurant_id as string) || 'rest_tacos_guero';
    const status = await MercadoPagoService.getAccountStatus(restaurantId);

    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /restaurant/mercadopago/disconnect
 * Disconnects a restaurant seller account securely.
 * Role: Master / Admin only.
 */
router.post('/restaurant/mercadopago/disconnect', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    if (user.role !== 'master' && (user.role as any) !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: la desvinculación de Mercado Pago está restringida exclusivamente a la administración Master',
      });
    }

    const restaurantId = (req.body.restaurant_id as string) || 'rest_tacos_guero';
    await MercadoPagoService.disconnectAccount(restaurantId, {
      id: user.id,
      role: user.role,
    });

    res.json({
      success: true,
      message: 'Cuenta de Mercado Pago desvinculada exitosamente',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /payments/mercadopago/payment/:paymentId
 * Queries payment resource status (for user who owns order or master).
 */
router.get('/mercadopago/payment/:paymentId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const paymentId = req.params.paymentId;
    const user = req.user!;

    const payment = await MercadoPagoService.fetchPaymentFromMercadoPago(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Pago no encontrado en Mercado Pago' });
    }

    // Authorization check: master, customer owning the order, or restaurant owning the order
    if (user.role !== 'master') {
      const order = await OrderRepository.findById(payment.external_reference);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Pedido asociado al pago no encontrado' });
      }

      if (user.role === 'customer') {
        if (order.customer_id !== user.id) {
          return res.status(403).json({ success: false, error: 'Acceso denegado a este recurso de pago' });
        }
      } else if (user.role === 'restaurant') {
        const restaurant = await RestaurantRepository.findByOwnerId(user.id);
        if (!restaurant || order.restaurant_id !== restaurant.id) {
          return res.status(403).json({
            success: false,
            error: 'Acceso denegado: solo puedes consultar pagos correspondientes a pedidos de tu propio restaurante',
          });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Acceso denegado a este recurso de pago' });
      }
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
