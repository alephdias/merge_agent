import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactDiffViewer from 'react-diff-viewer-continued';
import api from '../services/api';
import type { BibliotecaTotvs as Totvs } from '../types';
import { formatDate, formatDateTime } from '../utils/formatters';

interface CompareAnalysis {
  adicionado: string[];
  removido: string[];
  alterado: string[];
  mantido: string[];
  resumo: string;
}

interface CompareResult {
  cmp_id: string;
  v1: Totvs;
  v2: Totvs;
  oldCode: string;
  newCode: string;
  stats: { added: number; removed: number; unchanged: number };
  analysis: CompareAnalysis;
}

interface HistoryItem {
  id: string;
  v1_id: string;
  v2_id: string;
  v1_nome: string;
  v1_pacote: string | null;
  v1_data: string | null;
  v2_nome: string;
  v2_pacote: string | null;
  v2_data: string | null;
  stats: { added: number; removed: number; unchanged: number };
  created_at: string;
}

function StatBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: color + '18', border: `1px solid ${color}30` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'block' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{count}</span>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
    </div>
  );
}

function AnalysisSection({
  title, items, color, icon,
}: {
  title: string; items: string[]; color: string; icon: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title} ({items.length})
        </span>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 18px', listStyle: 'none' }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${color}50` }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionLabel({ v }: { v: Totvs }) {
  return (
    <span style={{ fontSize: 12, color: '#6b7280' }}>
      {v.nome_arquivo}
      {v.numero_pacote ? ` — ${v.numero_pacote}` : ''}
      {v.data_pacote ? ` (${formatDate(v.data_pacote)})` : ''}
    </span>
  );
}

