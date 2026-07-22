import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, Loader2, RefreshCw, Table as TableIcon, Link2, Layers, LineChart, Home, CalendarDays, Database, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTableWithExport from "@/components/DataTableWithExport";
import ChartBuilder from "@/components/ChartBuilder";
import type { Json } from "@/integrations/supabase/types";

interface IndicateurSummary { id: number; code: string; titre_fr: string | null; annuaire_annee: string | null; thematique_nom: string | null; unite_fr: string | null; source_fr: string | null; notes_fr: string | null; }
interface IndicateurData { id: number; entetes: Json[][]; donnees: Json[][]; }
interface SerieIndicateur { id: number; code: string; titre_fr: string; annee: string; donnees?: Json[][] | null; entetes?: Json[][] | null; }
interface Rupture { id: number; id_tableau: number; annee_rupture: string; direction: 'precedente' | 'suivante'; }
interface SerieTemporelleRow { liaison_id: number | null; type_liaison: string | null; source_id: number | null; source_code: string | null; source_titre: string | null; source_annee: string | null; cible_id: number | null; cible_code: string | null; cible_titre: string | null; cible_annee: string | null; }
type StrategyType = "none" | "fusionne" | "remplace" | "serie";

const highlightIndices = (text: string | null) => {
  if (!text) return null;
  const parts = text.split(/(\(\d+\))/g);
  return parts.map((part, i) => /(\(\d+\))/.test(part) ? <span key={i} className="highlight-index">{part}</span> : part);
};

const buildChain = async (startId: number, allLiaisons: SerieTemporelleRow[], allowedTypes: string[], ruptures: Rupture[] = []): Promise<SerieIndicateur[]> => {
  const visited = new Set<number>(); const chain: SerieIndicateur[] = []; const queue: number[] = [startId];
  while (queue.length > 0) {
    const currentId = queue.shift()!; if (visited.has(currentId)) continue; visited.add(currentId);
    const { data: indInfo } = await supabase.from("v_tableaux_complets").select("id, code, titre_fr, annuaire_annee").eq("id", currentId).maybeSingle();
    if (indInfo?.id && indInfo.code && indInfo.titre_fr && indInfo.annuaire_annee) chain.push({ id: indInfo.id, code: indInfo.code, titre_fr: indInfo.titre_fr, annee: indInfo.annuaire_annee });
    const connected = allLiaisons.filter(l => !!l.type_liaison && allowedTypes.includes(l.type_liaison) && (l.source_id === currentId || l.cible_id === currentId));
    for (const liaison of connected) {
      const nextId = liaison.source_id === currentId ? liaison.cible_id : liaison.source_id;
      if (typeof nextId === "number" && !visited.has(nextId)) {
        const currentRupture = ruptures.find(r => r.id_tableau === currentId); const nextRupture = ruptures.find(r => r.id_tableau === nextId);
        const currentAnnee = indInfo?.annuaire_annee || ""; const nextAnnee = liaison.source_id === currentId ? liaison.cible_annee : liaison.source_annee;
        let blocked = false;
        if (currentRupture) { if (currentRupture.direction === 'suivante' && nextAnnee && nextAnnee > currentAnnee) blocked = true; if (currentRupture.direction === 'precedente' && nextAnnee && nextAnnee < currentAnnee) blocked = true; }
        if (nextRupture && !blocked) { if (nextRupture.direction === 'precedente' && nextAnnee && nextAnnee > currentAnnee) blocked = true; if (nextRupture.direction === 'suivante' && nextAnnee && nextAnnee < currentAnnee) blocked = true; }
        if (!blocked) queue.push(nextId);
      }
    }
  }
  return chain.sort((a, b) => a.annee.localeCompare(b.annee));
};

