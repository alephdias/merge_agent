import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCnpj } from '../utils/formatters';
import api from '../services/api';
import type { Empresa } from '../types';

function FieldInput({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 42, padding: '0 12px', fontSize: 14, color: '#111827', background: '#fff',
          borderRadius: 8, outline: 'none', fontFamily: 'Inter, sans-serif',
          border: `1.5px solid ${focused ? '#2563eb' : '#e5e7eb'}`,
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: 160, fontSize: 13, fontWeight: 500, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#111827' }}>{value}</span>
    </div>
  );
}

export function EmpresaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.empresa_id === null;

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nome: '', cnpj: '', slug: '' });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<Empresa>(`/empresas/${id}`)
      .then(({ data }) => {
        setEmpresa(data);
        setForm({ nome: data.nome, cnpj: data.cnpj ?? '', slug: data.slug ?? '' });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put<Empresa>(`/empresas/${id}`, {
        nome: form.nome,
        cnpj: form.cnpj || null,
        slug: form.slug || null,
      });
      setEmpresa(data);
      setEditing(false);
      setSuccess('Empresa atualizada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif' }}>

      <button onClick={() => nav('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: 0, marginBottom: 24, fontFamily: 'Inter, sans-serif' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#111827'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Empresas
      </button>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <div style={{ maxWidth: 640 }}>
          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff',
              }}>
                {(empresa?.nome ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>{empresa?.nome}</h2>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Detalhes da empresa</p>
              </div>
            </div>
            {!editing && (isAdmin || user?.empresa_id === id) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => nav(`/empresas/${id ?? ''}/fontes`)}
                  style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  Fontes
                </button>
                <button
                  onClick={() => setEditing(true)}
                  style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#2563eb', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {!editing ? (
              <div style={{ padding: '4px 24px 8px' }}>
                <InfoRow label="Nome" value={empresa?.nome ?? '—'} />
                <InfoRow label="CNPJ" value={formatCnpj(empresa?.cnpj) || '—'} />
                <InfoRow label="Slug" value={empresa?.slug ?? '—'} />
                <InfoRow label="Criada em" value={formatDate(empresa?.created_at)} />
                {success && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', marginTop: 4 }}>
                    <svg width="14" height="14" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span style={{ fontSize: 13, color: '#16a34a' }}>{success}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 24 }}>
                <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Editar Empresa</p>
                <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <FieldInput label="Nome *" value={form.nome} onChange={(v) => setForm((p) => ({ ...p, nome: v }))} />
                  <FieldInput label="CNPJ" value={form.cnpj} onChange={(v) => setForm((p) => ({ ...p, cnpj: v }))} placeholder="Apenas dígitos (14)" maxLength={14} />
                  <FieldInput label="Slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} placeholder="Ex: empresa-abc" />
                  {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <svg width="13" height="13" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                      <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button type="button" onClick={() => setEditing(false)}
                      style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={saving}
                      style={{ height: 38, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {saving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
