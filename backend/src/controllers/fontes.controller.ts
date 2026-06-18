import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../errors/AppError';
import * as fontesService from '../services/fontes.service';
import type { AuthUser } from '../types';
import type { UploadFonteInput } from '../schemas/fonte.schema';

function getUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const empresaId = req.params['empresaId'] as string;
  const data = await fontesService.listFontes(empresaId, getUser(req));
  res.json(data);
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const empresaId = req.params['empresaId'] as string;
  const file = req.file;
  if (!file) throw new Error('Arquivo não recebido');

  const result = await fontesService.uploadFonte(
    empresaId,
    file,
    req.body as UploadFonteInput,
    getUser(req),
  );

  res.status(result.deduplicado ? 200 : 201).json(result);
});
