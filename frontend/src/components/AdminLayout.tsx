import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, List, Link2, LogOut, Home, Upload, Menu, X, Settings, FileSearch } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/admin/indicateurs', label: 'Tableaux', icon: List },
  { href: '/admin/correcteur', label: 'Espace Correcteur', icon: FileSearch },
  { href: '/admin/liaisons', label: 'Liaisons', icon: Link2 },
  { href: '/admin/import', label: 'Import', icon: Upload },
  { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading, navigate]);
  useEffect(() => { setMobileOpen(false); }, [location]);

  const handleSignOut = async () => { await signOut(); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center animate-pulse">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const isActive = (path: string) => location.pathname.startsWith(path);
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Admin';
  const avatarLetter = displayName[0]?.toUpperCase() || 'A';

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed lg:fixed left-0 top-0 h-screen z-30 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/80 transition-all duration-300 
        ${mobileOpen ? 'translate-x-0 shadow-2xl !z-[100]' : '-translate-x-full lg:translate-x-0'} 
        ${collapsed ? 'w-20' : 'w-72'}`}
        style={{ boxShadow: mobileOpen ? '10px 0 50px rgba(0, 0, 0, 0.1)' : '4px 0 24px rgba(0, 0, 0, 0.02)' }}>

        {/* Logo */}
        <div className={`flex-none border-b border-slate-100/80 ${collapsed ? 'px-3 py-4' : 'px-5 py-5'} flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Link to="/admin/indicateurs" onClick={() => setMobileOpen(false)} className="group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20 group-hover:shadow-[0_0_30px_rgba(88,6,28,0.2)] transition-shadow">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
              </Link>
              <button onClick={() => setCollapsed(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                <Menu size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/admin/indicateurs" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20 group-hover:shadow-[0_0_30px_rgba(88,6,28,0.2)] transition-shadow">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">Annuaire</span>
                  <span className="text-xs font-semibold text-slate-500">Back-office</span>
                </div>
              </Link>
              <button onClick={mobileOpen ? () => setMobileOpen(false) : () => setCollapsed(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 transition-all hidden lg:block">
                <X size={18} />
              </button>
              {mobileOpen && (
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 lg:hidden">
                  <X size={18} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <div className="px-3 py-6 flex-1 overflow-y-auto space-y-8">
          <div className="space-y-1.5">
            {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Menu</p>}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)}
                    className={`group relative flex items-center ${collapsed ? 'justify-center px-3' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      isActive(item.href)
                        ? 'font-semibold text-[#58061C] bg-[#58061C]/8/80 ring-1 ring-inset ring-[#58061C]/15'
                        : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}>
                    <Icon size={18} className={isActive(item.href) ? "text-[#58061C]" : "text-slate-400 group-hover:text-slate-600"} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User section */}
          <div className="space-y-1.5">
            {!collapsed && <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Compte</p>}
            {collapsed ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#58061C] to-[#CFA452] flex items-center justify-center text-white text-xs font-bold" title={user.email || ''}>
                  {avatarLetter}
                </div>
                <Link to="/" onClick={() => setMobileOpen(false)} title="Site public"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                  <Home size={16} />
                </Link>
                <button onClick={handleSignOut} title="Déconnexion"
                  className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-white/60 border border-slate-200/60 shadow-sm">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#58061C] to-[#CFA452] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {avatarLetter}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <Link to="/" onClick={() => setMobileOpen(false)}
                  className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 transition-colors">
                  <Home size={18} className="text-slate-400 group-hover:text-slate-600" />
                  <span>Site public</span>
                </Link>
                <button onClick={handleSignOut}
                  className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 transition-colors">
                  <LogOut size={18} className="text-rose-400 group-hover:text-rose-600" />
                  <span>Déconnexion</span>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 glass-nav px-4 h-16 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-2 text-slate-600 hover:text-slate-900">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Admin</span>
          </div>
          <div className="w-10" />
        </div>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
