import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Columns, Check, Info } from 'lucide-react';
import { tableauxData, fusion as fusionApi, rpc } from '@/lib/api';
import { toast } from 'sonner';

interface IndicateurData {
  id: number;
  entetes: any[][];
  donnees: any[][];
}

interface SerieIndicateur {
  id: number;
  code: string;
  titre_fr: string;
  annee: string;
  donnees: any[][] | null;
  entetes?: any[][];
}

interface ExistingFusion {
  id: number;
  strategie: string;
  colonne_selectionnee: string | null;
  entetes_fusionnees: any[][];
  donnees_fusionnees: any[][];
}

interface FusionStrategyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liaisonId: number;
  sourceId: number;
  cibleId: number;
  sourceAnnee: string;
  cibleAnnee: string;
  onSuccess: () => void;
}

export const FusionStrategyModal = ({
  open,
  onOpenChange,
  liaisonId,
  sourceId,
  cibleId,
  sourceAnnee,
  cibleAnnee,
  onSuccess
}: FusionStrategyModalProps) => {
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serieData, setSerieData] = useState<SerieIndicateur[]>([]);
  const [cibleData, setCibleData] = useState<IndicateurData | null>(null);
  const [existingFusion, setExistingFusion] = useState<ExistingFusion | null>(null);

  useEffect(() => {
    if (open && liaisonId) {
      loadData();
    }
  }, [open, liaisonId, cibleId]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Charger la série temporelle complète
      const serie = await rpc.getSerieTemporelle(cibleId);
      
      if (serie) {
        const serieWithHeaders = await Promise.all(
          serie.map(async (item: any) => {
            const dataItem = await tableauxData.getByTableau(item.id);
            
            return {
              id: item.id,
              code: item.code,
              titre_fr: item.titre_fr,
              annee: item.annee,
              donnees: (dataItem?.donnees as any[][]) || null,
              entetes: (dataItem?.entetes as any[][]) || []
            } as SerieIndicateur;
          })
        );
        setSerieData(serieWithHeaders);
      }
      
      // Vérifier s'il existe déjà une fusion pour cette liaison
      const existingFusionData = await fusionApi.getByLiaison(liaisonId);
      
      if (existingFusionData) {
        setExistingFusion({
          id: existingFusionData.id,
          strategie: existingFusionData.strategie,
          colonne_selectionnee: existingFusionData.colonne_selectionnee,
          entetes_fusionnees: existingFusionData.entetes_fusionnees as any[][],
          donnees_fusionnees: existingFusionData.donnees_fusionnees as any[][]
        });
        if (existingFusionData.colonne_selectionnee) {
          setSelectedColumn(existingFusionData.colonne_selectionnee);
        }
      } else {
        setExistingFusion(null);
      }
      
      // Charger les données du tableau cible (le plus récent)
      const cible = await tableauxData.getByTableau(cibleId);
      
      if (cible) {
        setCibleData({
          id: cible.id,
          entetes: cible.entetes as any[][],
          donnees: cible.donnees as any[][]
        });
      }
    } catch (err: any) {
      toast.error('Erreur lors du chargement', { description: err.message });
    }
    
    setLoading(false);
  };

  // Extraire les colonnes disponibles
  // Si une fusion existe, utiliser ses entêtes, sinon utiliser les entêtes du tableau cible
  const availableColumns = useMemo(() => {
    const headers = existingFusion?.entetes_fusionnees || cibleData?.entetes;
    if (!headers || headers.length === 0) return [];
    
    const lastHeaderRow = headers[headers.length - 1];
    return lastHeaderRow
      .map((cell, index) => ({
        index,
        name: String(cell || `Colonne ${index + 1}`)
      }))
      .filter(col => col.name.trim() !== '');
  }, [cibleData, existingFusion]);

  // Fonction pour fusionner les données - ajoute une colonne année
  const computeFusion = (): { entetes: any[][]; donnees: any[][] } => {
    // Base: soit la fusion existante, soit le tableau cible original
    const baseEntetes = existingFusion?.entetes_fusionnees || cibleData?.entetes || [];
    const baseDonnees = existingFusion?.donnees_fusionnees || cibleData?.donnees || [];
    
    if (baseEntetes.length === 0) {
      return { entetes: [], donnees: [] };
    }

    const selectedColIndex = availableColumns.find(c => c.name === selectedColumn)?.index;
    if (selectedColIndex === undefined) {
      return { entetes: baseEntetes, donnees: baseDonnees };
    }

    // Trouver les données source (année qu'on ajoute)
    const sourceData = serieData.find(s => s.annee === sourceAnnee);
    if (!sourceData?.donnees) {
      return { entetes: baseEntetes, donnees: baseDonnees };
    }

    // Compter combien de colonnes viennent de la même source (pour le préfixe)
    // Format: (n)YYYY où n = numéro de la source
    const sourceIndex = serieData.findIndex(s => s.annee === sourceAnnee);
    const yearLabel = `(${sourceIndex + 1})${sourceAnnee}`;

    // Créer les nouvelles entêtes avec l'année source ajoutée
    const newEntetes: any[][] = baseEntetes.map((row, rowIndex) => {
      if (rowIndex === baseEntetes.length - 1) {
        // Dernière ligne d'entête: ajouter la colonne année
        const newRow = [...row];
        // Insérer l'année après la colonne sélectionnée
        newRow.splice(selectedColIndex + 1, 0, yearLabel);
        return newRow as any[];
      }
      // Pour les autres lignes d'entête, ajouter une cellule vide
      const newRow = [...row];
      newRow.splice(selectedColIndex + 1, 0, '');
      return newRow as any[];
    });

    // Fusionner les données
    const newDonnees: any[][] = baseDonnees.map((row, rowIndex) => {
      const newRow = [...row];
      // Récupérer la valeur de l'année source pour cette ligne
      const sourceValue = sourceData.donnees?.[rowIndex]?.[selectedColIndex] ?? '';
      // Insérer après la colonne sélectionnée
      newRow.splice(selectedColIndex + 1, 0, sourceValue);
      return newRow as any[];
    });

    return { entetes: newEntetes, donnees: newDonnees };
  };

  const handleSave = async () => {
    if (!selectedColumn) {
      toast.error('Veuillez sélectionner une colonne');
      return;
    }

    setSaving(true);

    const fusion = computeFusion();

    try {
      await fusionApi.upsert({
        id_liaison: liaisonId,
        strategie: 'dimension_annee',
        colonne_selectionnee: selectedColumn,
        donnees_fusionnees: fusion.donnees,
        entetes_fusionnees: fusion.entetes
      });

      toast.success('Colonne ajoutée avec succès', {
        description: `Les données de ${sourceAnnee} ont été ajoutées au tableau ${cibleAnnee}`
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    }

    setSaving(false);
  };

  // Années déjà présentes dans la fusion
  const existingYears = useMemo(() => {
    if (!existingFusion?.entetes_fusionnees) return [];
    const lastHeader = existingFusion.entetes_fusionnees[existingFusion.entetes_fusionnees.length - 1];
    // Chercher les années (format YYYY)
    return lastHeader
      .map(h => String(h))
      .filter(h => /^\d{4}$/.test(h));
  }, [existingFusion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Liaison créée - Ajouter une colonne
          </DialogTitle>
          <DialogDescription>
            Sélectionnez la colonne où ajouter les données de {sourceAnnee} dans le tableau {cibleAnnee}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Résumé de la série */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Série:</span>
              {serieData.map((s) => (
                <Badge 
                  key={s.id} 
                  variant={s.annee === cibleAnnee ? 'default' : existingYears.includes(s.annee) ? 'secondary' : 'outline'}
                >
                  {s.annee}
                  {existingYears.includes(s.annee) && s.annee !== cibleAnnee && (
                    <Check className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>

            {/* Info sur la fusion existante */}
            {existingFusion && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Fusion existante détectée
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Les années {existingYears.join(', ')} sont déjà dans le tableau. 
                    Les données de {sourceAnnee} seront ajoutées.
                  </p>
                </div>
              </div>
            )}

            {/* Sélection de colonne */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Colonne de référence
              </Label>
              <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir la colonne..." />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.map((col) => (
                    <SelectItem key={col.index} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Une nouvelle colonne "{sourceAnnee}" sera ajoutée après cette colonne avec les valeurs correspondantes
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !selectedColumn}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ajouter la colonne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};