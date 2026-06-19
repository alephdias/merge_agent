import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { downloadFile, uploadFile } from '../config/storage';
import { logger } from '../utils/logger';
import { threeWayMerge } from '../utils/threeWayMerge';
import type { ChangeCategory, ConflictSegment, MergeSegment } from '../utils/threeWayMerge';
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

// ─── AI comprehensive analysis document ─────────────────────────────────────

interface ConflictAnalysis {
  nome: string;
  o_que_totvs_mudou: string;
  o_que_empresa_customizou: string;
  por_que_conflito: string;
  como_resolvido: string;
  risco: 'baixo' | 'médio' | 'alto';
  risco_explicacao: string;
}

interface MergeAnalysisJson {
  resumo_executivo: string;
  conflitos: ConflictAnalysis[];
  customizacoes_resumo: string;
  recomendacoes: string[];
}

function escapeHtmlDoc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAnaliseHtml(
  json: MergeAnalysisJson,
  stats: Record<ChangeCategory, number>,
  empresaNome: string,
  fonteNome: string,
  dataStr: string,
): string {
  const riskColor = (r: string) =>
    r === 'alto' ? '#dc2626' : r === 'médio' ? '#d97706' : '#16a34a';
  const riskBg = (r: string) =>
    r === 'alto' ? '#fef2f2' : r === 'médio' ? '#fffbeb' : '#f0fdf4';
  const riskBorder = (r: string) =>
    r === 'alto' ? '#fecaca' : r === 'médio' ? '#fde68a' : '#bbf7d0';

  const statsCard = (label: string, count: number, bg: string, border: string, text: string) =>
    `<div style="background:${bg};border:1.5px solid ${border};color:${text};border-radius:10px;padding:12px 20px;display:flex;flex-direction:column;gap:2px;min-width:140px">
      <span style="font-size:24px;font-weight:800;font-family:Inter,sans-serif">${count}</span>
      <span style="font-size:11px;font-weight:600;font-family:Inter,sans-serif;opacity:.8">${label}</span>
    </div>`;

  const conflictsHtml = json.conflitos.map((c, i) => `
    <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 6px rgba(0,0,0,.06)">
      <div style="background:linear-gradient(135deg,#991b1b,#dc2626);padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">Conflito ${i + 1}</span>
          <h3 style="margin:2px 0 0;font-size:16px;font-weight:700;color:#fff;font-family:'Courier New',monospace">${escapeHtmlDoc(c.nome)}</h3>
        </div>
        <div style="background:${riskBg(c.risco)};border:1.5px solid ${riskBorder(c.risco)};color:${riskColor(c.risco)};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:Inter,sans-serif;white-space:nowrap">
          Risco ${c.risco}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #f3f4f6">
        <div style="padding:16px 20px;border-right:1px solid #f3f4f6">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.05em;font-family:Inter,sans-serif">O que a TOTVS mudou</p>
          <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.o_que_totvs_mudou)}</p>
        </div>
        <div style="padding:16px 20px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;font-family:Inter,sans-serif">O que a empresa havia customizado</p>
          <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.o_que_empresa_customizou)}</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #f3f4f6">
        <div style="padding:16px 20px;border-right:1px solid #f3f4f6">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;font-family:Inter,sans-serif">Por que houve conflito</p>
          <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.por_que_conflito)}</p>
        </div>
        <div style="padding:16px 20px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em;font-family:Inter,sans-serif">Como a IA resolveu</p>
          <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.como_resolvido)}</p>
        </div>
      </div>
      <div style="padding:12px 20px;background:#fafafa;display:flex;align-items:flex-start;gap:8px">
        <svg width="14" height="14" fill="none" stroke="${riskColor(c.risco)}" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
        <p style="margin:0;font-size:12.5px;color:#6b7280;line-height:1.55;font-family:Inter,sans-serif"><strong style="color:${riskColor(c.risco)}">Atenção:</strong> ${escapeHtmlDoc(c.risco_explicacao)}</p>
      </div>
    </div>`).join('\n');

  const recsHtml = json.recomendacoes.map((r) =>
    `<li style="padding:8px 0;font-size:14px;color:#374151;line-height:1.6;font-family:Inter,sans-serif;border-bottom:1px solid #f3f4f6">${escapeHtmlDoc(r)}</li>`,
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Análise IA — ${escapeHtmlDoc(fonteNome)} — ${escapeHtmlDoc(empresaNome)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7ff;font-family:Inter,sans-serif">

<div style="background:linear-gradient(135deg,#0f1d3a,#1e3a6e);padding:28px 40px 24px;color:#fff">
  <div style="max-width:960px;margin:0 auto">
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;opacity:.5;text-transform:uppercase;letter-spacing:.08em">Merge Agent · Análise Técnica</p>
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800">${escapeHtmlDoc(fonteNome)}</h1>
    <p style="margin:0;font-size:14px;opacity:.7">Empresa: <strong style="opacity:1">${escapeHtmlDoc(empresaNome)}</strong> &nbsp;·&nbsp; ${escapeHtmlDoc(dataStr)}</p>
  </div>
</div>

<div style="max-width:960px;margin:0 auto;padding:28px 40px">

  <!-- Stats -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    ${statsCard('Blocos inalterados', stats.igual, '#f8f9fa', '#dee2e6', '#495057')}
    ${statsCard('Atualiz. TOTVS', stats.totvs_update, '#cce5ff', '#4dabf7', '#003d8a')}
    ${statsCard('Customiz. empresa', stats.empresa, '#d3f9d8', '#51cf66', '#1a5928')}
    ${statsCard('Conflitos resolvidos', stats.conflito, '#ffe3e3', '#ff6b6b', '#7d1313')}
    ${statsCard('Novos blocos TOTVS', stats.novo_totvs, '#e5dbff', '#845ef7', '#3b0082')}
    ${statsCard('Removidos TOTVS', stats.removido, '#ffe8cc', '#fd7e14', '#7d3500')}
  </div>

  <!-- Resumo executivo -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f1d3a;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" fill="none" stroke="#2563eb" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"/></svg>
      Resumo Executivo
    </h2>
    <div style="font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap">${escapeHtmlDoc(json.resumo_executivo)}</div>
  </div>

  <!-- Conflitos -->
  ${stats.conflito > 0 ? `
  <div style="margin-bottom:28px">
    <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#0f1d3a;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
      Análise de Conflitos (${stats.conflito})
    </h2>
    ${conflictsHtml}
  </div>` : ''}

  <!-- Customizações -->
  ${stats.empresa > 0 ? `
  <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f1d3a;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"/></svg>
      Customizações da Empresa (${stats.empresa})
    </h2>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap">${escapeHtmlDoc(json.customizacoes_resumo)}</p>
  </div>` : ''}

  <!-- Recomendações -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f1d3a;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" fill="none" stroke="#7c3aed" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>
      Recomendações para o Time
    </h2>
    <ol style="margin:0;padding-left:20px;list-style:decimal">
      ${recsHtml}
    </ol>
  </div>

  <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:8px">
    Gerado automaticamente pelo Merge Agent · ${escapeHtmlDoc(dataStr)}
  </p>
</div>
</body>
</html>`;
}

async function generateMergeAnalysis(
  conflictSegs: ConflictSegment[],
  resolvedMap: Map<string, string>,
  segments: MergeSegment[],
  stats: Record<ChangeCategory, number>,
  empresaNome: string,
  fonteNome: string,
): Promise<string> {
  const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fallbackJson: MergeAnalysisJson = {
    resumo_executivo: 'Análise automática não pôde ser gerada. Verifique manualmente os conflitos no relatório de código.',
    conflitos: conflictSegs.map((s) => ({
      nome: s.blockName,
      o_que_totvs_mudou: 'Não analisado.',
      o_que_empresa_customizou: 'Não analisado.',
      por_que_conflito: 'Ambos TOTVS e empresa modificaram o mesmo bloco de forma incompatível.',
      como_resolvido: 'Resolvido automaticamente — verificação manual recomendada.',
      risco: 'médio' as const,
      risco_explicacao: 'Revisão manual obrigatória.',
    })),
    customizacoes_resumo: `${stats.empresa} customizações foram identificadas e preservadas no merge.`,
    recomendacoes: ['Revisar manualmente todos os conflitos antes de implantar em produção.'],
  };

  try {
    const linhas: string[] = [
      'Você é um especialista em AdvPL/TLPP e engenharia de software.',
      'Analise o merge abaixo e gere um relatório técnico DETALHADO em português (pt-BR).',
      '',
      `ARQUIVO: ${fonteNome}`,
      `EMPRESA: ${empresaNome}`,
      `DATA: ${dataStr}`,
      '',
      'ESTATÍSTICAS DO MERGE:',
      `- ${stats.igual} blocos inalterados (empresa e TOTVS idênticos)`,
      `- ${stats.totvs_update} atualizações automáticas da TOTVS (sem customização da empresa, aplicadas sem conflito)`,
      `- ${stats.empresa} customizações da empresa preservadas (empresa modificou, TOTVS não mudou)`,
      `- ${stats.conflito} conflitos resolvidos por IA (ambos TOTVS e empresa modificaram o mesmo bloco)`,
      `- ${stats.novo_totvs} blocos novos adicionados pela TOTVS`,
      `- ${stats.removido} blocos removidos pela TOTVS`,
      '',
    ];

    if (conflictSegs.length > 0) {
      linhas.push(`=== CONFLITOS PARA ANÁLISE DETALHADA (${conflictSegs.length}) ===`);
      linhas.push('');
      for (let i = 0; i < conflictSegs.length; i++) {
        const seg = conflictSegs[i]!;
        const resolved = resolvedMap.get(seg.blockName) ?? '';
        linhas.push(`--- CONFLITO ${i + 1}: ${seg.blockName} ---`);
        linhas.push('');
        if (seg.ancestorContent) {
          linhas.push('VERSÃO BASE TOTVS (ancestor — ponto de partida comum):');
          linhas.push('```');
          linhas.push(seg.ancestorContent.slice(0, 1800));
          if (seg.ancestorContent.length > 1800) linhas.push('[... truncado ...]');
          linhas.push('```');
          linhas.push('');
        }
        if (seg.totvsContent) {
          linhas.push('NOVA VERSÃO TOTVS (o que a TOTVS atualizou):');
          linhas.push('```');
          linhas.push(seg.totvsContent.slice(0, 1800));
          if (seg.totvsContent.length > 1800) linhas.push('[... truncado ...]');
          linhas.push('```');
        } else {
          linhas.push('NOVA VERSÃO TOTVS: BLOCO REMOVIDO pela TOTVS nesta versão.');
        }
        linhas.push('');
        linhas.push('VERSÃO DA EMPRESA (o que a empresa havia customizado):');
        if (seg.empresaContent) {
          linhas.push('```');
          linhas.push(seg.empresaContent.slice(0, 1800));
          if (seg.empresaContent.length > 1800) linhas.push('[... truncado ...]');
          linhas.push('```');
        } else {
          linhas.push('A empresa havia removido este bloco.');
        }
        linhas.push('');
        if (resolved) {
          linhas.push('RESOLUÇÃO DA IA (código final incorporado ao merge):');
          linhas.push('```');
          linhas.push(resolved.slice(0, 1800));
          if (resolved.length > 1800) linhas.push('[... truncado ...]');
          linhas.push('```');
        }
        linhas.push('');
      }
    }

    const empresaBlocks = segments
      .filter((s) => s.kind === 'resolved' && s.category === 'empresa')
      .map((s) => s.blockName)
      .join(', ');
    if (empresaBlocks) {
      linhas.push('=== CUSTOMIZAÇÕES DA EMPRESA (sem conflito, preservadas automaticamente) ===');
      linhas.push(empresaBlocks);
      linhas.push('');
    }

    linhas.push('Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois):');
    linhas.push('{');
    linhas.push('  "resumo_executivo": "3-4 parágrafos técnicos sobre o merge: contexto geral, o que foi feito, riscos globais, recomendação de validação",');
    linhas.push('  "conflitos": [');
    linhas.push('    {');
    linhas.push('      "nome": "nome exato do bloco",');
    linhas.push('      "o_que_totvs_mudou": "explicação técnica detalhada do que a TOTVS alterou neste bloco",');
    linhas.push('      "o_que_empresa_customizou": "o que a empresa havia implementado como customização",');
    linhas.push('      "por_que_conflito": "por que as mudanças da TOTVS e da empresa colidiram especificamente",');
    linhas.push('      "como_resolvido": "como a IA resolveu o conflito, qual estratégia foi usada, o que foi preservado de cada lado",');
    linhas.push('      "risco": "baixo ou médio ou alto",');
    linhas.push('      "risco_explicacao": "o que deve ser testado, qual o impacto desta resolução em produção"');
    linhas.push('    }');
    linhas.push('  ],');
    linhas.push('  "customizacoes_resumo": "parágrafo explicando o perfil geral de customizações da empresa e o que foi preservado",');
    linhas.push('  "recomendacoes": ["lista de ações concretas para o time validar antes de deploy"]');
    linhas.push('}');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: linhas.join('\n') }],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text.trim() : '';
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(cleaned) as MergeAnalysisJson;

    return buildAnaliseHtml(parsed, stats, empresaNome, fonteNome, dataStr);
  } catch (err) {
    logger.warn({ err }, 'generateMergeAnalysis: falha ao gerar análise IA — usando fallback');
    return buildAnaliseHtml(fallbackJson, stats, empresaNome, fonteNome, dataStr);
  }
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

  const [htmlReport, analiseHtml] = await Promise.all([
    Promise.resolve(generateHtmlReport(reportLines, stats, empresaNome, fonteRecord.nome_arquivo)),
    generateMergeAnalysis(conflictSegs, resolvedMap, segments, stats, empresaNome, fonteRecord.nome_arquivo),
  ]);

  await mergesRepo.updateDone(jobId, resultPath, htmlReport, analiseHtml);

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
