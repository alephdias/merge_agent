-- ============================================================
-- Migration 001: pgvector + embeddings para RAG
-- Executar no Supabase SQL Editor (uma única vez)
-- ============================================================

-- Ativa o pgvector (suporte nativo a vetores e busca semântica)
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- Tabela principal de embeddings
-- empresa_id NULL  → conhecimento global TOTVS (seguro para compartilhar)
-- empresa_id <uuid> → customizações isoladas por empresa (nunca vaza entre empresas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embeddings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID        REFERENCES empresas(id) ON DELETE CASCADE,
  origem       TEXT        NOT NULL CHECK (origem IN ('fonte_empresa', 'biblioteca_totvs', 'merge_resolucao')),
  origem_id    UUID        NOT NULL,
  bloco_nome   TEXT,
  conteudo     TEXT        NOT NULL,
  embedding    vector(1024),   -- voyage-code-3: 1024 dimensões
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice HNSW para busca vetorial (funciona bem mesmo com 0 registros)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON embeddings USING hnsw (embedding vector_cosine_ops);

-- Índices B-tree para filtros obrigatórios
CREATE INDEX IF NOT EXISTS idx_embeddings_empresa_id
  ON embeddings(empresa_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_origem
  ON embeddings(origem, origem_id);

-- ------------------------------------------------------------
-- Função de busca com isolamento de empresa GARANTIDO no SQL
-- Sempre busca somente: (empresa_id = p_empresa_id) + (empresa_id IS NULL)
-- Nunca pode retornar dados de outra empresa por construção
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding  vector(1024),
  p_empresa_id     UUID,
  p_limit          INT DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  empresa_id  UUID,
  origem      TEXT,
  bloco_nome  TEXT,
  conteudo    TEXT,
  score       FLOAT8
)
LANGUAGE sql STABLE AS $$
  SELECT
    e.id,
    e.empresa_id,
    e.origem,
    e.bloco_nome,
    e.conteudo,
    1 - (e.embedding <=> query_embedding) AS score
  FROM embeddings e
  WHERE
    e.embedding IS NOT NULL
    AND (
      e.empresa_id = p_empresa_id   -- conhecimento desta empresa
      OR e.empresa_id IS NULL       -- conhecimento global TOTVS (sem risco)
    )
  ORDER BY e.embedding <=> query_embedding
  LIMIT p_limit;
$$;
