import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/hash';
import { uploadFile, deleteFile } from '../config/storage';
import * as fontesRepo from '../repositories/fontes.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import * as empresasRepo from '../repositories/empresas.repository';
import { indexFonteEmpresa } from './rag.service';
import { logger } from '../utils/logger';
import type { AuthUser, FonteEmpresa } from '../types';
import type { UploadFonteInput } from '../schemas/fonte.schema';

export interface UploadFonteResult {
  data: FonteEmpresa;
  deduplicado: boolean;
}

function assertEmpresaAccess(user: AuthUser, empresaId: string): void {
  if (user.empresa_id !== null && user.empresa_id !== empresaId) {
    throw new ForbiddenError('Acesso negado: dados de outra empresa');
  }
}

export async function listFontes(empresaId: string, user: AuthUser): Promise<FonteEmpresa[]> {
  assertEmpresaAccess(user, empresaId);
  return fontesRepo.findAllByEmpresa(empresaId);
}

export async function uploadFonte(
  empresaId: string,
  file: Express.Multer.File,
  meta: UploadFonteInput,
  user: AuthUser,
): Promise<UploadFonteResult> {
  assertEmpresaAccess(user, empresaId);

  const empresa = await empresasRepo.findById(empresaId);
  if (!empresa) throw new NotFoundError('Empresa não encontrada');

  const fileHash = sha256(file.buffer);

  const existing = await fontesRepo.findByHashAndEmpresa(fileHash, empresaId);
  if (existing) {
    return { data: existing, deduplicado: true };
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'prw';
  const storagePath = `fontes/${empresaId}/${uuidv4()}.${ext}`;

  await uploadFile(storagePath, file.buffer, 'text/plain');

  const record = await fontesRepo.create({
    empresa_id: empresaId,
    nome_arquivo: file.originalname,
    data_pacote: meta.data_pacote ?? null,
    numero_pacote: meta.numero_pacote ?? null,
    descricao: meta.descricao ?? null,
    uploaded_by: user.id,
    storage_path: storagePath,
    hash: fileHash,
  });

  // Indexação RAG em background — não bloqueia a resposta ao usuário
  setImmediate(() => {
    indexFonteEmpresa(record.id, empresaId, file.buffer.toString('utf-8'))
      .catch((err: unknown) => logger.warn({ err, fonteId: record.id }, 'RAG: falha ao indexar fonte'));
  });

  return { data: record, deduplicado: false };
}

export async function selectFonte(id: string, empresaId: string, user: AuthUser): Promise<FonteEmpresa> {
  assertEmpresaAccess(user, empresaId);
  const record = await fontesRepo.toggleSelected(id, empresaId);
  if (!record) throw new NotFoundError('Fonte não encontrado');
  return record;
}

export async function deleteFonte(id: string, empresaId: string, user: AuthUser): Promise<void> {
  assertEmpresaAccess(user, empresaId);

  const record = await fontesRepo.findById(id, empresaId);
  if (!record) throw new NotFoundError('Fonte não encontrado');

  const deleted = await fontesRepo.deleteById(id, empresaId).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('foreign key') || msg.includes('violates')) {
      throw new ValidationError('Este fonte está vinculado a um merge existente e não pode ser excluído');
    }
    throw err;
  });

  if (!deleted) throw new NotFoundError('Fonte não encontrado');

  await deleteFile(record.storage_path).catch((err: unknown) =>
    logger.warn({ err, id }, 'Fontes: falha ao deletar arquivo do storage'),
  );
}
