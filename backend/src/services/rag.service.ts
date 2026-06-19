import { query } from '../config/database';
import { logger } from '../utils/logger';
import { parseAdvpl, blockContent } from '../utils/advplParser';
import { embedText, embedTexts } from './embedding.service';

// Converte number[] para o literal de vetor do PostgreSQL: '[0.1,0.2,...]'
function toVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

interface EmbeddingRow {
  id: string;
  empresa_id: string | null;
  origem: string;
  bloco_nome: string;
  conteudo: string;
  score: number;
}

// ─── Indexação ───────────────────────────────────────────────────────────────

export async function indexFonteEmpresa(
  fonteId: string,
  empresaId: string,
  sourceCode: string,
): Promise<void> {
  const { blocks } = parseAdvpl(sourceCode);
  const relevant = blocks.filter((b) => b.kind !== 'header' && b.lines.length > 3);
  if (relevant.length === 0) return;

  await query(`DELETE FROM embeddings WHERE origem = 'fonte_empresa' AND origem_id = $1`, [fonteId]);

  const texts = relevant.map((b) => `${b.name}\n${blockContent(b)}`);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < relevant.length; i++) {
    const block = relevant[i]!;
    const emb   = embeddings[i]!;
    await query(
      `INSERT INTO embeddings (empresa_id, origem, origem_id, bloco_nome, conteudo, embedding)
       VALUES ($1, 'fonte_empresa', $2, $3, $4, $5::vector)`,
      [empresaId, fonteId, block.name, blockContent(block), toVector(emb)],
    );
  }

  logger.info({ fonteId, empresaId, blocos: relevant.length }, 'RAG: fonte_empresa indexada');
}

export async function indexBibliotecaTotvs(
  totvsId: string,
  sourceCode: string,
): Promise<void> {
  const { blocks } = parseAdvpl(sourceCode);
  const relevant = blocks.filter((b) => b.kind !== 'header' && b.lines.length > 3);
  if (relevant.length === 0) return;

  await query(`DELETE FROM embeddings WHERE origem = 'biblioteca_totvs' AND origem_id = $1`, [totvsId]);

  const texts = relevant.map((b) => `${b.name}\n${blockContent(b)}`);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < relevant.length; i++) {
    const block = relevant[i]!;
    const emb   = embeddings[i]!;
    await query(
      `INSERT INTO embeddings (empresa_id, origem, origem_id, bloco_nome, conteudo, embedding)
       VALUES (NULL, 'biblioteca_totvs', $1, $2, $3, $4::vector)`,
      [totvsId, block.name, blockContent(block), toVector(emb)],
    );
  }

  logger.info({ totvsId, blocos: relevant.length }, 'RAG: biblioteca_totvs indexada');
}

export async function indexMergeResolution(
  jobId: string,
  empresaId: string,
  blockName: string,
  conflictSummary: string,
  resolvedCode: string,
): Promise<void> {
  const conteudo = `Função: ${blockName}\nConflito resolvido:\n${conflictSummary.slice(0, 600)}\nCódigo final:\n${resolvedCode.slice(0, 800)}`;
  const emb = await embedText(conteudo);

  await query(
    `INSERT INTO embeddings (empresa_id, origem, origem_id, bloco_nome, conteudo, embedding)
     VALUES ($1, 'merge_resolucao', $2, $3, $4, $5::vector)`,
    [empresaId, jobId, blockName, conteudo, toVector(emb)],
  );

  logger.debug({ jobId, empresaId, blockName }, 'RAG: resolução de conflito indexada');
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

export async function retrieveContext(
  empresaId: string,
  blockName: string,
  blockCode: string,
): Promise<string> {
  let emb: number[];
  try {
    emb = await embedText(`${blockName}\n${blockCode}`);
  } catch (err) {
    logger.warn({ err, blockName }, 'RAG: falha no embedding — merge continua sem contexto');
    return '';
  }

  const result = await query<EmbeddingRow>(
    `SELECT id, empresa_id, origem, bloco_nome, conteudo, score
     FROM search_embeddings($1::vector, $2::uuid, 5)
     WHERE score > 0.70`,
    [toVector(emb), empresaId],
  );

  if (result.rows.length === 0) return '';

  const lines: string[] = [
    '=== CONTEXTO HISTÓRICO (memória isolada desta empresa + base global TOTVS) ===',
  ];

  for (const row of result.rows) {
    const label =
      row.origem === 'merge_resolucao' ? '✓ Resolução anterior desta empresa' :
      row.origem === 'fonte_empresa'   ? '📄 Padrão de código desta empresa' :
                                         '📚 Base de código TOTVS';
    lines.push(`\n[${label} | bloco: ${row.bloco_nome} | relevância: ${(row.score * 100).toFixed(0)}%]`);
    lines.push('```');
    lines.push(row.conteudo.slice(0, 800));
    lines.push('```');
  }

  return lines.join('\n');
}
