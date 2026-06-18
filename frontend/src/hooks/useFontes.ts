import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { FonteEmpresa } from '../types';

export function useFontes(empresaId: string) {
  const [fontes, setFontes] = useState<FonteEmpresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<FonteEmpresa[]>(`/empresas/${empresaId}/fontes`);
      setFontes(data);
    } catch {
      setError('Erro ao carregar fontes');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { fontes, loading, error, refetch: fetch };
}
