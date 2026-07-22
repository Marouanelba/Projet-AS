import { useState, useEffect } from 'react';
import { tableauxData } from '@/lib/api';

export interface IndicateurData {
  id: number;
  entetes: unknown[][];
  donnees: unknown[][];
}

export interface StructureAnalysis {
  nbColonnes: number;
  nbLignesEntetes: number;
  nbLignesDonnees: number;
  entetesNormalises: string[];
  premiereLigneDonnees: unknown[];
}

export interface StructureComparison {
  score: number;
  scoreDetails: {
    colonnes: { match: boolean; source: number; cible: number };
    lignesEntetes: { match: boolean; source: number; cible: number };
    entetesTexte: { score: number; details: { source: string; cible: string; match: boolean }[] };
  };
  years: {
    source: string[];
    cible: string[];
    intersection: string[];
    sourceOnly: string[];
    cibleOnly: string[];
  };
  compatible: boolean;
  warnings: string[];
}

// Extrait les années (et plages d'années) depuis les entêtes
// Reconnaît: "2024", "2023-2022", "2024/2023", "Année 2023", etc.
const extractYears = (entetes: unknown[][]): string[] => {
  const found = new Set<string>();
  if (!Array.isArray(entetes)) return [];

  const yearRegex = /\b(19|20)\d{2}\b/g;

  for (const row of entetes) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell == null) continue;
      const str = String(cell);
      const matches = str.match(yearRegex);
      if (matches) {
        for (const y of matches) found.add(y);
      }
    }
  }

  return Array.from(found).sort();
};

// Normalise une chaîne pour comparaison (supprime espaces, accents, minuscules)
const normalizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ')
    .trim();
};

// Extrait les textes significatifs des entêtes (ignore les cellules vides)
const extractHeaderTexts = (entetes: unknown[][]): string[] => {
  const texts: string[] = [];
  
  if (!Array.isArray(entetes)) return texts;
  
  // Parcourir toutes les lignes d'entêtes
  for (const row of entetes) {
    if (!Array.isArray(row)) continue;
    
    for (const cell of row) {
      if (cell && typeof cell === 'string') {
        const normalized = normalizeText(cell);
        // Ignorer les cellules trop courtes ou vides
        if (normalized.length > 2 && !texts.includes(normalized)) {
          texts.push(normalized);
        }
      }
    }
  }
  
  return texts;
};

// Calcule la similarité entre deux textes (Jaccard sur les mots)
const textSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

// Analyse la structure d'un indicateur
const analyzeStructure = (data: IndicateurData): StructureAnalysis => {
  const entetes = data.entetes as unknown[][];
  const donnees = data.donnees as unknown[][];
  
  // Nombre de colonnes (basé sur la première ligne de données)
  const premiereLigne = donnees[0] || [];
  const nbColonnes = Array.isArray(premiereLigne) ? premiereLigne.length : 0;
  
  // Nombre de lignes d'entêtes
  const nbLignesEntetes = Array.isArray(entetes) ? entetes.length : 0;
  
  // Extraire les textes des entêtes
  const entetesNormalises = extractHeaderTexts(entetes);
  
  return {
    nbColonnes,
    nbLignesEntetes,
    nbLignesDonnees: Array.isArray(donnees) ? donnees.length : 0,
    entetesNormalises,
    premiereLigneDonnees: premiereLigne
  };
};

