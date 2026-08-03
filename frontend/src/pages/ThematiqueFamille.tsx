import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { annuaires as annuairesApi, thematiques as thematiquesApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Layers } from "lucide-react";
import { normalizeThematiqueName } from "@/lib/thematique-utils";
import { useRetour } from '@/hooks/useRetour';
import { familleDeThematique } from "@/lib/thematique-familles";
import { getThematiqueIcon } from "@/lib/thematique-icons";

interface Thematique {
  id: number;
  code: string;
  nom_fr: string;
  id_annuaire: number;
  nb_indicateurs: number | null;
}

interface Annuaire {
  id: number;
  annee: string;
}

/** Une appellation de la famille, telle qu'elle existe en base. */
interface Appellation {
  nomAffiche: string; // nom nettoyé, celui que l'explorateur attend
  nomsBruts: string[]; // orthographes exactes regroupées sous ce nom
  annees: string[];
  nbTableaux: number;
}

export default function ThematiqueFamille() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const retour = useRetour("/");
  const famille = searchParams.get("famille") || "";
  const [loading, setLoading] = useState(true);
  const [thematiques, setThematiques] = useState<Thematique[]>([]);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ann, them] = await Promise.all([
          annuairesApi.getAll(),
          thematiquesApi.getAll({ include_count: true }),
        ]);
        setAnnuaires((ann || []) as Annuaire[]);
        setThematiques((them || []) as Thematique[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Toutes les appellations rattachées à cette famille, regroupées par nom
  // nettoyé : "Climatologie" et "climatologie" ne font qu'une entrée.
  const appellations = useMemo<Appellation[]>(() => {
    const map = new Map<string, Appellation>();
    thematiques.forEach((t) => {
      if ((t.nb_indicateurs || 0) === 0) return;
      if (familleDeThematique(t.nom_fr) !== famille) return;
      const nomAffiche = normalizeThematiqueName(t.nom_fr);
      const annee = annuaires.find((a) => a.id === t.id_annuaire)?.annee || "?";
      const entree = map.get(nomAffiche) || {
        nomAffiche,
        nomsBruts: [],
        annees: [],
        nbTableaux: 0,
      };
      if (!entree.nomsBruts.includes(t.nom_fr)) entree.nomsBruts.push(t.nom_fr);
      if (!entree.annees.includes(annee)) entree.annees.push(annee);
      entree.nbTableaux += t.nb_indicateurs || 0;
      map.set(nomAffiche, entree);
    });
    return Array.from(map.values())
      .map((a) => ({ ...a, annees: a.annees.sort((x, y) => y.localeCompare(x)) }))
      .sort((a, b) => b.nbTableaux - a.nbTableaux);
  }, [thematiques, annuaires, famille]);

  const totalTableaux = appellations.reduce((s, a) => s + a.nbTableaux, 0);
  const totalAnnees = new Set(appellations.flatMap((a) => a.annees)).size;
  const { Icon, colorClass } = getThematiqueIcon(famille);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={retour}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux thématiques
        </Button>

        <div className="flex items-start gap-4 mb-2">
          <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{famille}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Badge variant="secondary" className="font-normal text-xs bg-muted/50">
                {totalTableaux} tableau{totalTableaux > 1 ? "x" : ""}
              </Badge>
              <Badge variant="outline" className="font-normal text-xs border-primary/20 text-primary">
                {totalAnnees} année{totalAnnees > 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="font-normal text-xs">
                {appellations.length} appellation{appellations.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-8 max-w-3xl">
          Cette thématique apparaît sous {appellations.length} appellation
          {appellations.length > 1 ? "s" : ""} différente
          {appellations.length > 1 ? "s" : ""} selon les annuaires. Choisissez-en une
          pour consulter ses tableaux.
        </p>

        {appellations.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune appellation pour cette famille</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {appellations.map((a) => (
              <Card
                key={a.nomAffiche}
                className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden"
                onClick={() =>
                  navigate(`/thematique?thematique=${encodeURIComponent(a.nomAffiche)}`)
                }
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                      {a.nomAffiche}
                    </h4>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="secondary" className="font-normal text-xs bg-muted/50">
                      {a.nbTableaux} tableau{a.nbTableaux > 1 ? "x" : ""}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-normal text-xs border-primary/20 text-primary"
                    >
                      {a.annees.length} année{a.annees.length > 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    {a.annees.slice(0, 8).join(", ")}
                    {a.annees.length > 8 ? `… (+${a.annees.length - 8})` : ""}
                  </p>

                  {/* Orthographes exactes rassemblées sous cette appellation */}
                  {a.nomsBruts.length > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-2 italic">
                      Écrit aussi : {a.nomsBruts.filter((n) => n !== a.nomAffiche).join(" · ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
