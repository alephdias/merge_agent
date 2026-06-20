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
  descricao_funcao: string;
  analise_mudanca_totvs: string;
  analise_customizacao_empresa: string;
  analise_conflito: string;
  analise_resolucao: string;
  impacto_sistema: string;
  referencias_totvs: string;
  risco: 'baixo' | 'médio' | 'alto';
  risco_justificativa: string;
  testes_obrigatorios: string[];
  pontos_atencao: string[];
}

interface CustomizacaoAnalysis {
  nome: string;
  descricao: string;
  natureza_customizacao: string;
  impacto_negocial: string;
  classificacao: string;
  risco_proxima_atualizacao: string;
}

interface MergeAnalysisJson {
  visao_geral_arquivo: string;
  resumo_executivo: string;
  conflitos: ConflictAnalysis[];
  customizacoes_detalhadas: CustomizacaoAnalysis[];
  recomendacoes: string[];
  plano_testes: string[];
  conclusao: string;
}

function escapeHtmlDoc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface EmpresaSegData { blockName: string; content: string }

function codeBlock(label: string, labelColor: string, borderColor: string, code: string, openByDefault = false): string {
  return `<details${openByDefault ? ' open' : ''} style="margin-bottom:6px">
  <summary style="cursor:pointer;padding:9px 14px;background:${labelColor};color:#fff;font-family:'Courier New',monospace;font-size:12px;font-weight:600;border-radius:6px;list-style:none;display:flex;align-items:center;gap:6px;user-select:none;border-left:4px solid ${borderColor}">
    ▶ ${label}
  </summary>
  <pre style="margin:0;padding:14px 16px;background:#1a1f2e;color:#e2e8f0;font-size:12px;line-height:1.55;overflow-x:auto;border-radius:0 0 6px 6px;white-space:pre;tab-size:2;border:1px solid #2d3748;border-top:none">${escapeHtmlDoc(code)}</pre>
</details>`;
}

