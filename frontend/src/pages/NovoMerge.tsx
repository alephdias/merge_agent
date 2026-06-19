import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmpresas } from '../hooks/useEmpresas';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import type { MergeJob } from '../types';

export function NovoMerge() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { empresas } = useEmpresas();
  const { user } = useAuth();

  const presetId = user?.empresa_id ?? params.get('empresa_id') ?? '';
  const isAdmin = user?.empresa_id === null;

  const [empresaId, setEmpresaId] = useState(presetId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!empresaId) { setError('Selecione uma empresa'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<MergeJob>('/merges', { empresa_id: empresaId });
      nav(`/merges/${data.id}/relatorio`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar merge');
      setLoading(false);
    }
  }

  const selectedEmpresa = empresas.find((e) => e.id === empresaId);

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif' }}>

      <button onClick={() => nav(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: 0, marginBottom: 24, fontFamily: 'Inter, sans-serif' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Voltar
      </button>

      <div style={{ maxWidth: 560 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#111827' }}>Novo Merge</h2>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>
          O sistema selecionará automaticamente as versões mais recentes da Biblioteca TOTVS e o fonte da empresa.
        </p>

        {/* Info card */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 24 }}>
          <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="1.75" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8', lineHeight: 1.5 }}>
            O merge analisa a diferença entre as duas últimas versões TOTVS e aplica as customizações do fonte da empresa. O resultado estará disponível para download após o processamento.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Empresa</label>
              {isAdmin ? (
                <select
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  required
                  style={{
                    height: 42, padding: '0 12px', fontSize: 14, color: '#111827',
                    background: '#fff', borderRadius: 8, outline: 'none',
                    border: '1.5px solid #e5e7eb', fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' fill='none' stroke='%236b7280' stroke-width='1.5' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    paddingRight: 36,
                  }}
                >
                  <option value="">Selecione uma empresa…</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </select>
              ) : (
                <div style={{ height: 42, padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#374151', background: '#f9fafb', borderRadius: 8, border: '1.5px solid #e5e7eb' }}>
                  {selectedEmpresa?.nome ?? empresaId}
                </div>
              )}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <svg width="13" height="13" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 44, borderRadius: 8, border: 'none',
                background: loading ? '#93c5fd' : '#2563eb',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = '#1d4ed8'; } }}
              onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = '#2563eb'; } }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Iniciando merge…
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Executar Merge
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
