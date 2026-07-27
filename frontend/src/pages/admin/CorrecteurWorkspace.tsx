import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { annuaires, thematiques, tableaux, corrections } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  ExternalLink, 
  History, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Filter, 
  Loader2, 
  FileSearch,
  Sparkles,
  Link2,
  Calendar,
  Layers,
  Table as TableIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface Annuaire {
  id: number;
  annee: string;
  pdf_url?: string;
  pdf_path?: string;
}

interface Thematique {
  id: number;
  code: string;
  nom_fr: string;
  id_annuaire: number;
}

interface Tableau {
  id: number;
  code: string;
  titre_fr: string;
  titre_ar?: string;
  unite_fr?: string;
  source_fr?: string;
  notes_fr?: string;
  entetes?: any;
  donnees?: any;
  pdf_url?: string;
  pdf_path?: string;
  annuaire_annee?: string;
}

interface CorrectionLog {
  id: number;
  id_tableau: number;
  user_display_name?: string;
  type_element: string;
  row_index?: number;
  col_index?: number;
  valeur_originale?: string;
  valeur_corrigee: string;
  commentaire?: string;
  created_at: string;
}

export default function CorrecteurWorkspace() {
  const [listAnnuaires, setListAnnuaires] = useState<Annuaire[]>([]);
  const [listThematiques, setListThematiques] = useState<Thematique[]>([]);
  const [listTableaux, setListTableaux] = useState<Tableau[]>([]);

  const [selectedAnnee, setSelectedAnnee] = useState<string>('');
  const [selectedThematiqueId, setSelectedThematiqueId] = useState<string>('');
  const [selectedTableauId, setSelectedTableauId] = useState<string>('');

  const [currentTableau, setCurrentTableau] = useState<Tableau | null>(null);
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionLog[]>([]);

  const [loadingAnnuaires, setLoadingAnnuaires] = useState(true);
  const [loadingThematiques, setLoadingThematiques] = useState(false);
  const [loadingTableaux, setLoadingTableaux] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Cell edit state
  const [editCellModal, setEditCellModal] = useState<{
    open: boolean;
    row_index: number;
    col_index: number;
    valeur_originale: string;
    valeur_corrigee: string;
    commentaire: string;
  }>({
    open: false,
    row_index: -1,
    col_index: -1,
    valeur_originale: '',
    valeur_corrigee: '',
    commentaire: ''
  });

  // Header cell edit state
  const [editHeaderModal, setEditHeaderModal] = useState<{
    open: boolean;
    row_index: number;
    col_index: number;
    valeur_originale: string;
    valeur_corrigee: string;
    commentaire: string;
  }>({
    open: false,
    row_index: -1,
    col_index: -1,
    valeur_originale: '',
    valeur_corrigee: '',
    commentaire: ''
  });

  // Metadata edit state
  const [editMetaModal, setEditMetaModal] = useState<{
    open: boolean;
    type_element: string;
    label: string;
    valeur_originale: string;
    valeur_corrigee: string;
    commentaire: string;
  }>({
    open: false,
    type_element: '',
    label: '',
    valeur_originale: '',
    valeur_corrigee: '',
    commentaire: ''
  });

  // Custom PDF URL Modal
  const [pdfUrlModal, setPdfUrlModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });

  const [submitting, setSubmitting] = useState(false);

  // 1. Charger la liste des annuaires au montage
  useEffect(() => {
    async function loadAnnuaires() {
      try {
        setLoadingAnnuaires(true);
        const data = await annuaires.getAll();
        setListAnnuaires(data);
        if (data.length > 0) {
          setSelectedAnnee(data[0].annee);
        }
      } catch (err: any) {
        toast.error("Erreur de chargement des annuaires");
      } finally {
        setLoadingAnnuaires(false);
      }
    }
    loadAnnuaires();
  }, []);

  // 2. Charger les thématiques quand l'année change
  useEffect(() => {
    if (!selectedAnnee) return;
    async function loadThematiques() {
      try {
        setLoadingThematiques(true);
        setListThematiques([]);
        setListTableaux([]);
        setSelectedThematiqueId('');
        setSelectedTableauId('');
        setCurrentTableau(null);

        const ann = listAnnuaires.find(a => a.annee === selectedAnnee);
        if (ann) {
          const data = await thematiques.getByAnnuaire(ann.id);
          const sortedData = [...data].sort((a, b) => {
            const numA = parseInt(a.code.replace(/\D/g, '')) || 999;
            const numB = parseInt(b.code.replace(/\D/g, '')) || 999;
            return numA - numB;
          });
          setListThematiques(sortedData);
          if (sortedData.length > 0) {
            setSelectedThematiqueId(String(sortedData[0].id));
          }
        }
      } catch (err) {
        toast.error("Erreur de chargement des thématiques");
      } finally {
        setLoadingThematiques(false);
      }
    }
    loadThematiques();
  }, [selectedAnnee, listAnnuaires]);

  // 3. Charger les tableaux quand la thématique change
  useEffect(() => {
    if (!selectedThematiqueId) return;
    async function loadTableauxList() {
      try {
        setLoadingTableaux(true);
        setListTableaux([]);
        setSelectedTableauId('');
        setCurrentTableau(null);

        const data = await tableaux.getByThematique(selectedThematiqueId);
        setListTableaux(data);
        if (data.length > 0) {
          setSelectedTableauId(String(data[0].id));
        }
      } catch (err) {
        toast.error("Erreur de chargement des tableaux");
      } finally {
        setLoadingTableaux(false);
      }
    }
    loadTableauxList();
  }, [selectedThematiqueId]);

  // 4. Charger les détails du tableau et son historique de traçabilité quand le tableau change
  useEffect(() => {
    if (!selectedTableauId) return;
    async function loadTableauDetails() {
      try {
        setLoadingDetails(true);
        const res = await corrections.getTableauDetails(selectedTableauId);
        setCurrentTableau(res.tableau);
        setCorrectionHistory(res.history);
      } catch (err) {
        toast.error("Erreur de chargement du tableau sélectionné");
      } finally {
        setLoadingDetails(false);
      }
    }
    loadTableauDetails();
  }, [selectedTableauId]);

  // Handle cell click to edit
  const handleCellClick = (rIdx: number, cIdx: number, val: any) => {
    const origStr = val !== null && val !== undefined ? String(val) : '';
    setEditCellModal({
      open: true,
      row_index: rIdx,
      col_index: cIdx,
      valeur_originale: origStr,
      valeur_corrigee: origStr,
      commentaire: ''
    });
  };

  // Handle header cell click to edit
  const handleHeaderClick = (rIdx: number, cIdx: number, val: any) => {
    const origStr = val !== null && val !== undefined ? String(val) : '';
    setEditHeaderModal({
      open: true,
      row_index: rIdx,
      col_index: cIdx,
      valeur_originale: origStr,
      valeur_corrigee: origStr,
      commentaire: ''
    });
  };

  // Submit Cell Correction
  const handleSaveCellCorrection = async () => {
    if (!currentTableau) return;
    try {
      setSubmitting(true);
      const res = await corrections.saveCorrection(currentTableau.id, {
        type_element: 'cellule',
        row_index: editCellModal.row_index,
        col_index: editCellModal.col_index,
        valeur_corrigee: editCellModal.valeur_corrigee,
        commentaire: editCellModal.commentaire,
        user_display_name: 'Correcteur'
      });

      setCurrentTableau(res.tableau);
      setCorrectionHistory(prev => [res.correction, ...prev]);
      setEditCellModal(prev => ({ ...prev, open: false }));
      toast.success("Correction enregistrée avec traçabilité !");
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde de la correction", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Header Correction
  const handleSaveHeaderCorrection = async () => {
    if (!currentTableau) return;
    try {
      setSubmitting(true);
      const res = await corrections.saveCorrection(currentTableau.id, {
        type_element: 'entete',
        row_index: editHeaderModal.row_index,
        col_index: editHeaderModal.col_index,
        valeur_corrigee: editHeaderModal.valeur_corrigee,
        commentaire: editHeaderModal.commentaire,
        user_display_name: 'Correcteur'
      });

      setCurrentTableau(res.tableau);
      setCorrectionHistory(prev => [res.correction, ...prev]);
      setEditHeaderModal(prev => ({ ...prev, open: false }));
      toast.success("En-tête corrigé avec traçabilité !");
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde de l'en-tête", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Metadata Correction (titre, unité, notes)
  const handleSaveMetaCorrection = async () => {
    if (!currentTableau) return;
    try {
      setSubmitting(true);
      const res = await corrections.saveCorrection(currentTableau.id, {
        type_element: editMetaModal.type_element,
        valeur_corrigee: editMetaModal.valeur_corrigee,
        commentaire: editMetaModal.commentaire,
        user_display_name: 'Correcteur'
      });

      setCurrentTableau(res.tableau);
      setCorrectionHistory(prev => [res.correction, ...prev]);
      setEditMetaModal(prev => ({ ...prev, open: false }));
      toast.success("Correction métadonnée enregistrée !");
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Save PDF URL
  const handleSavePdfUrl = async () => {
    if (!selectedAnnee) return;
    try {
      setSubmitting(true);
      await corrections.updatePdfUrl(selectedAnnee, pdfUrlModal.url);
      setListAnnuaires(prev => prev.map(a => a.annee === selectedAnnee ? { ...a, pdf_url: pdfUrlModal.url } : a));
      if (currentTableau) {
        setCurrentTableau({ ...currentTableau, pdf_url: pdfUrlModal.url });
      }
      setPdfUrlModal({ open: false, url: '' });
      toast.success("Lien PDF mis à jour pour l'annuaire !");
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour du PDF");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if a cell has been corrected
  const isCellCorrected = (rIdx: number, cIdx: number) => {
    return correctionHistory.some(c => c.type_element === 'cellule' && c.row_index === rIdx && c.col_index === cIdx);
  };


  // Check if a header cell has been corrected
  const isHeaderCorrected = (rIdx: number, cIdx: number) => {
    return correctionHistory.some(c => c.type_element === 'entete' && c.row_index === rIdx && c.col_index === cIdx);
  };

  // Helper functions for Excel column letters and merged cells
  const colLetterToIdx = (colStr: string): number => {
    let idx = 0;
    const str = colStr.toUpperCase();
    for (let i = 0; i < str.length; i++) {
      idx = idx * 26 + (str.charCodeAt(i) - 65 + 1);
    }
    return idx - 1;
  };

  const parseMergedCells = (mergedCells: any) => {
    if (!mergedCells) return [];
    const list = typeof mergedCells === 'string' ? JSON.parse(mergedCells) : mergedCells;
    if (!Array.isArray(list)) return [];

    const rules: Array<{ startRow: number; endRow: number; startCol: number; endCol: number; rowspan: number; colspan: number; value?: string }> = [];
    for (const item of list) {
      if (!item) continue;
      const rangeStr = item.range || (typeof item === 'string' ? item : '');
      if (!rangeStr) continue;

      const match = rangeStr.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
      if (!match) continue;

      const startColStr = match[1];
      const startRowStr = match[2];
      const endColStr = match[3] || startColStr;
      const endRowStr = match[4] || startRowStr;

      const startCol = colLetterToIdx(startColStr);
      const startRow = parseInt(startRowStr, 10) - 1;
      const endCol = colLetterToIdx(endColStr);
      const endRow = parseInt(endRowStr, 10) - 1;

      rules.push({
        startRow,
        endRow,
        startCol,
        endCol,
        rowspan: endRow - startRow + 1,
        colspan: endCol - startCol + 1,
        value: item.value
      });
    }
    return rules;
  };

  const mergedRules = parseMergedCells(currentTableau?.merged_cells);

  const getMergeInfo = (rIdx: number, cIdx: number) => {
    const rule = mergedRules.find(
      m => rIdx >= m.startRow && rIdx <= m.endRow && cIdx >= m.startCol && cIdx <= m.endCol
    );
    if (!rule) {
      return { isTopLeft: true, isMerged: false, rowspan: 1, colspan: 1, value: undefined };
    }
    const isTopLeft = rIdx === rule.startRow && cIdx === rule.startCol;
    return {
      isTopLeft,
      isMerged: true,
      rowspan: rule.rowspan,
      colspan: rule.colspan,
      value: rule.value
    };
  };


  // Parse headers & rows JSON
  const headersList = currentTableau?.entetes
    ? (typeof currentTableau.entetes === 'string' ? JSON.parse(currentTableau.entetes) : currentTableau.entetes)
    : [];

  const rowsList = currentTableau?.donnees
    ? (typeof currentTableau.donnees === 'string' ? JSON.parse(currentTableau.donnees) : currentTableau.donnees)
    : [];

  const currentAnnuaire = listAnnuaires.find(a => a.annee === selectedAnnee);
  const rawPdfUrl = currentTableau?.pdf_url || currentAnnuaire?.pdf_url;
  const pdfProxyUrl = rawPdfUrl ? `http://localhost:3001/api/corrections/pdf-proxy?url=${encodeURIComponent(rawPdfUrl)}` : null;

  return (
    <AdminLayout>
      <div className="p-3 sm:p-5 lg:p-6 max-w-[1850px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#58061C]/10 via-white to-[#CFA452]/10 border border-[#58061C]/15 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center text-white shadow-md shadow-[#58061C]/15">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Espace Correcteur
                <Badge variant="outline" className="bg-[#58061C]/10 text-[#58061C] border-[#58061C]/20 text-xs">
                  Double Affichage & Traçabilité
                </Badge>
              </h1>
              <p className="text-xs text-slate-600">
                Comparez les données extraites au PDF de l'annuaire et effectuez les corrections avec suivi d'audit.
              </p>
            </div>
          </div>
        </div>

        {/* Cascading Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          {/* 1. Annuaire (Année) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#58061C]" /> Annuaire (Année)
            </label>
            <select
              value={selectedAnnee}
              onChange={(e) => setSelectedAnnee(e.target.value)}
              disabled={loadingAnnuaires}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#58061C]"
            >
              {loadingAnnuaires ? (
                <option>Chargement...</option>
              ) : (
                listAnnuaires.map(a => (
                  <option key={a.id} value={a.annee}>
                    {a.annee} {a.pdf_url ? '📄 (PDF disponible)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Thématique (Chapitre) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#58061C]" /> Thématique (Chapitre)
            </label>
            <select
              value={selectedThematiqueId}
              onChange={(e) => setSelectedThematiqueId(e.target.value)}
              disabled={loadingThematiques || listThematiques.length === 0}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#58061C]"
            >
              {loadingThematiques ? (
                <option>Chargement...</option>
              ) : listThematiques.length === 0 ? (
                <option value="">Aucune thématique</option>
              ) : (
                listThematiques.map(t => (
                  <option key={t.id} value={t.id}>
                    Ch. {t.code} - {t.nom_fr}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Tableau (Indicateur) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <TableIcon className="h-3.5 w-3.5 text-[#58061C]" /> Tableau (Indicateur)
            </label>
            <select
              value={selectedTableauId}
              onChange={(e) => setSelectedTableauId(e.target.value)}
              disabled={loadingTableaux || listTableaux.length === 0}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#58061C]"
            >
              {loadingTableaux ? (
                <option>Chargement...</option>
              ) : listTableaux.length === 0 ? (
                <option value="">Aucun tableau</option>
              ) : (
                listTableaux.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.code ? `[${t.code}] ` : ''}{t.titre_fr.slice(0, 60)}...
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Split Screen Layout */}
        {loadingDetails ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white border border-slate-200 rounded-2xl space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#58061C]" />
            <p className="text-sm font-medium text-slate-600">Chargement des données du tableau et de son PDF...</p>
          </div>
        ) : !currentTableau ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">Veuillez sélectionner un annuaire, une thématique et un tableau dans la barre de filtre ci-dessus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Pane: Interactive Table & Metadata (6 Columns) */}
            <div className="lg:col-span-6 space-y-4">
              
              <Tabs defaultValue="donnees" className="w-full">
                <div className="flex items-center justify-between bg-white p-3 border border-slate-200 rounded-2xl mb-4">
                  <TabsList className="bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="donnees" className="rounded-lg text-xs gap-1.5">
                      <TableIcon className="h-3.5 w-3.5" /> Tableau de Données
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg text-xs gap-1.5">
                      <History className="h-3.5 w-3.5" /> Traçabilité ({correctionHistory.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    Code: {currentTableau.code}
                  </Badge>
                </div>

                {/* Tab: Editable Data Table */}
                <TabsContent value="donnees" className="space-y-4">
                  
                  {/* Table Header / Metadata Editable Card */}
                  <Card className="rounded-2xl border-slate-200 shadow-sm">
                    <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-slate-900 leading-snug">
                            {currentTableau.titre_fr}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-[#58061C]"
                            onClick={() => setEditMetaModal({
                              open: true,
                              type_element: 'titre_fr',
                              label: 'Titre (Français)',
                              valeur_originale: currentTableau.titre_fr,
                              valeur_corrigee: currentTableau.titre_fr,
                              commentaire: ''
                            })}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {currentTableau.titre_ar && (
                          <p className="text-sm font-semibold text-slate-600 font-arabic mt-1" dir="rtl">
                            {currentTableau.titre_ar}
                          </p>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-3 text-xs text-slate-600 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span><strong>Unité:</strong> {currentTableau.unite_fr || 'Non spécifiée'}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-[#58061C]"
                          onClick={() => setEditMetaModal({
                            open: true,
                            type_element: 'unite_fr',
                            label: 'Unité',
                            valeur_originale: currentTableau.unite_fr || '',
                            valeur_corrigee: currentTableau.unite_fr || '',
                            commentaire: ''
                          })}
                        >
                          Éditer unité
                        </Button>
                      </div>

                      {currentTableau.notes_fr && (
                        <div className="p-2 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-900 text-[11px] whitespace-pre-line">
                          <strong>Notes:</strong> {currentTableau.notes_fr}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Interactive Table Grid */}
                  <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Cliquez sur une cellule pour modifier sa valeur et enregistrer la traçabilité.
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        ● Cellules vertes = Corrigées
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        {/* Headers */}
                        {headersList.length > 0 && (
                          <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300">
                            {headersList.map((hRow: any[], rIdx: number) => (
                              <tr key={rIdx}>

                                {hRow.map((cell: any, cIdx: number) => {
                                  const mergeInfo = getMergeInfo(rIdx, cIdx);
                                  if (mergeInfo.isMerged && !mergeInfo.isTopLeft) {
                                    return null;
                                  }
                                  const cellText = String(cell || mergeInfo.value || '');
                                  const corrected = isHeaderCorrected(rIdx, cIdx);
                                  return (
                                    <th
                                      key={cIdx}
                                      rowSpan={mergeInfo.rowspan}
                                      colSpan={mergeInfo.colspan}
                                      onClick={() => handleHeaderClick(rIdx, cIdx, cellText)}
                                      className={`p-2.5 font-bold text-slate-800 border-r border-b border-slate-300 whitespace-pre-line text-center align-middle cursor-pointer transition-all ${
                                        corrected
                                          ? 'bg-emerald-100/80 border-emerald-400 text-emerald-950 shadow-inner'
                                          : 'bg-slate-100/90 hover:bg-[#58061C]/10'
                                      }`}
                                      title="Cliquer pour corriger cet en-tête"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        <span>{cellText}</span>
                                        {corrected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>}
                                      </div>
                                    </th>
                                  );
                                })}

                              </tr>
                            ))}
                          </thead>
                        )}

                        {/* Data Rows */}
                        <tbody>
                          {rowsList.map((dRow: any[], rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-slate-50/80 border-b border-slate-200 transition-colors">
                              {dRow.map((cellVal: any, cIdx: number) => {
                                const corrected = isCellCorrected(rIdx, cIdx);
                                return (
                                  <td
                                    key={cIdx}
                                    onClick={() => handleCellClick(rIdx, cIdx, cellVal)}
                                    className={`p-2 border-r border-slate-200 cursor-pointer text-slate-900 transition-all ${
                                      corrected 
                                        ? 'bg-emerald-100/80 font-bold border-emerald-400 text-emerald-950 shadow-inner' 
                                        : 'hover:bg-[#58061C]/10 hover:font-semibold'
                                    }`}
                                    title="Cliquer pour corriger cette cellule"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span>{String(cellVal ?? '')}</span>
                                      {corrected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>

                {/* Tab: Correction History & Audit Trail */}
                <TabsContent value="history" className="space-y-3">
                  <Card className="rounded-2xl border-slate-200 shadow-sm p-4">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <History className="h-4 w-4 text-[#58061C]" />
                        Journal d'Audit et Traçabilité des Corrections
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Toutes les modifications enregistrées pour le tableau [{currentTableau.code}]
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0 space-y-3">
                      {correctionHistory.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                          Aucune correction n'a encore été apportée à ce tableau.
                        </div>
                      ) : (
                        correctionHistory.map((c) => (
                          <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span className="text-[#58061C]">
                                {c.type_element === 'cellule'
                                  ? `Cellule [Rang ${c.row_index! + 1}, Col ${c.col_index! + 1}]`
                                  : c.type_element === 'entete'
                                  ? `En-tête [Rang ${c.row_index! + 1}, Col ${c.col_index! + 1}]`
                                  : `Élément: ${c.type_element}`}
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                {new Date(c.created_at).toLocaleString('fr-FR')}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px]">
                              <div>
                                <span className="text-[10px] text-red-500 block uppercase font-bold">Valeur originale</span>
                                <span className="text-slate-600 line-through">{c.valeur_originale || '(Vide)'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-emerald-600 block uppercase font-bold">Valeur corrigée</span>
                                <span className="text-emerald-950 font-bold">{c.valeur_corrigee}</span>
                              </div>
                            </div>

                            {c.commentaire && (
                              <p className="text-[11px] text-slate-600 italic">
                                💬 <strong>Commentaire:</strong> {c.commentaire}
                              </p>
                            )}

                            <div className="text-[10px] text-slate-400 text-right">
                              Par: {c.user_display_name || 'Correcteur'}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Pane: PDF Viewer (6 Columns) */}
            <div className="lg:col-span-6 sticky top-6 space-y-3">
              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="p-3.5 bg-slate-900 text-white flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <CardTitle className="text-sm font-bold">
                      Annuaire {selectedAnnee} (PDF HCP Original)
                    </CardTitle>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPdfUrlModal({ open: true, url: rawPdfUrl || '' })}
                    className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 border border-slate-700 rounded-lg px-2.5"
                  >
                    <Link2 className="h-3.5 w-3.5 text-emerald-400" /> Modifier le lien
                  </Button>
                </CardHeader>

                <CardContent className="p-0 bg-slate-950 min-h-[850px] flex flex-col justify-center items-center text-center">
                  {pdfProxyUrl ? (
                    <iframe
                      src={pdfProxyUrl}
                      className="w-full h-[850px] border-0"
                      title={`PDF Annuaire ${selectedAnnee}`}
                    />
                  ) : (
                    <div className="p-8 text-slate-400 space-y-3">
                      <FileSearch className="h-12 w-12 text-slate-600 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">
                        Aucun lien PDF associé à l'annuaire de l'année {selectedAnnee}.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfUrlModal({ open: true, url: '' })}
                        className="rounded-xl border-slate-700 text-slate-200 hover:bg-slate-800 gap-2 text-xs"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Assigner une URL PDF
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        )}

        {/* Modal: Edit Cell & Save Correction with Traceability */}
        <Dialog open={editCellModal.open} onOpenChange={(open) => setEditCellModal(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-[#58061C]" />
                Corriger la cellule [Rang {editCellModal.row_index + 1}, Col {editCellModal.col_index + 1}]
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Valeur originale dans la base</Label>
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 line-through">
                  {editCellModal.valeur_originale || '(Vide)'}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nouvelle valeur corrigée *</Label>
                <Input
                  value={editCellModal.valeur_corrigee}
                  onChange={(e) => setEditCellModal(prev => ({ ...prev, valeur_corrigee: e.target.value }))}
                  placeholder="Saisissez la valeur exacte..."
                  className="rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Commentaire de correction (Optionnel)</Label>
                <Textarea
                  value={editCellModal.commentaire}
                  onChange={(e) => setEditCellModal(prev => ({ ...prev, commentaire: e.target.value }))}
                  placeholder="Ex: Erreur d'OCR dans la version scannée..."
                  className="rounded-xl text-xs h-20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditCellModal(prev => ({ ...prev, open: false }))} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button size="sm" onClick={handleSaveCellCorrection} disabled={submitting} className="rounded-xl text-xs gap-2 bg-[#58061C] hover:bg-[#420415] text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer la correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Header Cell */}
        <Dialog open={editHeaderModal.open} onOpenChange={(open) => setEditHeaderModal(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-[#58061C]" />
                Corriger l'en-tête [Rang {editHeaderModal.row_index + 1}, Col {editHeaderModal.col_index + 1}]
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Valeur originale de l'en-tête</Label>
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 line-through">
                  {editHeaderModal.valeur_originale || '(Vide)'}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nouvelle valeur corrigée *</Label>
                <Input
                  value={editHeaderModal.valeur_corrigee}
                  onChange={(e) => setEditHeaderModal(prev => ({ ...prev, valeur_corrigee: e.target.value }))}
                  placeholder="Saisissez la valeur exacte de l'en-tête..."
                  className="rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Commentaire de correction (Optionnel)</Label>
                <Textarea
                  value={editHeaderModal.commentaire}
                  onChange={(e) => setEditHeaderModal(prev => ({ ...prev, commentaire: e.target.value }))}
                  placeholder="Ex: Nom de colonne mal extrait du PDF..."
                  className="rounded-xl text-xs h-20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditHeaderModal(prev => ({ ...prev, open: false }))} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button size="sm" onClick={handleSaveHeaderCorrection} disabled={submitting} className="rounded-xl text-xs gap-2 bg-[#58061C] hover:bg-[#420415] text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer la correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Metadata */}
        <Dialog open={editMetaModal.open} onOpenChange={(open) => setEditMetaModal(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-[#58061C]" />
                Corriger {editMetaModal.label}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nouvelle valeur *</Label>
                <Input
                  value={editMetaModal.valeur_corrigee}
                  onChange={(e) => setEditMetaModal(prev => ({ ...prev, valeur_corrigee: e.target.value }))}
                  className="rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Commentaire de correction</Label>
                <Textarea
                  value={editMetaModal.commentaire}
                  onChange={(e) => setEditMetaModal(prev => ({ ...prev, commentaire: e.target.value }))}
                  className="rounded-xl text-xs h-20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditMetaModal(prev => ({ ...prev, open: false }))} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button size="sm" onClick={handleSaveMetaCorrection} disabled={submitting} className="rounded-xl text-xs gap-2 bg-[#58061C] hover:bg-[#420415] text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Custom PDF URL */}
        <Dialog open={pdfUrlModal.open} onOpenChange={(open) => setPdfUrlModal(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#58061C]" />
                Définir l'URL du PDF pour l'annuaire {selectedAnnee}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Label className="text-xs font-semibold text-slate-700">URL du fichier PDF</Label>
              <Input
                value={pdfUrlModal.url}
                onChange={(e) => setPdfUrlModal(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://www.hcp.ma/file/..."
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setPdfUrlModal(prev => ({ ...prev, open: false }))} className="rounded-xl text-xs">
                Annuler
              </Button>
              <Button size="sm" onClick={handleSavePdfUrl} disabled={submitting} className="rounded-xl text-xs gap-2 bg-[#58061C] hover:bg-[#420415] text-white">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Associer l'URL
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}
