import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { Empresa } from '../types';

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Empresa[]>('/empresas');
      setEmpresas(data);
    } catch {
      setError('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { empresas, loading, error, refetch: fetch };
}
