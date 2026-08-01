import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { views, tableauxIndices } from '@/lib/api';
import { normalizeThematiqueName } from '@/lib/thematique-utils';
import { 
  cleanIndicateurTitle, 
  extractIndiceFromTitle, 
  normalizeForComparison, 
  normalizeCode,
  generateGroupKey,
  isFragmentTitle 
} from '@/lib/indicateur-utils';
import { getThematiqueIcon } from '@/lib/thematique-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Search,
  Loader2,
  LogIn,
  Home,
  Filter,
  Link2
} from 'lucide-react';

interface Indicateur {
  id: number;
  code: string;
  titre_fr: string;
  annuaire_annee: string;
  thematique_nom: string;
}

interface IndiceSignification {
  id_tableau: number;
  code_indice: string;
  signification_fr: string | null;
}

interface IndicateurDisplay {
  id: number;
  code: string;
  titreClean: string;
  titreOriginal: string;
  annuaireAnnee: string;
  thematiqueClean: string;
  thematiqueOriginal: string;
  hasSerie: boolean;
  indiceInTitre: string | null; // ex: "(1)"
  significationIndice: string | null; // La signification de l'indice
}

const Indicateurs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<IndicateurDisplay[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Récupérer la thématique et l'annuaire depuis l'URL si présents
  const thematiqueFromUrl = searchParams.get('thematique');
  const annuaireFromUrl = searchParams.get('annuaire');
  const [selectedAnnuaire, setSelectedAnnuaire] = useState<string>(annuaireFromUrl || 'tous');
  const [selectedThematique, setSelectedThematique] = useState<string>(thematiqueFromUrl ? normalizeThematiqueName(thematiqueFromUrl) : 'tous');

  // Mettre à jour la thématique et l'annuaire si l'URL change
  useEffect(() => {
    setSelectedThematique(thematiqueFromUrl ? normalizeThematiqueName(thematiqueFromUrl) : 'tous');
    setSelectedAnnuaire(annuaireFromUrl || 'tous');
  }, [thematiqueFromUrl, annuaireFromUrl]);

  const syncFiltersToUrl = (annuaire: string, thematique: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (annuaire !== 'tous') {
      nextParams.set('annuaire', annuaire);
    } else {
      nextParams.delete('annuaire');
    }

    if (thematique !== 'tous') {
      nextParams.set('thematique', thematique);
    } else {
      nextParams.delete('thematique');
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleAnnuaireChange = (value: string) => {
    setSelectedAnnuaire(value);
    syncFiltersToUrl(value, selectedThematique);
  };

  const handleThematiqueChange = (value: string) => {
    setSelectedThematique(value);
    syncFiltersToUrl(selectedAnnuaire, value);
  };

  useEffect(() => {
    fetchIndicateurs();
  }, []);

  // Note: pas de réinitialisation automatique des filtres.
  // Si la combinaison annuaire+thématique ne renvoie aucun résultat,
  // on laisse l'utilisateur voir l'état vide et ajuster lui-même.

  // Fonction pour nettoyer le nom de thématique - utilise la fonction utilitaire
  const cleanThematiqueName = normalizeThematiqueName;

  const fetchIndicateurs = async () => {
    setLoading(true);

    // Fetch all rows (default Supabase limit is 1000, we need all)
    const fetchAllTableaux = async () => {
      const allRows: Indicateur[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const data = await views.tableauxComplets({
          select: 'id, code, titre_fr, annuaire_annee, thematique_nom',
          order_by: 'id',
          order_dir: 'asc',
          from,
          to: from + pageSize - 1,
        });
        if (!data || data.length === 0) break;
        allRows.push(...(data as Indicateur[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    };

    const [allTableaux, seriesData, indicesData] = await Promise.all([
      fetchAllTableaux(),
      views.seriesTemporelles(),
      tableauxIndices.getAll()
    ]);

    if (!allTableaux || allTableaux.length === 0) {
      setLoading(false);
      return;
    }

    const rawIndicateurs = allTableaux;

    const linkedIds = new Set<number>();
    (seriesData || []).forEach((l: any) => {
      if (typeof l.source_id === 'number') linkedIds.add(l.source_id);
      if (typeof l.cible_id === 'number') linkedIds.add(l.cible_id);
    });

    // Créer une map des significations par indicateur et code_indice
    const indicesMap = new Map<string, string>();
    (indicesData || []).forEach((idx: IndiceSignification) => {
      if (idx.signification_fr) {
        // Clé: "id_tableau|code_indice" -> signification
        const key = `${idx.id_tableau}|${idx.code_indice}`;
        indicesMap.set(key, idx.signification_fr);
      }
    });

    const processed: IndicateurDisplay[] = rawIndicateurs.map((ind: Indicateur) => {
      const indiceInTitre = extractIndiceFromTitle(ind.titre_fr);
      // Chercher la signification de l'indice pour cet indicateur
      let significationIndice: string | null = null;
      if (indiceInTitre) {
        const key = `${ind.id}|${indiceInTitre}`;
        significationIndice = indicesMap.get(key) || null;
      }
      
      return {
        id: ind.id,
        code: ind.code,
        titreClean: cleanIndicateurTitle(ind.titre_fr, { removeIndices: true }),
        titreOriginal: ind.titre_fr,
        annuaireAnnee: ind.annuaire_annee,
        thematiqueClean: cleanThematiqueName(ind.thematique_nom),
        thematiqueOriginal: ind.thematique_nom || 'Non classé',
        hasSerie: linkedIds.has(ind.id),
        indiceInTitre,
        significationIndice,
      };
    });

    // Filtrer les indicateurs dont le titre nettoyé est vide ou qui sont des fragments/sous-sections
    const valid = processed.filter(ind => 
      ind.titreClean.trim().length > 0 && !isFragmentTitle(ind.titreOriginal)
    );

    // Trier par titre clean puis par année décroissante
    valid.sort((a, b) => {
      const titleCompare = a.titreClean.localeCompare(b.titreClean);
      if (titleCompare !== 0) return titleCompare;
      return b.annuaireAnnee.localeCompare(a.annuaireAnnee);
    });

    setIndicateurs(valid);
    setLoading(false);
  };

  // Liste des années d'annuaires disponibles (filtrées selon thématique sélectionnée)
  const annuairesDisponibles = useMemo(() => {
    let filtered = indicateurs;
    if (selectedThematique !== 'tous') {
      filtered = indicateurs.filter(i => i.thematiqueClean === selectedThematique);
    }
    const years = new Set(filtered.map(i => i.annuaireAnnee));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [indicateurs, selectedThematique]);

  // Liste des thématiques nettoyées disponibles (filtrées selon année sélectionnée)
  const thematiquesDisponibles = useMemo(() => {
    let filtered = indicateurs;
    if (selectedAnnuaire !== 'tous') {
      filtered = indicateurs.filter(i => i.annuaireAnnee === selectedAnnuaire);
    }
    const themes = new Set(filtered.map(i => i.thematiqueClean));
    return Array.from(themes).sort((a, b) => a.localeCompare(b));
  }, [indicateurs, selectedAnnuaire]);

  // Filtrer les indicateurs
  const filteredIndicateurs = useMemo(() => {
    return indicateurs.filter(ind => {
      // Filtre par annuaire
      if (selectedAnnuaire !== 'tous' && ind.annuaireAnnee !== selectedAnnuaire) {
        return false;
      }

      // Filtre par thématique
      if (selectedThematique !== 'tous' && ind.thematiqueClean !== selectedThematique) {
        return false;
      }

      // Filtre par recherche
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const searchNormalized = normalizeForComparison(searchTerm);
        const normalizedSearchCode = normalizeCode(searchTerm);
        
        // Recherche par titre
        const matchesTitre = ind.titreClean.toLowerCase().includes(searchLower) ||
                           ind.titreOriginal.toLowerCase().includes(searchLower) ||
                           normalizeForComparison(ind.titreClean).includes(searchNormalized) ||
                           normalizeForComparison(ind.titreOriginal).includes(searchNormalized);
        
        // Recherche par code avec tolérance aux espaces
        const matchesCode = normalizeCode(ind.code).includes(normalizedSearchCode);
        
        // Recherche par thématique
        const matchesThematique = ind.thematiqueClean.toLowerCase().includes(searchLower) ||
                                  normalizeForComparison(ind.thematiqueClean).includes(searchNormalized);
        
        // Recherche par année/annuaire
        const matchesAnnuaire = ind.annuaireAnnee.includes(searchLower) ||
                                `as ${ind.annuaireAnnee}`.includes(searchLower) ||
                                `annuaire ${ind.annuaireAnnee}`.includes(searchLower);
        
        if (!matchesTitre && !matchesCode && !matchesThematique && !matchesAnnuaire) {
          return false;
        }
      }

      return true;
    });
  }, [indicateurs, selectedAnnuaire, selectedThematique, searchTerm]);

  // Grouper par titre clean + signification_indice pour l'affichage "Tous"
  // Si même titre + même signification d'indice → regrouper (même si codes différents)
  // Si même titre + significations différentes → séparer
  const groupedByTitre = useMemo(() => {
    if (selectedAnnuaire !== 'tous') {
      return null; // Pas de groupement si un AS spécifique est sélectionné
    }

    // Grouper par titre + signification (normalisée)
    const groups = new Map<string, IndicateurDisplay[]>();
    filteredIndicateurs.forEach(ind => {
      const key = generateGroupKey(ind.titreClean, ind.significationIndice);
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(ind);
    });

    // Identifier les titres qui ont plusieurs groupes (différentes significations)
    const titreGroupCount = new Map<string, number>();
    groups.forEach((_, key) => {
      const titreKey = key.split('|||')[0];
      titreGroupCount.set(titreKey, (titreGroupCount.get(titreKey) || 0) + 1);
    });

    return Array.from(groups.entries()).map(([key, items]) => {
      const titreKey = key.split('|||')[0];
      const hasMultipleGroups = (titreGroupCount.get(titreKey) || 0) > 1;
      
      return {
        titreClean: items[0].titreClean,
        thematiqueClean: items[0].thematiqueClean,
        // Afficher la signification si ce titre a plusieurs groupes
        significationIndice: hasMultipleGroups ? items[0].significationIndice : null,
        occurrences: items.sort((a, b) => b.annuaireAnnee.localeCompare(a.annuaireAnnee))
      };
    });
  }, [filteredIndicateurs, selectedAnnuaire]);

  const handleIndicateurClick = (id: number) => {
    navigate(`/indicateurs/${id}`);
  };

  // Navigation vers la vue groupée (sans filtre AS)
  // Si une signification est fournie, on l'ajoute à l'URL pour identifier le groupe spécifique
  const handleGroupClick = (titreClean: string, signification: string | null) => {
    const encodedTitre = encodeURIComponent(titreClean);
    if (signification) {
      navigate(`/indicateurs/groupe?titre=${encodedTitre}&signification=${encodeURIComponent(signification)}`);
    } else {
      navigate(`/indicateurs/groupe?titre=${encodedTitre}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Liste des Tableaux</h1>
              <p className="text-xs text-muted-foreground">Consulter et comparer les données</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                Accueil
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                Connexion
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filtres */}
        <div className="mb-8 space-y-4">
          {/* Barre de recherche */}
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre ou code (ex: 2-1, 2 - 1, 2-1...)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filtres AS et Thématique */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtres:</span>
            </div>
            
            <Select value={selectedAnnuaire} onValueChange={handleAnnuaireChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Annuaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les annuaires</SelectItem>
                {annuairesDisponibles.map(annee => (
                  <SelectItem key={annee} value={annee}>
                    AS {annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedThematique} onValueChange={handleThematiqueChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Thématique" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Toutes les thématiques</SelectItem>
                {thematiquesDisponibles.map(theme => (
                  <SelectItem key={theme} value={theme}>
                    {theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {selectedAnnuaire === 'tous' && groupedByTitre 
              ? `${groupedByTitre.length} tableau${groupedByTitre.length > 1 ? 'x' : ''} (groupés)`
              : `${filteredIndicateurs.length} tableau${filteredIndicateurs.length > 1 ? 'x' : ''}`
            }
          </Badge>
          {selectedAnnuaire !== 'tous' && (
            <Badge variant="outline">AS {selectedAnnuaire}</Badge>
          )}
          {selectedThematique !== 'tous' && (
            <Badge variant="outline">{selectedThematique}</Badge>
          )}
        </div>

        {/* Liste des Indicateurs */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredIndicateurs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchTerm || selectedAnnuaire !== 'tous' || selectedThematique !== 'tous'
                  ? 'Aucun tableau trouvé avec ces critères'
                  : 'Aucun tableau disponible'}
              </p>
            </CardContent>
          </Card>
        ) : selectedAnnuaire === 'tous' && groupedByTitre ? (
          // Affichage groupé en grille quand "Tous les annuaires" est sélectionné
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groupedByTitre.map((groupe, idx) => (
              <Card 
                key={`${groupe.titreClean}-${groupe.significationIndice || idx}`}
                className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden h-full"
                onClick={() => handleGroupClick(groupe.titreClean, groupe.significationIndice)}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Icon et indicateur série */}
                  {(() => {
                    const { Icon, colorClass } = getThematiqueIcon(groupe.thematiqueClean);
                    return (
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`p-2.5 rounded-xl ${colorClass} shrink-0 transition-transform group-hover:scale-110`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {groupe.occurrences.some(o => o.hasSerie) && (
                          <Badge className="text-xs bg-amber-500/10 text-amber-600 border-0 inline-flex items-center gap-1 shrink-0">
                            <Link2 className="h-3 w-3" />
                            Série
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Titre */}
                  <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-3 line-clamp-3 flex-grow">
                    {groupe.titreClean}
                  </h4>
                  
                  {/* Badges en bas */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {groupe.thematiqueClean}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      {groupe.occurrences.length} AS
                    </Badge>
                    {groupe.significationIndice && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 font-normal">
                        {groupe.significationIndice}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Affichage individuel en grille quand un AS spécifique est sélectionné
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredIndicateurs.map((ind) => (
              <Card 
                key={ind.id}
                className="group cursor-pointer glass-card-hover gradient-border rounded-2xl border-0 overflow-hidden h-full"
                onClick={() => handleIndicateurClick(ind.id)}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Icon et indicateur série */}
                  {(() => {
                    const { Icon, colorClass } = getThematiqueIcon(ind.thematiqueClean);
                    return (
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`p-2.5 rounded-xl ${colorClass} shrink-0 transition-transform group-hover:scale-110`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {ind.hasSerie && (
                          <Badge className="text-xs bg-amber-500/10 text-amber-600 border-0 inline-flex items-center gap-1 shrink-0">
                            <Link2 className="h-3 w-3" />
                            Série
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Titre */}
                  <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-3 line-clamp-3 flex-grow">
                    {ind.titreClean}
                  </h4>
                  
                  {/* Badges en bas */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {ind.thematiqueClean}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      AS {ind.annuaireAnnee}
                    </Badge>
                    <Badge className="text-xs bg-primary/10 text-primary border-0 font-normal">
                      {ind.code}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-12">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Annuaire Statistique du Maroc - Centre National de Documentation</p>
        </div>
      </footer>
    </div>
  );
};

export default Indicateurs;
