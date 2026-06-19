-- ============================================================
-- Migration 003: histórico de comparativos TOTVS
-- Executar no Supabase SQL Editor (uma única vez)
-- ============================================================

CREATE TABLE IF NOT EXISTS comparativos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  v1_id        UUID NOT NULL REFERENCES biblioteca_totvs(id) ON DELETE CASCADE,
  v2_id        UUID NOT NULL REFERENCES biblioteca_totvs(id) ON DELETE CASCADE,
  stats        JSONB NOT NULL DEFAULT '{}',
  analysis     JSONB NOT NULL DEFAULT '{}',
  created_by   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comparativos_created ON comparativos(created_at DESC);