function buildAnaliseHtml(
  json: MergeAnalysisJson,
  conflictSegs: ConflictSegment[],
  resolvedMap: Map<string, string>,
  empresaSegs: EmpresaSegData[],
  stats: Record<ChangeCategory, number>,
  empresaNome: string,
  fonteNome: string,
  dataStr: string,
): string {
  const riskColor  = (r: string) => r === 'alto' ? '#dc2626' : r === 'médio' ? '#d97706' : '#16a34a';
  const riskBg     = (r: string) => r === 'alto' ? '#fef2f2' : r === 'médio' ? '#fffbeb' : '#f0fdf4';
  const riskBorder = (r: string) => r === 'alto' ? '#fecaca' : r === 'médio' ? '#fde68a' : '#bbf7d0';

  const statCard = (label: string, n: number, bg: string, border: string, color: string) =>
    `<div style="background:${bg};border:2px solid ${border};color:${color};border-radius:10px;padding:14px 20px;min-width:130px;text-align:center">
      <div style="font-size:28px;font-weight:800;font-family:Inter,sans-serif">${n}</div>
      <div style="font-size:11px;font-weight:600;margin-top:2px;opacity:.85">${label}</div>
    </div>`;

  const conflictsHtml = (json.conflitos ?? []).map((c, i) => {
    const seg = conflictSegs.find((s) => s.blockName === c.nome);
    const resolved = resolvedMap.get(c.nome) ?? '';

    const codesHtml = [
      seg?.ancestorContent ? codeBlock('Versão Base TOTVS (ancestor — ponto de partida comum)', '#374151', '#6b7280', seg.ancestorContent) : '',
      seg?.totvsContent    ? codeBlock('Nova Versão TOTVS (o que a TOTVS atualizou)', '#1d4ed8', '#3b82f6', seg.totvsContent) : `<div style="padding:10px 14px;background:#f0f9ff;border-radius:6px;font-size:13px;color:#0369a1">⚠ Bloco removido pela TOTVS nesta versão.</div>`,
      seg?.empresaContent  ? codeBlock('Versão da Empresa (customização)', '#166534', '#22c55e', seg.empresaContent) : `<div style="padding:10px 14px;background:#f0fdf4;border-radius:6px;font-size:13px;color:#166534">⚠ Empresa havia removido este bloco.</div>`,
      resolved ? codeBlock('Resultado do Merge — Resolução IA', '#5b21b6', '#a855f7', resolved, true) : '',
    ].filter(Boolean).join('\n');

    const testList = (c.testes_obrigatorios ?? []).map((t) =>
      `<li style="padding:5px 0;font-size:13px;color:#374151;line-height:1.6;border-bottom:1px solid #f3f4f6">${escapeHtmlDoc(t)}</li>`).join('');
    const atencaoList = (c.pontos_atencao ?? []).map((p) =>
      `<li style="padding:4px 0;font-size:13px;color:#92400e">${escapeHtmlDoc(p)}</li>`).join('');

    return `<div style="background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:28px;box-shadow:0 2px 12px rgba(0,0,0,.07)">

  <!-- Conflict header -->
  <div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px">
    <div>
      <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;font-family:Inter,sans-serif">Conflito ${i + 1} de ${json.conflitos.length}</span>
      <h3 style="margin:3px 0 0;font-size:18px;font-weight:700;color:#fff;font-family:'Courier New',monospace;word-break:break-all">${escapeHtmlDoc(c.nome)}</h3>
    </div>
    <div style="flex-shrink:0;background:${riskBg(c.risco)};border:2px solid ${riskBorder(c.risco)};color:${riskColor(c.risco)};padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;font-family:Inter,sans-serif;white-space:nowrap">
      ⚠ Risco ${c.risco}
    </div>
  </div>

  <!-- Function description -->
  <div style="padding:16px 24px;background:#fafafa;border-bottom:1px solid #f3f4f6">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">Sobre esta função</p>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-family:Inter,sans-serif">${escapeHtmlDoc(c.descricao_funcao ?? '')}</p>
    ${c.referencias_totvs ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;font-style:italic;font-family:Inter,sans-serif">📚 ${escapeHtmlDoc(c.referencias_totvs)}</p>` : ''}
  </div>

  <!-- Analysis 2x2 grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr">
    <div style="padding:18px 24px;border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">🔵 O que a TOTVS mudou</p>
      <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.7;font-family:Inter,sans-serif;white-space:pre-wrap">${escapeHtmlDoc(c.analise_mudanca_totvs ?? '')}</p>
    </div>
    <div style="padding:18px 24px;border-bottom:1px solid #f3f4f6">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">🟢 Customização da empresa</p>
      <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.7;font-family:Inter,sans-serif;white-space:pre-wrap">${escapeHtmlDoc(c.analise_customizacao_empresa ?? '')}</p>
    </div>
    <div style="padding:18px 24px;border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">🔴 Por que conflitou</p>
      <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.7;font-family:Inter,sans-serif;white-space:pre-wrap">${escapeHtmlDoc(c.analise_conflito ?? '')}</p>
    </div>
    <div style="padding:18px 24px;border-bottom:1px solid #f3f4f6">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">🟣 Como a IA resolveu</p>
      <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.7;font-family:Inter,sans-serif;white-space:pre-wrap">${escapeHtmlDoc(c.analise_resolucao ?? '')}</p>
    </div>
  </div>

  <!-- System impact -->
  ${c.impacto_sistema ? `<div style="padding:14px 24px;background:#eff6ff;border-bottom:1px solid #bfdbfe">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">Impacto no sistema</p>
    <p style="margin:0;font-size:13.5px;color:#1e40af;line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.impacto_sistema)}</p>
  </div>` : ''}

  <!-- Code blocks -->
  <div style="padding:16px 24px;border-bottom:1px solid #f3f4f6;background:#111827">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">Blocos de Código (clique para expandir)</p>
    ${codesHtml}
  </div>

  <!-- Risk + tests -->
  <div style="display:grid;grid-template-columns:1fr 1fr">
    <div style="padding:16px 24px;background:${riskBg(c.risco)};border-right:1px solid #f3f4f6">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${riskColor(c.risco)};text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">⚠ Risco ${c.risco} — Justificativa</p>
      <p style="margin:0;font-size:13px;color:${riskColor(c.risco)};line-height:1.65;font-family:Inter,sans-serif">${escapeHtmlDoc(c.risco_justificativa ?? '')}</p>
      ${atencaoList ? `<ul style="margin:10px 0 0;padding-left:16px">${atencaoList}</ul>` : ''}
    </div>
    <div style="padding:16px 24px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">✅ Testes obrigatórios antes do deploy</p>
      ${testList ? `<ul style="margin:0;padding-left:16px">${testList}</ul>` : '<p style="font-size:13px;color:#9ca3af;margin:0">Nenhum teste específico identificado.</p>'}
    </div>
  </div>

</div>`;
  }).join('\n');

  // Per-customization cards with code
  const customCards = (json.customizacoes_detalhadas ?? []).map((c) => {
    const seg = empresaSegs.find((s) => s.blockName === c.nome);
    const classBadges: Record<string, { bg: string; color: string }> = {
      fiscal:     { bg: '#fef3c7', color: '#92400e' },
      integracao: { bg: '#ede9fe', color: '#5b21b6' },
      relatorio:  { bg: '#e0f2fe', color: '#0369a1' },
      validacao:  { bg: '#d1fae5', color: '#065f46' },
      outro:      { bg: '#f3f4f6', color: '#374151' },
    };
    const cls = classBadges[c.classificacao ?? 'outro'] ?? classBadges['outro']!;

    return `<div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px">
  <div style="background:linear-gradient(135deg,#14532d,#16a34a);padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
    <h4 style="margin:0;font-size:14px;font-weight:700;color:#fff;font-family:'Courier New',monospace">${escapeHtmlDoc(c.nome)}</h4>
    <span style="background:${cls.bg};color:${cls.color};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;font-family:Inter,sans-serif">${escapeHtmlDoc(c.classificacao ?? 'outro')}</span>
  </div>
  <div style="padding:14px 20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #f3f4f6">
    <div>
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">O que esta função faz</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:Inter,sans-serif">${escapeHtmlDoc(c.descricao ?? '')}</p>
    </div>
    <div>
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">Natureza da customização</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;font-family:Inter,sans-serif">${escapeHtmlDoc(c.natureza_customizacao ?? '')}</p>
    </div>
  </div>
  ${c.impacto_negocial ? `<div style="padding:10px 20px;background:#f0fdf4;border-bottom:1px solid #bbf7d0">
    <p style="margin:0;font-size:12.5px;color:#166534;font-family:Inter,sans-serif"><strong>Impacto negocial:</strong> ${escapeHtmlDoc(c.impacto_negocial)}</p>
  </div>` : ''}
  ${c.risco_proxima_atualizacao ? `<div style="padding:8px 20px;background:#fffbeb;border-bottom:1px solid #fde68a">
    <p style="margin:0;font-size:12px;color:#92400e;font-family:Inter,sans-serif"><strong>Risco na próxima atualização TOTVS:</strong> ${escapeHtmlDoc(c.risco_proxima_atualizacao)}</p>
  </div>` : ''}
  ${seg ? `<div style="padding:10px 20px;background:#111827">${codeBlock('Ver código da customização', '#374151', '#51cf66', seg.content)}</div>` : ''}
</div>`;
  }).join('\n');

  const recsHtml   = (json.recomendacoes ?? []).map((r, i) =>
    `<li style="padding:9px 0;font-size:14px;color:#374151;line-height:1.65;font-family:Inter,sans-serif;border-bottom:1px solid #f3f4f6"><strong style="color:#374151">${i + 1}.</strong> ${escapeHtmlDoc(r)}</li>`,
  ).join('\n');

  const testPlanHtml = (json.plano_testes ?? []).map((t) =>
    `<li style="padding:7px 0;font-size:13.5px;color:#374151;line-height:1.6;font-family:Inter,sans-serif;border-bottom:1px solid #f3f4f6">☐ ${escapeHtmlDoc(t)}</li>`,
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Análise IA — ${escapeHtmlDoc(fonteNome)} — ${escapeHtmlDoc(empresaNome)}</title>
<style>
*{box-sizing:border-box}
details>summary{list-style:none}
details>summary::-webkit-details-marker{display:none}
details[open]>summary{border-radius:6px 6px 0 0!important}
details>summary::before{content:'▶ ';font-size:10px;opacity:.7;transition:transform .2s}
details[open]>summary::before{content:'▼ '}
body{margin:0;padding:0;background:#f0f4ff}
</style>
</head>
<body>

<!-- Header -->
<div style="background:linear-gradient(135deg,#0f1d3a,#1e3a6e);padding:32px 40px 28px;color:#fff">
  <div style="max-width:980px;margin:0 auto">
    <p style="margin:0 0 5px;font-size:10px;font-weight:700;opacity:.45;text-transform:uppercase;letter-spacing:.1em;font-family:Inter,sans-serif">Merge Agent · Análise Técnica Completa</p>
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;font-family:Inter,sans-serif">${escapeHtmlDoc(fonteNome)}</h1>
    <p style="margin:0;font-size:14px;opacity:.65;font-family:Inter,sans-serif">Empresa: <strong style="opacity:1">${escapeHtmlDoc(empresaNome)}</strong> &nbsp;·&nbsp; ${escapeHtmlDoc(dataStr)}</p>
  </div>
</div>

<div style="max-width:980px;margin:0 auto;padding:32px 40px">

  <!-- Visão geral do arquivo -->
  ${json.visao_geral_arquivo ? `<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:20px 28px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,.05);border-left:4px solid #2563eb">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif">📁 Sobre o arquivo ${escapeHtmlDoc(fonteNome)}</p>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;font-family:Inter,sans-serif">${escapeHtmlDoc(json.visao_geral_arquivo)}</p>
  </div>` : ''}

  <!-- Stats -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    ${statCard('Inalterados', stats.igual, '#f8f9fa', '#dee2e6', '#495057')}
    ${statCard('Atualizações TOTVS', stats.totvs_update, '#cce5ff', '#4dabf7', '#003d8a')}
    ${statCard('Customizações empresa', stats.empresa, '#d3f9d8', '#51cf66', '#1a5928')}
    ${statCard('Conflitos resolvidos', stats.conflito, '#ffe3e3', '#ff6b6b', '#7d1313')}
    ${statCard('Novos blocos TOTVS', stats.novo_totvs, '#e5dbff', '#845ef7', '#3b0082')}
    ${statCard('Removidos TOTVS', stats.removido, '#ffe8cc', '#fd7e14', '#7d3500')}
  </div>

  <!-- Resumo executivo -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f1d3a;font-family:Inter,sans-serif">📋 Resumo Executivo</h2>
    <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap;font-family:Inter,sans-serif">${escapeHtmlDoc(json.resumo_executivo ?? '')}</div>
  </div>

  <!-- Conflict section -->
  ${stats.conflito > 0 ? `<div style="margin-bottom:32px">
    <h2 style="margin:0 0 20px;font-size:16px;font-weight:700;color:#0f1d3a;font-family:Inter,sans-serif;display:flex;align-items:center;gap:8px">
      🔴 Análise Detalhada de Conflitos (${stats.conflito})
    </h2>
    ${conflictsHtml}
  </div>` : ''}

  <!-- Company customizations -->
  ${stats.empresa > 0 ? `<div style="margin-bottom:32px">
    <h2 style="margin:0 0 20px;font-size:16px;font-weight:700;color:#0f1d3a;font-family:Inter,sans-serif">🟢 Customizações da Empresa (${stats.empresa})</h2>
    ${customCards || `<p style="font-size:14px;color:#6b7280;font-family:Inter,sans-serif">${stats.empresa} customizações identificadas e preservadas automaticamente no merge.</p>`}
  </div>` : ''}

  <!-- Recommendations -->
  <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f1d3a;font-family:Inter,sans-serif">⚡ Recomendações para o Time</h2>
    <ol style="margin:0;padding:0;list-style:none">${recsHtml}</ol>
  </div>

  <!-- Test plan -->
  ${testPlanHtml ? `<div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,.05)">
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f1d3a;font-family:Inter,sans-serif">✅ Plano de Testes</h2>
    <ul style="margin:0;padding:0;list-style:none">${testPlanHtml}</ul>
  </div>` : ''}

  <!-- Conclusion -->
  ${json.conclusao ? `<div style="background:linear-gradient(135deg,#0f1d3a,#1e3a6e);border-radius:12px;padding:24px 28px;margin-bottom:16px">
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#93c5fd;font-family:Inter,sans-serif">Conclusão</h2>
    <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.8;font-family:Inter,sans-serif">${escapeHtmlDoc(json.conclusao)}</p>
  </div>` : ''}

  <p style="text-align:center;font-size:11px;color:#9ca3af;font-family:Inter,sans-serif;margin-top:8px">
    Gerado pelo Merge Agent com análise IA · ${escapeHtmlDoc(dataStr)}
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

  const empresaSegs: EmpresaSegData[] = segments
    .filter((s) => s.kind === 'resolved' && s.category === 'empresa' && s.content)
    .map((s) => ({ blockName: s.blockName, content: s.kind === 'resolved' ? s.content : '' }));

  const makeFallback = (): MergeAnalysisJson => ({
    visao_geral_arquivo: `Arquivo AdvPL/TLPP ${fonteNome} processado pelo merge.`,
    resumo_executivo: 'Análise automática não pôde ser gerada. Verifique manualmente os conflitos no relatório de código.',
    conflitos: conflictSegs.map((s) => ({
      nome: s.blockName,
      descricao_funcao: 'Não analisado.',
      analise_mudanca_totvs: 'Não analisado.',
      analise_customizacao_empresa: 'Não analisado.',
      analise_conflito: 'Ambos TOTVS e empresa modificaram o mesmo bloco de forma incompatível.',
      analise_resolucao: 'Resolvido automaticamente — verificação manual recomendada.',
      impacto_sistema: '',
      referencias_totvs: '',
      risco: 'médio' as const,
      risco_justificativa: 'Revisão manual obrigatória.',
      testes_obrigatorios: ['Revisar o bloco manualmente e testar o fluxo completo.'],
      pontos_atencao: [],
    })),
    customizacoes_detalhadas: empresaSegs.map((s) => ({
      nome: s.blockName,
      descricao: 'Customização da empresa preservada no merge.',
      natureza_customizacao: 'Não analisado.',
      impacto_negocial: '',
      classificacao: 'outro',
      risco_proxima_atualizacao: '',
    })),
    recomendacoes: ['Revisar manualmente todos os conflitos antes de implantar em produção.'],
    plano_testes: [],
    conclusao: '',
  });

  try {
    const linhas: string[] = [
      'Você é um especialista sênior em AdvPL/TLPP, ERP TOTVS Protheus e engenharia de software fiscal/contábil.',
      'Analise o merge abaixo e produza um RELATÓRIO TÉCNICO COMPLETO em português (pt-BR).',
      'Seja ESPECÍFICO e CONCRETO: cite nomes de variáveis, parâmetros, funções chamadas, lógicas de negócio.',
      'Quando identificar padrões TOTVS (MVC, Genexus, integração SPED/NF-e, TSS, RTC, etc.), cite-os.',
      '',
      `ARQUIVO ANALISADO: ${fonteNome}`,
      `EMPRESA: ${empresaNome}`,
      `DATA DO MERGE: ${dataStr}`,
      '',
      '═══════════════════ ESTATÍSTICAS ═══════════════════',
      `  ${stats.igual} blocos INALTERADOS — empresa e TOTVS mantiveram o mesmo código`,
      `  ${stats.totvs_update} ATUALIZAÇÕES TOTVS — aplicadas automaticamente sem conflito`,
      `  ${stats.empresa} CUSTOMIZAÇÕES DA EMPRESA — preservadas (TOTVS não tocou, empresa modificou)`,
      `  ${stats.conflito} CONFLITOS RESOLVIDOS por IA — ambos mudaram o mesmo bloco`,
      `  ${stats.novo_totvs} NOVOS BLOCOS TOTVS — adicionados pela TOTVS nesta versão`,
      `  ${stats.removido} REMOVIDOS PELO TOTVS — empresa pode ter perdido funcionalidade`,
      '',
    ];

    // Conflict blocks with FULL code
    if (conflictSegs.length > 0) {
      linhas.push('═══════════════════ CONFLITOS PARA ANÁLISE DETALHADA ═══════════════════');
      linhas.push('');
      for (let i = 0; i < conflictSegs.length; i++) {
        const seg = conflictSegs[i]!;
        const resolved = resolvedMap.get(seg.blockName) ?? '';
        linhas.push(`┌─────────────────────────────────────────┐`);
        linhas.push(`  CONFLITO ${i + 1}/${conflictSegs.length}: ${seg.blockName}`);
        linhas.push(`└─────────────────────────────────────────┘`);
        linhas.push('');

        if (seg.ancestorContent) {
          linhas.push('▸ VERSÃO BASE TOTVS (ancestor — ponto de partida, ANTES das mudanças de qualquer lado):');
          linhas.push('```advpl');
          linhas.push(seg.ancestorContent.slice(0, 2500));
          if (seg.ancestorContent.length > 2500) linhas.push('\n[... código continua — truncado para análise ...]');
          linhas.push('```');
          linhas.push('');
        }

        if (seg.totvsContent !== null) {
          linhas.push('▸ NOVA VERSÃO TOTVS (o que a TOTVS modificou neste release):');
          linhas.push('```advpl');
          linhas.push(seg.totvsContent.slice(0, 2500));
          if (seg.totvsContent.length > 2500) linhas.push('\n[... código continua — truncado para análise ...]');
          linhas.push('```');
        } else {
          linhas.push('▸ NOVA VERSÃO TOTVS: ⚠ BLOCO REMOVIDO — a TOTVS deletou esta função/bloco nesta versão.');
        }
        linhas.push('');

        linhas.push('▸ VERSÃO DA EMPRESA (customização que a empresa havia aplicado):');
        if (seg.empresaContent !== null) {
          linhas.push('```advpl');
          linhas.push(seg.empresaContent.slice(0, 2500));
          if (seg.empresaContent.length > 2500) linhas.push('\n[... código continua — truncado para análise ...]');
          linhas.push('```');
        } else {
          linhas.push('⚠ A empresa havia REMOVIDO este bloco da sua versão customizada.');
        }
        linhas.push('');

        if (resolved) {
          linhas.push('▸ RESOLUÇÃO DA IA (código final gerado e incorporado ao merge):');
          linhas.push('```advpl');
          linhas.push(resolved.slice(0, 2500));
          if (resolved.length > 2500) linhas.push('\n[... código continua — truncado para análise ...]');
          linhas.push('```');
        }
        linhas.push('');
        linhas.push('─────────────────────────────────────────────────────');
        linhas.push('');
      }
    }

    // Company customization blocks with code
    if (empresaSegs.length > 0) {
      linhas.push('═══════════════════ CUSTOMIZAÇÕES DA EMPRESA (sem conflito) ═══════════════════');
      linhas.push('Estas funções foram modificadas pela empresa e não foram tocadas pela TOTVS neste release.');
      linhas.push('');
      for (const seg of empresaSegs.slice(0, 12)) {
        linhas.push(`▸ ${seg.blockName}:`);
        linhas.push('```advpl');
        linhas.push(seg.content.slice(0, 1200));
        if (seg.content.length > 1200) linhas.push('\n[... truncado ...]');
        linhas.push('```');
        linhas.push('');
      }
      if (empresaSegs.length > 12) {
        linhas.push(`... e mais ${empresaSegs.length - 12} customizações: ${empresaSegs.slice(12).map((s) => s.blockName).join(', ')}`);
        linhas.push('');
      }
    }

    linhas.push('═══════════════════ INSTRUÇÕES PARA SUA RESPOSTA ═══════════════════');
    linhas.push('Responda APENAS com JSON válido (sem markdown antes/depois). Estrutura:');
    linhas.push(JSON.stringify({
      visao_geral_arquivo: 'String: descreva o papel deste arquivo no ecossistema TOTVS Protheus. Qual módulo? Qual integração? (NF-e, SPED, TSS, financeiro, etc.)',
      resumo_executivo: 'String: 4-6 parágrafos. Contexto geral do merge, quais foram as principais mudanças da TOTVS neste release, quais as customizações mais importantes da empresa, avaliação de risco geral, recomendação de validação.',
      conflitos: conflictSegs.map((s) => ({
        nome: s.blockName,
        descricao_funcao: 'O que esta função faz no sistema, qual seu papel técnico e de negócio',
        analise_mudanca_totvs: 'DETALHE o que a TOTVS mudou: quais variáveis, chamadas, lógicas, parâmetros foram adicionados/removidos/alterados. Se possível, mencione o motivo (nova legislação, correção de bug, nova integração, etc.)',
        analise_customizacao_empresa: 'DETALHE o que a empresa customizou: qual lógica de negócio foi adicionada, quais campos ou variáveis específicos da empresa, qual era o propósito desta customização',
        analise_conflito: 'EXPLIQUE concretamente por que conflitou: quais trechos específicos de código colidiram, qual é a incompatibilidade fundamental entre a mudança TOTVS e a customização da empresa',
        analise_resolucao: 'DETALHE como a IA resolveu: qual estratégia foi usada, o que foi preservado de cada lado (TOTVS e empresa), quais tradeoffs foram feitos, se alguma customização pode ter sido parcialmente perdida',
        impacto_sistema: 'Quais outros processos/módulos do ERP são afetados por esta função. Impactos fiscais, contábeis, de integração.',
        referencias_totvs: 'Se aplicável: padrões TOTVS conhecidos usados (MVC, query SQL padrão, integração SEF, TSS, TEC, RTC), ou fontes relacionados onde funções similares existem (ex: "similar ao MATA460.PRW")',
        risco: 'baixo|médio|alto',
        risco_justificativa: 'Por que este nível de risco. O que especificamente pode falhar. Cenários de erro.',
        testes_obrigatorios: ['Cenário específico 1 para testar', 'Cenário específico 2', 'etc.'],
        pontos_atencao: ['Ponto específico de atenção 1', 'etc.'],
      })),
      customizacoes_detalhadas: empresaSegs.slice(0, 14).map((s) => ({
        nome: s.blockName,
        descricao: 'O que esta função faz',
        natureza_customizacao: 'O que especificamente a empresa customizou e por que (integração, regra de negócio, validação, etc.)',
        impacto_negocial: 'Qual processo de negócio depende desta customização',
        classificacao: 'fiscal|integracao|relatorio|validacao|outro',
        risco_proxima_atualizacao: 'Qual a probabilidade e impacto desta customização conflitar na próxima atualização TOTVS',
      })),
      recomendacoes: ['Ação concreta 1 ordenada por prioridade', 'Ação 2', '...'],
      plano_testes: ['Teste específico 1 com cenário concreto', 'Teste 2', '...'],
      conclusao: 'Parágrafo final: avaliação geral do merge, confiança na resolução, recomendação para o time.',
    }, null, 2));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: linhas.join('\n') }],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text.trim() : '';
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(cleaned) as MergeAnalysisJson;

    return buildAnaliseHtml(parsed, conflictSegs, resolvedMap, empresaSegs, stats, empresaNome, fonteNome, dataStr);
  } catch (err) {
    logger.warn({ err }, 'generateMergeAnalysis: falha — usando fallback');
    return buildAnaliseHtml(makeFallback(), conflictSegs, resolvedMap, empresaSegs, stats, empresaNome, fonteNome, dataStr);
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
