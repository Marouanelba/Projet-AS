/**
 * Regroupement des thématiques en familles.
 *
 * Une même thématique apparaît en base sous des dizaines d'orthographes :
 * "agriculture", "Agriculture Forets Peche", "Agriculture - Forets - Peche",
 * "Agriculture  Forêts Et Pêche"… Séparateurs, accents, casse, pluriels et
 * fautes de frappe ("Cimatologie", "La Justise") varient d'un annuaire à
 * l'autre. normalizeThematiqueName() ne corrige que les préfixes numériques et
 * les suffixes d'année : elle laisse toutes ces variantes distinctes.
 *
 * Cette table est VOLONTAIREMENT explicite : chaque variante est rattachée à la
 * main à sa famille. Une heuristique automatique fusionnerait "Commerce
 * extérieur" avec "Commerce intérieur", ou enchaînerait Énergie → Mines →
 * Industrie en une seule famille. Pour ajuster un regroupement, il suffit de
 * déplacer un nom d'une liste à l'autre.
 *
 * Aucune écriture en base : ce regroupement n'existe qu'à l'affichage.
 */

export const FAMILLES_THEMATIQUES: Record<string, string[]> = {
  // 208 tableaux
  "Activités culturelles et loisirs": ["Activites Culturelles", "Activites Culturelles Et Loisirs"],
  // 1892 tableaux
  "Agriculture, forêts et pêche": ["Agriculture   Forets   Peche", "Agriculture  Foret Et Peche", "Agriculture  Forets Et Peche", "Agriculture  Forêts Et Pêche", "Agriculture - Elevage", "Agriculture - Forets - Peche", "Agriculture Forets Peche", "agriculture"],
  // 218 tableaux
  "Bourse des valeurs": ["Bourse Des Valeurs", "bourse"],
  // 67 tableaux
  "Budget de l’État": ["BUDGET / الميزانية", "Budget De l Etat", "Budget Etat"],
  // 10 tableaux
  // 137 tableaux
  "Climatologie": ["Cimatologie", "Climatologie", "Climatotogie", "Territoire Climatologie", "climatologie"],
  // 859 tableaux
  "Commerce extérieur": ["Commerce Exterieur", "Commerce extérieur", "commerce exterieur"],
  // 120 tableaux
  "Commerce intérieur": ["Commerce Interieur   Proprietes - Assurances - Travail", "Commerce Interieur   Proprietes Assurances Travail", "Commerce Interieur - Proprietes Assurances Travail", "Commerce Interieur Prix", "Commerce Interieur Proprietes Assurances Travail", "Commerce intérieur - Prix"],
  // 689 tableaux
  "Comptes de la nation": ["Compte De Nation", "Comptes De La Nation", "Les Comptes De La Nation", "Revenu National", "comptabilite"],
  // 58 tableaux
  "Consommation des ménages": ["Conommations", "Consommation Des Menages", "Consommations"],
  // 972 tableaux
  "Construction et foncier": ["Construction", "Construction Et Foncier", "construction foncier"],
  // 539 tableaux
  "Culture": ["culture"],
  // 29 tableaux
  "Division administrative": ["division administrative"],
  // 1393 tableaux
  "Emploi": ["Emploi Et Salaires", "Emploi et chômage", "emploi"],
  // 3155 tableaux
  "Enseignement et formation": ["Enseignement", "Enseignement Et Formation", "enseignement"],
  // 669 tableaux
  "Environnement": ["environnement"],
  // 274 tableaux
  "Finances publiques": ["Finances Publiques", "finances publiques"],
  // 10 tableaux
  "Generalites": ["Generalites"],
  // 1607 tableaux
  "Industrie et artisanat": ["Industrie", "Industrie Et Artisanat", "industrie artisanat"],
  // 985 tableaux
  "Justice": ["Justice", "Justice Et Protection De L Enfance", "Justice Et Protection de l enfance", "Justice Et Sauvegarde De L Enfance", "La Justise", "justice"],
  // 773 tableaux
  "Mines": ["Mines", "Mines Et Industrie", "Mines et Industrie", "mines"],
  // 306 tableaux
  "Monnaie et budget": ["Monnaie Budget", "Monnaie Et Budget"],
  // 604 tableaux
  "Monnaie et crédit": ["Monnaie Credit Banque", "Monnaie Et Credit", "Monnaie-Credit-Banque", "monnaie credit"],
  // 1154 tableaux
  "Population": ["Etat De La Population", "Population", "Population et démographie", "Territoire Et Population", "population"],
  // 1250 tableaux
  "Prix et salaires": ["Prix", "Prix - Salaires", "Prix Et Salaire", "Prix Et Salaires", "Prix Salaires", "Travail - Salaires", "Travails Salaires", "Travails-Salaires", "indice prix"],
  // 13 tableaux
  "Production - mouvement - economie": ["Production - Mouvement - Economie"],
  // 25 tableaux
  "Propriétés et revenus": ["Prioretes Et Revenus", "Proprietes Et Revenuq", "Proprietes et Revenus"],
  // 143 tableaux
  "Propriétés, assurances et travail": ["Proprietes", "Proprietes  Assurances  Travail  Jeunesse  Sports  Et Cinema", "Proprietes - Assurances - Travail - Cinema", "Proprietes Assurances Travail", "Proprietes Assurances Travail Jeunesse Et Sport Cinema", "Propriétés Assurances Travail Jeunesse Et Sport Cinema"],
  // 33 tableaux
  "Prévoyance sociale": ["Prevoyance Assurances Accidents Sinistres", "Prevoyance-Assurances-Accidents-Sinistres", "Prévoyance - Assurances - Accidents - Sinistres"],
  // 1933 tableaux
  "Santé": ["Sante", "Sante Et Prevoyance Sociale", "Sante Publique", "prevoyance sociale", "sante"],
  // 376 tableaux
  "Tourisme": ["Tourisme", "tourisme"],
  // 2497 tableaux
  "Transports et communications": ["Chapitre 9", "Communications Et Mouvements Migratoires", "Mouvement Migratoires et Tourisme", "Mouvements Migratoires", "Parc Automobile", "Transport Routiers", "Transports", "Transports - Communications", "Transports Communications", "Transports Communications Et Mouvement Migratoires", "Transports Communications Et Mouvements Migratoires", "Transports Et Communications", "transport"],
  // 192 tableaux
  "Télécommunications": ["Poste Et Telecommunications", "telecommunication"],
  // 824 tableaux
  "Énergie et eau": ["Energie Et Eau", "energie eau"],
  // 635 tableaux
  "Énergie, mines et industrie": ["Energie", "Energie   Mines   Industrie", "Energie  - Mines   Industrie", "Energie - Mines - Industrie", "Energie Mines Industrie", "Energie Mines Industrie Constructions"],
};

/** Enlève accents, casse et ponctuation pour comparer deux libellés. */
const cle = (nom: string): string =>
  (nom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Index variante -> famille, construit une seule fois. */
const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [famille, variantes] of Object.entries(FAMILLES_THEMATIQUES)) {
    for (const v of variantes) m.set(cle(v), famille);
  }
  return m;
})();

/**
 * Famille d'appartenance d'un nom de thématique.
 * Un nom inconnu de la table devient sa propre famille : rien n'est masqué.
 */
export const familleDeThematique = (nom: string): string => {
  if (!nom || !nom.trim()) return 'Non classé';
  const trouve = INDEX.get(cle(nom));
  if (trouve) return trouve;
  const brut = nom.trim();
  return brut.charAt(0).toUpperCase() + brut.slice(1).toLowerCase();
};

/** Vrai si la famille regroupe plusieurs appellations distinctes. */
export const familleAPlusieursNoms = (famille: string): boolean =>
  (FAMILLES_THEMATIQUES[famille]?.length ?? 0) > 1;
