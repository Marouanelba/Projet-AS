import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, Loader2, ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (user) navigate('/admin/indicateurs'); }, [user, navigate]);
  if (user) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Veuillez remplir tous les champs.'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error('Erreur de connexion', { description: error.message });
    else { toast.success('Connexion réussie'); navigate('/admin/indicateurs'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-20 relative">
      {/* Back to home */}
      <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#58061C] transition-colors bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2 shadow-sm hover:shadow-md">
        <ArrowRight className="h-4 w-4 rotate-180" />
        Accueil
      </Link>
      {/* Background effects */}
      <div className="absolute inset-0 bg-hero-glow" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-[#58061C]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 w-60 h-60 bg-[#CFA452]/100/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <Link to="/" className="mx-auto mb-4 inline-flex transition-transform hover:scale-105">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
          <p className="text-slate-600 text-sm mt-2">Back-office de l'Annuaire Statistique</p>
        </div>

        {/* Form card */}
        <div className="animate-fade-in-up animate-delay-100 glass-strong rounded-2xl p-8">
          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-2">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com" className="input-field !pl-11" autoComplete="email" required />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className="input-field !pl-11 !pr-11" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><span>Se connecter</span><ArrowRight size={16} /></>}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">Accès réservé aux administrateurs</p>
          </div>
        </div>

        <div className="text-center mt-6 animate-fade-in-up animate-delay-200">
          <Link to="/" className="text-sm text-slate-500 hover:text-[#58061C] transition-colors">← Retour à l'accueil</Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
