import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { corrections, admin } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  X,
  Loader2,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Calendar,
  User,
  Table as TableIcon,
  Eye,
  ExternalLink,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PendingCorrection {
  id: number;
  id_tableau: number;
  user_id: number;
  user_display_name?: string;
  user_email?: string;
  type_element: string;
  row_index?: number;
  col_index?: number;
  valeur_originale?: string;
  valeur_corrigee: string;
  commentaire?: string;
  created_at: string;
  tableau_code: string;
  tableau_titre: string;
  pdf_url?: string;
  pdf_path?: string;
  annuaire_annee?: string;
}

export default function Validation() {
  const [pendingList, setPendingList] = useState<PendingCorrection[]>([]);
  const [historyList, setHistoryList] = useState<PendingCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Dialog verification state
  const [verifyModal, setVerifyModal] = useState<{
    open: boolean;
    correction: PendingCorrection | null;
    tableau: any | null;
    loading: boolean;
  }>({
    open: false,
    correction: null,
    tableau: null,
    loading: false
  });

  const fetchPending = async () => {
    setLoading(true);
    try {
      // Corriger silencieusement les anciens noms 'Correcteur' en base
      await admin.fixCorrectionNames().catch(() => {/* ignore si échec */});
      const data = await corrections.getPendingCorrections();
      setPendingList(data);
      const historyData = await corrections.getHistoryCorrections();
      setHistoryList(historyData);
    } catch (err: any) {
      toast.error("Erreur lors de la récupération des corrections", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    if (verifyModal.open) {
      setPdfLoading(true);
    }
  }, [verifyModal.open, verifyModal.correction]);

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await corrections.approveCorrection(id);
      if (res.success) {
        toast.success("Correction approuvée et appliquée au site public !");
        fetchPending();
        if (verifyModal.open && verifyModal.correction?.id === id) {
          setVerifyModal(prev => ({ ...prev, open: false }));
        }
      }
    } catch (err: any) {
      toast.error("Erreur lors de l'approbation", { description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await corrections.rejectCorrection(id);
      if (res.success) {
        toast.success("Correction rejetée avec succès !");
        fetchPending();
        if (verifyModal.open && verifyModal.correction?.id === id) {
          setVerifyModal(prev => ({ ...prev, open: false }));
        }
      }
    } catch (err: any) {
      toast.error("Erreur lors du rejet", { description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenVerification = async (item: PendingCorrection) => {
    setVerifyModal({
      open: true,
      correction: item,
      tableau: null,
      loading: true
    });

    try {
      const res = await corrections.getTableauDetails(item.id_tableau);
      setVerifyModal(prev => ({
        ...prev,
        tableau: res.tableau,
        loading: false
      }));
    } catch (err: any) {
      toast.error("Erreur de chargement du tableau", { description: err.message });
      setVerifyModal(prev => ({ ...prev, loading: false }));
    }
  };

  const formatTypeElement = (type: string) => {
    switch (type) {
      case 'cellule': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none font-medium">Cellule</Badge>;
      case 'entete': return <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none font-medium">En-tête</Badge>;
      case 'titre_fr': return <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none font-medium">Titre FR</Badge>;
      case 'titre_ar': return <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none font-medium">Titre AR</Badge>;
      case 'unite_fr': return <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-none font-medium">Unité FR</Badge>;
      case 'unite_ar': return <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-none font-medium">Unité AR</Badge>;
      case 'notes_fr': return <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-50 border-none font-medium">Notes FR</Badge>;
      case 'notes_ar': return <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-50 border-none font-medium">Notes AR</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Helper properties for Verification Modal
  const isCellCorrection = verifyModal.correction?.type_element === 'cellule';
  const isHeaderCorrection = verifyModal.correction?.type_element === 'entete';
  const rawPdfUrl = verifyModal.correction?.pdf_url;
  const pdfProxyUrl = rawPdfUrl ? `http://localhost:3001/api/corrections/pdf-proxy?url=${encodeURIComponent(rawPdfUrl)}` : null;

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Validation des Corrections</h1>
          <p className="text-sm text-slate-500">
            Validez ou rejetez les propositions de modification soumises par les correcteurs pour les appliquer sur le site public.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-100 shadow-sm gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-slate-500">Chargement des données...</p>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList className="bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50 w-max">
              <TabsTrigger value="pending" className="text-xs px-4 py-1.5 rounded-md font-medium">
                Demandes en attente ({pendingList.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-4 py-1.5 rounded-md font-medium">
                Historique des décisions ({historyList.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="m-0 space-y-6">
              {pendingList.length === 0 ? (
                <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="p-4 rounded-full bg-emerald-50 text-emerald-500">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg text-slate-900">Aucune correction en attente</h3>
                      <p className="text-sm text-slate-500 max-w-sm">
                        Toutes les modifications soumises par les correcteurs ont été traitées. Bon travail !
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b border-slate-50 px-6 py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      Demandes de modification en attente
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-bold">
                        {pendingList.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Cliquez sur le bouton de visualisation pour vérifier la modification dans le tableau complet ou comparer avec le PDF HCP d'origine.
                    </CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-4">Correcteur</th>
                          <th className="px-6 py-4">Tableau</th>
                          <th className="px-6 py-4">Élément</th>
                          <th className="px-6 py-4">Valeur Originale</th>
                          <th className="px-6 py-4">Valeur Proposée</th>
                          <th className="px-6 py-4">Commentaire</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {pendingList.map((item) => {
                          const isProcessing = processingId === item.id;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-950 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                    {item.user_display_name || "Correcteur"}
                                  </span>
                                  <span className="text-xs text-slate-400 ml-5">{item.user_email}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col max-w-[200px]">
                                  <button
                                    onClick={() => handleOpenVerification(item)}
                                    className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded w-max mb-1 hover:bg-slate-200 transition-colors cursor-pointer text-left"
                                  >
                                    {item.tableau_code}
                                  </button>
                                  <span className="text-xs text-slate-600 truncate" title={item.tableau_titre}>
                                    {item.tableau_titre}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  {formatTypeElement(item.type_element)}
                                  {(item.row_index !== null && item.col_index !== null) && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Ligne {item.row_index! + 1}, Col {item.col_index! + 1}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 max-w-[150px]">
                                <span className="text-rose-600 line-through bg-rose-50 px-2 py-1 rounded text-xs break-all inline-block font-mono">
                                  {item.valeur_originale || <span className="italic text-rose-400 text-[10px]">Vide</span>}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[150px]">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs font-semibold break-all inline-block font-mono">
                                  {item.valeur_corrigee}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[200px]">
                                {item.commentaire ? (
                                  <span className="text-xs text-slate-600 flex items-start gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <span className="italic">"{item.commentaire}"</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Aucun commentaire</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0 rounded-full"
                                    onClick={() => handleOpenVerification(item)}
                                    disabled={isProcessing}
                                    title="Visualiser et comparer"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0 rounded-full"
                                    onClick={() => handleReject(item.id)}
                                    disabled={isProcessing}
                                    title="Rejeter"
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <X className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 w-8 p-0 rounded-full"
                                    onClick={() => handleApprove(item.id)}
                                    disabled={isProcessing}
                                    title="Approuver"
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="m-0 space-y-6">
              {historyList.length === 0 ? (
                <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="p-4 rounded-full bg-slate-50 text-slate-400">
                      <Calendar className="h-12 w-12" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg text-slate-900">Historique vide</h3>
                      <p className="text-sm text-slate-500 max-w-sm">
                        Aucune décision d'approbation ou de rejet n'a encore été enregistrée dans l'historique.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="border-b border-slate-50 px-6 py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      Historique des décisions
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none font-bold">
                        {historyList.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Consultez la liste des modifications passées qui ont été validées ou rejetées par les administrateurs.
                    </CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-4">Correcteur</th>
                          <th className="px-6 py-4">Tableau</th>
                          <th className="px-6 py-4">Élément</th>
                          <th className="px-6 py-4">Valeur Originale</th>
                          <th className="px-6 py-4">Valeur Appliquée</th>
                          <th className="px-6 py-4">Commentaire</th>
                          <th className="px-6 py-4">Décision</th>
                          <th className="px-6 py-4 text-right">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {historyList.map((item) => {
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-950 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                    {item.user_display_name || "Correcteur"}
                                  </span>
                                  <span className="text-xs text-slate-400 ml-5">{item.user_email}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col max-w-[200px]">
                                  <button
                                    onClick={() => handleOpenVerification(item)}
                                    className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded w-max mb-1 hover:bg-slate-200 transition-colors cursor-pointer text-left"
                                  >
                                    {item.tableau_code}
                                  </button>
                                  <span className="text-xs text-slate-600 truncate" title={item.tableau_titre}>
                                    {item.tableau_titre}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  {formatTypeElement(item.type_element)}
                                  {(item.row_index !== null && item.col_index !== null) && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Ligne {item.row_index! + 1}, Col {item.col_index! + 1}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 max-w-[150px]">
                                <span className="text-rose-600 line-through bg-rose-50 px-2 py-1 rounded text-xs break-all inline-block font-mono">
                                  {item.valeur_originale || <span className="italic text-rose-400 text-[10px]">Vide</span>}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[150px]">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs font-semibold break-all inline-block font-mono">
                                  {item.valeur_corrigee}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[180px]">
                                {item.commentaire ? (
                                  <span className="text-xs text-slate-600 flex items-start gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <span className="italic">"{item.commentaire}"</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Aucun commentaire</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {item.status === 'approved' ? (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-bold">
                                    Approuvé
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none font-bold">
                                    Rejeté
                                  </Badge>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0 rounded-full"
                                  onClick={() => handleOpenVerification(item)}
                                  title="Visualiser le tableau"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Verification Modal Dialog */}
      <Dialog
        open={verifyModal.open}
        onOpenChange={(open) => setVerifyModal(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-6xl w-[90vw] max-h-[85vh] flex flex-col p-6 rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-indigo-500" />
              Validation : Tableau {verifyModal.correction?.tableau_code}
            </DialogTitle>
            <span className="text-xs text-slate-500 mt-1">
              {verifyModal.correction?.tableau_titre}
            </span>
          </DialogHeader>

          {verifyModal.loading ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-xs text-slate-500">Chargement des données du tableau...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 py-4 space-y-4">
              {/* Comparatif de correction en en-tête */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    Correction demandée sur : {verifyModal.correction && formatTypeElement(verifyModal.correction.type_element)}
                    {verifyModal.correction?.commentaire && (
                      <span className="text-xs text-slate-400 italic">
                        ({verifyModal.correction.commentaire})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Valeur originale :</span>
                    <span className="text-xs line-through text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-mono">
                      {verifyModal.correction?.valeur_originale || "(Vide)"}
                    </span>
                    <span className="text-slate-400 text-xs">➔</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                      {verifyModal.correction?.valeur_corrigee}
                    </span>
                  </div>
                </div>
                {rawPdfUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg text-xs gap-1.5 h-8 border-slate-200"
                    onClick={() => window.open(rawPdfUrl, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir PDF d'origine
                  </Button>
                )}
              </div>

              {/* Conteneur Grille de données avec hauteur augmentée */}
              <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm h-[500px] min-h-[500px]">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <TableIcon className="h-3.5 w-3.5 text-indigo-500" />
                    Grille de données
                  </span>
                </div>
                <div className="flex-1 overflow-auto">
                  {verifyModal.tableau ? (
                    <>
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          {Array.isArray(verifyModal.tableau.entetes) && verifyModal.tableau.entetes.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="bg-slate-50 border-b border-slate-200">
                              {Array.isArray(row) && row.map((cell: any, cIdx: number) => {
                                const isCorrected = isHeaderCorrection && verifyModal.correction?.row_index === rIdx && verifyModal.correction?.col_index === cIdx;
                                return (
                                  <th
                                    key={cIdx}
                                    className={cn(
                                      "px-3 py-2 text-xs font-bold text-slate-800 border-r border-slate-200 text-center whitespace-nowrap min-w-[100px]",
                                      isCorrected ? "bg-amber-100 text-amber-950 font-bold border-amber-300 relative outline outline-2 outline-amber-400" : ""
                                    )}
                                  >
                                    {cell}
                                  </th>
                                );
                              })}
                            </tr>
                          ))}
                        </thead>
                        <tbody>
                          {Array.isArray(verifyModal.tableau.donnees) && verifyModal.tableau.donnees.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="border-b border-slate-150 hover:bg-slate-50/20">
                              {Array.isArray(row) && row.map((cell: any, cIdx: number) => {
                                const isCorrected = isCellCorrection && verifyModal.correction?.row_index === rIdx && verifyModal.correction?.col_index === cIdx;
                                return (
                                  <td
                                    key={cIdx}
                                    className={cn(
                                      "px-3 py-2 text-xs border-r border-slate-200 font-mono text-center whitespace-nowrap min-w-[100px]",
                                      isCorrected ? "bg-amber-100 text-amber-950 font-bold border-amber-300 relative outline outline-2 outline-amber-400" : "text-slate-700"
                                    )}
                                  >
                                    {isCorrected ? verifyModal.correction?.valeur_corrigee : cell}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Notes du tableau */}
                      {(verifyModal.tableau.notes_fr || verifyModal.tableau.notes_ar) && (
                        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs space-y-2 mt-4">
                          <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                            Notes / Remarques :
                          </h4>
                          {verifyModal.tableau.notes_fr && (
                            <p className="text-slate-600 leading-relaxed font-medium">
                              <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded mr-1.5 uppercase font-bold">FR</span>
                              {verifyModal.tableau.notes_fr}
                            </p>
                          )}
                          {verifyModal.tableau.notes_ar && (
                            <p className="text-slate-600 leading-relaxed font-medium text-right" dir="rtl">
                              <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded ml-1.5 uppercase font-bold" dir="ltr">AR</span>
                              {verifyModal.tableau.notes_ar}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">Aucune donnée disponible</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-4 gap-2 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-9"
              onClick={() => setVerifyModal(prev => ({ ...prev, open: false }))}
            >
              Fermer
            </Button>
            {verifyModal.correction && verifyModal.correction.status === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-xs h-9 gap-1"
                  onClick={() => handleReject(verifyModal.correction!.id)}
                  disabled={processingId !== null}
                >
                  <X className="h-3.5 w-3.5" />
                  Rejeter
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 gap-1"
                  onClick={() => handleApprove(verifyModal.correction!.id)}
                  disabled={processingId !== null}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approuver
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
