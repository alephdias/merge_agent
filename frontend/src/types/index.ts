// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

// ─── Domain entities ───────────────────────────────────────────────────────

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string | null;
  created_at: string;
}

export interface BibliotecaTotvs {
  id: string;
  nome_arquivo: string;
  data_pacote: string | null;
  data_upload: string;
  numero_pacote: string | null;
  descricao: string | null;
  uploaded_by: string;
  uploader_email: string | null;
  hash: string;
  is_latest: boolean;
  is_selected: boolean;
}

export interface FonteEmpresa extends Omit<BibliotecaTotvs, 'id'> {
  id: string;
  empresa_id: string;
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
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string;
}

// ─── API response wrappers ─────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
