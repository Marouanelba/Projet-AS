import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeThematiqueName } from '@/lib/thematique-utils';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, AlertCircle, Plus, Loader2, ArrowRight, Trash2, Sparkles, Check, X, FileText, RefreshCw, Equal, GitMerge, Replace, Ban, Settings2, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useStructureComparison } from '@/hooks/useStructureComparison';
import { StructureComparisonComponent } from '@/components/StructureComparison';
import { suggestLiaisonType, type TypeSuggestion } from '@/lib/liaison-type-suggester';
import { SuggestionCard } from '@/components/SuggestionCard';
import { FusionStrategyModal } from '@/components/FusionStrategyModal';
import { ColumnSelectionModal } from '@/components/ColumnSelectionModal';
import { HorizontalExtensionModal } from '@/components/HorizontalExtensionModal';

interface Rupture {
  id: number;
  id_tableau: number;
  annee_rupture: string;
  direction: 'precedente' | 'suivante';
  notes: string | null;
}

interface Orphelin {
  id: number;
  code: string;
  titre_fr: string;
  annee: string;
  thematique: string;
}

interface SerieTemporelle {
  liaison_id: number;
  type_liaison: string;
  confiance: number;
  source_id: number;
  source_code: string;
  source_titre: string;
  source_annee: string;
  cible_id: number;
  cible_code: string;
  cible_titre: string;
  cible_annee: string;
}

interface Indicateur {
  id: number;
  code: string;
  titre_fr: string;
  thematique_code: string;
  thematique_nom: string;
  annuaire_annee: string;
  notes_fr?: string | null;
  source_fr?: string | null;
  unite_fr?: string | null;
}

interface IndicateurDetail {
  id: number;
  code: string;
  titre_fr: string;
  notes_fr: string | null;
  source_fr: string | null;
  unite_fr: string | null;
  indices: IndicateurIndice[];
}

interface IndicateurIndice {
  id: number;
  code_indice: string;
  signification_fr: string | null;
}

interface Annuaire {
  id: number;
  annee: string;
  titre_fr: string | null;
}

interface Suggestion {
  source_id: number;
  source_code: string;
  source_titre: string;
  source_annee: string;
  cible_id: number;
  cible_code: string;
  cible_titre: string;
  cible_annee: string;
  similarite: number;
  source_detail?: IndicateurDetail | null;
  cible_detail?: IndicateurDetail | null;
}

// Fonction pour nettoyer le nom de la thématique - utilise la fonction utilitaire
const cleanThematiqueName = normalizeThematiqueName;

