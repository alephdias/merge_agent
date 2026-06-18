import { query } from '../config/database';
import type { Empresa } from '../types';
import type { CreateEmpresaInput, UpdateEmpresaInput } from '../schemas/empresa.schema';

export async function findAll(): Promise<Empresa[]> {
  const result = await query<Empresa>('SELECT * FROM empresas ORDER BY nome ASC');
  return result.rows;
}

export async function findById(id: string): Promise<Empresa | null> {
  const result = await query<Empresa>('SELECT * FROM empresas WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function create(data: CreateEmpresaInput): Promise<Empresa> {
  const result = await query<Empresa>(
    `INSERT INTO empresas (nome, cnpj, slug)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.nome, data.cnpj ?? null, data.slug ?? null],
  );
  const empresa = result.rows[0];
  if (!empresa) throw new Error('Falha ao criar empresa no banco');
  return empresa;
}

export async function update(id: string, data: UpdateEmpresaInput): Promise<Empresa | null> {
  // Monta SET dinâmico para não sobrescrever campos não enviados
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.nome !== undefined) {
    fields.push(`nome = $${idx++}`);
    values.push(data.nome);
  }
  // 'cnpj' in data verifica presença explícita (permite setar null)
  if ('cnpj' in data) {
    fields.push(`cnpj = $${idx++}`);
    values.push(data.cnpj ?? null);
  }
  if ('slug' in data) {
    fields.push(`slug = $${idx++}`);
    values.push(data.slug ?? null);
  }

  if (fields.length === 0) return findById(id);

  values.push(id);
  const result = await query<Empresa>(
    `UPDATE empresas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function remove(id: string): Promise<boolean> {
  const result = await query('DELETE FROM empresas WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM empresas
        WHERE slug = $1
          AND ($2::uuid IS NULL OR id <> $2)
     ) AS exists`,
    [slug, excludeId ?? null],
  );
  return result.rows[0]?.exists ?? false;
}