const computeDynamicFusion = async (chain: SerieIndicateur[]): Promise<{ entetes: Json[][]; donnees: Json[][]; source: string } | null> => {
  if (chain.length === 0) return null;
  const chainWithData = await Promise.all(chain.map(async (item) => { const { data } = await supabase.from("tableaux_data").select("entetes, donnees").eq("id_tableau", item.id).maybeSingle(); return { ...item, entetes: data?.entetes as Json[][] | null, donnees: data?.donnees as Json[][] | null }; }));
  const withData = chainWithData.filter(item => item.donnees && item.entetes);
  if (withData.length === 0) return null;
  if (withData.length === 1) return { entetes: withData[0].entetes!, donnees: withData[0].donnees!, source: `AS ${withData[0].annee}` };
  withData.sort((a, b) => b.annee.localeCompare(a.annee));
  const columnsByYear = new Map<string, { headerCells: Json[], dataColumn: Json[] }[]>();
  let firstTextColumn: { header: Json[], data: Json[] } | null = null;
  let lastTextColumn: { header: Json[], data: Json[] } | null = null;
  const yearRegex = /(?<!\d)(19|20)\d{2}(?!\d)/;
  const findColumnYear = (entetes: Json[][], colIdx: number): string | null => { for (const row of entetes) { const m = String(row?.[colIdx] ?? "").trim().match(yearRegex); if (m) return m[0]; } return null; };
  const findTableauYear = (entetes: Json[][]): string | null => { for (const row of entetes) { for (const cell of row || []) { const m = String(cell ?? "").match(yearRegex); if (m) return m[0]; } } return null; };
  for (const asData of withData) {
    const entetes = asData.entetes!; const donnees = asData.donnees!; const lastHeaderRow = entetes[entetes.length - 1]; const nbCols = lastHeaderRow.length;
    const tableauYear = findTableauYear(entetes);
    const yearBlocksThisTable = new Map<string, { headerCells: Json[], dataColumn: Json[] }[]>();
    for (let colIdx = 0; colIdx < nbCols; colIdx++) {
      const colYear = findColumnYear(entetes, colIdx); const headerCells = entetes.map(row => row[colIdx] ?? ""); const dataColumn = donnees.map(row => row[colIdx] ?? "");
      if (colIdx === 0 && !colYear) { if (!firstTextColumn) firstTextColumn = { header: headerCells, data: dataColumn }; continue; }
      if (colIdx === nbCols - 1 && !colYear) { if (!lastTextColumn) lastTextColumn = { header: headerCells, data: dataColumn }; continue; }
      const year = colYear || tableauYear; if (!year) continue;
      if (!yearBlocksThisTable.has(year)) yearBlocksThisTable.set(year, []);
      yearBlocksThisTable.get(year)!.push({ headerCells, dataColumn });
    }
    for (const [year, block] of yearBlocksThisTable) { if (!columnsByYear.has(year)) columnsByYear.set(year, block); }
  }
  const sortedYears = Array.from(columnsByYear.keys()).sort((a, b) => b.localeCompare(a));
  const flatColumns: { headerCells: Json[], dataColumn: Json[] }[] = [];
  for (const year of sortedYears) columnsByYear.get(year)!.forEach(col => flatColumns.push(col));
  const nbHeaderRows = withData[0].entetes!.length; const nbDataRows = withData[0].donnees!.length;
  const fusionEntetes: Json[][] = []; const fusionDonnees: Json[][] = [];
  for (let r = 0; r < nbHeaderRows; r++) { const row: Json[] = []; if (firstTextColumn) row.push(firstTextColumn.header[r]); for (const col of flatColumns) row.push(col.headerCells[r]); if (lastTextColumn && firstTextColumn !== lastTextColumn) row.push(lastTextColumn.header[r]); fusionEntetes.push(row); }
  for (let r = 0; r < nbDataRows; r++) { const row: Json[] = []; if (firstTextColumn) row.push(firstTextColumn.data[r]); for (const col of flatColumns) row.push(col.dataColumn[r]); if (lastTextColumn && firstTextColumn !== lastTextColumn) row.push(lastTextColumn.data[r]); fusionDonnees.push(row); }
  return { entetes: fusionEntetes, donnees: fusionDonnees, source: `Série fusionnée (${sortedYears.join(", ")})` };
};

