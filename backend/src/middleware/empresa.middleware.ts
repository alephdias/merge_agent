import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * Garante isolamento por empresa. empresa_id nunca vem do body — sempre do JWT.
 * Deve ser usado após authMiddleware. Admins (empresa_id = null) passam sem restrição.
 */
export function empresaMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  const userEmpresaId = req.user.empresa_id;
  if (userEmpresaId === null) {
    next();
    return;
  }
  const routeEmpresaId = req.params['empresaId'] ?? req.params['id'];
  if (routeEmpresaId && routeEmpresaId !== userEmpresaId) {
    next(new ForbiddenError('Acesso negado: dados de outra empresa'));
    return;
  }
  next();
}
