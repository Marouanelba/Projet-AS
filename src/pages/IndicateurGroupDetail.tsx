import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { views, tableauxIndices, tableauxData } from "@/lib/api";
import { cleanIndicateurTitle, extractIndiceFromTitle, normalizeForComparison } from "@/lib/indicateur-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Loader2, Calendar, Table as TableIcon, Layers, LineChart, Home, ExternalLink } from "lucide-react";
import DataTableWithExport from "@/components/DataTableWithExport";
import ChartBuilder from "@/components/ChartBuilder";

interface IndicateurOccurrence { id: number; code: string; titre_fr: string; annuaire_annee: string; thematique_nom: string | null; unite_fr: string | null; source_fr: string | null; notes_fr: string | null; }
interface IndicateurData { id: number; entetes: any[][]; donnees: any[][]; }
type FusionInput = { id_indicateur: number; annee_as: string; entetes: any[][]; donnees: any[][]; };

const computeDynamicFusionAllColumns = (items: FusionInput[]): IndicateurData | null => {
  const withData = items.filter(i => Array.isArray(i.entetes) && Array.isArray(i.donnees));
  if (withData.length === 0) return null;
  withData.sort((a, b) => b.annee_as.localeCompare(a.annee_as));
  const maxHeaderRows = Math.max(...withData.map(i => i.entetes.length));
  const maxDataRows = Math.max(...withData.map(i => i.donnees.length));
  const columnsMap = new Map<string, { headerCells: any[]; dataColumn: any[] }>();
  let firstTextColumn: { headerCells: any[]; dataColumn: any[] } | null = null;
  let lastTextColumn: { headerCells: any[]; dataColumn: any[] } | null = null;
  const getH = (e: any[][], c: number): any[] => Array.from({ length: maxHeaderRows }, (_, r) => e[r]?.[c] ?? "");
  const getD = (d: any[][], c: number): any[] => Array.from({ length: maxDataRows }, (_, r) => d[r]?.[c] ?? "");
  for (const it of withData) {
    const lhr = it.entetes[it.entetes.length - 1] ?? []; const nbCols = Array.isArray(lhr) ? lhr.length : 0;
    for (let c = 0; c < nbCols; c++) {
      const cn = String(lhr[c] ?? "").trim();
      if (/^\d{4}$/.test(cn)) { if (!columnsMap.has(cn)) columnsMap.set(cn, { headerCells: getH(it.entetes, c), dataColumn: getD(it.donnees, c) }); }
      else { if (c === 0 && !firstTextColumn) firstTextColumn = { headerCells: getH(it.entetes, c), dataColumn: getD(it.donnees, c) }; if (c === nbCols - 1 && !lastTextColumn) lastTextColumn = { headerCells: getH(it.entetes, c), dataColumn: getD(it.donnees, c) }; }
    }
  }
  const sortedYears = Array.from(columnsMap.keys()).sort((a, b) => b.localeCompare(a));
  const fe: any[][] = []; const fd: any[][] = [];
  for (let r = 0; r < maxHeaderRows; r++) { const row: any[] = []; if (firstTextColumn) row.push(firstTextColumn.headerCells[r] ?? ""); for (const y of sortedYears) row.push(columnsMap.get(y)!.headerCells[r] ?? ""); if (lastTextColumn && lastTextColumn !== firstTextColumn) row.push(lastTextColumn.headerCells[r] ?? ""); fe.push(row); }
  for (let r = 0; r < maxDataRows; r++) { const row: any[] = []; if (firstTextColumn) row.push(firstTextColumn.dataColumn[r] ?? ""); for (const y of sortedYears) row.push(columnsMap.get(y)!.dataColumn[r] ?? ""); if (lastTextColumn && lastTextColumn !== firstTextColumn) row.push(lastTextColumn.dataColumn[r] ?? ""); fd.push(row); }
  return { id: 0, entetes: fe, donnees: fd };
};

