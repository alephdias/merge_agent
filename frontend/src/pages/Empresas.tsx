import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Spinner } from '../components/ui/Spinner';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useEmpresas } from '../hooks/useEmpresas';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCnpj } from '../utils/formatters';
import api from '../services/api';
import type { Empresa } from '../types';

interface EmpresaForm {
  nome: string;
  cnpj: string;
  slug: string;
}

const EMPTY_FORM: EmpresaForm = { nome: '', cnpj: '', slug: '' };

export function Empresas() {
  const { empresas, loading, error, refetch } = useEmpresas();
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.empresa_id === null;

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EmpresaForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field: keyof EmpresaForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

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
      setForm(EMPTY_FORM);
      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar empresa');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { header: 'Nome', render: (e: Empresa) => e.nome },
    { header: 'CNPJ', render: (e: Empresa) => formatCnpj(e.cnpj) },
    { header: 'Slug', render: (e: Empresa) => e.slug ?? '—' },
    { header: 'Criada em', render: (e: Empresa) => formatDate(e.created_at) },
    {
      header: 'Ações',
      render: (e: Empresa) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => nav(`/empresas/${e.id}`)}>
            Editar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => nav(`/empresas/${e.id}/fontes`)}>
            Fontes
          </Button>
          <Button size="sm" variant="primary" onClick={() => nav(`/merges/novo?empresa_id=${e.id}`)}>
            Merge
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Empresas</h2>
          {isAdmin && (
            <Button onClick={() => setShowModal(true)}>+ Nova Empresa</Button>
          )}
        </div>

        {error && <p style={{ color: '#f44336' }}>{error}</p>}
        {loading ? (
          <Spinner />
        ) : (
          <Table
            columns={columns}
            rows={empresas}
            keyExtractor={(e) => e.id}
            emptyMessage="Nenhuma empresa cadastrada."
          />
        )}
      </main>

      {showModal && (
        <Modal title="Nova Empresa" onClose={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); }}>
          <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Nome *"
              value={form.nome}
              onChange={set('nome')}
              required
              placeholder="Ex: Empresa ABC Ltda"
            />
            <Input
              label="CNPJ"
              value={form.cnpj}
              onChange={set('cnpj')}
              placeholder="Apenas dígitos (14)"
              maxLength={14}
            />
            <Input
              label="Slug (identificador de URL)"
              value={form.slug}
              onChange={set('slug')}
              placeholder="Ex: empresa-abc"
              pattern="[a-z0-9-]+"
            />
            {formError && <p style={{ color: '#f44336', margin: 0, fontSize: 13 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>Salvar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
