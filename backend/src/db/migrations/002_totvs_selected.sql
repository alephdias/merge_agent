-- ============================================================
-- Migration 002: campo is_selected na biblioteca_totvs
-- Executar no Supabase SQL Editor (uma única vez)
-- ============================================================

ALTER TABLE biblioteca_totvs
  ADD COLUMN IF NOT EXISTS is_selected BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_biblioteca_totvs_selected
  ON biblioteca_totvs(nome_arquivo, is_selected);
