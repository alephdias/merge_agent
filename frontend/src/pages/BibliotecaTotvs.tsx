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

function DescricaoCell({ texto }: { texto: string | null }) {
  const [open, setOpen] = useState(false);
  if (!texto) return <span style={{ color: '#d1d5db' }}>—</span>;
  const truncado = texto.length > 40;
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        {truncado ? `${texto.slice(0, 40)}…` : texto}
      </span>
      {truncado && (
        <>
          <button
            onClick={() => setOpen(true)}
            style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            ver
          </button>
          {open && (
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Descrição completa</span>
                  <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{texto}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DeleteBtn({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#dc2626', whiteSpace: 'nowrap' }}>Excluir?</span>
        <button
          onClick={() => { setConfirm(false); onConfirm(); }}
          disabled={loading}
          style={{ height: 24, padding: '0 8px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          Sim
        </button>
        <button
          onClick={() => setConfirm(false)}
          style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Excluir"
      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
    >
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    </button>
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

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

  async function handleSelect(id: string) {
    setSelecting(id);
    try {
      const { data: updated } = await api.put<Totvs>(`/totvs/${id}/select`);
      setList((prev) => prev.map((r) =>
        r.nome_arquivo === updated.nome_arquivo
          ? { ...r, is_selected: r.id === id ? updated.is_selected : false }
          : r,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar seleção');
    } finally {
      setSelecting(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.delete(`/totvs/${id}`);
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir arquivo');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>Biblioteca TOTVS</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
            {list.length} {list.length !== 1 ? 'versões disponíveis' : 'versão disponível'}
          </p>
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

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', overflowX: 'auto' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
            <svg width="13" height="13" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
          </div>
        )}

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
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 160 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 145 }} />
              <col style={{ width: 135 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Arquivo', 'Data Pacote', 'Nº Pacote', 'Descrição', 'Upload por', 'Enviado em', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
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
                  {/* Arquivo */}
                  <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" fill="none" stroke="#2563eb" strokeWidth="1.75" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome_arquivo}</span>
                    </div>
                  </td>

                  {/* Data Pacote */}
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(r.data_pacote)}</td>

                  {/* Nº Pacote */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.numero_pacote ?? '—'}</td>

                  {/* Descrição */}
                  <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                    <DescricaoCell texto={r.descricao} />
                  </td>

                  {/* Upload por */}
                  <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(r.uploader_email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.uploader_email ?? '—'}</span>
                    </div>
                  </td>

                  {/* Enviado em */}
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(r.data_upload)}</td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      {r.is_selected && (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, border: '1px solid #bfdbfe' }}>
                          ★ Selecionado
                        </span>
                      )}
                      {r.is_latest && !r.is_selected && (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600 }}>
                          Mais recente
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isAdmin && (
                        <button
                          onClick={() => void handleSelect(r.id)}
                          disabled={selecting === r.id}
                          title={r.is_selected ? 'Remover seleção (volta ao mais recente)' : 'Usar este como fonte principal para merges'}
                          style={{
                            height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: selecting === r.id ? 'not-allowed' : 'pointer',
                            border: r.is_selected ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                            background: r.is_selected ? '#eff6ff' : 'transparent',
                            color: r.is_selected ? '#2563eb' : '#6b7280',
                            fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => { if (!r.is_selected) { e.currentTarget.style.background = '#f3f4f6'; } }}
                          onMouseLeave={(e) => { if (!r.is_selected) { e.currentTarget.style.background = 'transparent'; } }}
                        >
                          {selecting === r.id ? '...' : r.is_selected ? '✓ Em uso' : 'Usar este'}
                        </button>
                      )}
                      {isAdmin && (
                        <DeleteBtn
                          onConfirm={() => void handleDelete(r.id)}
                          loading={deleting === r.id}
                        />
                      )}
                    </div>
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
              <div style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '16px', textAlign: 'center', background: '#f9fafb' }}>
                <input type="file" accept=".prw,.tlpp,.prx" required style={{ display: 'none' }} id="file-input-totvs"
                  onChange={(e) => setForm((prev) => ({ ...prev, arquivo: e.target.files?.[0] ?? null }))} />
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
            {formError && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{formError}</p>}
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
