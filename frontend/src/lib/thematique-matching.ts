import { normalizeThematiqueName } from './thematique-utils';

export interface IncomingThematique {
  code: string;
  nom: string;
  nom_ar?: string;
  nb_tableaux?: number;
  nb_indicateurs?: number;
  fichier_source?: string;
}

export interface ExistingThematique {
  id: number;
  code: string;
  nom_fr: string;
  annee: string;
}

export type MatchStatus = 'exact' | 'close' | 'new';

export interface MatchCandidate {
  thematique: ExistingThematique;
  score: number;
}

export interface ThematiqueMatchResult {
  incoming: IncomingThematique;
  normalizedName: string;
  status: MatchStatus;
  bestMatch: MatchCandidate | null;
  candidates: MatchCandidate[];
  selectedMatch: ExistingThematique | null;
  resolvedName: string;
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(str: string): Set<string> {
  return new Set(
    removeAccents(str.toLowerCase())
      .split(/[\s\-_']+/)
      .filter(w => w.length >= 2)
  );
}

/**
 * Distance de Levenshtein entre deux chaînes
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Vérifie si deux tokens sont "proches" :
 * - l'un commence par l'autre (préfixe/abréviation)
 * - distance d'édition <= 2 pour les mots de 4+ caractères
 */
function areTokensSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // Distance d'édition pour les mots assez longs
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 4) {
    const maxDist = minLen >= 6 ? 2 : 1;
    if (levenshtein(a, b) <= maxDist) return true;
  }
  return false;
}

function partialWordOverlap(tokensA: Set<string>, tokensB: Set<string>): number {
  let matches = 0;
  const total = Math.max(tokensA.size, tokensB.size);
  if (total === 0) return 1;

  for (const a of tokensA) {
    for (const b of tokensB) {
      if (areTokensSimilar(a, b)) {
        matches++;
        break;
      }
    }
  }

  return matches / total;
}

/**
 * Jaccard amélioré : considère les tokens similaires (pas seulement identiques)
 */
function fuzzyJaccard(tokensA: Set<string>, tokensB: Set<string>): number {
  const arrA = [...tokensA];
  const arrB = [...tokensB];
  const usedB = new Set<number>();
  let matchCount = 0;

  for (const a of arrA) {
    for (let j = 0; j < arrB.length; j++) {
      if (!usedB.has(j) && areTokensSimilar(a, arrB[j])) {
        matchCount++;
        usedB.add(j);
        break;
      }
    }
  }

  const unionSize = arrA.length + arrB.length - matchCount;
  return unionSize === 0 ? 1 : matchCount / unionSize;
}

export function calculateSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeThematiqueName(nameA);
  const normB = normalizeThematiqueName(nameB);

  if (normA === normB) return 1.0;

  const cleanA = removeAccents(normA.toLowerCase());
  const cleanB = removeAccents(normB.toLowerCase());
  if (cleanA === cleanB) return 0.95;

  const tokensA = tokenize(normA);
  const tokensB = tokenize(normB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  // Fuzzy Jaccard (tokens similaires comptent)
  const jaccard = fuzzyJaccard(tokensA, tokensB);

  // Partial word overlap (handles abbreviations)
  const partial = partialWordOverlap(tokensA, tokensB);

  // Substring bonus
  const containsBonus = cleanA.includes(cleanB) || cleanB.includes(cleanA) ? 0.2 : 0;

  // Levenshtein sur la chaîne complète (bonus si très proche)
  const fullDist = levenshtein(cleanA, cleanB);
  const maxLen = Math.max(cleanA.length, cleanB.length);
  const fullSimilarity = maxLen > 0 ? 1 - fullDist / maxLen : 1;
  const fullBonus = fullSimilarity >= 0.75 ? fullSimilarity * 0.15 : 0;

  return Math.min(1, Math.max(jaccard, partial * 0.85) + containsBonus + fullBonus);
}

export function matchThematiques(
  incoming: IncomingThematique[],
  existing: ExistingThematique[]
): ThematiqueMatchResult[] {
  if (existing.length === 0) {
    return incoming.map(inc => ({
      incoming: inc,
      normalizedName: normalizeThematiqueName(inc.nom),
      status: 'new' as const,
      bestMatch: null,
      candidates: [],
      selectedMatch: null,
      resolvedName: normalizeThematiqueName(inc.nom),
    }));
  }

  // Deduplicate existing by normalized name
  const uniqueExisting = new Map<string, ExistingThematique>();
  for (const ext of existing) {
    const norm = removeAccents(normalizeThematiqueName(ext.nom_fr).toLowerCase());
    if (!uniqueExisting.has(norm)) {
      uniqueExisting.set(norm, ext);
    }
  }

  return incoming.map(inc => {
    const normalizedName = normalizeThematiqueName(inc.nom);

    const candidates: MatchCandidate[] = [];
    for (const ext of uniqueExisting.values()) {
      const score = calculateSimilarity(inc.nom, ext.nom_fr);
      if (score >= 0.15) {
        candidates.push({ thematique: ext, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates.length > 0 ? candidates[0] : null;
    const score = bestMatch?.score ?? 0;

    let status: MatchStatus;
    if (score >= 0.85) {
      status = 'exact';
    } else if (score >= 0.35) {
      status = 'close';
    } else {
      status = 'new';
    }

    // For 'new' status, include all reference thematiques as candidates so user can pick manually
    let finalCandidates = candidates.slice(0, 8);
    if (status === 'new' && finalCandidates.length < 5) {
      // Add remaining reference thematiques not already in candidates
      const candidateIds = new Set(finalCandidates.map(c => c.thematique.id));
      for (const ext of uniqueExisting.values()) {
        if (!candidateIds.has(ext.id)) {
          finalCandidates.push({ thematique: ext, score: 0 });
        }
      }
    }

    return {
      incoming: inc,
      normalizedName,
      status,
      bestMatch,
      candidates: finalCandidates,
      selectedMatch: status !== 'new' && bestMatch ? bestMatch.thematique : null,
      resolvedName: status === 'exact' && bestMatch
        ? normalizeThematiqueName(bestMatch.thematique.nom_fr)
        : normalizedName,
    };
  });
}
