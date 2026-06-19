import { query } from '../config/database';
import type { FonteEmpresa } from '../types';

const SELECT_COLS = `
  f.id, f.empresa_id, f.nome_arquivo, f.data_pacote, f.data_upload,
  f.numero_pacote, f.descricao, f.uploaded_by, f.storage_path,
  f.hash, f.is_latest, f.is_selected,
  u.email AS uploader_email
`;

export async function findAllByEmpresa(empresaId: string): Promise<FonteEmpresa[]> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT ${SELECT_COLS}
       FROM fontes_empresa f
       LEFT JOIN usuarios u ON u.id = f.uploaded_by
      WHERE f.empresa_id = $1
      ORDER BY f.data_upload DESC`,
    [empresaId],
  );
  return rows;
}

export async function findById(id: string, empresaId: string): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT ${SELECT_COLS}
       FROM fontes_empresa f
       LEFT JOIN usuarios u ON u.id = f.uploaded_by
      WHERE f.id = $1 AND f.empresa_id = $2`,
    [id, empresaId],
  );
  return rows[0] ?? null;
}

export async function findLatestByEmpresa(empresaId: string): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT ${SELECT_COLS}
       FROM fontes_empresa f
       LEFT JOIN usuarios u ON u.id = f.uploaded_by
      WHERE f.empresa_id = $1
      ORDER BY f.is_selected DESC, f.data_upload DESC
      LIMIT 1`,
    [empresaId],
  );
  return rows[0] ?? null;
}

export async function findByHashAndEmpresa(hash: string, empresaId: string): Promise<FonteEmpresa | null> {
  const { rows } = await query<FonteEmpresa>(
    `SELECT ${SELECT_COLS}
       FROM fontes_empresa f
       LEFT JOIN usuarios u ON u.id = f.uploaded_by
      WHERE f.hash = $1 AND f.empresa_id = $2`,
    [hash, empresaId],
  );
  return rows[0] ?? null;
}

/** Toggles is_selected. Selecting one unselects all others of the same arquivo for the same empresa. */
export async function toggleSelected(id: string, empresaId: string): Promise<FonteEmpresa | null> {
  const record = await findById(id, empresaId);
  if (!record) return null;

  if (record.is_selected) {
    await query(`UPDATE fontes_empresa SET is_selected = false WHERE id = $1`, [id]);
  } else {
    await query(
      `UPDATE fontes_empresa SET is_selected = false
        WHERE empresa_id = $1 AND nome_arquivo = $2`,
      [empresaId, record.nome_arquivo],
    );
    await query(`UPDATE fontes_empresa SET is_selected = true WHERE id = $1`, [id]);
  }

  return findById(id, empresaId);
}

/** Deletes a record and promotes the next most recent as is_latest. Returns storage_path. */
export async function deleteById(id: string, empresaId: string): Promise<{ storage_path: string; nome_arquivo: string } | null> {
  const { rows } = await query<{ storage_path: string; nome_arquivo: string }>(
    `DELETE FROM fontes_empresa WHERE id = $1 AND empresa_id = $2
     RETURNING storage_path, nome_arquivo`,
    [id, empresaId],
  );
  if (!rows[0]) return null;

  await query(
    `UPDATE fontes_empresa
        SET is_latest = true
      WHERE empresa_id = $1 AND nome_arquivo = $2
        AND id = (
          SELECT id FROM fontes_empresa
           WHERE empresa_id = $1 AND nome_arquivo = $2
           ORDER BY data_upload DESC
           LIMIT 1
        )`,
    [empresaId, rows[0].nome_arquivo],
  );

  return rows[0];
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
               descricao, uploaded_by, NULL AS uploader_email,
               storage_path, hash, is_latest, is_selected`,
    [
      data.empresa_id, data.nome_arquivo, data.data_pacote,
      data.numero_pacote, data.descricao, data.uploaded_by,
      data.storage_path, data.hash,
    ],
  );
  return rows[0] as FonteEmpresa;
}
