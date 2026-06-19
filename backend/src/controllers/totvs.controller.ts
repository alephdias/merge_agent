import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, NotFoundError, ValidationError } from '../errors/AppError';
import * as totvsService from '../services/totvs.service';
import { compareTotvsVersions, loadComparativo, listComparativos } from '../services/compare.service';
import type { AuthUser } from '../types';
import type { UploadFonteInput } from '../schemas/fonte.schema';

function getUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const data = await totvsService.listTotvs();
  res.json(data);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const data = await totvsService.getTotvs(req.params['id'] as string);
  if (!data) throw new NotFoundError('Arquivo TOTVS não encontrado');
  res.json(data);
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw new Error('Arquivo não recebido');

  const result = await totvsService.uploadTotvs(
    file,
    req.body as UploadFonteInput,
    getUser(req),
  );

  res.status(result.deduplicado ? 200 : 201).json(result);
});

export const compare = asyncHandler(async (req: Request, res: Response) => {
  const { v1, v2 } = req.query as { v1?: string; v2?: string };
  if (!v1 || !v2) throw new ValidationError('Parâmetros v1 e v2 são obrigatórios');
  if (v1 === v2) throw new ValidationError('Selecione versões diferentes para comparar');
  const user = req.user;
  const result = await compareTotvsVersions(v1, v2, user?.id);
  res.json(result);
});

export const getCompare = asyncHandler(async (req: Request, res: Response) => {
  const result = await loadComparativo(req.params['id'] as string);
  res.json(result);
});

export const listCompare = asyncHandler(async (_req: Request, res: Response) => {
  const list = await listComparativos();
  res.json(list);
});

export const select = asyncHandler(async (req: Request, res: Response) => {
  const data = await totvsService.selectTotvs(req.params['id'] as string, getUser(req));
  res.json(data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await totvsService.deleteTotvs(req.params['id'] as string, getUser(req));
  res.status(204).send();
});
