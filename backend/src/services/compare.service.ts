import Anthropic from '@anthropic-ai/sdk';
import { diffLines } from 'diff';
import { env } from '../config/env';
import { downloadFile } from '../config/storage';
import * as totvsRepo from '../repositories/totvs.repository';
import { NotFoundError } from '../errors/AppError';
import type { BibliotecaTotvs } from '../types';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface CompareAnalysis {
  adicionado: string[];
  removido: string[];
  alterado: string[];
  mantido: string[];
  resumo: string;
}

export interface CompareResult {
  v1: BibliotecaTotvs;
  v2: BibliotecaTotvs;
  oldCode: string;
  newCode: string;
  stats: { added: number; removed: number; unchanged: number };
  analysis: CompareAnalysis;
}

export async function compareTotvsVersions(id1: string, id2: string): Promise<CompareResult> {
  const [r1, r2] = await Promise.all([
    totvsRepo.findById(id1),
    totvsRepo.findById(id2),
  ]);
  if (!r1) throw new NotFoundError('Versão v1 não encontrada');
  if (!r2) throw new NotFoundError('Versão v2 não encontrada');

  // v1 = mais antigo (anterior), v2 = mais novo
  const [v1, v2] = new Date(r1.data_upload) <= new Date(r2.data_upload)
    ? [r1, r2]
    : [r2, r1];

  const [buf1, buf2] = await Promise.all([
    downloadFile(v1.storage_path),
    downloadFile(v2.storage_path),
  ]);

  const oldCode = buf1.toString('utf-8');
  const newCode = buf2.toString('utf-8');

  // Computa stats e diff compacto para enviar ao Claude
  const changes = diffLines(oldCode, newCode);
  let added = 0, removed = 0, unchanged = 0;
  const unifiedLines: string[] = [];

  for (const change of changes) {
    const count = (change.value.match(/\n/g) ?? []).length;
    if (change.added) {
      added += count;
      change.value.split('\n').forEach((l) => { if (l) unifiedLines.push(`+ ${l}`); });
    } else if (change.removed) {
      removed += count;
      change.value.split('\n').forEach((l) => { if (l) unifiedLines.push(`- ${l}`); });
    } else {
      unchanged += count;
      const lines = change.value.split('\n').filter(Boolean);
      if (lines.length <= 4) {
        lines.forEach((l) => unifiedLines.push(`  ${l}`));
      } else {
        lines.slice(0, 2).forEach((l) => unifiedLines.push(`  ${l}`));
        unifiedLines.push(`  [... ${lines.length - 4} linhas sem alteração ...]`);
        lines.slice(-2).forEach((l) => unifiedLines.push(`  ${l}`));
      }
    }
  }

  const analysis = await analyzeWithClaude(v1, v2, unifiedLines.join('\n').slice(0, 14000));

  return { v1, v2, oldCode, newCode, stats: { added, removed, unchanged }, analysis };
}

async function analyzeWithClaude(
  v1: BibliotecaTotvs,
  v2: BibliotecaTotvs,
  diffText: string,
): Promise<CompareAnalysis> {
  const fallback: CompareAnalysis = {
    adicionado: [],
    removido: [],
    alterado: [],
    mantido: [],
    resumo: 'Não foi possível gerar análise automática para esta comparação.',
  };

  try {
    const prompt = `Você é um especialista em AdvPL/TLPP. Analise o diff abaixo entre duas versões do fonte TOTVS padrão "${v1.nome_arquivo}".

Versão anterior (v1): pacote "${v1.numero_pacote ?? 'sem número'}" — ${String(v1.data_pacote ?? v1.data_upload).slice(0, 10)}
${v1.descricao ? `Descrição v1: ${v1.descricao}` : ''}

Versão nova (v2): pacote "${v2.numero_pacote ?? 'sem número'}" — ${String(v2.data_pacote ?? v2.data_upload).slice(0, 10)}
${v2.descricao ? `Descrição v2: ${v2.descricao}` : ''}

DIFF (+ adicionado, - removido, espaço = inalterado):
\`\`\`
${diffText}
\`\`\`

Retorne APENAS um JSON válido, sem markdown, sem texto extra:
{
  "adicionado": ["descreva cada item novo adicionado na v2", ...],
  "removido": ["descreva cada item removido da v1", ...],
  "alterado": ["descreva cada item que foi modificado entre as versões", ...],
  "mantido": ["principais funções/blocos que permaneceram idênticos", ...],
  "resumo": "parágrafo de 2-3 frases explicando o propósito das mudanças e o impacto para quem faz merge com fontes customizados"
}`;

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content.find((c) => c.type === 'text');
    const text = raw?.type === 'text' ? raw.text.trim() : '';
    const jsonText = text.startsWith('```')
      ? text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      : text;

    return JSON.parse(jsonText) as CompareAnalysis;
  } catch {
    return fallback;
  }
}
