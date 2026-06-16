import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireModule?: string;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireModule }: ProtectedRouteProps) {
  const { user, role, loading } = useAuthStore();
  const { hasModuleAccess, isAdmin, loading: permLoading } = usePermissions();

  if (loading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && role !== 'admin') {
    return <AccessDenied />;
  }

  if (requireModule && !isAdmin && !hasModuleAccess(requireModule)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h1>
        <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
      </div>
    </div>
  );
}