// Compare deux structures
export const compareStructures = (
  sourceData: IndicateurData,
  cibleData: IndicateurData
): StructureComparison => {
  const sourceAnalysis = analyzeStructure(sourceData);
  const cibleAnalysis = analyzeStructure(cibleData);
  
  const warnings: string[] = [];
  
  // 1. Comparaison du nombre de colonnes
  const colonnesMatch = sourceAnalysis.nbColonnes === cibleAnalysis.nbColonnes;
  if (!colonnesMatch) {
    warnings.push(`Nombre de colonnes différent: ${sourceAnalysis.nbColonnes} vs ${cibleAnalysis.nbColonnes}`);
  }
  
  // 2. Comparaison du nombre de lignes d'entêtes
  const lignesEntetesMatch = sourceAnalysis.nbLignesEntetes === cibleAnalysis.nbLignesEntetes;
  if (!lignesEntetesMatch) {
    warnings.push(`Structure d'en-têtes différente: ${sourceAnalysis.nbLignesEntetes} vs ${cibleAnalysis.nbLignesEntetes} lignes`);
  }
  
  // 3. Comparaison des textes d'entêtes
  const entetesDetails: { source: string; cible: string; match: boolean }[] = [];
  let entetesMatchCount = 0;
  
  const maxLength = Math.max(
    sourceAnalysis.entetesNormalises.length,
    cibleAnalysis.entetesNormalises.length
  );
  
  // Pour chaque entête source, chercher le meilleur match dans cible
  for (const sourceHeader of sourceAnalysis.entetesNormalises) {
    let bestMatch = '';
    let bestScore = 0;
    
    for (const cibleHeader of cibleAnalysis.entetesNormalises) {
      const score = textSimilarity(sourceHeader, cibleHeader);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cibleHeader;
      }
    }
    
    const isMatch = bestScore > 0.5;
    if (isMatch) entetesMatchCount++;
    
    entetesDetails.push({
      source: sourceHeader,
      cible: bestMatch || '(aucun)',
      match: isMatch
    });
  }
  
  const entetesScore = maxLength > 0 ? entetesMatchCount / maxLength : 1;
  
  if (entetesScore < 0.7) {
    warnings.push(`Seulement ${Math.round(entetesScore * 100)}% des en-têtes correspondent`);
  }
  
  // Score global (pondéré)
  let score = 0;
  score += colonnesMatch ? 40 : (1 - Math.abs(sourceAnalysis.nbColonnes - cibleAnalysis.nbColonnes) / Math.max(sourceAnalysis.nbColonnes, cibleAnalysis.nbColonnes, 1)) * 20;
  score += lignesEntetesMatch ? 20 : 10;
  score += entetesScore * 40;
  
  // Arrondir le score
  score = Math.round(score);
  
  // Extraction des années
  const sourceYears = extractYears(sourceData.entetes as unknown[][]);
  const cibleYears = extractYears(cibleData.entetes as unknown[][]);
  const cibleSet = new Set(cibleYears);
  const sourceSet = new Set(sourceYears);
  const intersection = sourceYears.filter(y => cibleSet.has(y));
  const sourceOnly = sourceYears.filter(y => !cibleSet.has(y));
  const cibleOnly = cibleYears.filter(y => !sourceSet.has(y));

  return {
    score,
    scoreDetails: {
      colonnes: {
        match: colonnesMatch,
        source: sourceAnalysis.nbColonnes,
        cible: cibleAnalysis.nbColonnes
      },
      lignesEntetes: {
        match: lignesEntetesMatch,
        source: sourceAnalysis.nbLignesEntetes,
        cible: cibleAnalysis.nbLignesEntetes
      },
      entetesTexte: {
        score: Math.round(entetesScore * 100),
        details: entetesDetails
      }
    },
    years: {
      source: sourceYears,
      cible: cibleYears,
      intersection,
      sourceOnly,
      cibleOnly,
    },
    compatible: score >= 70,
    warnings
  };
};

// Hook pour comparer deux indicateurs
export const useStructureComparison = (sourceId: number | null, cibleId: number | null) => {
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<StructureComparison | null>(null);
  const [sourceData, setSourceData] = useState<IndicateurData | null>(null);
  const [cibleData, setCibleData] = useState<IndicateurData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndCompare = async () => {
      if (!sourceId || !cibleId) {
        setComparison(null);
        setSourceData(null);
        setCibleData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [sourceRes, cibleRes] = await Promise.all([
          tableauxData.getByTableau(sourceId),
          tableauxData.getByTableau(cibleId)
        ]);

        if (!sourceRes) {
          setError('Données source non trouvées');
          setLoading(false);
          return;
        }

        if (!cibleRes) {
          setError('Données cible non trouvées');
          setLoading(false);
          return;
        }

        const source: IndicateurData = {
          id: sourceRes.id,
          entetes: sourceRes.entetes as unknown[][],
          donnees: sourceRes.donnees as unknown[][]
        };

        const cible: IndicateurData = {
          id: cibleRes.id,
          entetes: cibleRes.entetes as unknown[][],
          donnees: cibleRes.donnees as unknown[][]
        };

        setSourceData(source);
        setCibleData(cible);
        setComparison(compareStructures(source, cible));
      } catch (err) {
        setError('Erreur lors de la comparaison');
        console.error(err);
      }

      setLoading(false);
    };

    fetchAndCompare();
  }, [sourceId, cibleId]);

  return { loading, comparison, sourceData, cibleData, error };
};
