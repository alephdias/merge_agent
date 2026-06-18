import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Spinner } from '../components/ui/Spinner';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useMergeJobs } from '../hooks/useMerge';
import { formatDateTime } from '../utils/formatters';
import type { MergeJob } from '../types';

const STATUS_LABELS: Record<string, string> = {
  pending:    'Na fila',
  processing: 'Processando',
  done:       'Concluído',
  error:      'Erro',
};

export function HistoricoMerges() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const empresaId = params.get('empresa_id') ?? undefined;
  const { jobs, loading, error } = useMergeJobs(empresaId);

  const columns = [
    {
      header: 'Job ID',
      render: (j: MergeJob) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{j.id.slice(0, 8)}…</span>
      ),
    },
    {
      header: 'Status',
      render: (j: MergeJob) => (
        <Badge label={STATUS_LABELS[j.status] ?? j.status} variant={j.status} />
      ),
    },
    { header: 'Criado em',    render: (j: MergeJob) => formatDateTime(j.created_at) },
    { header: 'Concluído em', render: (j: MergeJob) => formatDateTime(j.completed_at) },
    {
      header: 'Ações',
      render: (j: MergeJob) => {
        if (j.status === 'done') {
          return (
            <Button size="sm" variant="ghost" onClick={() => nav(`/merges/${j.id}/relatorio`)}>
              Ver relatório
            </Button>
          );
        }
        if (j.status === 'error') {
          return (
            <span style={{ color: '#f44336', fontSize: 12 }}>{j.error_message ?? 'Erro'}</span>
          );
        }
        if (j.status === 'processing' || j.status === 'pending') {
          return (
            <Button size="sm" variant="ghost" onClick={() => nav(`/merges/${j.id}/relatorio`)}>
              Acompanhar
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Histórico de Merges</h2>
          <Button size="sm" onClick={() => nav('/merges/novo')}>+ Novo Merge</Button>
        </div>
        {error && <p style={{ color: '#f44336' }}>{error}</p>}
        {loading ? (
          <Spinner />
        ) : (
          <Table
            columns={columns}
            rows={jobs}
            keyExtractor={(j) => j.id}
            emptyMessage="Nenhum merge realizado."
          />
        )}
      </main>
    </div>
  );
}
