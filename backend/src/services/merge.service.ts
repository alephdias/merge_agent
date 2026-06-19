import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { downloadFile, uploadFile } from '../config/storage';
import { logger } from '../utils/logger';
import { threeWayMerge } from '../utils/threeWayMerge';
import type { ChangeCategory, ConflictSegment } from '../utils/threeWayMerge';
import * as mergesRepo from '../repositories/merges.repository';
import * as totvsRepo from '../repositories/totvs.repository';
import * as fontesRepo from '../repositories/fontes.repository';
import * as empresasRepo from '../repositories/empresas.repository';
import { retrieveContext, indexMergeResolution } from './rag.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError';
import type { AuthUser, MergeJob } from '../types';
import type { CreateMergeInput } from '../schemas/merge.schema';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── Claude conflict resolver (com RAG) ─────────────────────────────────────

async function resolveConflict(
  seg: ConflictSegment,
  empresaId: string,
  jobId: string,
): Promise<string> {
  // 1. Busca contexto histórico isolado por empresa_id
  const ragContext = await retrieveContext(
    empresaId,
    seg.blockName,
    seg.empresaContent ?? seg.totvsContent ?? '',
  );

  const lines: string[] = [
    'You are an expert AdvPL/TLPP developer. Resolve the following three-way merge conflict.',
    `Block name: ${seg.blockName}`,
    '',
  ];

  // 2. Injeta contexto RAG no topo do prompt quando disponível
  if (ragContext) {
    lines.push(ragContext);
    lines.push('');
    lines.push(
      'Use the historical context above to understand this company\'s coding style and past merge decisions. ' +
      'Apply the same patterns when resolving the conflict below.',
    );
    lines.push('');
  }

  if (seg.ancestorContent !== null) {
    lines.push('ANCESTOR (original TOTVS base):');
    lines.push('```');
    lines.push(seg.ancestorContent);
    lines.push('```');
    lines.push('');
  }

  if (seg.totvsContent !== null) {
    lines.push('TOTVS UPDATE (new version from TOTVS):');
    lines.push('```');
    lines.push(seg.totvsContent);
    lines.push('```');
  } else {
    lines.push('TOTVS UPDATE: this block was DELETED in the new TOTVS version.');
  }
  lines.push('');

  lines.push('COMPANY CUSTOMIZATION (company changes applied to ancestor):');
  if (seg.empresaContent !== null) {
    lines.push('```');
    lines.push(seg.empresaContent);
    lines.push('```');
  } else {
    lines.push('(this block was deleted in the company version)');
  }
  lines.push('');
  lines.push(
    'Output ONLY the final merged AdvPL code that preserves both the TOTVS update and the company customization. ' +
    'No explanation, no markdown fences — just the raw code.',
  );

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: lines.join('\n') }],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  const resolved  = textBlock?.type === 'text' ? textBlock.text : (seg.totvsContent ?? seg.empresaContent ?? '');

  // 3. Indexa resolução para aprendizado futuro (fire-and-forget, isolado por empresa_id)
  setImmediate(() => {
    const summary = [
      seg.ancestorContent ? `ANCESTOR:\n${seg.ancestorContent.slice(0, 300)}` : '',
      seg.totvsContent    ? `TOTVS:\n${seg.totvsContent.slice(0, 300)}`        : 'TOTVS: bloco removido',
      seg.empresaContent  ? `EMPRESA:\n${seg.empresaContent.slice(0, 300)}`    : 'EMPRESA: bloco removido',
    ].filter(Boolean).join('\n\n');

    indexMergeResolution(jobId, empresaId, seg.blockName, summary, resolved)
      .catch((err: unknown) => logger.warn({ err, jobId, blockName: seg.blockName }, 'RAG: falha ao indexar resolução'));
  });

  return resolved;
}

// ─── HTML report generator ───────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ChangeCategory, string> = {
  igual:        '#f5f5f5',
  totvs_update: '#e3f2fd',
  empresa:      '#e8f5e9',
  conflito:     '#ffebee',
  novo_totvs:   '#f3e5f5',
  removido:     '#fff3e0',
};

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  igual:        'Igual (inalterado)',
  totvs_update: 'Atualização TOTVS',
  empresa:      'Customização empresa',
  conflito:     'Conflito (resolvido por IA)',
  novo_totvs:   'Novo bloco (TOTVS)',
  removido:     'Removido pelo TOTVS',
};

