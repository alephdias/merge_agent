import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';
import type { LoginResponse } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // envia o cookie HttpOnly do refresh token automaticamente
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Anexa o access token em cada requisição
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh: ao receber 401, tenta renovar o access token via cookie de refresh
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function drainQueue(err: unknown, token: string | null): void {
  pendingQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(err)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<LoginResponse>(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true },
      );
      useAuthStore.getState().updateToken(data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      drainQueue(null, data.access_token);
      return api(original);
    } catch (refreshErr) {
      drainQueue(refreshErr, null);
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
