import { useAuthStore } from '../store/auth.store';
import { login, logout, register } from '../services/auth.service';

export function useAuth() {
  const { user, isAuthenticated } = useAuthStore();

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
  };
}
