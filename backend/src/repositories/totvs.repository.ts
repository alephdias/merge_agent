import { query } from '../config/database';
import type { BibliotecaTotvs } from '../types';

const SELECT_COLS = `
  t.id, t.nome_arquivo, t.data_pacote, t.data_upload, t.numero_pacote, t.descricao,
  t.uploaded_by, t.storage_path, t.hash, t.is_latest, t.is_selected,
  u.email AS uploader_email
`;

export async function findAll(): Promise<BibliotecaTotvs[]> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT ${SELECT_COLS}
       FROM biblioteca_totvs t
       LEFT JOIN usuarios u ON u.id = t.uploaded_by
      ORDER BY t.data_upload DESC`,
  );
  return rows;
}

export async function findById(id: string): Promise<BibliotecaTotvs | null> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT ${SELECT_COLS}
       FROM biblioteca_totvs t
       LEFT JOIN usuarios u ON u.id = t.uploaded_by
      WHERE t.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findByHash(hash: string): Promise<BibliotecaTotvs | null> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT ${SELECT_COLS}
       FROM biblioteca_totvs t
       LEFT JOIN usuarios u ON u.id = t.uploaded_by
      WHERE t.hash = $1`,
    [hash],
  );
  return rows[0] ?? null;
}

/**
 * Returns [principal, anterior] for a given file name (1 or 2 results).
 * is_selected = true takes priority over upload date.
 * If nothing is selected, falls back to most recent (original behavior).
 */
export async function findLatestTwoByNomeArquivo(nomeArquivo: string): Promise<BibliotecaTotvs[]> {
  const { rows } = await query<BibliotecaTotvs>(
    `SELECT ${SELECT_COLS}
       FROM biblioteca_totvs t
       LEFT JOIN usuarios u ON u.id = t.uploaded_by
      WHERE t.nome_arquivo = $1
      ORDER BY t.is_selected DESC, t.data_upload DESC
      LIMIT 2`,
    [nomeArquivo],
  );
  return rows;
}

/** Toggles is_selected for a record. Selecting one unselects all others of the same file. */
export async function toggleSelected(id: string): Promise<BibliotecaTotvs | null> {
  const record = await findById(id);
  if (!record) return null;

  if (record.is_selected) {
    // Deselect — volta ao comportamento padrão (is_latest)
    await query(`UPDATE biblioteca_totvs SET is_selected = false WHERE id = $1`, [id]);
  } else {
    // Seleciona este e desmarca todos os outros do mesmo arquivo
    await query(
      `UPDATE biblioteca_totvs SET is_selected = false WHERE nome_arquivo = $1`,
      [record.nome_arquivo],
    );
    await query(`UPDATE biblioteca_totvs SET is_selected = true WHERE id = $1`, [id]);
  }

  return findById(id);
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

export async function create(data: CreateTotvsInput): Promise<BibliotecaTotvs> {
  const { rows } = await query<BibliotecaTotvs>(
    `INSERT INTO biblioteca_totvs
       (nome_arquivo, data_pacote, numero_pacote, descricao, uploaded_by, storage_path, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nome_arquivo, data_pacote, data_upload, numero_pacote, descricao,
               uploaded_by, NULL AS uploader_email, storage_path, hash, is_latest, is_selected`,
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

/** Returns the storage_path of the deleted record, or null if not found. */
export async function deleteById(id: string): Promise<{ storage_path: string; nome_arquivo: string } | null> {
  const { rows } = await query<{ storage_path: string; nome_arquivo: string }>(
    `DELETE FROM biblioteca_totvs WHERE id = $1
     RETURNING storage_path, nome_arquivo`,
    [id],
  );
  if (!rows[0]) return null;

  // After deletion, promote the next most recent version as is_latest
  await query(
    `UPDATE biblioteca_totvs
        SET is_latest = true
      WHERE nome_arquivo = $1
        AND id = (
          SELECT id FROM biblioteca_totvs
           WHERE nome_arquivo = $1
           ORDER BY data_upload DESC
           LIMIT 1
        )`,
    [rows[0].nome_arquivo],
  );

  return rows[0];
}
