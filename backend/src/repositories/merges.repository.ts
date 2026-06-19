import { query } from '../config/database';
import type { MergeJob, MergeJobStatus } from '../types';

export interface CreateMergeJobInput {
  empresa_id: string;
  totvs_v_anterior_id: string | null;
  totvs_v_atual_id: string | null;
  fonte_empresa_id: string;
  created_by: string;
}

const SELECT_COLS = `
  id, empresa_id, totvs_v_anterior_id, totvs_v_atual_id, fonte_empresa_id,
  status, resultado_path, relatorio_html, analise_ia, error_message, created_at, completed_at, created_by
`.trim();

export async function create(data: CreateMergeJobInput): Promise<MergeJob> {
  const { rows } = await query<MergeJob>(
    `INSERT INTO merge_jobs
       (empresa_id, totvs_v_anterior_id, totvs_v_atual_id, fonte_empresa_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [
      data.empresa_id,
      data.totvs_v_anterior_id,
      data.totvs_v_atual_id,
      data.fonte_empresa_id,
      data.created_by,
    ],
  );
  return rows[0] as MergeJob;
}

export async function findById(id: string): Promise<MergeJob | null> {
  const { rows } = await query<MergeJob>(
    `SELECT ${SELECT_COLS} FROM merge_jobs WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findAll(): Promise<MergeJob[]> {
  const { rows } = await query<MergeJob>(
    `SELECT ${SELECT_COLS} FROM merge_jobs ORDER BY created_at DESC`,
  );
  return rows;
}

export async function findAllByEmpresa(empresaId: string): Promise<MergeJob[]> {
  const { rows } = await query<MergeJob>(
    `SELECT ${SELECT_COLS} FROM merge_jobs
      WHERE empresa_id = $1
      ORDER BY created_at DESC`,
    [empresaId],
  );
  return rows;
}

export async function updateStatus(id: string, status: MergeJobStatus): Promise<void> {
  await query(
    `UPDATE merge_jobs SET status = $1 WHERE id = $2`,
    [status, id],
  );
}

export async function updateDone(
  id: string,
  resultadoPath: string,
  relatorioHtml: string,
  analiseIa: string,
): Promise<void> {
  await query(
    `UPDATE merge_jobs
        SET status = 'done', resultado_path = $1, relatorio_html = $2, analise_ia = $3, completed_at = now()
      WHERE id = $4`,
    [resultadoPath, relatorioHtml, analiseIa, id],
  );
}

export async function updateError(id: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE merge_jobs
        SET status = 'error', error_message = $1, completed_at = now()
      WHERE id = $2`,
    [errorMessage, id],
  );
}
