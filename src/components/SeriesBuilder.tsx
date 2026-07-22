import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Loader2, Plus, X, ArrowUp, ArrowDown, Eye, GripVertical, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface TableauWithData {
  id: number;
  code: string;
  titre_fr: string;
  annuaire_annee: string;
  entetes: Json[][];
  donnees: Json[][];
}

interface SelectedColumn {
  tableauId: number;
  tableauCode: string;
  tableauAnnee: string;
  colIndex: number;
  label: string;
}

interface SeriesBuilderProps {
  current: TableauWithData;
  adjacents: TableauWithData[];
}

function buildColumnLabel(entetes: Json[][], colIndex: number): string {
  const parts: string[] = [];
  for (const row of entetes) {
    const val = row[colIndex];
    if (val != null && String(val).trim() !== "") {
      parts.push(String(val).trim());
    }
  }
  return parts.join(" › ") || `Col ${colIndex + 1}`;
}

function SortablePreviewHeaderCell({ id, children, onRemove }: { id: string; children: React.ReactNode; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };
  return (
    <TableHead ref={setNodeRef} style={style} className={`px-2 py-1.5 whitespace-nowrap cursor-grab ${isDragging ? "bg-primary/20" : ""}`}>
      <div className="flex items-center gap-1">
        <span {...attributes} {...listeners}><GripVertical className="h-3 w-3 text-muted-foreground" /></span>
        {children}
        {onRemove && (
          <button onClick={onRemove} className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Supprimer cette colonne">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </TableHead>
  );
}

function CompactTablePreview({
  tableau,
  selectedColumns,
  onToggleColumn,
  onSelectAll,
}: {
  tableau: TableauWithData;
  selectedColumns: SelectedColumn[];
  onToggleColumn: (tableau: TableauWithData, colIndex: number) => void;
  onSelectAll: (tableau: TableauWithData) => void;
}) {
  const numCols = (tableau.entetes[0] || []).length;
  const previewRows = tableau.donnees.slice(0, 5);

  const isSelected = (colIdx: number) =>
    selectedColumns.some((c) => c.tableauId === tableau.id && c.colIndex === colIdx);

  const allSelected = numCols > 0 && Array.from({ length: numCols }, (_, i) => i).every((i) => isSelected(i));

  return (
    <Card className="border border-border/50">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              AS {tableau.annuaire_annee}
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono">{tableau.code}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {tableau.donnees.length} lignes · {numCols} col
            </span>
            <Button
              variant={allSelected ? "secondary" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs rounded-lg gap-1"
              onClick={() => onSelectAll(tableau)}
            >
              <Check className="h-3 w-3" />
              {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-foreground line-clamp-1 mt-1">{tableau.titre_fr}</p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full max-h-[300px]">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                {tableau.entetes.map((headerRow, rIdx) => (
                  <TableRow key={rIdx}>
                    {(headerRow as Json[]).map((cell, cIdx) => (
                      <TableHead
                        key={cIdx}
                        className={`px-2 py-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                          isSelected(cIdx)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => onToggleColumn(tableau, cIdx)}
                      >
                        <div className="flex items-center gap-1">
                          {rIdx === 0 && (
                            <Checkbox
                              checked={isSelected(cIdx)}
                              className="h-3.5 w-3.5"
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => onToggleColumn(tableau, cIdx)}
                            />
                          )}
                          <span>{String(cell ?? "")}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rIdx) => (
                  <TableRow key={rIdx}>
                    {(row as Json[]).map((cell, cIdx) => (
                      <TableCell
                        key={cIdx}
                        className={`px-2 py-1 whitespace-nowrap ${
                          isSelected(cIdx) ? "bg-primary/5" : ""
                        }`}
                      >
                        {String(cell ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        {tableau.donnees.length > 5 && (
          <p className="text-xs text-muted-foreground px-4 py-1.5 border-t border-border/30">
            +{tableau.donnees.length - 5} lignes masquées
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SeriesBuilder({ current, adjacents }: SeriesBuilderProps) {
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [seriesTableauIds, setSeriesTableauIds] = useState<Set<number>>(new Set());
  const [savedFusion, setSavedFusion] = useState<{
    entetes: string[][];
    donnees: string[][];
    liaisonIds: number[];
  } | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(true);
  // Position where new columns are inserted: 0 = before all, N = after column N
  const [insertPosition, setInsertPosition] = useState<number>(-1); // -1 = append at end
  const [previewColumnOrder, setPreviewColumnOrder] = useState<number[] | null>(null);
  const [hiddenPreviewColumns, setHiddenPreviewColumns] = useState<Set<number>>(new Set());

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Reset column order when fusedTable changes
  useEffect(() => {
    setPreviewColumnOrder(null);
    setHiddenPreviewColumns(new Set());
  }, [selectedColumns, insertPosition, savedFusion]);

  const allTableaux = useMemo(() => {
    const all = [current, ...adjacents];
    all.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee));
    return all;
  }, [current, adjacents]);

  // Tableaux NOT in the existing series (available for extension)
  const newAdjacentTableaux = useMemo(() => {
    return allTableaux.filter(
      (t) => t.id !== current.id && !seriesTableauIds.has(t.id)
    );
  }, [allTableaux, current.id, seriesTableauIds]);

  // On mount, detect existing series and compute dynamic fusion from all chain tableaux
  useEffect(() => {
    const loadExistingSeries = async () => {
      setLoadingSeries(true);

      // Use the DB function get_serie_temporelle for reliable recursive chain discovery
      const { data: serieData, error: serieError } = await supabase
        .rpc("get_serie_temporelle", { p_tableau_id: current.id });

      if (serieError || !serieData || serieData.length <= 1) {
        // No series found (only the current tableau itself)
        setLoadingSeries(false);
        return;
      }

      // serieData includes the current tableau + all linked ones
      const chainIds = (serieData as any[]).map((r: any) => r.id as number);
      const otherIds = chainIds.filter((id) => id !== current.id);
      setSeriesTableauIds(new Set(otherIds));

      // Get liaison IDs for the chain (needed for saving later)
      const { data: liaisons } = await supabase
        .from("tableaux_liaisons")
        .select("id")
        .or(
          chainIds
            .map((id) => `id_tableau_source.eq.${id},id_tableau_cible.eq.${id}`)
            .join(",")
        );

      const liaisonIds = liaisons ? liaisons.map((l) => l.id) : [];

      // Try to load saved fusion FIRST (respects user's column selection & ordering)
      let useSavedFusion = false;
      if (liaisonIds.length > 0) {
        const { data: fusions } = await supabase
          .from("tableaux_fusion")
          .select("*")
          .in("id_liaison", liaisonIds)
          .order("created_at", { ascending: false })
          .limit(1);

        if (fusions && fusions.length > 0) {
          const fusion = fusions[0];
          setSavedFusion({
            entetes: (fusion.entetes_fusionnees as Json[][]).map((r: Json[]) => r.map((c: Json) => String(c ?? ""))),
            donnees: (fusion.donnees_fusionnees as Json[][]).map((r: Json[]) => r.map((c: Json) => String(c ?? ""))),
            liaisonIds,
          });
          useSavedFusion = true;
        }
      }

      // Fallback: dynamically compute fusion from raw data if no saved fusion
      if (!useSavedFusion) {
        const [{ data: allInfos }, { data: allDataRows }] = await Promise.all([
          supabase
            .from("v_tableaux_complets")
            .select("id, annuaire_annee")
            .in("id", chainIds),
          supabase
            .from("tableaux_data")
            .select("id_tableau, entetes, donnees")
            .in("id_tableau", chainIds),
        ]);

        const infoMap = new Map<number, string>();
        if (allInfos) {
          allInfos.forEach((r: any) => infoMap.set(r.id, r.annuaire_annee || "?"));
        }

        const dataMap = new Map<number, { entetes: Json[][]; donnees: Json[][] }>();
        if (allDataRows) {
          allDataRows.forEach((r: any) => dataMap.set(r.id_tableau, { entetes: r.entetes, donnees: r.donnees }));
        }

        const chainTableaux: { id: number; annee: string; entetes: Json[][]; donnees: Json[][] }[] = [];

        for (const tId of chainIds) {
          if (tId === current.id) {
            chainTableaux.push({ id: current.id, annee: current.annuaire_annee, entetes: current.entetes, donnees: current.donnees });
            continue;
          }
          const adj = adjacents.find((a) => a.id === tId);
          if (adj) {
            chainTableaux.push({ id: adj.id, annee: adj.annuaire_annee, entetes: adj.entetes, donnees: adj.donnees });
            continue;
          }
          const annee = infoMap.get(tId);
          const td = dataMap.get(tId);
          if (annee && td) {
            chainTableaux.push({ id: tId, annee, entetes: td.entetes, donnees: td.donnees });
          }
        }

        chainTableaux.sort((a, b) => b.annee.localeCompare(a.annee));

        let maxHeaderRows = 0;
        let maxDataRows = 0;
        for (const t of chainTableaux) {
          maxHeaderRows = Math.max(maxHeaderRows, t.entetes.length);
          maxDataRows = Math.max(maxDataRows, t.donnees.length);
        }

        const fusedEntetes: string[][] = [];
        for (let r = 0; r < maxHeaderRows; r++) {
          const row: string[] = [];
          for (const t of chainTableaux) {
            const numCols = (t.entetes[0] || []).length;
            for (let c = 0; c < numCols; c++) {
              row.push(r < t.entetes.length ? String((t.entetes[r] as Json[])[c] ?? "") : "");
            }
          }
          fusedEntetes.push(row);
        }

        const fusedDonnees: string[][] = [];
        for (let r = 0; r < maxDataRows; r++) {
          const row: string[] = [];
          for (const t of chainTableaux) {
            const numCols = (t.entetes[0] || []).length;
            for (let c = 0; c < numCols; c++) {
              row.push(r < t.donnees.length ? String((t.donnees[r] as Json[])[c] ?? "") : "");
            }
          }
          fusedDonnees.push(row);
        }

        setSavedFusion({
          entetes: fusedEntetes,
          donnees: fusedDonnees,
          liaisonIds,
        });
      }

      setLoadingSeries(false);
    };

    loadExistingSeries();
  }, [current.id]);

  const toggleColumn = useCallback(
    (tableau: TableauWithData, colIndex: number) => {
      setSelectedColumns((prev) => {
        const exists = prev.findIndex(
          (c) => c.tableauId === tableau.id && c.colIndex === colIndex
        );
        if (exists >= 0) {
          return prev.filter((_, i) => i !== exists);
        }
        return [
          ...prev,
          {
            tableauId: tableau.id,
            tableauCode: tableau.code,
            tableauAnnee: tableau.annuaire_annee,
            colIndex,
            label: buildColumnLabel(tableau.entetes, colIndex),
          },
        ];
      });
    },
    []
  );

  const selectAllColumns = useCallback((tableau: TableauWithData) => {
    const numCols = (tableau.entetes[0] || []).length;
    setSelectedColumns((prev) => {
      const allSelected = Array.from({ length: numCols }, (_, i) => i).every((i) =>
        prev.some((c) => c.tableauId === tableau.id && c.colIndex === i)
      );
      if (allSelected) {
        // Deselect all from this tableau
        return prev.filter((c) => c.tableauId !== tableau.id);
      }
      // Select all missing columns
      const existing = new Set(prev.filter((c) => c.tableauId === tableau.id).map((c) => c.colIndex));
      const newCols: SelectedColumn[] = [];
      for (let i = 0; i < numCols; i++) {
        if (!existing.has(i)) {
          newCols.push({
            tableauId: tableau.id,
            tableauCode: tableau.code,
            tableauAnnee: tableau.annuaire_annee,
            colIndex: i,
            label: buildColumnLabel(tableau.entetes, i),
          });
        }
      }
      return [...prev, ...newCols];
    });
  }, []);

  const moveColumn = useCallback((index: number, direction: "up" | "down") => {
    setSelectedColumns((prev) => {
      const newArr = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= newArr.length) return prev;
      [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
      return newArr;
    });
  }, []);

  const removeColumn = useCallback((index: number) => {
    setSelectedColumns((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Build the fused table: merge saved fusion + new selected columns at insertPosition
  const fusedTable = useMemo(() => {
    if (!savedFusion && selectedColumns.length === 0) return null;

    const tableauxMap = new Map<number, TableauWithData>();
    allTableaux.forEach((t) => tableauxMap.set(t.id, t));

    if (!savedFusion) {
      // No existing series: just build from selectedColumns
      let maxHeaderRows = 0;
      let maxDataRows = 0;
      for (const col of selectedColumns) {
        const t = tableauxMap.get(col.tableauId);
        if (t) {
          maxHeaderRows = Math.max(maxHeaderRows, t.entetes.length);
          maxDataRows = Math.max(maxDataRows, t.donnees.length);
        }
      }
      const entetes: string[][] = [];
      for (let r = 0; r < maxHeaderRows; r++) {
        const row: string[] = [];
        for (const col of selectedColumns) {
          const t = tableauxMap.get(col.tableauId);
          if (t && r < t.entetes.length) {
            row.push(String((t.entetes[r] as Json[])[col.colIndex] ?? ""));
          } else { row.push(""); }
        }
        entetes.push(row);
      }
      const donnees: string[][] = [];
      for (let r = 0; r < maxDataRows; r++) {
        const row: string[] = [];
        for (const col of selectedColumns) {
          const t = tableauxMap.get(col.tableauId);
          if (t && r < t.donnees.length) {
            row.push(String((t.donnees[r] as Json[])[col.colIndex] ?? ""));
          } else { row.push(""); }
        }
        donnees.push(row);
      }
      const sourceRow = selectedColumns.map((c) => `AS ${c.tableauAnnee}`);
      return { entetes, donnees, sourceRow };
    }

    // Has saved fusion: insert new columns at the chosen position
    if (selectedColumns.length === 0) {
      const sourceRow = savedFusion.entetes[0]?.map(() => "Série existante") || [];
      return { entetes: savedFusion.entetes.map((r) => [...r]), donnees: savedFusion.donnees.map((r) => [...r]), sourceRow };
    }

    // Build new column data
    let maxHeaderRows = savedFusion.entetes.length;
    let maxDataRows = savedFusion.donnees.length;
    for (const col of selectedColumns) {
      const t = tableauxMap.get(col.tableauId);
      if (t) {
        maxHeaderRows = Math.max(maxHeaderRows, t.entetes.length);
        maxDataRows = Math.max(maxDataRows, t.donnees.length);
      }
    }

    const newColEntetes: string[][] = [];
    for (let r = 0; r < maxHeaderRows; r++) {
      const row: string[] = [];
      for (const col of selectedColumns) {
        const t = tableauxMap.get(col.tableauId);
        if (t && r < t.entetes.length) {
          row.push(String((t.entetes[r] as Json[])[col.colIndex] ?? ""));
        } else { row.push(""); }
      }
      newColEntetes.push(row);
    }

    const newColDonnees: string[][] = [];
    for (let r = 0; r < maxDataRows; r++) {
      const row: string[] = [];
      for (const col of selectedColumns) {
        const t = tableauxMap.get(col.tableauId);
        if (t && r < t.donnees.length) {
          row.push(String((t.donnees[r] as Json[])[col.colIndex] ?? ""));
        } else { row.push(""); }
      }
      newColDonnees.push(row);
    }

    const existingCols = savedFusion.entetes[0]?.length || 0;
    const pos = insertPosition === -1 ? existingCols : Math.min(insertPosition, existingCols);

    // Splice new columns into existing at position
    const entetes: string[][] = [];
    for (let r = 0; r < maxHeaderRows; r++) {
      const existingRow = r < savedFusion.entetes.length ? [...savedFusion.entetes[r]] : new Array(existingCols).fill("");
      const newRow = newColEntetes[r] || new Array(selectedColumns.length).fill("");
      const merged = [...existingRow.slice(0, pos), ...newRow, ...existingRow.slice(pos)];
      entetes.push(merged);
    }

    const donnees: string[][] = [];
    for (let r = 0; r < maxDataRows; r++) {
      const existingRow = r < savedFusion.donnees.length ? [...savedFusion.donnees[r]] : new Array(existingCols).fill("");
      const newRow = newColDonnees[r] || new Array(selectedColumns.length).fill("");
      const merged = [...existingRow.slice(0, pos), ...newRow, ...existingRow.slice(pos)];
      donnees.push(merged);
    }

    // Source row
    const existingSourceRow = new Array(existingCols).fill("Série existante");
    const newSourceRow = selectedColumns.map((c) => `AS ${c.tableauAnnee}`);
    const sourceRow = [...existingSourceRow.slice(0, pos), ...newSourceRow, ...existingSourceRow.slice(pos)];

    return { entetes, donnees, sourceRow };
  }, [savedFusion, selectedColumns, allTableaux, insertPosition]);

  const handleSave = async () => {
    if (!fusedTable || selectedColumns.length === 0) return;
    setSaving(true);

    // Apply preview column reordering and hidden columns
    const totalCols = fusedTable.entetes[0]?.length || 0;
    const baseOrder = previewColumnOrder || Array.from({ length: totalCols }, (_, i) => i);
    const colOrder = baseOrder.filter((i) => !hiddenPreviewColumns.has(i));
    const reorder = (row: string[]) => colOrder.map((i) => row[i] ?? "");
    const finalEntetes = fusedTable.entetes.map(reorder);
    const finalDonnees = fusedTable.donnees.map(reorder);

    try {
      const usedAdjacentIds = new Set(
        selectedColumns
          .filter((c) => c.tableauId !== current.id)
          .map((c) => c.tableauId)
      );

      if (usedAdjacentIds.size === 0) {
        toast({
          title: "Sélection insuffisante",
          description: "Sélectionnez au moins une colonne d'un tableau adjacent",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const currentYear = parseInt(current.annuaire_annee);

      for (const adjId of usedAdjacentIds) {
        const adjTableau = allTableaux.find((t) => t.id === adjId);
        if (!adjTableau) continue;

        const adjYear = parseInt(adjTableau.annuaire_annee);
        const source = adjYear < currentYear ? adjId : current.id;
        const cible = adjYear < currentYear ? current.id : adjId;

        const { data: existing } = await supabase
          .from("tableaux_liaisons")
          .select("id")
          .or(
            `and(id_tableau_source.eq.${source},id_tableau_cible.eq.${cible}),and(id_tableau_source.eq.${cible},id_tableau_cible.eq.${source})`
          );

        let liaisonId: number;

        if (existing && existing.length > 0) {
          liaisonId = existing[0].id;
        } else {
          const { data: newLiaison, error: liaisonErr } = await supabase
            .from("tableaux_liaisons")
            .insert({
              id_tableau_source: source,
              id_tableau_cible: cible,
              type_liaison: "serie_temporelle",
              methode_liaison: "series_builder_thematique",
              confiance: 100,
            })
            .select("id")
            .single();

          if (liaisonErr) {
            toast({ title: "Erreur liaison", description: liaisonErr.message, variant: "destructive" });
            continue;
          }
          liaisonId = newLiaison.id;
        }

        const allColDesc = savedFusion
          ? `existing,${selectedColumns.map((c) => `${c.tableauCode}:${c.colIndex}`).join(",")}`
          : selectedColumns.map((c) => `${c.tableauCode}:${c.colIndex}`).join(",");

        const { error: fusionErr } = await supabase.from("tableaux_fusion").upsert(
          {
            id_liaison: liaisonId,
            strategie: "extension_horizontale",
            entetes_fusionnees: finalEntetes as unknown as Json,
            donnees_fusionnees: finalDonnees as unknown as Json,
            colonne_selectionnee: allColDesc,
          },
          { onConflict: "id_liaison" }
        );

        if (fusionErr) {
          toast({ title: "Erreur fusion", description: fusionErr.message, variant: "destructive" });
        }
      }

      toast({
        title: savedFusion ? "Série étendue" : "Série créée",
        description: `Tableau fusionné avec ${fusedTable.entetes[0]?.length || 0} colonnes`,
      });
      setSelectedColumns([]);
      setShowPreview(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loadingSeries) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing series fusion display */}
      {savedFusion && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Série existante</CardTitle>
                <Badge className="text-xs bg-primary/20 text-primary border-0">
                  {savedFusion.entetes[0]?.length || 0} colonnes
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {seriesTableauIds.size + 1} tableaux liés
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Insertion position selector */}
            {selectedColumns.length > 0 && (
              <div className="px-4 py-2 border-b border-border/30 bg-background/50">
                <p className="text-xs text-muted-foreground mb-2">
                  Cliquez sur une position pour insérer les nouvelles colonnes :
                </p>
                <div className="flex items-center gap-0.5 flex-wrap">
                  <Button
                    variant={insertPosition === 0 ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs rounded-lg"
                    onClick={() => setInsertPosition(0)}
                  >
                    ← Début
                  </Button>
                  {savedFusion.entetes[0]?.map((cell, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-0.5">
                      <span className="text-xs text-muted-foreground px-1 max-w-[80px] truncate">
                        {String(cell ?? "")}
                      </span>
                      <Button
                        variant={insertPosition === cIdx + 1 ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs rounded-lg shrink-0"
                        onClick={() => setInsertPosition(cIdx + 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant={insertPosition === -1 ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs rounded-lg"
                    onClick={() => setInsertPosition(-1)}
                  >
                    Fin →
                  </Button>
                </div>
              </div>
            )}
            <ScrollArea className="w-full max-h-[400px]">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    {savedFusion.entetes.map((row, rIdx) => (
                      <TableRow key={rIdx}>
                        {row.map((cell, cIdx) => {
                          const isInsertPoint =
                            selectedColumns.length > 0 &&
                            (insertPosition === cIdx || (insertPosition === -1 && cIdx === row.length - 1));
                          return (
                            <TableHead
                              key={cIdx}
                              className={`px-2 py-1.5 whitespace-nowrap ${
                                isInsertPoint && rIdx === 0 ? "border-r-2 border-primary" : ""
                              }`}
                            >
                              {String(cell ?? "")}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {savedFusion.donnees.slice(0, 8).map((row, rIdx) => (
                      <TableRow key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <TableCell key={cIdx} className="px-2 py-1 whitespace-nowrap">
                            {String(cell ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            {savedFusion.donnees.length > 8 && (
              <p className="text-xs text-muted-foreground px-4 py-1.5 border-t border-border/30">
                +{savedFusion.donnees.length - 8} lignes masquées
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* New adjacent tableaux for extension */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {savedFusion ? "Étendre la série" : "Tableaux disponibles"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {savedFusion
            ? "Sélectionnez les colonnes des tableaux ci-dessous pour les ajouter à la série existante."
            : "Cliquez sur les en-têtes de colonnes pour les sélectionner et construire votre tableau fusionné."}
        </p>

        {savedFusion ? (
          newAdjacentTableaux.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-muted-foreground/20 p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Aucun tableau adjacent disponible pour étendre la série
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {newAdjacentTableaux.map((t) => (
                <CompactTablePreview
                  key={t.id}
                  tableau={t}
                  selectedColumns={selectedColumns}
                  onToggleColumn={toggleColumn}
                  onSelectAll={selectAllColumns}
                />
              ))}
            </div>
          )
        ) : adjacents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted-foreground/20 p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Aucun tableau adjacent trouvé pour cette thématique
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {allTableaux.map((t) => (
              <CompactTablePreview
                key={t.id}
                tableau={t}
                selectedColumns={selectedColumns}
                onToggleColumn={toggleColumn}
                onSelectAll={selectAllColumns}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected columns panel */}
      {selectedColumns.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Nouvelles colonnes sélectionnées ({selectedColumns.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? "Masquer" : "Aperçu"}
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {savedFusion ? "Étendre la série" : "Créer la série"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {selectedColumns.map((col, idx) => (
                <div
                  key={`${col.tableauId}-${col.colIndex}`}
                  className="flex items-center gap-2 bg-background/80 rounded-lg px-3 py-2"
                >
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                    AS {col.tableauAnnee}
                  </Badge>
                  <span className="text-sm text-foreground flex-1 truncate">{col.label}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{col.tableauCode}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveColumn(idx, "up")}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveColumn(idx, "down")}
                      disabled={idx === selectedColumns.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeColumn(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview of merged result with drag & drop */}
            {showPreview && fusedTable && (() => {
              const totalCols = fusedTable.entetes[0]?.length || 0;
              const baseOrder = previewColumnOrder || Array.from({ length: totalCols }, (_, i) => i);
              const colOrder = baseOrder.filter((i) => !hiddenPreviewColumns.has(i));
              const columnIds = colOrder.map(String);
              const reorder = (row: string[]) => colOrder.map((i) => row[i] ?? "");

              const handlePreviewDragEnd = (event: DragEndEvent) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  const oldIndex = colOrder.indexOf(Number(active.id));
                  const newIndex = colOrder.indexOf(Number(over.id));
                  // Rebuild full order (including hidden) with visible ones reordered
                  const newVisible = arrayMove(colOrder, oldIndex, newIndex);
                  const hidden = baseOrder.filter((i) => hiddenPreviewColumns.has(i));
                  setPreviewColumnOrder([...newVisible, ...hidden]);
                }
              };

              const handleRemovePreviewColumn = (origIdx: number) => {
                setHiddenPreviewColumns((prev) => new Set([...prev, origIdx]));
              };

              const isModified = previewColumnOrder !== null || hiddenPreviewColumns.size > 0;

              return (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">
                      Aperçu du tableau fusionné final ({colOrder.length} colonnes)
                    </h4>
                    {isModified && (
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setPreviewColumnOrder(null); setHiddenPreviewColumns(new Set()); }}>
                        <RotateCcw className="h-3 w-3" />
                        Réinitialiser
                      </Button>
                    )}
                  </div>
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePreviewDragEnd}>
                    <div className="w-full max-h-[400px] overflow-auto rounded-lg border border-border/50">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="bg-primary/5">
                              <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                                {colOrder.map((origIdx) => (
                                  <SortablePreviewHeaderCell key={String(origIdx)} id={String(origIdx)} onRemove={() => handleRemovePreviewColumn(origIdx)}>
                                    <span className="text-primary font-mono">{fusedTable.sourceRow[origIdx]}</span>
                                  </SortablePreviewHeaderCell>
                                ))}
                              </SortableContext>
                            </TableRow>
                            {fusedTable.entetes.map((row, rIdx) => (
                              <TableRow key={rIdx}>
                                {reorder(row).map((cell, cIdx) => (
                                  <TableHead key={cIdx} className="px-2 py-1.5 whitespace-nowrap">
                                    {cell}
                                  </TableHead>
                                ))}
                              </TableRow>
                            ))}
                          </TableHeader>
                          <TableBody>
                            {fusedTable.donnees.slice(0, 10).map((row, rIdx) => (
                              <TableRow key={rIdx}>
                                {reorder(row).map((cell, cIdx) => (
                                  <TableCell key={cIdx} className="px-2 py-1 whitespace-nowrap">
                                    {cell}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                    </div>
                  </DndContext>
                  {fusedTable.donnees.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Affichage des 10 premières lignes sur {fusedTable.donnees.length}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Glissez les en-têtes pour réorganiser · ✕ pour supprimer une colonne
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
