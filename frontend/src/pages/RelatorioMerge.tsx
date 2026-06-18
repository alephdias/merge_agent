import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatDateTime } from '../utils/formatters';
import api from '../services/api';
import type { MergeJob } from '../types';

const STATUS_LABELS: Record<string, string> = {
  pending:    'Na fila',
  processing: 'Processando…',
  done:       'Concluído',
  error:      'Erro',
};

export function RelatorioMerge() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [job, setJob] = useState<MergeJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [downloading, setDownloading] = useState(false);

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

  // Auto-poll while job is running
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return;
    const timer = setInterval(() => { void loadJob(); }, 3000);
    return () => clearInterval(timer);
  }, [job, loadJob]);

  async function handleDownload() {
    if (!id) return;
    setDownloading(true);
    try {
      const { data: blob } = await api.get<Blob>(`/merges/${id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `merge_${id.slice(0, 8)}.prw`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '12px 24px 24px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}>← Voltar</Button>
          {job?.status === 'done' && (
            <Button size="sm" loading={downloading} onClick={() => void handleDownload()}>
              ⬇ Baixar .prw
            </Button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 64 }}>
            <Spinner size={36} />
          </div>
        )}

        {fetchError && <p style={{ color: '#f44336' }}>{fetchError}</p>}

        {job && (
          <>
            {/* Metadata card */}
            <div style={metaCardStyle}>
              <MetaItem label="Job ID">
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{job.id}</span>
              </MetaItem>
              <MetaItem label="Status">
                <Badge label={STATUS_LABELS[job.status] ?? job.status} variant={job.status} />
              </MetaItem>
              <MetaItem label="Criado em">
                {formatDateTime(job.created_at)}
              </MetaItem>
              {job.completed_at && (
                <MetaItem label="Concluído em">
                  {formatDateTime(job.completed_at)}
                </MetaItem>
              )}
            </div>

            {/* Pending / processing */}
            {(job.status === 'pending' || job.status === 'processing') && (
              <div style={stateBoxStyle}>
                <Spinner size={40} />
                <p style={{ marginTop: 18, color: '#555', fontSize: 15 }}>
                  {job.status === 'pending'
                    ? 'Aguardando na fila de processamento…'
                    : 'Executando merge com análise de IA — pode levar alguns instantes'}
                </p>
                <p style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>Atualizando automaticamente a cada 3 segundos</p>
              </div>
            )}

            {/* Error */}
            {job.status === 'error' && (
              <div style={{ background: '#ffebee', borderRadius: 8, padding: 20, border: '1px solid #ef9a9a' }}>
                <strong style={{ color: '#c62828' }}>Erro no processamento</strong>
                <p style={{ color: '#b71c1c', fontSize: 14, marginTop: 8, fontFamily: 'monospace' }}>
                  {job.error_message ?? 'Erro desconhecido'}
                </p>
              </div>
            )}

            {/* Report iframe */}
            {job.status === 'done' && job.relatorio_html && (
              <div style={{ flex: 1, background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                <iframe
                  srcDoc={job.relatorio_html}
                  title="Relatório de Merge"
                  style={{ width: '100%', height: 'calc(100vh - 230px)', border: 'none', display: 'block' }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}

            {job.status === 'done' && !job.relatorio_html && (
              <p style={{ color: '#888', fontSize: 14 }}>Relatório não disponível para este job.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

const metaCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: '12px 20px',
  marginBottom: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
  display: 'flex',
  gap: 32,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const stateBoxStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: '48px 24px',
  textAlign: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
};
