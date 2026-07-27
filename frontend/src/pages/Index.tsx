import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { annuaires as annuairesApi, thematiques as thematiquesApi } from '@/lib/api';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowRight, Database, FileText, BarChart3, Sparkles, CalendarDays, BookOpen, Layers } from "lucide-react";
import { normalizeThematiqueName } from "@/lib/thematique-utils";
import { getThematiqueIcon } from "@/lib/thematique-icons";

interface Annuaire {
  id: number;
  annee: string;
}

interface Thematique {
  id: number;
  nom_fr: string;
  code: string;
  id_annuaire: number;
  nb_indicateurs: number | null;
}
const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);
  const [selectedAnnuaire, setSelectedAnnuaire] = useState<string>("");
  const [thematiques, setThematiques] = useState<Thematique[]>([]);
  

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [annData, themData] = await Promise.all([
        annuairesApi.getAll('desc'),
        thematiquesApi.getAll({ include_count: true }),
      ]);

      const withRealCount = themData.map((t: any) => ({
        ...t,
        nb_indicateurs: t.tableaux?.length || t.nb_indicateurs || 0,
      }));
      const annuaireIdsWithData = new Set(
        withRealCount.filter((t: any) => t.nb_indicateurs > 0).map((t: any) => t.id_annuaire)
      );
      const filteredAnnuaires = annData.filter((a: Annuaire) => annuaireIdsWithData.has(a.id));
      setAnnuaires(filteredAnnuaires);
      if (filteredAnnuaires.length > 0) setSelectedAnnuaire(filteredAnnuaires[0].id.toString());
      setThematiques(withRealCount as Thematique[]);
    } catch (err) {
      console.error('Erreur chargement:', err);
    }
    setLoading(false);
  };

  // Thématiques filtrées par annuaire sélectionné
  const thematiquesForAnnuaire = useMemo(() => {
    if (!selectedAnnuaire) return [];
    const annuaireId = parseInt(selectedAnnuaire);
    return thematiques
      .filter((t) => t.id_annuaire === annuaireId && (t.nb_indicateurs || 0) > 0)
      .sort((a, b) => a.nom_fr.localeCompare(b.nom_fr));
  }, [thematiques, selectedAnnuaire]);


  const handleThematiqueClick = (thematique: Thematique) => {
    const cleanName = normalizeThematiqueName(thematique.nom_fr);
    const annee = annuaires.find((a) => a.id.toString() === selectedAnnuaire)?.annee || "";
    navigate(`/indicateurs?thematique=${encodeURIComponent(cleanName)}&annuaire=${encodeURIComponent(annee)}`);
  };

  const selectedAnnee = annuaires.find((a) => a.id.toString() === selectedAnnuaire)?.annee || "";

  // Stats
  const totalIndicateurs = thematiquesForAnnuaire.reduce((sum, t) => sum + (t.nb_indicateurs || 0), 0);
  const totalThematiques = thematiquesForAnnuaire.length;
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute top-20 -left-32 w-96 h-96 bg-primary/20 blob animate-float" />
      <div
        className="absolute top-40 -right-32 w-80 h-80 bg-[hsl(173_58%_39%/0.15)] blob animate-float"
        style={{
          animationDelay: "-2s",
        }}
      />
      <div
        className="absolute bottom-20 left-1/3 w-64 h-64 bg-[hsl(220_70%_50%/0.1)] blob animate-float"
        style={{
          animationDelay: "-4s",
        }}
      />

      {/* Header */}
      <header className="glass-card sticky top-0 z-50 border-x-0 border-t-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
                <Database className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Annuaire Statistique</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Haut-Commissariat au Plan</p>
              </div>
            </div>
            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/indicateurs"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
              >
                Tableaux
              </Link>
              <Link
                to="/admin"
                className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-xl"
              >
                Administration
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 sm:py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              Annuaire statistique du Maroc
              <Sparkles className="h-4 w-4" />
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight leading-tight">
              Explorez l'{" "}
              <span className="bg-gradient-to-r from-primary via-[hsl(173_58%_39%)] to-[hsl(220_70%_50%)] bg-clip-text text-transparent">
                Annuaire statistique
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed">
              Accédez à l'ensemble des indicateurs statistiques organisés par thématique et explorez les séries
              temporelles.
            </p>

          </div>

          {/* Stats */}
          <div className="flex justify-center gap-4 sm:gap-6 flex-wrap max-w-3xl mx-auto">
            <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4 min-w-[160px]">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalIndicateurs.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Tableaux</p>
              </div>
            </div>

            <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4 min-w-[160px]">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(173_58%_39%)]/20 to-[hsl(173_58%_39%)]/5 flex items-center justify-center">
                <FileText className="h-6 w-6 text-[hsl(173_58%_39%)]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalThematiques}</p>
                <p className="text-sm text-muted-foreground">Thématiques</p>
              </div>
            </div>

            <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4 min-w-[160px]">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(220_70%_50%)]/20 to-[hsl(220_70%_50%)]/5 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-[hsl(220_70%_50%)]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{selectedAnnee || "—"}</p>
                <p className="text-sm text-muted-foreground">Année</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 pb-20 relative">
        <Tabs defaultValue="annuaire" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="glass-card rounded-2xl p-1.5 h-auto">
              <TabsTrigger value="annuaire" className="rounded-xl px-6 py-3 text-sm font-medium gap-2 data-[state=active]:shadow-md">
                <BookOpen className="h-4 w-4" />
                Vue Annuaire Statistique
              </TabsTrigger>
              <TabsTrigger value="thematique" className="rounded-xl px-6 py-3 text-sm font-medium gap-2 data-[state=active]:shadow-md">
                <Layers className="h-4 w-4" />
                Vue par Thématique
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="annuaire">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Thématiques</h3>
                <p className="text-muted-foreground">Sélectionnez un annuaire puis explorez ses thématiques</p>
              </div>
              <div className="sm:ml-auto">
                <Select value={selectedAnnuaire} onValueChange={setSelectedAnnuaire}>
                  <SelectTrigger className="w-auto min-w-[280px] glass-card rounded-xl">
                    <CalendarDays className="h-4 w-4 mr-2 text-primary" />
                    <SelectValue placeholder="Choisir un annuaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...annuaires].sort((a, b) => b.annee.localeCompare(a.annee)).map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        Annuaire Statistique {a.annee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="glass-card rounded-2xl p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
            ) : thematiquesForAnnuaire.length === 0 ? (
              <div className="glass-card rounded-2xl p-16 text-center">
                <Database className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune thématique disponible pour cet annuaire</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {thematiquesForAnnuaire.map((theme, index) => {
                  const cleanName = normalizeThematiqueName(theme.nom_fr);
                  const { Icon, colorClass } = getThematiqueIcon(cleanName);
                  return (
                    <Card
                      key={theme.id}
                      className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden"
                      onClick={() => handleThematiqueClick(theme)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className={`p-3 rounded-xl ${colorClass} transition-transform group-hover:scale-110`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                        </div>
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-3 leading-tight">
                          {cleanName}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="font-normal text-xs bg-muted/50">
                            {theme.nb_indicateurs} tableau{(theme.nb_indicateurs || 0) > 1 ? "x" : ""}
                          </Badge>
                          <Badge variant="outline" className="font-normal text-xs border-primary/20 text-primary">
                            {theme.code}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="thematique">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="glass-card rounded-2xl p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
            ) : (() => {
              // Group thematiques by normalized name across all annuaires
              const uniqueThematiques = new Map<string, { name: string; years: string[]; totalTableaux: number; code: string }>();
              thematiques.forEach((t) => {
                const cleanName = normalizeThematiqueName(t.nom_fr);
                if ((t.nb_indicateurs || 0) === 0) return;
                const existing = uniqueThematiques.get(cleanName);
                const annee = annuaires.find((a) => a.id === t.id_annuaire)?.annee || "?";
                if (existing) {
                  if (!existing.years.includes(annee)) existing.years.push(annee);
                  existing.totalTableaux += t.nb_indicateurs || 0;
                } else {
                  uniqueThematiques.set(cleanName, {
                    name: cleanName,
                    years: [annee],
                    totalTableaux: t.nb_indicateurs || 0,
                    code: t.code,
                  });
                }
              });
              const sorted = Array.from(uniqueThematiques.values()).sort((a, b) => a.name.localeCompare(b.name));
              return sorted.length === 0 ? (
                <div className="glass-card rounded-2xl p-16 text-center">
                  <Layers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucune thématique disponible</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sorted.map((theme, index) => {
                    const { Icon, colorClass } = getThematiqueIcon(theme.name);
                    return (
                      <Card
                        key={theme.name}
                        className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden"
                        onClick={() => navigate(`/thematique?thematique=${encodeURIComponent(theme.name)}`)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className={`p-3 rounded-xl ${colorClass} transition-transform group-hover:scale-110`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                          </div>
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-3 leading-tight">
                            {theme.name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-normal text-xs bg-muted/50">
                              {theme.totalTableaux} tableau{theme.totalTableaux > 1 ? "x" : ""}
                            </Badge>
                            <Badge variant="outline" className="font-normal text-xs border-primary/20 text-primary">
                              {theme.years.length} année{theme.years.length > 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="glass-card border-x-0 border-b-0 py-8 relative">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">Annuaire Statistique du Maroc — Haut-Commissariat au Plan</p>
        </div>
      </footer>
    </div>
  );
};
export default Index;
