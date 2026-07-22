import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { views, annuaires as annuairesApi, thematiques as thematiquesApi } from '@/lib/api';
import { normalizeThematiqueName } from '@/lib/thematique-utils';
import { cleanIndicateurTitle, normalizeCode } from '@/lib/indicateur-utils';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, ChevronRight, Loader2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const IndicateursList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);
  const [thematiques, setThematiques] = useState<Thematique[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnnuaire, setSelectedAnnuaire] = useState<string>('all');
  const [selectedThematique, setSelectedThematique] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Applied filters (only on button click)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedAnnuaire, setAppliedAnnuaire] = useState<string>('all');
  const [appliedThematique, setAppliedThematique] = useState<string>('all');

  const hasFilters = searchTerm !== '' || selectedAnnuaire !== 'all' || selectedThematique !== 'all';
  const applyFilters = () => { setAppliedSearch(searchTerm); setAppliedAnnuaire(selectedAnnuaire); setAppliedThematique(selectedThematique); setPage(0); };
  const clearFilters = () => { setSearchTerm(''); setSelectedAnnuaire('all'); setSelectedThematique('all'); setAppliedSearch(''); setAppliedAnnuaire('all'); setAppliedThematique('all'); setPage(0); };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch all tableaux (paginated - default limit is 1000)
      const fetchAllTableaux = async () => {
        const allRows: Indicateur[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const data = await views.tableauxComplets({ order_by: 'id', order_dir: 'ASC', from: from, to: from + pageSize - 1 });
          if (!data || data.length === 0) break;
          allRows.push(...(data as Indicateur[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return allRows;
      };
      
      const [annuairesData, thematiquesData, allTableaux] = await Promise.all([
        annuairesApi.getAll('desc'),
        thematiquesApi.getAll({ order: 'code' }),
        fetchAllTableaux()
      ]);

      setAnnuaires(annuairesData);
      setThematiques(thematiquesData);
      setIndicateurs(allTableaux);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Annuaires disponibles — tous les annuaires (pas de filtrage croisé pour permettre les combinaisons)
  const availableAnnuaires = useMemo(() => {
    return annuaires;
  }, [annuaires]);

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
      const searchLower = appliedSearch.toLowerCase().trim();
      const normalizedSearch = normalizeCode(appliedSearch);
      
      const matchesSearch = appliedSearch === '' ||
        cleanIndicateurTitle(ind.titre_fr).toLowerCase().includes(searchLower) ||
        ind.titre_fr.toLowerCase().includes(searchLower) ||
        normalizeCode(ind.code).includes(normalizedSearch);
      
      const matchesAnnuaire = appliedAnnuaire === 'all' || 
        annuaires.find(a => a.id.toString() === appliedAnnuaire)?.annee === ind.annuaire_annee;
      
      // Filtrer par nom normalisé de thématique (pas par code/ID)
      const matchesThematique = appliedThematique === 'all' ||
        cleanThematiqueName(ind.thematique_nom) === appliedThematique;

      return matchesSearch && matchesAnnuaire && matchesThematique;
    });
  }, [indicateurs, appliedSearch, appliedAnnuaire, appliedThematique, annuaires]);

  // Regrouper les indicateurs par titre nettoyé
  // Si un AS spécifique est sélectionné, on utilise le code comme clé pour éviter les fusions incorrectes
  const groupedIndicateurs = useMemo(() => {
    const groups = new Map<string, IndicateurGroupe>();
    const isSpecificAS = appliedAnnuaire !== 'all';
    
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
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#58061C]/5 via-white to-[#CFA452]/5 border border-[#58061C]/15 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-md shadow-[#58061C]/15">
                  <List className="h-5 w-5 text-white" />
                </div>
                Liste des tableaux
              </h1>
              <p className="text-slate-600 text-sm mt-2 ml-[52px]">
                {indicateurs.length} tableaux au total • {groupedIndicateurs.length} tableaux uniques
              </p>
            </div>
            {!loading && (
              <Badge variant="secondary" className="text-sm px-4 py-2 rounded-xl bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20 font-bold">
                {groupedIndicateurs.length} affiché{groupedIndicateurs.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 rounded-2xl border-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-4 bg-slate-50/50 rounded-t-2xl border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#58061C]" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (ex: 2-1, population...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl border-slate-300 bg-white shadow-sm"
                />
              </div>
              
              <Select value={selectedAnnuaire} onValueChange={setSelectedAnnuaire}>
                <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm">
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
                <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm">
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
            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters} size="sm" className="rounded-xl bg-gradient-to-r from-[#58061C] to-[#3B0211] hover:from-[#6b0a24] hover:to-[#58061C]digo-500 hover:to-[#58061C] text-white px-6 shadow-sm shadow-[#58061C]/15" disabled={!hasFilters}>
                Appliquer
              </Button>
              <Button onClick={clearFilters} variant="outline" size="sm" className="rounded-xl text-slate-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 border-slate-300" disabled={!hasFilters}>
                Effacer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-2 border-slate-200 shadow-sm rounded-2xl">
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
                <>
                {/* Pagination top */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} sur <span className="text-[#58061C] font-bold">{totalItems}</span></p>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">← Précédent</Button>
                      <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">Suivant →</Button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 border-b-2 border-slate-200">
                    <TableHead className="font-bold text-slate-700">Titre</TableHead>
                    <TableHead className="w-64 font-bold text-slate-700">Présent dans</TableHead>
                    <TableHead className="w-48 font-bold text-slate-700">Thématique</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((groupe) => (
                    <TableRow 
                      key={groupe.cleanTitle}
                      className="cursor-pointer hover:bg-[#58061C]/8/50 transition-colors"
                      onClick={() => navigate(`/admin/indicateurs/${groupe.occurrences[0].id}`)}
                    >
                      <TableCell className="font-medium text-slate-900">
                        {groupe.cleanTitle}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {groupe.occurrences.map((occ) => (
                            <Badge 
                              key={occ.id} 
                              variant="outline" 
                              className="text-xs cursor-pointer hover:bg-[#58061C] hover:text-white border-[#58061C]/20 text-[#58061C] transition-colors"
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
                      <TableCell className="text-slate-600 font-medium">
                        {groupe.cleanThematique}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {/* Pagination bottom */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t-2 border-slate-200">
                  <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} sur <span className="text-[#58061C] font-bold">{totalItems}</span></p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => { setPage(Math.max(0, page - 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={page === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">← Précédent</Button>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={page >= totalPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">Suivant →</Button>
                  </div>
                </div>
              )}
              </>
              );
            })()}
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
};

export default IndicateursList;
