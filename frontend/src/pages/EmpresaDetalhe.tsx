import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCnpj } from '../utils/formatters';
import api from '../services/api';
import type { Empresa } from '../types';

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

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Header />
        <main style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <Spinner size={36} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => nav('/')} style={{ marginBottom: 12 }}>
          ← Voltar
        </Button>

        <div style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          {!editing ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>{empresa?.nome}</h2>
                {(isAdmin || user?.empresa_id === id) && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                )}
              </div>
              <dl style={dlStyle}>
                <div style={rowStyle}>
                  <dt style={dtStyle}>CNPJ</dt>
                  <dd style={ddStyle}>{formatCnpj(empresa?.cnpj)}</dd>
                </div>
                <div style={rowStyle}>
                  <dt style={dtStyle}>Slug</dt>
                  <dd style={ddStyle}>{empresa?.slug ?? '—'}</dd>
                </div>
                <div style={rowStyle}>
                  <dt style={dtStyle}>Criada em</dt>
                  <dd style={ddStyle}>{formatDate(empresa?.created_at)}</dd>
                </div>
              </dl>
              {success && <p style={{ color: '#4caf50', marginTop: 16, fontSize: 14 }}>{success}</p>}
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>Editar Empresa</h2>
              <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Input label="Nome *" value={form.nome} onChange={set('nome')} required />
                <Input label="CNPJ" value={form.cnpj} onChange={set('cnpj')} placeholder="Apenas dígitos" maxLength={14} />
                <Input label="Slug" value={form.slug} onChange={set('slug')} placeholder="Ex: empresa-abc" />
                {error && <p style={{ color: '#f44336', margin: 0, fontSize: 13 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={saving}>Salvar</Button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const dlStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px 8px' };
const rowStyle: React.CSSProperties = { display: 'contents' };
const dtStyle: React.CSSProperties = { fontWeight: 600, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center' };
const ddStyle: React.CSSProperties = { margin: 0, fontSize: 14, display: 'flex', alignItems: 'center' };
