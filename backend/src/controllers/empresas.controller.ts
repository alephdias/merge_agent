import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../errors/AppError';
import * as empresasService from '../services/empresas.service';
import type { AuthUser } from '../types';
import type { CreateEmpresaInput, UpdateEmpresaInput } from '../schemas/empresa.schema';

// Extrai req.user com garantia de tipo (authMiddleware já validou)


function getUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await empresasService.listEmpresas(getUser(req));
  res.json(data);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const data = await empresasService.getEmpresa(req.params['id'] as string, getUser(req));
  res.json(data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await empresasService.createEmpresa(
    req.body as CreateEmpresaInput,
    getUser(req),
  );
  res.status(201).json(data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await empresasService.updateEmpresa(
    req.params['id'] as string,
    req.body as UpdateEmpresaInput,
    getUser(req),
  );
  res.json(data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await empresasService.deleteEmpresa(req.params['id'] as string, getUser(req));
  res.status(204).end();
});
