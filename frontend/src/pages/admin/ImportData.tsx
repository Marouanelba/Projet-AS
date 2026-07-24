import { useState, useRef } from 'react';
import { admin } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, Download, FolderOpen, File, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImportResults {
  type: string;
  annuaires: { inserted: number; errors: string[] };
  thematiques: { inserted: number; errors: string[] };
  indicateurs: { inserted: number; errors: string[] };
  indices: { inserted: number; errors: string[] };
  data: { inserted: number; errors: string[] };
}

interface FileResult {
  filename: string;
  success: boolean;
  results?: ImportResults;
  error?: string;
}

const metadataExample = `{
  "annuaires": [
    {
      "annee": "2024",
      "thematiques": [
        {"code": "2", "nom": "Population et démographie", "nb_indicateurs": 31},
        {"code": "3", "nom": "Emploi et chômage", "nb_indicateurs": 25}
      ]
    }
  ]
}`;

const chapitreExample = `{
  "chapter": 2,
  "chapter_title": "Population et démographie",
  "annuaire_annee": "2024",
  "tables": [
    {
      "table_number": 1,
      "title_fr": "Population totale par région",
      "title_ar": "مجموع السكان حسب الجهة",
      "headers": [["Région", "2022", "2023", "2024"]],
      "rows": [
        ["Casablanca-Settat", "7200", "7350", "7500"],
        ["Rabat-Salé-Kénitra", "4800", "4900", "5000"]
      ],
      "notes": ["(1) Estimations provisoires"]
    }
  ]
}`;

