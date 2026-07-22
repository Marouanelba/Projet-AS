import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Eye, Layers, BarChart3, Table2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DataTableWithExport from "@/components/DataTableWithExport";
import ChartBuilder from "@/components/ChartBuilder";
import type { Json } from "@/integrations/supabase/types";

interface SerieChain {
  id: string; // unique key for this chain
  tableaux: SerieTableau[];
  fusionData: { entetes: Json[][]; donnees: Json[][]; source: string } | null;
}

interface SerieTableau {
  id: number;
  code: string;
  titre_fr: string;
  annee: string;
}

interface ExistingSeriesViewerProps {
  tableauId: number;
}

export default function ExistingSeriesViewer({ tableauId }: ExistingSeriesViewerProps) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<SerieChain[]>([]);
  const [selectedSerieIdx, setSelectedSerieIdx] = useState<number>(0);

  useEffect(() => {
    loadSeries();
  }, [tableauId]);

  const loadSeries = async () => {
    setLoading(true);

    // Use the server-side recursive function for reliable full chain discovery
    const { data: serieData, error } = await supabase
      .rpc("get_serie_temporelle", { p_tableau_id: tableauId });

    if (error || !serieData || serieData.length <= 1) {
      setSeries([]);
      setLoading(false);
      return;
    }

    const chainIds = (serieData as any[]).map((r: any) => r.id as number);

    // Batch fetch metadata and raw data for the entire chain
    const [{ data: metaRows }, { data: dataRows }] = await Promise.all([
      supabase
        .from("v_tableaux_complets")
        .select("id, code, titre_fr, annuaire_annee")
        .in("id", chainIds),
      supabase
        .from("tableaux_data")
        .select("id_tableau, entetes, donnees")
        .in("id_tableau", chainIds),
    ]);

    const tableaux: SerieTableau[] = (metaRows || [])
      .map((r: any) => ({
        id: r.id,
        code: r.code,
        titre_fr: r.titre_fr,
        annee: r.annuaire_annee,
      }))
      .sort((a: SerieTableau, b: SerieTableau) => b.annee.localeCompare(a.annee));

    // Try to load saved fusion data first
    let fusionData = await loadSavedFusion(chainIds);
    
    // Fallback to dynamic computation if no saved fusion
    if (!fusionData) {
      // Build tableaux with data for computeFusion
      const dataMap = new Map<number, { entetes: Json[][]; donnees: Json[][] }>();
      if (dataRows) {
        dataRows.forEach((d: any) => dataMap.set(d.id_tableau, { entetes: d.entetes, donnees: d.donnees }));
      }
      fusionData = await computeFusionFromData(tableaux, dataMap);
    }

    const chain: SerieChain = {
      id: `chain-${tableauId}`,
      tableaux,
      fusionData,
    };

    setSeries([chain]);
    setSelectedSerieIdx(0);
    setLoading(false);
  };

  const loadSavedFusion = async (
    chainIds: number[]
  ): Promise<{ entetes: Json[][]; donnees: Json[][]; source: string } | null> => {
    // Find liaisons between chain members
    const { data: liaisons } = await supabase
      .from("tableaux_liaisons")
      .select("id")
      .or(
        chainIds.map(id => `id_tableau_source.eq.${id}`).join(",") + "," +
        chainIds.map(id => `id_tableau_cible.eq.${id}`).join(",")
      );

    if (!liaisons || liaisons.length === 0) return null;

    // Find fusion data for these liaisons
    const liaisonIds = liaisons.map(l => l.id);
    const { data: fusions } = await supabase
      .from("tableaux_fusion")
      .select("*")
      .in("id_liaison", liaisonIds)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!fusions || fusions.length === 0) return null;

    const fusion = fusions[0];
    return {
      entetes: fusion.entetes_fusionnees as Json[][],
      donnees: fusion.donnees_fusionnees as Json[][],
      source: `Fusion sauvegardée (${fusion.strategie})`,
    };
  };

  const computeFusionFromData = async (
    tableaux: SerieTableau[],
    dataMap: Map<number, { entetes: Json[][]; donnees: Json[][] }>
  ): Promise<{ entetes: Json[][]; donnees: Json[][]; source: string } | null> => {
    if (tableaux.length === 0) return null;

    const withData = tableaux
      .map((t) => ({ ...t, ...(dataMap.get(t.id) || {}) }))
      .filter((t) => (t as any).entetes && (t as any).donnees) as (SerieTableau & {
      entetes: Json[][];
      donnees: Json[][];
    })[];


    if (withData.length === 0) return null;
    if (withData.length === 1) {
      return {
        entetes: withData[0].entetes,
        donnees: withData[0].donnees,
        source: `AS ${withData[0].annee}`,
      };
    }

    // Sort desc by year
    withData.sort((a, b) => b.annee.localeCompare(a.annee));

    // Dynamic column fusion (same logic as IndicateurPublicDetail)
    const columnsMap = new Map<string, { headerCells: Json[]; dataColumn: Json[] }>();
    let firstTextColumn: { header: Json[]; data: Json[] } | null = null;
    let lastTextColumn: { header: Json[]; data: Json[] } | null = null;

    for (const asData of withData) {
      const lastHeaderRow = asData.entetes[asData.entetes.length - 1];
      const nbCols = lastHeaderRow.length;

      for (let colIdx = 0; colIdx < nbCols; colIdx++) {
        const colName = String(lastHeaderRow[colIdx] || "").trim();
        const yearMatch = colName.match(/(?<!\d)(19|20)\d{2}(?!\d)/);
        const isYearColumn = !!yearMatch;
        const yearKey = yearMatch ? yearMatch[0] : null;

        if (isYearColumn && yearKey) {
          if (!columnsMap.has(yearKey)) {
            const headerCells = asData.entetes.map((row) => row[colIdx] ?? "");
            const dataColumn = asData.donnees.map((row) => row[colIdx] ?? "");
            columnsMap.set(yearKey, { headerCells, dataColumn });
          }
        } else {
          const headerCells = asData.entetes.map((row) => row[colIdx] ?? "");
          const dataColumn = asData.donnees.map((row) => row[colIdx] ?? "");
          if (colIdx === 0 && !firstTextColumn) {
            firstTextColumn = { header: headerCells, data: dataColumn };
          }
          if (colIdx === nbCols - 1 && !lastTextColumn) {
            lastTextColumn = { header: headerCells, data: dataColumn };
          }
        }
      }
    }

    const sortedYears = Array.from(columnsMap.keys()).sort((a, b) => b.localeCompare(a));
    const nbHeaderRows = withData[0].entetes.length;
    const nbDataRows = withData[0].donnees.length;

    const fusionEntetes: Json[][] = [];
    const fusionDonnees: Json[][] = [];

    for (let rowIdx = 0; rowIdx < nbHeaderRows; rowIdx++) {
      const row: Json[] = [];
      if (firstTextColumn) row.push(firstTextColumn.header[rowIdx]);
      for (const year of sortedYears) row.push(columnsMap.get(year)!.headerCells[rowIdx]);
      if (lastTextColumn && firstTextColumn !== lastTextColumn)
        row.push(lastTextColumn.header[rowIdx]);
      fusionEntetes.push(row);
    }

    for (let rowIdx = 0; rowIdx < nbDataRows; rowIdx++) {
      const row: Json[] = [];
      if (firstTextColumn) row.push(firstTextColumn.data[rowIdx]);
      for (const year of sortedYears) row.push(columnsMap.get(year)!.dataColumn[rowIdx]);
      if (lastTextColumn && firstTextColumn !== lastTextColumn)
        row.push(lastTextColumn.data[rowIdx]);
      fusionDonnees.push(row);
    }

    return {
      entetes: fusionEntetes,
      donnees: fusionDonnees,
      source: `Série fusionnée (${sortedYears.join(", ")})`,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement des séries…</span>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/20 p-12 text-center">
        <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          Aucune série existante pour ce tableau
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Aucune série temporelle n'est disponible pour ce tableau
        </p>
      </div>
    );
  }

  const selectedSerie = series[selectedSerieIdx];

  return (
    <div className="space-y-6">
      {/* Series list */}
      {series.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {series.map((s, idx) => (
            <Button
              key={s.id}
              variant={idx === selectedSerieIdx ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setSelectedSerieIdx(idx)}
            >
              <Layers className="h-3.5 w-3.5" />
              Série {idx + 1}
            </Button>
          ))}
        </div>
      )}

      {/* Chain summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Tableaux de la série ({selectedSerie.tableaux.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {selectedSerie.tableaux.map((t) => (
              <Badge
                key={t.id}
                variant={t.id === tableauId ? "default" : "outline"}
                className="text-xs gap-1"
              >
                <span className="font-mono">{t.code}</span>
                <span>AS {t.annee}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fusion data visualization */}
      {selectedSerie.fusionData && (
        <Tabs defaultValue="tableau" className="w-full">
          <TabsList className="rounded-xl p-1 h-auto mb-4">
            <TabsTrigger
              value="tableau"
              className="rounded-lg px-4 py-2 text-sm gap-1.5"
            >
              <Table2 className="h-3.5 w-3.5" />
              Tableau fusionné
            </TabsTrigger>
            <TabsTrigger
              value="graphique"
              className="rounded-lg px-4 py-2 text-sm gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Graphique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tableau">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{selectedSerie.fusionData.source}</p>
              <DataTableWithExport
                entetes={selectedSerie.fusionData.entetes}
                donnees={selectedSerie.fusionData.donnees}
              />
            </div>
          </TabsContent>

          <TabsContent value="graphique">
            <ChartBuilder
              entetes={selectedSerie.fusionData.entetes}
              donnees={selectedSerie.fusionData.donnees}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
