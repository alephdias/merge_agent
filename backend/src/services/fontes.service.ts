import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../utils/hash';
import { uploadFile } from '../config/storage';
import * as fontesRepo from '../repositories/fontes.repository';
import { ForbiddenError, NotFoundError } from '../errors/AppError';
import * as empresasRepo from '../repositories/empresas.repository';
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

  return { data: record, deduplicado: false };
}
