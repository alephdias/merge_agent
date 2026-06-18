-- ============================================================
-- Merge Agent NFESEFAZ — Schema SQL completo v2
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- usuarios
-- empresa_id = NULL → admin global (acessa todas as empresas)
-- empresa_id = <uuid> → analista vinculado a uma empresa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  senha_hash  TEXT NOT NULL,
  empresa_id  UUID,                    -- FK adicionada após criar empresas
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- empresas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  slug        TEXT UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
  ON DELETE SET NULL
  NOT VALID;  -- permite adicionar sem revalidar linhas existentes

-- ------------------------------------------------------------
-- refresh_tokens (rotação a cada uso, revogação no logout)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 do token bruto
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id, revoked);

-- ------------------------------------------------------------
-- biblioteca_totvs  (global, compartilhada)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS biblioteca_totvs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo   TEXT NOT NULL,
  data_pacote    DATE,
  data_upload    TIMESTAMPTZ DEFAULT now(),
  numero_pacote  TEXT,
  descricao      TEXT,
  uploaded_by    UUID REFERENCES usuarios(id),
  storage_path   TEXT NOT NULL,
  hash           TEXT NOT NULL UNIQUE,
  is_latest      BOOLEAN NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION fn_set_totvs_latest()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE biblioteca_totvs
     SET is_latest = false
   WHERE nome_arquivo = NEW.nome_arquivo
     AND id <> NEW.id;
  NEW.is_latest := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_totvs_latest ON biblioteca_totvs;
CREATE TRIGGER trg_totvs_latest
  BEFORE INSERT ON biblioteca_totvs
  FOR EACH ROW EXECUTE FUNCTION fn_set_totvs_latest();

-- ------------------------------------------------------------
-- fontes_empresa  (isolados por empresa_id — nunca misturar)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fontes_empresa (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome_arquivo   TEXT NOT NULL,
  data_pacote    DATE,
  data_upload    TIMESTAMPTZ DEFAULT now(),
  numero_pacote  TEXT,
  descricao      TEXT,
  uploaded_by    UUID REFERENCES usuarios(id),
  storage_path   TEXT NOT NULL,
  hash           TEXT NOT NULL,
  is_latest      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (empresa_id, hash)
);

CREATE OR REPLACE FUNCTION fn_set_fonte_empresa_latest()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE fontes_empresa
     SET is_latest = false
   WHERE empresa_id  = NEW.empresa_id
     AND nome_arquivo = NEW.nome_arquivo
     AND id <> NEW.id;
  NEW.is_latest := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fonte_empresa_latest ON fontes_empresa;
CREATE TRIGGER trg_fonte_empresa_latest
  BEFORE INSERT ON fontes_empresa
  FOR EACH ROW EXECUTE FUNCTION fn_set_fonte_empresa_latest();

-- ------------------------------------------------------------
-- merge_jobs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merge_jobs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id),
  totvs_v_anterior_id  UUID REFERENCES biblioteca_totvs(id),
  totvs_v_atual_id     UUID REFERENCES biblioteca_totvs(id),
  fonte_empresa_id     UUID NOT NULL REFERENCES fontes_empresa(id),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','done','error')),
  resultado_path       TEXT,
  relatorio_html       TEXT,
  error_message        TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  created_by           UUID REFERENCES usuarios(id)
);

-- ------------------------------------------------------------
-- Índices — todas FK + colunas de filtro frequente
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_biblioteca_totvs_latest
  ON biblioteca_totvs(nome_arquivo, is_latest);
CREATE INDEX IF NOT EXISTS idx_biblioteca_totvs_upload
  ON biblioteca_totvs(data_upload DESC);

CREATE INDEX IF NOT EXISTS idx_fontes_empresa_empresa
  ON fontes_empresa(empresa_id, nome_arquivo, is_latest);
CREATE INDEX IF NOT EXISTS idx_fontes_empresa_upload
  ON fontes_empresa(empresa_id, data_upload DESC);

CREATE INDEX IF NOT EXISTS idx_merge_jobs_empresa
  ON merge_jobs(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merge_jobs_status
  ON merge_jobs(status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_usuarios_email
  ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa
  ON usuarios(empresa_id);
