import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3,
  List,
  Link2,
  LogOut,
  Home,
  Upload,
  Settings,
  FileSearch,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  // Redirection vers /auth si non authentifié
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Contrôle d'accès et redirection selon le rôle
  useEffect(() => {
    if (!loading && user) {
      const isCorrecteurPath = location.pathname.startsWith('/admin/correcteur');
      if (user.role === 'correcteur' && !isCorrecteurPath) {
        // Un correcteur n'a droit qu'à l'Espace Correcteur
        navigate('/admin/correcteur');
      } else if (user.role === 'admin' && isCorrecteurPath) {
        // Un admin ne fait pas de corrections, redirigé vers l'espace de validation ou les indicateurs
        navigate('/admin/indicateurs');
      }
    }
  }, [user, loading, location.pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
  };

  // Afficher un écran de chargement pendant la vérification
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Filtrer les onglets de la barre latérale selon le rôle
  const navItems = user.role === 'correcteur'
    ? [
      { href: '/admin/correcteur', label: 'Espace Correcteur', icon: FileSearch },
    ]
    : [
      { href: '/admin/indicateurs', label: 'Tableaux', icon: List },
      { href: '/admin/validation', label: 'Validation', icon: FileCheck },
      { href: '/admin/liaisons', label: 'Liaisons', icon: Link2 },
      { href: '/admin/import', label: 'Import', icon: Upload },
      { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
    ];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sidebar-primary/20">
              <BarChart3 className="h-6 w-6 text-sidebar-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Annuaire Stat</h1>
              <p className="text-xs text-sidebar-foreground/60">Back-office</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Affichage des points pour le correcteur */}
        {user.role === 'correcteur' && (
          <div className="px-4 py-3 mx-4 mb-2 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-between border border-emerald-500/20">
            <span className="text-xs font-semibold">Score Correction</span>
            <span className="text-sm font-bold flex items-center gap-1">
              {user.points || 0} XP
            </span>
          </div>
        )}

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/80 transition-colors"
          >
            <Home className="h-5 w-5" />
            Accueil public
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/20 text-sidebar-foreground/80 transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </button>
          <div className="px-4 py-2 text-xs text-sidebar-foreground/50 truncate flex items-center justify-between">
            <span>{user.email}</span>
            <span className="capitalize font-semibold text-[10px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded">
              {user.role}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50/50">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
