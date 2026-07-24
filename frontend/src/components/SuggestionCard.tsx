import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Check, X, FileText, RefreshCw, Equal, GitMerge, Replace, Ban, ArrowLeftRight } from 'lucide-react';
import { useStructureComparison } from '@/hooks/useStructureComparison';
import { StructureComparisonComponent } from '@/components/StructureComparison';
import { suggestLiaisonType, type TypeSuggestion } from '@/lib/liaison-type-suggester';

interface IndicateurDetail {
  id: number;
  code: string;
  titre_fr: string;
  notes_fr: string | null;
  source_fr: string | null;
  unite_fr: string | null;
  indices: { id: number; code_indice: string; signification_fr: string | null }[];
}

interface Suggestion {
  source_id: number;
  source_code: string;
  source_titre: string;
  source_annee: string;
  cible_id: number;
  cible_code: string;
  cible_titre: string;
  cible_annee: string;
  similarite: number;
  source_detail?: IndicateurDetail | null;
  cible_detail?: IndicateurDetail | null;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (suggestion: Suggestion, typeLiaison: string) => void;
  onReject: (suggestion: Suggestion) => void;
  onMarkAsRupture?: (indicateurId: number, annee: string, direction: 'precedente' | 'suivante') => void;
}

const LIAISON_TYPES = [
  { value: 'remplace', label: 'Remplace', icon: Replace, description: 'Nouvelle méthodologie, rupture de série' },
  { value: 'fusionne', label: 'Fusionne', icon: GitMerge, description: 'Plusieurs indicateurs combinés' },
  { value: 'extension_horizontale', label: 'Extension horizontale', icon: ArrowLeftRight, description: 'Étendre les années manquantes entre deux indicateurs' },
];

