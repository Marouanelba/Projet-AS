import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { views } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Database, Search, BarChart3, CalendarDays, SortAsc, Filter } from "lucide-react";
import { normalizeThematiqueName } from "@/lib/thematique-utils";
import { getThematiqueIcon } from "@/lib/thematique-icons";
import { cleanIndicateurTitle, normalizeForComparison } from "@/lib/indicateur-utils";

interface TableauRow { id: number; code: string; titre_fr: string; annuaire_annee: string; thematique_nom: string; }
interface GroupedIndicator { key: string; titre_fr: string; code: string; years: TableauRow[]; }

export default function ThematiqueExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const thematiqueName = searchParams.get("thematique") || "";
  const [loading, setLoading] = useState(true);
  const [tableaux, setTableaux] = useState<TableauRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("code");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => { if (!thematiqueName) return; loadTableaux(); window.scrollTo(0, 0); document.title = `${thematiqueName} - Annuaire Statistique`; }, [thematiqueName]);
  useEffect(() => { setPage(0); }, [searchQuery, sortOrder]);

  const loadTableaux = async () => {
    setLoading(true);
    const allRows: TableauRow[] = []; let offset = 0; let hasMore = true;
    while (hasMore) {
      const data = await views.tableauxComplets({ select: 'id,code,titre_fr,annuaire_annee,thematique_nom', from: offset, to: offset + 999 });
      if (data && data.length > 0) { allRows.push(...(data as TableauRow[])); if (data.length < 1000) hasMore = false; else offset += 1000; } else hasMore = false;
    }
    setTableaux(allRows.filter(r => normalizeThematiqueName(r.thematique_nom || "") === thematiqueName));
    setLoading(false);
  };

  const filteredTableaux = useMemo(() => {
    if (!searchQuery.trim()) return tableaux;
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tableaux.filter(t => {
      const ti = (t.titre_fr || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return ti.includes(q) || (t.code || "").toLowerCase().includes(q);
    });
  }, [tableaux, searchQuery]);

  const groupedIndicators = useMemo<GroupedIndicator[]>(() => {
    const map = new Map<string, GroupedIndicator>();
    filteredTableaux.forEach(t => {
      const key = normalizeForComparison(cleanIndicateurTitle(t.titre_fr || ""));
      if (!map.has(key)) map.set(key, { key, titre_fr: t.titre_fr, code: t.code, years: [] });
      map.get(key)!.years.push(t);
    });
    const groups = Array.from(map.values()).map(g => {
      g.years.sort((a, b) => (b.annuaire_annee || "").localeCompare(a.annuaire_annee || ""));
      g.titre_fr = g.years[0].titre_fr; g.code = g.years[0].code; return g;
    });
    // Sort
    if (sortOrder === 'alpha') {
      groups.sort((a, b) => a.titre_fr.localeCompare(b.titre_fr));
    } else {
      groups.sort((a, b) => {
        const parseCode = (code: string) => { const m = code.match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [parseInt(m[1]), parseInt(m[2])] : [999, 999]; };
        const [a1, a2] = parseCode(a.code); const [b1, b2] = parseCode(b.code);
        if (a1 !== b1) return a1 - b1; return a2 - b2;
      });
    }
    return groups;
  }, [filteredTableaux, sortOrder]);

  const { Icon, colorClass } = getThematiqueIcon(thematiqueName);
  const totalPages = Math.ceil(groupedIndicators.length / PAGE_SIZE);
  const paginatedGroups = groupedIndicators.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  // Stats
  const uniqueYears = useMemo(() => Array.from(new Set(tableaux.map(t => t.annuaire_annee))).sort((a, b) => b.localeCompare(a)), [tableaux]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header immersif */}
      <div className="bg-white border-b border-slate-200">
        {/* Navbar */}
        <nav className="section-container">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/?tab=thematique#explorer")} className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Link to="/" className="flex items-center gap-2">
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero thématique */}
        <div className="section-container pb-8 pt-2">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colorClass} shadow-sm`}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{thematiqueName}</h1>
              <p className="text-slate-600 text-sm mt-1">
                {loading ? "Chargement..." : `${groupedIndicators.length} tableau${groupedIndicators.length > 1 ? "x" : ""} unique${groupedIndicators.length > 1 ? "s" : ""} • ${tableaux.length} entrées au total`}
              </p>
            </div>
          </div>

          {/* Stats mini */}
          {!loading && (
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#58061C]/8 border border-[#58061C]/20">
                <Database className="h-3.5 w-3.5 text-[#58061C]" />
                <span className="text-xs font-semibold text-[#58061C]">{groupedIndicators.length} tableaux</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#CFA452]/10 border border-[#CFA452]/30">
                <CalendarDays className="h-3.5 w-3.5 text-[#9a6e2e]" />
                <span className="text-xs font-semibold text-[#7c5524]">{uniqueYears.length} année{uniqueYears.length > 1 ? "s" : ""} ({uniqueYears[0]} → {uniqueYears[uniqueYears.length - 1]})</span>
              </div>
            </div>
          )}

          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Rechercher un tableau par nom ou code..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="input-field !pl-10 !h-11" />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-slate-200 bg-white h-11">
                <SortAsc className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Par code (3-1, 3-2...)</SelectItem>
                <SelectItem value="alpha">Alphabétique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="section-container py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-md">
              <Loader2 className="h-8 w-8 animate-spin text-[#58061C]" />
              <p className="text-sm font-medium text-slate-600">Chargement des tableaux...</p>
            </div>
          </div>
        ) : groupedIndicators.length === 0 ? (
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-16 text-center">
            <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">Aucun tableau trouvé</p>
            {searchQuery && <p className="text-sm text-slate-500">Essayez un autre terme de recherche</p>}
          </div>
        ) : (
          <>
            {/* Pagination top */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, groupedIndicators.length)} sur <span className="text-[#58061C] font-bold">{groupedIndicators.length}</span></p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 disabled:opacity-40">← Précédent</Button>
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 disabled:opacity-40">Suivant →</Button>
                </div>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedGroups.map(group => (
                <div key={group.key}
                  className="bg-white border-2 border-slate-200 rounded-2xl p-5 cursor-pointer hover:border-[#58061C]/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group h-full flex flex-col"
                  onClick={() => navigate(`/thematique/tableau/${group.years[0].id}?thematique=${encodeURIComponent(thematiqueName)}`)}>
                  {/* Title + arrow */}
                  <div className="flex items-start justify-between gap-3 mb-4 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#58061C] transition-colors">
                      {group.titre_fr}
                    </h4>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#58061C] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                  </div>
                  {/* Meta */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">{group.code}</span>
                      <span className="text-[11px] font-medium text-slate-500">{group.years.length} année{group.years.length > 1 ? "s" : ""}</span>
                    </div>
                    {/* Year pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {group.years.slice(0, 6).map(y => (
                        <span key={y.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/15">
                          {y.annuaire_annee}
                        </span>
                      ))}
                      {group.years.length > 6 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          +{group.years.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination bottom */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-6 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, groupedIndicators.length)} sur <span className="text-[#58061C] font-bold">{groupedIndicators.length}</span></p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => { setPage(Math.max(0, page - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page === 0} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 disabled:opacity-40">← Précédent</Button>
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => { setPage(Math.min(totalPages - 1, page + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page >= totalPages - 1} className="rounded-xl border-slate-300 px-4 hover:bg-[#58061C]/8 hover:border-[#58061C]/30 disabled:opacity-40">Suivant →</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
