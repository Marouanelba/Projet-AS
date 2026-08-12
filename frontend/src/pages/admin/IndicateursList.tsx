import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { views, annuaires as annuairesApi, thematiques as thematiquesApi } from '@/lib/api';
import { normalizeThematiqueName } from '@/lib/thematique-utils';
import { cleanIndicateurTitle, normalizeCode } from '@/lib/indicateur-utils';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, ChevronRight, Loader2 } from 'lucide-react';

interface Annuaire {
  id: number;
  annee: string;
}

interface Thematique {
  id: number;
  code: string;
  nom_fr: string;
  id_annuaire: number;
}

interface Indicateur {
  id: number;
  code: string;
  titre_fr: string;
  thematique_code: string;
  thematique_nom: string;
  annuaire_annee: string;
}

interface IndicateurGroupe {
  cleanTitle: string;
  cleanThematique: string;
  occurrences: {
    id: number;
    code: string;
    annee: string;
    thematique_code: string;
    thematique_nom: string;
  }[];
}

// Fonction pour nettoyer le nom de la thématique - utilise la fonction utilitaire
const cleanThematiqueName = normalizeThematiqueName;

const PAGE_SIZE = 50;

const IndicateursList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);
  const [thematiques, setThematiques] = useState<Thematique[]>([]);
  
  // Recherche, filtres et pagination vivent dans l'URL, pas dans un état local :
  // en revenant d'un tableau, la liste doit se rouvrir à la page consultée et
  // non repartir de la page 1. Le retour arrière restaure l'URL, donc l'état.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('q') || '';
  const selectedAnnuaire = searchParams.get('annuaire') || 'all';
  const selectedThematique = searchParams.get('thematique') || 'all';
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);

  /** Écrit dans l'URL en n'y laissant que les paramètres utiles. */
  const majParams = (maj: Record<string, string>, resetPage = true) => {
    const p = new URLSearchParams(searchParams);
    Object.entries(maj).forEach(([k, v]) => {
      if (!v || v === 'all' || v === '0') p.delete(k);
      else p.set(k, v);
    });
    // Tout changement de filtre ramène à la première page
    if (resetPage) p.delete('page');
    setSearchParams(p, { replace: true });
  };

  const setSearchTerm = (v: string) => majParams({ q: v });
  const setSelectedAnnuaire = (v: string) => majParams({ annuaire: v });
  const setSelectedThematique = (v: string) => majParams({ thematique: v });
  const setPage = (v: number) => majParams({ page: String(v) }, false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const fetchAllTableaux = async () => {
      const allRows: Indicateur[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const data = await views.tableauxComplets({ from, to: from + pageSize - 1, include_hidden: true });
        if (!data || data.length === 0) break;
        allRows.push(...(data as Indicateur[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    };
    
    const [annuairesData, thematiquesData, allTableaux] = await Promise.all([
      annuairesApi.getAll('desc', true),
      thematiquesApi.getAll(),
      fetchAllTableaux()
    ]);

    if (annuairesData) setAnnuaires(annuairesData);
    if (thematiquesData) setThematiques(thematiquesData);
    if (allTableaux) setIndicateurs(allTableaux);
    
    setLoading(false);
  };

  // Annuaires disponibles (filtrés selon thématique sélectionnée)
  const availableAnnuaires = useMemo(() => {
    if (selectedThematique === 'all') {
      return annuaires;
    }
    // Trouver les thématiques qui correspondent au nom nettoyé sélectionné
    const selectedCleanName = cleanThematiqueName(
      thematiques.find(t => t.id.toString() === selectedThematique)?.nom_fr || ''
    );
    const matchingThematiqueIds = new Set(
      thematiques.filter(t => cleanThematiqueName(t.nom_fr) === selectedCleanName).map(t => t.id_annuaire)
    );
    return annuaires.filter(a => matchingThematiqueIds.has(a.id));
  }, [annuaires, selectedThematique, thematiques]);

  // Thématiques nettoyées pour le dropdown (regroupées par nom normalisé)
  // Utilise le nom normalisé comme clé, pas l'ID
  const cleanedThematiques = useMemo(() => {
    const uniqueClean = new Map<string, string>(); // normalizedName -> originalName
    
    thematiques.forEach(t => {
      const normalizedName = cleanThematiqueName(t.nom_fr);
      if (!uniqueClean.has(normalizedName)) {
        uniqueClean.set(normalizedName, normalizedName);
      }
    });
    
    return Array.from(uniqueClean.keys()).sort((a, b) => a.localeCompare(b));
  }, [thematiques]);

  const filteredIndicateurs = useMemo(() => {
    return indicateurs.filter(ind => {
      // Recherche tolérante aux espaces dans le code
      const searchLower = searchTerm.toLowerCase().trim();
      const normalizedSearch = normalizeCode(searchTerm);
      
      const matchesSearch = searchTerm === '' ||
        cleanIndicateurTitle(ind.titre_fr).toLowerCase().includes(searchLower) ||
        ind.titre_fr.toLowerCase().includes(searchLower) ||
        normalizeCode(ind.code).includes(normalizedSearch);
      
      const matchesAnnuaire = selectedAnnuaire === 'all' || 
        annuaires.find(a => a.id.toString() === selectedAnnuaire)?.annee === ind.annuaire_annee;
      
      // Filtrer par nom normalisé de thématique (pas par code/ID)
      const matchesThematique = selectedThematique === 'all' ||
        cleanThematiqueName(ind.thematique_nom) === selectedThematique;

      return matchesSearch && matchesAnnuaire && matchesThematique;
    });
  }, [indicateurs, searchTerm, selectedAnnuaire, selectedThematique, annuaires]);

  // Regrouper les indicateurs par titre nettoyé
  // Si un AS spécifique est sélectionné, on utilise le code comme clé pour éviter les fusions incorrectes
  const groupedIndicateurs = useMemo(() => {
    const groups = new Map<string, IndicateurGroupe>();
    const isSpecificAS = selectedAnnuaire !== 'all';
    
    filteredIndicateurs.forEach(ind => {
      const cleanTitle = cleanIndicateurTitle(ind.titre_fr);
      const cleanThematique = cleanThematiqueName(ind.thematique_nom);
      
      // Si un AS spécifique est sélectionné, on utilise titre + code comme clé
      // pour éviter de fusionner des indicateurs différents avec le même titre
      const groupKey = isSpecificAS ? `${cleanTitle}__${ind.code}` : cleanTitle;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          cleanTitle,
          cleanThematique,
          occurrences: []
        });
      }
      
      groups.get(groupKey)!.occurrences.push({
        id: ind.id,
        code: ind.code,
        annee: ind.annuaire_annee,
        thematique_code: ind.thematique_code,
        thematique_nom: ind.thematique_nom
      });
    });
    
    // Trier les occurrences par année décroissante
    groups.forEach(group => {
      group.occurrences.sort((a, b) => b.annee.localeCompare(a.annee));
    });
    
    // Convertir en tableau et trier par code puis par titre
    return Array.from(groups.values()).sort((a, b) => {
      // Trier par code si disponible
      const codeA = a.occurrences[0]?.code || '';
      const codeB = b.occurrences[0]?.code || '';
      // Extraire les numéros du code pour un tri numérique (ex: "2 - 1" -> [2, 1])
      const parseCode = (code: string) => {
        const match = code.match(/(\d+)\s*-\s*(\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2])] : [999, 999];
      };
      const [a1, a2] = parseCode(codeA);
      const [b1, b2] = parseCode(codeB);
      if (a1 !== b1) return a1 - b1;
      if (a2 !== b2) return a2 - b2;
      return a.cleanTitle.localeCompare(b.cleanTitle);
    });
  }, [filteredIndicateurs, selectedAnnuaire]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Liste des tableaux</h1>
            <p className="text-muted-foreground mt-1">
              {indicateurs.length} tableaux au total • {groupedIndicateurs.length} tableaux uniques
            </p>
          </div>
          {!loading && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {groupedIndicateurs.length} affiché{groupedIndicateurs.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (ex: 2-1, 2 - 1, population...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedAnnuaire} onValueChange={setSelectedAnnuaire}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les annuaires" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les annuaires</SelectItem>
                  {availableAnnuaires.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      AS {a.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedThematique} onValueChange={setSelectedThematique}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les thématiques" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les thématiques</SelectItem>
                  {cleanedThematiques.map(name => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : groupedIndicateurs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {indicateurs.length === 0 
                  ? "Aucun tableau dans la base de données"
                  : "Aucun résultat pour ces filtres"
                }
              </div>
            ) : (() => {
              const totalItems = groupedIndicateurs.length;
              const totalPages = Math.ceil(totalItems / PAGE_SIZE);
              const paginated = groupedIndicateurs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
              return (
                <div className="flex flex-col">
                  {/* Pagination top */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50/50">
                      <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} sur <span className="text-foreground font-bold">{totalItems}</span></p>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-4">← Précédent</Button>
                        <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-4">Suivant →</Button>
                      </div>
                    </div>
                  )}
                  
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead className="w-64">Présent dans</TableHead>
                    <TableHead className="w-48">Thématique</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((groupe) => (
                    <TableRow 
                      key={groupe.cleanTitle}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/indicateurs/${groupe.occurrences[0].id}`)}
                    >
                      <TableCell className="font-medium">
                        {groupe.cleanTitle}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {groupe.occurrences.map((occ) => (
                            <Badge 
                              key={occ.id} 
                              variant="outline" 
                              className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/indicateurs/${occ.id}`);
                              }}
                              title={`Code: ${occ.code}`}
                            >
                              AS {occ.annee}: {occ.code}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {groupe.cleanThematique}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination bottom */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
                  <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} sur <span className="text-foreground font-bold">{totalItems}</span></p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => { setPage(Math.max(0, page - 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={page === 0} className="px-4">← Précédent</Button>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={page >= totalPages - 1} className="px-4">Suivant →</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
};

export default IndicateursList;
