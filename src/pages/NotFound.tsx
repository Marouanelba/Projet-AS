import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  useEffect(() => { console.error("404 Error:", location.pathname); }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative">
      <div className="absolute inset-0 bg-hero-glow opacity-50" />
      <div className="relative z-10 text-center px-4">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#58061C] to-[#3B0211] items-center justify-center shadow-lg shadow-[#58061C]/20 mb-6">
          <BarChart3 className="h-8 w-8 text-white" />
        </div>
        <p className="text-8xl font-black text-slate-200 mb-4">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page introuvable</h1>
        <p className="text-slate-600 mb-8">La page demandée n'existe pas ou a été déplacée.</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
