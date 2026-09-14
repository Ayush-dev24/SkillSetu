import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AppContext';

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { isAuthed, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#e5dcc3] border-t-[#0d7a5f]" />
        <p className="text-sm font-bold text-[#5a6a62]">Checking your session…</p>
      </div>
    );
  }
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && roles.length > 0 && !roles.includes(role)) {
    const home: Record<Role, string> = { student: '/profile', company: '/company', college: '/college', ministry: '/ministry' };
    return <Navigate to={home[role] ?? '/'} replace />;
  }
  return <>{children}</>;
}