const Liaisons = () => {
  const [loading, setLoading] = useState(true);
  const [allOrphelins, setAllOrphelins] = useState<Orphelin[]>([]);
  const [series, setSeries] = useState<SerieTemporelle[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [ruptures, setRuptures] = useState<Rupture[]>([]);
  const [fusionConfigured, setFusionConfigured] = useState<Set<number>>(new Set());
  
  const [sourceId, setSourceId] = useState<string>('');
  const [cibleId, setCibleId] = useState<string>('');
  const [typeLiaison, setTypeLiaison] = useState<string>('fusionne');
  const [typeSuggestion, setTypeSuggestion] = useState<TypeSuggestion | null>(null);
  const [typeManuallyChanged, setTypeManuallyChanged] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Détails des indicateurs sélectionnés
  const [sourceDetail, setSourceDetail] = useState<IndicateurDetail | null>(null);
  const [cibleDetail, setCibleDetail] = useState<IndicateurDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filtre thématique unique pour créer liaison + annuaires source/cible
  const [selectedThematique, setSelectedThematique] = useState<string>('');
  const [sourceAnnuaire, setSourceAnnuaire] = useState<string>('');
  const [cibleAnnuaire, setCibleAnnuaire] = useState<string>('');
  
  // Filtres pour l'onglet suggestions (thématique unique)
  const [suggestionThematique, setSuggestionThematique] = useState<string>('');
  const [suggestionSourceAnnuaire, setSuggestionSourceAnnuaire] = useState<string>('');
  const [suggestionCibleAnnuaire, setSuggestionCibleAnnuaire] = useState<string>('');
  
  // Filtre pour orphelins
  const [orphelinThematique, setOrphelinThematique] = useState<string>('');
  const [orphelinAnnee, setOrphelinAnnee] = useState<string>('');
  const [orphelinStatut, setOrphelinStatut] = useState<string>('all');
  // Applied filters (only applied on button click)
  const [appliedOrphelinFilters, setAppliedOrphelinFilters] = useState({ thematique: '', annee: '', statut: 'all' });
  const [orphelinPage, setOrphelinPage] = useState(0);
  const ORPHELIN_PAGE_SIZE = 50;
  const applyOrphelinFilters = () => { setAppliedOrphelinFilters({ thematique: orphelinThematique, annee: orphelinAnnee, statut: orphelinStatut }); setOrphelinPage(0); };
  const clearOrphelinFilters = () => { setOrphelinThematique(''); setOrphelinAnnee(''); setOrphelinStatut('all'); setAppliedOrphelinFilters({ thematique: '', annee: '', statut: 'all' }); setOrphelinPage(0); };
  // Get unique years from orphelins data directly
  const orphelinYears = useMemo(() => Array.from(new Set(allOrphelins.map(o => String(o.annee).trim()))).sort((a, b) => b.localeCompare(a)), [allOrphelins]);
  
  // État pour l'onglet actif
  const [activeTab, setActiveTab] = useState<string>('orphelins');
  
  // État pour le modal de fusion
  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [columnSelectionModalOpen, setColumnSelectionModalOpen] = useState(false);
  const [horizontalExtensionModalOpen, setHorizontalExtensionModalOpen] = useState(false);
  
  // État pour l'aperçu d'une série
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSerie, setPreviewSerie] = useState<SerieTemporelle | null>(null);
  const [previewData, setPreviewData] = useState<{ entetes: any[][]; donnees: any[][]; source: string } | null>(null);
  const [pendingLiaison, setPendingLiaison] = useState<{
    liaisonId: number;
    sourceId: number;
    cibleId: number;
    sourceAnnee: string;
    cibleAnnee: string;
    typeLiaison: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch all rows with pagination (bypasses 1000-row limit)
  const fetchAllFromQuery = async <T,>(buildQuery: (offset: number, limit: number) => any): Promise<T[]> => {
    const pageSize = 1000;
    let allData: T[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await buildQuery(offset, offset + pageSize - 1);
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...(data as T[])];
        offset += pageSize;
        if (data.length < pageSize) hasMore = false;
      }
    }
    return allData;
  };

  const fetchData = async () => {
    setLoading(true);
    
    const [orphelins, seriesData, indicateursData, annuairesData, rupturesData, fusionData] = await Promise.all([
      fetchAllFromQuery<Orphelin>((o, l) => supabase.from('v_tableaux_sans_liaison').select('*').range(o, l)),
      fetchAllFromQuery<SerieTemporelle>((o, l) => supabase.from('v_series_temporelles').select('*').range(o, l)),
      fetchAllFromQuery<Indicateur>((o, l) => supabase.from('v_tableaux_complets').select('*').range(o, l)),
      fetchAllFromQuery<Annuaire>((o, l) => supabase.from('annuaires').select('*').order('annee', { ascending: false }).range(o, l)),
      fetchAllFromQuery<Rupture>((o, l) => supabase.from('tableaux_ruptures').select('*').range(o, l)),
      fetchAllFromQuery<{ id_liaison: number }>((o, l) => supabase.from('tableaux_fusion').select('id_liaison').range(o, l))
    ]);

    setAllOrphelins(orphelins);
    setSeries(seriesData);
    setIndicateurs(indicateursData);
    setAnnuaires(annuairesData);
    setRuptures(rupturesData);
    setFusionConfigured(new Set(fusionData.map(f => f.id_liaison)));
    
    setLoading(false);
  };
  
  // Vérifier si une liaison existe déjà entre deux indicateurs
  const liaisonExists = (sourceId: number, cibleId: number) => {
    return series.some(s => 
      (s.source_id === sourceId && s.cible_id === cibleId) ||
      (s.source_id === cibleId && s.cible_id === sourceId)
    );
  };
  
  // Charger les détails d'un tableau
  const fetchTableauDetail = async (tableauId: number): Promise<IndicateurDetail | null> => {
    const [indRes, indicesRes] = await Promise.all([
      supabase.from('tableaux').select('id, code, titre_fr, notes_fr, source_fr, unite_fr').eq('id', tableauId).single(),
      supabase.from('tableaux_indices').select('id, code_indice, signification_fr').eq('id_tableau', tableauId)
    ]);
    
    if (indRes.data) {
      return {
        ...indRes.data,
        indices: indicesRes.data || []
      };
    }
    return null;
  };
  
  // Charger les suggestions basées sur la similarité entre 2 annuaires avec filtrage par thématique
  const fetchSuggestions = async () => {
    if (!suggestionSourceAnnuaire || !suggestionCibleAnnuaire) {
      toast.error('Veuillez sélectionner deux annuaires');
      return;
    }
    
    if (!suggestionThematique) {
      toast.error('Veuillez sélectionner une thématique');
      return;
    }
    
    setLoadingSuggestions(true);
    setSuggestions([]);
    
    // Filtrer par thématique nettoyée ET annuaire source
    const indicateursSource = indicateurs.filter(ind => 
      ind.annuaire_annee === suggestionSourceAnnuaire && 
      cleanThematiqueName(ind.thematique_nom) === suggestionThematique
    );
    
    // On prend les indicateurs de l'annuaire source et on cherche des similaires dans l'annuaire cible
    const allSuggestions: Suggestion[] = [];
    
    for (const indicateur of indicateursSource) {
      const { data } = await supabase.rpc('find_similar_tableaux', {
        p_tableau_id: indicateur.id,
        p_seuil: 0.4
      });
      
      if (data && data.length > 0) {
        // Filtrer pour ne garder que les indicateurs de l'annuaire cible ET de la même thématique nettoyée
        const matchesInCible = data.filter((d: { id: number; annee: string; thematique: string }) => 
          d.annee === suggestionCibleAnnuaire && 
          cleanThematiqueName(indicateurs.find(ind => ind.id === d.id)?.thematique_nom || '') === suggestionThematique
        );
        
        if (matchesInCible.length > 0) {
          const best = matchesInCible[0];
          
          // Vérifier si cette liaison spécifique existe déjà
          if (liaisonExists(indicateur.id, best.id)) {
            continue; // Passer à l'indicateur suivant si déjà lié
          }
          
          // Charger les détails des deux indicateurs
          const [sourceDetailData, cibleDetailData] = await Promise.all([
            fetchTableauDetail(indicateur.id),
            fetchTableauDetail(best.id)
          ]);
          
          allSuggestions.push({
            source_id: indicateur.id,
            source_code: indicateur.code,
            source_titre: indicateur.titre_fr,
            source_annee: indicateur.annuaire_annee,
            cible_id: best.id,
            cible_code: best.code,
            cible_titre: best.titre_fr,
            cible_annee: best.annee,
            similarite: best.similarite,
            source_detail: sourceDetailData,
            cible_detail: cibleDetailData
          });
        }
      }
    }
    
    setSuggestions(allSuggestions);
    setLoadingSuggestions(false);
    
    if (allSuggestions.length === 0) {
      toast.info('Aucune suggestion trouvée entre ces deux annuaires');
    } else {
      toast.success(`${allSuggestions.length} suggestion(s) trouvée(s)`);
    }
  };
  
  // Obtenir les annuaires cibles pour les suggestions (filtrés par thématique, exclure source)
  const getAdjacentAnnuairesForSuggestions = () => {
    if (!suggestionSourceAnnuaire || !suggestionThematique) return [];
    
    const availableAnnuaires = getAnnuairesForThematique(suggestionThematique);
    
    // Retourner toutes les années sauf la source
    return availableAnnuaires
      .filter(ann => ann.annee !== suggestionSourceAnnuaire)
      .sort((a, b) => parseInt(b.annee) - parseInt(a.annee));
  };
  
  // Obtenir les années intermédiaires pour suggestions (filtrées par thématique)
  const getIntermediateAnnuairesForSuggestions = () => {
    if (!suggestionThematique) return [];
    return getIntermediateAnnuairesForThematique(suggestionThematique);
  };
  
  // (reset handled inline in onChange handlers)
  
  // Vérifier si un indicateur a une rupture
  const hasRupture = (indicateurId: number, direction?: 'precedente' | 'suivante') => {
    if (direction) {
      return ruptures.some(r => r.id_tableau === indicateurId && r.direction === direction);
    }
    return ruptures.some(r => r.id_tableau === indicateurId);
  };
  
  // Obtenir la rupture d'un indicateur
  const getRupture = (indicateurId: number) => {
    return ruptures.filter(r => r.id_tableau === indicateurId);
  };
  
  // Filtrer les orphelins pour exclure ceux qui ont des suggestions
  const suggestionSourceIds = new Set(suggestions.map(s => s.source_id));
  const filteredOrphelins = allOrphelins.filter(o => !suggestionSourceIds.has(o.id));
  
  // Charger les détails quand les indicateurs source/cible changent
  useEffect(() => {
    if (sourceId) {
      setLoadingDetails(true);
      fetchTableauDetail(parseInt(sourceId)).then(detail => {
        setSourceDetail(detail);
        setLoadingDetails(false);
      });
    } else {
      setSourceDetail(null);
    }
  }, [sourceId]);
  
  useEffect(() => {
    if (cibleId) {
      setLoadingDetails(true);
      fetchTableauDetail(parseInt(cibleId)).then(detail => {
        setCibleDetail(detail);
        setLoadingDetails(false);
      });
    } else {
      setCibleDetail(null);
    }
  }, [cibleId]);

  // Comparaison de structure pour suggérer automatiquement le type de liaison
  const { comparison: manualComparison } = useStructureComparison(
    sourceId ? parseInt(sourceId) : null,
    cibleId ? parseInt(cibleId) : null
  );

  useEffect(() => {
    if (manualComparison) {
      const suggestion = suggestLiaisonType(manualComparison);
      setTypeSuggestion(suggestion);
      if (!typeManuallyChanged) {
        setTypeLiaison(suggestion.type);
      }
    } else {
      setTypeSuggestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualComparison]);

  // Reset manual override when changing source/cible
  useEffect(() => {
    setTypeManuallyChanged(false);
  }, [sourceId, cibleId]);
  
  // Set des IDs d'indicateurs déjà liés (source ou cible)
  const linkedIndicateurIds = new Set<number>();
  series.forEach(s => {
    if (s.source_id) linkedIndicateurIds.add(s.source_id);
    if (s.cible_id) linkedIndicateurIds.add(s.cible_id);
  });
  
  // Vérifier si un indicateur est déjà lié
  const isLinked = (indicateurId: number) => linkedIndicateurIds.has(indicateurId);
  
  // Obtenir les thématiques uniques nettoyées, optionnellement filtrées par annuaire
  const getUniqueThematiques = (annuaireAnnee?: string) => {
    const thematiques = new Map<string, string>();
    indicateurs.forEach(ind => {
      if (ind.thematique_nom) {
        if (annuaireAnnee && ind.annuaire_annee !== annuaireAnnee) return;
        const cleanName = cleanThematiqueName(ind.thematique_nom);
        if (!thematiques.has(cleanName)) {
          thematiques.set(cleanName, cleanName);
        }
      }
    });
    return Array.from(thematiques.keys()).sort((a, b) => a.localeCompare(b));
  };

  // Filtrer les indicateurs par thématique nettoyée et annuaire sélectionnés
  const getFilteredIndicateurs = (thematiqueName: string, annuaireAnnee: string) => {
    if (!thematiqueName || !annuaireAnnee) return [];
    const filtered = indicateurs.filter(ind => 
      cleanThematiqueName(ind.thematique_nom) === thematiqueName && 
      ind.annuaire_annee === annuaireAnnee
    );
    // Dédupliquer par code (garder le premier de chaque code)
    const seen = new Set<string>();
    const deduped = filtered.filter(ind => {
      const key = ind.code + '|' + ind.titre_fr;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Tri par code numérique croissant
    return deduped.sort((a, b) => {
      const parseCode = (code: string) => { const m = code.match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [parseInt(m[1]), parseInt(m[2])] : [999, 999]; };
      const [a1, a2] = parseCode(a.code); const [b1, b2] = parseCode(b.code);
      if (a1 !== b1) return a1 - b1; return a2 - b2;
    });
  };
  
  // Obtenir les années disponibles pour une thématique donnée
  const getAnnuairesForThematique = (thematiqueName: string) => {
    if (!thematiqueName) return [];
    const yearsWithThematique = new Set(
      indicateurs
        .filter(ind => cleanThematiqueName(ind.thematique_nom) === thematiqueName)
        .map(ind => ind.annuaire_annee)
    );
    return annuaires.filter(ann => yearsWithThematique.has(ann.annee));
  };
  
  // Obtenir les années pour une thématique (selon le nombre d'années disponibles)
  // Si 2 années seulement: retourne les deux (pas de notion de "milieu")
  // Si 3+ années: exclure première et dernière
  const getIntermediateAnnuairesForThematique = (thematiqueName: string) => {
    const availableAnnuaires = getAnnuairesForThematique(thematiqueName);
    if (availableAnnuaires.length === 0) return [];
    
    const sorted = [...availableAnnuaires].sort((a, b) => parseInt(a.annee) - parseInt(b.annee));
    
    // Si seulement 2 années, on les retourne toutes les deux pour permettre la liaison directe
    if (availableAnnuaires.length <= 2) return sorted;
    
    // Sinon, exclure première et dernière
    return sorted.slice(1, -1);
  };
  
  // Obtenir les années pour cible (dépend du nombre total d'années)
  const getAvailableAnnuairesForCible = () => {
    if (!sourceAnnuaire || !selectedThematique) return [];
    
    const availableAnnuaires = getAnnuairesForThematique(selectedThematique);
    const sourceYear = parseInt(sourceAnnuaire);
    
    // Si seulement 2 années, retourner l'autre année
    if (availableAnnuaires.length === 2) {
      return availableAnnuaires.filter(ann => ann.annee !== sourceAnnuaire);
    }
    
    // Sinon, retourner les années adjacentes (N-1 ou N+1)
    return availableAnnuaires.filter(ann => {
      const year = parseInt(ann.annee);
      return year === sourceYear - 1 || year === sourceYear + 1;
    });
  };
  
  // Obtenir toutes les années avec info sur si elles sont grisées
  // Règle: griser première et dernière SAUF si elles sont adjacentes à l'année sélectionnée
  const getAnnuairesWithDisabledState = () => {
    if (annuaires.length <= 2) return annuaires.map(a => ({ ...a, disabled: true }));
    
    const sorted = [...annuaires].sort((a, b) => parseInt(a.annee) - parseInt(b.annee));
    const firstYear = sorted[0].annee;
    const lastYear = sorted[sorted.length - 1].annee;
    
    return sorted.map(ann => {
      const isFirst = ann.annee === firstYear;
      const isLast = ann.annee === lastYear;
      
      // Par défaut, griser première et dernière
      let disabled = isFirst || isLast;
      
      // Exception: si une année adjacente est sélectionnée, activer
      if (suggestionCibleAnnuaire) {
        const cibleYear = parseInt(suggestionCibleAnnuaire);
        const thisYear = parseInt(ann.annee);
        if (Math.abs(cibleYear - thisYear) === 1) {
          disabled = false;
        }
      }
      
      return { ...ann, disabled };
    });
  };
  
  // Marquer un indicateur comme rupture
  const handleMarkAsRupture = async (indicateurId: number, annee: string, direction: 'precedente' | 'suivante') => {
    const sortedAnnuaires = [...annuaires].sort((a, b) => parseInt(a.annee) - parseInt(b.annee));
    const currentIndex = sortedAnnuaires.findIndex(a => a.annee === annee);
    
    let anneeRupture = '';
    if (direction === 'precedente' && currentIndex > 0) {
      anneeRupture = sortedAnnuaires[currentIndex - 1].annee;
    } else if (direction === 'suivante' && currentIndex < sortedAnnuaires.length - 1) {
      anneeRupture = sortedAnnuaires[currentIndex + 1].annee;
    }
    
    if (!anneeRupture) {
      toast.error('Impossible de déterminer l\'année de rupture');
      return;
    }
    
    const { error } = await supabase.from('tableaux_ruptures').insert({
      id_tableau: indicateurId,
      annee_rupture: anneeRupture,
      direction: direction,
      notes: `Rupture marquée manuellement - pas de continuité vers ${anneeRupture}`
    });
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Cette rupture existe déjà');
      } else {
        toast.error('Erreur lors du marquage', { description: error.message });
      }
      return;
    }
    
    toast.success(`Indicateur marqué comme interrompu vers ${anneeRupture}`);
    fetchData();
  };
  
  // Supprimer une rupture
  const handleDeleteRupture = async (ruptureId: number) => {
    const { error } = await supabase.from('tableaux_ruptures').delete().eq('id', ruptureId);
    
    if (error) {
      toast.error('Erreur lors de la suppression', { description: error.message });
      return;
    }
    
    toast.success('Rupture supprimée');
    fetchData();
  };
  
  // Réinitialiser source/cible IDs quand thématique change (pour créer liaison)
  useEffect(() => {
    setSourceId('');
    setCibleAnnuaire('');
    setCibleId('');
  }, [selectedThematique]);
  
  // Réinitialiser cible si l'annuaire source change
  useEffect(() => {
    setCibleAnnuaire('');
    setCibleId('');
  }, [sourceAnnuaire]);
  
  // Réinitialiser indicateur source si l'annuaire source change
  useEffect(() => {
    setSourceId('');
  }, [sourceAnnuaire]);

  // Réinitialiser indicateur cible si l'annuaire cible change
  useEffect(() => {
    setCibleId('');
  }, [cibleAnnuaire]);
  
  // Réinitialiser suggestions quand thématique change
  // Réinitialiser cible quand thématique change (mais garder la source)
  useEffect(() => {
    setSuggestionCibleAnnuaire('');
    setSuggestions([]);
  }, [suggestionThematique]);
  
  // Réinitialiser cible suggestion quand annuaire source change
  useEffect(() => {
    setSuggestionCibleAnnuaire('');
    setSuggestions([]);
  }, [suggestionSourceAnnuaire]);

  const handleCreateLiaison = async () => {
    if (!sourceId || !cibleId) {
      toast.error('Veuillez sélectionner deux indicateurs');
      return;
    }

    if (sourceId === cibleId) {
      toast.error('Les deux indicateurs doivent être différents');
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.from('tableaux_liaisons').insert({
      id_tableau_source: parseInt(sourceId),
      id_tableau_cible: parseInt(cibleId),
      type_liaison: typeLiaison,
      methode_liaison: 'manuelle',
      confiance: 100
    }).select('id').single();

    setCreating(false);

    if (error) {
      if (error.code === '23505') {
        toast.error('Cette liaison existe déjà');
      } else {
        toast.error('Erreur lors de la création', { description: error.message });
      }
      return;
    }

    // Trouver les années des indicateurs pour le modal
    const sourceInd = indicateurs.find(i => i.id === parseInt(sourceId));
    const cibleInd = indicateurs.find(i => i.id === parseInt(cibleId));

    // Pour "fusionne", ouvrir le modal de sélection de colonnes
    // Pour "extension_horizontale", ouvrir le modal d'extension horizontale
    // Pour "remplace", pas de modal - on prend simplement les données les plus récentes
    if (typeLiaison === 'fusionne') {
      setPendingLiaison({
        liaisonId: data.id,
        sourceId: parseInt(sourceId),
        cibleId: parseInt(cibleId),
        sourceAnnee: sourceInd?.annuaire_annee || '',
        cibleAnnee: cibleInd?.annuaire_annee || '',
        typeLiaison: typeLiaison
      });
      setColumnSelectionModalOpen(true);
    } else if (typeLiaison === 'extension_horizontale') {
      setPendingLiaison({
        liaisonId: data.id,
        sourceId: parseInt(sourceId),
        cibleId: parseInt(cibleId),
        sourceAnnee: sourceInd?.annuaire_annee || '',
        cibleAnnee: cibleInd?.annuaire_annee || '',
        typeLiaison: typeLiaison
      });
      setHorizontalExtensionModalOpen(true);
    } else {
      // Pour "remplace" ou autre, liaison créée directement sans modal
      setPendingLiaison(null);
      setFusionModalOpen(false);
      setColumnSelectionModalOpen(false);
      setHorizontalExtensionModalOpen(false);
      toast.success('Liaison créée avec succès');
    }
    
    setSourceId('');
    setCibleId('');
    fetchData();
  };
  
  const handleAcceptSuggestion = async (suggestion: Suggestion, suggestionTypeLiaison: string = 'fusionne') => {
    const normalizedType = (suggestionTypeLiaison || 'fusionne').trim().toLowerCase();

    const { data, error } = await supabase.from('tableaux_liaisons').insert({
      id_tableau_source: suggestion.source_id,
      id_tableau_cible: suggestion.cible_id,
      type_liaison: normalizedType,
      methode_liaison: 'suggestion_ia',
      confiance: Math.round(suggestion.similarite * 100)
    }).select('id').single();

    if (error) {
      toast.error('Erreur lors de la création', { description: error.message });
      return;
    }

    // Ouvrir le modal approprié selon le type de liaison
    if (normalizedType === 'fusionne') {
      setPendingLiaison({
        liaisonId: data.id,
        sourceId: suggestion.source_id,
        cibleId: suggestion.cible_id,
        sourceAnnee: suggestion.source_annee,
        cibleAnnee: suggestion.cible_annee,
        typeLiaison: normalizedType,
      });
      setColumnSelectionModalOpen(true);
    } else if (normalizedType === 'extension_horizontale') {
      setPendingLiaison({
        liaisonId: data.id,
        sourceId: suggestion.source_id,
        cibleId: suggestion.cible_id,
        sourceAnnee: suggestion.source_annee,
        cibleAnnee: suggestion.cible_annee,
        typeLiaison: normalizedType,
      });
      setHorizontalExtensionModalOpen(true);
    } else if (normalizedType === 'remplace') {
      // Pour "remplace" : pas de configuration, on affiche toujours le tableau le plus récent côté front
      setPendingLiaison(null);
      setFusionModalOpen(false);
      setColumnSelectionModalOpen(false);
      setHorizontalExtensionModalOpen(false);
      toast.success('Liaison "remplace" créée');
    } else {
      // Autres types : on garde la configuration existante
      setPendingLiaison({
        liaisonId: data.id,
        sourceId: suggestion.source_id,
        cibleId: suggestion.cible_id,
        sourceAnnee: suggestion.source_annee,
        cibleAnnee: suggestion.cible_annee,
        typeLiaison: normalizedType,
      });
      setFusionModalOpen(true);
    }
    
    setSuggestions(prev => prev.filter(s => s.source_id !== suggestion.source_id));
    fetchData();
  };
  
  const handleRejectSuggestion = (suggestion: Suggestion) => {
    setSuggestions(prev => prev.filter(s => s.source_id !== suggestion.source_id));
    toast.info('Suggestion ignorée');
  };

  const handleDeleteLiaison = async (liaisonId: number) => {
    const { error } = await supabase
      .from('tableaux_liaisons')
      .delete()
      .eq('id', liaisonId);

    if (error) {
      toast.error('Erreur lors de la suppression', { description: error.message });
      return;
    }

    toast.success('Liaison supprimée');
    fetchData();
  };

  // Aperçu rapide d'une série
  const handlePreviewSerie = async (s: SerieTemporelle) => {
    setPreviewSerie(s);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    
    // Try to load saved fusion first
    const { data: fusion } = await supabase
      .from('tableaux_fusion')
      .select('entetes_fusionnees, donnees_fusionnees, strategie')
      .eq('id_liaison', s.liaison_id)
      .maybeSingle();
    
    if (fusion) {
      setPreviewData({
        entetes: fusion.entetes_fusionnees as any[][],
        donnees: fusion.donnees_fusionnees as any[][],
        source: `Fusion (${fusion.strategie})`
      });
      setPreviewLoading(false);
      return;
    }
    
    // Fallback: load raw data from source and cible
    const { data: cibleData } = await supabase
      .from('tableaux_data')
      .select('entetes, donnees')
      .eq('id_tableau', s.cible_id)
      .maybeSingle();
    
    if (cibleData) {
      setPreviewData({
        entetes: cibleData.entetes as any[][],
        donnees: cibleData.donnees as any[][],
        source: `Tableau cible (AS ${s.cible_annee})`
      });
    }
    setPreviewLoading(false);
  };

  // Ouvrir le modal de configuration de fusion pour une liaison existante
  const handleConfigureFusion = (serie: SerieTemporelle) => {
    setPendingLiaison({
      liaisonId: serie.liaison_id,
      sourceId: serie.source_id,
      cibleId: serie.cible_id,
      sourceAnnee: serie.source_annee,
      cibleAnnee: serie.cible_annee,
      typeLiaison: serie.type_liaison,
    });
    if (serie.type_liaison === 'fusionne') {
      setColumnSelectionModalOpen(true);
    } else if (serie.type_liaison === 'extension_horizontale') {
      setHorizontalExtensionModalOpen(true);
    } else {
      setFusionModalOpen(true);
    }
  };

  // Composant pour afficher les détails d'un indicateur
  const IndicateurDetails = ({ detail, loading }: { detail: IndicateurDetail | null; loading: boolean }) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }
    
    if (!detail) return null;
    
    return (
      <div className="mt-4 p-3 rounded-md bg-background border space-y-2 text-sm">
        <div className="flex items-center gap-2 text-primary font-medium">
          <FileText className="h-4 w-4" />
          Détails
        </div>
        
        {detail.unite_fr && (
          <div>
            <span className="text-muted-foreground">Unité:</span>{' '}
            <span>{detail.unite_fr}</span>
          </div>
        )}
        
        {detail.source_fr && (
          <div>
            <span className="text-muted-foreground">Source:</span>{' '}
            <span className="text-xs">{detail.source_fr}</span>
          </div>
        )}
        
        {detail.notes_fr && (
          <div>
            <span className="text-muted-foreground">Notes:</span>{' '}
            <span className="text-xs">{detail.notes_fr}</span>
          </div>
        )}
        
        {detail.indices.length > 0 && (
          <div>
            <span className="text-muted-foreground">Indices:</span>
            <ul className="list-disc list-inside text-xs mt-1">
              {detail.indices.map(idx => (
                <li key={idx.id}>
                  <span className="font-mono">{idx.code_indice}</span>
                  {idx.signification_fr && `: ${idx.signification_fr}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {!detail.unite_fr && !detail.source_fr && !detail.notes_fr && detail.indices.length === 0 && (
          <p className="text-muted-foreground italic">Aucun détail disponible</p>
        )}
      </div>
    );
  };

  // Composant pour afficher la comparaison de structures
  const StructureComparisonSection = ({ sourceId, cibleId }: { sourceId: number; cibleId: number }) => {
    const { loading, comparison, sourceData, cibleData, error } = useStructureComparison(sourceId, cibleId);
    
    return (
      <StructureComparisonComponent
        loading={loading}
        comparison={comparison}
        sourceData={sourceData}
        cibleData={cibleData}
        error={error}
      />
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header with gradient accent */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#58061C]/5 via-white to-[#CFA452]/5 border border-[#58061C]/15 rounded-2xl">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-md shadow-[#58061C]/15">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            Liaisons & Séries temporelles
          </h1>
          <p className="text-slate-600 text-sm mt-2 ml-[52px]">
            Gérer les liaisons entre tableaux pour créer des séries temporelles
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border-2 border-slate-200 rounded-2xl p-1.5 h-auto shadow-sm flex-wrap gap-1">
            <TabsTrigger value="orphelins" className="gap-1.5 rounded-xl px-3 py-2.5 text-xs sm:text-sm sm:px-5 sm:py-3 font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#58061C] data-[state=active]:to-[#3B0211] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:shadow-[#58061C]/15 transition-all">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Orphelins</span> ({filteredOrphelins.length})
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1.5 rounded-xl px-3 py-2.5 text-xs sm:text-sm sm:px-5 sm:py-3 font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 transition-all" onClick={() => suggestions.length === 0 && fetchSuggestions()}>
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">À lier</span> ({suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="series" className="gap-1.5 rounded-xl px-3 py-2.5 text-xs sm:text-sm sm:px-5 sm:py-3 font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20 transition-all">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Séries</span> ({series.length})
            </TabsTrigger>
            <TabsTrigger value="creer" className="gap-1.5 rounded-xl px-3 py-2.5 text-xs sm:text-sm sm:px-5 sm:py-3 font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-violet-500 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20 transition-all">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Créer</span>
            </TabsTrigger>
          </TabsList>

          {/* Orphelins */}
          <TabsContent value="orphelins">
            <Card className="border-2 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 rounded-t-2xl">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full bg-[#58061C]"></div>
                  Tableaux sans liaison
                </CardTitle>
                <CardDescription>
                  Ces tableaux ne sont liés à aucune série temporelle. Les tableaux en rouge sont marqués comme interrompus.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filtres */}
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filtres</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Select value={orphelinThematique || 'all'} onValueChange={(val) => setOrphelinThematique(val === 'all' ? '' : val)}>
                      <SelectTrigger className="w-full rounded-xl border-slate-300 bg-white shadow-sm">
                        <SelectValue placeholder="Thématique" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les thématiques</SelectItem>
                        {getUniqueThematiques().map((th) => (
                          <SelectItem key={th} value={th}>{th}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={orphelinAnnee || 'all'} onValueChange={(val) => setOrphelinAnnee(val === 'all' ? '' : val)}>
                      <SelectTrigger className="w-full rounded-xl border-slate-300 bg-white shadow-sm">
                        <SelectValue placeholder="Année" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les années</SelectItem>
                        {orphelinYears.map((y) => (
                          <SelectItem key={y} value={y}>AS {y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={orphelinStatut} onValueChange={setOrphelinStatut}>
                      <SelectTrigger className="w-full rounded-xl border-slate-300 bg-white shadow-sm">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="alier">À lier</SelectItem>
                        <SelectItem value="rupture">Rupture</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button onClick={applyOrphelinFilters} size="sm" className="rounded-xl bg-gradient-to-r from-[#58061C] to-[#3B0211] hover:from-[#6b0a24] hover:to-[#58061C]digo-500 hover:to-[#58061C] text-white px-5 flex-1 shadow-sm shadow-[#58061C]/15"
                        disabled={!orphelinThematique && !orphelinAnnee && orphelinStatut === 'all'}>
                        Appliquer
                      </Button>
                      <Button onClick={clearOrphelinFilters} variant="outline" size="sm" className="rounded-xl text-slate-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 border-slate-300"
                        disabled={!orphelinThematique && !orphelinAnnee && orphelinStatut === 'all'}>
                        Effacer
                      </Button>
                    </div>
                  </div>
                </div>
                
                {(() => {
                  let displayedOrphelins = appliedOrphelinFilters.thematique 
                    ? filteredOrphelins.filter(o => cleanThematiqueName(o.thematique) === appliedOrphelinFilters.thematique)
                    : filteredOrphelins;
                  
                  // Filtre par année
                  if (appliedOrphelinFilters.annee) {
                    displayedOrphelins = displayedOrphelins.filter(o => String(o.annee).trim() === appliedOrphelinFilters.annee.trim());
                  }
                  
                  // Filtre par statut
                  if (appliedOrphelinFilters.statut === 'alier') {
                    displayedOrphelins = displayedOrphelins.filter(o => !hasRupture(o.id));
                  } else if (appliedOrphelinFilters.statut === 'rupture') {
                    displayedOrphelins = displayedOrphelins.filter(o => hasRupture(o.id));
                  }
                  
                  const totalOrphelins = displayedOrphelins.length;
                  const totalOrphelinPages = Math.ceil(totalOrphelins / ORPHELIN_PAGE_SIZE);
                  const paginatedOrphelins = displayedOrphelins.slice(orphelinPage * ORPHELIN_PAGE_SIZE, (orphelinPage + 1) * ORPHELIN_PAGE_SIZE);
                  
                  return displayedOrphelins.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      {appliedOrphelinFilters.thematique ? 'Aucun orphelin pour ces filtres' : 'Tous les tableaux sont liés 🎉'}
                    </p>
                  ) : (
                    <>
                    <p className="text-xs text-slate-500 mb-3">{totalOrphelins} résultat{totalOrphelins > 1 ? 's' : ''} — page {orphelinPage + 1}/{totalOrphelinPages}</p>
                    {totalOrphelinPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 pb-4 border-b-2 border-slate-200">
                        <p className="text-sm font-medium text-slate-600">{orphelinPage * ORPHELIN_PAGE_SIZE + 1}–{Math.min((orphelinPage + 1) * ORPHELIN_PAGE_SIZE, totalOrphelins)} sur <span className="text-[#58061C] font-bold">{totalOrphelins}</span></p>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" size="sm" onClick={() => { setOrphelinPage(Math.max(0, orphelinPage - 1)); }} disabled={orphelinPage === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">← Précédent</Button>
                          <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{orphelinPage + 1} / {totalOrphelinPages}</span>
                          <Button variant="outline" size="sm" onClick={() => { setOrphelinPage(Math.min(totalOrphelinPages - 1, orphelinPage + 1)); }} disabled={orphelinPage >= totalOrphelinPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">Suivant →</Button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto -mx-6 px-6">
                    <Table className="border border-slate-200 rounded-xl overflow-hidden">
                      <TableHeader>
                        <TableRow className="bg-slate-100 border-b-2 border-slate-200">
                          <TableHead className="w-24 font-bold text-slate-700">Code</TableHead>
                          <TableHead className="font-bold text-slate-700">Titre</TableHead>
                          <TableHead className="w-24 font-bold text-slate-700">Année</TableHead>
                          <TableHead className="w-48 font-bold text-slate-700">Thématique</TableHead>
                          <TableHead className="w-32 font-bold text-slate-700">Statut</TableHead>
                          <TableHead className="w-24 font-bold text-slate-700">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedOrphelins.map((orp) => {
                          const rupturesIndicateur = getRupture(orp.id);
                          const isInterrompu = rupturesIndicateur.length > 0;
                          
                          return (
                            <TableRow key={orp.id} className={`hover:bg-slate-50/80 transition-colors ${isInterrompu ? 'bg-red-50/60 border-l-4 border-l-red-400' : 'even:bg-slate-50/30'}`}>
                              <TableCell>
                                <Badge variant="secondary" className={`font-mono text-xs ${isInterrompu ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20'}`}>
                                  {orp.code}
                                </Badge>
                              </TableCell>
                              <TableCell className={`font-medium ${isInterrompu ? 'text-red-600' : ''}`}>
                                {orp.titre_fr}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs font-medium ${isInterrompu ? 'border-red-300 text-red-600 bg-red-50' : 'border-[#58061C]/20 text-[#58061C] bg-[#58061C]/8'}`}>
                                  {orp.annee}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-slate-600 font-medium">
                                {cleanThematiqueName(orp.thematique)}
                                </span>
                            </TableCell>
                            <TableCell>
                              {isInterrompu ? (
                                <div className="space-y-1">
                                  {rupturesIndicateur.map(r => (
                                    <div key={r.id} className="flex items-center gap-1">
                                      <Badge variant="destructive" className="text-xs">
                                        <Ban className="h-3 w-3 mr-1" />
                                        Rupture {r.direction === 'precedente' ? '←' : '→'} {r.annee_rupture}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteRupture(r.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">À lier</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isInterrompu && (
                                <div className="flex gap-1">
                                  {/* Bouton pour marquer rupture vers année précédente */}
                                  {(() => {
                                    const sortedAnnuaires = [...annuaires].sort((a, b) => parseInt(a.annee) - parseInt(b.annee));
                                    const currentIndex = sortedAnnuaires.findIndex(a => a.annee === orp.annee);
                                    const hasPrev = currentIndex > 0;
                                    const hasNext = currentIndex < sortedAnnuaires.length - 1;
                                    
                                    return (
                                      <>
                                        {hasPrev && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                            onClick={() => handleMarkAsRupture(orp.id, orp.annee, 'precedente')}
                                            title={`Marquer comme interrompu vers ${sortedAnnuaires[currentIndex - 1].annee}`}
                                          >
                                            <Ban className="h-3 w-3 mr-1" />
                                            ←
                                          </Button>
                                        )}
                                        {hasNext && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                            onClick={() => handleMarkAsRupture(orp.id, orp.annee, 'suivante')}
                                            title={`Marquer comme interrompu vers ${sortedAnnuaires[currentIndex + 1].annee}`}
                                          >
                                            <Ban className="h-3 w-3 mr-1" />
                                            →
                                          </Button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  {totalOrphelinPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t-2 border-slate-200">
                      <p className="text-sm font-medium text-slate-600">{orphelinPage * ORPHELIN_PAGE_SIZE + 1}–{Math.min((orphelinPage + 1) * ORPHELIN_PAGE_SIZE, totalOrphelins)} sur <span className="text-[#58061C] font-bold">{totalOrphelins}</span></p>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => { setOrphelinPage(Math.max(0, orphelinPage - 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={orphelinPage === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">← Précédent</Button>
                        <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{orphelinPage + 1} / {totalOrphelinPages}</span>
                        <Button variant="outline" size="sm" onClick={() => { setOrphelinPage(Math.min(totalOrphelinPages - 1, orphelinPage + 1)); window.scrollTo({ top: 200, behavior: 'smooth' }); }} disabled={orphelinPage >= totalOrphelinPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 hover:text-[#58061C] disabled:opacity-40">Suivant →</Button>
                      </div>
                    </div>
                  )}
                  </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Suggestions IA */}
          <TabsContent value="suggestions">
            <Card className="border-2 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 rounded-t-2xl">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  Suggestions de liaisons
                </CardTitle>
                <CardDescription>
                  Liaisons suggérées automatiquement basées sur la similarité des titres
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Sélection annuaire puis thématique */}
                <div className="mb-6 p-5 bg-slate-50 rounded-xl border-2 border-slate-200">
                  <p className="text-sm font-bold text-slate-900 mb-4">Configuration de la recherche</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Annuaire source */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#58061C] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                        Annuaire source
                      </label>
                      <Select value={suggestionSourceAnnuaire} onValueChange={(val) => { setSuggestionSourceAnnuaire(val); setSuggestionThematique(''); setSuggestionCibleAnnuaire(''); setSuggestions([]); }}>
                        <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm">
                          <SelectValue placeholder="Choisir un annuaire..." />
                        </SelectTrigger>
                        <SelectContent>
                          {annuaires.map(ann => (
                            <SelectItem key={ann.id} value={ann.annee}>AS {ann.annee}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Thématique */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#58061C] text-white text-[10px] flex items-center justify-center font-bold">2</span>
                        Thématique
                      </label>
                      <Select value={suggestionThematique} onValueChange={(val) => { setSuggestionThematique(val); setSuggestionCibleAnnuaire(''); setSuggestions([]); }} disabled={!suggestionSourceAnnuaire}>
                        <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm">
                          <SelectValue placeholder={suggestionSourceAnnuaire ? "Choisir..." : "—"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getUniqueThematiques(suggestionSourceAnnuaire).map((th) => (
                            <SelectItem key={th} value={th}>{th}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Annuaire Cible */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#58061C] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                        Annuaire cible
                      </label>
                      <Select value={suggestionCibleAnnuaire} onValueChange={setSuggestionCibleAnnuaire} disabled={!suggestionThematique}>
                        <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm">
                          <SelectValue placeholder={!suggestionThematique ? "—" : "Année cible"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const available = getAnnuairesForThematique(suggestionThematique).filter(ann => ann.annee !== suggestionSourceAnnuaire);
                            const sourceYear = parseInt(suggestionSourceAnnuaire);
                            const adjacent = available.filter(ann => Math.abs(parseInt(ann.annee) - sourceYear) === 1);
                            const toShow = adjacent.length > 0 ? adjacent : available;
                            return toShow.sort((a, b) => parseInt(b.annee) - parseInt(a.annee)).map(ann => (
                              <SelectItem key={ann.id} value={ann.annee}>AS {ann.annee}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button onClick={fetchSuggestions} disabled={!suggestionThematique || !suggestionSourceAnnuaire || !suggestionCibleAnnuaire || loadingSuggestions}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm shadow-amber-500/20 px-6">
                      {loadingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Rechercher les suggestions
                    </Button>
                  </div>
                </div>
                
                {loadingSuggestions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                      <span className="text-sm text-slate-600">Analyse de {allOrphelins.filter(o => o.annee === suggestionSourceAnnuaire).length} tableaux...</span>
                    </div>
                  </div>
                ) : suggestions.length === 0 && (suggestionSourceAnnuaire && suggestionCibleAnnuaire) ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Aucune suggestion trouvée</p>
                    <p className="text-sm text-slate-500 mt-1">Entre AS {suggestionSourceAnnuaire} et AS {suggestionCibleAnnuaire}</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Sparkles className="h-10 w-10 text-amber-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Configurez la recherche ci-dessus</p>
                    <p className="text-sm text-slate-500 mt-1">Sélectionnez source, thématique et cible puis cliquez "Rechercher"</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-sm font-medium text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                      💡 {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} trouvée{suggestions.length > 1 ? 's' : ''}
                    </p>
                    {suggestions.map((s, idx) => (
                      <SuggestionCard key={idx} suggestion={s} onAccept={handleAcceptSuggestion} onReject={handleRejectSuggestion}
                        onMarkAsRupture={(indicateurId, annee, direction) => { handleMarkAsRupture(indicateurId, annee, direction); setSuggestions(prev => prev.filter(sug => sug.source_id !== indicateurId)); }} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Séries existantes */}
          <TabsContent value="series">
            <Card className="border-2 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 rounded-t-2xl">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-white" />
                  </div>
                  Séries temporelles existantes
                </CardTitle>
                <CardDescription>
                  {series.length} liaison{series.length > 1 ? 's' : ''} entre tableaux de différentes années
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {series.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Link2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Aucune série temporelle créée</p>
                    <p className="text-sm text-slate-500 mt-1">Créez des liaisons via l'onglet "À lier" ou "Créer"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {series.map((s) => (
                      <div 
                        key={s.liaison_id}
                        className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => handlePreviewSerie(s)}
                      >
                        {/* Source */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="shrink-0 bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20 font-bold">{s.source_annee}</Badge>
                            <span className="font-mono text-xs text-slate-600 shrink-0">{s.source_code}</span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium truncate">{s.source_titre}</p>
                        </div>
                        
                        {/* Flèche et type */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0 px-3">
                          <ArrowRight className="h-5 w-5 text-emerald-500" />
                          <Badge className={`text-[10px] whitespace-nowrap font-bold ${
                            s.type_liaison === 'fusionne' && !fusionConfigured.has(s.liaison_id)
                              ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                              : s.type_liaison === 'remplace'
                              ? 'bg-violet-100 text-violet-700 border border-violet-200'
                              : s.type_liaison === 'extension_horizontale'
                              ? 'bg-[#CFA452]/15 text-[#7c5524] border border-[#CFA452]/30'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {s.type_liaison}
                            {s.type_liaison === 'fusionne' && !fusionConfigured.has(s.liaison_id) && ' ⚠️'}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-medium">{s.confiance}% confiance</span>
                        </div>
                        
                        {/* Cible */}
                        <div className="min-w-0 text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                            <span className="font-mono text-xs text-slate-600 shrink-0">{s.cible_code}</span>
                            <Badge className="shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{s.cible_annee}</Badge>
                          </div>
                          <p className="text-sm text-slate-700 font-medium truncate">{s.cible_titre}</p>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Bouton configurer fusion */}
                          {s.type_liaison === 'fusionne' && !fusionConfigured.has(s.liaison_id) && (
                            <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50 rounded-lg text-xs px-3"
                              onClick={() => handleConfigureFusion(s)}>
                              <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurer
                            </Button>
                          )}
                          {s.type_liaison === 'fusionne' && fusionConfigured.has(s.liaison_id) && (
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-[#58061C] h-8 w-8 rounded-lg"
                              onClick={() => handleConfigureFusion(s)} title="Reconfigurer">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          )}
                          {(s.type_liaison === 'extension_horizontale') && (
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-[#9a6e2e] h-8 w-8 rounded-lg"
                              onClick={() => handleConfigureFusion(s)} title="Configurer">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
                            onClick={() => handleDeleteLiaison(s.liaison_id)} title="Supprimer la liaison">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Créer une liaison */}
          <TabsContent value="creer">
            <Card className="border-2 border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 rounded-t-2xl">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                  Créer une nouvelle liaison
                </CardTitle>
                <CardDescription>
                  Reliez deux tableaux de différentes années pour construire une série temporelle
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">

                {/* ÉTAPE 1 + 2 — Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</div>
                    <h3 className="text-sm font-bold text-slate-900">Configuration de base</h3>
                  </div>
                  <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Annuaire source</label>
                      <Select value={sourceAnnuaire} onValueChange={(val) => { setSourceAnnuaire(val); setSelectedThematique(''); setSourceId(''); setCibleAnnuaire(''); setCibleId(''); }}>
                        <SelectTrigger className="rounded-xl border-slate-300 bg-white shadow-sm h-11">
                          <SelectValue placeholder="Choisir un annuaire..." />
                        </SelectTrigger>
                        <SelectContent>
                          {annuaires.map((ann) => (
                            <SelectItem key={ann.id} value={ann.annee}>AS {ann.annee}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Thématique
                        {!sourceAnnuaire && <span className="text-slate-300 font-normal ml-1">(sélectionnez d'abord l'annuaire)</span>}
                      </label>
                      <Select value={selectedThematique} onValueChange={(val) => { setSelectedThematique(val); setSourceId(''); setCibleAnnuaire(''); setCibleId(''); }} disabled={!sourceAnnuaire}>
                        <SelectTrigger className={`rounded-xl border-slate-300 bg-white shadow-sm h-11 ${!sourceAnnuaire ? 'opacity-50' : ''}`}>
                          <SelectValue placeholder={sourceAnnuaire ? "Choisir une thématique..." : "—"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getUniqueThematiques(sourceAnnuaire).map((th) => (
                            <SelectItem key={th} value={th}>{th}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200" />

                {/* ÉTAPE 2 — Source / Cible */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0 ${selectedThematique ? 'bg-violet-600' : 'bg-slate-300'}`}>2</div>
                    <h3 className={`text-sm font-bold ${selectedThematique ? 'text-slate-900' : 'text-slate-400'}`}>Sélectionner les tableaux</h3>
                  </div>

                  <div className="ml-8 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                    {/* Colonne SOURCE */}
                    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${sourceId ? 'border-violet-400 shadow-md shadow-violet-500/10' : 'border-slate-200'}`}>
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-500"></div>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Source</span>
                        </div>
                        {sourceAnnuaire && <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">AS {sourceAnnuaire}</span>}
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Tableau</label>
                          <Select value={sourceId} onValueChange={setSourceId} disabled={!sourceAnnuaire || !selectedThematique}>
                            <SelectTrigger className={`rounded-xl border-slate-300 bg-white shadow-sm ${!selectedThematique ? 'opacity-50' : ''}`}>
                              <SelectValue placeholder={selectedThematique ? "Sélectionner..." : "Remplir les étapes précédentes"} />
                            </SelectTrigger>
                            <SelectContent>
                              {getFilteredIndicateurs(selectedThematique, sourceAnnuaire).map((ind) => (
                                <SelectItem key={ind.id} value={ind.id.toString()}>
                                  {ind.titre_fr}{isLinked(ind.id) ? ' ✓' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {sourceId && (
                          <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3">
                            <IndicateurDetails detail={sourceDetail} loading={loadingDetails && !!sourceId} />
                          </div>
                        )}
                        {!sourceId && selectedThematique && (
                          <p className="text-xs text-slate-400 text-center py-2">Sélectionnez un tableau ci-dessus</p>
                        )}
                      </div>
                    </div>

                    {/* Flèche centrale */}
                    <div className="flex items-center justify-center py-4 lg:py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${sourceId && cibleId ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                          <ArrowRightLeft className={`h-4 w-4 ${sourceId && cibleId ? 'text-emerald-600' : 'text-slate-300'}`} />
                        </div>
                        {sourceId && cibleId && <span className="text-[10px] text-emerald-600 font-bold">Prêt</span>}
                      </div>
                    </div>

                    {/* Colonne CIBLE */}
                    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${cibleId ? 'border-emerald-400 shadow-md shadow-emerald-500/10' : 'border-slate-200'}`}>
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cible</span>
                        </div>
                        {cibleAnnuaire && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">AS {cibleAnnuaire}</span>}
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Annuaire adjacent (N-1 ou N+1)</label>
                          <Select value={cibleAnnuaire} onValueChange={(val) => { setCibleAnnuaire(val); setCibleId(''); }} disabled={!sourceAnnuaire || !selectedThematique}>
                            <SelectTrigger className={`rounded-xl border-slate-300 bg-white shadow-sm ${!selectedThematique ? 'opacity-50' : ''}`}>
                              <SelectValue placeholder={selectedThematique ? "AS N-1 ou N+1..." : "—"} />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableAnnuairesForCible().length === 0 && sourceAnnuaire
                                ? <SelectItem value="none" disabled>Aucune année adjacente</SelectItem>
                                : getAvailableAnnuairesForCible().map((ann) => (
                                  <SelectItem key={ann.id} value={ann.annee}>AS {ann.annee}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Tableau</label>
                          <Select value={cibleId} onValueChange={setCibleId} disabled={!cibleAnnuaire}>
                            <SelectTrigger className={`rounded-xl border-slate-300 bg-white shadow-sm ${!cibleAnnuaire ? 'opacity-50' : ''}`}>
                              <SelectValue placeholder={cibleAnnuaire ? "Sélectionner..." : "Choisir d'abord l'annuaire"} />
                            </SelectTrigger>
                            <SelectContent>
                              {getFilteredIndicateurs(selectedThematique, cibleAnnuaire).map((ind) => (
                                <SelectItem key={ind.id} value={ind.id.toString()}>
                                  {ind.titre_fr}{isLinked(ind.id) ? ' ✓' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {cibleId && (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                            <IndicateurDetails detail={cibleDetail} loading={loadingDetails && !!cibleId} />
                          </div>
                        )}
                        {!cibleId && cibleAnnuaire && (
                          <p className="text-xs text-slate-400 text-center py-2">Sélectionnez un tableau ci-dessus</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analyse de compatibilité */}
                {sourceId && cibleId && (
                  <>
                    <div className="h-px bg-slate-200" />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold shrink-0">3</div>
                        <h3 className="text-sm font-bold text-slate-900">Analyse de compatibilité</h3>
                      </div>
                      <div className="ml-8">
                        <StructureComparisonSection sourceId={parseInt(sourceId)} cibleId={parseInt(cibleId)} />
                      </div>
                    </div>
                  </>
                )}

                {/* Type de liaison + Créer */}
                {sourceId && cibleId && (
                  <>
                    <div className="h-px bg-slate-200" />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold shrink-0">4</div>
                        <h3 className="text-sm font-bold text-slate-900">Type de liaison</h3>
                      </div>
                      <div className="ml-8 space-y-3">
                        {/* Suggestion IA */}
                        {typeSuggestion && (
                          <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                            typeSuggestion.confidence === 'high' ? 'bg-emerald-50 border-emerald-200' :
                            typeSuggestion.confidence === 'medium' ? 'bg-amber-50 border-amber-200' :
                            'bg-slate-50 border-slate-200'}`}>
                            <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${typeSuggestion.confidence === 'high' ? 'text-emerald-600' : typeSuggestion.confidence === 'medium' ? 'text-amber-600' : 'text-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-700">Suggestion IA :</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  typeSuggestion.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                  typeSuggestion.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-600'}`}>
                                  {{ remplace: 'Remplace', fusionne: 'Fusionne', extension_horizontale: 'Extension horizontale' }[typeSuggestion.type] ?? typeSuggestion.type}
                                </span>
                                {typeSuggestion.confidence === 'high' && <span className="text-[10px] text-emerald-600 font-medium">Confiance élevée</span>}
                              </div>
                              <p className="text-xs text-slate-600">{typeSuggestion.reason}</p>
                            </div>
                            {typeManuallyChanged && typeLiaison !== typeSuggestion.type && (
                              <button onClick={() => { setTypeLiaison(typeSuggestion.type); setTypeManuallyChanged(false); }}
                                className="text-xs text-violet-600 hover:text-violet-700 font-medium whitespace-nowrap">
                                Appliquer
                              </button>
                            )}
                          </div>
                        )}
                        {/* Select type */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Select value={typeLiaison} onValueChange={(v) => { setTypeLiaison(v); setTypeManuallyChanged(true); }}>
                            <SelectTrigger className="w-full sm:w-72 rounded-xl border-slate-300 bg-white shadow-sm h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="remplace">Remplace</SelectItem>
                              <SelectItem value="fusionne">Fusionne (colonnes)</SelectItem>
                              <SelectItem value="extension_horizontale">Extension horizontale (lignes-années)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={handleCreateLiaison} disabled={creating || !sourceId || !cibleId}
                            className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-sm shadow-violet-500/20 px-8 h-11">
                            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Plus className="mr-2 h-4 w-4" />
                            Créer la liaison
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Modal de configuration de fusion (série temporelle) */}
      {pendingLiaison && pendingLiaison.typeLiaison !== 'fusionne' && pendingLiaison.typeLiaison !== 'remplace' && pendingLiaison.typeLiaison !== 'extension_horizontale' && (
        <FusionStrategyModal
          open={fusionModalOpen}
          onOpenChange={setFusionModalOpen}
          liaisonId={pendingLiaison.liaisonId}
          sourceId={pendingLiaison.sourceId}
          cibleId={pendingLiaison.cibleId}
          sourceAnnee={pendingLiaison.sourceAnnee}
          cibleAnnee={pendingLiaison.cibleAnnee}
          onSuccess={() => {
            setPendingLiaison(null);
            fetchData();
          }}
        />
      )}
      
      {/* Modal de sélection de colonnes (type fusionne) */}
      {pendingLiaison && pendingLiaison.typeLiaison === 'fusionne' && (
        <ColumnSelectionModal
          open={columnSelectionModalOpen}
          onOpenChange={setColumnSelectionModalOpen}
          liaisonId={pendingLiaison.liaisonId}
          sourceId={pendingLiaison.sourceId}
          cibleId={pendingLiaison.cibleId}
          sourceAnnee={pendingLiaison.sourceAnnee}
          cibleAnnee={pendingLiaison.cibleAnnee}
          onSuccess={() => {
            setPendingLiaison(null);
            fetchData();
          }}
        />
      )}
      
      {/* Modal d'extension horizontale */}
      {pendingLiaison && pendingLiaison.typeLiaison === 'extension_horizontale' && (
        <HorizontalExtensionModal
          open={horizontalExtensionModalOpen}
          onOpenChange={setHorizontalExtensionModalOpen}
          liaisonId={pendingLiaison.liaisonId}
          sourceId={pendingLiaison.sourceId}
          cibleId={pendingLiaison.cibleId}
          sourceAnnee={pendingLiaison.sourceAnnee}
          cibleAnnee={pendingLiaison.cibleAnnee}
          onSuccess={() => {
            setPendingLiaison(null);
            fetchData();
          }}
        />
      )}

      {/* Modal d'aperçu série */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center">
                <Link2 className="h-4 w-4 text-white" />
              </div>
              Aperçu de la série
            </DialogTitle>
            {previewSerie && (
              <DialogDescription className="mt-2">
                <span className="font-medium text-slate-700">{previewSerie.source_code}</span> ({previewSerie.source_annee})
                <span className="mx-2 text-slate-400">→</span>
                <span className="font-medium text-slate-700">{previewSerie.cible_code}</span> ({previewSerie.cible_annee})
                <span className="mx-2">•</span>
                <span className={`font-semibold ${previewSerie.type_liaison === 'fusionne' ? 'text-[#58061C]' : previewSerie.type_liaison === 'remplace' ? 'text-violet-600' : 'text-emerald-600'}`}>
                  {previewSerie.type_liaison}
                </span>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4 min-h-0">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-slate-600">Chargement de l'aperçu...</p>
              </div>
            ) : !previewData ? (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-600 font-medium">Aucune donnée de fusion disponible</p>
                <p className="text-sm text-slate-500 mt-1">Configurez d'abord la fusion pour voir l'aperçu</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{previewData.source}</p>
                  <p className="text-xs text-slate-400">{previewData.donnees.length} lignes • {previewData.entetes[0]?.length || 0} colonnes</p>
                </div>
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        {previewData.entetes.map((row: any[], rIdx: number) => (
                          <tr key={rIdx} className="bg-slate-100 border-b border-slate-200">
                            {row.map((cell: any, cIdx: number) => (
                              <th key={cIdx} className="px-3 py-2 text-left text-xs font-bold text-slate-700 whitespace-nowrap border-r last:border-r-0">
                                {String(cell ?? '')}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {previewData.donnees.slice(0, 20).map((row: any[], rIdx: number) => (
                          <tr key={rIdx} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/30">
                            {row.map((cell: any, cIdx: number) => (
                              <td key={cIdx} className="px-3 py-1.5 text-slate-700 whitespace-nowrap border-r last:border-r-0">
                                {String(cell ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.donnees.length > 20 && (
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-center">
                      <p className="text-xs text-slate-500">+{previewData.donnees.length - 20} lignes supplémentaires</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="rounded-xl border-slate-300 px-5">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Liaisons;