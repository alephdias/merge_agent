import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  empresa_id: string | null;
}

export interface AuthRequest extends Request {
  user: AuthUser;
  requestId: string;
}

// ─── Domain entities ──────────────────────────────────────────────────────────

// Tipo público — nunca inclui senha_hash, seguro para retornar ao cliente
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  created_at: Date;
}

// Tipo interno do banco — inclui senha_hash, usado apenas na camada de repositório/serviço de auth
export interface UsuarioDb extends Usuario {
  senha_hash: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string | null;
  created_at: Date;
}

export interface BibliotecaTotvs {
  id: string;
  nome_arquivo: string;
  data_pacote: Date | null;
  data_upload: Date;
  numero_pacote: string | null;
  descricao: string | null;
  uploaded_by: string;
  uploader_email: string | null;
  storage_path: string;
  hash: string;
  is_latest: boolean;
  is_selected: boolean;
}

export interface FonteEmpresa {
  id: string;
  empresa_id: string;
  nome_arquivo: string;
  data_pacote: Date | null;
  data_upload: Date;
  numero_pacote: string | null;
  descricao: string | null;
  uploaded_by: string;
  uploader_email: string | null;
  storage_path: string;
  hash: string;
  is_latest: boolean;
  is_selected: boolean;
}

export type MergeJobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface MergeJob {
  id: string;
  empresa_id: string;
  totvs_v_anterior_id: string | null;
  totvs_v_atual_id: string | null;
  fonte_empresa_id: string;
  status: MergeJobStatus;
  resultado_path: string | null;
  relatorio_html: string | null;
  analise_ia: string | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
  created_by: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}