const ImportData = () => {
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const clearAllTables = async () => {
    setClearing(true);
    try {
      await admin.clearTables();
      toast.success('Tables vidées', { description: 'Toutes les données ont été supprimées' });
      setFileResults([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      toast.error('Erreur', { description: message });
    } finally {
      setClearing(false);
    }
  };

  const invokeImport = async (data: any): Promise<{ results?: ImportResults; error?: string }> => {
    try {
      const type = data.annuaires ? 'metadata' : 'indicateur';
      const response = await admin.importData(type, data);
      return { results: response.results };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return { error: message };
    }
  };

  /** Merge partial results into a cumulative ImportResults */
  const mergeResults = (base: ImportResults, partial: ImportResults): ImportResults => ({
    ...base,
    annuaires: { inserted: base.annuaires.inserted + partial.annuaires.inserted, errors: [...base.annuaires.errors, ...partial.annuaires.errors] },
    thematiques: { inserted: base.thematiques.inserted + partial.thematiques.inserted, errors: [...base.thematiques.errors, ...partial.thematiques.errors] },
    indicateurs: { inserted: base.indicateurs.inserted + partial.indicateurs.inserted, errors: [...base.indicateurs.errors, ...partial.indicateurs.errors] },
    indices: { inserted: base.indices.inserted + partial.indices.inserted, errors: [...base.indices.errors, ...partial.indices.errors] },
    data: { inserted: base.data.inserted + partial.data.inserted, errors: [...base.data.errors, ...partial.data.errors] },
  });

  const emptyResults = (): ImportResults => ({
    type: 'metadata',
    annuaires: { inserted: 0, errors: [] },
    thematiques: { inserted: 0, errors: [] },
    indicateurs: { inserted: 0, errors: [] },
    indices: { inserted: 0, errors: [] },
    data: { inserted: 0, errors: [] },
  });

  /**
   * Split a large metadata file: send each annuaire as its own call.
   * Upsert makes this idempotent — safe to re-run on interruption.
   */
  const processMetadataBatched = async (metadata: { annuaires: any[] }, filename: string): Promise<FileResult> => {
    const total = metadata.annuaires.length;
    let cumulative = emptyResults();
    const errors: string[] = [];

    for (let i = 0; i < total; i++) {
      if (abortRef.current) {
        errors.push(`Interrompu à l'annuaire ${i + 1}/${total}`);
        break;
      }

      const annuaire = metadata.annuaires[i];
      setProgressLabel(`Metadata: annuaire ${annuaire.annee} (${i + 1}/${total})`);
      setProgress(Math.round(((i) / total) * 100));

      const { results, error } = await invokeImport({ annuaires: [annuaire] });

      if (error) {
        errors.push(`${annuaire.annee}: ${error}`);
      } else if (results) {
        cumulative = mergeResults(cumulative, results);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    const hasErrors = errors.length > 0;
    if (hasErrors) {
      cumulative.annuaires.errors.push(...errors);
    }

    return {
      filename,
      success: errors.length === 0,
      results: cumulative,
      error: hasErrors ? errors.join('; ') : undefined,
    };
  };

  const processFile = async (file: File): Promise<FileResult> => {
    try {
      const content = await file.text();
      const data = JSON.parse(content);

      // If it's a large metadata file, use batched processing
      if ('annuaires' in data && Array.isArray(data.annuaires) && data.annuaires.length > 3) {
        return await processMetadataBatched(data, file.name);
      }

      // Otherwise, single call
      const { results, error } = await invokeImport(data);
      if (error) return { filename: file.name, success: false, error };
      return { filename: file.name, success: true, results };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de parsing JSON';
      return { filename: file.name, success: false, error: message };
    }
  };

  const handleSingleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setProgressLabel('');
    setFileResults([]);
    abortRef.current = false;

    const result = await processFile(file);
    setFileResults([result]);
    setProgress(100);
    setProgressLabel('');
    setLoading(false);

    if (result.success) {
      toast.success('Import réussi', { description: file.name });
    } else {
      toast.error('Erreur d\'import', { description: result.error });
    }
    e.target.value = '';
  };

  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let jsonFiles = Array.from(files).filter(file => file.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      toast.error('Aucun fichier JSON', { description: 'Sélectionnez des fichiers .json' });
      e.target.value = '';
      return;
    }

    // Sort: metadata.json first
    jsonFiles = jsonFiles.sort((a, b) => {
      const aIsMetadata = a.name.toLowerCase() === 'metadata.json';
      const bIsMetadata = b.name.toLowerCase() === 'metadata.json';
      if (aIsMetadata && !bIsMetadata) return -1;
      if (!aIsMetadata && bIsMetadata) return 1;
      return a.name.localeCompare(b.name);
    });

    setLoading(true);
    setProgress(0);
    setProgressLabel('');
    setFileResults([]);
    abortRef.current = false;

    const results: FileResult[] = [];
    const totalFiles = jsonFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      if (abortRef.current) break;

      const file = jsonFiles[i];
      setProgressLabel(`Fichier ${i + 1}/${totalFiles}: ${file.name}`);
      
      const result = await processFile(file);
      results.push(result);
      setProgress(Math.round(((i + 1) / totalFiles) * 100));
      setFileResults([...results]);

      // Small delay between requests to avoid overwhelming edge functions
      if (i < totalFiles - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setLoading(false);
    setProgressLabel('');

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    if (errorCount === 0) {
      toast.success('Import terminé', { description: `${successCount} fichier(s) importé(s)` });
    } else {
      toast.warning('Import partiel', {
        description: `${successCount} réussi(s), ${errorCount} erreur(s)`
      });
    }

    e.target.value = '';
  };

  const handleAbort = () => {
    abortRef.current = true;
    toast.info('Interruption demandée', { description: 'L\'import s\'arrêtera après le fichier en cours' });
  };

  const downloadTemplate = (type: 'metadata' | 'chapitre') => {
    const content = type === 'metadata' ? metadataExample : chapitreExample;
    const filename = type === 'metadata' ? 'metadata.json' : 'Chapitre_02_Population.json';
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalStats = () => {
    const stats = { annuaires: 0, thematiques: 0, indicateurs: 0, indices: 0, data: 0 };
    for (const result of fileResults) {
      if (result.results) {
        stats.annuaires += result.results.annuaires.inserted;
        stats.thematiques += result.results.thematiques.inserted;
        stats.indicateurs += result.results.indicateurs.inserted;
        stats.indices += result.results.indices.inserted;
        stats.data += result.results.data.inserted;
      }
    }
    return stats;
  };

  const stats = getTotalStats();
  const successCount = fileResults.filter(r => r.success).length;
  const errorCount = fileResults.filter(r => !r.success).length;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#58061C]/5 via-white to-[#CFA452]/5 border border-[#58061C]/15 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#58061C] to-[#3B0211] flex items-center justify-center shadow-md shadow-[#58061C]/15">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                Import de données
              </h1>
              <p className="text-slate-600 text-sm mt-2 ml-[52px]">
                Importez vos fichiers metadata et tableaux statistiques
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={clearing} className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                  {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Vider les tables
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Vider toutes les tables ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera <strong>toutes les données</strong> : annuaires, thématiques, indicateurs, indices, données et liaisons. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllTables} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
                    Confirmer la suppression
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="bg-white border-2 border-slate-200 rounded-xl p-1.5 h-auto shadow-sm">
            <TabsTrigger value="import" className="rounded-lg px-5 py-2.5 text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#58061C] data-[state=active]:to-[#3B0211] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md transition-all gap-2">
              <Upload className="h-4 w-4" /> Import
            </TabsTrigger>
            <TabsTrigger value="format" className="rounded-lg px-5 py-2.5 text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#58061C] data-[state=active]:to-[#3B0211] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-md transition-all gap-2">
              <FileJson className="h-4 w-4" /> Format des fichiers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-6">
            {/* Upload zones */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Metadata upload */}
              <div className="border-2 border-dashed border-[#58061C]/20 rounded-2xl p-6 bg-gradient-to-b from-[#58061C]/8/50 to-white hover:border-[#58061C]/50 hover:shadow-md transition-all group">
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#58061C]/15 to-[#58061C]/8 border border-[#58061C]/20 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    <File className="h-7 w-7 text-[#58061C]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">1. Metadata</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                      Créer les annuaires et thématiques à partir du fichier metadata.json
                    </p>
                  </div>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleSingleFile} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-[#58061C] to-[#3B0211] hover:from-[#6b0a24] hover:to-[#58061C]digo-500 hover:to-[#58061C] text-white shadow-sm shadow-[#58061C]/15 gap-2 w-full">
                    <Upload className="h-4 w-4" /> Charger metadata.json
                  </Button>
                </div>
              </div>

              {/* Tableaux upload */}
              <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-6 bg-gradient-to-b from-emerald-50/50 to-white hover:border-emerald-400 hover:shadow-md transition-all group">
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    <FolderOpen className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">2. Tableaux</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                      Importer un ou plusieurs fichiers JSON de tableaux statistiques
                    </p>
                  </div>
                  <input type="file" accept=".json" multiple ref={multiFileInputRef} onChange={handleMultipleFiles} className="hidden" />
                  <input type="file" ref={folderInputRef} onChange={handleMultipleFiles} className="hidden"
                    {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => multiFileInputRef.current?.click()} disabled={loading} variant="outline"
                      className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 gap-2">
                      <Upload className="h-4 w-4" /> Fichier(s) JSON
                    </Button>
                    <Button onClick={() => folderInputRef.current?.click()} disabled={loading} variant="outline"
                      className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 gap-2">
                      <FolderOpen className="h-4 w-4" /> Dossier
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            {loading && (
              <div className="border-2 border-[#58061C]/20 rounded-2xl p-5 bg-[#58061C]/8/50">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#58061C]/15 border border-[#58061C]/20 flex items-center justify-center shrink-0">
                    <Loader2 className="h-5 w-5 animate-spin text-[#58061C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-900">Import en cours...</span>
                      <span className="text-sm font-bold text-[#58061C]">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5 rounded-full" />
                  </div>
                </div>
                {progressLabel && <p className="text-xs text-slate-600 ml-14 truncate">{progressLabel}</p>}
                <div className="flex items-center gap-3 mt-3 ml-14">
                  <Button variant="outline" size="sm" onClick={handleAbort} className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs">
                    <AlertCircle className="h-3.5 w-3.5" /> Interrompre
                  </Button>
                  <span className="text-[10px] text-slate-400">Vous pouvez ré-uploader pour reprendre là où ça s'est arrêté</span>
                </div>
              </div>
            )}

            {/* Results */}
            {fileResults.length > 0 && (
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                <div className={`px-5 py-4 border-b flex items-center gap-3 ${errorCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  {errorCount === 0 ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {errorCount === 0 ? 'Import terminé avec succès !' : `Import terminé — ${errorCount} erreur${errorCount > 1 ? 's' : ''}`}
                    </h3>
                    <p className="text-xs text-slate-600">{fileResults.length} fichier{fileResults.length > 1 ? 's' : ''} traité{fileResults.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Annuaires', value: stats.annuaires, color: 'rose' },
                      { label: 'Thématiques', value: stats.thematiques, color: 'violet' },
                      { label: 'Tableaux', value: stats.indicateurs, color: 'emerald' },
                      { label: 'Indices', value: stats.indices, color: 'cyan' },
                      { label: 'Données', value: stats.data, color: 'amber' },
                    ].map(s => (
                      <div key={s.label} className={`text-center p-3 rounded-xl border bg-${s.color}-50 border-${s.color}-200`}>
                        <div className={`text-xl font-bold text-${s.color}-700`}>{s.value}</div>
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* File list */}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {fileResults.map((result, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${result.success ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-red-50/50 hover:bg-red-50'} transition-colors`}>
                        {result.success ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className="font-mono text-xs truncate flex-1 text-slate-700">{result.filename}</span>
                        {!result.success && <span className="text-[10px] text-red-600 truncate max-w-40">{result.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="format" className="space-y-6">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-[#58061C]/8 border-2 border-[#58061C]/20 rounded-xl">
              <FileJson className="h-5 w-5 text-[#58061C] mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-slate-900 mb-1">Ordre d'import recommandé</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                  <li>D'abord <strong>metadata.json</strong> pour créer les annuaires et thématiques</li>
                  <li>Puis les fichiers <strong>tableaux</strong> (un par un ou en lot via dossier)</li>
                </ol>
              </div>
            </div>

            {/* Metadata format */}
            <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-[#58061C]/8 px-5 py-3 border-b border-[#58061C]/15 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#58061C] text-white">TYPE 1</span>
                  <span className="text-sm font-bold text-slate-900">metadata.json</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate('metadata')} className="rounded-lg text-xs gap-1.5 border-[#58061C]/20 text-[#58061C] hover:bg-[#58061C]/15">
                  <Download className="h-3.5 w-3.5" /> Télécharger l'exemple
                </Button>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3">Fichier contenant les annuaires et leurs thématiques :</p>
                <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre">{metadataExample}</pre>
                </div>
              </div>
            </div>

            {/* Chapitre format */}
            <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-sky-50 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white">TYPE 2</span>
                  <span className="text-sm font-bold text-slate-900">Chapitre_X_...json</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate('chapitre')} className="rounded-lg text-xs gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-100">
                  <Download className="h-3.5 w-3.5" /> Télécharger l'exemple
                </Button>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3">Fichier de chapitre contenant plusieurs tableaux :</p>
                <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-sky-400 whitespace-pre">{chapitreExample}</pre>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default ImportData;
