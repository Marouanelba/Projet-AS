import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  BarChart3, 
  Home, 
  Database, 
  Settings, 
  LogIn, 
  ChevronLeft,
  Menu,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

const navItems = [
  { icon: Home, label: "Accueil", href: "/" },
  { icon: Database, label: "Tableaux", href: "/indicateurs" },
  { icon: Settings, label: "Administration", href: "/admin/indicateurs" },
];

const DashboardLayout = ({ 
  children, 
  title, 
  subtitle,
  showSearch = false,
  onSearch,
  searchPlaceholder = "Rechercher..."
}: DashboardLayoutProps) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col border-r bg-card/50 backdrop-blur-sm transition-all duration-300 sticky top-0 h-screen",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-md shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-semibold text-sm tracking-tight truncate">Annuaire Statistique</h1>
                <p className="text-xs text-muted-foreground truncate">Maroc</p>
              </div>
            )}
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform",
              sidebarCollapsed && "rotate-180"
            )} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t">
          <Link to="/auth">
            <Button 
              variant="outline" 
              size={sidebarCollapsed ? "icon" : "default"}
              className={cn("w-full gap-2", sidebarCollapsed && "p-0")}
            >
              <LogIn className="h-4 w-4" />
              {!sidebarCollapsed && "Connexion"}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-md">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">Annuaire Statistique</span>
          </div>
          <Link to="/auth">
            <Button variant="ghost" size="icon">
              <LogIn className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-card px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Page Header */}
        {(title || showSearch) && (
          <header className="border-b bg-card/30 backdrop-blur-sm sticky top-0 lg:top-0 z-40 pt-[60px] lg:pt-0">
            <div className="px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {title && (
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {subtitle && (
                      <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
                    )}
                  </div>
                )}
                {showSearch && (
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        <div className={cn(
          "p-6",
          !title && !showSearch && "pt-[72px] lg:pt-6"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
