import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { MergeJob } from '../types';

export function useMergeJobs(empresaId?: string) {
  const [jobs, setJobs] = useState<MergeJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = empresaId ? `/merges?empresa_id=${empresaId}` : '/merges';
      const { data } = await api.get<MergeJob[]>(url);
      setJobs(data);
    } catch {
      setError('Erro ao carregar histórico de merges');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void fetch(); }, [fetch]);

  // Polling automático enquanto houver jobs em andamento
  useEffect(() => {
    const hasPending = jobs.some((j) => j.status === 'pending' || j.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(() => { void fetch(); }, 5_000);
    return () => clearInterval(interval);
  }, [jobs, fetch]);

  return { jobs, loading, error, refetch: fetch };
}
