import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRightLeft, Check, Info, Rows3, Columns } from 'lucide-react';
import { tableauxData, fusion as fusionApi } from '@/lib/api';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IndicateurData {
  id: number;
  entetes: any[][];
  donnees: any[][];
}

interface HorizontalExtensionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liaisonId: number;
  sourceId: number;
  cibleId: number;
  sourceAnnee: string;
  cibleAnnee: string;
  onSuccess: () => void;
}

export const HorizontalExtensionModal = ({
  open,
  onOpenChange,
  liaisonId,
  sourceId,
  cibleId,
  sourceAnnee,
  cibleAnnee,
  onSuccess
}: HorizontalExtensionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceData, setSourceData] = useState<IndicateurData | null>(null);
  const [cibleData, setCibleData] = useState<IndicateurData | null>(null);
  const [referenceColumn, setReferenceColumn] = useState<string>('0');

  useEffect(() => {
    if (open && liaisonId) {
      loadData();
    }
  }, [open, liaisonId]);

  const loadData = async () => {
    setLoading(true);
    setReferenceColumn('0');
    
    try {
      const [sourceRes, cibleRes] = await Promise.all([
        tableauxData.getByTableau(sourceId),
        tableauxData.getByTableau(cibleId)
      ]);

      if (sourceRes) {
        setSourceData({
          id: sourceRes.id,
          entetes: sourceRes.entetes as any[][],
          donnees: sourceRes.donnees as any[][]
        });
      }

      if (cibleRes) {
        setCibleData({
          id: cibleRes.id,
          entetes: cibleRes.entetes as any[][],
          donnees: cibleRes.donnees as any[][]
        });
      }
    } catch (err: any) {
      toast.error('Erreur lors du chargement', { description: err.message });
    }

    setLoading(false);
  };

  const extractYear = (value: unknown): string | null => {
    const str = String(value ?? '').trim();
    const match = str.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  };

  // Extraire les colonnes disponibles pour la référence
  const availableColumns = useMemo(() => {
    if (!cibleData?.entetes || cibleData.entetes.length === 0) return [];
    const lastHeaderRow = cibleData.entetes[cibleData.entetes.length - 1];
    return lastHeaderRow.map((cell, index) => ({
      index,
      name: String(cell || `Colonne ${index + 1}`)
    }));
  }, [cibleData]);

  // Détecter les années - soit dans les colonnes, soit dans les lignes
  const yearAnalysis = useMemo(() => {
    if (!sourceData?.entetes || !cibleData?.entetes || !sourceData?.donnees || !cibleData?.donnees) return null;

    const refColIdx = parseInt(referenceColumn);

    // Fonction pour détecter les années dans les lignes (tolère "2020 ", "2020(2)", etc.)
    const getYearRowsWithStructure = (donnees: any[][], colIndex: number = 0) => {
      const years: { rowIndex: number; year: string; fullRow: any[] }[] = [];
      donnees.forEach((row, rowIndex) => {
        const year = extractYear(row[colIndex]);
        if (year) {
          years.push({ rowIndex, year, fullRow: row });
        }
      });
      return years;
    };

    // Analyser la structure des regroupements (lignes consécutives par année)
    const analyzeYearStructure = (donnees: any[][], colIndex: number) => {
      const yearGroups: Map<string, { startIndex: number; rows: any[][] }> = new Map();
      let currentYear: string | null = null;
      let currentRows: any[][] = [];
      let startIndex = 0;

      donnees.forEach((row, rowIndex) => {
        const year = extractYear(row[colIndex]);

        if (year) {
          // Nouvelle année détectée
          if (currentYear && currentRows.length > 0) {
            yearGroups.set(currentYear, { startIndex, rows: [...currentRows] });
          }
          currentYear = year;
          currentRows = [row];
          startIndex = rowIndex;
        } else if (currentYear) {
          // Ligne appartenant au groupe de l'année courante
          currentRows.push(row);
        }
      });

      // Ajouter le dernier groupe
      if (currentYear && currentRows.length > 0) {
        yearGroups.set(currentYear, { startIndex, rows: [...currentRows] });
      }

      return yearGroups;
    };

    // Fonction pour détecter les années dans les colonnes (en-têtes)
    const getYearColumns = (entetes: any[][]) => {
      const lastRow = entetes[entetes.length - 1];
      const years: { index: number; year: string }[] = [];
      lastRow.forEach((cell, index) => {
        const year = extractYear(cell);
        if (year) {
          years.push({ index, year });
        }
      });
      return years;
    };

    const sourceYearRows = getYearRowsWithStructure(sourceData.donnees, refColIdx);
    const cibleYearRows = getYearRowsWithStructure(cibleData.donnees, refColIdx);
    const sourceYearCols = getYearColumns(sourceData.entetes);
    const cibleYearCols = getYearColumns(cibleData.entetes);

    // Analyser la structure des regroupements
    const sourceStructure = analyzeYearStructure(sourceData.donnees, refColIdx);
    const cibleStructure = analyzeYearStructure(cibleData.donnees, refColIdx);

    // Déterminer si les années sont en lignes ou en colonnes
    const yearsInRows = sourceYearRows.length > 2 || cibleYearRows.length > 2;
    const yearsInColumns = sourceYearCols.length > 2 || cibleYearCols.length > 2;

    if (yearsInRows) {
      // Mode: années dans les lignes
      const sourceUniqueYears = [...new Set(sourceYearRows.map(y => y.year))].sort((a, b) => parseInt(b) - parseInt(a));
      const cibleUniqueYears = [...new Set(cibleYearRows.map(y => y.year))].sort((a, b) => parseInt(b) - parseInt(a));
      
      const cibleYearSet = new Set(cibleUniqueYears);
      const sourceYearSet = new Set(sourceUniqueYears);

      // Années uniques à ajouter (pas les lignes individuelles)
      const yearsOnlyInSource = sourceUniqueYears.filter(y => !cibleYearSet.has(y));
      const yearsOnlyInCible = cibleUniqueYears.filter(y => !sourceYearSet.has(y));
      const commonYears = sourceUniqueYears.filter(y => cibleYearSet.has(y));

      return {
        mode: 'rows' as const,
        sourceYears: sourceUniqueYears,
        cibleYears: cibleUniqueYears,
        onlyInSource: yearsOnlyInSource.map(year => ({ year })),
        onlyInCible: yearsOnlyInCible.map(year => ({ year })),
        common: commonYears.map(year => ({ year })),
        sourceStructure,
        cibleStructure,
        refColIdx
      };
    } else if (yearsInColumns) {
      // Mode: années dans les colonnes
      const sourceYearSet = new Set(sourceYearCols.map(y => y.year));
      const cibleYearSet = new Set(cibleYearCols.map(y => y.year));
      
      const onlyInSource = sourceYearCols.filter(y => !cibleYearSet.has(y.year));
      const onlyInCible = cibleYearCols.filter(y => !sourceYearSet.has(y.year));
      const common = sourceYearCols.filter(y => cibleYearSet.has(y.year));

      return {
        mode: 'columns' as const,
        sourceYears: sourceYearCols.map(y => y.year),
        cibleYears: cibleYearCols.map(y => y.year),
        onlyInSource,
        onlyInCible,
        common,
        sourceYearCols,
        cibleYearCols
      };
    }

    return null;
  }, [sourceData, cibleData, referenceColumn]);

  // Construire le tableau étendu avec insertion intelligente
  const buildExtendedTable = (): { entetes: any[][]; donnees: any[][] } => {
    if (!sourceData || !cibleData || !yearAnalysis) {
      return { entetes: [], donnees: [] };
    }

    if (yearAnalysis.mode === 'rows') {
      const newEntetes = [...cibleData.entetes];
      const newDonnees: any[][] = [];
      const refColIdx = yearAnalysis.refColIdx;
      
      // Récupérer les structures
      const sourceStructure = yearAnalysis.sourceStructure as Map<string, { startIndex: number; rows: any[][] }>;
      const cibleStructure = yearAnalysis.cibleStructure as Map<string, { startIndex: number; rows: any[][] }>;
      
      // Obtenir toutes les années (source + cible) triées par ordre décroissant
      const allYears = [...new Set([...yearAnalysis.sourceYears, ...yearAnalysis.cibleYears])]
        .sort((a, b) => parseInt(b) - parseInt(a));
      
      // Années à ajouter depuis la source
      const yearsToAdd = new Set((yearAnalysis.onlyInSource as { year: string }[]).map(y => y.year));

      // Construire le tableau en respectant l'ordre chronologique
      for (const year of allYears) {
        if (cibleStructure.has(year)) {
          // L'année existe dans la cible - garder les lignes de la cible
          const group = cibleStructure.get(year)!;
          newDonnees.push(...group.rows);
        } else if (yearsToAdd.has(year) && sourceStructure.has(year)) {
          // L'année vient de la source - ajouter les lignes de la source
          const group = sourceStructure.get(year)!;
          newDonnees.push(...group.rows);
        }
      }

      return { entetes: newEntetes, donnees: newDonnees };
    } else {
      // Extension par colonnes (logique originale simplifiée)
      return { entetes: cibleData.entetes, donnees: cibleData.donnees };
    }
  };

  // Aperçu du résultat
  const preview = useMemo(() => {
    return buildExtendedTable();
  }, [sourceData, cibleData, referenceColumn, yearAnalysis]);

  const handleSave = async () => {
    if (!yearAnalysis || yearAnalysis.onlyInSource.length === 0) {
      toast.error('Aucune année à ajouter');
      return;
    }

    setSaving(true);

    const fusionData = buildExtendedTable();

    try {
      await fusionApi.upsert({
        id_liaison: liaisonId,
        strategie: 'extension_horizontale',
        colonne_selectionnee: referenceColumn,
        donnees_fusionnees: fusionData.donnees,
        entetes_fusionnees: fusionData.entetes
      });

      const yearsAdded = yearAnalysis.onlyInSource.map(y => 'year' in y ? y.year : '').filter(Boolean).join(', ');
      toast.success('Extension horizontale créée', {
        description: `Années ajoutées: ${yearsAdded}`
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    }

    setSaving(false);
  };

  const canCreate = yearAnalysis && yearAnalysis.onlyInSource.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Extension Horizontale
          </DialogTitle>
          <DialogDescription>
            Étendre les lignes-années en fusionnant les colonnes des deux tableaux
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4 min-h-0">
            {/* Analyse des années */}
            {yearAnalysis && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={yearAnalysis.mode === 'rows' ? 'default' : 'secondary'}>
                    {yearAnalysis.mode === 'rows' ? 'Années en lignes' : 'Années en colonnes'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-green-100 text-green-700">
                        {cibleAnnee}
                      </Badge>
                      <span className="text-sm font-medium">Cible</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {yearAnalysis.cibleYears.map((y, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {y}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-700">
                        {sourceAnnee}
                      </Badge>
                      <span className="text-sm font-medium">Source</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {yearAnalysis.sourceYears.map((y, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {y}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Rows3 className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Années manquantes</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">À ajouter à la cible</div>
                        <div className="flex flex-wrap gap-1">
                          {yearAnalysis.onlyInSource.length > 0 ? (
                            yearAnalysis.onlyInSource.map((y, i) => (
                              <Badge key={i} className="text-xs bg-amber-500">
                                + {'year' in y ? y.year : ''}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Aucune</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Uniquement dans la cible</div>
                        <div className="flex flex-wrap gap-1">
                          {yearAnalysis.onlyInCible.length > 0 ? (
                            yearAnalysis.onlyInCible.map((y, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {'year' in y ? y.year : ''}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Aucune</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Comment ça fonctionne
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  {yearAnalysis?.mode === 'rows' 
                    ? `Les groupes d'années de ${sourceAnnee} seront ajoutés dans l'ordre chronologique. La structure des regroupements (urbain/rural/ensemble, etc.) est détectée automatiquement et respectée.`
                    : `Les colonnes-années de ${sourceAnnee} seront ajoutées au tableau ${cibleAnnee}.`
                  }
                </p>
              </div>
            </div>

            {/* Sélection de la colonne de référence */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Colonne de référence (contient les années)
              </Label>
              <Select value={referenceColumn} onValueChange={setReferenceColumn}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Choisir la colonne..." />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((col) => (
                    <SelectItem key={col.index} value={String(col.index)}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cette colonne contient les années (2020, 2019, etc.) pour identifier les lignes à fusionner
              </p>
            </div>

            {/* Aperçu */}
            {preview.entetes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">
                    Aperçu du résultat ({preview.entetes[0]?.length || 0} colonnes, {preview.donnees.length} lignes)
                  </span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="max-h-[300px]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          {preview.entetes.map((row, rowIdx) => (
                            <tr key={rowIdx} className="bg-muted border-b">
                              {row.map((cell, colIdx) => (
                                <th 
                                  key={colIdx} 
                                  className="px-3 py-2 text-left text-xs font-medium border-r last:border-r-0 whitespace-nowrap"
                                >
                                  {String(cell || '')}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody>
                          {preview.donnees.slice(0, 15).map((row, rowIdx) => {
                            const rowYear = extractYear(row[parseInt(referenceColumn)]);
                            const isNewYear = !!rowYear && yearAnalysis?.onlyInSource.some(
                              y => 'year' in y && y.year === rowYear
                            );
                            return (
                              <tr key={rowIdx} className={`border-b last:border-b-0 ${isNewYear ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                                {row.map((cell, colIdx) => (
                                  <td 
                                    key={colIdx} 
                                    className="px-3 py-2 border-r last:border-r-0 whitespace-nowrap"
                                  >
                                    {String(cell || '')}
                                    {colIdx === parseInt(referenceColumn) && isNewYear && (
                                      <span className="ml-1 text-amber-600">★</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                  {preview.donnees.length > 15 && (
                    <div className="text-center py-2 text-xs text-muted-foreground bg-muted/50">
                      ... et {preview.donnees.length - 15} lignes de plus
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message si rien à ajouter */}
            {yearAnalysis && yearAnalysis.onlyInSource.length === 0 && (
              <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  ⚠️ Aucune année à ajouter. Toutes les années de {sourceAnnee} existent déjà dans {cibleAnnee}.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || loading || !canCreate}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer l'extension
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
