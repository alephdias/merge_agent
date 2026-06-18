import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError, NotFoundError } from '../errors/AppError';
import * as mergeService from '../services/merge.service';
import type { AuthUser } from '../types';
import type { CreateMergeInput } from '../schemas/merge.schema';

function getUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const empresaId = typeof req.query['empresa_id'] === 'string' ? req.query['empresa_id'] : undefined;
  const data = await mergeService.listMergeJobs(getUser(req), empresaId);
  res.json(data);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const data = await mergeService.getMergeJob(req.params['id'] as string, getUser(req));
  res.json(data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const job = await mergeService.createMergeJob(req.body as CreateMergeInput, getUser(req));
  res.status(202).json(job);
});

export const getReport = asyncHandler(async (req: Request, res: Response) => {
  const job = await mergeService.getMergeJob(req.params['id'] as string, getUser(req));
  if (!job.relatorio_html) throw new NotFoundError('Relatório ainda não disponível');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(job.relatorio_html);
});

export const download = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const buffer = await mergeService.downloadMergeResult(id, getUser(req));
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="merge_${id.slice(0, 8)}.prw"`);
  res.send(buffer);
});
