import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Spinner } from '../components/ui/Spinner';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useFontes } from '../hooks/useFontes';
import { formatDate, formatDateTime } from '../utils/formatters';
import api from '../services/api';
import type { FonteEmpresa } from '../types';

interface UploadForm {
  arquivo: File | null;
  data_pacote: string;
  numero_pacote: string;
  descricao: string;
}

const EMPTY_FORM: UploadForm = {
  arquivo: null,
  data_pacote: '',
  numero_pacote: '',
  descricao: '',
};

export function FontesEmpresa() {
  const { id: empresaId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { fontes, loading, error, refetch } = useFontes(empresaId ?? '');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UploadForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [saving, setSaving] = useState(false);

  function setText(field: Exclude<keyof UploadForm, 'arquivo'>) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.arquivo || !empresaId) { setFormError('Selecione um arquivo'); return; }
    setSaving(true);
    setFormError('');
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('arquivo', form.arquivo);
      if (form.data_pacote) fd.append('data_pacote', form.data_pacote);
      if (form.numero_pacote) fd.append('numero_pacote', form.numero_pacote);
      if (form.descricao) fd.append('descricao', form.descricao);

      const { data: result, status } = await api.post<{ data: FonteEmpresa; deduplicado: boolean }>(
        `/empresas/${empresaId}/fontes/upload`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      setForm(EMPTY_FORM);
      setShowModal(false);
      setUploadMsg(
        result.deduplicado
          ? `Arquivo já existia para esta empresa (hash idêntico) — nenhum duplicado criado.`
          : `Arquivo "${result.data.nome_arquivo}" enviado com sucesso!`,
      );
      if (status === 201) await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { header: 'Arquivo', render: (r: FonteEmpresa) => r.nome_arquivo },
    { header: 'Data Pacote', render: (r: FonteEmpresa) => formatDate(r.data_pacote) },
    { header: 'Nº Pacote', render: (r: FonteEmpresa) => r.numero_pacote ?? '—' },
    { header: 'Descrição', render: (r: FonteEmpresa) => r.descricao ?? '—' },
    { header: 'Upload', render: (r: FonteEmpresa) => formatDateTime(r.data_upload) },
    {
      header: 'Status',
      render: (r: FonteEmpresa) => r.is_latest ? <Badge label="Atual" color="#4caf50" /> : null,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} style={{ marginBottom: 8 }}>
          ← Voltar
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Fontes da Empresa</h2>
          <Button onClick={() => { setShowModal(true); setUploadMsg(''); }}>
            + Enviar Fonte
          </Button>
        </div>

        {uploadMsg && (
          <p style={{ color: '#1976d2', background: '#e3f2fd', padding: '10px 14px', borderRadius: 6, fontSize: 14 }}>
            {uploadMsg}
          </p>
        )}
        {error && <p style={{ color: '#f44336' }}>{error}</p>}
        {loading ? (
          <Spinner />
        ) : (
          <Table
            columns={columns}
            rows={fontes}
            keyExtractor={(r) => r.id}
            emptyMessage="Nenhum fonte carregado para esta empresa."
          />
        )}
      </main>

      {showModal && (
        <Modal
          title="Enviar Fonte da Empresa"
          onClose={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(''); }}
        >
          <form onSubmit={(e) => void handleUpload(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              Arquivo (.prw / .tlpp / .prx) *
              <input
                type="file"
                accept=".prw,.tlpp,.prx"
                required
                style={{ marginTop: 6, display: 'block' }}
                onChange={(e) => setForm((prev) => ({ ...prev, arquivo: e.target.files?.[0] ?? null }))}
              />
            </label>
            <Input
              label="Data do Pacote"
              type="date"
              value={form.data_pacote}
              onChange={setText('data_pacote')}
            />
            <Input
              label="Número do Pacote"
              value={form.numero_pacote}
              onChange={setText('numero_pacote')}
              placeholder="Ex: v2024.10"
            />
            <Input
              label="Descrição"
              value={form.descricao}
              onChange={setText('descricao')}
              placeholder="Resumo das customizações"
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
              <Button type="submit" loading={saving}>Enviar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#333' };
