import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tableaux as tableauxApi, thematiques as thematiquesApi, annuaires as annuairesApi, tableauxIndices, tableauxData, views, fusion as fusionApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, FileText, Hash, BookOpen, StickyNote, Link2, RefreshCw } from 'lucide-react';

interface Indicateur {
  id: number;
  code: string;
  titre_fr: string;
  titre_ar: string | null;
  unite_fr: string | null;
  unite_ar: string | null;
  source_fr: string | null;
  source_ar: string | null;
  notes_fr: string | null;
  notes_ar: string | null;
  annee_reference: string | null;
  id_thematique: number;
}

interface Thematique {
  id: number;
  code: string;
  nom_fr: string;
  id_annuaire: number;
}

interface Annuaire {
  id: number;
  annee: string;
}

interface Indice {
  id: number;
  code_indice: string;
  signification_fr: string | null;
  signification_ar: string | null;
  rattache_type: string | null;
  rattache_valeurs: any;
}

interface IndicateurData {
  id: number;
  entetes: any;
  donnees: any;
  merged_cells?: any[];
}

interface SerieIndicateur {
  id: number;
  code: string;
  titre_fr: string;
  annee: string;
  type_liaison: string | null;
}

const IndicateurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [indicateur, setIndicateur] = useState<Indicateur | null>(null);
  const [thematique, setThematique] = useState<Thematique | null>(null);
  const [annuaire, setAnnuaire] = useState<Annuaire | null>(null);
  const [indices, setIndices] = useState<Indice[]>([]);
  const [data, setData] = useState<IndicateurData | null>(null);
  const [serieIndicateurs, setSerieIndicateurs] = useState<SerieIndicateur[]>([]);
  const [displayData, setDisplayData] = useState<IndicateurData | null>(null);
  const [displaySource, setDisplaySource] = useState<string>(''); // Pour indiquer d'où viennent les données affichées

  useEffect(() => {
    if (id) fetchIndicateur(parseInt(id));
  }, [id]);

  const fetchIndicateur = async (indicateurId: number) => {
    setLoading(true);

    try {
      const ind = await tableauxApi.getById(indicateurId);

      if (!ind) {
        setLoading(false);
        return;
      }

      setIndicateur(ind);

      const [themData, indicesData, dataResult] = await Promise.all([
        thematiquesApi.getById(ind.id_thematique).catch(() => null),
        tableauxIndices.getByTableau(indicateurId),
        tableauxData.getByTableau(indicateurId)
      ]);

      let currentAnnee = '';
      if (themData) {
        setThematique(themData);
        try {
          const annuaireData = await annuairesApi.getById(themData.id_annuaire);
          if (annuaireData) {
            setAnnuaire(annuaireData);
            currentAnnee = annuaireData.annee;
          }
        } catch {
          // Annuaire non trouvé
        }
      }

      setIndices(indicesData || []);
      if (dataResult) {
        setData({
          id: dataResult.id,
          entetes: dataResult.entetes,
          donnees: dataResult.donnees,
          merged_cells: dataResult.merged_cells || []
        });
      } else {
        setData(null);
      }

      // Récupérer la série temporelle pour cet indicateur
      await fetchSerieTemporelle(indicateurId, dataResult, currentAnnee);
    } catch {
      // Indicateur non trouvé
    }

    setLoading(false);
  };

  // Fonction pour récupérer et parcourir la série temporelle
  const fetchSerieTemporelle = async (indicateurId: number, currentData: IndicateurData | null, currentAnnee: string) => {
    try {
      // Récupérer toutes les liaisons où cet indicateur est impliqué
      const liaisons = await views.seriesTemporelles(0, 99999);

      if (!liaisons || liaisons.length === 0) {
        // Pas de liaison, afficher les données originales
        setDisplayData(currentData ? {
          id: currentData.id,
          entetes: currentData.entetes,
          donnees: currentData.donnees,
          merged_cells: currentData.merged_cells || []
        } : null);
        setDisplaySource(currentAnnee ? `AS ${currentAnnee}` : '');
        setSerieIndicateurs([]);
        return;
      }

      // Trouver toutes les liaisons impliquant cet indicateur
      const relatedLiaisons = liaisons.filter(
        l => l.source_id === indicateurId || l.cible_id === indicateurId
      );

      if (relatedLiaisons.length === 0) {
        // Pas de liaison pour cet indicateur
        setDisplayData(currentData ? {
          id: currentData.id,
          entetes: currentData.entetes,
          donnees: currentData.donnees,
          merged_cells: currentData.merged_cells || []
        } : null);
        setDisplaySource(currentAnnee ? `AS ${currentAnnee}` : '');
        setSerieIndicateurs([]);
        return;
      }

      // Vérifier si c'est une liaison de type "fusionne"
      const fusionneLink = relatedLiaisons.find(l => l.type_liaison === 'fusionne');
      
      if (fusionneLink) {
        // Récupérer les données fusionnées depuis tableaux_fusion
        try {
          const fusionData = await fusionApi.getByLiaison(fusionneLink.liaison_id);
          
          if (fusionData) {
            setDisplayData({
              id: fusionData.id,
              entetes: fusionData.entetes_fusionnees as any,
              donnees: fusionData.donnees_fusionnees as any
            });
            setDisplaySource(`Fusion ${fusionneLink.source_annee} + ${fusionneLink.cible_annee}`);
            
            // Construire la liste des indicateurs de la série
            setSerieIndicateurs([
              {
                id: fusionneLink.source_id!,
                code: fusionneLink.source_code!,
                titre_fr: fusionneLink.source_titre!,
                annee: fusionneLink.source_annee!,
                type_liaison: 'fusionne'
              },
              {
                id: fusionneLink.cible_id!,
                code: fusionneLink.cible_code!,
                titre_fr: fusionneLink.cible_titre!,
                annee: fusionneLink.cible_annee!,
                type_liaison: 'fusionne'
              }
            ]);
            return;
          }
        } catch {
          // Fusion data non trouvée, on continue
        }
      }

      // Vérifier si c'est une liaison de type "remplace"
      const hasRemplaceLink = relatedLiaisons.some(l => l.type_liaison === 'remplace');

      if (hasRemplaceLink) {
        // Construire la chaîne complète des indicateurs liés par "remplace"
        const chainedIndicators = await buildIndicatorChain(indicateurId, liaisons);
        setSerieIndicateurs(chainedIndicators);

        // Trouver l'indicateur avec l'année la plus récente dans la chaîne
        if (chainedIndicators.length > 0) {
          const mostRecent = chainedIndicators.reduce((prev, curr) => 
            curr.annee > prev.annee ? curr : prev
          );

          // Récupérer les données de l'indicateur le plus récent
          if (mostRecent.id !== indicateurId) {
            try {
              const recentData = await tableauxData.getByTableau(mostRecent.id);

              if (recentData) {
                setDisplayData(recentData);
                setDisplaySource(`AS ${mostRecent.annee} (série temporelle - remplace)`);
                return;
              }
            } catch {
              // Données non trouvées
            }
          }
        }
      }

      // Par défaut, afficher les données originales
      setDisplayData(currentData);
      setDisplaySource(currentAnnee ? `AS ${currentAnnee}` : '');
    } catch {
      // Erreur lors de la récupération des séries, afficher les données originales
      setDisplayData(currentData);
      setDisplaySource(currentAnnee ? `AS ${currentAnnee}` : '');
      setSerieIndicateurs([]);
    }
  };

  // Construire la chaîne d'indicateurs liés
  const buildIndicatorChain = async (startId: number, allLiaisons: any[]): Promise<SerieIndicateur[]> => {
    const visited = new Set<number>();
    const chain: SerieIndicateur[] = [];
    const queue = [startId];

    // Récupérer tous les tableaux complets une seule fois
    const allTableaux = await views.tableauxComplets({ from: 0, to: 99999 });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Chercher les infos de cet indicateur dans la liste complète
      const indInfo = allTableaux.find((t: any) => t.id === currentId);

      if (indInfo) {
        chain.push({
          id: indInfo.id,
          code: indInfo.code,
          titre_fr: indInfo.titre_fr,
          annee: indInfo.annuaire_annee,
          type_liaison: null
        });
      }

      // Trouver les liaisons de type "remplace" connectées
      const connectedLiaisons = allLiaisons.filter(
        l => l.type_liaison === 'remplace' && 
             (l.source_id === currentId || l.cible_id === currentId)
      );

      for (const liaison of connectedLiaisons) {
        const nextId = liaison.source_id === currentId ? liaison.cible_id : liaison.source_id;
        if (!visited.has(nextId)) {
          queue.push(nextId);
        }
      }
    }

    return chain.sort((a, b) => a.annee.localeCompare(b.annee));
  };

  const highlightIndices = (text: string | null) => {
    if (!text) return null;
    const parts = text.split(/(\(\d+\))/g);
    return parts.map((part, i) => {
      if (/\(\d+\)/.test(part)) {
        return <span key={i} className="highlight-index">{part}</span>;
      }
      return part;
    });
  };

  const parseCellCoord = (cell: string) => {
    const match = cell.match(/^([A-Z]+)([0-9]+)$/i);
    if (!match) return { row: 0, col: 0 };
    const letters = match[1].toUpperCase();
    const rowNum = parseInt(match[2], 10);
    
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 65 + 1);
    }
    col = col - 1;
    const row = rowNum - 1;
    return { row, col };
  };

  const parseExcelRange = (range: string) => {
    const parts = range.split(':');
    const start = parseCellCoord(parts[0]);
    const end = parts[1] ? parseCellCoord(parts[1]) : start;
    return {
      startRow: start.row,
      startCol: start.col,
      endRow: end.row,
      endCol: end.col
    };
  };

  const renderTableCell = (cell: any, isHeader = false) => {
    if (typeof cell === 'string') {
      return highlightIndices(cell);
    }
    if (cell === null || cell === undefined) return '';
    return String(cell);
  };

  const notesList = (() => {
    if (!indicateur?.notes_fr) return [];
    const val = indicateur.notes_fr.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [indicateur.notes_fr];
  })();

  const mergeGrid = (() => {
    const grid: Record<string, { hidden: boolean; rowSpan?: number; colSpan?: number }> = {};
    if (!displayData?.merged_cells || displayData.merged_cells.length === 0) return grid;

    displayData.merged_cells.forEach(({ range }: any) => {
      try {
        const { startRow, startCol, endRow, endCol } = parseExcelRange(range);
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const key = `${r}-${c}`;
            if (r === startRow && c === startCol) {
              grid[key] = {
                hidden: false,
                rowSpan: endRow - startRow + 1,
                colSpan: endCol - startCol + 1
              };
            } else {
              grid[key] = {
                hidden: true
              };
            }
          }
        }
      } catch (err) {
        console.error("Error parsing range:", range, err);
      }
    });

    return grid;
  })();

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!indicateur) {
    return (
      <AdminLayout>
        <div className="p-8">
          <Button variant="ghost" onClick={() => navigate('/admin/indicateurs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            Tableau non trouvé
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-6xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/indicateurs')}
          className="mb-6 gap-2 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">
              {indicateur.code}
            </Badge>
            {annuaire && <Badge variant="secondary" className="text-xs">{annuaire.annee}</Badge>}
            {thematique && (
              <Badge className="text-xs bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20">
                {thematique.nom_fr}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {indicateur.titre_fr}
          </h1>
          {indicateur.titre_ar && (
            <p className="text-xl text-muted-foreground" dir="rtl">
              {indicateur.titre_ar}
            </p>
          )}
        </div>

        {/* Métadonnées */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Métadonnées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(indicateur.unite_fr || indicateur.unite_ar) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Unité</h4>
                <div className="highlight-unit inline-block">
                  {indicateur.unite_fr}
                  {indicateur.unite_ar && <span className="ml-2" dir="rtl">({indicateur.unite_ar})</span>}
                </div>
              </div>
            )}

            {(indicateur.source_fr || indicateur.source_ar) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Source</h4>
                <div className="highlight-source">
                  {indicateur.source_fr}
                  {indicateur.source_ar && <div className="mt-1" dir="rtl">{indicateur.source_ar}</div>}
                </div>
              </div>
            )}

            {(notesList.length > 0 || indicateur.notes_ar) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                <div className="highlight-notes space-y-1">
                  {notesList.map((note, idx) => (
                    <p key={idx}>{highlightIndices(note)}</p>
                  ))}
                  {indicateur.notes_ar && <div className="mt-1" dir="rtl">{indicateur.notes_ar}</div>}
                </div>
              </div>
            )}

            {indicateur.annee_reference && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Année de référence</h4>
                <Badge variant="outline">{indicateur.annee_reference}</Badge>
              </div>
            )}

            {!indicateur.unite_fr && !indicateur.source_fr && !indicateur.notes_fr && (
              <p className="text-muted-foreground italic">Aucune métadonnée disponible</p>
            )}
          </CardContent>
        </Card>

        {/* Indices */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Indices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {indices.length === 0 ? (
              <p className="text-muted-foreground italic">Aucun indice défini</p>
            ) : (
              <div className="space-y-3">
                {indices.map((indice) => (
                  <div key={indice.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                    <span className="highlight-index text-lg">{indice.code_indice}</span>
                    <div className="flex-1">
                      <p>{indice.signification_fr || 'Non spécifié'}</p>
                      {indice.signification_ar && (
                        <p className="text-muted-foreground mt-1" dir="rtl">{indice.signification_ar}</p>
                      )}
                      {indice.rattache_type && (
                        <Badge variant="outline" className="mt-2">
                          Rattaché à : {indice.rattache_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Série temporelle info */}
        {serieIndicateurs.length > 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Série temporelle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {serieIndicateurs.map((si, idx) => (
                  <Badge 
                    key={si.id}
                    variant={si.id === indicateur.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/indicateur/${si.id}`)}
                  >
                    AS {si.annee}: {si.code}
                  </Badge>
                ))}
              </div>
              {displaySource && displaySource.includes('remplace') && (
                <p className="text-sm text-muted-foreground mt-3">
                  <span className="font-medium">Stratégie :</span> Remplacer - Affichage du tableau le plus récent
                </p>
              )}
              {displaySource && displaySource.includes('Fusion') && (
                <p className="text-sm text-muted-foreground mt-3">
                  <span className="font-medium">Stratégie :</span> Fusionner - Colonnes sélectionnées des deux tableaux
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tableau de données */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Tableau de données
              {displaySource && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {displaySource}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!displayData ? (
              <p className="text-muted-foreground italic">Aucune donnée disponible</p>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full border-collapse text-sm">
                  {/* Entêtes */}
                  <thead>
                    {Array.isArray(displayData.entetes) && displayData.entetes.map((row: any[], rowIndex: number) => (
                      <tr key={`header-${rowIndex}`} className="bg-muted">
                        {Array.isArray(row) && row.map((cell, cellIndex) => {
                          const mergeKey = `${rowIndex}-${cellIndex}`;
                          const merge = mergeGrid[mergeKey];
                          if (merge?.hidden) return null;
                          return (
                            <th 
                              key={`header-${rowIndex}-${cellIndex}`}
                              rowSpan={merge?.rowSpan}
                              colSpan={merge?.colSpan}
                              className="border border-border px-3 py-2 text-left font-medium"
                            >
                              {renderTableCell(cell, true)}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  {/* Données */}
                  <tbody>
                    {Array.isArray(displayData.donnees) && displayData.donnees.map((row: any[], rowIndex: number) => {
                      const globalRowIdx = (displayData.entetes?.length || 0) + rowIndex;
                      return (
                        <tr key={`data-${rowIndex}`} className="hover:bg-muted/50">
                          {Array.isArray(row) && row.map((cell, cellIndex) => {
                            const mergeKey = `${globalRowIdx}-${cellIndex}`;
                            const merge = mergeGrid[mergeKey];
                            if (merge?.hidden) return null;
                            return (
                              <td 
                                key={`data-${rowIndex}-${cellIndex}`}
                                rowSpan={merge?.rowSpan}
                                colSpan={merge?.colSpan}
                                className="border border-border px-3 py-2"
                              >
                                {renderTableCell(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default IndicateurDetail;
