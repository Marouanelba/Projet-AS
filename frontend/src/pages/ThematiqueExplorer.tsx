import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { views } from '@/lib/api';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ArrowRight, Database, Table2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeThematiqueName } from "@/lib/thematique-utils";
import { getThematiqueIcon } from "@/lib/thematique-icons";
import { cleanIndicateurTitle, normalizeForComparison } from "@/lib/indicateur-utils";

interface TableauRow {
  id: number;
  code: string;
  titre_fr: string;
  annuaire_annee: string;
  thematique_nom: string;
}

interface GroupedIndicator {
  key: string;
  titre_fr: string;
  code: string;
  years: TableauRow[]; // sorted desc
}

export default function ThematiqueExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const thematiqueName = searchParams.get("thematique") || "";
  const [loading, setLoading] = useState(true);
  const [tableaux, setTableaux] = useState<TableauRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!thematiqueName) return;
    loadTableaux();
  }, [thematiqueName]);

  const loadTableaux = async () => {
    setLoading(true);
    const allRows: TableauRow[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    while (hasMore) {
      const data = await views.tableauxComplets({
        select: 'id, code, titre_fr, annuaire_annee, thematique_nom',
        from: offset,
        to: offset + limit - 1,
      });
      if (data && data.length > 0) {
        allRows.push(...(data as TableauRow[]));
        if (data.length < limit) hasMore = false;
        else offset += limit;
      } else {
        hasMore = false;
      }
    }
    const filtered = allRows.filter(
      (r) => normalizeThematiqueName(r.thematique_nom || "") === thematiqueName
    );
    setTableaux(filtered);
    setLoading(false);
  };

  const filteredTableaux = useMemo(() => {
    if (!searchQuery.trim()) return tableaux;
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tableaux.filter((t) => {
      const titre = (t.titre_fr || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const code = (t.code || "").toLowerCase();
      return titre.includes(query) || code.includes(query);
    });
  }, [tableaux, searchQuery]);

  // Group by cleaned indicator title — one card per indicator, regardless of year
  const groupedIndicators = useMemo<GroupedIndicator[]>(() => {
    const map = new Map<string, GroupedIndicator>();
    filteredTableaux.forEach((t) => {
      const key = normalizeForComparison(cleanIndicateurTitle(t.titre_fr || ""));
      if (!map.has(key)) {
        map.set(key, { key, titre_fr: t.titre_fr, code: t.code, years: [] });
      }
      map.get(key)!.years.push(t);
    });
    // Sort years inside each group desc, and use the most recent as the card's representative
    const groups = Array.from(map.values()).map((g) => {
      g.years.sort((a, b) => (b.annuaire_annee || "").localeCompare(a.annuaire_annee || ""));
      g.titre_fr = g.years[0].titre_fr;
      g.code = g.years[0].code;
      return g;
    });
    groups.sort((a, b) => a.code.localeCompare(b.code));
    return groups;
  }, [filteredTableaux]);

  const { Icon, colorClass } = getThematiqueIcon(thematiqueName);

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-card sticky top-0 z-50 border-x-0 border-t-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className={`p-2 rounded-xl ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{thematiqueName}</h1>
              <p className="text-xs text-muted-foreground">
                {groupedIndicators.length} tableau{groupedIndicators.length > 1 ? "x" : ""}
              </p>
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher par nom ou code de tableau..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="glass-card rounded-2xl p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        ) : groupedIndicators.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <Database className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun tableau trouvé pour cette thématique</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupedIndicators.map((group) => {
              const mostRecent = group.years[0];
              return (
                <Card
                  key={group.key}
                  className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden"
                  onClick={() =>
                    navigate(
                      `/thematique/tableau/${mostRecent.id}?thematique=${encodeURIComponent(thematiqueName)}`
                    )
                  }
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Table2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                    </div>
                    <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors mb-3 leading-snug line-clamp-2">
                      {group.titre_fr}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {group.code}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-1">
                        {group.years.length} année{group.years.length > 1 ? "s" : ""} :
                      </span>
                      {group.years.slice(0, 6).map((y) => (
                        <Badge
                          key={y.id}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                        >
                          {y.annuaire_annee}
                        </Badge>
                      ))}
                      {group.years.length > 6 && (
                        <span className="text-[10px] text-muted-foreground">+{group.years.length - 6}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
