import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { views, tableauxData } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Table2, BarChart3, Layers, Calendar } from "lucide-react";
import { useRetour } from '@/hooks/useRetour';
import { usePublicationGuard } from '@/hooks/usePublicationGuard';
import DataTableWithExport from "@/components/DataTableWithExport";
import ChartBuilder from "@/components/ChartBuilder";
import ExistingSeriesViewer from "@/components/ExistingSeriesViewer";
import { cleanIndicateurTitle, normalizeForComparison } from "@/lib/indicateur-utils";

interface TableauMeta { id: number; code: string; titre_fr: string; annuaire_annee: string; thematique_nom: string; }
interface TableauData { entetes: any[][]; donnees: any[][]; }
interface TableauWithData { id: number; code: string; titre_fr: string; annuaire_annee: string; entetes: any[][]; donnees: any[][]; }

export default function TableauThematiqueDetail() {
  const { id } = useParams<{ id: string }>(); const [searchParams] = useSearchParams(); const navigate = useNavigate();
  const retour = useRetour("/");
  usePublicationGuard(id);
  const thematiqueName = searchParams.get("thematique") || ""; const tableauId = parseInt(id || "0");
  const [loading, setLoading] = useState(true); const [tableau, setTableau] = useState<TableauMeta | null>(null);
  const [data, setData] = useState<TableauData | null>(null); const [adjacentWithData, setAdjacentWithData] = useState<TableauWithData[]>([]);
  const [siblingYears, setSiblingYears] = useState<{ id: number; annee: string }[]>([]); const [hasExistingSeries, setHasExistingSeries] = useState(false);

  useEffect(() => { if (tableauId) loadAll(); }, [tableauId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [allMeta, dataResult] = await Promise.all([
        views.tableauxComplets({ from: 0, to: 99999 }),
        tableauxData.getByTableau(tableauId),
      ]);

      const metaRow = allMeta.find((r: any) => r.id === tableauId);
      if (metaRow) {
        const meta = metaRow as TableauMeta;
        setTableau(meta);
        if (dataResult) setData(dataResult as TableauData);

        // Check if series exist via views
        const seriesRows = await views.seriesTemporelles(0, 99999);
        const hasLinks = seriesRows.some((r: any) => r.source_id === tableauId || r.cible_id === tableauId);
        setHasExistingSeries(hasLinks);

        await loadAdjacentTableaux(meta, allMeta);
      }
    } catch (e) {
      console.error("Error loading tableau:", e);
    }
    setLoading(false);
  };

  const loadAdjacentTableaux = async (meta: TableauMeta, allMeta?: any[]) => {
    const currentYear = parseInt(meta.annuaire_annee); const currentCleanTitle = normalizeForComparison(cleanIndicateurTitle(meta.titre_fr));

    let allRows = allMeta;
    if (!allRows) {
      allRows = await views.tableauxComplets({ from: 0, to: 99999 });
    }
    const filteredRows = allRows.filter((r: any) => r.thematique_nom === meta.thematique_nom);

    if (filteredRows.length === 0) { setAdjacentWithData([]); return; }
    const allSiblings = (filteredRows as TableauMeta[]).filter(r => normalizeForComparison(cleanIndicateurTitle(r.titre_fr)) === currentCleanTitle);
    const seenY = new Set<string>(); const deduped = allSiblings.filter(t => { if (seenY.has(t.annuaire_annee)) return false; seenY.add(t.annuaire_annee); return true; });
    deduped.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee));
    setSiblingYears(deduped.map(t => ({ id: t.id, annee: t.annuaire_annee })));
    const matching = allSiblings.filter(r => r.id !== tableauId && Math.abs(parseInt(r.annuaire_annee) - currentYear) === 1);
    const seenY2 = new Set<string>(); const deduped2 = matching.filter(t => { if (seenY2.has(t.annuaire_annee)) return false; seenY2.add(t.annuaire_annee); return true; });
    deduped2.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee));
    const ids = deduped2.map(t => t.id); const results: TableauWithData[] = [];
    if (ids.length > 0) {
      try {
        const dataRows = await tableauxData.getByTableaux(ids);
        const dm = new Map<number, TableauData>();
        if (dataRows) dataRows.forEach((d: any) => dm.set(d.id_tableau, { entetes: d.entetes, donnees: d.donnees }));
        deduped2.forEach(t => { const td = dm.get(t.id); if (td) results.push({ ...t, ...td }); });
      } catch (e) {
        console.error("Error loading adjacent data:", e);
      }
    }
    setAdjacentWithData(results);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" /></div>;
  if (!tableau) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-600">Tableau introuvable</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="glass-nav sticky top-0 z-50">
        <div className="section-container py-4">
          <div className="flex items-center gap-3">
            <button onClick={retour} className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">{tableau.titre_fr}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">{tableau.code}</span>
                <span className="text-xs text-slate-500">{thematiqueName}</span>
              </div>
            </div>
            {siblingYears.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <Calendar className="h-4 w-4 text-slate-400" />
                <Select value={String(tableauId)} onValueChange={val => { if (val !== String(tableauId)) navigate(`/thematique/tableau/${val}?thematique=${encodeURIComponent(thematiqueName)}`); }}>
                  <SelectTrigger className="h-9 w-[120px] rounded-xl text-xs border-slate-200 bg-white"><SelectValue placeholder="Année" /></SelectTrigger>
                  <SelectContent>{siblingYears.map(s => <SelectItem key={s.id} value={String(s.id)}>AS {s.annee}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="section-container py-8">
        <Tabs defaultValue={hasExistingSeries ? "series" : "tableau"} className="w-full">
          <TabsList className="glass-strong rounded-xl p-1.5 h-auto mb-6 flex-wrap">
            <TabsTrigger value="tableau" className="rounded-lg px-5 py-2.5 text-sm font-medium gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Table2 className="h-4 w-4" /> Tableau</TabsTrigger>
            <TabsTrigger value="graphique" className="rounded-lg px-5 py-2.5 text-sm font-medium gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"><BarChart3 className="h-4 w-4" /> Graphique</TabsTrigger>
            {hasExistingSeries && <TabsTrigger value="series" className="rounded-lg px-5 py-2.5 text-sm font-medium gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Layers className="h-4 w-4" /> Séries</TabsTrigger>}
          </TabsList>
          <TabsContent value="tableau">{data ? <DataTableWithExport entetes={data.entetes} donnees={data.donnees} /> : <div className="glass-strong rounded-2xl p-12 text-center text-slate-500">Aucune donnée</div>}</TabsContent>
          <TabsContent value="graphique">{data ? <ChartBuilder entetes={data.entetes} donnees={data.donnees} /> : <div className="glass-strong rounded-2xl p-12 text-center text-slate-500">Aucune donnée</div>}</TabsContent>
          {hasExistingSeries && <TabsContent value="series"><ExistingSeriesViewer tableauId={tableauId} /></TabsContent>}
        </Tabs>
      </div>
    </div>
  );
}
