import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { views, tableauxIndices } from '@/lib/api';
import { normalizeThematiqueName } from '@/lib/thematique-utils';
import { cleanIndicateurTitle, extractIndiceFromTitle, normalizeForComparison, normalizeCode, generateGroupKey } from '@/lib/indicateur-utils';
import { getThematiqueBadgeColor } from '@/lib/thematique-icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Search, Loader2, LogIn, Home, Link2, ArrowRight, ArrowLeft, Database, X } from 'lucide-react';

interface Indicateur { id: number; code: string; titre_fr: string; annuaire_annee: string; thematique_nom: string; }
interface IndiceSignification { id_tableau: number; code_indice: string; signification_fr: string | null; }
interface IndicateurDisplay { id: number; code: string; titreClean: string; titreOriginal: string; annuaireAnnee: string; thematiqueClean: string; thematiqueOriginal: string; hasSerie: boolean; indiceInTitre: string | null; significationIndice: string | null; }

const Indicateurs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<IndicateurDisplay[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const thematiqueFromUrl = searchParams.get('thematique');
  const annuaireFromUrl = searchParams.get('annuaire');
  const [selectedAnnuaire, setSelectedAnnuaire] = useState<string>(annuaireFromUrl || 'tous');
  const [selectedThematique, setSelectedThematique] = useState<string>(thematiqueFromUrl ? normalizeThematiqueName(thematiqueFromUrl) : 'tous');

  useEffect(() => { setSelectedThematique(thematiqueFromUrl ? normalizeThematiqueName(thematiqueFromUrl) : 'tous'); setSelectedAnnuaire(annuaireFromUrl || 'tous'); }, [thematiqueFromUrl, annuaireFromUrl]);

  const syncFiltersToUrl = (annuaire: string, thematique: string) => {
    const p = new URLSearchParams(searchParams);
    if (annuaire !== 'tous') p.set('annuaire', annuaire); else p.delete('annuaire');
    if (thematique !== 'tous') p.set('thematique', thematique); else p.delete('thematique');
    setSearchParams(p, { replace: true });
  };
  const handleAnnuaireChange = (v: string) => { setSelectedAnnuaire(v); syncFiltersToUrl(v, selectedThematique); };
  const handleThematiqueChange = (v: string) => { setSelectedThematique(v); syncFiltersToUrl(selectedAnnuaire, v); };

  useEffect(() => { fetchIndicateurs(); window.scrollTo(0, 0); document.title = "Tableaux statistiques - Annuaire Statistique"; }, []);

  const fetchIndicateurs = async () => {
    setLoading(true);
    try {
      // Step 1: Load main data first (fastest)
      const fetchAll = async () => { const rows: Indicateur[] = []; let offset = 0; while (true) { const data = await views.tableauxComplets({ select: 'id,code,titre_fr,annuaire_annee,thematique_nom', order_by: 'id', order_dir: 'ASC', from: offset, to: offset + 999 }); if (!data || data.length === 0) break; rows.push(...(data as Indicateur[])); if (data.length < 1000) break; offset += 1000; } return rows; };
      const allTableaux = await fetchAll();
      if (!allTableaux || allTableaux.length === 0) { setLoading(false); return; }

      // Show data immediately without series/indices info
      const quickProcessed: IndicateurDisplay[] = allTableaux.map((ind) => ({ id: ind.id, code: ind.code, titreClean: cleanIndicateurTitle(ind.titre_fr, { removeIndices: true }), titreOriginal: ind.titre_fr, annuaireAnnee: ind.annuaire_annee, thematiqueClean: normalizeThematiqueName(ind.thematique_nom), thematiqueOriginal: ind.thematique_nom || 'Non classé', hasSerie: false, indiceInTitre: extractIndiceFromTitle(ind.titre_fr), significationIndice: null }));
      quickProcessed.sort((a, b) => { const t = a.titreClean.localeCompare(b.titreClean); return t !== 0 ? t : b.annuaireAnnee.localeCompare(a.annuaireAnnee); });
      setIndicateurs(quickProcessed);
      setLoading(false);

      // Step 2: Enrich with series/indices in background
      let seriesData: any[] = [];
      let indicesData: IndiceSignification[] = [];
      try {
        [seriesData, indicesData] = await Promise.all([views.seriesTemporelles(0, 99999), tableauxIndices.getAll(0, 99999)]);
      } catch { seriesData = []; indicesData = []; }
      const linkedIds = new Set<number>(); (seriesData || []).forEach((l: any) => { if (typeof l.source_id === 'number') linkedIds.add(l.source_id); if (typeof l.cible_id === 'number') linkedIds.add(l.cible_id); });
      const indicesMap = new Map<string, string>(); (indicesData || []).forEach((idx: IndiceSignification) => { if (idx.signification_fr) indicesMap.set(`${idx.id_tableau}|${idx.code_indice}`, idx.signification_fr); });
      // Update with enriched data
      setIndicateurs(prev => prev.map(ind => ({ ...ind, hasSerie: linkedIds.has(ind.id), significationIndice: ind.indiceInTitre ? (indicesMap.get(`${ind.id}|${ind.indiceInTitre}`) || null) : null })));
    } catch {
      setIndicateurs([]);
      setLoading(false);
    }
  };

  const annuairesDisponibles = useMemo(() => { let f = indicateurs; if (selectedThematique !== 'tous') f = f.filter(i => i.thematiqueClean === selectedThematique); return Array.from(new Set(f.map(i => i.annuaireAnnee))).sort((a, b) => b.localeCompare(a)); }, [indicateurs, selectedThematique]);
  const thematiquesDisponibles = useMemo(() => { let f = indicateurs; if (selectedAnnuaire !== 'tous') f = f.filter(i => i.annuaireAnnee === selectedAnnuaire); return Array.from(new Set(f.map(i => i.thematiqueClean))).sort((a, b) => a.localeCompare(b)); }, [indicateurs, selectedAnnuaire]);

  const filteredIndicateurs = useMemo(() => {
    return indicateurs.filter(ind => {
      if (selectedAnnuaire !== 'tous' && ind.annuaireAnnee !== selectedAnnuaire) return false;
      if (selectedThematique !== 'tous' && ind.thematiqueClean !== selectedThematique) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase().trim(); const sn = normalizeForComparison(searchTerm); const sc = normalizeCode(searchTerm);
        const mt = ind.titreClean.toLowerCase().includes(s) || ind.titreOriginal.toLowerCase().includes(s) || normalizeForComparison(ind.titreClean).includes(sn);
        const mc = normalizeCode(ind.code).includes(sc); const mth = ind.thematiqueClean.toLowerCase().includes(s);
        const ma = ind.annuaireAnnee.includes(s) || `as ${ind.annuaireAnnee}`.includes(s);
        if (!mt && !mc && !mth && !ma) return false;
      }
      return true;
    });
  }, [indicateurs, selectedAnnuaire, selectedThematique, searchTerm]);

  const groupedByTitre = useMemo(() => {
    if (selectedAnnuaire !== 'tous') return null;
    const groups = new Map<string, IndicateurDisplay[]>(); filteredIndicateurs.forEach(ind => { const key = generateGroupKey(ind.titreClean, ind.significationIndice); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(ind); });
    const titreGroupCount = new Map<string, number>(); groups.forEach((_, key) => { const tk = key.split('|||')[0]; titreGroupCount.set(tk, (titreGroupCount.get(tk) || 0) + 1); });
    return Array.from(groups.entries()).map(([key, items]) => { const tk = key.split('|||')[0]; return { titreClean: items[0].titreClean, thematiqueClean: items[0].thematiqueClean, significationIndice: (titreGroupCount.get(tk) || 0) > 1 ? items[0].significationIndice : null, occurrences: items.sort((a, b) => b.annuaireAnnee.localeCompare(a.annuaireAnnee)) }; });
  }, [filteredIndicateurs, selectedAnnuaire]);

  const handleIndicateurClick = (id: number) => navigate(`/indicateurs/${id}`);
  const handleGroupClick = (titreClean: string, signification: string | null) => { const e = encodeURIComponent(titreClean); navigate(signification ? `/indicateurs/groupe?titre=${e}&signification=${encodeURIComponent(signification)}` : `/indicateurs/groupe?titre=${e}`); };
  const hasActiveFilters = selectedAnnuaire !== 'tous' || selectedThematique !== 'tous' || searchTerm.trim() !== '';
  const clearFilters = () => { setSelectedAnnuaire('tous'); setSelectedThematique('tous'); setSearchTerm(''); setSearchParams({}, { replace: true }); };

  // Sort
  const [sortOrder, setSortOrder] = useState<string>('alpha');

  // Pagination
  const PAGE_SIZE = 60;
  const [page, setPage] = useState(0);
  // Reset page when filters change
  useEffect(() => { setPage(0); }, [selectedAnnuaire, selectedThematique, searchTerm, sortOrder]);

  // Apply sort
  const sortedGroups = useMemo(() => {
    if (!groupedByTitre) return null;
    const sorted = [...groupedByTitre];
    if (sortOrder === 'code') {
      sorted.sort((a, b) => {
        const parseCode = (code: string) => { const m = code.match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [parseInt(m[1]), parseInt(m[2])] : [999, 999]; };
        const codeA = a.occurrences[0]?.code || ''; const codeB = b.occurrences[0]?.code || '';
        const [a1, a2] = parseCode(codeA); const [b1, b2] = parseCode(codeB);
        if (a1 !== b1) return a1 - b1; return a2 - b2;
      });
    } else {
      sorted.sort((a, b) => a.titreClean.localeCompare(b.titreClean));
    }
    return sorted;
  }, [groupedByTitre, sortOrder]);

  const sortedIndividual = useMemo(() => {
    if (groupedByTitre) return null;
    const sorted = [...filteredIndicateurs];
    if (sortOrder === 'code') {
      sorted.sort((a, b) => {
        const parseCode = (code: string) => { const m = code.match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [parseInt(m[1]), parseInt(m[2])] : [999, 999]; };
        const [a1, a2] = parseCode(a.code); const [b1, b2] = parseCode(b.code);
        if (a1 !== b1) return a1 - b1; return a2 - b2;
      });
    } else {
      sorted.sort((a, b) => a.titreClean.localeCompare(b.titreClean));
    }
    return sorted;
  }, [filteredIndicateurs, groupedByTitre, sortOrder]);

  const totalItems = sortedGroups ? sortedGroups.length : (sortedIndividual?.length || 0);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const paginatedGroups = sortedGroups ? sortedGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : null;
  const paginatedIndividual = sortedIndividual ? sortedIndividual.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="section-container">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20 group-hover:shadow-[0_0_30px_rgba(88,6,28,0.2)] transition-shadow">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900 hidden sm:block">Annuaire Stat</span>
              </Link>
              <span className="text-slate-300 hidden sm:block">/</span>
              <span className="text-sm font-semibold text-[#58061C] hidden sm:block">Tableaux statistiques</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/auth" className="btn-primary text-sm !px-4 !py-2"><LogIn className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="section-container py-8">
        {/* Page header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tableaux statistiques</h1>
          <p className="text-slate-600">
            {loading ? 'Chargement...' : <>{filteredIndicateurs.length} résultat{filteredIndicateurs.length > 1 ? 's' : ''}{hasActiveFilters && <span className="text-[#58061C] font-medium"> (filtré)</span>}</>}
          </p>
        </div>

        {/* Filters */}
        <div className="glass-strong rounded-2xl p-5 mb-8 animate-fade-in-up animate-delay-100">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Rechercher par titre ou code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field !pl-10" />
            </div>
            {/* Annuaire */}
            <Select value={selectedAnnuaire} onValueChange={handleAnnuaireChange}>
              <SelectTrigger className="w-full lg:w-[180px] rounded-xl border-slate-200 bg-white h-[42px]">
                <SelectValue placeholder="Annuaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les annuaires</SelectItem>
                {annuairesDisponibles.map(a => <SelectItem key={a} value={a}>AS {a}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Thematique */}
            <Select value={selectedThematique} onValueChange={handleThematiqueChange}>
              <SelectTrigger className="w-full lg:w-[220px] rounded-xl border-slate-200 bg-white h-[42px]">
                <SelectValue placeholder="Thématique" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Toutes les thématiques</SelectItem>
                {thematiquesDisponibles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Sort */}
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full lg:w-[170px] rounded-xl border-slate-200 bg-white h-[42px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alpha">Alphabétique</SelectItem>
                <SelectItem value="code">Par code</SelectItem>
              </SelectContent>
            </Select>
            {/* Clear */}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-ghost text-sm flex items-center gap-1.5 text-slate-500 hover:text-red-600">
                <X className="h-3.5 w-3.5" /> Effacer
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#58061C]" />
              <p className="text-sm text-slate-600">Chargement des tableaux...</p>
            </div>
          </div>
        ) : filteredIndicateurs.length === 0 ? (
          <div className="glass-strong rounded-2xl p-16 text-center">
            <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-3">Aucun tableau trouvé</p>
            {hasActiveFilters && <button onClick={clearFilters} className="text-sm text-[#58061C] hover:text-[#58061C] font-medium">Effacer les filtres</button>}
          </div>
        ) : paginatedGroups ? (
          <>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedGroups.map((g, idx) => (
                <div key={`${g.titreClean}-${g.significationIndice || idx}`} className="card-interactive p-5 h-full" onClick={() => handleGroupClick(g.titreClean, g.significationIndice)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">{g.titreClean}</h4>
                    <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                  </div>
                  {g.significationIndice && <p className="text-xs text-slate-500 mb-2 italic line-clamp-1">{g.significationIndice}</p>}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getThematiqueBadgeColor(g.thematiqueClean)}`}>{g.thematiqueClean}</span>
                    {g.occurrences.slice(0, 4).map(occ => (
                      <span key={occ.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/15">{occ.annuaireAnnee}</span>
                    ))}
                    {g.occurrences.length > 4 && <span className="text-[10px] text-slate-500">+{g.occurrences.length - 4}</span>}
                    {g.occurrences.some(o => o.hasSerie) && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#CFA452]/10 text-[#7c5524] border border-[#CFA452]/20"><Link2 className="h-2.5 w-2.5" />Série</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />}
          </>
        ) : (
          <>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedIndividual!.map(ind => (
                <div key={ind.id} className="card-interactive p-5 h-full" onClick={() => handleIndicateurClick(ind.id)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 flex-1">{ind.titreClean}</h4>
                    <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">{ind.code}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getThematiqueBadgeColor(ind.thematiqueClean)}`}>{ind.thematiqueClean}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/15">{ind.annuaireAnnee}</span>
                    {ind.hasSerie && <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#CFA452]/10 text-[#7c5524] border border-[#CFA452]/20"><Link2 className="h-2.5 w-2.5" />Série</span>}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />}
          </>
        )}
      </div>
    </div>
  );
};

// Pagination component
function Pagination({ page, totalPages, setPage, totalItems, pageSize }: { page: number; totalPages: number; setPage: (p: number) => void; totalItems: number; pageSize: number }) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
      <p className="text-sm text-slate-500">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalItems)} sur {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Précédent
        </button>
        <span className="text-sm text-slate-600 px-2">{page + 1} / {totalPages}</span>
        <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
          className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Suivant
        </button>
      </div>
    </div>
  );
}

export default Indicateurs;
