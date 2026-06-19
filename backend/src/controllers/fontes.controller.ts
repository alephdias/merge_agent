import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../errors/AppError';
import * as fontesService from '../services/fontes.service';
import type { AuthUser } from '../types';
import type { UploadFonteInput } from '../schemas/fonte.schema';

function getEmpresaId(req: Request): string { return req.params['empresaId'] as string; }

function getUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await fontesService.listFontes(getEmpresaId(req), getUser(req));
  res.json(data);
});

export const select = asyncHandler(async (req: Request, res: Response) => {
  const data = await fontesService.selectFonte(req.params['id'] as string, getEmpresaId(req), getUser(req));
  res.json(data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await fontesService.deleteFonte(req.params['id'] as string, getEmpresaId(req), getUser(req));
  res.status(204).send();
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const empresaId = getEmpresaId(req);
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
