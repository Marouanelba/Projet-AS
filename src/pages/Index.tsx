import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { annuaires as annuairesApi, thematiques as thematiquesApi } from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, ArrowRight, Database, FileText, BarChart3, CalendarDays,
  BookOpen, Layers, LogIn, Zap, Search, TrendingUp, Globe, Shield,
  ChevronDown, ExternalLink,
} from "lucide-react";
import { normalizeThematiqueName } from "@/lib/thematique-utils";
import { getThematiqueIcon } from "@/lib/thematique-icons";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface Annuaire { id: number; annee: string; }
interface Thematique { id: number; nom_fr: string; code: string; id_annuaire: number; nb_indicateurs: number | null; }

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [annuaires, setAnnuaires] = useState<Annuaire[]>([]);
  const [selectedAnnuaire, setSelectedAnnuaire] = useState<string>("");
  const [thematiques, setThematiques] = useState<Thematique[]>([]);
  const [searchParamsIndex] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParamsIndex.get("tab") || "annuaire");

  useEffect(() => { fetchData(); }, []);

  // Scroll to explorer section if hash is present
  useEffect(() => {
    document.title = "Annuaire Statistique du Maroc - HCP";
    if (window.location.hash === '#explorer') {
      setTimeout(() => {
        document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [annData, themData] = await Promise.all([
        annuairesApi.getAll('desc'),
        thematiquesApi.getAll({ include_count: true }),
      ]);
      const withRealCount = themData.map((t: any) => ({ ...t, nb_indicateurs: t.tableaux_count || 0 }));
      const annuaireIdsWithData = new Set(withRealCount.filter((t: any) => t.nb_indicateurs > 0).map((t: any) => t.id_annuaire));
      const filteredAnnuaires = annData.filter((a: Annuaire) => annuaireIdsWithData.has(a.id));
      setAnnuaires(filteredAnnuaires);
      if (filteredAnnuaires.length > 0) setSelectedAnnuaire(filteredAnnuaires[0].id.toString());
      setThematiques(withRealCount as Thematique[]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const thematiquesForAnnuaire = useMemo(() => {
    if (!selectedAnnuaire) return [];
    const annuaireId = parseInt(selectedAnnuaire);
    return thematiques.filter((t) => t.id_annuaire === annuaireId && (t.nb_indicateurs || 0) > 0).sort((a, b) => a.nom_fr.localeCompare(b.nom_fr));
  }, [thematiques, selectedAnnuaire]);

  const handleThematiqueClick = (thematique: Thematique) => {
    const cleanName = normalizeThematiqueName(thematique.nom_fr);
    const annee = annuaires.find((a) => a.id.toString() === selectedAnnuaire)?.annee || "";
    navigate(`/indicateurs?thematique=${encodeURIComponent(cleanName)}&annuaire=${encodeURIComponent(annee)}`);
  };

  const selectedAnnee = annuaires.find((a) => a.id.toString() === selectedAnnuaire)?.annee || "";
  const totalIndicateurs = thematiquesForAnnuaire.reduce((sum, t) => sum + (t.nb_indicateurs || 0), 0);
  const totalThematiques = thematiquesForAnnuaire.length;
  const totalAnnuaires = annuaires.length;

  return (
    <div className="min-h-screen bg-white">

      {/* ===== NAVBAR FIXE ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 shadow-sm">
        <div className="section-container">
          <div className="flex items-center justify-between h-16 lg:h-18">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-lg shadow-[#58061C]/20 group-hover:shadow-[0_0_30px_rgba(88,6,28,0.2)] transition-shadow duration-500">
                <BarChart3 className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-extrabold text-slate-900">Annuaire Statistique</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <a href="#explorer" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#58061C] rounded-lg hover:bg-[#58061C]/8 transition-all">Explorer</a>
              <a href="#apropos" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#58061C] rounded-lg hover:bg-[#58061C]/8 transition-all">À propos</a>
              <Link to="/indicateurs" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#58061C] rounded-lg hover:bg-[#58061C]/8 transition-all">Tableaux</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth" className="btn-primary text-sm !px-5 !py-2">
                <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Connexion</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#58061C]/5 via-white to-white" />
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-hero-glow" />
        <div className="absolute top-1/4 left-[10%] w-[500px] h-[500px] bg-[#58061C]/8 rounded-full blur-[100px] animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-[10%] w-[400px] h-[400px] bg-[#CFA452]/100/8 rounded-full blur-[100px] animate-pulse-soft animate-delay-500" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.3]" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 section-container text-center py-20 sm:py-32">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#58061C]/15/80 border border-[#58061C]/20 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#58061C] animate-pulse" />
            <span className="text-sm font-semibold text-[#58061C]">Haut-Commissariat au Plan du Maroc</span>
          </motion.div>

          {/* Title */}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] mb-6 text-slate-900">
            L'annuaire statistique
            <br />
            <span className="bg-gradient-to-r from-[#58061C] via-[#58061C] to-[#CFA452] bg-clip-text text-transparent">
              du Maroc
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Accédez à l'ensemble des données statistiques nationales. Explorez par thématique, consultez les séries temporelles et exportez en un clic.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/indicateurs" className="btn-primary text-base !px-8 !py-4 flex items-center gap-2.5 group w-full sm:w-auto justify-center">
              Explorer les données
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
            </Link>
            <a href="#explorer" onClick={() => setActiveTab("thematique")} className="btn-secondary text-base !px-8 !py-4 flex items-center gap-2.5 w-full sm:w-auto justify-center">
              <Layers className="h-4.5 w-4.5" />
              Voir les thématiques
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
            <StatCard value={totalIndicateurs.toLocaleString()} label="Tableaux" icon={BarChart3} />
            <StatCard value={String(totalThematiques)} label="Thématiques" icon={Layers} />
            <StatCard value={String(totalAnnuaires)} label="Annuaires" icon={BookOpen} />
            <StatCard value={selectedAnnee || "—"} label="Dernière année" icon={CalendarDays} />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <a href="#explorer" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-400 hover:text-[#58061C] transition-colors animate-float">
          <span className="text-xs font-medium">Découvrir</span>
          <ChevronDown size={20} />
        </a>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="apropos" className="py-20 sm:py-28 bg-white border-b border-slate-100">
        <div className="section-container">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 mb-4">
              <Zap className="text-emerald-500" size={12} />
              <span className="text-xs font-semibold text-emerald-700">Pourquoi cette plateforme</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Données fiables, accès simplifié</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Une plateforme conçue pour rendre les statistiques nationales accessibles à tous.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              icon={TrendingUp}
              iconColor="from-[#58061C]/20 to-[#3B0211]/10 border-[#58061C]/20 text-[#58061C]"
              title="Séries temporelles"
              description="Comparez les données sur plusieurs années grâce aux liaisons automatiques entre annuaires."
            />
            <FeatureCard
              icon={Globe}
              iconColor="from-[#CFA452]-600/20 to-[#CFA452]/10 border-[#CFA452]/30 text-[#9a6e2e]"
              title="Données nationales"
              description="Toutes les thématiques couvertes : population, économie, agriculture, éducation, santé et plus."
            />
            <FeatureCard
              icon={Shield}
              iconColor="from-emerald-600/20 to-emerald-500/10 border-emerald-200 text-emerald-600"
              title="Source officielle"
              description="Données issues du Haut-Commissariat au Plan, mises à jour régulièrement."
            />
          </div>
        </div>
      </section>

      {/* ===== EXPLORER SECTION ===== */}
      <section id="explorer" className="py-20 sm:py-28 bg-slate-50">
        <div className="section-container">
          {/* Section header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#58061C]/8 border border-[#58061C]/20 mb-4">
              <Database className="text-[#58061C]" size={12} />
              <span className="text-xs font-semibold text-[#58061C]">Explorer les données</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Thématiques disponibles</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Sélectionnez un annuaire pour découvrir les tableaux statistiques par domaine.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-10">
              <TabsList className="bg-white border-2 border-slate-200 rounded-2xl p-1.5 h-auto shadow-sm">
                <TabsTrigger value="annuaire" className="rounded-xl px-6 py-3 text-sm font-semibold gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#58061C] data-[state=active]:to-[#3B0211] data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
                  <BookOpen className="h-4 w-4" /> Par Annuaire
                </TabsTrigger>
                <TabsTrigger value="thematique" className="rounded-xl px-6 py-3 text-sm font-semibold gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#58061C] data-[state=active]:to-[#3B0211] data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
                  <Layers className="h-4 w-4" /> Vue par Thématique
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="annuaire">
              {/* Annuaire selector */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Thématiques</h3>
                  <p className="text-slate-600 text-sm">Choisissez un annuaire pour voir ses thématiques</p>
                </div>
                <Select value={selectedAnnuaire} onValueChange={setSelectedAnnuaire}>
                  <SelectTrigger className="w-auto min-w-[280px] rounded-xl border-2 border-slate-200 bg-white shadow-sm h-12 hover:border-[#58061C]/30 transition-colors">
                    <CalendarDays className="h-4 w-4 mr-2 text-[#58061C]" />
                    <SelectValue placeholder="Choisir un annuaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...annuaires].sort((a, b) => b.annee.localeCompare(a.annee)).map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>Annuaire Statistique {a.annee}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-md p-8 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-[#58061C]" />
                    <p className="text-sm font-medium text-slate-600">Chargement des données...</p>
                  </div>
                </div>
              ) : thematiquesForAnnuaire.length === 0 ? (
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-16 text-center">
                  <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Aucune thématique disponible pour cet annuaire</p>
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {thematiquesForAnnuaire.map((theme) => {
                    const cleanName = normalizeThematiqueName(theme.nom_fr);
                    const { Icon, colorClass } = getThematiqueIcon(cleanName);
                    return (
                      <motion.div key={theme.id} variants={staggerItem}>
                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-[#58061C]/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group h-full"
                          onClick={() => handleThematiqueClick(theme)}>
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorClass.replace('text-', 'to-').split(' ')[0]}/20 ${colorClass.replace('text-', 'to-').split(' ')[0]}/10 border ${colorClass.replace('text-', 'border-').split(' ')[0]}/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                              <Icon className={`${colorClass.split(' ').pop()} h-5 w-5`} />
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#58061C] group-hover:translate-x-1 transition-all" />
                          </div>
                          <h4 className="text-base font-bold text-slate-900 mb-3 group-hover:text-[#58061C] transition-colors leading-tight">
                            {cleanName}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20">
                              {theme.nb_indicateurs} tableau{(theme.nb_indicateurs || 0) > 1 ? "x" : ""}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {theme.code}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="thematique">
              {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#58061C]" /></div>
              ) : (
                <ThematiqueGlobalView thematiques={thematiques} annuaires={annuaires} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 bg-white border-t border-slate-200">
        <div className="section-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Annuaire Statistique du Maroc</p>
                <p className="text-xs text-slate-500">Haut-Commissariat au Plan</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link to="/indicateurs" className="hover:text-[#58061C] transition-colors">Tableaux</Link>
              <Link to="/auth" className="hover:text-[#58061C] transition-colors">Administration</Link>
              <a href="https://www.hcp.ma" target="_blank" rel="noopener noreferrer" className="hover:text-[#58061C] transition-colors flex items-center gap-1">
                HCP.ma <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- Sub-components ---
function StatCard({ value, label, icon: Icon }: { value: string; label: string; icon: any }) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 text-center hover:border-[#58061C]/20 hover:shadow-md transition-all">
      <Icon className="h-5 w-5 text-[#58061C] mx-auto mb-2" />
      <div className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-xs sm:text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, iconColor, title, description }: { icon: any; iconColor: string; title: string; description: string }) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-7 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${iconColor.split(' ').slice(0, 2).join(' ')} border ${iconColor.split(' ')[2]} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
        <Icon className={`h-6 w-6 ${iconColor.split(' ').pop()}`} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function ThematiqueGlobalView({ thematiques, annuaires }: { thematiques: Thematique[]; annuaires: Annuaire[] }) {
  const navigate = useNavigate();
  const uniqueThematiques = useMemo(() => {
    const map = new Map<string, { name: string; years: string[]; totalTableaux: number; code: string }>();
    thematiques.forEach((t) => {
      const cleanName = normalizeThematiqueName(t.nom_fr);
      if ((t.nb_indicateurs || 0) === 0) return;
      const existing = map.get(cleanName);
      const annee = annuaires.find((a) => a.id === t.id_annuaire)?.annee || "?";
      if (existing) { if (!existing.years.includes(annee)) existing.years.push(annee); existing.totalTableaux += t.nb_indicateurs || 0; }
      else { map.set(cleanName, { name: cleanName, years: [annee], totalTableaux: t.nb_indicateurs || 0, code: t.code }); }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [thematiques, annuaires]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {uniqueThematiques.map((theme) => {
        const { Icon, colorClass } = getThematiqueIcon(theme.name);
        return (
          <motion.div key={theme.name} variants={staggerItem}>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-[#58061C]/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group h-full"
              onClick={() => navigate(`/thematique?thematique=${encodeURIComponent(theme.name)}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorClass.replace('text-', 'to-').split(' ')[0]}/20 ${colorClass.replace('text-', 'to-').split(' ')[0]}/10 border ${colorClass.replace('text-', 'border-').split(' ')[0]}/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`${colorClass.split(' ').pop()} h-5 w-5`} />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#58061C] group-hover:translate-x-1 transition-all" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3 group-hover:text-[#58061C] transition-colors leading-tight">{theme.name}</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#58061C]/8 text-[#58061C] border border-[#58061C]/20">{theme.totalTableaux} tableaux</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#CFA452]/10 text-[#7c5524] border border-[#CFA452]/30">{theme.years.length} année{theme.years.length > 1 ? "s" : ""}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default Index;
