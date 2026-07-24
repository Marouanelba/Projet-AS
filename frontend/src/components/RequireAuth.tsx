import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3 } from 'lucide-react';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Garde de route qui vérifie la présence d'une session JWT valide.
 * Si pas de session → redirection vers /auth avec mémorisation de l'URL d'origine.
 * La session Supabase contient le JWT (access_token) qui authentifie l'utilisateur.
 */
const RequireAuth = ({ children }: RequireAuthProps) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center animate-pulse">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-slate-600">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  // Pas de session JWT → pas d'accès
  if (!session) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
