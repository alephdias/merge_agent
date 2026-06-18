import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;
  const context = { requestId, method: req.method, url: req.url };

  if (err instanceof ValidationError) {
    logger.warn({ ...context, details: err.details }, err.message);
    res.status(400).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ ...context, statusCode: err.statusCode }, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Erro de programação — nunca expor ao cliente em produção
  logger.error({ err, ...context }, 'Erro interno não tratado');

  const message =
    env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err instanceof Error
        ? err.message
        : String(err);

  res.status(500).json({ error: message });
}
