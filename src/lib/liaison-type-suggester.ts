import type { StructureComparison } from '@/hooks/useStructureComparison';

export type LiaisonType =
  | 'remplace'
  | 'fusionne'
  | 'extension_horizontale';

export interface TypeSuggestion {
  type: LiaisonType;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

const fmt = (arr: string[]) => arr.length ? `[${arr.join(', ')}]` : '∅';

export const suggestLiaisonType = (
  comparison: StructureComparison | null
): TypeSuggestion => {
  if (!comparison) {
    return { type: 'fusionne', reason: 'Analyse en cours...', confidence: 'low' };
  }

  const { score, scoreDetails, years } = comparison;
  const { colonnes } = scoreDetails;
  const safeYears = years ?? { source: [], cible: [], intersection: [], sourceOnly: [], cibleOnly: [] };
  const { source: sY, cible: cY, intersection, sourceOnly, cibleOnly } = safeYears;

  const structureCompatible = colonnes.match && scoreDetails.entetesTexte.score >= 50;

  // === Logique principale : basée sur les années détectées ===
  if (sY.length > 0 && cY.length > 0) {
    // Cible contient déjà toutes les années source → REMPLACE
    if (sourceOnly.length === 0 && cibleOnly.length > 0) {
      return {
        type: 'remplace',
        reason: `Cible inclut toutes les années source + ${fmt(cibleOnly)} en plus — source ${fmt(sY)} ⊂ cible ${fmt(cY)}`,
        confidence: 'high',
      };
    }

    // Ensembles identiques → REMPLACE (doublon / mise à jour de mêmes années)
    if (sourceOnly.length === 0 && cibleOnly.length === 0) {
      return {
        type: 'remplace',
        reason: `Mêmes années des deux côtés ${fmt(sY)} — la cible remplace la source`,
        confidence: 'high',
      };
    }

    // Années totalement disjointes → EXTENSION HORIZONTALE
    if (intersection.length === 0) {
      return {
        type: 'extension_horizontale',
        reason: `Années disjointes : source ${fmt(sY)} ∩ cible ${fmt(cY)} = ∅ — étendre la série`,
        confidence: structureCompatible ? 'high' : 'medium',
      };
    }

    // Recouvrement partiel (intersection ≠ ∅, mais chaque côté a des années propres)
    // → FUSIONNE (fenêtre glissante typique)
    if (intersection.length > 0 && sourceOnly.length > 0 && cibleOnly.length > 0) {
      return {
        type: 'fusionne',
        reason: `Recouvrement partiel — communes ${fmt(intersection)}, source seule ${fmt(sourceOnly)}, cible seule ${fmt(cibleOnly)}`,
        confidence: structureCompatible ? 'high' : 'medium',
      };
    }
  }

  // === Fallback : aucune année détectée → on retombe sur la structure ===
  if (colonnes.cible > colonnes.source) {
    const diff = colonnes.cible - colonnes.source;
    return {
      type: 'fusionne',
      reason: `+${diff} colonne(s) ajoutée(s) dans la cible (${colonnes.source} → ${colonnes.cible})`,
      confidence: 'medium',
    };
  }

  if (colonnes.cible < colonnes.source || score < 60) {
    return {
      type: 'remplace',
      reason: `Structure modifiée (score: ${score}%)`,
      confidence: 'medium',
    };
  }

  return {
    type: 'fusionne',
    reason: `Aucune année détectée dans les entêtes — fusion par défaut (score ${score}%)`,
    confidence: 'low',
  };
};
