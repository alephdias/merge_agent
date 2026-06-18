import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import * as repo from '../repositories/empresas.repository';
import type { Empresa, AuthUser } from '../types';
import type { CreateEmpresaInput, UpdateEmpresaInput } from '../schemas/empresa.schema';

const isAdmin = (user: AuthUser): boolean => user.empresa_id === null;

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listEmpresas(user: AuthUser): Promise<Empresa[]> {
  if (isAdmin(user)) return repo.findAll();

  // Não-admin só enxerga sua própria empresa
  const empresa = await repo.findById(user.empresa_id as string);
  return empresa ? [empresa] : [];
}

// ─── Get one ──────────────────────────────────────────────────────────────────

export async function getEmpresa(id: string, user: AuthUser): Promise<Empresa> {
  if (!isAdmin(user) && user.empresa_id !== id) {
    throw new ForbiddenError('Acesso negado a dados de outra empresa');
  }
  const empresa = await repo.findById(id);
  if (!empresa) throw new NotFoundError('Empresa');
  return empresa;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createEmpresa(
  data: CreateEmpresaInput,
  user: AuthUser,
): Promise<Empresa> {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Apenas administradores podem cadastrar empresas');
  }
  if (data.slug) {
    const exists = await repo.slugExists(data.slug);
    if (exists) throw new ConflictError(`Slug '${data.slug}' já está em uso`);
  }
  return repo.create(data);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateEmpresa(
  id: string,
  data: UpdateEmpresaInput,
  user: AuthUser,
): Promise<Empresa> {
  if (!isAdmin(user) && user.empresa_id !== id) {
    throw new ForbiddenError('Acesso negado a dados de outra empresa');
  }
  if (data.slug) {
    const slugTaken = await repo.slugExists(data.slug, id);
    if (slugTaken) throw new ConflictError(`Slug '${data.slug}' já está em uso`);
  }
  const empresa = await repo.update(id, data);
  if (!empresa) throw new NotFoundError('Empresa');
  return empresa;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteEmpresa(id: string, user: AuthUser): Promise<void> {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Apenas administradores podem remover empresas');
  }
  const removed = await repo.remove(id);
  if (!removed) throw new NotFoundError('Empresa');
}