export default function IndicateurPublicDetail() {
  const { id } = useParams(); const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true); const [indicateur, setIndicateur] = useState<IndicateurSummary | null>(null);
  const [serie, setSerie] = useState<SerieIndicateur[]>([]); const [strategyType, setStrategyType] = useState<StrategyType>("none");
  const [strategyActiveId, setStrategyActiveId] = useState<number | null>(null);
  const [strategyData, setStrategyData] = useState<IndicateurData | null>(null); const [strategySource, setStrategySource] = useState("");
  const [selectedYearData, setSelectedYearData] = useState<IndicateurData | null>(null); const [selectedYearSource, setSelectedYearSource] = useState("");
  const [fusionData, setFusionData] = useState<IndicateurData | null>(null); const [fusionSource, setFusionSource] = useState("");

  const viewYearParam = searchParams.get("year"); const viewYearId = viewYearParam ? Number(viewYearParam) : null;
  const isViewingYear = viewYearId !== null && !isNaN(viewYearId);
  const displayData = isViewingYear ? selectedYearData : (fusionData || strategyData);
  const displaySource = isViewingYear ? selectedYearSource : (fusionData ? fusionSource : strategySource);

  useEffect(() => { if (!id) return; const p = Number(id); if (!Number.isFinite(p)) return; setSelectedYearData(null); setSelectedYearSource(""); load(p); }, [id]);
  useEffect(() => { if (!isViewingYear || !viewYearId) { setSelectedYearData(null); setSelectedYearSource(""); return; } const t = serie.find(s => s.id === viewYearId); if (t) loadYearData(t); }, [viewYearId, serie]);

  const loadYearData = async (target: SerieIndicateur) => {
    setSelectedYearSource(`AS ${target.annee}`);
    const { data } = await supabase.from("tableaux_data").select("id, entetes, donnees").eq("id_tableau", target.id).maybeSingle();
    if (!data) { setSelectedYearData(null); return; }
    setSelectedYearData({ id: data.id, entetes: data.entetes as unknown as Json[][], donnees: data.donnees as unknown as Json[][] });
  };

  const load = async (indicateurId: number) => {
    setLoading(true); setFusionData(null); setFusionSource("");
    const [indRes, dataRes, liaisonsRes, rupturesRes] = await Promise.all([
      supabase.from("v_tableaux_complets").select("id, code, titre_fr, annuaire_annee, thematique_nom, unite_fr, source_fr, notes_fr").eq("id", indicateurId).maybeSingle(),
      supabase.from("tableaux_data").select("id, entetes, donnees").eq("id_tableau", indicateurId).maybeSingle(),
      supabase.from("v_series_temporelles").select("*"),
      supabase.from("tableaux_ruptures").select("id, id_tableau, annee_rupture, direction"),
    ]);
    const ind = indRes.data as unknown as IndicateurSummary | null; setIndicateur(ind);
    const currentData = dataRes.data ? { id: dataRes.data.id, entetes: dataRes.data.entetes as unknown as Json[][], donnees: dataRes.data.donnees as unknown as Json[][] } satisfies IndicateurData : null;
    const liaisons = (liaisonsRes.data || []) as unknown as SerieTemporelleRow[]; const ruptures = (rupturesRes.data || []) as Rupture[];
    const related = liaisons.filter(l => l.source_id === indicateurId || l.cible_id === indicateurId);

    // Strategy 1: Fusionne
    if (related.some(l => l.type_liaison === "fusionne")) {
      const chain = await buildChain(indicateurId, liaisons, ["fusionne"], ruptures);
      if (chain.length > 0) { setSerie(chain); setStrategyType("fusionne"); const mr = chain.reduce<SerieIndicateur|null>((p,c) => (!p||c.annee>p.annee)?c:p, null);
        if (mr) { setStrategyActiveId(mr.id); const df = await computeDynamicFusion(chain); if (df) { const obj = { id: 0, entetes: df.entetes, donnees: df.donnees }; setFusionData(obj); setFusionSource(df.source); setStrategyData(obj); setStrategySource(df.source); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; }
          const { data: rd } = await supabase.from("tableaux_data").select("id, entetes, donnees").eq("id_tableau", mr.id).maybeSingle();
          if (rd) { setStrategyData({ id: rd.id, entetes: rd.entetes as unknown as Json[][], donnees: rd.donnees as unknown as Json[][] }); setStrategySource(`AS ${mr.annee}`); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; } } } }

    // Strategy 2: Remplace
    if (related.some(l => l.type_liaison === "remplace")) {
      const chain = await buildChain(indicateurId, liaisons, ["remplace"], ruptures); setSerie(chain); setStrategyType("remplace");
      const mr = chain.reduce<SerieIndicateur|null>((p,c) => (!p||c.annee>p.annee)?c:p, null);
      if (mr) { setStrategyActiveId(mr.id); if (mr.id !== indicateurId) { const { data: rd } = await supabase.from("tableaux_data").select("id, entetes, donnees").eq("id_tableau", mr.id).maybeSingle(); if (rd) { setStrategyData({ id: rd.id, entetes: rd.entetes as unknown as Json[][], donnees: rd.donnees as unknown as Json[][] }); setStrategySource(`AS ${mr.annee} (remplace)`); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; } }
        setStrategyData(currentData); setStrategySource(ind?.annuaire_annee ? `AS ${ind.annuaire_annee}` : ""); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; } }

    // Strategy 3: Serie/Extension
    if (related.some(l => l.type_liaison === "serie_temporelle" || l.type_liaison === "equivalent" || l.type_liaison === "extension_horizontale")) {
      const chain = await buildChain(indicateurId, liaisons, ["serie_temporelle", "equivalent", "extension_horizontale"], ruptures); setSerie(chain); setStrategyType("serie");
      const mr = chain.reduce<SerieIndicateur|null>((p,c) => (!p||c.annee>p.annee)?c:p, null);
      if (mr) { setStrategyActiveId(mr.id); const df = await computeDynamicFusion(chain); if (df) { const obj = { id: 0, entetes: df.entetes, donnees: df.donnees }; setFusionData(obj); setFusionSource(df.source); setStrategyData(obj); setStrategySource(df.source); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; }
        const { data: rd } = await supabase.from("tableaux_data").select("id, entetes, donnees").eq("id_tableau", mr.id).maybeSingle();
        if (rd) { setStrategyData({ id: rd.id, entetes: rd.entetes as unknown as Json[][], donnees: rd.donnees as unknown as Json[][] }); setStrategySource(`AS ${mr.annee}`); setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`; return; } } }

    // Strategy 4: None
    setSerie([]); setStrategyType("none"); setStrategyActiveId(indicateurId); setStrategyData(currentData); setStrategySource(ind?.annuaire_annee ? `AS ${ind.annuaire_annee}` : "");
    setLoading(false); document.title = `${ind?.titre_fr||"Tableau"} • Annuaire Statistique`;
  };

  const serieLabel = useMemo(() => { switch(strategyType) { case "fusionne": return "Fusion"; case "remplace": return "Remplace"; case "serie": return "Série"; default: return null; } }, [strategyType]);
  const handleYearClick = (target: SerieIndicateur) => { if (isViewingYear && viewYearId === target.id) setSearchParams({}); else setSearchParams({ year: String(target.id) }); };
  const handleReturnToSerie = () => setSearchParams({});

  // --- Loading / NotFound ---
  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <nav className="glass-nav sticky top-0 z-50"><div className="section-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center"><BarChart3 className="h-4 w-4 text-white" /></div></Link>
        <Link to="/indicateurs" className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      </div></nav>
      <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#58061C]" /></div>
    </div>
  );
  if (!indicateur) return (
    <div className="min-h-screen bg-slate-50">
      <nav className="glass-nav sticky top-0 z-50"><div className="section-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center"><BarChart3 className="h-4 w-4 text-white" /></div></Link>
        <Link to="/indicateurs" className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      </div></nav>
      <div className="section-container py-16"><div className="glass-strong rounded-2xl p-16 text-center text-slate-600">Tableau non trouvé.</div></div>
    </div>
  );

  // --- Main render ---
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="section-container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20 group-hover:shadow-[0_0_30px_rgba(88,6,28,0.2)] transition-shadow">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 hidden sm:block">Annuaire Stat</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to={`/indicateurs?annuaire=${encodeURIComponent(indicateur.annuaire_annee || '')}&thematique=${encodeURIComponent(indicateur.thematique_nom || '')}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-[#58061C] hover:bg-[#58061C]/8 transition-all"><ArrowLeft className="h-4 w-4" /> Liste</Link>
          </div>
        </div>
      </nav>

      {/* Hero header with gradient */}
      <div className="bg-white border-b border-slate-200">
        <div className="section-container py-8">
          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20">{indicateur.code}</span>
            {indicateur.annuaire_annee && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CalendarDays className="h-3 w-3" /> AS {indicateur.annuaire_annee}
              </span>
            )}
            {indicateur.thematique_nom && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#CFA452]/10 text-[#7c5524] border border-[#CFA452]/30">
                {indicateur.thematique_nom}
              </span>
            )}
            {serieLabel && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                <Link2 className="h-3 w-3" />{serieLabel}
              </span>
            )}
          </div>
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-2">{indicateur.titre_fr || "Tableau"}</h1>
          {displaySource && <p className="text-sm text-slate-500">Source affichée : <span className="font-medium text-slate-700">{displaySource}</span></p>}
        </div>
      </div>

      <div className="section-container py-8 space-y-6">
        {/* Metadata cards */}
        {(indicateur.unite_fr || indicateur.source_fr || indicateur.notes_fr) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {indicateur.unite_fr && (
              <div className="bg-white border-2 border-[#58061C]/15 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#58061C]/15 flex items-center justify-center"><BarChart3 className="h-3.5 w-3.5 text-[#58061C]" /></div>
                  <span className="text-[11px] font-bold text-[#58061C] uppercase tracking-wider">Unité</span>
                </div>
                <p className="text-sm font-medium text-slate-900">{indicateur.unite_fr}</p>
              </div>
            )}
            {indicateur.source_fr && (
              <div className="bg-white border-2 border-emerald-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Database className="h-3.5 w-3.5 text-emerald-600" /></div>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Source</span>
                </div>
                <p className="text-sm text-slate-700">{indicateur.source_fr}</p>
              </div>
            )}
            {indicateur.notes_fr && (
              <div className="bg-white border-2 border-amber-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-amber-600" /></div>
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Notes</span>
                </div>
                <p className="text-sm text-slate-700">{highlightIndices(indicateur.notes_fr)}</p>
              </div>
            )}
          </div>
        )}

        {/* Serie navigation */}
        {serie.length > 1 && (
          <div className={`bg-white border-2 rounded-2xl p-6 ${isViewingYear ? 'border-amber-300 shadow-md shadow-amber-500/10' : fusionData ? 'border-[#58061C]/20 shadow-md shadow-indigo-500/10' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isViewingYear ? 'bg-amber-100 border border-amber-200' : 'bg-[#58061C]/15 border border-[#58061C]/20'}`}>
                  <Layers className={`h-4 w-4 ${isViewingYear ? 'text-amber-600' : 'text-[#58061C]'}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Série temporelle</h3>
                  <p className="text-xs text-slate-500">{serie.length} années disponibles</p>
                </div>
              </div>
              {isViewingYear && (
                <button onClick={handleReturnToSerie} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#58061C] bg-[#58061C]/8 border border-[#58061C]/20 hover:bg-[#58061C]/15 transition-colors">
                  <Layers className="h-3.5 w-3.5" /> Voir la série complète
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleReturnToSerie}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${!isViewingYear ? 'bg-gradient-to-r from-[#58061C] to-[#3B0211] text-white shadow-md shadow-[#58061C]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                <Layers className="h-3 w-3" /> {fusionData ? "Série fusionnée" : "Vue série"}
              </button>
              {serie.map(s => (
                <button key={s.id} onClick={() => handleYearClick(s)}
                  className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${isViewingYear && viewYearId === s.id ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25' : 'bg-slate-100 text-slate-600 hover:bg-[#58061C]/8 hover:text-[#58061C] border border-slate-200 hover:border-[#58061C]/20'}`}>
                  {s.annee}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Data tabs */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
          <Tabs defaultValue="tableau" className="w-full">
            <div className="border-b border-slate-200 px-6 pt-4">
              <TabsList className="bg-slate-100 rounded-xl p-1 h-auto mb-[-1px]">
                <TabsTrigger value="tableau" className="rounded-lg px-6 py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#58061C]">
                  <TableIcon className="h-4 w-4" /> Tableau
                </TabsTrigger>
                <TabsTrigger value="graphique" className="rounded-lg px-6 py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#58061C]">
                  <LineChart className="h-4 w-4" /> Graphique
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="tableau" className="p-6 pt-5">
              {!displayData ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-16 text-center">
                  <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Aucune donnée disponible</p>
                </div>
              ) : (
                <DataTableWithExport entetes={displayData.entetes} donnees={displayData.donnees} displaySource={displaySource} />
              )}
            </TabsContent>
            <TabsContent value="graphique" className="p-6 pt-5">
              {!displayData ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-16 text-center">
                  <LineChart className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Aucune donnée à visualiser</p>
                </div>
              ) : (
                <ChartBuilder entetes={displayData.entetes} donnees={displayData.donnees} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
