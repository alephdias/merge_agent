import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { useEmpresas } from '../hooks/useEmpresas';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import type { MergeJob } from '../types';

export function NovoMerge() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { empresas } = useEmpresas();
  const { user } = useAuth();

  // Non-admin: empresa pre-filled from JWT and locked
  const presetId = user?.empresa_id ?? params.get('empresa_id') ?? '';
  const isAdmin  = user?.empresa_id === null;

  const [empresaId, setEmpresaId] = useState(presetId);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!empresaId) { setError('Selecione uma empresa'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<MergeJob>('/merges', { empresa_id: empresaId });
      // Navigate directly to the report page — it polls until done
      nav(`/merges/${data.id}/relatorio`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar merge');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <main style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} style={{ marginBottom: 12 }}>
          ← Voltar
        </Button>
        <h2 style={{ marginTop: 0 }}>Novo Merge</h2>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
            O sistema selecionará automaticamente as duas últimas versões da Biblioteca TOTVS
            e o fonte mais recente da empresa para executar o merge.
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500 }}>
              Empresa
              {isAdmin ? (
                <select
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  required
                  style={selectStyle}
                >
                  <option value="">Selecione…</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </select>
              ) : (
                <input
                  readOnly
                  value={empresas.find((e) => e.id === empresaId)?.nome ?? empresaId}
                  style={{ ...selectStyle, background: '#f5f5f5', cursor: 'not-allowed' }}
                />
              )}
            </label>

            {error && <p style={{ color: '#f44336', margin: 0, fontSize: 13 }}>{error}</p>}

            <Button type="submit" loading={loading} style={{ marginTop: 4 }}>
              Executar Merge
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid #ccc',
  fontSize: 14,
  background: '#fff',
};