export const SuggestionCard = ({ suggestion: s, onAccept, onReject, onMarkAsRupture }: SuggestionCardProps) => {
  const { loading, comparison, sourceData, cibleData, error } = useStructureComparison(s.source_id, s.cible_id);
  const [selectedType, setSelectedType] = useState<string>('fusionne');
  const [typeSuggestion, setTypeSuggestion] = useState<TypeSuggestion | null>(null);

  // Mettre à jour la suggestion de type quand la comparaison est prête
  useEffect(() => {
    if (!loading && comparison) {
      const suggestion = suggestLiaisonType(comparison);
      setTypeSuggestion(suggestion);
      setSelectedType(suggestion.type);
    }
  }, [loading, comparison]);

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500/10 text-green-600 text-xs">Confiance élevée</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/10 text-amber-600 text-xs">Confiance moyenne</Badge>;
      case 'low':
        return <Badge className="bg-red-500/10 text-red-600 text-xs">À vérifier</Badge>;
    }
  };

  const selectedTypeInfo = LIAISON_TYPES.find(t => t.value === selectedType);
  const TypeIcon = selectedTypeInfo?.icon || RefreshCw;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header avec résumé */}
      <div className="flex items-center gap-4 p-4 bg-muted/30">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{s.source_annee}</Badge>
            <span className="font-mono text-sm">{s.source_code}</span>
          </div>
          <p className="text-sm font-medium">{s.source_titre}</p>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <ArrowRight className="h-5 w-5 text-primary" />
          <Badge className="bg-amber-500/10 text-amber-600 text-xs">
            {Math.round(s.similarite * 100)}% similaire
          </Badge>
        </div>
        
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <span className="font-mono text-sm">{s.cible_code}</span>
            <Badge variant="outline">{s.cible_annee}</Badge>
          </div>
          <p className="text-sm font-medium">{s.cible_titre}</p>
        </div>
      </div>
      
      {/* Détails des deux indicateurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Détails source */}
        <div className="p-3 rounded-md bg-muted/20 border space-y-2 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium border-b pb-2 mb-2">
            <FileText className="h-4 w-4" />
            Source ({s.source_annee})
          </div>
          
          {s.source_detail ? (
            <>
              {s.source_detail.unite_fr && (
                <div>
                  <span className="text-muted-foreground">Unité:</span>{' '}
                  <span>{s.source_detail.unite_fr}</span>
                </div>
              )}
              {s.source_detail.source_fr && (
                <div>
                  <span className="text-muted-foreground">Source:</span>{' '}
                  <span className="text-xs">{s.source_detail.source_fr}</span>
                </div>
              )}
              {s.source_detail.notes_fr && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>{' '}
                  <span className="text-xs">{s.source_detail.notes_fr}</span>
                </div>
              )}
              {s.source_detail.indices.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Indices:</span>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {s.source_detail.indices.slice(0, 5).map(idx => (
                      <li key={idx.id}>
                        <span className="font-mono">{idx.code_indice}</span>
                        {idx.signification_fr && `: ${idx.signification_fr}`}
                      </li>
                    ))}
                    {s.source_detail.indices.length > 5 && (
                      <li className="text-muted-foreground">+{s.source_detail.indices.length - 5} autres...</li>
                    )}
                  </ul>
                </div>
              )}
              {!s.source_detail.unite_fr && !s.source_detail.source_fr && !s.source_detail.notes_fr && s.source_detail.indices.length === 0 && (
                <p className="text-muted-foreground italic">Aucun détail</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground italic">Aucun détail disponible</p>
          )}
        </div>
        
        {/* Détails cible */}
        <div className="p-3 rounded-md bg-muted/20 border space-y-2 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium border-b pb-2 mb-2">
            <FileText className="h-4 w-4" />
            Cible ({s.cible_annee})
          </div>
          
          {s.cible_detail ? (
            <>
              {s.cible_detail.unite_fr && (
                <div>
                  <span className="text-muted-foreground">Unité:</span>{' '}
                  <span>{s.cible_detail.unite_fr}</span>
                </div>
              )}
              {s.cible_detail.source_fr && (
                <div>
                  <span className="text-muted-foreground">Source:</span>{' '}
                  <span className="text-xs">{s.cible_detail.source_fr}</span>
                </div>
              )}
              {s.cible_detail.notes_fr && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>{' '}
                  <span className="text-xs">{s.cible_detail.notes_fr}</span>
                </div>
              )}
              {s.cible_detail.indices.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Indices:</span>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {s.cible_detail.indices.slice(0, 5).map(idx => (
                      <li key={idx.id}>
                        <span className="font-mono">{idx.code_indice}</span>
                        {idx.signification_fr && `: ${idx.signification_fr}`}
                      </li>
                    ))}
                    {s.cible_detail.indices.length > 5 && (
                      <li className="text-muted-foreground">+{s.cible_detail.indices.length - 5} autres...</li>
                    )}
                  </ul>
                </div>
              )}
              {!s.cible_detail.unite_fr && !s.cible_detail.source_fr && !s.cible_detail.notes_fr && s.cible_detail.indices.length === 0 && (
                <p className="text-muted-foreground italic">Aucun détail</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground italic">Aucun détail disponible</p>
          )}
        </div>
      </div>
      
      {/* Comparaison de structure */}
      <div className="px-4 pb-2">
        <StructureComparisonComponent
          loading={loading}
          comparison={comparison}
          sourceData={sourceData}
          cibleData={cibleData}
          error={error}
        />
      </div>
      
      {/* Sélection du type de liaison avec suggestion intelligente */}
      <div className="mx-4 mb-4 p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Type de liaison suggéré</span>
              {typeSuggestion && getConfidenceBadge(typeSuggestion.confidence)}
            </div>
            {typeSuggestion && (
              <p className="text-xs text-muted-foreground">
                {typeSuggestion.reason}
              </p>
            )}
          </div>
          
          <div className="w-full sm:w-64">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIAISON_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedTypeInfo && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTypeInfo.description}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2 p-4 pt-0">
        {onMarkAsRupture && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-200"
            onClick={() => {
              // Déterminer la direction basée sur les années
              const sourceYear = parseInt(s.source_annee);
              const cibleYear = parseInt(s.cible_annee);
              const direction = cibleYear < sourceYear ? 'precedente' : 'suivante';
              onMarkAsRupture(s.source_id, s.source_annee, direction);
            }}
            title="Marquer ce tableau comme interrompu (pas de continuité)"
          >
            <Ban className="h-4 w-4 mr-1" />
            Rupture
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onReject(s)}
        >
          <X className="h-4 w-4 mr-1" />
          Ignorer
        </Button>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onAccept(s, selectedType)}
        >
          <Check className="h-4 w-4 mr-1" />
          Lier ({LIAISON_TYPES.find(t => t.value === selectedType)?.label})
        </Button>
      </div>
    </div>
  );
};
