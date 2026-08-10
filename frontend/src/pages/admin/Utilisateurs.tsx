import { useState, useEffect } from 'react';
import { users as usersApi, type Utilisateur } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, UserPlus, Trash2, ShieldCheck, FileSearch, Settings, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

type RoleAttribuable = 'correcteur' | 'validateur';

const LIBELLE_ROLE: Record<string, { texte: string; classe: string; Icone: typeof ShieldCheck }> = {
  admin: { texte: 'Administrateur', classe: 'bg-slate-100 text-slate-700', Icone: Settings },
  validateur: { texte: 'Validateur', classe: 'bg-blue-100 text-blue-700', Icone: ShieldCheck },
  correcteur: { texte: 'Correcteur', classe: 'bg-emerald-100 text-emerald-700', Icone: FileSearch },
};

const Utilisateurs = () => {
  const [comptes, setComptes] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<RoleAttribuable>('correcteur');

  const charger = async () => {
    setChargement(true);
    try {
      // Les comptes admin ne sont pas listés ici : cette page gère les
      // correcteurs et les validateurs. Un admin change son propre mot de
      // passe depuis Paramètres, et son rôle ne s'attribue pas via l'interface.
      const tous = await usersApi.getAll();
      setComptes(tous.filter((c) => c.role !== 'admin'));
    } catch (err) {
      toast.error('Impossible de charger les comptes', { description: (err as Error).message });
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motDePasse.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setEnvoi(true);
    try {
      const cree = await usersApi.create({ email, password: motDePasse, display_name: nom || undefined, role });
      toast.success(`Compte ${LIBELLE_ROLE[role].texte.toLowerCase()} créé`, { description: cree.email });
      setEmail(''); setNom(''); setMotDePasse(''); setRole('correcteur');
      charger();
    } catch (err) {
      toast.error('Création impossible', { description: (err as Error).message });
    } finally {
      setEnvoi(false);
    }
  };

  const changerRole = async (compte: Utilisateur, nouveau: RoleAttribuable) => {
    try {
      await usersApi.update(compte.id, { role: nouveau });
      toast.success(`${compte.email} est désormais ${LIBELLE_ROLE[nouveau].texte.toLowerCase()}`);
      charger();
    } catch (err) {
      toast.error('Changement de rôle impossible', { description: (err as Error).message });
    }
  };

  // Réinitialisation de mot de passe : l'admin en définit un nouveau et le
  // transmet à la personne. L'ancien n'est pas récupérable (il n'est stocké
  // que sous forme de hash), il est donc écrasé sans être demandé.
  const [compteMdp, setCompteMdp] = useState<Utilisateur | null>(null);
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [envoiMdp, setEnvoiMdp] = useState(false);

  const changerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compteMdp) return;
    if (nouveauMdp.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setEnvoiMdp(true);
    try {
      await usersApi.update(compteMdp.id, { password: nouveauMdp });
      toast.success('Mot de passe modifié', {
        description: `${compteMdp.email} — communiquez-lui « ${nouveauMdp} »`,
      });
      setCompteMdp(null); setNouveauMdp('');
    } catch (err) {
      toast.error('Modification impossible', { description: (err as Error).message });
    } finally {
      setEnvoiMdp(false);
    }
  };

  const supprimer = async (compte: Utilisateur) => {
    if (!confirm(`Supprimer définitivement le compte ${compte.email} ?`)) return;
    try {
      await usersApi.remove(compte.id);
      toast.success('Compte supprimé', { description: compte.email });
      charger();
    } catch (err) {
      toast.error('Suppression impossible', { description: (err as Error).message });
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            {comptes.length} correcteur{comptes.length > 1 ? 's' : ''} ou validateur{comptes.length > 1 ? 's' : ''} · les comptes administrateur ne sont pas gérés ici
          </p>
        </div>

        {/* Création */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Nouveau compte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={creer} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@hcp.ma" />
              </div>
              <div>
                <Label htmlFor="nom">Nom affiché</Label>
                <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)}
                  placeholder="facultatif" />
              </div>
              <div>
                <Label htmlFor="mdp">Mot de passe</Label>
                <Input id="mdp" type="text" required minLength={6} value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)} placeholder="6 caractères minimum" />
              </div>
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as RoleAttribuable)}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correcteur">Correcteur</SelectItem>
                    <SelectItem value="validateur">Validateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5 flex items-center gap-3">
                <Button type="submit" disabled={envoi} className="gap-2">
                  {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Créer le compte
                </Button>
                <p className="text-xs text-muted-foreground">
                  Le mot de passe est affiché en clair : notez-le, il ne sera plus lisible ensuite.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Correcteurs et validateurs</CardTitle></CardHeader>
          <CardContent>
            {chargement ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom affiché</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="text-right">Corrections</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comptes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Aucun correcteur ni validateur. Créez-en un ci-dessus.
                      </TableCell>
                    </TableRow>
                  )}
                  {comptes.map((c) => {
                    const infos = LIBELLE_ROLE[c.role] ?? LIBELLE_ROLE.correcteur;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.email}</TableCell>
                        <TableCell>{c.display_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`gap-1 font-normal ${infos.classe}`}>
                            <infos.Icone className="h-3 w-3" /> {infos.texte}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.nb_corrections ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select value={c.role} onValueChange={(v) => changerRole(c, v as RoleAttribuable)}>
                              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="correcteur">Correcteur</SelectItem>
                                <SelectItem value="validateur">Validateur</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" title="Modifier le mot de passe"
                              onClick={() => { setCompteMdp(c); setNouveauMdp(''); }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Supprimer"
                              onClick={() => supprimer(c)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Réinitialisation du mot de passe */}
        <Dialog open={compteMdp !== null} onOpenChange={(o) => { if (!o) setCompteMdp(null); }}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={changerMotDePasse}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" /> Modifier le mot de passe
                </DialogTitle>
                <DialogDescription>
                  {compteMdp?.email}
                  
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-2">
                <Label htmlFor="nouveau-mdp">Nouveau mot de passe</Label>
                <Input id="nouveau-mdp" type="text" autoFocus required minLength={6}
                  value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)}
                  placeholder="6 caractères minimum" />
                <p className="text-xs text-muted-foreground">
                  L’ancien mot de passe n’est pas récupérable : il est remplacé, pas comparé.
                  Notez celui-ci pour le transmettre.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCompteMdp(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={envoiMdp} className="gap-2">
                  {envoiMdp && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Utilisateurs;
