/**
 * Utilitaires pour la normalisation des titres d'indicateurs
 * Utilisé par les pages admin et publique pour garantir un regroupement cohérent
 */

/**
 * Normalise une chaîne pour comparaison/regroupement
 * - Supprime les accents (É -> E, è -> e, etc.)
 * - Met en minuscule
 * - Supprime les espaces en début/fin
 */
export const normalizeForComparison = (value: string): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Nettoie le titre d'un indicateur pour le regroupement
 * - Supprime le préfixe code (ex: "2-1", "2 - 10")
 * - Supprime les suffixes d'unités (ex: "(en milliers)", "(en %)")
 * - GARDE les indices numériques comme (1), (2) pour différencier les indicateurs
 * - Normalise les accents et la casse pour fusionner les variantes
 * 
 * @param titre - Le titre brut de l'indicateur
 * @param options - Options de nettoyage
 * @returns Le titre nettoyé
 */
export const cleanIndicateurTitle = (
  titre: string,
  options: {
    removeIndices?: boolean; // Si true, supprime aussi les indices (1), (2)
    normalizeAccents?: boolean; // Si true, normalise les accents (défaut: true)
  } = {}
): string => {
  const { removeIndices = false, normalizeAccents = true } = options;

  // D'abord, supprime le préfixe numéroté comme "2 - 1 ", "1-2 ", "2-10 -", etc.
  let cleaned = titre.replace(/^\d+\s*[-–]\s*\d+\s*[-–]?\s*/gi, '').trim();

  // Supprime les suffixes d'unités comme (en milliers), (en %), etc.
  // MAIS on garde les indices numériques comme (1), (2) par défaut
  cleaned = cleaned
    .replace(/\s*\(en\s+[^)]+\)/gi, ' ')
    .replace(/\s*\([^)]*(?:milliers|pourcentage|%|nombre|unité|tonne|kg|km|ha|dh|dirham)[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Optionnellement, supprime les indices numériques à la fin
  if (removeIndices) {
    cleaned = cleaned.replace(/\s*\(\d+\)\s*$/g, '').trim();
  }

  // Normalise les accents (É -> E, è -> e, etc.) pour fusionner les variantes
  if (normalizeAccents) {
    cleaned = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  return cleaned;
};

/**
 * Extrait l'indice numérique à la fin d'un titre (ex: "(1)" de "Titre (1)")
 * @param titre - Le titre de l'indicateur
 * @returns L'indice trouvé ou null
 */
export const extractIndiceFromTitle = (titre: string): string | null => {
  const match = titre.match(/\((\d+)\)\s*$/);
  return match ? `(${match[1]})` : null;
};

/**
 * Normalise un code d'indicateur pour la recherche tolérante aux espaces
 * @param code - Le code de l'indicateur (ex: "2 - 1", "2-1")
 * @returns Le code normalisé sans espaces
 */
export const normalizeCode = (code: string): string => {
  return code.replace(/\s+/g, '').toLowerCase();
};

/**
 * Génère une clé de regroupement pour un indicateur
 * Combine le titre nettoyé et optionnellement la signification de l'indice
 * 
 * @param titreClean - Le titre déjà nettoyé
 * @param significationIndice - La signification de l'indice (optionnel)
 * @returns Une clé unique pour le regroupement
 */
export const generateGroupKey = (
  titreClean: string,
  significationIndice?: string | null
): string => {
  const titreKey = normalizeForComparison(titreClean);
  const signifKey = significationIndice
    ? normalizeForComparison(significationIndice)
    : '__no_indice__';

  return `${titreKey}|||${signifKey}`;
};