interface ReportLine {
  content: string;
  category: ChangeCategory;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHtmlReport(reportLines: ReportLine[], stats: Record<ChangeCategory, number>): string {
  const statsHtml = (Object.entries(stats) as [ChangeCategory, number][])
    .map(([cat, count]) =>
      `<div class="stat"><span style="background:${CATEGORY_COLORS[cat]};padding:2px 8px;border-radius:3px">${CATEGORY_LABELS[cat]}</span> <strong>${count}</strong> bloco(s)</div>`,
    )
    .join('\n    ');

  const legendHtml = (Object.entries(CATEGORY_COLORS) as [ChangeCategory, string][])
    .map(([cat, color]) =>
      `<div class="legend-item"><div class="legend-color" style="background:${color}"></div>${CATEGORY_LABELS[cat]}</div>`,
    )
    .join('\n    ');

  const rows = reportLines
    .map((l, i) => {
      const bg = CATEGORY_COLORS[l.category];
      const strikethrough = l.category === 'removido' ? 'text-decoration:line-through;opacity:.65;' : '';
      return `<tr><td class="ln">${i + 1}</td><td class="code" style="background:${bg};${strikethrough}">${escapeHtml(l.content)}</td></tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Merge — Merge Agent NFESEFAZ</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Consolas,Monaco,'Courier New',monospace;font-size:13px;background:#fff}
.header{padding:16px 20px;background:#fff;border-bottom:2px solid #e0e0e0}
.header h2{font-size:16px;margin-bottom:10px}
.legend{display:flex;gap:12px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:6px;font-size:12px}
.legend-color{width:22px;height:14px;border:1px solid rgba(0,0,0,.1);border-radius:2px;flex-shrink:0}
.stats{padding:10px 20px;background:#fafafa;border-bottom:1px solid #eee;display:flex;gap:16px;flex-wrap:wrap}
.stat{font-size:12px;display:flex;align-items:center;gap:6px}
.stat strong{font-size:14px}
table{width:100%;border-collapse:collapse}
td{padding:1px 8px;white-space:pre;font-size:12px;line-height:1.5}
td.ln{color:#aaa;text-align:right;user-select:none;border-right:1px solid #e8e8e8;width:52px;background:#fafafa;font-size:11px}
td.code{width:100%}
</style>
</head>
<body>
<div class="header">
  <h2>Relatório de Merge — Merge Agent NFESEFAZ</h2>
  <div class="legend">
    ${legendHtml}
  </div>
</div>
<div class="stats">
  ${statsHtml}
</div>
<table><tbody>
${rows}
</tbody></table>
</body>
</html>`;
}

// ─── Core async processor (never blocks event loop) ─────────────────────────

async function processMergeJob(jobId: string): Promise<void> {
  await mergesRepo.updateStatus(jobId, 'processing');

  const job = await mergesRepo.findById(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado após criação`);

  // Download the three source files
  const fonteRecord = await fontesRepo.findById(job.fonte_empresa_id, job.empresa_id);
  if (!fonteRecord) throw new Error('Fonte da empresa não encontrada');

  const totvsAtualRecord = job.totvs_v_atual_id
    ? await totvsRepo.findById(job.totvs_v_atual_id)
    : null;
  if (!totvsAtualRecord) throw new Error('Versão TOTVS atual não encontrada');

  const [totvsAtualBuf, empresaBuf] = await Promise.all([
    downloadFile(totvsAtualRecord.storage_path),
    downloadFile(fonteRecord.storage_path),
  ]);

  // Ancestor: use previous TOTVS version if available, otherwise use totvs_atual as ancestor
  // (two-way merge falls back gracefully: ancestor==totvs → only empresa changes detected)
  let ancestorBuf: Buffer;
  if (job.totvs_v_anterior_id) {
    const anteriorRecord = await totvsRepo.findById(job.totvs_v_anterior_id);
    if (!anteriorRecord) throw new Error('Versão TOTVS anterior não encontrada');
    ancestorBuf = await downloadFile(anteriorRecord.storage_path);
  } else {
    ancestorBuf = totvsAtualBuf;
  }

  const ancestorSource  = ancestorBuf.toString('utf-8');
  const totvsSource     = totvsAtualBuf.toString('utf-8');
  const empresaSource   = empresaBuf.toString('utf-8');

  // Three-way merge (block-level)
  const { segments, conflictCount } = threeWayMerge(ancestorSource, totvsSource, empresaSource);

  // Resolve conflicts with Claude
  const resolvedMap = new Map<string, string>();
  for (const seg of segments) {
    if (seg.kind === 'conflict') {
      logger.info({ jobId, blockName: seg.blockName }, 'Resolvendo conflito com Claude + RAG');
      const resolved = await resolveConflict(seg, job.empresa_id, jobId);
      resolvedMap.set(seg.blockName, resolved);
    }
  }

  // Assemble report lines and output content
  const reportLines: ReportLine[] = [];
  const outputLines: string[] = [];
  const stats: Record<ChangeCategory, number> = {
    igual: 0, totvs_update: 0, empresa: 0,
    conflito: 0, novo_totvs: 0, removido: 0,
  };

  for (const seg of segments) {
    let content: string;
    let category: ChangeCategory;

    if (seg.kind === 'resolved') {
      category = seg.category;
      content = seg.category === 'removido'
        ? (seg.removedContent ?? '')
        : seg.content;
    } else {
      category = 'conflito';
      content = resolvedMap.get(seg.blockName) ?? seg.totvsContent ?? seg.empresaContent ?? '';
    }

    stats[category]++;

    // Only include non-removed blocks in output .prw
    if (category !== 'removido') {
      const resolvedContent = seg.kind === 'resolved' ? seg.content : (resolvedMap.get(seg.blockName) ?? '');
      outputLines.push(resolvedContent);
    }

    // All blocks go to the report (including removido with visual strikethrough)
    for (const line of content.split('\n')) {
      reportLines.push({ content: line, category });
    }
  }

  const mergedContent = outputLines.join('\n');
  const resultPath = `merges/${jobId}/${uuidv4()}.prw`;
  await uploadFile(resultPath, Buffer.from(mergedContent, 'utf-8'), 'text/plain');

  const htmlReport = generateHtmlReport(reportLines, stats);

  await mergesRepo.updateDone(jobId, resultPath, htmlReport);

  logger.info({ jobId, conflictCount, stats }, 'Merge concluído com sucesso');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createMergeJob(
  input: CreateMergeInput,
  user: AuthUser,
): Promise<MergeJob> {
  // Resolve empresa_id — from JWT for non-admin, from body for admin
  const empresaId: string =
    user.empresa_id !== null
      ? user.empresa_id
      : (input.empresa_id ?? (() => { throw new ValidationError('empresa_id obrigatório para admins'); })());

  if (user.empresa_id !== null && input.empresa_id && input.empresa_id !== user.empresa_id) {
    throw new ForbiddenError('Acesso negado: dados de outra empresa');
  }

  const empresa = await empresasRepo.findById(empresaId);
  if (!empresa) throw new NotFoundError('Empresa não encontrada');

  // Resolve fonte_empresa (latest upload for this empresa)
  const fonte = await fontesRepo.findLatestByEmpresa(empresaId);
  if (!fonte) throw new ValidationError('Empresa não possui fontes cadastradas. Envie um arquivo primeiro.');

  // Resolve TOTVS versions: exact name match → fallback to any latest
  let totvsAtualId: string | null = input.totvs_v_atual_id ?? null;
  let totvsAnteriorId: string | null = input.totvs_v_anterior_id ?? null;

  if (!totvsAtualId) {
    let versions = await totvsRepo.findLatestTwoByNomeArquivo(fonte.nome_arquivo);

    // Fallback: nome pode diferir (ex: empresa envia "nfesefaz.prw", biblioteca tem "nfesefaz_totvs.prw")
    // Tenta match sem extensão e case-insensitive
    if (versions.length === 0) {
      const baseName = fonte.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase();
      const allTotvs = await totvsRepo.findAll();
      const matched = allTotvs.filter((t) =>
        t.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase().includes(baseName) ||
        baseName.includes(t.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase()),
      );
      // Ordena: is_selected primeiro, depois is_latest, depois mais recente
      matched.sort((a, b) => {
        if (a.is_selected !== b.is_selected) return a.is_selected ? -1 : 1;
        if (a.is_latest !== b.is_latest) return a.is_latest ? -1 : 1;
        return new Date(b.data_upload).getTime() - new Date(a.data_upload).getTime();
      });
      versions = matched.slice(0, 2);
    }

    if (versions.length === 0) {
      throw new ValidationError(
        'Nenhuma versão TOTVS encontrada na biblioteca. Envie o fonte padrão TOTVS antes de executar o merge.',
      );
    }
    totvsAtualId    = versions[0]?.id ?? null;
    totvsAnteriorId = versions[1]?.id ?? null;
  }

  const job = await mergesRepo.create({
    empresa_id:           empresaId,
    totvs_v_anterior_id:  totvsAnteriorId,
    totvs_v_atual_id:     totvsAtualId,
    fonte_empresa_id:     fonte.id,
    created_by:           user.id,
  });

  // Trigger async processing — never blocks the event loop
  setImmediate(() => {
    processMergeJob(job.id).catch((err: unknown) => {
      logger.error({ err, jobId: job.id }, 'Erro fatal no processamento do merge');
      mergesRepo.updateError(
        job.id,
        err instanceof Error ? err.message : 'Erro interno',
      ).catch((e: unknown) => {
        logger.error({ err: e, jobId: job.id }, 'Falha ao registrar erro do job');
      });
    });
  });

  return job;
}

export async function listMergeJobs(user: AuthUser, empresaId?: string): Promise<MergeJob[]> {
  if (user.empresa_id !== null) {
    // Non-admin: always scoped to their empresa
    return mergesRepo.findAllByEmpresa(user.empresa_id);
  }
  // Admin: filter by empresaId param or return all
  return empresaId ? mergesRepo.findAllByEmpresa(empresaId) : mergesRepo.findAll();
}

export async function getMergeJob(id: string, user: AuthUser): Promise<MergeJob> {
  const job = await mergesRepo.findById(id);
  if (!job) throw new NotFoundError('Job de merge não encontrado');

  if (user.empresa_id !== null && job.empresa_id !== user.empresa_id) {
    throw new ForbiddenError('Acesso negado: job de outra empresa');
  }

  return job;
}

export async function downloadMergeResult(id: string, user: AuthUser): Promise<Buffer> {
  const job = await getMergeJob(id, user);
  if (!job.resultado_path) throw new NotFoundError('Arquivo de resultado ainda não disponível');
  return downloadFile(job.resultado_path);
}