export default function IndicateurGroupDetail() {
  const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams();
  const titreParam = searchParams.get("titre"); const significationParam = searchParams.get("signification"); const selectedYear = searchParams.get("year");
  const [loading, setLoading] = useState(true); const [occurrences, setOccurrences] = useState<IndicateurOccurrence[]>([]);
  const [selectedData, setSelectedData] = useState<IndicateurData | null>(null); const [selectedOccurrence, setSelectedOccurrence] = useState<IndicateurOccurrence | null>(null);
  const [loadingData, setLoadingData] = useState(false); const [fusionData, setFusionData] = useState<IndicateurData | null>(null); const [showFusion, setShowFusion] = useState(false);
  const [serieExists, setSerieExists] = useState(false);

  useEffect(() => { if (!titreParam) { setLoading(false); return; } loadOccurrences(titreParam, significationParam); }, [titreParam, significationParam]);
  useEffect(() => { if (!selectedYear || occurrences.length === 0) return; const occ = occurrences.find(o => o.annuaire_annee === selectedYear); if (occ) loadData(occ); }, [selectedYear, occurrences]);

  const loadOccurrences = async (titre: string, signification: string | null) => {
    setLoading(true);
    try {
      const fetchAll = async () => {
        const rows: any[] = [];
        let off = 0;
        let more = true;
        while (more) {
          const data = await views.tableauxComplets({ select: 'id,code,titre_fr,annuaire_annee,thematique_nom,unite_fr,source_fr,notes_fr', from: off, to: off + 999 });
          if (data && data.length > 0) { rows.push(...data); off += 1000; more = data.length === 1000; } else more = false;
        }
        return rows;
      };
      const [allT, indicesData] = await Promise.all([fetchAll(), tableauxIndices.getAll(0, 99999)]);
      if (!allT || allT.length === 0) { setLoading(false); return; }
      const indicesMap = new Map<number, Map<string, string>>(); (indicesData || []).forEach((idx: any) => { if (idx.signification_fr) { if (!indicesMap.has(idx.id_tableau)) indicesMap.set(idx.id_tableau, new Map()); indicesMap.get(idx.id_tableau)!.set(idx.code_indice, idx.signification_fr); } });
      const titreN = normalizeForComparison(titre);
      const matching = allT.filter(ind => { const ct = cleanIndicateurTitle(ind.titre_fr || "", { removeIndices: true }); if (normalizeForComparison(ct) !== titreN) return false; if (signification) { const indice = extractIndiceFromTitle(ind.titre_fr || ""); if (!indice) return false; const im = indicesMap.get(ind.id); if (!im) return false; return im.get(indice)?.toLowerCase().trim() === signification.toLowerCase().trim(); } return true; }) as IndicateurOccurrence[];
      matching.sort((a, b) => b.annuaire_annee.localeCompare(a.annuaire_annee)); setOccurrences(matching);
      await checkSerie(matching); setLoading(false);
    } catch (err) {
      console.error("Erreur chargement occurrences:", err);
      setLoading(false);
    }
  };

  const checkSerie = async (occs: IndicateurOccurrence[]) => {
    if (occs.length < 2) { setSerieExists(false); return; }
    const ids = occs.map(o => o.id);
    try {
      const liaisons = await views.seriesTemporelles(0, 99999);
      if (!liaisons) { setSerieExists(false); return; }
      const rel = liaisons.filter(l => (l.source_id && ids.includes(l.source_id)) || (l.cible_id && ids.includes(l.cible_id)));
      if (rel.length === 0) { setSerieExists(false); return; }
      const linkedIds = new Set<number>(); rel.forEach(l => { if (l.source_id) linkedIds.add(l.source_id); if (l.cible_id) linkedIds.add(l.cible_id); });
      const connOccs = occs.filter(o => linkedIds.has(o.id));
      if (connOccs.length >= 2) {
        const rows = await tableauxData.getByTableaux(connOccs.map(o => o.id));
        if (rows && rows.length > 0) { const yearById = new Map(connOccs.map(o => [o.id, o.annuaire_annee])); const fi: FusionInput[] = rows.map((r: any) => ({ id_indicateur: r.id_tableau, annee_as: yearById.get(r.id_tableau) || "", entetes: r.entetes, donnees: r.donnees })).filter(x => !!x.annee_as); setFusionData(computeDynamicFusionAllColumns(fi)); } else setFusionData(null);
      } else setFusionData(null);
      setSerieExists(true);
    } catch (err) {
      console.error("Erreur vérification série:", err);
      setSerieExists(false);
    }
  };

  const loadData = async (occ: IndicateurOccurrence) => {
    setLoadingData(true); setSelectedOccurrence(occ); setShowFusion(false);
    try {
      const data = await tableauxData.getByTableau(occ.id);
      if (data) setSelectedData({ id: data.id, entetes: data.entetes as unknown as any[][], donnees: data.donnees as unknown as any[][] }); else setSelectedData(null);
    } catch (err) {
      console.error("Erreur chargement données:", err);
      setSelectedData(null);
    }
    setLoadingData(false);
  };
  const handleYearSelect = (year: string) => { const bp: Record<string, string> = { titre: titreParam || "" }; if (significationParam) bp.signification = significationParam; if (year === selectedYear) { setSearchParams(bp); setSelectedData(null); setSelectedOccurrence(null); setShowFusion(false); } else setSearchParams({ ...bp, year }); };
  const handleShowFusion = () => { setShowFusion(true); setSelectedOccurrence(null); const bp: Record<string, string> = { titre: titreParam || "" }; if (significationParam) bp.signification = significationParam; setSearchParams(bp); };
  const cleanTitre = useMemo(() => occurrences.length > 0 ? cleanIndicateurTitle(occurrences[0].titre_fr, { removeIndices: true }) : titreParam || "Tableau", [occurrences, titreParam]);
  const displayData = showFusion ? fusionData : selectedData;
  const displaySource = showFusion ? "Série fusionnée" : selectedOccurrence ? `AS ${selectedOccurrence.annuaire_annee}` : "";

  if (loading) return (<div className="min-h-screen bg-slate-50"><nav className="glass-nav sticky top-0 z-50"><div className="section-container flex items-center justify-between h-16"><Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center"><BarChart3 className="h-4 w-4 text-white" /></div></Link><Link to="/indicateurs" className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Retour</Link></div></nav><div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#58061C]" /></div></div>);
  if (!titreParam || occurrences.length === 0) return (<div className="min-h-screen bg-slate-50"><nav className="glass-nav sticky top-0 z-50"><div className="section-container flex items-center justify-between h-16"><Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center"><BarChart3 className="h-4 w-4 text-white" /></div></Link><Link to="/indicateurs" className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Retour</Link></div></nav><div className="section-container py-16"><div className="glass-strong rounded-2xl p-16 text-center text-slate-600">Aucun tableau trouvé pour "{titreParam}".</div></div></div>);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="glass-nav sticky top-0 z-50">
        <div className="section-container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20"><BarChart3 className="h-4 w-4 text-white" /></div><span className="text-lg font-bold text-slate-900 hidden sm:block">Annuaire Stat</span></Link>
          <div className="flex items-center gap-2"><Link to="/" className="btn-ghost text-sm"><Home className="h-4 w-4" /></Link><Link to="/indicateurs" className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Liste</Link></div>
        </div>
      </nav>

      <div className="section-container py-8">
        {/* Title */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-2">{cleanTitre}</h1>
          <p className="text-slate-600 text-sm">{occurrences.length} année(s) disponible(s)</p>
        </div>

        {/* Year selector */}
        <div className="glass-strong rounded-2xl p-6 mb-8 animate-fade-in-up animate-delay-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#58061C]/8 border border-[#58061C]/15 flex items-center justify-center"><Calendar className="h-4 w-4 text-[#58061C]" /></div>
              <h3 className="text-sm font-bold text-slate-900">Sélectionner une année</h3>
            </div>
            {serieExists && fusionData && (
              <button onClick={handleShowFusion} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${showFusion ? 'bg-[#58061C] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-[#58061C]/8 hover:text-[#58061C] border border-slate-200'}`}>
                <Layers className="h-3 w-3" /> Série fusionnée
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {occurrences.map(occ => (
              <button key={occ.id} onClick={() => handleYearSelect(occ.annuaire_annee)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${selectedYear === occ.annuaire_annee ? 'bg-[#58061C] text-white shadow-sm shadow-[#58061C]/20' : 'bg-slate-100 text-slate-600 hover:bg-[#58061C]/8 hover:text-[#58061C] border border-slate-200 hover:border-[#58061C]/20'}`}>
                {occ.annuaire_annee}
              </button>
            ))}
          </div>
          {selectedOccurrence && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
              <span className="text-xs text-slate-500">Affichage: AS {selectedOccurrence.annuaire_annee}</span>
              <a href={`/indicateurs/${selectedOccurrence.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#58061C] hover:text-[#58061C] font-medium flex items-center gap-1">Détail <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
        </div>

        {/* Data */}
        {(displayData || loadingData) ? (
          <div className="animate-fade-in-up animate-delay-200">
            <Tabs defaultValue="tableau" className="w-full">
              <TabsList className="glass-strong rounded-xl p-1.5 h-auto mb-6">
                <TabsTrigger value="tableau" className="rounded-lg px-5 py-2.5 text-sm font-medium gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"><TableIcon className="h-4 w-4" /> Tableau</TabsTrigger>
                <TabsTrigger value="graphique" className="rounded-lg px-5 py-2.5 text-sm font-medium gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"><LineChart className="h-4 w-4" /> Graphique</TabsTrigger>
              </TabsList>
              <TabsContent value="tableau">{loadingData ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#58061C]" /></div> : displayData ? <DataTableWithExport entetes={displayData.entetes} donnees={displayData.donnees} displaySource={displaySource} /> : <div className="glass-strong rounded-2xl p-12 text-center text-slate-500">Sélectionnez une année.</div>}</TabsContent>
              <TabsContent value="graphique">{displayData ? <ChartBuilder entetes={displayData.entetes} donnees={displayData.donnees} /> : <div className="glass-strong rounded-2xl p-12 text-center text-slate-500">Aucune donnée.</div>}</TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="glass-strong rounded-2xl p-16 text-center text-slate-500 animate-fade-in-up animate-delay-200">Sélectionnez une année ci-dessus pour afficher les données.</div>
        )}
      </div>
    </div>
  );
}
