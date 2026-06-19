import { query } from '../config/database';
import type { CompareAnalysis } from '../services/compare.service';

export interface ComparativoRecord {
  id: string;
  v1_id: string;
  v2_id: string;
  stats: { added: number; removed: number; unchanged: number };
  analysis: CompareAnalysis;
  created_by: string | null;
  created_at: Date;
  // joined
  v1_nome: string;
  v1_pacote: string | null;
  v1_data: string | null;
  v2_nome: string;
  v2_pacote: string | null;
  v2_data: string | null;
}

const WITH_LABELS = `
  SELECT
    c.id, c.v1_id, c.v2_id, c.stats, c.analysis, c.created_by, c.created_at,
    t1.nome_arquivo AS v1_nome, t1.numero_pacote AS v1_pacote, t1.data_pacote::text AS v1_data,
    t2.nome_arquivo AS v2_nome, t2.numero_pacote AS v2_pacote, t2.data_pacote::text AS v2_data
  FROM comparativos c
  JOIN biblioteca_totvs t1 ON t1.id = c.v1_id
  JOIN biblioteca_totvs t2 ON t2.id = c.v2_id
`;

export async function create(data: {
  v1_id: string;
  v2_id: string;
  stats: object;
  analysis: object;
  created_by: string | null;
}): Promise<ComparativoRecord> {
  const { rows } = await query<ComparativoRecord>(
    `INSERT INTO comparativos (v1_id, v2_id, stats, analysis, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.v1_id, data.v2_id, JSON.stringify(data.stats), JSON.stringify(data.analysis), data.created_by],
  );
  return findById(rows[0].id) as Promise<ComparativoRecord>;
}

export async function findAll(limit = 20): Promise<ComparativoRecord[]> {
  const { rows } = await query<ComparativoRecord>(
    `${WITH_LABELS} ORDER BY c.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function findById(id: string): Promise<ComparativoRecord | null> {
  const { rows } = await query<ComparativoRecord>(
    `${WITH_LABELS} WHERE c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
