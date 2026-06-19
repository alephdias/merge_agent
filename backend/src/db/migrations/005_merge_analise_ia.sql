-- ============================================================
-- Migration 005: campo analise_ia na merge_jobs
-- Executar no Supabase SQL Editor (uma única vez)
-- ============================================================

ALTER TABLE merge_jobs
  ADD COLUMN IF NOT EXISTS analise_ia TEXT;
