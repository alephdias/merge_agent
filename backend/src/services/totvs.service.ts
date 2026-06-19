import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/hash';
import { uploadFile } from '../config/storage';
import * as totvsRepo from '../repositories/totvs.repository';
import { indexBibliotecaTotvs } from './rag.service';
import { logger } from '../utils/logger';
import { deleteFile } from '../config/storage';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import type { AuthUser, BibliotecaTotvs } from '../types';
import type { UploadFonteInput } from '../schemas/fonte.schema';

export interface UploadResult {
  data: BibliotecaTotvs;
  deduplicado: boolean;
}

export async function listTotvs(): Promise<BibliotecaTotvs[]> {
  return totvsRepo.findAll();
}

export async function getTotvs(id: string): Promise<BibliotecaTotvs | null> {
  return totvsRepo.findById(id);
}

export async function uploadTotvs(
  file: Express.Multer.File,
  meta: UploadFonteInput,
  user: AuthUser,
): Promise<UploadResult> {
  if (user.empresa_id !== null) {
    throw new ForbiddenError('Apenas administradores podem enviar arquivos TOTVS');
  }

  const fileHash = sha256(file.buffer);

  const existing = await totvsRepo.findByHash(fileHash);
  if (existing) {
    return { data: existing, deduplicado: true };
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'prw';
  const storagePath = `totvs/${uuidv4()}.${ext}`;

  await uploadFile(storagePath, file.buffer, 'text/plain');

  const record = await totvsRepo.create({
    nome_arquivo: file.originalname,
    data_pacote: meta.data_pacote ?? null,
    numero_pacote: meta.numero_pacote ?? null,
    descricao: meta.descricao ?? null,
    uploaded_by: user.id,
    storage_path: storagePath,
    hash: fileHash,
  });

  // Indexação RAG em background — empresa_id = NULL (conhecimento global TOTVS)
  setImmediate(() => {
    indexBibliotecaTotvs(record.id, file.buffer.toString('utf-8'))
      .catch((err: unknown) => logger.warn({ err, totvsId: record.id }, 'RAG: falha ao indexar TOTVS'));
  });

  // Indexação RAG em background — empresa_id = NULL (conhecimento global TOTVS)
  setImmediate(() => {
    indexBibliotecaTotvs(record.id, file.buffer.toString('utf-8'))
      .catch((err: unknown) => logger.warn({ err, totvsId: record.id }, 'RAG: falha ao indexar TOTVS'));
  });

  return { data: record, deduplicado: false };
}

export async function selectTotvs(id: string, user: AuthUser): Promise<BibliotecaTotvs> {
  if (user.empresa_id !== null) {
    throw new ForbiddenError('Apenas administradores podem alterar a versão selecionada');
  }
  const record = await totvsRepo.toggleSelected(id);
  if (!record) throw new NotFoundError('Arquivo TOTVS não encontrado');
  return record;
}

export async function deleteTotvs(id: string, user: AuthUser): Promise<void> {
  if (user.empresa_id !== null) {
    throw new ForbiddenError('Apenas administradores podem excluir arquivos TOTVS');
  }

  const record = await totvsRepo.findById(id);
  if (!record) throw new NotFoundError('Arquivo TOTVS não encontrado');

  const deleted = await totvsRepo.deleteById(id).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('foreign key') || msg.includes('violates')) {
      throw new ValidationError('Este arquivo está vinculado a um merge existente e não pode ser excluído');
    }
    throw err;
  });

  if (!deleted) throw new NotFoundError('Arquivo TOTVS não encontrado');

  await deleteFile(record.storage_path).catch((err: unknown) =>
    logger.warn({ err, id }, 'TOTVS: falha ao deletar arquivo do storage'),
  );
}
