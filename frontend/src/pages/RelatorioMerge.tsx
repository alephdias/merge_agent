import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateTime } from '../utils/formatters';
import api from '../services/api';
import type { MergeJob, MergeJobStatus } from '../types';

const STATUS_META: Record<MergeJobStatus, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Na fila',      bg: '#f3f4f6', color: '#374151' },
  processing: { label: 'Processando', bg: '#eff6ff', color: '#2563eb' },
  done:       { label: 'Concluído',   bg: '#f0fdf4', color: '#16a34a' },
  error:      { label: 'Erro',        bg: '#fef2f2', color: '#dc2626' },
};

export function RelatorioMerge() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [job, setJob]           = useState<MergeJob | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);

  const loadJob = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<MergeJob>(`/merges/${id}`);
      setJob(data);
    } catch {
      setFetchError('Erro ao carregar job de merge');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadJob(); }, [loadJob]);

  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return;
    const timer = setInterval(() => { void loadJob(); }, 3000);
    return () => clearInterval(timer);
  }, [job, loadJob]);

  async function handleDownload() {
    if (!id) return;
    setDownloading(true);
    try {
      const response = await api.get<Blob>(`/merges/${id}/download`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] as string | undefined;
      let filename = `merge_${id.slice(0, 8)}.prw`;
      if (disposition) {
        const match = /filename="?([^";\n]+)"?/.exec(disposition);
        if (match?.[1]) filename = match[1];
      }
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const meta = job ? STATUS_META[job.status] : null;

  if (fullscreen && job?.relatorio_html) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#0f1d3a', color: '#fff', flexShrink: 0 }}>
          <button
            onClick={() => setFullscreen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
            Sair do modo tela cheia
          </button>
          <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', opacity: 0.7 }}>Relatório de Merge</span>
        </div>
        <iframe
          srcDoc={job.relatorio_html}
          title="Relatório de Merge"
          style={{ flex: 1, border: 'none', display: 'block' }}
          sandbox="allow-same-origin"
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => nav(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: 0, fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Voltar
        </button>
        {job?.status === 'done' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFullscreen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 38, padding: '0 16px', borderRadius: 8,
                border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              Tela cheia
            </button>
            <button
              onClick={() => void handleDownload()}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 38, padding: '0 16px', borderRadius: 8,
                border: 'none', background: downloading ? '#93c5fd' : '#2563eb', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}
              onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.background = '#1d4ed8'; }}
              onMouseLeave={(e) => { if (!downloading) e.currentTarget.style.background = '#2563eb'; }}
            >
              {downloading
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>
                : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              }
              {downloading ? 'Baixando…' : 'Baixar .prw'}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {fetchError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <span style={{ fontSize: 13, color: '#dc2626' }}>{fetchError}</span>
        </div>
      )}

      {job && (
        <>
          {/* Metadata strip — compact */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job ID</p>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{job.id}</span>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</p>
              {meta && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 500 }}>
                  {job.status === 'processing' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(37,99,235,0.25)" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {meta.label}
                </span>
              )}
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Criado em</p>
              <span style={{ fontSize: 12, color: '#374151' }}>{formatDateTime(job.created_at)}</span>
            </div>
            {job.completed_at && (
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concluído em</p>
                <span style={{ fontSize: 12, color: '#374151' }}>{formatDateTime(job.completed_at)}</span>
              </div>
            )}
          </div>

          {(job.status === 'pending' || job.status === 'processing') && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '48px 24px', textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px' }}>
                <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="2.5" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <p style={{ margin: '0 0 8px', fontSize: 15, color: '#374151', fontWeight: 500 }}>
                {job.status === 'pending' ? 'Aguardando na fila de processamento…' : 'Executando merge com análise de IA'}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Atualizando automaticamente a cada 3 segundos</p>
            </div>
          )}

          {job.status === 'error' && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fecaca', padding: 24 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Erro no processamento</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', fontFamily: 'monospace', background: '#fef2f2', padding: '8px 10px', borderRadius: 6 }}>
                    {job.error_message ?? 'Erro desconhecido'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Report iframe — maximized */}
          {job.status === 'done' && job.relatorio_html && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px', background: '#f8f9fa', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Relatório de Merge</span>
                <button
                  onClick={() => setFullscreen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif', padding: '3px 8px', borderRadius: 5 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#e9ecef'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'none'; }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  Tela cheia
                </button>
              </div>
              <iframe
                srcDoc={job.relatorio_html}
                title="Relatório de Merge"
                style={{ width: '100%', height: 'calc(100vh - 220px)', border: 'none', display: 'block', minHeight: 500 }}
                sandbox="allow-same-origin"
              />
            </div>
          )}

          {job.status === 'done' && !job.relatorio_html && (
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Relatório não disponível para este job.</p>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
