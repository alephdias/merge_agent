import api from './api';
import { useAuthStore } from '../store/auth.store';
import type { LoginResponse } from '../types';

export async function login(email: string, senha: string): Promise<void> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, senha });
  useAuthStore.getState().setAuth(data.user, data.access_token);
}

export async function register(nome: string, email: string, senha: string): Promise<void> {
  const { data } = await api.post<LoginResponse>('/auth/register', { nome, email, senha });
  useAuthStore.getState().setAuth(data.user, data.access_token);
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    useAuthStore.getState().clearAuth();
  }
}
