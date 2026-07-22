import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Table2, BarChart3, Layers, Calendar } from "lucide-react";
import DataTableWithExport from "@/components/DataTableWithExport";
import ChartBuilder from "@/components/ChartBuilder";
import ExistingSeriesViewer from "@/components/ExistingSeriesViewer";
import { cleanIndicateurTitle, normalizeForComparison } from "@/lib/indicateur-utils";
import type { Json } from "@/integrations/supabase/types";

interface TableauMeta { id: number; code: string; titre_fr: string; annuaire_annee: string; thematique_nom: string; }
interface TableauData { entetes: Json[][]; donnees: Json[][]; }
interface TableauWithData { id: number; code: string; titre_fr: string; annuaire_annee: string; entetes: Json[][]; donnees: Json[][]; }

export default function TableauThematiqueDetail() {
  const { id } = useParams<{ id: string }>(); const [searchParams] = useSearchParams(); const navigate = useNavigate();
  const thematiqueName = searchParams.get("thematique") || ""; const tableauId = parseInt(id || "0");
  const [loading, setLoading] = useState(true); const [tableau, setTableau] = useState<TableauMeta | null>(null);
  const [data, setData] = useState<TableauData | null>(null); const [adjacentWithData, setAdjacentWithData] = useState<TableauWithData[]>([]);
  const [siblingYears, setSiblingYears] = useState<{ id: number; annee: string }[]>([]); const [hasExistingSeries, setHasExistingSeries] = useState(false);

  useEffect(() => { if (tableauId) loadAll(); }, [tableauId]);

  const loadAll = async () => {
    setLoading(true);
    const [metaRes, dataRes] = await Promise.all([supabase.from("v_tableaux_complets").select("id, code, titre_fr, annuaire_annee, thematique_nom").eq("id", tableauId).single(), supabase.from("tableaux_data").select("entetes, donnees").eq("id_tableau", tableauId).single()]);
    if (metaRes.data) {
      const meta = metaRes.data as TableauMeta; setTableau(meta); if (dataRes.data) setData(dataRes.data as TableauData);
      const { data: liaisons } = await supabase.from("v_series_temporelles").select("liaison_id").or(`source_id.eq.${tableauId},cible_id.eq.${tableauId}`).limit(1);
      setHasExistingSeries(!!(liaisons && liaisons.length > 0));
      await loadAdjacentTableaux(meta);
    }
    setLoading(false);
  };

  const loadAdjacentTableaux = async (meta: TableauMeta) => {
    const currentYear = parseInt(meta.annuaire_annee); const currentCleanTitle = normalizeForComparison(cleanIndicateurTitle(meta.titre_fr));
    const { data: allRows } = await supabase.from("v_tableaux_complets").select("id, code, titre_fr, annuaire_annee, thematique_nom").eq("thematique_nom", meta.thematique_nom);
    if (!allRows || allRows.length === 0) { setAdjacentWithData([]); return; }
    const allSiblings = (allRows as TableauMeta[]).filter(r => normalizeForComparison(cleanIndicateurTitle(r.titre_fr)) === currentCleanTitle);
    const seenY = new Set<string>(); const deduped = allSiblings.filter(t => { if (seenY.has(t.annuaire_annee)) return false; seenY.add(t.annuaire_annee); return true; });
    deduped.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee));
    setSiblingYears(deduped.map(t => ({ id: t.id, annee: t.annuaire_annee })));
    const matching = allSiblings.filter(r => r.id !== tableauId && Math.abs(parseInt(r.annuaire_annee) - currentYear) === 1);
    const seenY2 = new Set<string>(); const deduped2 = matching.filter(t => { if (seenY2.has(t.annuaire_annee)) return false; seenY2.add(t.annuaire_annee); return true; });
    deduped2.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee));
    const ids = deduped2.map(t => t.id); const results: TableauWithData[] = [];
    if (ids.length > 0) { const { data: dataRows } = await supabase.from("tableaux_data").select("id_tableau, entetes, donnees").in("id_tableau", ids); const dm = new Map<number, TableauData>(); if (dataRows) dataRows.forEach((d: any) => dm.set(d.id_tableau, { entetes: d.entetes, donnees: d.donnees })); deduped2.forEach(t => { const td = dm.get(t.id); if (td) results.push({ ...t, ...td }); }); }
    setAdjacentWithData(results);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#58061C]" /></div>;
  if (!tableau) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-600">Tableau introuvable</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="glass-nav sticky top-0 z-50">
        <div className="section-container py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/thematique?thematique=${encodeURIComponent(thematiqueName)}`)} className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"><ArrowLeft className="h-5 w-5" /></button>
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
