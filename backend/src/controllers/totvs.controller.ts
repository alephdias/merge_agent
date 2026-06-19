import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, NotFoundError } from '../errors/AppError';
import * as totvsService from '../services/totvs.service';
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

export const select = asyncHandler(async (req: Request, res: Response) => {
  const data = await totvsService.selectTotvs(req.params['id'] as string, getUser(req));
  res.json(data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await totvsService.deleteTotvs(req.params['id'] as string, getUser(req));
  res.status(204).send();
});
