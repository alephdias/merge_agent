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

// ─── Batch conflict resolver (ONE API call, Sonnet = ~5x cheaper than Opus) ──

async function resolveAllConflicts(
  conflicts: ConflictSegment[],
  empresaId: string,
  jobId: string,
): Promise<Map<string, string>> {
  if (conflicts.length === 0) return new Map();

  // Single RAG lookup for the whole batch (representative block)
  const first = conflicts[0]!;
  const ragContext = await retrieveContext(
    empresaId,
    first.blockName,
    first.empresaContent ?? first.totvsContent ?? '',
  ).catch(() => '');

  const lines: string[] = [
    'You are an expert AdvPL/TLPP developer. Resolve ALL the merge conflicts below in ONE response.',
    'For each conflict: produce merged code preserving both the TOTVS update AND the company customization.',
    '',
    'Respond with a single JSON object: {"blockName": "resolved code", ...}',
    'Output ONLY valid JSON. No markdown fences, no explanation.',
    '',
  ];

  if (ragContext) {
    lines.push(ragContext);
    lines.push('');
  }

  for (const seg of conflicts) {
    lines.push(`=== CONFLICT: ${seg.blockName} ===`);
    if (seg.ancestorContent !== null) {
      lines.push('ANCESTOR (original TOTVS base):');
      lines.push(seg.ancestorContent.slice(0, 3000));
    }
    lines.push('');
    if (seg.totvsContent !== null) {
      lines.push('TOTVS UPDATE (new version):');
      lines.push(seg.totvsContent.slice(0, 3000));
    } else {
      lines.push('TOTVS UPDATE: block was DELETED in new TOTVS version.');
    }
    lines.push('');
    lines.push('COMPANY CUSTOMIZATION:');
    if (seg.empresaContent !== null) {
      lines.push(seg.empresaContent.slice(0, 3000));
    } else {
      lines.push('(block was deleted in company version)');
    }
    lines.push('');
  }

  lines.push('=== END OF CONFLICTS ===');
  lines.push('Respond ONLY with the JSON object resolving every block above.');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: lines.join('\n') }],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text.trim() : '{}';

  let resolved: Record<string, string>;
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    resolved = JSON.parse(cleaned) as Record<string, string>;
  } catch {
    logger.warn({ jobId }, 'Batch conflict JSON parse failed — falling back to TOTVS content');
    resolved = {};
    for (const seg of conflicts) {
      resolved[seg.blockName] = seg.totvsContent ?? seg.empresaContent ?? '';
    }
  }

  // Index resolutions for RAG learning (fire-and-forget, empresa-isolated)
  for (const seg of conflicts) {
    const resolvedCode = resolved[seg.blockName] ?? '';
    if (!resolvedCode) continue;
    setImmediate(() => {
      const summary = [
        seg.ancestorContent ? `ANCESTOR:\n${seg.ancestorContent.slice(0, 200)}` : '',
        seg.totvsContent    ? `TOTVS:\n${seg.totvsContent.slice(0, 200)}`        : 'TOTVS: bloco removido',
        seg.empresaContent  ? `EMPRESA:\n${seg.empresaContent.slice(0, 200)}`    : 'EMPRESA: bloco removido',
      ].filter(Boolean).join('\n\n');
      indexMergeResolution(jobId, empresaId, seg.blockName, summary, resolvedCode)
        .catch((err: unknown) => logger.warn({ err, jobId, blockName: seg.blockName }, 'RAG: falha ao indexar resolução'));
    });
  }

  return new Map(Object.entries(resolved));
}

// ─── HTML report generator ───────────────────────────────────────────────────

