import { useState, useEffect } from 'react';
import { auth } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Lock, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const Parametres = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Sync displayName with user data when user loads/changes
  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.display_name || '';
      setDisplayName(name);
    }
  }, [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password strength
  const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Faible', color: 'bg-red-500' };
    if (score <= 3) return { level: 2, label: 'Moyen', color: 'bg-amber-500' };
    return { level: 3, label: 'Fort', color: 'bg-emerald-500' };
  };
  const passwordStrength = getPasswordStrength(newPassword);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('Le nom ne peut pas être vide'); return; }
    setSavingName(true);
    try {
      await auth.updateProfile(displayName.trim());
      toast.success('Nom mis à jour avec succès');
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
    setSavingName(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { toast.error('Veuillez entrer votre mot de passe actuel'); return; }
    if (!newPassword || !confirmPassword) { toast.error('Veuillez remplir tous les champs'); return; }
    if (newPassword.length < 6) { toast.error('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setSavingPassword(true);
    try {
      await auth.updatePassword(currentPassword, newPassword);
      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
    setSavingPassword(false);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#58061C]/5 via-white to-[#CFA452]/5 border border-[#58061C]/15 rounded-2xl">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-md shadow-[#58061C]/15">
              <User className="h-5 w-5 text-white" />
            </div>
            Paramètres du compte
          </h1>
          <p className="text-slate-600 text-sm mt-2 ml-[52px]">
            Gérer votre profil et vos identifiants de connexion
          </p>
        </div>

        <div className="space-y-6">
          {/* Info card */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#58061C] to-[#CFA452] flex items-center justify-center text-white text-lg font-bold shrink-0">
              {(displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{displayName || 'Administrateur'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Change name */}
          <Card className="border-2 border-slate-200 rounded-2xl">
            <CardHeader className="bg-slate-50 rounded-t-2xl border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-[#58061C]" />
                Nom d'utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="Votre nom" className="input-field" />
                </div>
                <Button type="submit" disabled={savingName} className="rounded-xl bg-gradient-to-r from-[#58061C] to-[#3B0211] hover:from-[#6b0a24] hover:to-[#58061C]digo-500 hover:to-[#58061C] text-white shadow-sm shadow-[#58061C]/15 gap-2">
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change password */}
          <Card className="border-2 border-slate-200 rounded-2xl">
            <CardHeader className="bg-slate-50 rounded-t-2xl border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#58061C]" />
                Changer le mot de passe
              </CardTitle>
              <CardDescription>Minimum 6 caractères requis</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mot de passe actuel</label>
                  <div className="relative">
                    <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Entrez votre mot de passe actuel" className="input-field !pr-10" />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="h-px bg-slate-200 my-2" />
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••" className="input-field !pr-10" />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Password strength indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.level >= 1 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.level >= 2 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.level >= 3 ? passwordStrength.color : 'bg-slate-200'}`} />
                      </div>
                      <p className={`text-xs font-medium ${passwordStrength.level === 1 ? 'text-red-600' : passwordStrength.level === 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {passwordStrength.label}
                        {passwordStrength.level === 1 && ' — Ajoutez des majuscules, chiffres ou symboles'}
                        {passwordStrength.level === 2 && ' — Bon, mais peut être amélioré'}
                        {passwordStrength.level === 3 && ' — Excellent mot de passe'}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" className="input-field !pr-10" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                </div>
                <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="rounded-xl bg-gradient-to-r from-[#58061C] to-[#3B0211] hover:from-[#6b0a24] hover:to-[#58061C]digo-500 hover:to-[#58061C] text-white shadow-sm shadow-[#58061C]/15 gap-2">
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Parametres;
