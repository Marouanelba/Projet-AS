import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Columns, Check, MoveRight, GripVertical, X, ArrowRight, Info } from 'lucide-react';
import { tableauxData, fusion as fusionApi } from '@/lib/api';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IndicateurData { id: number; entetes: any[][]; donnees: any[][]; }
interface ColumnInfo { index: number; name: string; source: 'source' | 'cible'; sourceAnnee: string; originalIndex: number; }
interface ColumnSelectionModalProps { open: boolean; onOpenChange: (open: boolean) => void; liaisonId: number; sourceId: number; cibleId: number; sourceAnnee: string; cibleAnnee: string; onSuccess: () => void; }

export const ColumnSelectionModal = ({ open, onOpenChange, liaisonId, sourceId, cibleId, sourceAnnee, cibleAnnee, onSuccess }: ColumnSelectionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceData, setSourceData] = useState<IndicateurData | null>(null);
  const [cibleData, setCibleData] = useState<IndicateurData | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<ColumnInfo[]>([]);

  useEffect(() => { if (open && liaisonId) loadData(); }, [open, liaisonId]);

  const loadData = async () => {
    setLoading(true); setSelectedColumns([]);
    try {
      const [sourceRes, cibleRes] = await Promise.all([
        tableauxData.getByTableau(sourceId),
        tableauxData.getByTableau(cibleId)
      ]);
      if (sourceRes) setSourceData({ id: sourceRes.id, entetes: sourceRes.entetes as any[][], donnees: sourceRes.donnees as any[][] });
      if (cibleRes) setCibleData({ id: cibleRes.id, entetes: cibleRes.entetes as any[][], donnees: cibleRes.donnees as any[][] });
    } catch (err: any) {
      toast.error('Erreur lors du chargement', { description: err.message });
    }
    setLoading(false);
  };

  const buildColumnName = (entetes: any[][], colIndex: number): string => {
    if (!entetes || entetes.length === 0) return `Colonne ${colIndex + 1}`;
    if (entetes.length === 1) { const cell = entetes[0]?.[colIndex]; return String(cell || `Colonne ${colIndex + 1}`); }
    const parts: string[] = [];
    for (let r = 0; r < entetes.length; r++) { const cell = entetes[r]?.[colIndex]; const s = String(cell || '').trim(); if (s && !parts.includes(s)) parts.push(s); }
    if (parts.length === 0) return `Colonne ${colIndex + 1}`;
    if (parts.length >= 2) { const last = parts[parts.length - 1]; const first = parts[0]; if (/\d{4}/.test(first) && !last.includes(first)) return `${last} (${first})`; }
    return parts[parts.length - 1];
  };

  const sourceColumns = useMemo(() => {
    if (!sourceData?.entetes || sourceData.entetes.length === 0) return [];
    return Array.from({ length: sourceData.entetes[0]?.length || 0 }, (_, i) => ({ index: i, name: buildColumnName(sourceData.entetes, i), source: 'source' as const, sourceAnnee, originalIndex: i }));
  }, [sourceData, sourceAnnee]);

  const cibleColumns = useMemo(() => {
    if (!cibleData?.entetes || cibleData.entetes.length === 0) return [];
    return Array.from({ length: cibleData.entetes[0]?.length || 0 }, (_, i) => ({ index: i, name: buildColumnName(cibleData.entetes, i), source: 'cible' as const, sourceAnnee: cibleAnnee, originalIndex: i }));
  }, [cibleData, cibleAnnee]);

  const isColumnSelected = (col: ColumnInfo) => selectedColumns.some(sc => sc.source === col.source && sc.originalIndex === col.originalIndex);
  // Check if a column with same name is already selected from the other source
  const isDuplicate = (col: ColumnInfo) => selectedColumns.some(sc => sc.source !== col.source && sc.name === col.name);
  const toggleColumn = (col: ColumnInfo) => {
    if (isColumnSelected(col)) setSelectedColumns(prev => prev.filter(sc => !(sc.source === col.source && sc.originalIndex === col.originalIndex)));
    else {
      // Warn if duplicate name exists
      if (isDuplicate(col)) {
        toast.info(`La colonne "${col.name}" est déjà sélectionnée depuis l'autre tableau.`);
        return;
      }
      setSelectedColumns(prev => [...prev, col]);
    }
  };

  const buildFusedTable = (): { entetes: any[][]; donnees: any[][] } => {
    if (selectedColumns.length === 0) return { entetes: [], donnees: [] };
    const maxRows = Math.max(sourceData?.donnees?.length || 0, cibleData?.donnees?.length || 0);
    const newEntetes: any[][] = [selectedColumns.map(col => col.name)];
    const newDonnees: any[][] = [];
    for (let r = 0; r < maxRows; r++) { newDonnees.push(selectedColumns.map(col => { const data = col.source === 'source' ? sourceData : cibleData; return data?.donnees?.[r]?.[col.originalIndex] ?? ''; })); }
    return { entetes: newEntetes, donnees: newDonnees };
  };

  const handleSave = async () => {
    if (selectedColumns.length === 0) { toast.error('Veuillez sélectionner au moins une colonne'); return; }
    setSaving(true);
    const fusion = buildFusedTable();
    const colonnesSelectionnees = selectedColumns.map(c => ({ source: c.source, originalIndex: c.originalIndex, name: c.name, annee: c.sourceAnnee }));
    try {
      await fusionApi.upsert({ id_liaison: liaisonId, strategie: 'colonnes_selectionnees', colonne_selectionnee: JSON.stringify(colonnesSelectionnees), donnees_fusionnees: fusion.donnees, entetes_fusionnees: fusion.entetes });
      toast.success('Tableau fusionné créé', { description: `${selectedColumns.length} colonnes sélectionnées` });
      onOpenChange(false); onSuccess();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EA580C] to-[#C2410C] flex items-center justify-center shadow-md shadow-[#EA580C]/15">
              <Columns className="h-5 w-5 text-white" />
            </div>
            Fusionner les colonnes
          </DialogTitle>
          <DialogDescription className="mt-2">
            Sélectionnez les colonnes des deux tableaux à combiner dans le tableau fusionné final.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
            <p className="text-sm text-slate-600">Chargement des données...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-5 min-h-0">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-[#EA580C]/8 border border-[#EA580C]/20 rounded-xl">
              <Info className="h-5 w-5 text-[#EA580C] mt-0.5 shrink-0" />
              <div className="text-sm text-[#C2410C]">
                <p className="font-semibold mb-1">Comment ça marche</p>
                <p className="text-[#EA580C]">Cochez les colonnes que vous souhaitez inclure dans le tableau fusionné. Vous pouvez sélectionner des colonnes des deux tableaux. L'aperçu en bas montre le résultat.</p>
              </div>
            </div>

            {/* Two column panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Source panel */}
              <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-bold text-blue-900">Source</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 border border-blue-300 font-bold">AS {sourceAnnee}</Badge>
                </div>
                <ScrollArea className="h-[220px] p-3">
                  <div className="space-y-1.5">
                    {sourceColumns.map((col) => {
                      const alreadyFromOther = isDuplicate(col);
                      return (
                      <div key={`source-${col.originalIndex}`}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isColumnSelected(col) ? 'bg-blue-100 border-2 border-blue-400 shadow-sm' : alreadyFromOther ? 'opacity-50 border-2 border-dashed border-slate-300 cursor-not-allowed' : 'hover:bg-slate-50 border-2 border-transparent'}`}
                        onClick={() => toggleColumn(col)}>
                        <Checkbox checked={isColumnSelected(col)} onCheckedChange={() => toggleColumn(col)} disabled={alreadyFromOther} className="border-blue-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                        <span className="text-sm flex-1 font-medium text-slate-800">{col.name}</span>
                        {isColumnSelected(col) && <Check className="h-4 w-4 text-blue-600" />}
                        {alreadyFromOther && !isColumnSelected(col) && <span className="text-[10px] text-slate-400 italic">Déjà dans cible</span>}
                      </div>
                      );
                    })}
                    {sourceColumns.length === 0 && <p className="text-sm text-slate-500 italic p-4 text-center">Aucune donnée</p>}
                  </div>
                </ScrollArea>
              </div>

              {/* Cible panel */}
              <div className="border-2 border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-bold text-emerald-900">Cible</span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold">AS {cibleAnnee}</Badge>
                </div>
                <ScrollArea className="h-[220px] p-3">
                  <div className="space-y-1.5">
                    {cibleColumns.map((col) => {
                      const alreadyFromOther = isDuplicate(col);
                      return (
                      <div key={`cible-${col.originalIndex}`}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isColumnSelected(col) ? 'bg-emerald-100 border-2 border-emerald-400 shadow-sm' : alreadyFromOther ? 'opacity-50 border-2 border-dashed border-slate-300 cursor-not-allowed' : 'hover:bg-slate-50 border-2 border-transparent'}`}
                        onClick={() => toggleColumn(col)}>
                        <Checkbox checked={isColumnSelected(col)} onCheckedChange={() => toggleColumn(col)} disabled={alreadyFromOther} className="border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                        <span className="text-sm flex-1 font-medium text-slate-800">{col.name}</span>
                        {isColumnSelected(col) && <Check className="h-4 w-4 text-emerald-600" />}
                        {alreadyFromOther && !isColumnSelected(col) && <span className="text-[10px] text-slate-400 italic">Déjà dans source</span>}
                      </div>
                      );
                    })}
                    {cibleColumns.length === 0 && <p className="text-sm text-slate-500 italic p-4 text-center">Aucune donnée</p>}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Selected columns summary */}
            {selectedColumns.length > 0 && (
              <div className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="h-4 w-4 text-[#EA580C]" />
                  <span className="text-sm font-bold text-slate-900">Colonnes sélectionnées ({selectedColumns.length})</span>
                  <span className="text-xs text-slate-500">— Ordre d'affichage dans le tableau final</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedColumns.map((col) => (
                    <div key={`sel-${col.source}-${col.originalIndex}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${col.source === 'source' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                      <span>{col.name}</span>
                      <span className="opacity-60">({col.sourceAnnee})</span>
                      <button onClick={(e) => { e.stopPropagation(); toggleColumn(col); }} className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {selectedColumns.length > 0 && (
              <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">📋 Aperçu du résultat</span>
                  <span className="text-xs text-slate-500">5 premières lignes</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {selectedColumns.map((col, idx) => (
                          <th key={idx} className={`px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider border-r last:border-r-0 ${col.source === 'source' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'}`}>
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map((rowIdx) => {
                        const maxRows = Math.max(sourceData?.donnees?.length || 0, cibleData?.donnees?.length || 0);
                        if (rowIdx >= maxRows) return null;
                        return (
                          <tr key={rowIdx} className="border-t border-slate-100 hover:bg-slate-50/50">
                            {selectedColumns.map((col, colIdx) => {
                              const data = col.source === 'source' ? sourceData : cibleData;
                              return <td key={colIdx} className="px-3 py-2 border-r last:border-r-0 text-slate-700">{String(data?.donnees?.[rowIdx]?.[col.originalIndex] ?? '')}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 border-t border-slate-200 pt-4 mt-2 gap-3">
          <div className="flex-1 text-sm text-slate-500">
            {selectedColumns.length === 0 ? '⚠️ Sélectionnez au moins une colonne' : `✓ ${selectedColumns.length} colonne${selectedColumns.length > 1 ? 's' : ''} prête${selectedColumns.length > 1 ? 's' : ''}`}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-300 px-5">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || selectedColumns.length === 0}
            className="rounded-xl bg-gradient-to-r from-[#EA580C] to-[#C2410C] hover:from-[#C2410C] hover:to-[#EA580C] text-white shadow-sm shadow-[#EA580C]/15 px-6">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer le tableau fusionné
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
