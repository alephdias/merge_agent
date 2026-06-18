import { query } from '../config/database';
import type { FonteEmpresa } from '../types';

export async function findAllByEmpresa(empresaId: string): Promise<FonteEmpresa[]> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT id, empresa_id, nome_arquivo, data_pacote, data_upload, numero_pacote,
            descricao, uploaded_by, storage_path, hash, is_latest
       FROM fontes_empresa
      WHERE empresa_id = $1
      ORDER BY data_upload DESC`,
    [empresaId],
  );
  return rows;
}

export async function findById(id: string, empresaId: string): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT id, empresa_id, nome_arquivo, data_pacote, data_upload, numero_pacote,
            descricao, uploaded_by, storage_path, hash, is_latest
       FROM fontes_empresa
      WHERE id = $1 AND empresa_id = $2`,
    [id, empresaId],
  );
  return rows[0] ?? null;
}

/** Returns the most recently uploaded fonte for an empresa (any nome_arquivo). */
export async function findLatestByEmpresa(empresaId: string): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT id, empresa_id, nome_arquivo, data_pacote, data_upload, numero_pacote,
            descricao, uploaded_by, storage_path, hash, is_latest
       FROM fontes_empresa
      WHERE empresa_id = $1
      ORDER BY data_upload DESC
      LIMIT 1`,
    [empresaId],
  );
  return rows[0] ?? null;
}

export async function findByHashAndEmpresa(
  hash: string,
  empresaId: string,
): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT id, empresa_id, nome_arquivo, data_pacote, data_upload, numero_pacote,
            descricao, uploaded_by, storage_path, hash, is_latest
       FROM fontes_empresa
      WHERE hash = $1 AND empresa_id = $2`,
    [hash, empresaId],
  );
  return rows[0] ?? null;
}

export interface CreateFonteInput {
  empresa_id: string;
  nome_arquivo: string;
  data_pacote: string | null;
  numero_pacote: string | null;
  descricao: string | null;
  uploaded_by: string;
  storage_path: string;
  hash: string;
}

export async function create(data: CreateFonteInput): Promise<FonteEmpresa> {
  const { rows } = await query<FonteEmpresa>(
    `INSERT INTO fontes_empresa
       (empresa_id, nome_arquivo, data_pacote, numero_pacote, descricao,
        uploaded_by, storage_path, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, empresa_id, nome_arquivo, data_pacote, data_upload, numero_pacote,
               descricao, uploaded_by, storage_path, hash, is_latest`,
    [
      data.empresa_id,
      data.nome_arquivo,
      data.data_pacote,
      data.numero_pacote,
      data.descricao,
      data.uploaded_by,
      data.storage_path,
      data.hash,
    ],
  );
  return rows[0] as FonteEmpresa;
}
