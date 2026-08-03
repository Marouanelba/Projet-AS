/**
 * Utilitaires pour la normalisation des noms de thématiques
 */

/**
 * Libellés de remplacement pour les noms restés fautifs ou vides en base.
 * Correction d'AFFICHAGE uniquement : la base n'est pas modifiée.
 *
 * "Chapitre 9" est un libellé provisoire porté par le seul chapitre 9 de 1979
 * (10 tableaux : voyageurs aux frontières, nuitées, hôtels). Le même chapitre
 * est correctement nommé en 1980, d'où le libellé retenu.
 *
 * Clé = nom nettoyé, en minuscules.
 */
const LIBELLES_CORRIGES: Record<string, string> = {
  'chapitre 9': 'Mouvement Migratoires et Tourisme',
};

/**
 * Nettoie et normalise le nom d'une thématique
 * - Supprime les préfixes numériques (ex: ".1 ", ".2 ")
 * - Supprime les suffixes d'année (ex: "_as_2025", "a.s 2020", " 2019")
 * - Remplace les underscores par des espaces
 * - Capitalise correctement (première lettre majuscule, reste minuscule)
 */
export const normalizeThematiqueName = (nom: string): string => {
  if (!nom) return 'Non classé';
  
  // Supprime tous les préfixes numériques et ponctuation au début (ex: "1 ", "1.", "2.", ".1 ", "2.division")
  let clean = nom.replace(/^[\s.–—\-\d]+[\s.–—\-]*/g, '');
  // Si tout a été supprimé (nom était que des chiffres), reprendre l'original nettoyé
  if (!clean.trim()) clean = nom.trim();
  
  // Supprime les suffixes comme _as_2025, _as2025, _2025, a.s2020, as 2025, as2, 2019, etc.
  clean = clean
    .replace(/\s*a\.?s\.?\s*\d{1,4}$/gi, '') // "a.s2020", "as 2025", "as2" à la fin
    .replace(/\s+\d{4}$/gi, '')             // " 2019", " 2021" à la fin
    .replace(/_as_?\d{1,4}$/gi, '')         // "_as_2025", "_as2025" à la fin
    .replace(/_\d{4}$/g, '')                // "_2025" à la fin
    .replace(/\s+a\.?s\.?\s*$/gi, '')       // " as", " AS", " a.s" à la fin
    .replace(/_/g, ' ')                     // Remplace les underscores par des espaces
    .replace(/\s+a mis à joiur$/gi, '')     // Suffixe spécifique trouvé dans les données
    .trim();
  
  // Libellé de remplacement éventuel (avant capitalisation)
  const corrige = LIBELLES_CORRIGES[clean.toLowerCase()];
  if (corrige) return corrige;

  // Capitalise la première lettre, met le reste en minuscule
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  return clean || 'Non classé';
};
