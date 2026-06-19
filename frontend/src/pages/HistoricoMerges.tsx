import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMergeJobs } from '../hooks/useMerge';
import { formatDateTime } from '../utils/formatters';
import type { MergeJob, MergeJobStatus } from '../types';

const STATUS_META: Record<MergeJobStatus, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Na fila',      bg: '#f3f4f6', color: '#374151' },
  processing: { label: 'Processando', bg: '#eff6ff', color: '#2563eb' },
  done:       { label: 'Concluído',   bg: '#f0fdf4', color: '#16a34a' },
  error:      { label: 'Erro',        bg: '#fef2f2', color: '#dc2626' },
};

function StatusBadge({ status }: { status: MergeJobStatus }) {
  const m = STATUS_META[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: m.bg, color: m.color,
      fontSize: 12, fontWeight: 500,
    }}>
      {status === 'processing' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="rgba(37,99,235,0.25)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {m.label}
    </span>
  );
}

function LinkBtn({ onClick, children, primary }: { onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        height: 28, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', border: primary ? 'none' : '1px solid #e5e7eb',
        background: primary ? '#2563eb' : 'transparent', color: primary ? '#fff' : '#6b7280',
        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = primary ? '#1d4ed8' : '#f3f4f6'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = primary ? '#2563eb' : 'transparent'; }}
    >
      {children}
    </button>
  );
}

export function HistoricoMerges() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const empresaId = params.get('empresa_id') ?? undefined;
  const { jobs, loading, error } = useMergeJobs(empresaId);

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>Histórico de Merges</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{jobs.length} job{jobs.length !== 1 ? 's' : ''} registrado{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => nav('/merges/novo')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 38, padding: '0 16px', borderRadius: 8,
            border: 'none', background: '#2563eb', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Merge
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {error && <p style={{ padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>{error}</p>}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Nenhum merge realizado ainda.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Job ID', 'Status', 'Criado em', 'Concluído em', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j: MergeJob, idx) => (
                <tr
                  key={j.id}
                  style={{ borderBottom: idx < jobs.length - 1 ? '1px solid #f9fafb' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={(el) => { el.currentTarget.style.background = '#f8faff'; }}
                  onMouseLeave={(el) => { el.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                      {j.id.slice(0, 8)}…
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}><StatusBadge status={j.status} /></td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(j.created_at)}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(j.completed_at)}</td>
                  <td style={{ padding: '12px 20px' }}>
                    {j.status === 'done' && (
                      <LinkBtn onClick={() => nav(`/merges/${j.id}/relatorio`)} primary>Ver relatório</LinkBtn>
                    )}
                    {(j.status === 'processing' || j.status === 'pending') && (
                      <LinkBtn onClick={() => nav(`/merges/${j.id}/relatorio`)}>Acompanhar</LinkBtn>
                    )}
                    {j.status === 'error' && (
                      <span style={{ fontSize: 12, color: '#dc2626' }}>{j.error_message ?? 'Erro'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
