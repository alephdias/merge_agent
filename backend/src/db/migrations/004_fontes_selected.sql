-- ============================================================
-- Migration 004: campo is_selected na fontes_empresa
-- Executar no Supabase SQL Editor (uma única vez)
-- ============================================================

ALTER TABLE fontes_empresa
  ADD COLUMN IF NOT EXISTS is_selected BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fontes_empresa_selected
  ON fontes_empresa(empresa_id, nome_arquivo, is_selected);