function VersionSelect({
  label, value, onChange, versions, exclude,
}: {
  label: string; value: string; onChange: (v: string) => void;
  versions: Totvs[]; exclude: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 38, padding: '0 12px', fontSize: 13, color: '#111827',
          background: '#fff', borderRadius: 8, outline: 'none',
          fontFamily: 'Inter, sans-serif', cursor: 'pointer', minWidth: 260,
          border: `1.5px solid ${focused ? '#2563eb' : '#e5e7eb'}`,
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <option value="">Selecione uma versão…</option>
        {versions.filter((v) => v.id !== exclude).map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome_arquivo}{v.numero_pacote ? ` — ${v.numero_pacote}` : ''}{v.data_pacote ? ` (${formatDate(v.data_pacote)})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ComparativoTotvs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [versions, setVersions] = useState<Totvs[]>([]);
  const [v1Id, setV1Id] = useState('');
  const [v2Id, setV2Id] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Carrega lista de versões e histórico
  useEffect(() => {
    void api.get<Totvs[]>('/totvs').then(({ data }) => {
      setVersions(data);
      if (data.length >= 2 && !searchParams.get('cmp')) {
        setV1Id(data[data.length - 1].id);
        setV2Id(data[0].id);
      }
    });
    void api.get<HistoryItem[]>('/totvs/comparativos').then(({ data }) => setHistory(data));
  }, []);

  // Restaura do URL na montagem
  useEffect(() => {
    const cmpId = searchParams.get('cmp');
    if (!cmpId) return;
    setLoading(true);
    api.get<CompareResult>(`/totvs/comparativos/${cmpId}`)
      .then(({ data }) => {
        setResult(data);
        setV1Id(data.v1.id);
        setV2Id(data.v2.id);
      })
      .catch(() => setError('Não foi possível restaurar o comparativo.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCompare() {
    if (!v1Id || !v2Id) { setError('Selecione as duas versões'); return; }
    if (v1Id === v2Id) { setError('Selecione versões diferentes'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.get<CompareResult>(`/totvs/compare?v1=${v1Id}&v2=${v2Id}`);
      setResult(data);
      setSearchParams({ cmp: data.cmp_id }, { replace: true });
      // Atualiza histórico local
      void api.get<HistoryItem[]>('/totvs/comparativos').then(({ data: h }) => setHistory(h));
    } catch {
      setError('Erro ao comparar versões. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadHistory(item: HistoryItem) {
    setShowHistory(false);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.get<CompareResult>(`/totvs/comparativos/${item.id}`);
      setResult(data);
      setV1Id(data.v1.id);
      setV2Id(data.v2.id);
      setSearchParams({ cmp: item.id }, { replace: true });
    } catch {
      setError('Erro ao carregar comparativo do histórico.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const { v1, v2, stats, analysis } = result;
    const html = buildReportHtml(v1, v2, stats, analysis);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparativo_${v1.nome_arquivo}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>Comparativo TOTVS</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
            Compare duas versões do fonte padrão TOTVS e entenda o que mudou
          </p>
        </div>
        {history.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                background: showHistory ? '#f3f4f6' : '#fff', color: '#374151',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
              </svg>
              Histórico ({history.length})
            </button>

            {showHistory && (
              <div style={{
                position: 'absolute', right: 0, top: 42, zIndex: 30,
                width: 400, maxHeight: 380, overflowY: 'auto',
                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Comparações anteriores
                </div>
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void handleLoadHistory(item)}
                    style={{
                      width: '100%', padding: '10px 16px', border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f9fafb',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8faff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#111827' }}>
                        {item.v1_nome}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        {item.v1_pacote ?? item.v1_data ?? 'v1'} → {item.v2_pacote ?? item.v2_data ?? 'v2'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>+{item.stats.added}</span>
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>−{item.stats.removed}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{formatDateTime(item.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seletor */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <VersionSelect label="Versão anterior (v1)" value={v1Id} onChange={setV1Id} versions={versions} exclude={v2Id} />

          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8, color: '#9ca3af' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>

          <VersionSelect label="Versão nova (v2)" value={v2Id} onChange={setV2Id} versions={versions} exclude={v1Id} />

          <button
            onClick={() => void handleCompare()}
            disabled={loading || !v1Id || !v2Id}
            style={{
              height: 38, padding: '0 20px', borderRadius: 8, border: 'none',
              background: loading || !v1Id || !v2Id ? '#93c5fd' : '#2563eb',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading || !v1Id || !v2Id ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Analisando…
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
                Comparar
              </>
            )}
          </button>

          {result && (
            <button
              onClick={handleDownload}
              style={{
                height: 38, padding: '0 16px', borderRadius: 8,
                border: '1.5px solid #e5e7eb', background: '#fff',
                color: '#374151', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download relatório
            </button>
          )}
        </div>

        {error && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#dc2626' }}>{error}</p>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            Analisando diferenças e gerando relatório com IA… isso pode levar alguns segundos.
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Barra compacta de stats */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '10px 16px', marginBottom: 12,
            background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
          }}>
            <StatBadge count={result.stats.added} label="adicionadas" color="#16a34a" />
            <StatBadge count={result.stats.removed} label="removidas" color="#dc2626" />
            <StatBadge count={result.stats.unchanged} label="sem mudança" color="#6b7280" />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Só alterações</span>
              <button
                onClick={() => setShowDiffOnly((v) => !v)}
                style={{
                  height: 22, padding: '0 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: '1px solid #e5e7eb', background: showDiffOnly ? '#eff6ff' : '#fff',
                  color: showDiffOnly ? '#2563eb' : '#6b7280', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {showDiffOnly ? 'Ativado' : 'Desativado'}
              </button>
            </div>
          </div>

          {/* Diff viewer + análise IA lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, alignItems: 'start' }}>

            {/* Diff viewer */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <VersionLabel v={result.v1} />
                  </span>
                </div>
                <span style={{ color: '#d1d5db', flexShrink: 0 }}>→</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <VersionLabel v={result.v2} />
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, overflowX: 'auto' }}>
                <ReactDiffViewer
                  oldValue={result.oldCode}
                  newValue={result.newCode}
                  splitView={true}
                  showDiffOnly={showDiffOnly}
                  leftTitle={`v1 — ${result.v1.numero_pacote ?? formatDate(result.v1.data_upload)}`}
                  rightTitle={`v2 — ${result.v2.numero_pacote ?? formatDate(result.v2.data_upload)}`}
                  styles={{
                    variables: {
                      light: {
                        diffViewerBackground: '#fff',
                        addedBackground: '#d1fae5',
                        addedColor: '#065f46',
                        addedGutterBackground: '#a7f3d0',
                        removedBackground: '#fee2e2',
                        removedColor: '#7f1d1d',
                        removedGutterBackground: '#fca5a5',
                        wordAddedBackground: '#6ee7b7',
                        wordRemovedBackground: '#f87171',
                        gutterBackground: '#f9fafb',
                        gutterBackgroundDark: '#f3f4f6',
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Análise IA — sticky */}
            <div style={{ position: 'sticky', top: 80 }}>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 16px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <svg width="14" height="14" fill="none" stroke="#7c3aed" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Análise IA</span>
                </div>

                {result.analysis.resumo && (
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: '#374151', lineHeight: 1.65, padding: '10px 12px', background: '#f8f7ff', borderRadius: 8, borderLeft: '3px solid #7c3aed' }}>
                    {result.analysis.resumo}
                  </p>
                )}

                <AnalysisSection title="Adicionado" items={result.analysis.adicionado} color="#16a34a" icon="+" />
                <AnalysisSection title="Removido" items={result.analysis.removido} color="#dc2626" icon="−" />
                <AnalysisSection title="Alterado" items={result.analysis.alterado} color="#d97706" icon="≈" />
                <AnalysisSection title="Mantido" items={result.analysis.mantido} color="#6b7280" icon="=" />
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── HTML report builder ─────────────────────────────────────────────────────

function buildReportHtml(
  v1: Totvs,
  v2: Totvs,
  stats: { added: number; removed: number; unchanged: number },
  analysis: CompareAnalysis,
): string {
  const section = (title: string, items: string[], color: string) =>
    items.length === 0 ? '' : `
      <h3 style="color:${color};margin:20px 0 8px">${title} (${items.length})</h3>
      <ul style="margin:0;padding-left:20px">
        ${items.map((i) => `<li style="margin-bottom:4px;line-height:1.6">${escHtml(i)}</li>`).join('')}
      </ul>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Comparativo TOTVS — ${escHtml(v1.nome_arquivo)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #111827; }
    h1 { font-size: 22px; margin-bottom: 6px; }
    .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .added { background: #f0fdf4; color: #16a34a; }
    .removed { background: #fef2f2; color: #dc2626; }
    .unchanged { background: #f9fafb; color: #6b7280; }
    .resumo { padding: 14px 16px; background: #f8f7ff; border-left: 3px solid #7c3aed; border-radius: 8px; font-size: 14px; line-height: 1.65; margin-bottom: 24px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    h3 { font-size: 14px; }
    li { font-size: 13px; }
  </style>
</head>
<body>
  <h1>Comparativo TOTVS — ${escHtml(v1.nome_arquivo)}</h1>
  <div class="meta">
    v1: ${escHtml(v1.numero_pacote ?? '')} ${formatDate(v1.data_pacote)} &nbsp;→&nbsp;
    v2: ${escHtml(v2.numero_pacote ?? '')} ${formatDate(v2.data_pacote)}
    &nbsp;&nbsp;|&nbsp;&nbsp;Gerado em ${new Date().toLocaleString('pt-BR')}
  </div>

  <div class="stats">
    <div class="stat added">+${stats.added} adicionadas</div>
    <div class="stat removed">−${stats.removed} removidas</div>
    <div class="stat unchanged">${stats.unchanged} sem mudança</div>
  </div>

  <h2>Análise IA</h2>
  <div class="resumo">${escHtml(analysis.resumo)}</div>

  ${section('Adicionado', analysis.adicionado, '#16a34a')}
  ${section('Removido', analysis.removido, '#dc2626')}
  ${section('Alterado', analysis.alterado, '#d97706')}
  ${section('Mantido', analysis.mantido, '#6b7280')}
</body>
</html>`;
}

function escHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
