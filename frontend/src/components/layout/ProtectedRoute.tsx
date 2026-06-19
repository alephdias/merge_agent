import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { Sidebar } from './Sidebar';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#f9fafb' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ background: '#f9fafb' }}>
        {children}
      </main>
    </div>
  );
}
