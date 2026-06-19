import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmpresas } from '../hooks/useEmpresas';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCnpj } from '../utils/formatters';
import api from '../services/api';
import type { Empresa } from '../types';

const EMPTY = { nome: '', cnpj: '', slug: '' };

function InitialAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
  const i = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: colors[i],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4, borderRadius: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none'; }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, pattern, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; pattern?: string; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        pattern={pattern}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 40, padding: '0 12px', fontSize: 14, color: '#111827',
          background: '#fff', borderRadius: 8, outline: 'none',
          border: `1.5px solid ${focused ? '#2563eb' : '#e5e7eb'}`,
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
    </div>
  );
}

export function Empresas() {
  const { empresas, loading, error, refetch } = useEmpresas();
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.empresa_id === null;

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post<Empresa>('/empresas', {
        nome: form.nome,
        cnpj: form.cnpj || undefined,
        slug: form.slug || undefined,
      });
      setForm(EMPTY);
      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar empresa');
    } finally {
      setSaving(false);
    }
  }

  const recentes = empresas.slice(0, 4);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%', fontFamily: 'Inter, sans-serif' }}>

      {/* Header da página */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>Empresas</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 38, padding: '0 16px', borderRadius: 8,
              border: 'none', background: '#2563eb', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nova Empresa
          </button>
        )}
      </div>

      {/* Acesso Rápido */}
      {!loading && recentes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Acesso Rápido
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {recentes.map((e) => (
              <div
                key={e.id}
                onClick={() => nav(`/empresas/${e.id}`)}
                style={{
                  background: '#fff', borderRadius: 12, padding: '16px',
                  border: '1px solid #e5e7eb', cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
                onMouseEnter={(el) => { el.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; el.currentTarget.style.borderColor = '#d1d5db'; }}
                onMouseLeave={(el) => { el.currentTarget.style.boxShadow = 'none'; el.currentTarget.style.borderColor = '#e5e7eb'; }}
              >
                <InitialAvatar name={e.nome} size={40} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nome}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>{e.slug ?? formatDate(e.created_at)}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <ActionBtn onClick={(ev) => { ev.stopPropagation(); nav(`/empresas/${e.id}/fontes`); }} label="Fontes" />
                  <ActionBtn onClick={(ev) => { ev.stopPropagation(); nav(`/merges/novo?empresa_id=${e.id}`); }} label="Merge" primary />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de todas as empresas */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>Todas as Empresas</p>
        </div>

        {error && <p style={{ padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>{error}</p>}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : empresas.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Nenhuma empresa cadastrada.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Empresa', 'CNPJ', 'Slug', 'Criada em', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.map((e, idx) => (
                <tr
                  key={e.id}
                  style={{ borderBottom: idx < empresas.length - 1 ? '1px solid #f9fafb' : 'none', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={(el) => { el.currentTarget.style.background = '#f8faff'; }}
                  onMouseLeave={(el) => { el.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <InitialAvatar name={e.nome} size={30} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{e.nome}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280' }}>{formatCnpj(e.cnpj) || '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{e.slug ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(e.created_at)}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <TableBtn onClick={() => nav(`/empresas/${e.id}`)}>Editar</TableBtn>
                      <TableBtn onClick={() => nav(`/empresas/${e.id}/fontes`)}>Fontes</TableBtn>
                      <TableBtn onClick={() => nav(`/merges/novo?empresa_id=${e.id}`)} primary>Merge</TableBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title="Nova Empresa" onClose={() => { setShowModal(false); setForm(EMPTY); setFormError(''); }}>
          <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FieldInput label="Nome *" value={form.nome} onChange={(v) => setForm((p) => ({ ...p, nome: v }))} placeholder="Ex: Empresa ABC Ltda" />
            <FieldInput label="CNPJ" value={form.cnpj} onChange={(v) => setForm((p) => ({ ...p, cnpj: v }))} placeholder="Apenas dígitos (14)" maxLength={14} />
            <FieldInput label="Slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} placeholder="ex: empresa-abc" pattern="[a-z0-9-]+" />
            {formError && (
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                {formError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY); }}
                style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                style={{ height: 38, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                {saving ? 'Salvando...' : 'Criar Empresa'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ActionBtn({ onClick, label, primary }: { onClick: (e: React.MouseEvent) => void; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 500,
        cursor: 'pointer', border: primary ? 'none' : '1px solid #e5e7eb',
        background: primary ? '#2563eb' : 'transparent',
        color: primary ? '#fff' : '#6b7280',
        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = primary ? '#1d4ed8' : '#f3f4f6'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = primary ? '#2563eb' : 'transparent'; }}
    >
      {label}
    </button>
  );
}

function TableBtn({ onClick, children, primary }: { onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', border: primary ? 'none' : '1px solid #e5e7eb',
        background: primary ? '#2563eb' : 'transparent',
        color: primary ? '#fff' : '#6b7280',
        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = primary ? '#1d4ed8' : '#f3f4f6'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = primary ? '#2563eb' : 'transparent'; }}
    >
      {children}
    </button>
  );
}
