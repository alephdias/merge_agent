import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/hash';
import { uploadFile } from '../config/storage';
import * as totvsRepo from '../repositories/totvs.repository';
import { ForbiddenError } from '../errors/AppError';
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

  return { data: record, deduplicado: false };
}
