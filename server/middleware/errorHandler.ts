import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const statusCode =
    err.status ||
    err.statusCode ||
    (err.type === 'entity.too.large' ? 413 : undefined) ||
    (err.message?.includes('no encontrado')
      ? 404
      : err.message?.includes('Credenciales')
      ? 401
      : 400);

  if (statusCode >= 500) {
    console.error(`[Server Error 500] ${req.method} ${req.path}:`, err.message || err);
  } else {
    console.warn(`[Client ${statusCode}] ${req.method} ${req.path}:`, err.message || err);
  }

  const errorMessage =
    err.type === 'entity.too.large' || statusCode === 413
      ? 'La imagen o el archivo supera el límite permitido. Se recomienda una imagen más ligera o comprimida.'
      : err.message || 'Error interno del servidor en Core V2';

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
  });
}
