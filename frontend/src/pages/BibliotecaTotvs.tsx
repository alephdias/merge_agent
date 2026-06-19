import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateTime } from '../utils/formatters';
import api from '../services/api';
import type { BibliotecaTotvs as Totvs } from '../types';

interface UploadForm {
  arquivo: File | null;
  data_pacote: string;
  numero_pacote: string;
  descricao: string;
}

const EMPTY_FORM: UploadForm = { arquivo: null, data_pacote: '', numero_pacote: '', descricao: '' };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4, borderRadius: 6 }}
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

function FieldInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 40, padding: '0 12px', fontSize: 14, color: '#111827', background: '#fff',
          borderRadius: 8, outline: 'none', fontFamily: 'Inter, sans-serif',
          border: `1.5px solid ${focused ? '#2563eb' : '#e5e7eb'}`,
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
    </div>
  );
}

export function BibliotecaTotvs() {
  const { user } = useAuth();
  const isAdmin = user?.empresa_id === null;

  const [list, setList] = useState<Totvs[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UploadForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Totvs[]>('/totvs');
      setList(data);
    } catch {
      setError('Erro ao carregar biblioteca');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.arquivo) { setFormError('Selecione um arquivo'); return; }
    setSaving(true);
    setFormError('');
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('arquivo', form.arquivo);
      if (form.data_pacote) fd.append('data_pacote', form.data_pacote);
      if (form.numero_pacote) fd.append('numero_pacote', form.numero_pacote);
      if (form.descricao) fd.append('descricao', form.descricao);

      const { data: result, status } = await api.post<{ data: Totvs; deduplicado: boolean }>(
        '/totvs/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setForm(EMPTY_FORM);
      setShowModal(false);
      setUploadMsg(result.deduplicado
        ? 'Arquivo já existia na biblioteca (hash idêntico) — nenhum duplicado criado.'
        : `Arquivo "${result.data.nome_arquivo}" enviado com sucesso!`);
      if (status === 201) await loadList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>Biblioteca TOTVS</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{list.length} versão{list.length !== 1 ? 'ões' : ''} disponível{list.length !== 1 ? 'eis' : ''}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowModal(true); setUploadMsg(''); }}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Enviar Versão
          </button>
        )}
      </div>

      {uploadMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 20 }}>
          <svg width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span style={{ fontSize: 13, color: '#1d4ed8' }}>{uploadMsg}</span>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {error && <p style={{ padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>{error}</p>}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Nenhuma versão TOTVS carregada.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Arquivo', 'Data Pacote', 'Nº Pacote', 'Descrição', 'Upload', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, idx) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: idx < list.length - 1 ? '1px solid #f9fafb' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={(el) => { el.currentTarget.style.background = '#f8faff'; }}
                  onMouseLeave={(el) => { el.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" fill="none" stroke="#2563eb" strokeWidth="1.75" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.nome_arquivo}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280' }}>{formatDate(r.data_pacote)}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280' }}>{r.numero_pacote ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(r.data_upload)}</td>
                  <td style={{ padding: '12px 20px' }}>
                    {r.is_latest && (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600 }}>Atual</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="Enviar Versão TOTVS" onClose={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); }}>
          <form onSubmit={(e) => void handleUpload(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Arquivo (.prw / .tlpp / .prx) *</label>
              <div style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                <input
                  type="file" accept=".prw,.tlpp,.prx" required
                  style={{ display: 'none' }}
                  id="file-input-totvs"
                  onChange={(e) => setForm((prev) => ({ ...prev, arquivo: e.target.files?.[0] ?? null }))}
                />
                <label htmlFor="file-input-totvs" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  {form.arquivo
                    ? <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{form.arquivo.name}</span>
                    : <span style={{ fontSize: 13, color: '#9ca3af' }}>Clique para selecionar</span>
                  }
                </label>
              </div>
            </div>
            <FieldInput label="Data do Pacote" type="date" value={form.data_pacote} onChange={(v) => setForm((p) => ({ ...p, data_pacote: v }))} />
            <FieldInput label="Número do Pacote" value={form.numero_pacote} onChange={(v) => setForm((p) => ({ ...p, numero_pacote: v }))} placeholder="Ex: 12.1.33" />
            <FieldInput label="Descrição" value={form.descricao} onChange={(v) => setForm((p) => ({ ...p, descricao: v }))} placeholder="Resumo das alterações" />
            {formError && (
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{formError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                style={{ height: 38, padding: '0 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                style={{ height: 38, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                {saving ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
