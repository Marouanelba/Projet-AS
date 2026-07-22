import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Table2, Columns, Rows3 } from 'lucide-react';
import { StructureComparison as StructureComparisonType, IndicateurData } from '@/hooks/useStructureComparison';
import { cn } from '@/lib/utils';

interface StructureComparisonProps {
  loading: boolean;
  comparison: StructureComparisonType | null;
  sourceData: IndicateurData | null;
  cibleData: IndicateurData | null;
  error: string | null;
}

// Composant pour afficher le score de compatibilité
const CompatibilityScore = ({ score, compatible }: { score: number; compatible: boolean }) => {
  const getScoreColor = () => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-amber-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreLabel = () => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Compatible';
    if (score >= 50) return 'Attention';
    return 'Incompatible';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted stroke-current"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={cn("stroke-current", getScoreColor().replace('bg-', 'text-'))}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${score}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{score}%</span>
        </div>
      </div>
      <div>
        <Badge className={cn(getScoreColor(), 'text-white')}>
          {getScoreLabel()}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">
          {compatible ? 'Structure compatible' : 'Vérifiez les différences'}
        </p>
      </div>
    </div>
  );
};

// Composant pour afficher un aperçu des entêtes
const HeaderPreview = ({ 
  data, 
  label 
}: { 
  data: IndicateurData | null; 
  label: string 
}) => {
  if (!data) return null;

  const entetes = data.entetes as unknown[][];
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Table2 className="h-4 w-4" />
        {label}
      </h4>
      <div className="overflow-auto max-h-[300px]">
        <table className="text-xs border-collapse w-full">
          <tbody>
            {entetes.slice(0, 4).map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border/50">
                {(row as unknown[]).slice(0, 8).map((cell, cellIdx) => (
                  <td 
                    key={cellIdx} 
                    className="px-2 py-1 border-r border-border/50 bg-muted/30 max-w-[120px] truncate"
                    title={String(cell || '')}
                  >
                    {String(cell || '').substring(0, 20)}
                    {String(cell || '').length > 20 ? '...' : ''}
                  </td>
                ))}
                {(row as unknown[]).length > 8 && (
                  <td className="px-2 py-1 text-muted-foreground">
                    +{(row as unknown[]).length - 8}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {entetes.length} ligne(s) d'en-têtes • {(entetes[0] as unknown[] || []).length} colonnes
      </p>
    </div>
  );
};

export const StructureComparisonComponent = ({
  loading,
  comparison,
  sourceData,
  cibleData,
  error
}: StructureComparisonProps) => {
  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Analyse des structures...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erreur</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!comparison || !sourceData || !cibleData) {
    return null;
  }

  const { score, scoreDetails, compatible, warnings } = comparison;

  return (
    <Card className={cn(
      "border-2 transition-colors",
      compatible ? "border-green-500/30" : "border-amber-500/30"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Columns className="h-5 w-5" />
            Analyse de compatibilité des structures
          </span>
          <CompatibilityScore score={score} compatible={compatible} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertes */}
        {!compatible && warnings.length > 0 && (
          <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600">Attention</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Détails de la comparaison */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          {/* Colonnes */}
          <div className={cn(
            "p-3 rounded-lg border",
            scoreDetails.colonnes.match ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {scoreDetails.colonnes.match ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-medium">Colonnes</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Source: <span className="font-mono">{scoreDetails.colonnes.source}</span> | 
              Cible: <span className="font-mono">{scoreDetails.colonnes.cible}</span>
            </div>
          </div>

          {/* Lignes d'en-têtes */}
          <div className={cn(
            "p-3 rounded-lg border",
            scoreDetails.lignesEntetes.match ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {scoreDetails.lignesEntetes.match ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-medium">Lignes en-têtes</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Source: <span className="font-mono">{scoreDetails.lignesEntetes.source}</span> | 
              Cible: <span className="font-mono">{scoreDetails.lignesEntetes.cible}</span>
            </div>
          </div>

          {/* Textes d'en-têtes */}
          <div className={cn(
            "p-3 rounded-lg border",
            scoreDetails.entetesTexte.score >= 70 ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {scoreDetails.entetesTexte.score >= 70 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-medium">Textes en-têtes</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{scoreDetails.entetesTexte.score}%</span> de correspondance
            </div>
          </div>
        </div>

        {/* Aperçu comparatif des en-têtes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <HeaderPreview data={sourceData} label="En-têtes Source" />
          <HeaderPreview data={cibleData} label="En-têtes Cible" />
        </div>

        {/* Correspondances détaillées des textes */}
        {scoreDetails.entetesTexte.details.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Rows3 className="h-4 w-4" />
              Correspondance des textes d'en-têtes
            </h4>
            <div className="flex flex-wrap gap-2">
              {scoreDetails.entetesTexte.details.slice(0, 10).map((detail, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline"
                  className={cn(
                    "text-xs",
                    detail.match ? "border-green-500/50 bg-green-500/10" : "border-amber-500/50 bg-amber-500/10"
                  )}
                >
                  {detail.match ? '✓' : '✗'} {detail.source.substring(0, 25)}
                </Badge>
              ))}
              {scoreDetails.entetesTexte.details.length > 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{scoreDetails.entetesTexte.details.length - 10} autres
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StructureComparisonComponent;
