import { query } from '../config/database';
import type { BibliotecaTotvs } from '../types';

export async function findAll(): Promise<BibliotecaTotvs[]> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
            uploaded_by, storage_path, hash, is_latest
       FROM biblioteca_totvs
      ORDER BY data_upload DESC`,
  );
  return rows;
}

export async function findById(id: string): Promise<BibliotecaTotvs | null> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
            uploaded_by, storage_path, hash, is_latest
       FROM biblioteca_totvs
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findByHash(hash: string): Promise<BibliotecaTotvs | null> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
            uploaded_by, storage_path, hash, is_latest
       FROM biblioteca_totvs
      WHERE hash = $1`,
    [hash],
  );
  return rows[0] ?? null;
}

export interface CreateTotvsInput {
  nome_arquivo: string;
  data_pacote: string | null;
  numero_pacote: string | null;
  descricao: string | null;
  uploaded_by: string;
  storage_path: string;
  hash: string;
}

/** Returns [latest, previous] by data_upload for a given file name (1 or 2 results). */
export async function findLatestTwoByNomeArquivo(nomeArquivo: string): Promise<BibliotecaTotvs[]> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
            uploaded_by, storage_path, hash, is_latest
       FROM biblioteca_totvs
      WHERE nome_arquivo = $1
      ORDER BY data_upload DESC
      LIMIT 2`,
    [nomeArquivo],
  );
  return rows;
}

export async function create(data: CreateTotvsInput): Promise<BibliotecaTotvs> {
  const { rows } = await query<BibliotecaTotvs>(
    `INSERT INTO biblioteca_totvs
       (nome_arquivo, data_pacote, numero_pacote, descricao, uploaded_by, storage_path, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
               uploaded_by, storage_path, hash, is_latest`,
    [
      data.nome_arquivo,
      data.data_pacote,
      data.numero_pacote,
      data.descricao,
      data.uploaded_by,
      data.storage_path,
      data.hash,
    ],
  );
  return rows[0] as BibliotecaTotvs;
}