// Vivid colors — high contrast for easy visual parsing
const CATEGORY_COLORS: Record<ChangeCategory, { bg: string; border: string; text: string }> = {
  igual:        { bg: '#f8f9fa', border: '#e9ecef', text: '#495057' },
  totvs_update: { bg: '#cce5ff', border: '#4dabf7', text: '#003d8a' },
  empresa:      { bg: '#d3f9d8', border: '#51cf66', text: '#1a5928' },
  conflito:     { bg: '#ffe3e3', border: '#ff6b6b', text: '#7d1313' },
  novo_totvs:   { bg: '#e5dbff', border: '#845ef7', text: '#3b0082' },
  removido:     { bg: '#ffe8cc', border: '#fd7e14', text: '#7d3500' },
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

function generateHtmlReport(
  reportLines: ReportLine[],
  stats: Record<ChangeCategory, number>,
  empresaNome: string,
  fonteNome: string,
): string {
  const statsHtml = (Object.entries(stats) as [ChangeCategory, number][])
    .map(([cat, count]) => {
      const c = CATEGORY_COLORS[cat];
      return `<div class="stat-item" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text}">
        <span class="stat-label">${CATEGORY_LABELS[cat]}</span>
        <strong class="stat-count">${count}</strong>
      </div>`;
    })
    .join('\n');

  const legendHtml = (Object.entries(CATEGORY_COLORS) as [ChangeCategory, { bg: string; border: string; text: string }][])
    .map(([cat, c]) =>
      `<div class="legend-item">
        <div class="legend-swatch" style="background:${c.bg};border:2px solid ${c.border}"></div>
        <span style="color:${c.text};font-weight:500">${CATEGORY_LABELS[cat]}</span>
      </div>`,
    )
    .join('\n');

  const rows = reportLines
    .map((l, i) => {
      const c = CATEGORY_COLORS[l.category];
      const extra = l.category === 'removido' ? 'removed-line' : '';
      return `<tr class="${extra}">
        <td class="ln" style="background:${c.border}22">${i + 1}</td>
        <td class="code" style="background:${c.bg};border-left:3px solid ${c.border}">${escapeHtml(l.content)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Merge — ${fonteNome} — ${empresaNome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Consolas,Monaco,'Courier New',monospace;font-size:14px;background:#fff;color:#212529}
.header{padding:16px 20px;background:#0f1d3a;color:#fff}
.header h2{font-size:16px;font-weight:700;margin-bottom:4px;font-family:Inter,sans-serif}
.header .subtitle{font-size:12px;opacity:.65;font-family:Inter,sans-serif}
.legend{padding:12px 20px;background:#fff;border-bottom:2px solid #e9ecef;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.legend-label{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-right:4px;font-family:Inter,sans-serif}
.legend-item{display:flex;align-items:center;gap:5px;font-size:12px;font-family:Inter,sans-serif}
.legend-swatch{width:18px;height:12px;border-radius:3px;flex-shrink:0}
.stats{padding:10px 20px;background:#f8f9fa;border-bottom:1px solid #e9ecef;display:flex;gap:8px;flex-wrap:wrap}
.stat-item{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:6px;font-family:Inter,sans-serif}
.stat-label{font-size:12px;font-weight:500}
.stat-count{font-size:16px;font-weight:700}
table{width:100%;border-collapse:collapse}
td{padding:1px 0;white-space:pre;font-size:13.5px;line-height:1.55}
td.ln{color:#868e96;text-align:right;user-select:none;border-right:1px solid #dee2e6;width:52px;padding:1px 8px;font-size:11px;vertical-align:top}
td.code{width:100%;padding:1px 12px}
tr.removed-line td.code{text-decoration:line-through;opacity:.7}
tr:hover td.code{filter:brightness(.96)}
</style>
</head>
<body>
<div class="header">
  <h2>Relatório de Merge — ${escapeHtml(fonteNome)}</h2>
  <div class="subtitle">Empresa: ${escapeHtml(empresaNome)} · Gerado pelo Merge Agent</div>
</div>
<div class="legend">
  <span class="legend-label">Legenda:</span>
  ${legendHtml}
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

// ─── Core async processor ────────────────────────────────────────────────────

async function processMergeJob(jobId: string): Promise<void> {
  await mergesRepo.updateStatus(jobId, 'processing');

  const job = await mergesRepo.findById(jobId);
  if (!job) throw new Error(`Job ${jobId} não encontrado após criação`);

  const fonteRecord = await fontesRepo.findById(job.fonte_empresa_id, job.empresa_id);
  if (!fonteRecord) throw new Error('Fonte da empresa não encontrada');

  const totvsAtualRecord = job.totvs_v_atual_id
    ? await totvsRepo.findById(job.totvs_v_atual_id)
    : null;
  if (!totvsAtualRecord) throw new Error('Versão TOTVS atual não encontrada');

  const empresa = await empresasRepo.findById(job.empresa_id);
  const empresaNome = empresa?.nome ?? 'Empresa';

  const [totvsAtualBuf, empresaBuf] = await Promise.all([
    downloadFile(totvsAtualRecord.storage_path),
    downloadFile(fonteRecord.storage_path),
  ]);

  let ancestorBuf: Buffer;
  if (job.totvs_v_anterior_id) {
    const anteriorRecord = await totvsRepo.findById(job.totvs_v_anterior_id);
    if (!anteriorRecord) throw new Error('Versão TOTVS anterior não encontrada');
    ancestorBuf = await downloadFile(anteriorRecord.storage_path);
  } else {
    ancestorBuf = totvsAtualBuf;
  }

  const ancestorSource = ancestorBuf.toString('utf-8');
  const totvsSource    = totvsAtualBuf.toString('utf-8');
  const empresaSource  = empresaBuf.toString('utf-8');

  const { segments, conflictCount } = threeWayMerge(ancestorSource, totvsSource, empresaSource);

  // Resolve ALL conflicts in ONE batched API call (was: one call per conflict)
  const conflictSegs = segments.filter((s): s is ConflictSegment => s.kind === 'conflict');
  const resolvedMap  = await resolveAllConflicts(conflictSegs, job.empresa_id, jobId);

  // Assemble report lines and merged output
  const reportLines: ReportLine[] = [];
  const outputLines: string[]     = [];
  const stats: Record<ChangeCategory, number> = {
    igual: 0, totvs_update: 0, empresa: 0,
    conflito: 0, novo_totvs: 0, removido: 0,
  };

  for (const seg of segments) {
    let content: string;
    let category: ChangeCategory;

    if (seg.kind === 'resolved') {
      category = seg.category;
      content  = seg.category === 'removido' ? (seg.removedContent ?? '') : seg.content;
    } else {
      category = 'conflito';
      content  = resolvedMap.get(seg.blockName) ?? seg.totvsContent ?? seg.empresaContent ?? '';
    }

    stats[category]++;

    if (category !== 'removido') {
      const resolved = seg.kind === 'resolved' ? seg.content : (resolvedMap.get(seg.blockName) ?? '');
      outputLines.push(resolved);
    }

    for (const line of content.split('\n')) {
      reportLines.push({ content: line, category });
    }
  }

  const mergedContent = outputLines.join('\n');
  const resultPath    = `merges/${jobId}/${uuidv4()}.prw`;
  await uploadFile(resultPath, Buffer.from(mergedContent, 'utf-8'), 'text/plain');

  const htmlReport = generateHtmlReport(reportLines, stats, empresaNome, fonteRecord.nome_arquivo);

  await mergesRepo.updateDone(jobId, resultPath, htmlReport);

  logger.info({ jobId, conflictCount, stats }, 'Merge concluído com sucesso');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createMergeJob(
  input: CreateMergeInput,
  user: AuthUser,
): Promise<MergeJob> {
  const empresaId: string =
    user.empresa_id !== null
      ? user.empresa_id
      : (input.empresa_id ?? (() => { throw new ValidationError('empresa_id obrigatório para admins'); })());

  if (user.empresa_id !== null && input.empresa_id && input.empresa_id !== user.empresa_id) {
    throw new ForbiddenError('Acesso negado: dados de outra empresa');
  }

  const empresa = await empresasRepo.findById(empresaId);
  if (!empresa) throw new NotFoundError('Empresa não encontrada');

  const fonte = await fontesRepo.findLatestByEmpresa(empresaId);
  if (!fonte) throw new ValidationError('Empresa não possui fontes cadastradas. Envie um arquivo primeiro.');

  let totvsAtualId: string | null    = input.totvs_v_atual_id ?? null;
  let totvsAnteriorId: string | null = input.totvs_v_anterior_id ?? null;

  if (!totvsAtualId) {
    let versions = await totvsRepo.findLatestTwoByNomeArquivo(fonte.nome_arquivo);

    if (versions.length === 0) {
      const baseName = fonte.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase();
      const allTotvs = await totvsRepo.findAll();
      const matched  = allTotvs.filter((t) =>
        t.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase().includes(baseName) ||
        baseName.includes(t.nome_arquivo.replace(/\.[^.]+$/, '').toLowerCase()),
      );
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
    empresa_id:          empresaId,
    totvs_v_anterior_id: totvsAnteriorId,
    totvs_v_atual_id:    totvsAtualId,
    fonte_empresa_id:    fonte.id,
    created_by:          user.id,
  });

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
  if (user.empresa_id !== null) return mergesRepo.findAllByEmpresa(user.empresa_id);
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

export async function downloadMergeResult(id: string, user: AuthUser): Promise<{ buffer: Buffer; filename: string }> {
  const job = await getMergeJob(id, user);
  if (!job.resultado_path) throw new NotFoundError('Arquivo de resultado ainda não disponível');

  const [buffer, fonte, empresa] = await Promise.all([
    downloadFile(job.resultado_path),
    fontesRepo.findById(job.fonte_empresa_id, job.empresa_id),
    empresasRepo.findById(job.empresa_id),
  ]);

  // Build descriptive filename: nfesefaz_gulf_merged.prw
  const baseName = (fonte?.nome_arquivo ?? 'fonte').replace(/\.[^.]+$/, '');
  const slug = (empresa?.slug ?? empresa?.nome ?? 'empresa')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const filename = `${baseName}_${slug}_merged.prw`;

  return { buffer, filename };
}
