import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

type Location = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, location: Location = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      next(new ValidationError('Dados inválidos', formatZodError(result.error)));
      return;
    }
    (req as Request & Record<string, unknown>)[location] = result.data;
    next();
  };
}

function formatZodError(err: ZodError): Record<string, string[]> {
  return err.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const path = issue.path.join('.') || '_root';
    acc[path] = [...(acc[path] ?? []), issue.message];
    return acc;
  }, {});
}
