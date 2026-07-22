import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, AlertTriangle, Plus, ArrowRight } from 'lucide-react';
import { ThematiqueMatchResult, MatchCandidate } from '@/lib/thematique-matching';
import { normalizeThematiqueName } from '@/lib/thematique-utils';

interface ThematiqueMatchingModalProps {
  open: boolean;
  matches: ThematiqueMatchResult[];
  annee: string;
  onValidate: (matches: ThematiqueMatchResult[]) => void;
  onCancel: () => void;
}

const ThematiqueMatchingModal = ({ open, matches, annee, onValidate, onCancel }: ThematiqueMatchingModalProps) => {
  const [localMatches, setLocalMatches] = useState<ThematiqueMatchResult[]>(matches);

  useEffect(() => {
    setLocalMatches([...matches]);
  }, [matches]);

  const exactCount = localMatches.filter(m => m.status === 'exact').length;
  const closeCount = localMatches.filter(m => m.status === 'close').length;
  const newCount = localMatches.filter(m => m.status === 'new').length;

  const handleSelectMatch = (code: string, candidate: MatchCandidate | null) => {
    setLocalMatches(prev => prev.map(m => {
      if (m.incoming.code !== code) return m;
      if (candidate) {
        return {
          ...m,
          selectedMatch: candidate.thematique,
          resolvedName: normalizeThematiqueName(candidate.thematique.nom_fr),
        };
      }
      return {
        ...m,
        selectedMatch: null,
        resolvedName: m.normalizedName,
      };
    }));
  };

  // Sort: close first (need attention), then new, then exact
  const sortedMatches = [...localMatches].sort((a, b) => {
    const order = { close: 0, new: 1, exact: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Correspondance des thématiques</DialogTitle>
          <DialogDescription>
            Annuaire {annee} — Vérifiez les correspondances avec les thématiques existantes
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 text-sm flex-wrap">
          {exactCount > 0 && (
            <Badge className="gap-1 bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-3 w-3" /> {exactCount} correspondance(s) exacte(s)
            </Badge>
          )}
          {closeCount > 0 && (
            <Badge className="gap-1 bg-amber-500 hover:bg-amber-600">
              <AlertTriangle className="h-3 w-3" /> {closeCount} à confirmer
            </Badge>
          )}
          {newCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Plus className="h-3 w-3" /> {newCount} nouvelle(s)
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-2">
            {sortedMatches.map((match) => (
              <MatchRow
                key={match.incoming.code}
                match={match}
                onSelectMatch={(candidate) => handleSelectMatch(match.incoming.code, candidate)}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button onClick={() => onValidate(localMatches)}>
            Valider et importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MatchRow = ({ match, onSelectMatch }: {
  match: ThematiqueMatchResult;
  onSelectMatch: (candidate: MatchCandidate | null) => void;
}) => {
  const statusConfig = {
    exact: {
      bg: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
      icon: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
    },
    close: {
      bg: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
    },
    new: {
      bg: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20',
      icon: <Plus className="h-4 w-4 text-blue-500 shrink-0" />,
    },
  };

  const config = statusConfig[match.status];

  return (
    <div className={`p-3 rounded-lg border ${config.bg} flex items-center gap-3`}>
      {config.icon}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0 font-mono">
            {match.incoming.code}
          </Badge>
          <span className="text-sm font-medium truncate">
            {match.normalizedName}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          Fichier : {match.incoming.nom}
        </div>
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        {match.status === 'exact' && match.bestMatch && (
          <div className="text-right">
            <span className="text-sm text-green-700 dark:text-green-400 font-medium">
              {normalizeThematiqueName(match.bestMatch.thematique.nom_fr)}
            </span>
            <div className="text-xs text-muted-foreground">
              Annuaire {match.bestMatch.thematique.annee} · {Math.round(match.bestMatch.score * 100)}%
            </div>
          </div>
        )}

        {match.status === 'close' && (
          <Select
            value={match.selectedMatch?.id.toString() ?? '__new__'}
            onValueChange={(val) => {
              if (val === '__new__') {
                onSelectMatch(null);
              } else {
                const candidate = match.candidates.find(c => c.thematique.id.toString() === val);
                if (candidate) onSelectMatch(candidate);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {match.candidates.map(c => (
                <SelectItem key={c.thematique.id} value={c.thematique.id.toString()}>
                  {normalizeThematiqueName(c.thematique.nom_fr)} · {c.thematique.annee} ({Math.round(c.score * 100)}%)
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                ➕ Créer comme nouvelle thématique
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {match.status === 'new' && (
          <Select
            value={match.selectedMatch?.id.toString() ?? '__new__'}
            onValueChange={(val) => {
              if (val === '__new__') {
                onSelectMatch(null);
              } else {
                const candidate = match.candidates.find(c => c.thematique.id.toString() === val);
                if (candidate) onSelectMatch(candidate);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choisir une correspondance..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">
                ➕ Créer comme nouvelle thématique
              </SelectItem>
              {match.candidates.length > 0 && match.candidates.map(c => (
                <SelectItem key={c.thematique.id} value={c.thematique.id.toString()}>
                  {normalizeThematiqueName(c.thematique.nom_fr)} · {c.thematique.annee} ({Math.round(c.score * 100)}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};

export default ThematiqueMatchingModal;
